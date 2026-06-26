import { PermissionsBitField, PermissionFlagsBits } from "discord.js";
import { describe, expect, it } from "vitest";
import { canCloseTicket, canSetupTickets } from "../src/services/permission-service.js";

describe("permission service", () => {
  it("allows setup for Manage Guild permission", () => {
    const permissions = new PermissionsBitField(PermissionFlagsBits.ManageGuild);
    expect(canSetupTickets(permissions)).toBe(true);
  });

  it("allows close for support role", () => {
    const member = {
      roles: {
        cache: new Map([["support-role-id", {}]]),
      },
    };

    expect(
      canCloseTicket({
        member,
        supportRoleId: "support-role-id",
      }),
    ).toBe(true);
  });

  it("allows close for Manage Channels permission", () => {
    const permissions = new PermissionsBitField(PermissionFlagsBits.ManageChannels);

    expect(
      canCloseTicket({
        memberPermissions: permissions,
        supportRoleId: "support-role-id",
      }),
    ).toBe(true);
  });
});
