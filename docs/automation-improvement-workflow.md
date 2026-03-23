# Automation System Improvement — Implementation Workflow

> Generated from deep brainstorm session. Covers UI, UX, and feature improvements across 4 phases.

---

## Dependency Graph

```
Phase 1: Quick Wins (all independent, can parallelize)
├── 1.1 Duplicate Rule
├── 1.2 "Last Fired" Indicator
├── 1.3 Workflow Validation Indicators
├── 1.4 Bulk Operations
└── 1.5 Per-Rule Analytics Drill-down
         │
Phase 2: UX Polish
├── 2.1 Inline Variable Autocomplete (independent)
├── 2.2 Rule Templates Gallery (independent, richer with condition builder)
└── 2.3 Cooldowns & Rate Limiting (independent)
         │
Phase 3: Core Logic
├── 3.1 Rich Condition Builder ──────────────┐
└── 3.2 Test / Dry-Run Mode (better after 3.1)│
         │                                    │
Phase 4: Game Changers                        │
├── 4.1 Conditional Branching (requires 3.1) ◄┘
└── 4.2 Delay / Timer Actions (independent, needs job scheduler)
```

---

## Phase 1: Quick Wins

### 1.1 Duplicate Rule

**Goal:** One-click clone of any existing rule.

**Files to modify:**
| File | Change |
|------|--------|
| `apps/dashboard/src/client/components/RuleList.tsx` | Add duplicate icon button in operations column |
| `apps/dashboard/src/client/lib/hooks/useRules.ts` | No new mutation needed — reuse `useCreateRule` with cloned data |
| `apps/dashboard/src/client/routes/guild/$guildId/rules.tsx` | Wire duplicate handler: clone rule data, set name to `"{name} (copy)"`, call create |

**Implementation:**
1. In `RuleList.tsx`, add a copy/duplicate icon button next to edit/delete
2. On click, clone the rule object, strip `id`/`createdAt`/`updatedAt`, append " (copy)" to name
3. Call the existing create mutation
4. Toast: "Rule duplicated"

**Acceptance criteria:**
- [ ] Duplicate button visible on each rule row
- [ ] Cloned rule appears in list with "(copy)" suffix
- [ ] All actions, conditions, priority, and enabled state are preserved
- [ ] Name conflict handled (if "X (copy)" already exists)

---

### 1.2 "Last Fired" Indicator

**Goal:** Show when each rule last executed, directly in the rule list.

**Files to modify:**
| File | Change |
|------|--------|
| `packages/systems/src/actions/persistence.ts` | Add `getLastFiredByGuild(guildId)` — query `ActionLog` for max `executedAt` grouped by `ruleId` |
| `apps/dashboard/src/server/routes/actions.ts` | Include `lastFired` timestamp in `GET /rules` response (join with log data) |
| `apps/dashboard/src/client/lib/schemas.ts` | Add optional `lastFired: z.string().nullable()` to `ActionRuleSchema` |
| `apps/dashboard/src/client/components/RuleList.tsx` | Add "Last Fired" column with relative time display ("2h ago", "Never") |

**Implementation:**
1. Add persistence query: `SELECT ruleId, MAX(executedAt) as lastFired FROM ActionLog WHERE guildId = ? GROUP BY ruleId`
2. In the GET /rules endpoint, merge lastFired data into each rule object
3. Display in RuleList with relative time formatting (use `date-fns` `formatDistanceToNow`)
4. Show "Never" if no log exists for that rule

**Acceptance criteria:**
- [ ] Each rule row shows when it last fired
- [ ] "Never" shown for rules that haven't executed
- [ ] Relative time updates reflect actual log data

---

### 1.3 Workflow Validation Indicators

**Goal:** Real-time visual feedback on whether nodes are properly configured.

**Files to modify:**
| File | Change |
|------|--------|
| `apps/dashboard/src/client/components/workflow/WorkflowEditor.tsx` | Add validation state computation, status bar showing "Ready" / "N issues found" |
| `apps/dashboard/src/client/components/workflow/nodes/TriggerNode.tsx` | Red/orange border when event type is empty |
| `apps/dashboard/src/client/components/workflow/nodes/ActionNode.tsx` | Red border + warning icon when required fields missing |
| `apps/dashboard/src/client/components/workflow/useWorkflowNodes.ts` | Pass validation state as node data |

**Validation rules:**
- Trigger: must have event type selected
- Action: must have action type selected
- Action: required fields for that action type must be filled (check `actionTypeFields` from constants)
- At least one action in the workflow

**Implementation:**
1. Create `validateWorkflow(eventType, actions, constants)` utility function
2. Returns `{ valid: boolean, issues: { nodeId: string, message: string }[] }`
3. Pass validation results to nodes via data prop
4. Nodes render conditional border colors: green (valid), orange (warning), red (error)
5. Toolbar shows validation summary: checkmark + "Ready to save" or warning + "2 issues"

**Acceptance criteria:**
- [ ] Unconfigured trigger node shows orange indicator
- [ ] Unconfigured action nodes show red border + warning icon
- [ ] Status bar in toolbar reflects validation state
- [ ] Save button disabled when critical issues exist

---

### 1.4 Bulk Operations

**Goal:** Multi-select rules for batch enable/disable/delete.

**Files to modify:**
| File | Change |
|------|--------|
| `apps/dashboard/src/client/components/RuleList.tsx` | Add checkboxes column, selection state, floating bulk action bar |
| `apps/dashboard/src/server/routes/actions.ts` | Add `PATCH /api/guilds/:guildId/actions/rules/bulk` endpoint |
| `apps/dashboard/src/client/lib/hooks/useRules.ts` | Add `useBulkUpdateRules` and `useBulkDeleteRules` mutations |
| `apps/dashboard/src/client/lib/schemas.ts` | Add `BulkActionSchema` for request validation |

**Implementation:**
1. Add checkbox column to RuleList (header = select all, row = individual)
2. When selection > 0, show floating action bar: "N selected" + Enable All / Disable All / Delete All buttons
3. Backend: `PATCH /rules/bulk` accepts `{ ruleIds: number[], action: "enable" | "disable" | "delete" }`
4. Delete requires confirmation dialog
5. Clear selection after bulk action completes

**Acceptance criteria:**
- [ ] Checkbox column with select-all header
- [ ] Floating bar appears when rules selected
- [ ] Bulk enable/disable/delete work correctly
- [ ] Cache invalidation triggers for all affected rules
- [ ] Confirmation dialog for bulk delete

---

### 1.5 Per-Rule Analytics Drill-down

**Goal:** Click a rule to see its individual execution history and stats.

**Files to modify:**
| File | Change |
|------|--------|
| `apps/dashboard/src/server/routes/actions.ts` | Add `GET /api/guilds/:guildId/actions/rules/:ruleId/analytics` endpoint |
| `packages/systems/src/actions/persistence.ts` | Add `getRuleAnalytics(ruleId, days)` query |
| `apps/dashboard/src/client/components/RuleList.tsx` | Add expandable row or modal for per-rule stats |
| `apps/dashboard/src/client/lib/hooks/useRules.ts` | Add `useRuleAnalytics(guildId, ruleId)` hook |

**Data to show:**
- Total executions (7d / 30d)
- Success rate percentage
- Last 10 execution logs (timestamp, action, success/error)
- Mini chart: executions over time

**Implementation:**
1. Query `ActionLog WHERE ruleId = ?` with aggregation
2. Add expandable row in RuleList — click chevron to expand
3. Show stats cards + recent log table inside expanded section
4. Lazy-load analytics data only when row is expanded

**Acceptance criteria:**
- [ ] Expandable row reveals per-rule stats
- [ ] Shows success rate, total executions, recent logs
- [ ] Data loads lazily on expand
- [ ] Error states handled (no data yet)

---

## Phase 2: UX Polish

### 2.1 Inline Variable Autocomplete

**Goal:** Typing `{` in text fields triggers autocomplete with available template variables.

**Files to create:**
| File | Purpose |
|------|---------|
| `apps/dashboard/src/client/components/VariableAutocomplete.tsx` | Autocomplete dropdown component |

**Files to modify:**
| File | Change |
|------|--------|
| `apps/dashboard/src/client/components/ActionFields.tsx` | Wrap textarea fields with autocomplete behavior |
| `apps/dashboard/src/client/components/workflow/NodeDetailPanel.tsx` | Integrate autocomplete in action field textareas |

**Implementation:**
1. Create `VariableAutocomplete` component:
   - Monitors textarea input for `{` character
   - Shows positioned dropdown below cursor with filtered variable list
   - Typing after `{` filters variables (e.g., `{us` → `user`, `user.name`, `user.tag`)
   - Click or Enter inserts variable and closes dropdown
   - Escape closes dropdown
   - Each item shows variable name + description
2. Add a **preview pane** below textareas showing rendered output with sample data
3. Sample data map: `{ "user": "@JohnDoe", "user.name": "JohnDoe", "channel": "#general", ... }`

**Acceptance criteria:**
- [ ] `{` triggers autocomplete in textarea fields
- [ ] Filtering works as user types
- [ ] Click/Enter inserts the variable
- [ ] Preview pane shows rendered template with sample values
- [ ] Works in both Form mode and Workflow editor

---

### 2.2 Rule Templates Gallery

**Goal:** Pre-built rule templates for common automation use cases.

**Files to create:**
| File | Purpose |
|------|---------|
| `packages/systems/src/actions/templates.ts` | Template definitions (JSON objects) |
| `apps/dashboard/src/client/components/TemplateGallery.tsx` | Gallery modal with search, categories, preview |

**Files to modify:**
| File | Change |
|------|--------|
| `apps/dashboard/src/client/routes/guild/$guildId/rules.tsx` | Add "From Template" button next to "Create Rule" |
| `apps/dashboard/src/server/routes/actions.ts` | Add `GET /api/actions/templates` endpoint |

**Templates to include:**
| Template | Event | Actions |
|----------|-------|---------|
| Welcome Message | memberJoin | sendMessage to configurable channel |
| Auto-Role on Join | memberJoin | addRole (configurable) |
| Goodbye Message | memberLeave | sendMessage |
| Join DM | memberJoin | sendDM with server info |
| Boost Reward | boostStart | addRole + sendMessage |
| Mod Log: Bans | memberBanned | logToChannel |
| Mod Log: Timeouts | memberTimeout | logToChannel |
| Thread Auto-Create | messageCreated | createThread |
| Webhook Notifier | memberJoin | sendWebhook |

**Implementation:**
1. Define templates as typed objects with: `id`, `name`, `description`, `category`, `icon`, `eventType`, `actions[]`, `conditions`
2. Gallery UI: modal with category tabs (All, Moderation, Welcome, Logging, Engagement)
3. Each card: icon, name, description, event badge, action count
4. Click card → preview showing workflow diagram + full description
5. "Use Template" → opens workflow editor pre-filled with template data
6. User customizes (select channels, roles, edit messages) then saves

**Acceptance criteria:**
- [ ] Gallery modal opens from "From Template" button
- [ ] Categories filter correctly
- [ ] Clicking template opens editor pre-filled
- [ ] User can customize all fields before saving
- [ ] At least 8 templates available at launch

---

### 2.3 Cooldowns & Rate Limiting

**Goal:** Prevent automation spam with per-rule and per-user cooldowns.

**Files to modify:**
| File | Change |
|------|--------|
| `packages/database/prisma/schema.prisma` | Add `cooldown Int?`, `userCooldown Int?`, `maxExecutions Int?`, `maxExecutionsPeriod Int?` to ActionRule |
| `packages/systems/src/actions/types.ts` | Add cooldown fields to `ActionRule` type |
| `packages/systems/src/actions/persistence.ts` | Include cooldown fields in CRUD operations |
| `apps/dashboard/src/client/lib/schemas.ts` | Add cooldown fields to `RuleFormSchema` |
| `apps/dashboard/src/client/components/RuleForm.tsx` | Add cooldown settings section |
| `apps/dashboard/src/client/components/workflow/NodeDetailPanel.tsx` | Add cooldown fields to trigger settings tab |
| `apps/dashboard/src/client/components/workflow/WorkflowEditor.tsx` | Include cooldowns in save payload |
| `apps/dashboard/src/server/routes/actions.ts` | Validate cooldown fields on create/update |

**Backend execution changes (bot-side):**
| File | Change |
|------|--------|
| Bot execution engine | Check cooldown before executing: track last execution time per rule and per rule+user in memory/Redis |

**Cooldown fields:**
- `cooldown`: Rule-level cooldown in seconds (0 = disabled)
- `userCooldown`: Per-user cooldown in seconds (0 = disabled)
- `maxExecutions`: Max executions per period (0 = unlimited)
- `maxExecutionsPeriod`: Period in seconds for maxExecutions

**UI layout:**
```
Cooldown Settings
├── Rule Cooldown:     [___] seconds  (don't fire again for X seconds)
├── Per-User Cooldown: [___] seconds  (per user, don't fire for X seconds)
└── Rate Limit:        [___] times per [___] seconds
```

**Acceptance criteria:**
- [ ] Cooldown fields visible in both form and workflow editor
- [ ] Values saved and persisted correctly
- [ ] Bot respects cooldowns during execution
- [ ] Zero/empty = disabled (no cooldown)

---

## Phase 3: Core Logic

### 3.1 Rich Condition Builder

**Goal:** Replace simple ID arrays with a visual, composable condition system.

**Files to create:**
| File | Purpose |
|------|---------|
| `apps/dashboard/src/client/components/conditions/ConditionBuilder.tsx` | Main condition builder container |
| `apps/dashboard/src/client/components/conditions/ConditionGroup.tsx` | AND/OR group with nested conditions |
| `apps/dashboard/src/client/components/conditions/ConditionRow.tsx` | Single condition: field + operator + value |
| `packages/systems/src/actions/conditionEngine.ts` | Server-side condition evaluation engine |
| `packages/systems/src/actions/conditionTypes.ts` | Condition type definitions and operators |

**Files to modify:**
| File | Change |
|------|--------|
| `packages/systems/src/actions/types.ts` | New `RichCondition` type replacing flat ID arrays |
| `packages/systems/src/actions/constants.ts` | Add condition field definitions, operators per field |
| `apps/dashboard/src/client/lib/schemas.ts` | New `RichConditionSchema` with Zod validation |
| `apps/dashboard/src/client/components/workflow/NodeDetailPanel.tsx` | Replace filter inputs with ConditionBuilder |
| `apps/dashboard/src/client/components/RuleForm.tsx` | Replace filter inputs with ConditionBuilder |
| `apps/dashboard/src/server/routes/actions.ts` | Validate rich conditions on create/update |
| `packages/database/prisma/schema.prisma` | `conditions` column already stores JSON — format changes |

**Condition data model:**
```typescript
type ConditionGroup = {
  logic: "AND" | "OR";
  conditions: (SingleCondition | ConditionGroup)[];
};

type SingleCondition = {
  field: string;      // "channel.id", "user.hasRole", "message.content", "user.accountAge", "time.hour"
  operator: string;   // "equals", "contains", "startsWith", "matchesRegex", "greaterThan", "in", "notIn"
  value: any;         // string, number, string[], depends on field+operator
};
```

**Supported condition fields:**
| Category | Field | Operators |
|----------|-------|-----------|
| Channel | channel.id | is, isNot, in, notIn |
| Channel | channel.category | is, isNot |
| Channel | channel.type | is (text, voice, forum) |
| Role | user.hasRole | hasAny, hasAll, hasNone |
| Role | user.roleCount | greaterThan, lessThan, equals |
| User | user.id | is, isNot, in, notIn |
| User | user.isBot | is (true/false) |
| User | user.accountAge | greaterThan, lessThan (days) |
| User | user.joinedAge | greaterThan, lessThan (days) |
| Message | message.content | contains, startsWith, endsWith, matchesRegex, equals |
| Message | message.length | greaterThan, lessThan |
| Message | message.hasAttachment | is (true/false) |
| Time | time.hour | between (range) |
| Time | time.dayOfWeek | in (mon, tue, ...) |

**Migration strategy:**
- Keep backward compatibility with existing `conditions` JSON format
- Add migration utility: convert `{ channelIds, roleIds, userIds, exclude* }` → rich condition groups
- Condition engine falls back to legacy evaluation if old format detected

**Acceptance criteria:**
- [ ] Visual condition builder with AND/OR groups
- [ ] All condition fields and operators functional
- [ ] Nested groups supported (at least 2 levels deep)
- [ ] Backend evaluation engine correctly processes conditions
- [ ] Backward compatible with existing rules
- [ ] Works in both Form and Workflow modes

---

### 3.2 Test / Dry-Run Mode

**Goal:** Simulate rule execution without making real Discord API calls.

**Files to create:**
| File | Purpose |
|------|---------|
| `apps/dashboard/src/client/components/workflow/TestSimulator.tsx` | Test panel UI with sample data inputs and result display |
| `packages/systems/src/actions/simulator.ts` | Dry-run execution engine |

**Files to modify:**
| File | Change |
|------|--------|
| `apps/dashboard/src/client/components/workflow/WorkflowEditor.tsx` | Add "Test" button to toolbar, integrate TestSimulator panel |
| `apps/dashboard/src/server/routes/actions.ts` | Add `POST /api/guilds/:guildId/actions/rules/test` endpoint |

**Sample data per event type:**
```typescript
const sampleData: Record<string, EventContext> = {
  memberJoin: {
    user: { name: "TestUser", tag: "TestUser#1234", id: "123456789" },
    guild: { name: "My Server", memberCount: 150 },
    timestamp: new Date().toISOString(),
  },
  messageCreated: {
    user: { ... },
    channel: { name: "general", id: "987654321" },
    message: { content: "Hello world!" },
    ...
  },
  // ... for each event type
};
```

**Implementation:**
1. Test panel: form with pre-filled sample data (editable by user)
2. "Run Simulation" button → sends rule config + sample data to backend
3. Backend `simulator.ts`:
   - Evaluates conditions against sample data → pass/fail
   - For each action: resolves templates, validates config, returns preview
   - Does NOT call Discord API
   - Returns: `{ conditionResult: boolean, steps: { action, resolved, preview }[] }`
4. Frontend animates results:
   - Trigger node → green highlight
   - Condition evaluation → green (pass) or red (fail) with explanation
   - Each action → shows resolved template output
5. Summary: "3 actions would execute" or "Blocked by condition: user.hasRole"

**Acceptance criteria:**
- [ ] Test button in workflow editor toolbar
- [ ] Sample data auto-populated per event type
- [ ] User can edit sample values
- [ ] Step-by-step result display with template previews
- [ ] Conditions evaluated and result shown
- [ ] No real Discord API calls made
- [ ] Works for saved and unsaved rules

---

## Phase 4: Game Changers

### 4.1 Conditional Branching in Workflow Editor

**Goal:** Transform linear action chains into decision trees with if/else paths.

**Files to create:**
| File | Purpose |
|------|---------|
| `apps/dashboard/src/client/components/workflow/nodes/ConditionNode.tsx` | Diamond-shaped condition node |

**Files to modify:**
| File | Change |
|------|--------|
| `packages/systems/src/actions/types.ts` | New `WorkflowFlow` type with branching support |
| `packages/systems/src/actions/constants.ts` | Add "condition" as a node type |
| `apps/dashboard/src/client/lib/schemas.ts` | New schema for branching workflow structure |
| `apps/dashboard/src/client/components/workflow/WorkflowEditor.tsx` | Support branching node management, multi-path state |
| `apps/dashboard/src/client/components/workflow/useWorkflowNodes.ts` | Tree layout algorithm instead of linear chain |
| `apps/dashboard/src/client/components/workflow/NodeDetailPanel.tsx` | Condition node configuration using ConditionBuilder |
| `packages/systems/src/actions/persistence.ts` | Store/retrieve branching flow structure |
| Bot execution engine | Tree traversal execution instead of linear array |

**Data model change:**
```typescript
// Current: actions is a flat array
actions: ActionConfig[]

// New: workflow is a tree
type WorkflowNode = {
  id: string;
  type: "action" | "condition";
  // For action nodes:
  action?: ActionConfig;
  next?: string;           // next node ID
  // For condition nodes:
  condition?: RichCondition;
  trueBranch?: string;     // node ID for "yes"
  falseBranch?: string;    // node ID for "no"
};

type WorkflowFlow = {
  entryNode: string;
  nodes: Record<string, WorkflowNode>;
};
```

**Visual layout:**
```
[Trigger] ──► [Condition: has role?]
                  ├─ Yes ──► [Send Welcome] ──► [Add Role]
                  └─ No  ──► [Send DM] ──► [Log to Channel]
```

**Layout algorithm:**
- Use Dagre or ELK for automatic tree layout
- Yes path goes right, No path goes down-right
- Auto-fit viewport after layout changes

**Migration strategy:**
- Existing rules with flat `actions[]` continue to work (interpreted as linear chain)
- New branching rules use `workflow` field (new column or repurpose `actions` with version flag)
- UI detects format and renders accordingly

**Acceptance criteria:**
- [ ] Condition node (diamond shape) addable to workflow
- [ ] Two output paths: Yes (green) and No (red)
- [ ] Each path supports its own action chain
- [ ] ConditionBuilder integrated in condition node config panel
- [ ] Auto-layout algorithm handles tree structure
- [ ] Backend executes branching logic correctly
- [ ] Backward compatible with existing linear rules
- [ ] Max depth limit to prevent infinite nesting

---

### 4.2 Delay / Timer Actions

**Goal:** Add time-based pauses between actions in a workflow.

**Infrastructure required:**
- Job scheduler: **BullMQ + Redis** (recommended) or **pg-boss** (Postgres-only)
- Delayed job persistence across bot restarts

**Files to create:**
| File | Purpose |
|------|---------|
| `packages/systems/src/actions/scheduler.ts` | Job scheduler wrapper (queue management, delayed job creation) |
| `packages/systems/src/actions/delayWorker.ts` | Worker that processes delayed action continuations |

**Files to modify:**
| File | Change |
|------|--------|
| `packages/systems/src/actions/constants.ts` | Add `delay` action type with fields: `duration` (number), `unit` (seconds/minutes/hours) |
| `packages/systems/src/actions/types.ts` | Add delay action config type |
| `apps/dashboard/src/client/lib/schemas.ts` | Add delay action validation |
| `apps/dashboard/src/client/components/ActionFields.tsx` | Render duration + unit picker for delay action |
| `apps/dashboard/src/client/components/workflow/nodes/ActionNode.tsx` | Special rendering for delay nodes (clock icon, duration display) |

**Execution flow:**
```
memberJoin → addRole @New → [DELAY 10 min] → sendDM "Welcome!"
                                    │
                                    ▼
                        Job scheduler creates delayed job
                        with remaining actions + context
                                    │
                              (10 min later)
                                    │
                                    ▼
                        Worker picks up job, executes
                        sendDM with original context
```

**Constraints:**
- Max delay: 24 hours (prevent forgotten jobs)
- Max 2 delay actions per rule (prevent abuse)
- If user leaves server during delay, cancel remaining actions
- Job data: ruleId, guildId, remaining actions, event context snapshot

**Acceptance criteria:**
- [ ] Delay action type available in action selector
- [ ] Duration + unit input fields in both form and workflow
- [ ] Visual clock icon node in workflow editor
- [ ] Jobs survive bot restarts (persistent queue)
- [ ] Cancelled if user leaves during delay
- [ ] Max duration and count limits enforced
- [ ] Execution logs show delay status

---

## Risk Matrix

| Phase | Risk Level | Key Risks | Mitigation |
|-------|-----------|-----------|------------|
| Phase 1 | Low | Minor UI regressions | Test each change independently |
| Phase 2 | Low-Medium | Autocomplete UX edge cases, template curation | User testing, iterate on templates |
| Phase 3 | Medium | Condition builder complexity, backward compat | Incremental migration, feature flag |
| Phase 4 | High | Execution engine refactor, job scheduler infra | Prototype first, extensive testing |

## Suggested Implementation Order Within Phases

**Phase 1** (can parallelize all):
```
Day 1-2: 1.1 Duplicate Rule + 1.2 Last Fired (simplest)
Day 2-3: 1.3 Validation Indicators
Day 3-4: 1.4 Bulk Operations
Day 4-5: 1.5 Per-Rule Analytics
```

**Phase 2** (mostly parallel):
```
Week 1: 2.3 Cooldowns (backend + UI, foundational)
Week 1-2: 2.1 Variable Autocomplete (complex UX, iterative)
Week 2-3: 2.2 Templates Gallery (needs content curation)
```

**Phase 3** (sequential):
```
Week 1-2: 3.1 Rich Condition Builder (prerequisite for Phase 4)
Week 3: 3.2 Test/Dry-Run Mode (uses condition engine)
```

**Phase 4** (sequential):
```
Week 1: 4.2 Delay Actions (infrastructure setup + basic implementation)
Week 2-3: 4.1 Conditional Branching (most complex, uses condition builder)
Week 4: Integration testing + migration verification
```
