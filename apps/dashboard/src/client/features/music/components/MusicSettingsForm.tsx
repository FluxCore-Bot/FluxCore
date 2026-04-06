import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "@tanstack/react-router";
import { useRoles } from "../../../shared/hooks/useRoles";
import { useChannels } from "../../../shared/hooks/useChannels";
import { useMusicSettings, useUpdateMusicSettings } from "../hooks/useMusic";
import { toast } from "sonner";
import { ApiError } from "../../../shared/lib/client";
import { Button } from "../../../shared/ui/button";
import { Input } from "../../../shared/ui/input";
import { Label } from "../../../shared/ui/label";
import { Switch } from "../../../shared/ui/switch";
import { Alert } from "../../../shared/ui/alert";
import { Card } from "../../../shared/ui/card";
import { Slider } from "../../../shared/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/ui/select";
import { FormSkeleton } from "../../../shared/ui/skeletons";

export function MusicSettingsForm() {
  const { t } = useTranslation("music");
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

  if (isLoading) return <FormSkeleton />;

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
      toast.success(t("settings.updated"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    }
  };

  return (
    <Card className="p-6">
      <h3 className="mb-6 font-label text-lg font-semibold">{t("settings.playbackSettings")}</h3>

      {error && (
        <Alert variant="destructive" className="mb-4">{error}</Alert>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <Label>{t("settings.musicMode")}</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as "open" | "library")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">{t("settings.open")}</SelectItem>
              <SelectItem value="library">{t("settings.library")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>{t("settings.djRole")}</Label>
          <Select
            value={djRoleId ?? "none"}
            onValueChange={(v) => setDjRoleId(v === "none" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("settings.noDjRole")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("settings.noDjRole")}</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>{t("settings.defaultVolume", { value: defaultVolume })}</Label>
          <Slider
            value={[defaultVolume]}
            onValueChange={([v]) => setDefaultVolume(v)}
            min={0}
            max={100}
            step={1}
          />
        </div>

        <div>
          <Label>{t("settings.maxQueueSize")}</Label>
          <Input
            type="number"
            min={1}
            max={500}
            value={maxQueueSize}
            onChange={(e) => setMaxQueueSize(Number(e.target.value))}
          />
        </div>

        <div>
          <Label>{t("settings.autoDisconnect")}</Label>
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
            {t("settings.twentyFourSeven")}
          </Label>
        </div>

        {twentyFourSeven && (
          <div>
            <Label>{t("settings.musicChannel")}</Label>
            <Select
              value={lastChannelId ?? "none"}
              onValueChange={(v) => setLastChannelId(v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("settings.selectVoiceChannel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("settings.noneChannel")}</SelectItem>
                {voiceChannels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("settings.channelHint")}
            </p>
          </div>
        )}

        <Button type="submit" disabled={updateSettings.isPending}>
          {updateSettings.isPending ? t("settings.saving") : t("settings.save")}
        </Button>
      </form>
    </Card>
  );
}
