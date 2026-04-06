import { useChannels } from "../../lib/hooks/useChannels";
import { useRoles } from "../../lib/hooks/useRoles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Badge } from "./badge";
import { Skeleton } from "./skeleton";
import { Label } from "./label";
import { Icon } from "../Icon";

export type DiscordMultiSelectType = "text" | "voice" | "any" | "role";

export interface DiscordMultiSelectProps {
  guildId: string;
  type: DiscordMultiSelectType;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  label?: string;
}

function channelLabel(name: string, channelType: number): string {
  return channelType === 2 ? `🔊 ${name}` : `# ${name}`;
}

export function DiscordMultiSelect({
  guildId,
  type,
  selectedIds,
  onChange,
  placeholder,
  label,
}: DiscordMultiSelectProps) {
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

  const allOptions: { id: string; name: string }[] = isRole
    ? (roles ?? []).map((r) => ({ id: r.id, name: r.name }))
    : (channels ?? [])
        .filter((c) => {
          if (type === "text") return c.type === 0;
          if (type === "voice") return c.type === 2;
          return c.type === 0 || c.type === 2; // "any" = text + voice (no categories)
        })
        .map((c) => ({ id: c.id, name: channelLabel(c.name, c.type) }));

  const available = allOptions.filter((o) => !selectedIds.includes(o.id));
  const chips = selectedIds.map((id) => {
    const found = allOptions.find((o) => o.id === id);
    return { id, label: found?.name ?? id };
  });

  function add(id: string) {
    if (!selectedIds.includes(id)) onChange([...selectedIds, id]);
  }

  function remove(id: string) {
    onChange(selectedIds.filter((v) => v !== id));
  }

  const defaultPlaceholder = isRole ? "Add a role..." : "Add a channel...";

  return (
    <div className="space-y-1.5">
      {label && <Label className="text-xs">{label}</Label>}
      {isLoading ? (
        <Skeleton className="h-8 w-full" />
      ) : isError ? (
        <Select disabled>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Failed to load" />
          </SelectTrigger>
        </Select>
      ) : available.length > 0 ? (
        <Select value="" onValueChange={(v) => v && add(v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={placeholder ?? defaultPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {available.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Badge
              key={chip.id}
              variant="secondary"
              className="gap-1 pe-1 text-[11px]"
            >
              {chip.label}
              <button
                type="button"
                aria-label={`Remove ${chip.label}`}
                onClick={() => remove(chip.id)}
                className="ms-0.5 rounded-full p-0.5 hover:bg-white/10"
              >
                <Icon name="close" size={10} />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
