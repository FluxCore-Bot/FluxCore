import { describe, it, expect } from "vitest";
import { makeAutomationLabels } from "../../../../src/client/features/automation/lib/labels";
import type { Constants } from "../../../../src/client/shared/lib/schemas";

const constants = {
  eventTypes: { memberJoin: { label: "Member Join", description: "When a member joins" } },
  actionTypes: { sendMessage: { label: "Send Message", description: "Send a message" } },
  maxActionsPerRule: 5,
  actionTypeFields: {},
  eventTypeVariables: {},
  templateVariables: {},
  eventConditionSupport: {},
} as unknown as Constants;

/** Stands in for i18next: returns a translation only for the keys it knows. */
function translator(dict: Record<string, string>) {
  return (key: string, params?: Record<string, unknown>) =>
    dict[key] ?? (params?.defaultValue as string | undefined) ?? key;
}

/**
 * EVENT_TYPES / ACTION_TYPES / ACTION_TYPE_FIELDS are hardcoded English in
 * packages/systems and served raw by the API, because the bot needs them too.
 * That made the whole automation builder English-only in a 48-locale app.
 * The client translates them on the way out, falling back to the API's
 * English so an untranslated locale degrades to the old behaviour rather than
 * rendering blanks.
 */
describe("automation label resolver", () => {
  it("prefers the translation when the locale has one", () => {
    const labels = makeAutomationLabels(
      translator({ "eventTypes.memberJoin.label": "Mitglied beigetreten" }),
      constants,
    );
    expect(labels.eventLabel("memberJoin")).toBe("Mitglied beigetreten");
  });

  it("falls back to the API's English when the locale has none", () => {
    const labels = makeAutomationLabels(translator({}), constants);
    expect(labels.eventLabel("memberJoin")).toBe("Member Join");
    expect(labels.actionLabel("sendMessage")).toBe("Send Message");
  });

  it("treats an empty translation as missing", () => {
    const labels = makeAutomationLabels(
      translator({ "eventTypes.memberJoin.label": "" }),
      constants,
    );
    expect(labels.eventLabel("memberJoin")).toBe("Member Join");
  });

  it("falls back to the raw key for an event the API does not know", () => {
    const labels = makeAutomationLabels(translator({}), constants);
    expect(labels.eventLabel("somethingNew")).toBe("somethingNew");
  });

  it("translates descriptions too", () => {
    const labels = makeAutomationLabels(
      translator({ "actionTypes.sendMessage.description": "Envoie un message" }),
      constants,
    );
    expect(labels.actionDescription("sendMessage")).toBe("Envoie un message");
  });

  // Field keys contain dots, which i18next reads as key nesting.
  it("escapes dots in field keys so nested paths do not break lookup", () => {
    const labels = makeAutomationLabels(
      translator({ "actionFields.sendWebhook_webhook_url.label": "URL du webhook" }),
      constants,
    );
    expect(labels.fieldLabel("sendWebhook", "webhook.url", "Webhook URL")).toBe(
      "URL du webhook",
    );
  });

  it("leaves an absent placeholder absent rather than inventing one", () => {
    const labels = makeAutomationLabels(translator({}), constants);
    expect(labels.fieldPlaceholder("addRole", "roleId", undefined)).toBeUndefined();
  });
});
