import { useState, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { useChannels } from "../lib/hooks/useChannels";
import { useSettings, useUpdateSettings } from "../lib/hooks/useSettings";
import { toast } from "sonner";
import { ApiError } from "../lib/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Alert } from "./ui/alert";
import { Card } from "./ui/card";

export function SettingsForm() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: settings, isLoading } = useSettings(guildId);
  const { data: channels = [] } = useChannels(guildId);
  const updateSettings = useUpdateSettings(guildId);

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
      toast.success("Settings saved");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    }
  };

  return (
    <Card className="p-6">
      <h3 className="mb-4 text-lg font-semibold">Action System Settings</h3>

      {error && (
        <Alert variant="destructive" className="mb-4">{error}</Alert>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <Label htmlFor="maxRules">Max Rules Per Guild</Label>
          <Input
            id="maxRules"
            type="number"
            value={maxRules}
            onChange={(e) => setMaxRules(Number(e.target.value))}
            min={1}
            max={100}
          />
        </div>

        <div className="mb-4">
          <Label htmlFor="logChannel">Log Channel (optional)</Label>
          <select
            id="logChannel"
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
          <Switch
            checked={globalEnabled}
            onCheckedChange={setGlobalEnabled}
          />
          <Label className="mb-0 text-sm">
            Global Enable (disable to pause all rules)
          </Label>
        </div>

        <Button type="submit" disabled={updateSettings.isPending}>
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </Card>
  );
}
