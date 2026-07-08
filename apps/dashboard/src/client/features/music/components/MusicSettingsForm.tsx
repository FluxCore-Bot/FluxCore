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
  const { t } = useTranslation(["music", "common"]);
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

  const maxQueueSizeInvalid =
    !Number.isFinite(maxQueueSize) || maxQueueSize < 1 || maxQueueSize > 500;
  const autoDisconnectInvalid =
    !Number.isFinite(autoDisconnectSecs) ||
    autoDisconnectSecs < 0 ||
    autoDisconnectSecs > 3600;

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

    if (maxQueueSizeInvalid || autoDisconnectInvalid) {
      return;
    }

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
      setError(err instanceof ApiError ? err.message : t("common:accessibility.error"));
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
          <Label htmlFor="music-mode">{t("settings.musicMode")}</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as "open" | "library")}>
            <SelectTrigger id="music-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">{t("settings.open")}</SelectItem>
              <SelectItem value="library">{t("settings.library")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="music-dj-role">{t("settings.djRole")}</Label>
          <Select
            value={djRoleId ?? "none"}
            onValueChange={(v) => setDjRoleId(v === "none" ? null : v)}
          >
            <SelectTrigger id="music-dj-role">
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
          <Label id="music-default-volume-label">
            {t("settings.defaultVolume", { value: defaultVolume })}
          </Label>
          <Slider
            aria-labelledby="music-default-volume-label"
            value={[defaultVolume]}
            onValueChange={([v]) => setDefaultVolume(v)}
            min={0}
            max={100}
            step={1}
          />
        </div>

        <div>
          <Label htmlFor="music-max-queue-size">{t("settings.maxQueueSize")}</Label>
          <Input
            id="music-max-queue-size"
            type="number"
            min={1}
            max={500}
            value={maxQueueSize}
            onChange={(e) => setMaxQueueSize(Number(e.target.value))}
            aria-invalid={maxQueueSizeInvalid}
            aria-describedby={
              maxQueueSizeInvalid ? "music-max-queue-size-error" : undefined
            }
          />
          {maxQueueSizeInvalid && (
            <p
              id="music-max-queue-size-error"
              className="mt-1 text-xs text-danger"
            >
              {t("settings.maxQueueSize")} — {t("common:accessibility.error")}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="music-auto-disconnect">{t("settings.autoDisconnect")}</Label>
          <Input
            id="music-auto-disconnect"
            type="number"
            min={0}
            max={3600}
            value={autoDisconnectSecs}
            onChange={(e) => setAutoDisconnectSecs(Number(e.target.value))}
            aria-invalid={autoDisconnectInvalid}
            aria-describedby={
              autoDisconnectInvalid ? "music-auto-disconnect-error" : undefined
            }
          />
          {autoDisconnectInvalid && (
            <p
              id="music-auto-disconnect-error"
              className="mt-1 text-xs text-danger"
            >
              {t("settings.autoDisconnect")} — {t("common:accessibility.error")}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="music-24-7"
            checked={twentyFourSeven}
            onCheckedChange={setTwentyFourSeven}
          />
          <Label htmlFor="music-24-7" className="mb-0 text-sm">
            {t("settings.twentyFourSeven")}
          </Label>
        </div>

        {twentyFourSeven && (
          <div>
            <Label htmlFor="music-channel">{t("settings.musicChannel")}</Label>
            <Select
              value={lastChannelId ?? "none"}
              onValueChange={(v) => setLastChannelId(v === "none" ? null : v)}
            >
              <SelectTrigger id="music-channel">
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

        <Button
          type="submit"
          disabled={
            updateSettings.isPending ||
            maxQueueSizeInvalid ||
            autoDisconnectInvalid
          }
        >
          {updateSettings.isPending ? t("settings.saving") : t("settings.save")}
        </Button>
      </form>
    </Card>
  );
}
