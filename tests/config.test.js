import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig, parseBoolean } from "../src/config.js";

describe("loadConfig", () => {
  it("loads sqlite config without Discord values for migrations", () => {
    const config = loadConfig({
      discord: false,
      env: {
        DATABASE_CLIENT: "sqlite",
        DATABASE_PATH: "./storage/test.sqlite",
      },
    });

    expect(config.database).toEqual({
      client: "sqlite",
      path: "./storage/test.sqlite",
    });
  });

  it("loads mysql config from Laravel Cloud style DB variables", () => {
    const config = loadConfig({
      discord: false,
      env: {
        DATABASE_CLIENT: "mysql",
        DB_HOST: "example.internal",
        DB_PORT: "3306",
        DB_DATABASE: "tickets",
        DB_USERNAME: "bot",
        DB_PASSWORD: "secret",
      },
    });

    expect(config.database.connection).toMatchObject({
      host: "example.internal",
      database: "tickets",
      user: "bot",
      password: "secret",
    });
  });

  it("requires runtime Discord values", () => {
    expect(() => loadConfig({ discord: "runtime", env: { DATABASE_CLIENT: "sqlite" } })).toThrow(ConfigError);
  });
});

describe("parseBoolean", () => {
  it("parses common truthy and falsey values", () => {
    expect(parseBoolean("true")).toBe(true);
    expect(parseBoolean("0", true)).toBe(false);
    expect(parseBoolean("", true)).toBe(true);
  });
});
