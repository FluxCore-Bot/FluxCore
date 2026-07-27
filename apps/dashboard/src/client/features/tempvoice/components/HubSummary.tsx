import { useTranslation } from "react-i18next";
import { Icon } from "../../../shared/components/Icon";
import { ChannelChip } from "./ChannelChip";

export interface HubSummaryProps {
  /** Name template already resolved against preview values. */
  resolvedName: string;
  /** Display name of the target category, or null for "same as hub". */
  categoryName: string | null;
}

function Arrow() {
  return (
    <Icon
      name="chevron_right"
      className="size-3.5 shrink-0 text-text-muted rtl:-scale-x-100"
      aria-hidden="true"
    />
  );
}

export function HubSummary({ resolvedName, categoryName }: HubSummaryProps) {
  const { t } = useTranslation("tempvoice");
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
      <ChannelChip kind="voice" name={resolvedName} />
      <Arrow />
      {categoryName ? (
        <ChannelChip kind="category" name={categoryName} />
      ) : (
        <span>{t("summary.sameCategory")}</span>
      )}
      <Arrow />
      <span>{t("summary.deletedWhenEmpty")}</span>
    </div>
  );
}
