/**
 * @typedef {Object} Evidence
 * @property {string | null} system
 * @property {string | null} botFeature
 * @property {string | null} serverFeature
 * @property {string | null} clientRoute
 * @property {string[] | undefined} [commands] - Callers assembling
 *   Evidence piecemeal from independent source scans may omit this key
 *   entirely when a scan finds no commands; treat that the same as [].
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
  const hasSource = Boolean(
    evidence.system || evidence.botFeature || evidence.serverFeature || evidence.clientRoute,
  );
  const isReachable =
    (evidence.commands ?? []).length > 0 || Boolean(evidence.clientRoute);

  if (hasSource && isReachable) return "shipped";
  if (!hasSource) return "planned";
  return "partial";
}
