const MAX_DISCORD_CHANNEL_NAME_LENGTH = 100;
const PREFIX = "ticket-";

export function sanitizeTicketChannelName(username) {
  const maxUsernameLength = MAX_DISCORD_CHANNEL_NAME_LENGTH - PREFIX.length;
  const sanitized = String(username)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, maxUsernameLength)
    .replace(/-+$/g, "");

  return `${PREFIX}${sanitized || "user"}`;
}
