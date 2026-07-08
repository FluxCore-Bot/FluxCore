import { useState, useEffect, useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ApiError } from "../../../shared/lib/client";
import { PageHeader } from "../../../shared/components/PageHeader";
import {
  useWelcomeConfig,
  useUpdateWelcomeConfig,
  useTestWelcome,
  type EmbedConfig,
  type WelcomeImageSettings,
} from "../../../features/welcome/hooks/useWelcome";
import { WelcomeImageEditor } from "../../../features/welcome/components/WelcomeImageEditor";
import { Button } from "../../../shared/ui/button";
import { Input } from "../../../shared/ui/input";
import { DiscordSelect } from "../../../shared/ui/discord-select";
import { DiscordMultiSelect } from "../../../shared/ui/discord-multi-select";
import { Label } from "../../../shared/ui/label";
import { Card } from "../../../shared/ui/card";
import { Switch } from "../../../shared/ui/switch";
import { Separator } from "../../../shared/ui/separator";
import { Textarea } from "../../../shared/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/ui/tabs";
import { FormSkeleton } from "../../../shared/ui/skeletons";
import type { TFunction } from "i18next";

function createDefaultWelcomeImage(t: TFunction<"welcome">): WelcomeImageSettings {
  return {
    template: "starter",
    background: { type: "color", color: "#1a1a2e" },
    overlay: { enabled: true, color: "#000000", opacity: 0.5 },
    avatar: { shape: "circle", borderColor: "#a3a6ff", borderWidth: 4, glowEnabled: false, glowColor: "#a3a6ff" },
    title: { font: "SpaceGrotesk", color: "#ffffff", size: 36 },
    subtitle: { font: "Inter", color: "#a3a6ff", size: 20, text: t("defaults.welcomeSubtitle") },
    accentColor: "#a3a6ff",
    sendMode: "with",
  };
}

function createDefaultFarewellImage(t: TFunction<"welcome">): WelcomeImageSettings {
  return {
    ...createDefaultWelcomeImage(t),
    subtitle: { font: "Inter", color: "#6b7280", size: 20, text: t("defaults.farewellSubtitle") },
    accentColor: "#6b7280",
  };
}

function EmbedEditor({
  value,
  onChange,
  t,
}: {
  value: EmbedConfig;
  onChange: (config: EmbedConfig) => void;
  t: TFunction<"welcome">;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="embed-title">{t("embed.title")}</Label>
        <Input
          id="embed-title"
          placeholder={t("embed.titlePlaceholder")}
          value={value.title ?? ""}
          onChange={(e) => onChange({ ...value, title: e.target.value || undefined })}
        />
      </div>
      <div>
        <Label htmlFor="embed-description">{t("embed.description")}</Label>
        <Textarea
          id="embed-description"
          placeholder={t("embed.descriptionPlaceholder")}
          value={value.description ?? ""}
          onChange={(e) => onChange({ ...value, description: e.target.value || undefined })}
          rows={3}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="embed-color">{t("embed.color")}</Label>
          <Input
            id="embed-color"
            type="text"
            placeholder="#a3a6ff"
            value={value.color !== undefined ? `#${value.color.toString(16).padStart(6, "0")}` : ""}
            onChange={(e) => {
              const hex = e.target.value.replace("#", "");
              const num = parseInt(hex, 16);
              onChange({ ...value, color: Number.isFinite(num) ? num : undefined });
            }}
          />
        </div>
        <div>
          <Label htmlFor="embed-footer">{t("embed.footer")}</Label>
          <Input
            id="embed-footer"
            placeholder={t("embed.footerPlaceholder")}
            value={value.footer ?? ""}
            onChange={(e) => onChange({ ...value, footer: e.target.value || undefined })}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="embed-thumbnail">{t("embed.thumbnail")}</Label>
          <Input
            id="embed-thumbnail"
            placeholder="{user.avatar}"
            value={value.thumbnail ?? ""}
            onChange={(e) => onChange({ ...value, thumbnail: e.target.value || undefined })}
          />
        </div>
        <div>
          <Label htmlFor="embed-image">{t("embed.image")}</Label>
          <Input
            id="embed-image"
            placeholder="https://..."
            value={value.image ?? ""}
            onChange={(e) => onChange({ ...value, image: e.target.value || undefined })}
          />
        </div>
      </div>
      <p className="text-xs text-text-muted">
        {t("embed.variables")} {"{user}"} {"{user.tag}"} {"{user.name}"} {"{user.id}"} {"{user.avatar}"}{" "}
        {"{server}"} {"{server.id}"} {"{membercount}"} {"{server.icon}"}
      </p>
    </div>
  );
}

export function WelcomePage() {
  const { t } = useTranslation("welcome");
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: config, isLoading } = useWelcomeConfig(guildId);
  const updateConfig = useUpdateWelcomeConfig(guildId);
  const testWelcome = useTestWelcome(guildId);

  const defaultWelcomeImage = useMemo(() => createDefaultWelcomeImage(t), [t]);
  const defaultFarewellImage = useMemo(() => createDefaultFarewellImage(t), [t]);

  // Text message state
  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [welcomeChannelId, setWelcomeChannelId] = useState<string | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<EmbedConfig>({});
  const [farewellEnabled, setFarewellEnabled] = useState(false);
  const [farewellChannelId, setFarewellChannelId] = useState<string | null>(null);
  const [farewellMessage, setFarewellMessage] = useState<EmbedConfig>({});
  const [dmEnabled, setDmEnabled] = useState(false);
  const [dmMessage, setDmMessage] = useState<EmbedConfig>({});
  const [autoRoleIds, setAutoRoleIds] = useState<string[]>([]);

  // Image state
  const [welcomeImageEnabled, setWelcomeImageEnabled] = useState(false);
  const [welcomeImageConfig, setWelcomeImageConfig] = useState<WelcomeImageSettings>(defaultWelcomeImage);
  const [farewellImageEnabled, setFarewellImageEnabled] = useState(false);
  const [farewellImageConfig, setFarewellImageConfig] = useState<WelcomeImageSettings>(defaultFarewellImage);

  // Sync from server
  useEffect(() => {
    if (config) {
      setWelcomeEnabled(config.welcomeEnabled);
      setWelcomeChannelId(config.welcomeChannelId ?? null);
      setWelcomeMessage(config.welcomeMessage);
      setFarewellEnabled(config.farewellEnabled);
      setFarewellChannelId(config.farewellChannelId ?? null);
      setFarewellMessage(config.farewellMessage);
      setDmEnabled(config.dmEnabled);
      setDmMessage(config.dmMessage);
      setAutoRoleIds(config.autoRoleIds);
      setWelcomeImageEnabled(config.welcomeImageEnabled);
      setWelcomeImageConfig(config.welcomeImageConfig ?? defaultWelcomeImage);
      setFarewellImageEnabled(config.farewellImageEnabled);
      setFarewellImageConfig(config.farewellImageConfig ?? defaultFarewellImage);
    }
  }, [config, defaultWelcomeImage, defaultFarewellImage]);

  function handleSave() {
    updateConfig.mutate(
      {
        welcomeEnabled,
        welcomeChannelId: welcomeChannelId,
        welcomeMessage,
        farewellEnabled,
        farewellChannelId: farewellChannelId,
        farewellMessage,
        dmEnabled,
        dmMessage,
        autoRoleIds: autoRoleIds,
        welcomeImageEnabled,
        welcomeImageConfig,
        farewellImageEnabled,
        farewellImageConfig,
      },
      {
        onSuccess: () => toast.success(t("toast.saved")),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.saveFailed")),
      },
    );
  }

  function handleTest() {
    testWelcome.mutate(undefined, {
      onSuccess: (data) =>
        toast.success(t("toast.testSent", { channelId: data.channelId })),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : t("toast.testFailed")),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <PageHeader
          title={t("title")}
          subtitle={t("loadingSubtitle")}
        />
        <FormSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <Tabs defaultValue="welcome">
        <TabsList>
          <TabsTrigger value="welcome">{t("tabs.welcome")}</TabsTrigger>
          <TabsTrigger value="welcome-image">{t("tabs.welcomeImage")}</TabsTrigger>
          <TabsTrigger value="farewell">{t("tabs.farewell")}</TabsTrigger>
          <TabsTrigger value="farewell-image">{t("tabs.farewellImage")}</TabsTrigger>
          <TabsTrigger value="dm">{t("tabs.dm")}</TabsTrigger>
          <TabsTrigger value="autorole">{t("tabs.autorole")}</TabsTrigger>
        </TabsList>

        {/* Welcome Message */}
        <TabsContent value="welcome">
          <Card className="bg-surface-container p-6 glass-edge">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="font-label text-lg font-semibold">{t("welcome.title")}</h3>
                <p className="text-sm text-text-muted">
                  {t("welcome.description")}
                </p>
              </div>
              <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} />
            </div>

            <Separator className="mb-6" />

            <div className="mb-6">
              <Label htmlFor="welcome-channel">{t("welcome.channelLabel")}</Label>
              <DiscordSelect
                guildId={guildId}
                type="text"
                value={welcomeChannelId}
                onValueChange={setWelcomeChannelId}
                placeholder={t("welcome.channelPlaceholder")}
                allowNone
                className="mt-1 w-64"
              />
            </div>

            <h4 className="mb-3 font-label text-sm font-semibold">{t("welcome.embedBuilder")}</h4>
            <EmbedEditor value={welcomeMessage} onChange={setWelcomeMessage} t={t} />
          </Card>
        </TabsContent>

        {/* Welcome Image */}
        <TabsContent value="welcome-image">
          <Card className="bg-surface-container p-6 glass-edge">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="font-label text-lg font-semibold">{t("welcomeImage.title")}</h3>
                <p className="text-sm text-text-muted">
                  {t("welcomeImage.description")}
                </p>
              </div>
              <Switch
                checked={welcomeImageEnabled}
                onCheckedChange={setWelcomeImageEnabled}
              />
            </div>

            <Separator className="mb-6" />

            {welcomeImageEnabled && (
              <WelcomeImageEditor
                guildId={guildId}
                settings={welcomeImageConfig}
                onChange={setWelcomeImageConfig}
                type="welcome"
              />
            )}

            {!welcomeImageEnabled && (
              <p className="text-sm text-text-muted">
                {t("welcomeImage.disabled")}
              </p>
            )}
          </Card>
        </TabsContent>

        {/* Farewell Message */}
        <TabsContent value="farewell">
          <Card className="bg-surface-container p-6 glass-edge">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="font-label text-lg font-semibold">{t("farewell.title")}</h3>
                <p className="text-sm text-text-muted">
                  {t("farewell.description")}
                </p>
              </div>
              <Switch checked={farewellEnabled} onCheckedChange={setFarewellEnabled} />
            </div>

            <Separator className="mb-6" />

            <div className="mb-6">
              <Label htmlFor="farewell-channel">{t("farewell.channelLabel")}</Label>
              <DiscordSelect
                guildId={guildId}
                type="text"
                value={farewellChannelId}
                onValueChange={setFarewellChannelId}
                placeholder={t("farewell.channelPlaceholder")}
                allowNone
                className="mt-1 w-64"
              />
            </div>

            <h4 className="mb-3 font-label text-sm font-semibold">{t("welcome.embedBuilder")}</h4>
            <EmbedEditor value={farewellMessage} onChange={setFarewellMessage} t={t} />
          </Card>
        </TabsContent>

        {/* Farewell Image */}
        <TabsContent value="farewell-image">
          <Card className="bg-surface-container p-6 glass-edge">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="font-label text-lg font-semibold">{t("farewellImage.title")}</h3>
                <p className="text-sm text-text-muted">
                  {t("farewellImage.description")}
                </p>
              </div>
              <Switch
                checked={farewellImageEnabled}
                onCheckedChange={setFarewellImageEnabled}
              />
            </div>

            <Separator className="mb-6" />

            {farewellImageEnabled && (
              <WelcomeImageEditor
                guildId={guildId}
                settings={farewellImageConfig}
                onChange={setFarewellImageConfig}
                type="farewell"
              />
            )}

            {!farewellImageEnabled && (
              <p className="text-sm text-text-muted">
                {t("farewellImage.disabled")}
              </p>
            )}
          </Card>
        </TabsContent>

        {/* Welcome DM */}
        <TabsContent value="dm">
          <Card className="bg-surface-container p-6 glass-edge">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="font-label text-lg font-semibold">{t("dm.title")}</h3>
                <p className="text-sm text-text-muted">
                  {t("dm.description")}
                </p>
              </div>
              <Switch checked={dmEnabled} onCheckedChange={setDmEnabled} />
            </div>

            <Separator className="mb-6" />

            <h4 className="mb-3 font-label text-sm font-semibold">{t("welcome.embedBuilder")}</h4>
            <EmbedEditor value={dmMessage} onChange={setDmMessage} t={t} />
          </Card>
        </TabsContent>

        {/* Auto-Role */}
        <TabsContent value="autorole">
          <Card className="bg-surface-container p-6 glass-edge">
            <h3 className="mb-2 font-label text-lg font-semibold">{t("autorole.title")}</h3>
            <p className="mb-4 text-sm text-text-muted">
              {t("autorole.description")}
            </p>

            <Separator className="mb-6" />

            <div>
              <Label htmlFor="autorole-ids">{t("autorole.label")}</Label>
              <DiscordMultiSelect
                guildId={guildId}
                type="role"
                selectedIds={autoRoleIds}
                onChange={setAutoRoleIds}
                placeholder={t("autorole.placeholder")}
              />
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={updateConfig.isPending}>
          {updateConfig.isPending ? t("saving") : t("saveChanges")}
        </Button>
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={testWelcome.isPending || !welcomeEnabled}
        >
          {testWelcome.isPending ? t("sending") : t("sendTest")}
        </Button>
      </div>
    </div>
  );
}
