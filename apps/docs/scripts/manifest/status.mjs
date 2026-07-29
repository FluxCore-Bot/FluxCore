/**
 * @typedef {Object} Evidence
 * @property {string | null} system
 * @property {string | null} botFeature
 * @property {string | null} serverFeature
 * @property {string | null} clientRoute
 * @property {string[]} commands
 * @property {string | null} spec
 */

/**
 * Decide how a feature is documented, from source evidence alone.
 *
 * Never consult CLAUDE.md, docs/implementation-plan.md, or docs/features/*.md
 * for status. All three mark shipped modules "Not Started".
 *
 * @param {Evidence} evidence
 * @returns {"shipped" | "planned" | "partial"}
 */
export function deriveStatus(evidence) {
  const hasSource = Boolean(evidence.system || evidence.botFeature);
  const isReachable =
    evidence.commands.length > 0 || Boolean(evidence.clientRoute);

  if (hasSource && isReachable) return "shipped";
  if (!hasSource) return "planned";
  return "partial";
}
