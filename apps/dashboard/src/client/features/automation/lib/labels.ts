import { useTranslation } from "react-i18next";
import type { Constants } from "../../../shared/lib/schemas";

/**
 * Resolves the automation vocabulary — trigger names, action names, their
 * descriptions, and action field labels/placeholders — through i18n.
 *
 * These all live as hardcoded English in
 * `packages/systems/src/actions/constants.ts` and are served raw by
 * /api/actions/constants, because the bot needs them too (embed titles,
 * `/actions` autocomplete). That made the entire automation builder
 * English-only in an app with 48 locales: every trigger in the picker, every
 * action chip in the rule list, every field label in the editor.
 *
 * Rather than move the data (the bot still needs it), the client translates it
 * on the way out, falling back to the API's English when a key is missing —
 * so an untranslated locale degrades to today's behaviour instead of blanks.
 */
/** The translator shape these helpers need — structural, so tests need no cast. */
export type TranslateFn = (
  key: string,
  params?: Record<string, unknown>,
) => string;

export interface AutomationLabels {
  eventLabel: (eventType: string) => string;
  eventDescription: (eventType: string) => string;
  actionLabel: (actionType: string) => string;
  actionDescription: (actionType: string) => string;
  fieldLabel: (actionType: string, fieldKey: string, fallback: string) => string;
  fieldPlaceholder: (
    actionType: string,
    fieldKey: string,
    fallback: string | undefined,
  ) => string | undefined;
}

/**
 * Pure form, for `useWorkflowNodes` and anywhere else that already has a `t`
 * rather than being able to call a hook.
 */
export function makeAutomationLabels(
  t: TranslateFn,
  constants: Constants | undefined,
): AutomationLabels {
  const withFallback = (key: string, fallback: string): string => {
    const translated = t(key, { defaultValue: "" });
    return translated || fallback;
  };

  return {
    eventLabel: (eventType: string): string =>
      withFallback(
        `eventTypes.${eventType}.label`,
        constants?.eventTypes[eventType]?.label ?? eventType,
      ),
    eventDescription: (eventType: string): string =>
      withFallback(
        `eventTypes.${eventType}.description`,
        constants?.eventTypes[eventType]?.description ?? "",
      ),
    actionLabel: (actionType: string): string =>
      withFallback(
        `actionTypes.${actionType}.label`,
        constants?.actionTypes[actionType]?.label ?? actionType,
      ),
    actionDescription: (actionType: string): string =>
      withFallback(
        `actionTypes.${actionType}.description`,
        constants?.actionTypes[actionType]?.description ?? "",
      ),
    /** Field keys contain dots, which i18next reads as nesting — escape them. */
    fieldLabel: (actionType: string, fieldKey: string, fallback: string): string =>
      withFallback(`actionFields.${actionType}_${fieldKey.replace(/\./g, "_")}.label`, fallback),
    fieldPlaceholder: (
      actionType: string,
      fieldKey: string,
      fallback: string | undefined,
    ): string | undefined =>
      fallback === undefined
        ? undefined
        : withFallback(
            `actionFields.${actionType}_${fieldKey.replace(/\./g, "_")}.placeholder`,
            fallback,
          ),
  };
}

/** Hook form, for components. */
export function useAutomationLabels(
  constants: Constants | undefined,
): AutomationLabels {
  const { t } = useTranslation("rules");
  return makeAutomationLabels(t, constants);
}
