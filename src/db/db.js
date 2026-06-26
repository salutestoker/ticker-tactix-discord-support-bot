import fs from "node:fs";
import path from "node:path";
import knex from "knex";

function sqliteConnection(database) {
  if (database.path !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(database.path)), { recursive: true });
  }

  return {
    client: "better-sqlite3",
    connection: {
      filename: database.path,
    },
    useNullAsDefault: true,
  };
}

function mysqlConnection(database) {
  const connection =
    "url" in database.connection
      ? database.connection.url
      : {
          host: database.connection.host,
          port: database.connection.port,
          database: database.connection.database,
          user: database.connection.user,
          password: database.connection.password,
        };

  if (typeof connection === "object" && database.sslCaPath) {
    connection.ssl = {
      ca: fs.readFileSync(database.sslCaPath, "utf8"),
    };
  }

  return {
    client: "mysql2",
    connection,
    pool: {
      min: 0,
      max: 5,
    },
  };
}

export function createDb(database) {
  return knex(database.client === "mysql" ? mysqlConnection(database) : sqliteConnection(database));
}
