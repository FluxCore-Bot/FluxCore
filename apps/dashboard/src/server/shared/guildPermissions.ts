/**
 * Discord permission bits that grant dashboard management of a guild.
 *
 * Discord's ADMINISTRATOR permission implies every other permission, so a user
 * with an admin-only role may not have the MANAGE_GUILD bit set explicitly in
 * the OAuth `/users/@me/guilds` permissions field. We accept either bit.
 */
const ADMINISTRATOR = BigInt(0x8);
const MANAGE_GUILD = BigInt(0x20);

/**
 * True when the given OAuth permissions bitfield lets the user manage a guild
 * from the dashboard (has Administrator or Manage Server).
 */
export function canManageGuild(permissions: string): boolean {
  const bits = BigInt(permissions);
  return (bits & ADMINISTRATOR) !== BigInt(0) || (bits & MANAGE_GUILD) !== BigInt(0);
}
