#!/bin/bash
# Stop hook: Reminds Claude to write tests for new source files
# Checks if any new/modified .ts source files lack corresponding .test.ts files

set -euo pipefail

INPUT=$(cat)

LAST_MESSAGE=$(echo "$INPUT" | jq -r '.last_assistant_message // empty')

# Check if the conversation involved code changes (look for indicators of implementation)
if ! echo "$LAST_MESSAGE" | grep -qiE '(created|wrote|added|implemented|built|updated|modified|new file|new command|new route|feature)' 2>/dev/null; then
  exit 0
fi

# Find source files modified in the working tree (staged + unstaged)
CHANGED_SRC_FILES=$(git diff --name-only HEAD 2>/dev/null || git diff --name-only --cached 2>/dev/null || echo "")

# Also check untracked files
UNTRACKED_FILES=$(git ls-files --others --exclude-standard 2>/dev/null || echo "")

ALL_FILES=$(echo -e "${CHANGED_SRC_FILES}\n${UNTRACKED_FILES}" | sort -u | grep -E '\.ts$' || true)

if [ -z "$ALL_FILES" ]; then
  exit 0
fi

MISSING_TESTS=""

while IFS= read -r file; do
  [ -z "$file" ] && continue

  # Skip test files, type declarations, configs, and non-source files
  if echo "$file" | grep -qE '(\.test\.ts|\.spec\.ts|\.d\.ts|vitest\.|tsconfig|index\.ts$)'; then
    continue
  fi

  # Only check source files in apps/ and packages/systems/
  if ! echo "$file" | grep -qE '^(apps/(bot|dashboard)/src/|packages/systems/src/)'; then
    continue
  fi

  # Skip UI components (client-side) for now — focus on testable logic
  if echo "$file" | grep -qE '/client/'; then
    continue
  fi

  # Derive expected test file path
  TEST_FILE=""
  if echo "$file" | grep -qE '^apps/bot/src/'; then
    TEST_FILE=$(echo "$file" | sed 's|^apps/bot/src/|apps/bot/tests/|' | sed 's|\.ts$|.test.ts|')
  elif echo "$file" | grep -qE '^apps/dashboard/src/server/'; then
    TEST_FILE=$(echo "$file" | sed 's|^apps/dashboard/src/server/|apps/dashboard/tests/server/|' | sed 's|\.ts$|.test.ts|')
  elif echo "$file" | grep -qE '^packages/systems/src/'; then
    # Systems integration tests don't mirror 1:1, so just check if any integration test exists
    continue
  fi

  if [ -n "$TEST_FILE" ] && [ ! -f "$TEST_FILE" ]; then
    MISSING_TESTS="${MISSING_TESTS}\n  - ${file} → missing ${TEST_FILE}"
  fi
done <<< "$ALL_FILES"

if [ -n "$MISSING_TESTS" ]; then
  # Escape for JSON
  ESCAPED=$(echo -e "$MISSING_TESTS" | jq -Rs .)
  jq -n --argjson missing "$ESCAPED" '{
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext: ("🧪 TEST REMINDER: New source files were created/modified without corresponding test files:\n" + $missing + "\n\nPer project rules, every feature MUST include tests. Please add the missing test files before finishing.\n\nTest patterns: See the Testing section in CLAUDE.md for conventions, factories, and examples.")
    }
  }'
  exit 0
fi

exit 0