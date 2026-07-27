import { Icon } from "../../../shared/components/Icon";

export interface ChannelChipProps {
  kind: "voice" | "category";
  name: string;
}

/** A Discord-looking channel token, reused by the summary chain, the editor
 *  preview, and the empty-state example so all three read as the same object. */
export function ChannelChip({ kind, name }: ChannelChipProps) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-surface-high px-2 py-1 text-xs">
      <Icon
        name={kind === "voice" ? "volume_up" : "folder"}
        className="size-3.5 shrink-0"
      />
      <span className="truncate">{name}</span>
    </span>
  );
}
