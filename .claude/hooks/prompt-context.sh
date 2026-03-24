#!/bin/bash
# UserPromptSubmit hook: Adds lightweight context to every user prompt
# Keeps Claude aware of working state without being verbose

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Quick git state check
BRANCH=$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo "unknown")
DIRTY=$(git -C "$PROJECT_DIR" status --porcelain 2>/dev/null | wc -l | tr -d ' ')

CONTEXT="[Branch: $BRANCH | Uncommitted files: $DIRTY]"

jq -n --arg ctx "$CONTEXT" '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: $ctx
  }
}'