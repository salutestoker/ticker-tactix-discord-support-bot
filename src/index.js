import { Client, Events, GatewayIntentBits } from "discord.js";
import { handleSetupTicketsCommand } from "./commands/setup-tickets.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/db.js";
import { migrate } from "./db/migrations.js";
import { handleButtonInteraction } from "./interactions/buttons.js";
import { handleModalSubmitInteraction } from "./interactions/modals.js";
import { LoggerService } from "./services/logger-service.js";
import { TicketService } from "./services/ticket-service.js";

async function safeErrorReply(interaction) {
  const message = "Something went wrong while handling that interaction.";

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ content: message, ephemeral: true }).catch(() => null);
    return;
  }

  await interaction.reply({ content: message, ephemeral: true }).catch(() => null);
}

async function main() {
  const config = loadConfig({ discord: "runtime" });
  const db = createDb(config.database);
  await migrate(db);

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  const context = {
    config,
    ticketService: new TicketService(db),
    loggerService: new LoggerService(config),
  };

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand() && interaction.commandName === "setup-tickets") {
        await handleSetupTicketsCommand(interaction);
        return;
      }

      if (interaction.isButton()) {
        await handleButtonInteraction(interaction, context);
        return;
      }

      if (interaction.isModalSubmit()) {
        await handleModalSubmitInteraction(interaction, context);
      }
    } catch (error) {
      console.error("Interaction handler failed", error);
      await safeErrorReply(interaction);
    }
  });

  async function shutdown(signal) {
    console.log(`Received ${signal}; shutting down.`);
    client.destroy();
    await db.destroy();
    process.exit(0);
  }

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  await client.login(config.discord.token);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
