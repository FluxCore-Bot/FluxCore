import { useState, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiError } from "../../../lib/client";
import { PageHeader } from "../../../components/PageHeader";
import {
  useWelcomeConfig,
  useUpdateWelcomeConfig,
  useTestWelcome,
  type EmbedConfig,
  type WelcomeImageSettings,
} from "../../../lib/hooks/useWelcome";
import { WelcomeImageEditor } from "../../../components/WelcomeImageEditor";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Card } from "../../../components/ui/card";
import { Switch } from "../../../components/ui/switch";
import { Separator } from "../../../components/ui/separator";
import { Textarea } from "../../../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";

const DEFAULT_WELCOME_IMAGE: WelcomeImageSettings = {
  template: "starter",
  background: { type: "color", color: "#1a1a2e" },
  overlay: { enabled: true, color: "#000000", opacity: 0.5 },
  avatar: { shape: "circle", borderColor: "#a3a6ff", borderWidth: 4, glowEnabled: false, glowColor: "#a3a6ff" },
  title: { font: "SpaceGrotesk", color: "#ffffff", size: 36 },
  subtitle: { font: "Inter", color: "#a3a6ff", size: 20, text: "Welcome to {server}!" },
  accentColor: "#a3a6ff",
  sendMode: "with",
};

const DEFAULT_FAREWELL_IMAGE: WelcomeImageSettings = {
  ...DEFAULT_WELCOME_IMAGE,
  subtitle: { font: "Inter", color: "#6b7280", size: 20, text: "Goodbye, {user.name}!" },
  accentColor: "#6b7280",
};

function EmbedEditor({
  value,
  onChange,
}: {
  value: EmbedConfig;
  onChange: (config: EmbedConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="embed-title">Title</Label>
        <Input
          id="embed-title"
          placeholder="Welcome to {server}!"
          value={value.title ?? ""}
          onChange={(e) => onChange({ ...value, title: e.target.value || undefined })}
        />
      </div>
      <div>
        <Label htmlFor="embed-description">Description</Label>
        <Textarea
          id="embed-description"
          placeholder="Hey {user}, welcome to **{server}**! You are member #{membercount}."
          value={value.description ?? ""}
          onChange={(e) => onChange({ ...value, description: e.target.value || undefined })}
          rows={3}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="embed-color">Color (hex)</Label>
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
          <Label htmlFor="embed-footer">Footer</Label>
          <Input
            id="embed-footer"
            placeholder="Footer text..."
            value={value.footer ?? ""}
            onChange={(e) => onChange({ ...value, footer: e.target.value || undefined })}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="embed-thumbnail">Thumbnail URL</Label>
          <Input
            id="embed-thumbnail"
            placeholder="{user.avatar}"
            value={value.thumbnail ?? ""}
            onChange={(e) => onChange({ ...value, thumbnail: e.target.value || undefined })}
          />
        </div>
        <div>
          <Label htmlFor="embed-image">Image URL</Label>
          <Input
            id="embed-image"
            placeholder="https://..."
            value={value.image ?? ""}
            onChange={(e) => onChange({ ...value, image: e.target.value || undefined })}
          />
        </div>
      </div>
      <p className="text-xs text-text-muted">
        Variables: {"{user}"} {"{user.tag}"} {"{user.name}"} {"{user.id}"} {"{user.avatar}"}{" "}
        {"{server}"} {"{server.id}"} {"{membercount}"} {"{server.icon}"}
      </p>
    </div>
  );
}

export function WelcomePage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: config, isLoading } = useWelcomeConfig(guildId);
  const updateConfig = useUpdateWelcomeConfig(guildId);
  const testWelcome = useTestWelcome(guildId);

  // Text message state
  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [welcomeChannelId, setWelcomeChannelId] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState<EmbedConfig>({});
  const [farewellEnabled, setFarewellEnabled] = useState(false);
  const [farewellChannelId, setFarewellChannelId] = useState("");
  const [farewellMessage, setFarewellMessage] = useState<EmbedConfig>({});
  const [dmEnabled, setDmEnabled] = useState(false);
  const [dmMessage, setDmMessage] = useState<EmbedConfig>({});
  const [autoRoleIds, setAutoRoleIds] = useState("");

  // Image state
  const [welcomeImageEnabled, setWelcomeImageEnabled] = useState(false);
  const [welcomeImageConfig, setWelcomeImageConfig] = useState<WelcomeImageSettings>(DEFAULT_WELCOME_IMAGE);
  const [farewellImageEnabled, setFarewellImageEnabled] = useState(false);
  const [farewellImageConfig, setFarewellImageConfig] = useState<WelcomeImageSettings>(DEFAULT_FAREWELL_IMAGE);

  // Sync from server
  useEffect(() => {
    if (config) {
      setWelcomeEnabled(config.welcomeEnabled);
      setWelcomeChannelId(config.welcomeChannelId ?? "");
      setWelcomeMessage(config.welcomeMessage);
      setFarewellEnabled(config.farewellEnabled);
      setFarewellChannelId(config.farewellChannelId ?? "");
      setFarewellMessage(config.farewellMessage);
      setDmEnabled(config.dmEnabled);
      setDmMessage(config.dmMessage);
      setAutoRoleIds(config.autoRoleIds.join(", "));
      setWelcomeImageEnabled(config.welcomeImageEnabled);
      setWelcomeImageConfig(config.welcomeImageConfig ?? DEFAULT_WELCOME_IMAGE);
      setFarewellImageEnabled(config.farewellImageEnabled);
      setFarewellImageConfig(config.farewellImageConfig ?? DEFAULT_FAREWELL_IMAGE);
    }
  }, [config]);

  function handleSave() {
    const roleIds = autoRoleIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    updateConfig.mutate(
      {
        welcomeEnabled,
        welcomeChannelId: welcomeChannelId || null,
        welcomeMessage,
        farewellEnabled,
        farewellChannelId: farewellChannelId || null,
        farewellMessage,
        dmEnabled,
        dmMessage,
        autoRoleIds: roleIds,
        welcomeImageEnabled,
        welcomeImageConfig,
        farewellImageEnabled,
        farewellImageConfig,
      },
      {
        onSuccess: () => toast.success("Welcome configuration saved"),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Failed to save configuration"),
      },
    );
  }

  function handleTest() {
    testWelcome.mutate(undefined, {
      onSuccess: (data) =>
        toast.success(`Test message will be sent to <#${data.channelId}>`),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to send test message"),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Welcome & Farewell"
          subtitle="Configure welcome and farewell messages for your server."
        />
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Welcome & Farewell"
        subtitle="Configure welcome and farewell messages, images, and auto-roles."
      />

      <Tabs defaultValue="welcome">
        <TabsList>
          <TabsTrigger value="welcome">Welcome</TabsTrigger>
          <TabsTrigger value="welcome-image">Welcome Image</TabsTrigger>
          <TabsTrigger value="farewell">Farewell</TabsTrigger>
          <TabsTrigger value="farewell-image">Farewell Image</TabsTrigger>
          <TabsTrigger value="dm">Welcome DM</TabsTrigger>
          <TabsTrigger value="autorole">Auto-Role</TabsTrigger>
        </TabsList>

        {/* Welcome Message */}
        <TabsContent value="welcome">
          <Card className="bg-surface p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Welcome Message</h3>
                <p className="text-sm text-text-muted">
                  Send a custom embed when a new member joins.
                </p>
              </div>
              <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} />
            </div>

            <Separator className="mb-6" />

            <div className="mb-6">
              <Label htmlFor="welcome-channel">Welcome Channel ID</Label>
              <Input
                id="welcome-channel"
                placeholder="Channel ID..."
                value={welcomeChannelId}
                onChange={(e) => setWelcomeChannelId(e.target.value)}
                className="mt-1 w-64"
              />
            </div>

            <h4 className="mb-3 text-sm font-semibold">Embed Builder</h4>
            <EmbedEditor value={welcomeMessage} onChange={setWelcomeMessage} />
          </Card>
        </TabsContent>

        {/* Welcome Image */}
        <TabsContent value="welcome-image">
          <Card className="bg-surface p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Welcome Image</h3>
                <p className="text-sm text-text-muted">
                  Generate a custom image card with the member's avatar when they join.
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
                Enable the toggle above to configure welcome images.
              </p>
            )}
          </Card>
        </TabsContent>

        {/* Farewell Message */}
        <TabsContent value="farewell">
          <Card className="bg-surface p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Farewell Message</h3>
                <p className="text-sm text-text-muted">
                  Send a message when a member leaves the server.
                </p>
              </div>
              <Switch checked={farewellEnabled} onCheckedChange={setFarewellEnabled} />
            </div>

            <Separator className="mb-6" />

            <div className="mb-6">
              <Label htmlFor="farewell-channel">Farewell Channel ID</Label>
              <Input
                id="farewell-channel"
                placeholder="Channel ID..."
                value={farewellChannelId}
                onChange={(e) => setFarewellChannelId(e.target.value)}
                className="mt-1 w-64"
              />
            </div>

            <h4 className="mb-3 text-sm font-semibold">Embed Builder</h4>
            <EmbedEditor value={farewellMessage} onChange={setFarewellMessage} />
          </Card>
        </TabsContent>

        {/* Farewell Image */}
        <TabsContent value="farewell-image">
          <Card className="bg-surface p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Farewell Image</h3>
                <p className="text-sm text-text-muted">
                  Generate a custom farewell card when a member leaves.
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
                Enable the toggle above to configure farewell images.
              </p>
            )}
          </Card>
        </TabsContent>

        {/* Welcome DM */}
        <TabsContent value="dm">
          <Card className="bg-surface p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Welcome DM</h3>
                <p className="text-sm text-text-muted">
                  Send a direct message to new members. Will silently fail if DMs are disabled.
                </p>
              </div>
              <Switch checked={dmEnabled} onCheckedChange={setDmEnabled} />
            </div>

            <Separator className="mb-6" />

            <h4 className="mb-3 text-sm font-semibold">Embed Builder</h4>
            <EmbedEditor value={dmMessage} onChange={setDmMessage} />
          </Card>
        </TabsContent>

        {/* Auto-Role */}
        <TabsContent value="autorole">
          <Card className="bg-surface p-6">
            <h3 className="mb-2 text-lg font-semibold">Auto-Role</h3>
            <p className="mb-4 text-sm text-text-muted">
              Automatically assign roles to new members when they join. Bots are excluded.
              The bot must have a role higher than the roles listed here.
            </p>

            <Separator className="mb-6" />

            <div>
              <Label htmlFor="autorole-ids">Role IDs (comma-separated)</Label>
              <Input
                id="autorole-ids"
                placeholder="123456789, 987654321"
                value={autoRoleIds}
                onChange={(e) => setAutoRoleIds(e.target.value)}
                className="mt-1"
              />
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={updateConfig.isPending}>
          {updateConfig.isPending ? "Saving..." : "Save Changes"}
        </Button>
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={testWelcome.isPending || !welcomeEnabled}
        >
          {testWelcome.isPending ? "Sending..." : "Send Test Message"}
        </Button>
      </div>
    </div>
  );
}
