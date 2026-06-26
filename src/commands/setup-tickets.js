import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { TICKET_OPEN_BUTTON_ID } from "../constants.js";
import { canSetupTickets } from "../services/permission-service.js";

const PANEL_CHANNEL_PERMISSIONS = [
  [PermissionFlagsBits.ViewChannel, "View Channel"],
  [PermissionFlagsBits.SendMessages, "Send Messages"],
  [PermissionFlagsBits.EmbedLinks, "Embed Links"],
];

export const setupTicketsCommand = new SlashCommandBuilder()
  .setName("setup-tickets")
  .setDescription("Post the support ticket panel in this channel.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export async function handleSetupTicketsCommand(interaction) {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "This command can only be used inside a server.",
      ephemeral: true,
    });
    return;
  }

  if (!canSetupTickets(interaction.memberPermissions)) {
    await interaction.reply({
      content: "You need Manage Server or Administrator permission to set up ticket panels.",
      ephemeral: true,
    });
    return;
  }

  if (!interaction.channel?.isTextBased?.()) {
    await interaction.reply({
      content: "Run this command in the text channel where you want the ticket panel posted.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const botMember = interaction.guild.members.me ?? (await interaction.guild.members.fetchMe());
  const channelPermissions = interaction.channel.permissionsFor(botMember);
  const missingPermissions = PANEL_CHANNEL_PERMISSIONS.filter(([permission]) => !channelPermissions?.has(permission)).map(
    ([, label]) => label,
  );

  if (missingPermissions.length > 0) {
    await interaction.editReply(
      `I cannot post the ticket panel in this channel yet. Give my bot role these channel permissions: ${missingPermissions.join(
        ", ",
      )}.`,
    );
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("Support Tickets")
    .setDescription("Need help from the Ticker Tactix team? Open a private support ticket and describe what you need help with.")
    .setColor(0x0f766e);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(TICKET_OPEN_BUTTON_ID)
      .setLabel("Open Ticket")
      .setStyle(ButtonStyle.Primary),
  );

  await interaction.channel.send({
    embeds: [embed],
    components: [row],
  });

  await interaction.editReply("Ticket panel posted.");
}
