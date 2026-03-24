#!/bin/bash
# PreToolUse hook: Reminds about design system when editing dashboard components
# Non-blocking — adds context rather than blocking

set -euo pipefail

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only care about dashboard client files (components, pages)
if echo "$FILE_PATH" | grep -qE 'apps/dashboard/src/client/.+\.(tsx|css)$' 2>/dev/null; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: "🎨 DESIGN SYSTEM REMINDER: This is a dashboard UI file. Follow The Obsidian Engine design system:\n- Colors: Use Tailwind tokens (background, surface-*, primary, danger, success, warning)\n- Typography: Inter (body), Space Grotesk (labels), JetBrains Mono (code)\n- Borders: Sharp radius (rounded-sm = 2px, rounded = 4px, rounded-md = 8px)\n- Icons: Lucide at 1.5px stroke\n- Surfaces: Use tonal elevation (surface-low → surface-bright)\n- See /design.md for full token reference"
    }
  }'
  exit 0
fi

exit 0