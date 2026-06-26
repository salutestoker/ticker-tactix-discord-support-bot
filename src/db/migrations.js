import { pathToFileURL } from "node:url";
import { loadConfig } from "../config.js";
import { createDb } from "./db.js";

export async function migrate(db) {
  const hasTickets = await db.schema.hasTable("tickets");

  if (!hasTickets) {
    await db.schema.createTable("tickets", (table) => {
      table.increments("id").primary();
      table.string("guild_id", 32).notNullable();
      table.string("channel_id", 128).notNullable();
      table.string("user_id", 32).notNullable();
      table.string("status", 16).notNullable().defaultTo("open");
      table.text("reason").nullable();
      table.string("claimed_by", 32).nullable();
      table.timestamp("created_at").notNullable().defaultTo(db.fn.now());
      table.timestamp("closed_at").nullable();
      table.string("closed_by", 32).nullable();
      table.string("open_dedupe_key", 128).nullable();

      table.index(["guild_id", "user_id", "status"], "tickets_user_status_idx");
      table.unique(["channel_id"], { indexName: "tickets_channel_id_unique" });
      table.unique(["open_dedupe_key"], { indexName: "tickets_open_dedupe_key_unique" });
    });
  }
}

async function run() {
  const config = loadConfig({ discord: false });
  const db = createDb(config.database);

  try {
    await migrate(db);
    console.log("Database migrations completed.");
  } finally {
    await db.destroy();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
