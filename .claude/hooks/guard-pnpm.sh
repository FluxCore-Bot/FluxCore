#!/bin/bash
# PreToolUse hook: Blocks pnpm add/install outside Docker
# These commands MUST run inside the Docker container due to node_modules ownership

set -eo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Check if command contains pnpm add or pnpm install (but not inside docker exec)
if echo "$COMMAND" | grep -qE '^\s*(pnpm\s+(add|install|i\b|remove|rm|uninstall))' 2>/dev/null; then
  # Allow if it's wrapped in docker exec/compose
  if echo "$COMMAND" | grep -qE '(docker\s+(exec|compose)|docker-compose)' 2>/dev/null; then
    exit 0
  fi

  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "BLOCKED: pnpm add/install/remove must run inside Docker container. Use: docker compose exec <service> pnpm add <package>. Host node_modules are owned by root and direct pnpm commands will cause permission errors."
    }
  }'
  exit 0
fi

exit 0