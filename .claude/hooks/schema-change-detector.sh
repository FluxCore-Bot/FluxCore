#!/bin/bash
# PostToolUse hook: Detects Prisma schema changes and reminds about migrations
# Fires after Edit/Write on schema.prisma

set -euo pipefail

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only care about schema.prisma changes
if echo "$FILE_PATH" | grep -q "schema.prisma" 2>/dev/null; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: "⚠️ SCHEMA CHANGED: You modified schema.prisma. Remember to:\n1. Run `pnpm db:generate` to regenerate the Prisma client\n2. Run `pnpm db:migrate` to create a migration\n3. Update any affected TypeScript types in packages/types/\n4. Check if dashboard API routes need updates for new/changed models"
    }
  }'
  exit 0
fi

exit 0