import { useMemo } from "react";
import { useChannels } from "../hooks/useChannels";
import { useRoles } from "../hooks/useRoles";
import { SearchableSelect, type SearchableSelectOption } from "./searchable-select";

export type DiscordSelectType = "text" | "voice" | "category" | "any" | "role";

export interface DiscordSelectProps {
  guildId: string;
  type: DiscordSelectType;
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  /** Adds a "None" option that passes null to onValueChange */
  allowNone?: boolean;
  disabled?: boolean;
  className?: string;
  /** Option values to omit — e.g. hub channels already claimed by another config.
   *  The current `value` is always kept so an editing form can show its own selection. */
  excludeIds?: string[];
}

function channelLabel(name: string, channelType: number): string {
  if (channelType === 2) return `🔊 ${name}`;
  if (channelType === 4) return `📁 ${name}`;
  return `# ${name}`;
}

export function DiscordSelect({
  guildId,
  type,
  value,
  onValueChange,
  placeholder,
  allowNone,
  disabled,
  className,
  excludeIds,
}: DiscordSelectProps) {
  const isRole = type === "role";
  const {
    data: channels,
    isLoading: chLoading,
    isError: chError,
  } = useChannels(guildId, { enabled: !isRole });
  const {
    data: roles,
    isLoading: roLoading,
    isError: roError,
  } = useRoles(guildId, { enabled: isRole });

  const isLoading = isRole ? roLoading : chLoading;
  const isError = isRole ? roError : chError;

  const options: SearchableSelectOption[] = useMemo(() => {
    const exclude = new Set(excludeIds ?? []);
    const keep = (id: string) => !exclude.has(id) || id === value;
    return isRole
      ? (roles ?? [])
          .filter((r) => keep(r.id))
          .map((r) => ({ value: r.id, label: `● ${r.name}` }))
      : (channels ?? [])
          .filter((c) => {
            if (type === "text") return c.type === 0;
            if (type === "voice") return c.type === 2;
            if (type === "category") return c.type === 4;
            return c.type === 0 || c.type === 2;
          })
          .filter((c) => keep(c.id))
          .map((c) => ({ value: c.id, label: channelLabel(c.name, c.type) }));
  }, [isRole, roles, channels, type, excludeIds, value]);

  return (
    <SearchableSelect
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder ?? (isRole ? "Select a role" : "Select a channel")}
      allowNone={allowNone}
      disabled={disabled}
      loading={isLoading}
      error={isError}
      emptyLabel={isRole ? "No roles available" : "No channels available"}
      className={className}
    />
  );
}
