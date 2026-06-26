import { PermissionFlagsBits } from "discord.js";

function hasPermission(permissions, permission) {
  return Boolean(permissions?.has?.(permission));
}

function hasRole(member, roleId) {
  if (!roleId || !member?.roles) {
    return false;
  }

  if (Array.isArray(member.roles)) {
    return member.roles.includes(roleId);
  }

  return Boolean(member.roles.cache?.has?.(roleId));
}

export function canSetupTickets(memberPermissions) {
  return (
    hasPermission(memberPermissions, PermissionFlagsBits.Administrator) ||
    hasPermission(memberPermissions, PermissionFlagsBits.ManageGuild)
  );
}

export function canCloseTicket({ member, memberPermissions, supportRoleId }) {
  return (
    hasPermission(memberPermissions ?? member?.permissions, PermissionFlagsBits.Administrator) ||
    hasPermission(memberPermissions ?? member?.permissions, PermissionFlagsBits.ManageChannels) ||
    hasRole(member, supportRoleId)
  );
}
