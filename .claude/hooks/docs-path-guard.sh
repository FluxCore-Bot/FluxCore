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

# Resolve the edited file as an absolute path. Two things are derived from
# it, and they answer different questions:
#   --doc-dir  where a ./ or ../ path in the content points (the file's own
#              directory, not the repo root and not the hook's cwd)
#   --doc-file which file is being written, because a bare path (no ./) is a
#              repo-root claim everywhere EXCEPT inside a package.json, where
#              npm/pnpm run script arguments from the package directory
case "$FILE_PATH" in
  /*) ABS_FILE_PATH="$FILE_PATH" ;;
  *) ABS_FILE_PATH="$REPO_ROOT/$FILE_PATH" ;;
esac
DOC_DIR=$(dirname "$ABS_FILE_PATH")

# Capture the verifier's exit status separately from its output, and do NOT
# let a failure collapse into "nothing missing". A verifier that cannot run
# (script deleted/renamed, node missing, a bug in verify-doc-paths.mjs) must
# read as a denial, not a silent pass — anything else is worse than no
# guard at all, because it looks like protection while providing none.
STDERR_FILE=$(mktemp)
set +e
MISSING=$(echo "$CONTENT" | node "$VERIFY_SCRIPT" --stdin --doc-dir "$DOC_DIR" --doc-file "$ABS_FILE_PATH" 2>"$STDERR_FILE")
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
      permissionDecisionReason: ("BLOCKED: this page references repo paths that do not exist:\n" + $missing + "\n\nHow each cited path was resolved:\n  - a path starting with ./ or ../ resolves against the directory of the file being written\n  - every other path is a REPO-ROOT claim and resolves against the repo root\n  - inside a package.json ONLY, a bare path resolves against the package directory first and the repo root second, because npm/pnpm run script arguments with the package directory as CWD\n  - a ../ chain that leaves the repo is always treated as missing\n  - a templated path (<placeholder>, [placeholder], {placeholder}) is checked by its first two static segments only, e.g. apps/nonexistent-app/<feature>/thing.ts is flagged because apps/nonexistent-app does not exist\n\nSo: if the flagged path is meant to sit next to this file, write it as ./that/path and it will be checked there. If it is meant to be a repo-root path, the claim is simply wrong — verify it against the source tree, not CLAUDE.md. The apps were refactored to a feature-sliced layout: commands live in apps/bot/src/features/<module>/commands/, dashboard API in apps/dashboard/src/server/features/, dashboard UI in apps/dashboard/src/client/features/.\n\nIf a path is deliberately not real (e.g. instructing the reader to create a file), add an explicit exemption directly in the page:\n  <!-- docs-path-guard: allow path/one, path/two reason: \"why these are intentionally not real\" -->\nA marker with no reason exempts nothing.")
    }
  }'
  exit 0
fi

exit 0
