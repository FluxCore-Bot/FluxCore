import { useState, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { useRoles } from "../lib/hooks/useRoles";
import { useMusicSettings, useUpdateMusicSettings } from "../lib/hooks/useMusic";
import { toast } from "sonner";
import { ApiError } from "../lib/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Alert } from "./ui/alert";
import { Card } from "./ui/card";

export function MusicSettingsForm() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: settings, isLoading } = useMusicSettings(guildId);
  const { data: roles = [] } = useRoles(guildId);
  const updateSettings = useUpdateMusicSettings(guildId);

  const [mode, setMode] = useState<"open" | "library">("open");
  const [djRoleId, setDjRoleId] = useState<string | null>(null);
  const [defaultVolume, setDefaultVolume] = useState(50);
  const [maxQueueSize, setMaxQueueSize] = useState(100);
  const [autoDisconnectSecs, setAutoDisconnectSecs] = useState(300);
  const [twentyFourSeven, setTwentyFourSeven] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (settings) {
      setMode(settings.mode);
      setDjRoleId(settings.djRoleId);
      setDefaultVolume(settings.defaultVolume);
      setMaxQueueSize(settings.maxQueueSize);
      setAutoDisconnectSecs(settings.autoDisconnectSecs);
      setTwentyFourSeven(settings.twentyFourSeven);
    }
  }, [settings]);

  if (isLoading) return <p className="text-text-muted">Loading...</p>;

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
      });
      toast.success("Music settings updated");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    }
  };

  return (
    <Card className="p-6">
      <h3 className="mb-4 text-lg font-semibold">Playback Settings</h3>

      {error && (
        <Alert variant="destructive" className="mb-4">{error}</Alert>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <Label>Music Mode</Label>
          <select value={mode} onChange={(e) => setMode(e.target.value as "open" | "library")}>
            <option value="open">Open — Anyone can play anything</option>
            <option value="library">Library — Only curated tracks</option>
          </select>
        </div>

        <div>
          <Label>DJ Role</Label>
          <select value={djRoleId ?? ""} onChange={(e) => setDjRoleId(e.target.value || null)}>
            <option value="">None — All users can control playback</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>Default Volume: {defaultVolume}%</Label>
          <input
            type="range"
            min={0}
            max={100}
            value={defaultVolume}
            onChange={(e) => setDefaultVolume(Number(e.target.value))}
            className="w-full"
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

        <Button type="submit" disabled={updateSettings.isPending}>
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </Card>
  );
}
