import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "@tanstack/react-router";
import { useChannels } from "../../../shared/hooks/useChannels";
import { useSettings, useUpdateSettings } from "../hooks/useSettings";
import { toast } from "sonner";
import { ApiError } from "../../../shared/lib/client";
import { Button } from "../../../shared/ui/button";
import { Input } from "../../../shared/ui/input";
import { Label } from "../../../shared/ui/label";
import { Switch } from "../../../shared/ui/switch";
import { Alert } from "../../../shared/ui/alert";
import { Card } from "../../../shared/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/ui/select";
import { FormSkeleton } from "../../../shared/ui/skeletons";

export function SettingsForm() {
  const { t } = useTranslation(["settings", "common"]);
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: settings, isLoading } = useSettings(guildId);
  const { data: channels = [] } = useChannels(guildId);
  const updateSettings = useUpdateSettings(guildId);

  const [maxRules, setMaxRules] = useState(25);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [logChannelId, setLogChannelId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const maxRulesInvalid =
    !Number.isFinite(maxRules) || maxRules < 1 || maxRules > 100;

  useEffect(() => {
    if (settings) {
      setMaxRules(settings.maxRules);
      setGlobalEnabled(settings.globalEnabled);
      setLogChannelId(settings.logChannelId);
    }
  }, [settings]);

  if (isLoading) return <FormSkeleton />;

  const textChannels = channels.filter((c) => c.type === 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (maxRulesInvalid) {
      return;
    }

    try {
      await updateSettings.mutateAsync({ maxRules, globalEnabled, logChannelId });
      toast.success(t("actionSystem.saved"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common:accessibility.error"));
    }
  };

  return (
    <Card className="p-6">
      <h3 className="mb-6 font-label text-lg font-semibold">{t("actionSystem.title")}</h3>

      {error && (
        <Alert variant="destructive" className="mb-4">{error}</Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label htmlFor="maxRules">{t("actionSystem.maxRules")}</Label>
          <Input
            id="maxRules"
            type="number"
            value={maxRules}
            onChange={(e) => setMaxRules(Number(e.target.value))}
            min={1}
            max={100}
            aria-invalid={maxRulesInvalid}
            aria-describedby={maxRulesInvalid ? "maxRules-error" : undefined}
          />
          {maxRulesInvalid && (
            <p id="maxRules-error" className="mt-1 text-xs text-danger">
              {t("actionSystem.maxRulesError")}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="settings-log-channel">{t("actionSystem.logChannel")}</Label>
          <Select
            value={logChannelId ?? "none"}
            onValueChange={(v) => setLogChannelId(v === "none" ? null : v)}
          >
            <SelectTrigger id="settings-log-channel">
              <SelectValue placeholder={t("actionSystem.noLogChannel")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("actionSystem.noLogChannel")}</SelectItem>
              {textChannels.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  # {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="settings-global-enable"
            checked={globalEnabled}
            onCheckedChange={setGlobalEnabled}
          />
          <Label htmlFor="settings-global-enable" className="mb-0 text-sm">
            {t("actionSystem.globalEnable")}
          </Label>
        </div>

        <Button
          type="submit"
          disabled={updateSettings.isPending || maxRulesInvalid}
        >
          {updateSettings.isPending ? t("actionSystem.saving") : t("actionSystem.save")}
        </Button>
      </form>
    </Card>
  );
}
