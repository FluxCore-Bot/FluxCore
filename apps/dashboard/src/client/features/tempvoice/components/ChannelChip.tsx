import { Icon } from "../../../shared/components/Icon";
import { cn } from "../../../shared/lib/utils";

export interface ChannelChipProps {
  kind: "voice" | "category";
  name: string;
  /** "example" dashes the border so the empty state's worked example reads as
   *  an illustration rather than a real, saved channel. Kept at full opacity
   *  and on the same border token so the teaching copy still meets 4.5:1 —
   *  the cue is the stroke style, not a dimmed colour. */
  variant?: "default" | "example";
}

/** A Discord-looking channel token, reused by the summary chain, the editor
 *  preview, and the empty-state example so all three read as the same object. */
export function ChannelChip({ kind, name, variant = "default" }: ChannelChipProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-surface-high px-2 py-1 text-xs",
        variant === "example" && "border-dashed",
      )}
    >
      <Icon
        name={kind === "voice" ? "volume_up" : "folder"}
        className="size-3.5 shrink-0"
      />
      <span className="truncate">{name}</span>
    </span>
  );
}
