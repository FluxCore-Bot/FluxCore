import { useState, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { useRoles } from "../lib/hooks/useRoles";
import { useMusicSettings, useUpdateMusicSettings } from "../lib/hooks/useMusic";
import { useUiStore } from "../stores/uiStore";
import { ApiError } from "../lib/client";

export function MusicSettingsForm() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: settings, isLoading } = useMusicSettings(guildId);
  const { data: roles = [] } = useRoles(guildId);
  const updateSettings = useUpdateMusicSettings(guildId);
  const addToast = useUiStore((s) => s.addToast);

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
      addToast("Music settings updated", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Music Settings</h3>
        <p className="text-sm text-text-muted">
          Configure music playback settings for your server.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-text-muted">Music Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as "open" | "library")}>
            <option value="open">Open — Anyone can play anything</option>
            <option value="library">Library — Only curated tracks</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-text-muted">DJ Role</label>
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
          <label className="mb-1 block text-xs text-text-muted">
            Default Volume: {defaultVolume}%
          </label>
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
          <label className="mb-1 block text-xs text-text-muted">Max Queue Size</label>
          <input
            type="number"
            min={1}
            max={500}
            value={maxQueueSize}
            onChange={(e) => setMaxQueueSize(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-text-muted">
            Auto-Disconnect (seconds, 0 = disabled)
          </label>
          <input
            type="number"
            min={0}
            max={3600}
            value={autoDisconnectSecs}
            onChange={(e) => setAutoDisconnectSecs(Number(e.target.value))}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="twentyFourSeven"
            checked={twentyFourSeven}
            onChange={(e) => setTwentyFourSeven(e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="twentyFourSeven" className="text-sm">
            24/7 Mode — Bot stays in voice channel when idle
          </label>
        </div>

        <button
          type="submit"
          disabled={updateSettings.isPending}
          className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
