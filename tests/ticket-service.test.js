import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb } from "../src/db/db.js";
import { migrate } from "../src/db/migrations.js";
import { DuplicateOpenTicketError, TicketService } from "../src/services/ticket-service.js";

describe("TicketService", () => {
  let db;
  let service;

  beforeEach(async () => {
    db = createDb({
      client: "sqlite",
      path: ":memory:",
    });
    await migrate(db);
    service = new TicketService(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  it("prevents duplicate open tickets per user and guild", async () => {
    const ticket = await service.reserveOpenTicket({
      guildId: "guild-1",
      userId: "user-1",
      reason: "Need help",
      interactionId: "interaction-1",
    });

    await service.attachChannel(ticket.id, "channel-1");

    await expect(
      service.reserveOpenTicket({
        guildId: "guild-1",
        userId: "user-1",
        reason: "Need more help",
        interactionId: "interaction-2",
      }),
    ).rejects.toThrow(DuplicateOpenTicketError);
  });

  it("clears open dedupe key after close so a user can open a new ticket", async () => {
    const ticket = await service.reserveOpenTicket({
      guildId: "guild-1",
      userId: "user-1",
      reason: "Need help",
      interactionId: "interaction-1",
    });

    await service.attachChannel(ticket.id, "channel-1");
    await service.closeTicket("channel-1", "support-1");

    const nextTicket = await service.reserveOpenTicket({
      guildId: "guild-1",
      userId: "user-1",
      reason: "Different issue",
      interactionId: "interaction-2",
    });

    expect(nextTicket.id).not.toBe(ticket.id);
  });

  it("records a recovered closed ticket when the original row is missing", async () => {
    const recovered = await service.recordRecoveredClosedTicket({
      guildId: "guild-1",
      channelId: "channel-1",
      userId: "user-1",
      reason: "Recovered ticket",
      createdAt: new Date("2026-06-26T15:42:00.000Z"),
      closedBy: "support-1",
    });

    const stored = await service.findByChannel("channel-1");

    expect(recovered).toMatchObject({
      guild_id: "guild-1",
      channel_id: "channel-1",
      user_id: "user-1",
      status: "closed",
      reason: "Recovered ticket",
      closed_by: "support-1",
    });
    expect(stored).toMatchObject({
      channel_id: "channel-1",
      status: "closed",
    });
  });
});
