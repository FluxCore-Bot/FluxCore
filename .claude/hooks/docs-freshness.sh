#!/bin/bash
# Stop hook: Warns when source changed after the manifest was generated.
#
# This is not a security boundary and never blocks — but it must never
# silently report "everything is fresh" when it could not actually tell.
# Every failure mode below (jq missing, manifest malformed, git failing,
# a dangling/unreachable stamped commit, a missing stamp) emits an explicit
# warning that says freshness could not be determined, instead of falling
# through to a quiet exit 0. The ONLY silent exit is when the manifest
# genuinely does not exist yet (fresh checkout, docs site not built here).

set -uo pipefail

INPUT=$(cat)
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
MANIFEST="$REPO_ROOT/apps/docs/_manifest.json"

warn() {
  local reason="$1"
  jq -n --arg reason "$reason" '{
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext: ("📄 DOCS FRESHNESS: " + $reason)
    }
  }'
  exit 0
}

# The one legitimate silent exit: no manifest exists yet in this checkout,
# so there is nothing to compare against.
[ -f "$MANIFEST" ] || exit 0

if ! command -v jq >/dev/null 2>&1; then
  # Can't build JSON output without jq either, so emit it by hand.
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"📄 DOCS FRESHNESS: jq is not installed, so documentation freshness could not be checked (this hook needs it to read apps/docs/_manifest.json). Install jq, or manually confirm the manifest is current: pnpm --filter @fluxcore/docs manifest (run on the host — the manifest builder needs git, which is not available inside the bot Docker container)."}}'
  exit 0
fi

# Malformed JSON must not be treated as "no stamp = fresh" — it means we
# genuinely cannot read the manifest at all.
if ! jq -e '.' "$MANIFEST" >/dev/null 2>&1; then
  warn "apps/docs/_manifest.json is not valid JSON, so documentation freshness could not be checked. Regenerate it with: pnpm --filter @fluxcore/docs manifest (run on the host)."
fi

STAMPED=$(jq -r '.generatedFromCommit // empty' "$MANIFEST" 2>/dev/null)
JQ_STATUS=$?
if [ "$JQ_STATUS" -ne 0 ]; then
  warn "apps/docs/_manifest.json could not be read (jq failed), so documentation freshness could not be checked. Regenerate it with: pnpm --filter @fluxcore/docs manifest (run on the host)."
fi

# A null or missing generatedFromCommit is NOT "nothing to check" — it means
# the manifest builder couldn't stamp a commit (e.g. it ran in a git-less
# environment like the bot's Docker test container) and the manifest's
# accuracy relative to HEAD is unknown. Treat that as always stale.
if [ -z "$STAMPED" ]; then
  warn "apps/docs/_manifest.json has no generatedFromCommit stamp (it is null or missing), so the staleness check cannot be performed — the manifest may have been generated in an environment without git. Regenerate it with: pnpm --filter @fluxcore/docs manifest (run on the host — the bot's Docker container has no git binary and no .git mount)."
fi

CURRENT=$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo "")
if [ -z "$CURRENT" ]; then
  warn "the current HEAD commit could not be resolved, so documentation freshness could not be checked."
fi

[ "$STAMPED" = "$CURRENT" ] && exit 0

# Confirm the stamped commit is still a valid, reachable object in this repo.
# A rebase or force-push can leave it dangling (or gone after gc), in which
# case `git diff` below would error — catch that explicitly rather than let
# a diff failure fall through to "no changes".
if ! git -C "$REPO_ROOT" cat-file -e "${STAMPED}^{commit}" 2>/dev/null; then
  warn "apps/docs/_manifest.json is stamped with commit ${STAMPED}, which is not a reachable commit in this repository (likely a rebase or force-push). Freshness cannot be determined. Regenerate it with: pnpm --filter @fluxcore/docs manifest (run on the host)."
fi

CHANGED_RAW=$(git -C "$REPO_ROOT" diff --name-only "$STAMPED" "$CURRENT" 2>/dev/null)
DIFF_STATUS=$?
if [ "$DIFF_STATUS" -ne 0 ]; then
  warn "git diff between ${STAMPED} and HEAD failed, so documentation freshness could not be checked. Regenerate the manifest with: pnpm --filter @fluxcore/docs manifest (run on the host)."
fi

CHANGED=$(printf '%s\n' "$CHANGED_RAW" | grep -E '^(apps/(bot|dashboard)/src/|packages/systems/src/|\.env\.example)' || true)

[ -z "$CHANGED" ] && exit 0

COUNT=$(printf '%s\n' "$CHANGED" | grep -c .)

jq -n --arg count "$COUNT" '{
  hookSpecificOutput: {
    hookEventName: "Stop",
    additionalContext: ("📄 DOCS FRESHNESS: " + $count + " documented source file(s) changed since apps/docs/_manifest.json was generated. Regenerate it (pnpm --filter @fluxcore/docs manifest, run on the host) and re-run /document-system for affected features.")
  }
}'
exit 0
