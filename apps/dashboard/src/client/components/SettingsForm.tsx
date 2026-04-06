import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { PageSkeleton } from "./PageSkeleton";
import { ConfirmDialog } from "./ConfirmDialog";

export function SettingsForm() {
  const { t } = useTranslation("settings");
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: settings, isLoading } = useSettings(guildId);
  const { data: channels = [] } = useChannels(guildId);
  const updateSettings = useUpdateSettings(guildId);

  const [maxRules, setMaxRules] = useState(25);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [logChannelId, setLogChannelId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notifyRuleTriggered, setNotifyRuleTriggered] = useState(true);
  const [notifyErrors, setNotifyErrors] = useState(true);
  const [notifySuccess, setNotifySuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (settings) {
      setMaxRules(settings.maxRules);
      setGlobalEnabled(settings.globalEnabled);
      setLogChannelId(settings.logChannelId);
    }
  }, [settings]);

  if (isLoading) return <PageSkeleton />;

  const textChannels = channels.filter((c) => c.type === 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (maxRules < 1 || maxRules > 100) {
      setError(t("actionSystem.maxRulesError"));
      return;
    }

    try {
      await updateSettings.mutateAsync({ maxRules, globalEnabled, logChannelId });
      toast.success(t("actionSystem.saved"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("actionSystem.maxRulesError"));
    }
  };

  return (
    <>
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
          />
        </div>

        <div>
          <Label>{t("actionSystem.logChannel")}</Label>
          <Select
            value={logChannelId ?? "none"}
            onValueChange={(v) => setLogChannelId(v === "none" ? null : v)}
          >
            <SelectTrigger>
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
            checked={globalEnabled}
            onCheckedChange={setGlobalEnabled}
          />
          <Label className="mb-0 text-sm">
            {t("actionSystem.globalEnable")}
          </Label>
        </div>

        <Button type="submit" disabled={updateSettings.isPending}>
          {updateSettings.isPending ? t("actionSystem.saving") : t("actionSystem.save")}
        </Button>
      </form>
    </Card>

    {/* Notification Preferences */}
    <Card className="mt-6 p-6">
      <h3 className="mb-6 font-label text-lg font-semibold">{t("notifications.title")}</h3>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch
            checked={notifyRuleTriggered}
            onCheckedChange={setNotifyRuleTriggered}
          />
          <Label className="mb-0 text-sm">{t("notifications.ruleTriggered")}</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={notifyErrors}
            onCheckedChange={setNotifyErrors}
          />
          <Label className="mb-0 text-sm">{t("notifications.errorAlerts")}</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={notifySuccess}
            onCheckedChange={setNotifySuccess}
          />
          <Label className="mb-0 text-sm">{t("notifications.successReports")}</Label>
        </div>
      </div>
    </Card>

    {/* Danger Zone */}
    <Card className="mt-6 border border-danger/20 p-6">
      <h3 className="mb-2 font-label text-lg font-semibold text-danger">{t("dangerZone.title")}</h3>
      <p className="mb-4 text-sm text-text-muted">
        {t("dangerZone.description")}
      </p>
      <Button
        variant="destructive"
        onClick={() => setShowDeleteConfirm(true)}
      >
        {t("dangerZone.deleteAllRules")}
      </Button>
    </Card>

    <ConfirmDialog
      open={showDeleteConfirm}
      onOpenChange={setShowDeleteConfirm}
      title={t("dangerZone.deleteAllConfirm")}
      description={t("dangerZone.description")}
      confirmLabel={t("dangerZone.deleteAllRules")}
      destructive
      onConfirm={() => {
        toast.info(t("dangerZone.notImplemented"));
      }}
    />
  </>
  );
}
