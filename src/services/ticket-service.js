export class DuplicateOpenTicketError extends Error {
  constructor(message = "User already has an open ticket in this guild") {
    super(message);
    this.name = "DuplicateOpenTicketError";
  }
}

export function buildOpenDedupeKey(guildId, userId) {
  return `${guildId}:${userId}:open`;
}

export function isUniqueConstraintError(error) {
  return (
    error?.code === "SQLITE_CONSTRAINT_UNIQUE" ||
    error?.code === "SQLITE_CONSTRAINT" ||
    error?.code === "ER_DUP_ENTRY" ||
    error?.errno === 1062
  );
}

export class TicketService {
  constructor(db) {
    this.db = db;
  }

  async findOpenByUser(guildId, userId) {
    return this.db("tickets")
      .where({
        guild_id: guildId,
        user_id: userId,
        status: "open",
      })
      .first();
  }

  async findOpenByChannel(channelId) {
    return this.db("tickets")
      .where({
        channel_id: channelId,
        status: "open",
      })
      .first();
  }

  async findByChannel(channelId) {
    return this.db("tickets").where({ channel_id: channelId }).first();
  }

  async reserveOpenTicket({ guildId, userId, reason, interactionId }) {
    const openDedupeKey = buildOpenDedupeKey(guildId, userId);
    const pendingChannelId = `pending:${interactionId}`;

    try {
      await this.db("tickets").insert({
        guild_id: guildId,
        channel_id: pendingChannelId,
        user_id: userId,
        status: "open",
        reason,
        open_dedupe_key: openDedupeKey,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new DuplicateOpenTicketError();
      }
      throw error;
    }

    return this.db("tickets").where({ open_dedupe_key: openDedupeKey }).first();
  }

  async attachChannel(ticketId, channelId) {
    await this.db("tickets").where({ id: ticketId }).update({ channel_id: channelId });
    return this.db("tickets").where({ id: ticketId }).first();
  }

  async deleteTicket(ticketId) {
    await this.db("tickets").where({ id: ticketId }).delete();
  }

  async closeTicket(channelId, closedBy) {
    const ticket = await this.findOpenByChannel(channelId);
    if (!ticket) {
      return null;
    }

    const closedAt = new Date();

    await this.db("tickets").where({ id: ticket.id }).update({
      status: "closed",
      closed_at: closedAt,
      closed_by: closedBy,
      open_dedupe_key: null,
    });

    return {
      ...ticket,
      status: "closed",
      closed_at: closedAt.toISOString(),
      closed_by: closedBy,
      open_dedupe_key: null,
    };
  }

  async recordRecoveredClosedTicket({ guildId, channelId, userId, reason, createdAt, closedBy }) {
    const existing = await this.findByChannel(channelId);
    if (existing) {
      return existing;
    }

    const closedAt = new Date();

    try {
      await this.db("tickets").insert({
        guild_id: guildId,
        channel_id: channelId,
        user_id: userId,
        status: "closed",
        reason,
        created_at: createdAt ?? closedAt,
        closed_at: closedAt,
        closed_by: closedBy,
        open_dedupe_key: null,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }

    return {
      guild_id: guildId,
      channel_id: channelId,
      user_id: userId,
      status: "closed",
      reason,
      created_at: createdAt?.toISOString?.() ?? closedAt.toISOString(),
      closed_at: closedAt.toISOString(),
      closed_by: closedBy,
      open_dedupe_key: null,
    };
  }
}
