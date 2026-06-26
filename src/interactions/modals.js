import { ChannelType, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { TICKET_OPEN_MODAL_ID, TICKET_REASON_INPUT_ID } from "../constants.js";
import { DuplicateOpenTicketError } from "../services/ticket-service.js";
import { sanitizeTicketChannelName } from "../utils/channel-names.js";
import { closeTicketButtonRow } from "./buttons.js";

function ticketChannelPermissions({ guild, openerId, supportRoleId, botUserId }) {
  return [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: openerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: supportRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    },
    {
      id: botUserId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];
}

async function findExistingTicketState(interaction, ticketService) {
  const existing = await ticketService.findOpenByUser(interaction.guildId, interaction.user.id);
  if (!existing) {
    return null;
  }

  if (existing.channel_id.startsWith("pending:")) {
    return { ticket: existing, isStale: true };
  }

  const channel = await interaction.guild.channels.fetch(existing.channel_id).catch(() => null);
  return channel ? { ticket: existing, isStale: false } : { ticket: existing, isStale: true };
}

async function createTicketChannel(interaction, config, reason) {
  return interaction.guild.channels.create({
    name: sanitizeTicketChannelName(interaction.user.username),
    type: ChannelType.GuildText,
    parent: config.discord.ticketCategoryId ?? undefined,
    topic: `Support ticket for ${interaction.user.tag} (${interaction.user.id})`,
    permissionOverwrites: ticketChannelPermissions({
      guild: interaction.guild,
      openerId: interaction.user.id,
      supportRoleId: config.discord.supportRoleId,
      botUserId: interaction.client.user.id,
    }),
    reason: `Support ticket opened by ${interaction.user.tag}: ${reason.slice(0, 400)}`,
  });
}

async function sendTicketIntro(channel, interaction, reason, supportRoleId) {
  const embed = new EmbedBuilder()
    .setTitle("Support Ticket")
    .setColor(0x2563eb)
    .setDescription("A support team member will help you here.")
    .addFields(
      { name: "Opened By", value: `<@${interaction.user.id}>`, inline: true },
      { name: "Reason", value: reason },
    )
    .setTimestamp(new Date());

  await channel.send({
    content: `<@${interaction.user.id}> <@&${supportRoleId}>`,
    embeds: [embed],
    components: [closeTicketButtonRow()],
  });
}

async function handleTicketOpenModal(interaction, context) {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "Tickets can only be opened inside a server.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const reason = interaction.fields.getTextInputValue(TICKET_REASON_INPUT_ID).trim();
  const existing = await findExistingTicketState(interaction, context.ticketService);

  if (existing && !existing.isStale) {
    await interaction.editReply(`You already have an open ticket: <#${existing.ticket.channel_id}>`);
    return;
  }

  if (existing?.isStale) {
    await context.ticketService.deleteTicket(existing.ticket.id);
  }

  let ticket;
  try {
    ticket = await context.ticketService.reserveOpenTicket({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      reason,
      interactionId: interaction.id,
    });
  } catch (error) {
    if (error instanceof DuplicateOpenTicketError) {
      const duplicate = await context.ticketService.findOpenByUser(interaction.guildId, interaction.user.id);
      const ticketLink = duplicate?.channel_id && !duplicate.channel_id.startsWith("pending:")
        ? `<#${duplicate.channel_id}>`
        : "your existing ticket";
      await interaction.editReply(`You already have an open ticket: ${ticketLink}`);
      return;
    }
    throw error;
  }

  let channel;
  try {
    channel = await createTicketChannel(interaction, context.config, reason);
    await context.ticketService.attachChannel(ticket.id, channel.id);
    await sendTicketIntro(channel, interaction, reason, context.config.discord.supportRoleId);
  } catch (error) {
    console.error("Failed to create ticket channel", error);

    if (channel) {
      await channel.delete("Rolling back failed ticket setup").catch(() => null);
    }

    await context.ticketService.deleteTicket(ticket.id).catch(() => null);
    await interaction.editReply("I could not create your ticket. Please contact support staff directly.");
    return;
  }

  await interaction.editReply(`Your ticket has been opened: <#${channel.id}>`);
}

export async function handleModalSubmitInteraction(interaction, context) {
  if (interaction.customId === TICKET_OPEN_MODAL_ID) {
    await handleTicketOpenModal(interaction, context);
    return true;
  }

  return false;
}
