#!/bin/bash
# PreToolUse hook: Blocks writes to apps/docs/** that reference nonexistent repo paths.
# Documentation that cites a path which does not exist costs the reader their trust.

set -eo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

case "$FILE_PATH" in
  */apps/docs/*) ;;
  *) exit 0 ;;
esac

CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // .tool_input.new_string // empty')
[ -z "$CONTENT" ] && exit 0

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
VERIFY_SCRIPT="$REPO_ROOT/apps/docs/scripts/verify-doc-paths.mjs"

# Capture the verifier's exit status separately from its output, and do NOT
# let a failure collapse into "nothing missing". A verifier that cannot run
# (script deleted/renamed, node missing, a bug in verify-doc-paths.mjs) must
# read as a denial, not a silent pass — anything else is worse than no
# guard at all, because it looks like protection while providing none.
STDERR_FILE=$(mktemp)
set +e
MISSING=$(echo "$CONTENT" | node "$VERIFY_SCRIPT" --stdin 2>"$STDERR_FILE")
STATUS=$?
set -e
VERIFIER_ERROR=$(cat "$STDERR_FILE")
rm -f "$STDERR_FILE"

if [ "$STATUS" -ne 0 ]; then
  jq -n --arg err "$VERIFIER_ERROR" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("BLOCKED: the docs path guard could not verify this write — verify-doc-paths.mjs exited with an error, so path safety is unknown:\n" + $err + "\n\nA verifier that fails to run is treated as a denial, never as \"nothing missing\". Fix apps/docs/scripts/verify-doc-paths.mjs (or your node install) and retry.")
    }
  }'
  exit 0
fi

if [ -n "$MISSING" ]; then
  jq -n --arg missing "$MISSING" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("BLOCKED: this page references repo paths that do not exist:\n" + $missing + "\n\nThe apps were refactored to a feature-sliced layout. Commands live in apps/bot/src/features/<module>/commands/, dashboard API in apps/dashboard/src/server/features/, dashboard UI in apps/dashboard/src/client/features/. Verify against the source tree, not CLAUDE.md. Note: a templated path (containing <placeholder>, [placeholder], or {placeholder}) is checked by its first two static path segments only, e.g. apps/nonexistent-app/<feature>/thing.ts is flagged because apps/nonexistent-app does not exist.\n\nIf a path is deliberately not real (e.g. instructing the reader to create a file), add an explicit exemption directly in the page:\n  <!-- docs-path-guard: allow path/one, path/two reason: \"why these are intentionally not real\" -->\nA marker with no reason exempts nothing.")
    }
  }'
  exit 0
fi

exit 0
