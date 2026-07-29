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

MISSING=$(echo "$CONTENT" | node "$REPO_ROOT/apps/docs/scripts/verify-doc-paths.mjs" --stdin 2>/dev/null || echo "")

if [ -n "$MISSING" ]; then
  jq -n --arg missing "$MISSING" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("BLOCKED: this page references repo paths that do not exist:\n" + $missing + "\n\nThe apps were refactored to a feature-sliced layout. Commands live in apps/bot/src/features/<module>/commands/, dashboard API in apps/dashboard/src/server/features/, dashboard UI in apps/dashboard/src/client/features/. Verify against the source tree, not CLAUDE.md.")
    }
  }'
  exit 0
fi

exit 0
