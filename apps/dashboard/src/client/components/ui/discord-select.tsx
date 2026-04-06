import { useChannels } from "../../lib/hooks/useChannels";
import { useRoles } from "../../lib/hooks/useRoles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Skeleton } from "./skeleton";

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
}: DiscordSelectProps) {
  const isRole = type === "role";
  const {
    data: channels,
    isLoading: chLoading,
    isError: chError,
  } = useChannels(guildId);
  const {
    data: roles,
    isLoading: roLoading,
    isError: roError,
  } = useRoles(guildId);

  const isLoading = isRole ? roLoading : chLoading;
  const isError = isRole ? roError : chError;

  const options: { id: string; label: string }[] = isRole
    ? (roles ?? []).map((r) => ({ id: r.id, label: `● ${r.name}` }))
    : (channels ?? [])
        .filter((c) => {
          if (type === "text") return c.type === 0;
          if (type === "voice") return c.type === 2;
          if (type === "category") return c.type === 4;
          return c.type === 0 || c.type === 2; // "any"
        })
        .map((c) => ({ id: c.id, label: channelLabel(c.name, c.type) }));

  if (isLoading) {
    return <Skeleton className={`h-9 w-full ${className ?? ""}`} />;
  }

  if (isError) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Failed to load" />
        </SelectTrigger>
      </Select>
    );
  }

  const defaultPlaceholder = isRole ? "Select a role" : "Select a channel";

  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) =>
        onValueChange(v === "__none__" ? null : v || null)
      }
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder ?? defaultPlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && (
          <SelectItem value="__none__">None</SelectItem>
        )}
        {options.length === 0 ? (
          <SelectItem value="__empty__" disabled>
            {isRole ? "No roles available" : "No channels available"}
          </SelectItem>
        ) : (
          options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
