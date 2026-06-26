import dotenv from "dotenv";

dotenv.config();

const DATABASE_CLIENTS = new Set(["sqlite", "mysql"]);

export class ConfigError extends Error {
  constructor(errors) {
    super(`Invalid configuration:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    this.name = "ConfigError";
    this.errors = errors;
  }
}

function valueFor(env, key) {
  const value = env[key];
  return typeof value === "string" ? value.trim() : "";
}

function required(env, key, errors) {
  const value = valueFor(env, key);
  if (!value) {
    errors.push(`${key} is required`);
  }
  return value;
}

function requiredAny(env, keys, errors) {
  for (const key of keys) {
    const value = valueFor(env, key);
    if (value) {
      return value;
    }
  }

  errors.push(`${keys.join(" or ")} is required`);
  return "";
}

function optional(env, key) {
  return valueFor(env, key) || null;
}

function parsePort(value, errors) {
  if (!value) {
    return 3306;
  }

  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push("DB_PORT must be a valid TCP port");
    return 3306;
  }

  return port;
}

export function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  throw new ConfigError([`Expected boolean value, received "${value}"`]);
}

function inferDatabaseClient(env) {
  const configured = valueFor(env, "DATABASE_CLIENT").toLowerCase();
  if (configured) {
    return configured;
  }

  return valueFor(env, "DATABASE_URL") ||
    valueFor(env, "MYSQL_URL") ||
    valueFor(env, "DB_HOST") ||
    valueFor(env, "MYSQLHOST")
    ? "mysql"
    : "sqlite";
}

function loadDatabaseConfig(env, errors) {
  const client = inferDatabaseClient(env);

  if (!DATABASE_CLIENTS.has(client)) {
    errors.push("DATABASE_CLIENT must be either sqlite or mysql");
  }

  if (client === "mysql") {
    const databaseUrl = optional(env, "DATABASE_URL") ?? optional(env, "MYSQL_URL");
    const connection = databaseUrl
      ? { url: databaseUrl }
      : {
          host: requiredAny(env, ["DB_HOST", "MYSQLHOST"], errors),
          port: parsePort(valueFor(env, "DB_PORT") || valueFor(env, "MYSQLPORT"), errors),
          database: requiredAny(env, ["DB_DATABASE", "MYSQLDATABASE"], errors),
          user: requiredAny(env, ["DB_USERNAME", "MYSQLUSER"], errors),
          password: requiredAny(env, ["DB_PASSWORD", "MYSQLPASSWORD"], errors),
        };

    return {
      client,
      connection,
      sslCaPath: optional(env, "MYSQL_ATTR_SSL_CA"),
    };
  }

  return {
    client: "sqlite",
    path: valueFor(env, "DATABASE_PATH") || "./storage/tickets.sqlite",
  };
}

function loadDiscordConfig(env, mode, errors) {
  if (!mode) {
    return null;
  }

  const discord = {
    token: required(env, "DISCORD_TOKEN", errors),
    clientId: required(env, "DISCORD_CLIENT_ID", errors),
    guildId: required(env, "DISCORD_GUILD_ID", errors),
    supportRoleId: optional(env, "SUPPORT_ROLE_ID"),
    ticketCategoryId: optional(env, "TICKET_CATEGORY_ID"),
    ticketLogChannelId: optional(env, "TICKET_LOG_CHANNEL_ID"),
  };

  if (mode === "runtime") {
    if (!discord.supportRoleId) {
      errors.push("SUPPORT_ROLE_ID is required");
    }

    if (!discord.ticketLogChannelId) {
      errors.push("TICKET_LOG_CHANNEL_ID is required");
    }
  }

  return discord;
}

export function loadConfig(options = {}) {
  const env = options.env ?? process.env;
  const discordMode = options.discord ?? "runtime";
  const errors = [];

  let deleteTicketOnClose = true;
  try {
    deleteTicketOnClose = parseBoolean(env.DELETE_TICKET_ON_CLOSE, true);
  } catch (error) {
    if (error instanceof ConfigError) {
      errors.push(...error.errors);
    } else {
      throw error;
    }
  }

  const config = {
    discord: loadDiscordConfig(env, discordMode, errors),
    database: loadDatabaseConfig(env, errors),
    deleteTicketOnClose,
  };

  if (errors.length > 0) {
    throw new ConfigError(errors);
  }

  return config;
}
