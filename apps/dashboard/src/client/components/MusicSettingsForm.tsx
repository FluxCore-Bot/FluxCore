import { useState, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { useRoles } from "../lib/hooks/useRoles";
import { useChannels } from "../lib/hooks/useChannels";
import { useMusicSettings, useUpdateMusicSettings } from "../lib/hooks/useMusic";
import { toast } from "sonner";
import { ApiError } from "../lib/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Alert } from "./ui/alert";
import { Card } from "./ui/card";
import { Slider } from "./ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { PageSkeleton } from "./PageSkeleton";

export function MusicSettingsForm() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: settings, isLoading } = useMusicSettings(guildId);
  const { data: roles = [] } = useRoles(guildId);
  const { data: channels = [] } = useChannels(guildId);
  const updateSettings = useUpdateMusicSettings(guildId);

  const [mode, setMode] = useState<"open" | "library">("open");
  const [djRoleId, setDjRoleId] = useState<string | null>(null);
  const [defaultVolume, setDefaultVolume] = useState(50);
  const [maxQueueSize, setMaxQueueSize] = useState(100);
  const [autoDisconnectSecs, setAutoDisconnectSecs] = useState(300);
  const [twentyFourSeven, setTwentyFourSeven] = useState(false);
  const [lastChannelId, setLastChannelId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const voiceChannels = channels.filter((c) => c.type === 2);

  useEffect(() => {
    if (settings) {
      setMode(settings.mode);
      setDjRoleId(settings.djRoleId);
      setDefaultVolume(settings.defaultVolume);
      setMaxQueueSize(settings.maxQueueSize);
      setAutoDisconnectSecs(settings.autoDisconnectSecs);
      setTwentyFourSeven(settings.twentyFourSeven);
      setLastChannelId(settings.lastChannelId);
    }
  }, [settings]);

  if (isLoading) return <PageSkeleton />;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await updateSettings.mutateAsync({
        mode,
        djRoleId,
        defaultVolume,
        maxQueueSize,
        autoDisconnectSecs,
        twentyFourSeven,
        lastChannelId: twentyFourSeven ? lastChannelId : null,
      });
      toast.success("Music settings updated");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    }
  };

  return (
    <Card className="p-6">
      <h3 className="mb-6 text-lg font-semibold">Playback Settings</h3>

      {error && (
        <Alert variant="destructive" className="mb-4">{error}</Alert>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <Label>Music Mode</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as "open" | "library")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open — Anyone can play anything</SelectItem>
              <SelectItem value="library">Library — Only curated tracks</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>DJ Role</Label>
          <Select
            value={djRoleId ?? "none"}
            onValueChange={(v) => setDjRoleId(v === "none" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="None — All users can control playback" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None — All users can control playback</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Default Volume: {defaultVolume}%</Label>
          <Slider
            value={[defaultVolume]}
            onValueChange={([v]) => setDefaultVolume(v)}
            min={0}
            max={100}
            step={1}
          />
        </div>

        <div>
          <Label>Max Queue Size</Label>
          <Input
            type="number"
            min={1}
            max={500}
            value={maxQueueSize}
            onChange={(e) => setMaxQueueSize(Number(e.target.value))}
          />
        </div>

        <div>
          <Label>Auto-Disconnect (seconds, 0 = disabled)</Label>
          <Input
            type="number"
            min={0}
            max={3600}
            value={autoDisconnectSecs}
            onChange={(e) => setAutoDisconnectSecs(Number(e.target.value))}
          />
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={twentyFourSeven}
            onCheckedChange={setTwentyFourSeven}
          />
          <Label className="mb-0 text-sm">
            24/7 Mode — Bot stays in voice channel when idle
          </Label>
        </div>

        {twentyFourSeven && (
          <div>
            <Label>Music Voice Channel</Label>
            <Select
              value={lastChannelId ?? "none"}
              onValueChange={(v) => setLastChannelId(v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a voice channel..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None — Select a channel</SelectItem>
                {voiceChannels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              The bot will automatically join this channel on startup.
            </p>
          </div>
        )}

        <Button type="submit" disabled={updateSettings.isPending}>
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </Card>
  );
}
