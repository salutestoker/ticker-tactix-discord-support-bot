import { REST, Routes } from "discord.js";
import { setupTicketsCommand } from "./commands/setup-tickets.js";
import { loadConfig } from "./config.js";

async function deployCommands() {
  const config = loadConfig({ discord: "commands" });
  const rest = new REST({ version: "10" }).setToken(config.discord.token);
  const commands = [setupTicketsCommand.toJSON()];

  await rest.put(Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId), {
    body: commands,
  });

  console.log(`Deployed ${commands.length} guild command(s).`);
}

deployCommands().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
