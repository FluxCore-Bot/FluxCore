import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useLogConfig, useUpdateLogConfig } from "../lib/hooks/useLogging";
import { useChannels } from "../lib/hooks/useChannels";
import { Icon } from "./Icon";
import { Switch } from "./ui/switch";
import { TableSkeleton } from "./PageSkeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Badge } from "./ui/badge";

const CATEGORY_LABELS: Record<string, string> = {
  message: "Message Events",
  member: "Member Events",
  voice: "Voice Events",
  channel: "Channel Events",
  role: "Role Events",
  server: "Server Events",
  moderation: "Moderation Events",
};

const CATEGORY_ICONS: Record<string, string> = {
  message: "message-circle",
  member: "users",
  voice: "mic",
  channel: "hash",
  role: "shield",
  server: "settings",
  moderation: "gavel",
};

export function EventLogConfig() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: logConfigData, isLoading } = useLogConfig(guildId);
  const { data: channels } = useChannels(guildId);
  const updateConfig = useUpdateLogConfig(guildId);

  if (isLoading) return <TableSkeleton rows={4} />;
  if (!logConfigData) return null;

  const { configs, categories, eventTypes } = logConfigData;

  const textChannels = channels?.filter((c) => c.type === 0) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon name="settings" size={20} className="text-accent" />
        <h3 className="text-lg font-semibold font-display">Log Configuration</h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => {
          const config = configs.find((c) => c.category === category);
          return (
            <CategoryCard
              key={category}
              guildId={guildId}
              category={category}
              config={config ?? null}
              channels={textChannels}
              events={eventTypes[category] ?? []}
              onUpdate={(data) => {
                updateConfig.mutate({ category, data });
              }}
              isSaving={updateConfig.isPending}
            />
          );
        })}
      </div>
    </div>
  );
}

interface CategoryCardProps {
  guildId: string;
  category: string;
  config: {
    id: number;
    channelId: string;
    enabled: boolean;
    ignoredChannels: string[];
    ignoredRoles: string[];
    enabledEvents: string[];
  } | null;
  channels: { id: string; name: string; type: number }[];
  events: string[];
  onUpdate: (data: {
    channelId: string;
    enabled?: boolean;
    ignoredChannels?: string[];
    ignoredRoles?: string[];
    enabledEvents?: string[];
  }) => void;
  isSaving: boolean;
}

function CategoryCard({
  category,
  config,
  channels,
  events,
  onUpdate,
}: CategoryCardProps) {
  const [selectedChannel, setSelectedChannel] = useState(config?.channelId ?? "");
  const [enabled, setEnabled] = useState(config?.enabled ?? false);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    if (selectedChannel) {
      onUpdate({ channelId: selectedChannel, enabled: checked });
    }
  };

  const handleChannelChange = (channelId: string) => {
    setSelectedChannel(channelId);
    onUpdate({ channelId, enabled });
  };

  return (
    <div className="rounded-lg bg-surface-low p-4 glass-edge space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon
            name={CATEGORY_ICONS[category] ?? "circle"}
            size={16}
            className="text-text-muted"
          />
          <span className="text-sm font-semibold font-display">
            {CATEGORY_LABELS[category] ?? category}
          </span>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} />
      </div>

      <Select value={selectedChannel} onValueChange={handleChannelChange}>
        <SelectTrigger className="w-full text-sm">
          <SelectValue placeholder="Select log channel" />
        </SelectTrigger>
        <SelectContent>
          {channels.map((ch) => (
            <SelectItem key={ch.id} value={ch.id}>
              #{ch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex flex-wrap gap-1">
        {events.slice(0, 4).map((evt) => (
          <Badge key={evt} variant="secondary" className="text-xs">
            {evt}
          </Badge>
        ))}
        {events.length > 4 && (
          <Badge variant="outline" className="text-xs">
            +{events.length - 4} more
          </Badge>
        )}
      </div>

      {config && (
        <p className="text-xs text-text-muted">
          {config.enabled ? "Active" : "Disabled"}
          {config.ignoredChannels.length > 0 &&
            ` | ${config.ignoredChannels.length} ignored channel(s)`}
        </p>
      )}
    </div>
  );
}
