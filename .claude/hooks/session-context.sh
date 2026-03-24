#!/bin/bash
# SessionStart hook: Injects project context into every new conversation
# Gives Claude awareness of recent changes, open work, and project state

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
MEMORY_DIR="$HOME/.claude/projects/-home-abdulkhalek-Projects-FluxCore/memory"

# Collect recent git activity (last 10 commits)
RECENT_COMMITS=""
if git -C "$PROJECT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  RECENT_COMMITS=$(git -C "$PROJECT_DIR" log --oneline --no-decorate -10 2>/dev/null || echo "")
fi

# Get current branch
CURRENT_BRANCH=""
if git -C "$PROJECT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  CURRENT_BRANCH=$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo "unknown")
fi

# Check for uncommitted changes
DIRTY_FILES=""
if git -C "$PROJECT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  DIRTY_FILES=$(git -C "$PROJECT_DIR" status --short 2>/dev/null | head -20 || echo "")
fi

# Read the todods file if it exists
TODOS=""
if [ -f "$PROJECT_DIR/todods" ]; then
  TODOS=$(cat "$PROJECT_DIR/todods" 2>/dev/null || echo "")
fi

# Check for open TODO/FIXME in source code (fast count only)
TODO_COUNT=$(grep -rl "TODO\|FIXME\|XXX\|HACK" "$PROJECT_DIR/apps" "$PROJECT_DIR/packages" \
  --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ' || echo "0")

# Read project vision for current phase
CURRENT_PHASE=""
if [ -f "$MEMORY_DIR/project_vision_roadmap.md" ]; then
  CURRENT_PHASE=$(sed -n '/## Current Phase/,/## /p' "$MEMORY_DIR/project_vision_roadmap.md" 2>/dev/null | head -10 || echo "")
fi

# Build context output
CONTEXT="## Session Context (auto-loaded)

**Branch:** $CURRENT_BRANCH
**Files with TODOs/FIXMEs:** $TODO_COUNT"

if [ -n "$DIRTY_FILES" ]; then
  CONTEXT="$CONTEXT

**Uncommitted changes:**
\`\`\`
$DIRTY_FILES
\`\`\`"
fi

if [ -n "$TODOS" ]; then
  CONTEXT="$CONTEXT

**Open tasks (todods):**
$TODOS"
fi

if [ -n "$RECENT_COMMITS" ]; then
  CONTEXT="$CONTEXT

**Recent commits:**
\`\`\`
$RECENT_COMMITS
\`\`\`"
fi

if [ -n "$CURRENT_PHASE" ]; then
  CONTEXT="$CONTEXT

**Project phase:**
$CURRENT_PHASE"
fi

# Output as JSON for Claude to consume
jq -n --arg ctx "$CONTEXT" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $ctx
  }
}'