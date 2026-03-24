#!/bin/bash
# PreToolUse hook: Prevents accidentally reading or exposing .env files
# Blocks Read/Write/Edit operations on .env files (except .env.example)

set -euo pipefail

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Check if targeting a .env file (but allow .env.example)
if echo "$FILE_PATH" | grep -qE '\.env(\.[a-z]+)?$' 2>/dev/null; then
  if echo "$FILE_PATH" | grep -q '\.env\.example$' 2>/dev/null; then
    exit 0  # .env.example is safe
  fi

  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "BLOCKED: Cannot read/write .env files directly — they contain secrets (tokens, passwords, API keys). Use .env.example as reference for variable names. If you need to know what env vars are available, read .env.example or packages/config/src/ instead."
    }
  }'
  exit 0
fi

exit 0