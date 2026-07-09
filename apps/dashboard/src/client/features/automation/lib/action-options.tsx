import { Icon } from "../../../shared/components/Icon";
import type { SearchableSelectOption } from "../../../shared/ui/searchable-select";
import type { Constants } from "../../../shared/lib/schemas";
import { ACTION_ICONS } from "./rule-icons";

/** Map the action-type constants into SearchableSelect options (icon + description as search keywords). */
export function buildActionTypeOptions(
  actionTypes: Constants["actionTypes"],
): SearchableSelectOption[] {
  return Object.entries(actionTypes).map(([value, info]) => ({
    value,
    label: info.label,
    keywords: info.description,
    icon: <Icon name={ACTION_ICONS[value] ?? "bolt"} size={16} />,
  }));
}
