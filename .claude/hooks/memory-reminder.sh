#!/bin/bash
# Stop hook: Reminds Claude to save significant learnings to memory
# Only triggers when the conversation involved meaningful work

set -euo pipefail

INPUT=$(cat)

LAST_MESSAGE=$(echo "$INPUT" | jq -r '.last_assistant_message // empty')

# Check if the message suggests significant work was done
# (contains indicators of architectural decisions, new patterns, or constraints learned)
if echo "$LAST_MESSAGE" | grep -qiE '(decided to|chose|switched to|realized|discovered|important|constraint|breaking change|migration|refactor|architecture|design decision|tradeoff|trade-off)' 2>/dev/null; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext: "📝 MEMORY CHECK: This conversation involved significant decisions or discoveries. Before ending, consider:\n- Should any architectural decisions be saved to memory?\n- Were there new constraints or patterns discovered?\n- Did the project phase or priorities change?\n- Were there user preferences learned?\nUse the memory system at ~/.claude/projects/-home-abdulkhalek-Projects-FluxCore/memory/ to persist important context for future sessions."
    }
  }'
  exit 0
fi

exit 0