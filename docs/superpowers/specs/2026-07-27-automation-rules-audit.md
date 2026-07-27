# Automation / Rules — UX & correctness audit

**Date:** 2026-07-27
**Branch:** `worktree-fix-automation-rules-ux`
**Scope:** the whole automation surface — dashboard canvas editor, rules list, actions API, `packages/systems/src/actions`, and the bot-side executor/eventBridge/registry.
**Method:** five parallel auditors over independent dimensions, each finding then put through an adversarial refutation pass. 62 raised, 47 confirmed, 5 refuted, 10 unverified (the verifier hit a session limit).

## Summary

The automation feature is architecturally sound and further along than it looks: the bot really does execute the v2 step graph ([`executor.ts:274`](../../apps/bot/src/features/automation/system/executor.ts#L274)), with iteration caps, delay caps, per-(guild, event) rate limiting, and template-injection defences that are pinned by tests. The canvas, context menu, keyboard nav and variable-field editor are all real, working work.

The problem is that **almost nothing that goes wrong is visible to the user.** The same failure shape recurs at every layer: a misconfiguration is accepted without complaint, does nothing at runtime, and is then recorded as a *success*. A rule with no channel saves green, never fires, and reports 100% success. A trigger filter whose data the event does not carry is skipped entirely, so an "exclude @Staff" rule announces staff bans anyway. `addRole` on a reaction trigger silently no-ops. `hasRole` conditions always take the else-branch. In every one of these the dashboard actively tells the user everything is fine.

**The single most important fix is to stop lying about success** — make missing configuration an error at save time, a thrown failure at runtime, and a visible state in the rule list. Everything else in this document is secondary to that.

The three reported problems are all real and all have narrow, well-understood root causes. Two of them (A and C) are instances of the "silent acceptance" pattern above; the third (B) is a partial wiring gap rather than the total absence the report suggested.

## The three reported problems

### (A) Action nodes don't force required fields before save

**Root cause.** [`workflow-validation.ts:213-217`](../../apps/dashboard/src/client/features/automation/lib/workflow-validation.ts#L213-L217) reports a missing required field at `level: "warning"`, and [`workflow-validation.ts:61`](../../apps/dashboard/src/client/features/automation/lib/workflow-validation.ts#L61) computes `valid` from **errors only**. Save is disabled on `!validation.valid`, so warnings never block it. The server does not compensate: [`routes.ts:85`](../../apps/dashboard/src/server/features/actions/routes.ts#L85) checks only that `action.type` is known plus the webhook URL scheme — every other required field is unchecked, so the Undo-restore and Duplicate paths in `rules.tsx` can re-POST a dead rule too.

**What the user sees.** Pick "Send Message", skip the channel, click Save. The button is enabled, the toolbar shows an amber "1 issue" chip rather than a red one, a green "Rule created" toast fires, and the rule sits in the list looking healthy. It then never does anything, forever. Every action type has such a configuration: `sendMessage` (channelId, message), `sendEmbed` (channelId), `sendDM` (message), `addRole`/`removeRole` (roleId), `logToChannel` (channelId), `setNickname` (nickname), `createThread` (channelId, threadName), `addReaction` (emoji). Five of the six preset templates ship in exactly this state — the onboarding path is the fastest way to build a broken rule.

**Fix.** Promote the required-field branch to `level: "error"` (keeping genuinely advisory items — `conditionValueEmpty`, `delayNotConnected`, `stepUnreachable` — as warnings so the split stays meaningful); enforce the same `ACTION_TYPE_FIELDS` contract server-side in `validateRuleBody`; and surface it per-field in `ActionFields.tsx` with `aria-invalid` + an inline message instead of only a decorative asterisk. Then make the runtime honest: a missing required field must `throw` so it is logged `success: false`, not `return` silently.

### (B) Per-trigger variables don't reach the action's completion

**Root cause.** The autocomplete path *is* wired — `buildAutomationVariables(constants, eventType)` at [`NodeDetailPanel.tsx:317`](../../apps/dashboard/src/client/features/automation/workflow/NodeDetailPanel.tsx#L317) feeds the trigger-scoped list into `VariableEditor`. Three real gaps sit around it:

1. The action panel's **Variables tab** ignores the trigger entirely: [`NodeDetailPanel.tsx:432-437`](../../apps/dashboard/src/client/features/automation/workflow/NodeDetailPanel.tsx#L432-L437) renders `Object.keys(constants.templateVariables)` — all 27 tokens — while the trigger panel's tab renders the scoped set. So the reference list contradicts the autocomplete, and contradicts the editor's own unknown-token validator.
2. The **step-mode action editor has no Variables tab and no message preview at all** ([`NodeDetailPanel.tsx:544-605`](../../apps/dashboard/src/client/features/automation/workflow/NodeDetailPanel.tsx#L544-L605)). Adding one condition or delay converts the rule to step mode and strips both from every action in it.
3. **Some fields never get the editor.** `ActionFields.tsx:19-27` gates the `VariableEditor` on a hardcoded `VARIABLE_FIELD_KEYS` set, so template-bearing fields outside it fall back to a plain input with no autocomplete and no highlighting.

Underneath, `EVENT_TYPE_VARIABLES` also **over-promises**: it advertises `{channel*}` on member/ban/role events and `{user*}` on channel events that `eventBridge` never populates, so the preview renders `#general`/`@Ada` where the bot will post `Unknown Channel`/`Unknown User`.

**What the user sees.** Autocomplete works, but the Variables reference beside it lists tokens the trigger cannot provide; add a condition and both the reference and the preview vanish; and some of the tokens that *are* offered render as `Unknown` at runtime.

**Fix.** Pass the scoped list to the action Variables tab, give `StepPanel` the same tabs/preview as `ActionPanel`, drive `VARIABLE_FIELD_KEYS` off the field descriptors rather than a hardcoded set, and prune `EVENT_TYPE_VARIABLES` down to what `eventBridge` actually populates (or populate what it promises).

### (C) Trigger filters aren't convenient

This one is worse than "inconvenient" — the filters are **unreliable**, and that outranks the ergonomics.

**Root cause — correctness.** [`executor.ts:54-79`](../../apps/bot/src/features/automation/system/executor.ts#L54-L79) guards every filter on the presence of its datum: `if (conditions.excludeRoleIds?.length && context.member)`. When the event context lacks the field the filter is **skipped, not failed**. `buildBanContext` never sets `member`, so "exclude @Staff" on a `memberBanned` rule announces staff bans anyway. Same for role filters on `reactionAdded` and `memberLeave`. Worse, on `threadCreated`/`channelCreated` the context channel *is* the new thread, so an include-channel filter can never match and the rule silently never fires.

**Root cause — ergonomics.** Users add member filters by pasting raw 17–20 digit snowflakes ([`ConditionsEditor.tsx:69-128`](../../apps/dashboard/src/client/features/automation/components/ConditionsEditor.tsx#L69-L128)) and saved users render as bare digits — there is no member-search endpoint anywhere in the dashboard to build a picker on. The channel picker cannot offer announcement, forum, stage or thread channels. All six filters are offered for every event type including combinations the runtime can never evaluate. Include/exclude reuse identical labels and the four comboboxes have no programmatic label, so a screen-reader user cannot tell them apart. And active filters are invisible outside the open panel — not on the canvas node, not in the rule list.

**Fix.** Pick one explicit policy — a configured filter whose datum is missing should **fail closed** (rule does not fire) rather than be dropped — and populate the contexts where the data is obtainable. Then make the editor event-aware so it never offers a filter the runtime cannot evaluate for the selected trigger, and add a filter summary to the trigger node.

## Other confirmed defects


### High (12)

| # | Defect | Location | Impact |
|---|---|---|---|
| 1 | Actions with a missing required field silently no-op at runtime AND are recorded as successful executions | `bot/features/automation/system/executor.ts:295` | A moderator's "auto-role on join" rule never assigns the role |
| 2 | Server gate validates only action.type and webhook URL — every other required field is unchecked | `~/server/features/actions/routes.ts:85` | Even after the client-side warning/error split is fixed, the real gate still accepts a dead rule |
| 3 | Five of six preset rule templates produce a rule with a required field blank | `~/client/routes/guild/$guildId/rules.tsx:68` | The product's own onboarding path is the fastest way to create a broken rule |
| 4 | Trigger filters silently no-op when the event context lacks the field — exclude filters especially, so rules fire on users/channels they were configured to skip | `bot/features/automation/system/executor.ts:60` | An admin builds a `memberBanned` rule that DMs a moderator log and adds `Exclude → Roles: @Staff` so staff bans are not announced |
| 5 | Include-channel filter can never match threadCreated/channelCreated (the context channel is the new thread/channel), and the picker cannot offer announcement, forum, stage or thread channels at all | `bot/features/automation/system/eventBridge.ts:379` | A user creates a `threadCreated` rule and adds `Include → Channels: #support` intending "only threads under #support" |
| 6 | hasRole / notHasRole always false unless the unrelated condition field happens to be populated | `bot/features/automation/system/executor.ts:117` | User builds the canonical flow: on member join, IF member hasRole @Verified then welcome, ELSE send verification DM |
| 7 | addRole / removeRole silently do nothing on any event whose context has no member, and are logged as success | `bot/features/automation/system/registry.ts:85` | The classic reaction-role automation - 'when someone reacts with a check mark, give them @Member' - saves cleanly, shows a green node, and does absolutely nothing at runtime |
| 8 | reactionAdded / reactionRemoved / messageDeleted triggers never fire for uncached messages because the client enables no Partials | `bot/shared/client/ExtendedClient.ts:9` | An admin sets up 'when someone reacts to this rules message, give them a role' on a pinned message posted last month, or 'log every deleted message' |
| 9 | The /actions bot command silently downgrades a canvas-built rule to a flat action list, destroying conditions, delays and branches | `bot/features/general/commands/actions.ts:761` | A user spends time building a branching workflow in the canvas, then runs /actions edit rule:welcome message:hi (or add-action) in Discord |
| 10 | Missing required action fields are only "warnings", so Save stays enabled and a rule that can never execute is persisted | `~/client/features/automation/lib/workflow-validation.ts:213` | User picks trigger "Member Join", picks action "Send Message", never opens the Channel picker, sees the toolbar say "1 issue" in amber, and Save is fully enabled |
| 11 | Changing an action's type discards every field the user already filled in, with no warning and no undo | `~/client/features/automation/workflow/NodeDetailPanel.tsx:320` | User composes a 400-character welcome message under "Send Message", realises it should be a DM, switches the type to "Send DM" — both action types have a `message` field, but the message … |
| 12 | Escape typed inside the rule-name or any other input closes the entire editor instead of the field | `~/client/features/automation/workflow/useWorkflowKeyboard.ts:55` | User types a rule name, decides the text is wrong, presses Escape out of habit to revert the field, and the whole full-screen editor closes |

### Medium (19)

| # | Defect | Location | Impact |
|---|---|---|---|
| 1 | The webhook Headers field writes a raw string into a field typed as a record, making the rule unsavable with an untranslated Zod message | `~/client/features/automation/components/ActionFields.tsx:155` | A user configuring sendWebhook types the exact JSON the placeholder shows them, clicks Save, and gets a red banner reading "Expected object, received string" — English-only regardless of … |
| 2 | The server validates body.actions but persists body.steps unchecked — and the bot executes steps in preference to actions | `~/server/features/actions/routes.ts:106` | The declared server contract does not cover the code path that actually executes |
| 3 | Step-mode action editor has no Variables tab and no message preview at all — adding a single condition or delay strips both from every action in the rule | `~/client/features/automation/workflow/NodeDetailPanel.tsx:560` | User builds a Send Message rule, sees the variable reference and the live Discord preview, then adds one condition to branch on channel |
| 4 | Before a trigger is picked, every variable typed into an action is flagged "Unknown variable" and autocomplete never opens | `~/client/shared/ui/variable-field/automationVariables.ts:40` | A first-time user drags in an action before choosing a trigger (nothing stops them), types `{user}` in the Message field, and the field turns red: "Unknown variable {user}" — for the sing… |
| 5 | EVENT_TYPE_VARIABLES promises {channel*} on member/ban/role events and {user*} on channel events, but the bot never populates them — the preview shows #general/@Ada while the bot posts "Unknown Channel"/"Unknown User" | `bot/features/automation/system/eventBridge.ts:32` | User writes a memberJoin welcome message "Welcome {user} to {channel}!" |
| 6 | ConditionsEditor offers all six filters for every event type, including combinations the bot can never evaluate, and nothing validates them | `~/client/features/automation/workflow/NodeDetailPanel.tsx:285` | A user configuring a `channelCreated` rule sees Include → Users and Include → Roles pickers, picks "only when @Admin creates a channel", saves, sees no warning anywhere, and the rule fire… |
| 7 | User filters require pasting raw 17-20 digit snowflakes and render saved users as bare digits — there is no member search endpoint anywhere in the dashboard | `~/client/features/automation/components/ConditionsEditor.tsx:123` | To exclude one troublesome member from an automation, an admin must leave the dashboard, enable Discord developer mode, right-click the user, copy the ID, and paste it back |
| 8 | The four channel/role filter comboboxes have no programmatic label, and include vs exclude are indistinguishable to a screen reader | `~/client/shared/ui/discord-multi-select.tsx:108` | A screen-reader user tabbing the Filters tab hears: "Add channel..., button / Add role..., button / Users, edit / Add user ID, button / Exclude channel..., button / Exclude role..., butto… |
| 9 | Every event/action type label and description in the automation UI — including the rules-list event filter — is hardcoded English served from the API, in an app with 48 locales | `~/client/routes/guild/$guildId/rules.tsx:428` | An Arabic or Japanese admin opens Automation: the page chrome, filter placeholders and buttons are localised, but the event-type filter dropdown reads "Member Join / Message Deleted / Boo… |
| 10 | Trigger include/exclude filters are silently skipped when the event context lacks the value (fail open) | `bot/features/automation/system/executor.ts:54` | An admin restricts a reaction rule to 'only members with @Staff' or 'exclude @Muted' |
| 11 | ActionLog records success=true for actions that never ran, swallowed failures, and unknown action types, so the dashboard success rate is fiction | `bot/features/automation/system/executor.ts:189` | A user whose welcome DM is blocked by everyone's privacy settings, or whose rule has an unfilled channel field (the editor only warns, so it saves), sees 'Success rate 100%' on the rules … |
| 12 | sendWebhook SSRF: the https + private-IP check is bypassed by a redirect, and the response body is read unbounded | `bot/features/automation/system/registry.ts:226` | Any guild admin (or anyone who compromises one dashboard session) can point a webhook action at their own https endpoint that redirects to the cloud metadata service or an internal host, … |
| 13 | EVENT_TYPE_VARIABLES advertises variables the event context never populates; templates render Unknown / 0 instead | `systems/actions/constants.ts:224` | The autocomplete for a Member Join trigger offers {channel} and {channel.name}; the user inserts them, the Discord preview renders them, and the live message posts the literal text 'Unkno… |
| 14 | A delay step blocks every lower-priority rule for that event, is lost on restart, and is silently skipped at the concurrency cap | `bot/features/automation/system/executor.ts:235` | A user drags a 'wait 5 minutes then send a reminder' node into a high-priority join rule; their other join rules (autorole, log) also stop running for five minutes per join |
| 15 | Rate limiting silently aborts rules mid-workflow with no user-visible signal | `bot/features/automation/system/executor.ts:184` | On a busy server a messageCreated rule stops firing after 60 actions in a minute and users report 'the bot randomly ignores some messages' |
| 16 | Deleting the last step drops the canvas back to linear mode and resurrects the stale pre-conversion actions array | `~/client/features/automation/workflow/useWorkflowNodes.ts:409` | User converts a 3-action rule to a workflow, reworks it into 2 steps, then deletes those 2 steps to start over |
| 17 | Editing an existing rule autosaves a draft that is never read back, and closing the editor discards the edits with no confirmation and no beforeunload guard | `~/client/features/automation/workflow/WorkflowEditor.tsx:109` | User opens an existing rule, spends five minutes rewriting the embed and rewiring two steps, then hits Escape or the browser Back button |
| 18 | Step mode enforces no action/step/condition ceiling, so the server rejects the finished rule with a raw untranslated English error | `~/client/features/automation/workflow/WorkflowEditor.tsx:632` | User builds a 6-action / 4-condition workflow with the buttons the UI happily keeps enabled, the toolbar reports "Ready", then Save fails with the literal string "Max 5 actions" — in Engl… |
| 19 | The only aggregate validation explanation is a hover tooltip on a non-focusable div, and the disabled Save button gives no accessible reason or way to reach the bad node | `~/client/features/automation/workflow/WorkflowEditor.tsx:659` | A keyboard or screen-reader user sees a permanently greyed Save button and is never told why |

### Low (14)

| # | Defect | Location | Impact |
|---|---|---|---|
| 1 | ActionFields has no inline error affordance — required fields get only a decorative asterisk, no aria-invalid, no message, no touched state | `~/client/features/automation/components/ActionFields.tsx:79` | A screen-reader user tabs into the Channel picker for a Send Message action |
| 2 | RULE_NAME_REGEX guards the bot command but not the dashboard API, so its stated injection protection is bypassable | `~/server/features/actions/routes.ts:59` | A dashboard admin names a rule `@everyone` or `<@&1234>` |
| 3 | Creating a rule with a duplicate name hits an unhandled Prisma P2002 and returns a 500 with a generic client message | `~/server/features/actions/routes.ts:249` | An admin uses the "Welcome Message" template twice (both drafts hard-code `name: t("templates.welcomeMessageName")` at rules.tsx:52), or simply retypes a name they already used |
| 4 | No test anywhere asserts required-field enforcement, and the one server test that touches it asserts the broken behaviour | `apps/dashboard/tests/server/features/actions/actions.test.ts:236` | Any fix to the required-field gate can be silently reverted, and in fact the current test suite would FAIL the correct behaviour — a maintainer who fixes routes.ts to reject an action wit… |
| 5 | Nothing validates action templates against the selected trigger at rule level — a rule full of tokens the trigger cannot provide saves cleanly, and changing the trigger silently invalidates every template | `~/client/features/automation/lib/workflow-validation.ts:206` | User writes a messageCreated rule using {message.content}, later switches the trigger to memberJoin from the trigger panel |
| 6 | DiscordMultiSelect — the component that renders four of the six trigger filters — ships hardcoded English strings and never calls useTranslation | `~/client/shared/ui/discord-multi-select.tsx:104` | In any non-English locale, opening Include → Channels shows a popover whose search box says "Search...", whose empty state says "No channels available", and whose trigger reads "3 selecte… |
| 7 | Active trigger filters are invisible outside the open detail panel — neither the canvas trigger node nor the rule list shows that a rule is filtered | `~/client/features/automation/workflow/nodes/TriggerNode.tsx:25` | A rule stops firing |
| 8 | The rules-list event filter keeps filtering after its option disappears, leaving a control with no readable value and an empty list | `~/client/routes/guild/$guildId/rules.tsx:206` | Admin filters to "Member Join" (2 rules), deletes both |
| 9 | The server stores trigger conditions verbatim — no snowflake, guild-ownership or key validation — and deleted channels/roles then render as bare IDs | `~/server/features/actions/routes.ts:260` | A moderator deletes #welcome in Discord |
| 10 | Include semantics (OR within a group, AND across groups, empty = match all) are never stated, and the one explanatory sentence is ambiguous | `i18n/locales/en/rules.json:146` | An admin adds Include → Roles: @Member and @Verified expecting "members who have BOTH roles" (the copy says "matches all include filters"), but the bot fires for anyone with EITHER |
| 11 | The canvas allows a loop and the executor has no cycle detection - looped actions run up to 20 times per event | `bot/features/automation/system/executor.ts:174` | A user connects the last node back to an earlier one (easy to do by accident when re-routing an edge) |
| 12 | The API stores step contents unvalidated; a condition step without a value throws inside the one code path with no try/catch, aborting all remaining rules | `~/server/features/actions/routes.ts:106` | A hand-built or third-party API call (the endpoints are documented via withDocs), or any future client bug, persists a condition step with no value or an unknown operator |
| 13 | The entire v2 step-graph execution path is untested | `apps/bot/tests/features/automation/system/executor.test.ts:45` | Every defect above in condition evaluation and step traversal shipped undetected, and the project's own CLAUDE.md rule ('Every Feature Must Include Tests  |
| 14 | Trigger filters are invisible everywhere except inside the trigger panel — not on the canvas, not in the rule list | `~/client/features/automation/workflow/useWorkflowNodes.ts:23` | User restricts a rule to one channel, saves, and later wonders why it never fires elsewhere |

### Unverified (10) — the adversarial pass hit the session limit before these ran

| Defect | Location | Note |
|---|---|---|
| The template gallery only exists while the guild has zero rules, and the editor itself offers no onboarding | `~/client/routes/guild/$guildId/rules.tsx:520` | medium / ux |
| Condition and Delay nodes never render their warning validation state, so their issues have no anchor on the canvas | `~/client/features/automation/workflow/nodes/ConditionNode.tsx:31` | medium / validation |
| The action panel's Variables tab lists every template variable regardless of the trigger, and step-mode action panels have no Variables tab at all | `~/client/features/automation/workflow/NodeDetailPanel.tsx:434` | medium / parity |
| An empty draft is written 500 ms after the editor opens, so the next "Create Rule" greets the user with a bogus "Draft restored" banner | `~/client/features/automation/workflow/WorkflowEditor.tsx:182` | medium / ux |
| Deleting two or more selected action nodes at once removes the wrong actions because the indices shift between removals | `~/client/features/automation/workflow/WorkflowEditor.tsx:229` | medium / correctness |
| The rule list has no way to show that a saved rule is misconfigured — its only "not configured" marker is unreachable dead code | `~/client/features/automation/components/RuleList.tsx:269` | medium / ux |
| The full-screen editor is portalled over the app without focus containment, so Tab reaches the sidebar behind it and navigating away destroys unsaved work | `~/client/features/automation/workflow/WorkflowEditor.tsx:894` | medium / a11y |
| Every trigger name, action name, description, field label and placeholder is hardcoded English served from the API, in a 48-locale dashboard | `systems/actions/constants.ts:18` | medium / i18n |
| Trigger filters clear all six lists on a single unconfirmed click, and member filters require pasting raw snowflake IDs while channels and roles get pickers | `~/client/features/automation/components/ConditionsEditor.tsx:287` | medium / ux |
| The rule list step counter interpolates `count` without plural categories, so it reads "+1 steps" in English and is ungrammatical in every plural-rich locale | `~/client/features/automation/components/RuleList.tsx:312` | low / i18n |
## Refuted — deliberately not fixed

Five findings did not survive the adversarial pass and are recorded here so they are not re-raised:

- *"Automation reimplements the variable picker instead of reusing VariableBrowser"* — false premise; the shared primitive is already used for insertion.
- *"`buildAutomationVariables` is unmemoized, breaking downstream memos"* — mechanically true, no reachable impact (the array is small and the claimed keystroke cost does not occur).
- *"Rules-list filters are component state and reset on navigation"* — accurate reading of the code, but the load-bearing user scenario is unreachable.
- *"The rules-list event filter should be a SearchableSelect"* — the code quotes are right, the severity was not; folded into the i18n item instead.
- *"Adding a Condition or Delay permanently deletes unconfigured actions"* — `convertToStepMode` does not lose data the way claimed.

## Suggested fix order

Each item is one commit, with the tests it needs. FluxCore requires tests for every change.

1. **Make required fields block the save.** `workflow-validation.ts` warning→error; server-side `ACTION_TYPE_FIELDS` enforcement in `validateRuleBody`; inline `aria-invalid` + message in `ActionFields`. Closes **(A)**.
   *Tests:* per-action-type cases in `workflow-validation.test.ts`; server rejection cases in `tests/server/features/actions/actions.test.ts` (and fix the existing test that asserts the broken behaviour).
2. **Stop reporting phantom successes.** Executors throw on missing config instead of returning; `executor.ts` unknown-action branch must not fall through to the success log; resolve the member in `addRole`/`removeRole`.
   *Tests:* `apps/bot/tests/features/automation/system/executor.test.ts` — assert `success: false` and the error text.
3. **Fix filter semantics (fail closed) and populate missing contexts.** `matchesConditions` + `buildBanContext`/`buildReactionContext`. Closes half of **(C)**.
   *Tests:* executor unit tests per event/filter combination.
4. **Make the conditions editor event-aware** and add a filter summary to the trigger node. Closes the rest of **(C)**.
   *Tests:* `ConditionsEditor` component tests; `useWorkflowNodes.test.ts` for the summary.
5. **Scope the action Variables tab to the trigger; give StepPanel tabs + preview; derive `VARIABLE_FIELD_KEYS` from descriptors.** Closes **(B)**.
   *Tests:* `NodeDetailPanel` component tests asserting the scoped token set in both modes.
6. **Reconcile `EVENT_TYPE_VARIABLES` with what `eventBridge` populates.** Finishes **(B)**.
   *Tests:* a matrix test in `packages/systems/tests/` pinning promised-vs-populated per event type.
7. **i18n the automation vocabulary.** Move event/action labels, descriptions, field labels and placeholders out of `packages/systems/src/actions/constants.ts` into `rules.json` keys resolved client-side; translate across all 48 locales.
   *Tests:* key-parity test.
8. **Editor data-loss fixes.** Preserve shared fields on action-type change; scope Escape to the focused control; unsaved-changes guard on close; fix the multi-node delete index bug.
   *Tests:* `WorkflowEditor.test.tsx`.
9. **Webhook headers JSON field**, SSRF redirect hardening, and the remaining low-severity items.

## Not in scope of the reported complaints, but worth flagging

- [`ExtendedClient.ts:9`](../../apps/bot/src/shared/client/ExtendedClient.ts#L9) enables **no Partials**, so `reactionAdded`/`reactionRemoved`/`messageDeleted` triggers never fire for messages the bot has not cached since its last restart. Reaction-role automations on an old pinned message simply never work. This is a bot-wide fix, not an automation-only one.
- [`actions.ts:761`](../../apps/bot/src/features/general/commands/actions.ts#L761) — the `/actions` slash command silently downgrades a canvas-built workflow to a flat action list, destroying conditions, delays and branches.
