import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  MAX_REASON_LENGTH,
  TICKET_CLOSE_BUTTON_ID,
  TICKET_OPEN_BUTTON_ID,
  TICKET_OPEN_MODAL_ID,
  TICKET_REASON_INPUT_ID,
} from "../constants.js";
import { canCloseTicket } from "../services/permission-service.js";

function openerIdFromChannelTopic(topic) {
  const match = topic?.match(/\((\d{17,22})\)/);
  return match?.[1] ?? null;
}

async function closeOrRecoverTicket(interaction, context) {
  const ticket = await context.ticketService.closeTicket(interaction.channelId, interaction.user.id);
  if (ticket) {
    return ticket;
  }

  const existingTicket = await context.ticketService.findByChannel(interaction.channelId);
  if (existingTicket) {
    return existingTicket.status === "closed" ? existingTicket : null;
  }

  const openerId = openerIdFromChannelTopic(interaction.channel?.topic);
  if (!openerId) {
    return null;
  }

  return context.ticketService.recordRecoveredClosedTicket({
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    userId: openerId,
    reason: "Recovered from ticket channel metadata because the original database record was missing.",
    createdAt: interaction.channel?.createdAt,
    closedBy: interaction.user.id,
  });
}

export function closeTicketButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(TICKET_CLOSE_BUTTON_ID)
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger),
  );
}

async function showTicketOpenModal(interaction) {
  const modal = new ModalBuilder().setCustomId(TICKET_OPEN_MODAL_ID).setTitle("Open Support Ticket");

  const reasonInput = new TextInputBuilder()
    .setCustomId(TICKET_REASON_INPUT_ID)
    .setLabel("What do you need help with?")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(MAX_REASON_LENGTH);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

  await interaction.showModal(modal);
}

async function handleCloseTicketButton(interaction, context) {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "Tickets can only be closed inside a server.",
      ephemeral: true,
    });
    return;
  }

  if (
    !canCloseTicket({
      member: interaction.member,
      memberPermissions: interaction.memberPermissions,
      supportRoleId: context.config.discord.supportRoleId,
    })
  ) {
    await interaction.reply({
      content: "Only support staff can close tickets.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const ticket = await closeOrRecoverTicket(interaction, context);
  if (!ticket) {
    await interaction.editReply(
      "I could not find a ticket record for this channel. This usually means the ticket was created before the current production database was connected.",
    );
    return;
  }

  if (ticket.status === "closed" && ticket.closed_by !== interaction.user.id) {
    await interaction.editReply("This ticket is already closed.");
    return;
  }

  const channelName = interaction.channel?.name ?? interaction.channelId;
  const opener = await interaction.client.users.fetch(ticket.user_id).catch(() => null);

  try {
    await context.loggerService.logTicketClosed({
      guild: interaction.guild,
      ticket: {
        ...ticket,
        channel_name: channelName,
      },
      closedBy: interaction.user,
      opener,
    });
  } catch (error) {
    console.error("Failed to send ticket close log", error);
    await interaction.editReply("Ticket was marked closed, but I could not send the close log. The channel was not deleted.");
    return;
  }

  if (context.config.deleteTicketOnClose) {
    await interaction.editReply("Ticket closed and logged. This channel will be deleted.");
    setTimeout(() => {
      interaction.channel
        ?.delete(`Ticket closed by ${interaction.user.tag}`)
        .catch((error) => console.error("Failed to delete ticket channel", error));
    }, 3000);
    return;
  }

  await interaction.editReply("Ticket closed and logged.");
}

export async function handleButtonInteraction(interaction, context) {
  if (interaction.customId === TICKET_OPEN_BUTTON_ID) {
    await showTicketOpenModal(interaction);
    return true;
  }

  if (interaction.customId === TICKET_CLOSE_BUTTON_ID) {
    await handleCloseTicketButton(interaction, context);
    return true;
  }

  return false;
}
