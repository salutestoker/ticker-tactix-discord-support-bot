import { describe, expect, it } from "vitest";
import { sanitizeTicketChannelName } from "../src/utils/channel-names.js";

describe("sanitizeTicketChannelName", () => {
  it("normalizes usernames for Discord channel names", () => {
    expect(sanitizeTicketChannelName("Trader John!")).toBe("ticket-trader-john");
  });

  it("falls back when a username has no supported characters", () => {
    expect(sanitizeTicketChannelName("!!!")).toBe("ticket-user");
  });

  it("keeps the channel name within Discord's 100 character limit", () => {
    const name = sanitizeTicketChannelName("a".repeat(200));
    expect(name).toHaveLength(100);
    expect(name.startsWith("ticket-")).toBe(true);
  });
});
