import { useState, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { useChannels } from "../lib/hooks/useChannels";
import { useSettings, useUpdateSettings } from "../lib/hooks/useSettings";
import { useUiStore } from "../stores/uiStore";
import { ApiError } from "../lib/client";

export function SettingsForm() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: settings, isLoading } = useSettings(guildId);
  const { data: channels = [] } = useChannels(guildId);
  const updateSettings = useUpdateSettings(guildId);
  const addToast = useUiStore((s) => s.addToast);

  const [maxRules, setMaxRules] = useState(25);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [logChannelId, setLogChannelId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (settings) {
      setMaxRules(settings.maxRules);
      setGlobalEnabled(settings.globalEnabled);
      setLogChannelId(settings.logChannelId);
    }
  }, [settings]);

  if (isLoading) return <p className="text-text-muted">Loading...</p>;

  const textChannels = channels.filter((c) => c.type === 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (maxRules < 1 || maxRules > 100) {
      setError("Max rules must be between 1 and 100");
      return;
    }

    try {
      await updateSettings.mutateAsync({ maxRules, globalEnabled, logChannelId });
      addToast("Settings saved", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-6"
    >
      <h3 className="mb-4 text-lg font-semibold">Action System Settings</h3>

      {error && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="mb-1 block text-xs text-text-muted">
          Max Rules Per Guild
        </label>
        <input
          type="number"
          value={maxRules}
          onChange={(e) => setMaxRules(Number(e.target.value))}
          min={1}
          max={100}
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs text-text-muted">
          Log Channel (optional)
        </label>
        <select
          value={logChannelId ?? ""}
          onChange={(e) => setLogChannelId(e.target.value || null)}
        >
          <option value="">No log channel</option>
          {textChannels.map((c) => (
            <option key={c.id} value={c.id}>
              # {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <label className="relative inline-block h-5.5 w-10">
          <input
            type="checkbox"
            checked={globalEnabled}
            onChange={(e) => setGlobalEnabled(e.target.checked)}
            className="peer sr-only"
          />
          <span className="absolute inset-0 cursor-pointer rounded-full bg-border transition peer-checked:bg-accent" />
          <span className="absolute bottom-0.75 left-0.75 h-4 w-4 rounded-full bg-text transition peer-checked:translate-x-[18px]" />
        </label>
        <span className="text-sm text-text-muted">
          Global Enable (disable to pause all rules)
        </span>
      </div>

      <button
        type="submit"
        disabled={updateSettings.isPending}
        className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
      >
        {updateSettings.isPending ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}
