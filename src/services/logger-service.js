import { EmbedBuilder } from "discord.js";

function formatTimestamp(value) {
  if (!value) {
    return "Unknown";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

export class LoggerService {
  constructor(config) {
    this.config = config;
  }

  async logTicketClosed({ guild, ticket, closedBy, opener }) {
    const channel = await guild.channels.fetch(this.config.discord.ticketLogChannelId).catch(() => null);

    if (!channel?.isTextBased?.()) {
      throw new Error("Ticket log channel was not found or is not text-based");
    }

    const openerText = opener ? `${opener.tag} (${opener.id})` : ticket.user_id;
    const closedByText = `${closedBy.tag} (${closedBy.id})`;

    const embed = new EmbedBuilder()
      .setTitle("Ticket Closed")
      .setColor(0xdc2626)
      .addFields(
        { name: "Channel", value: ticket.channel_name ?? ticket.channel_id, inline: true },
        { name: "Opened By", value: openerText, inline: true },
        { name: "Closed By", value: closedByText, inline: true },
        { name: "Created", value: formatTimestamp(ticket.created_at), inline: true },
        { name: "Closed", value: formatTimestamp(ticket.closed_at), inline: true },
        { name: "Reason", value: ticket.reason || "No reason provided" },
      )
      .setTimestamp(new Date());

    await channel.send({ embeds: [embed] });
  }
}
