import { useState, useEffect, useCallback, useRef } from "react";
import {
  Image,
  Palette,
  Type,
  Circle,
  Upload,
  RefreshCw,
  Trash2,
  Sparkles,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Slider } from "./ui/slider";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  useWelcomeTemplates,
  useWelcomeFonts,
  useWelcomePresets,
  useWelcomeImagePreview,
  useUploadBackground,
  useDeleteBackground,
  type WelcomeImageSettings,
} from "../lib/hooks/useWelcome";

const PRESET_GRADIENT_COLORS: Record<string, string> = {
  midnight: "from-[#0f0c29] via-[#302b63] to-[#24243e]",
  ocean: "from-[#141e30] to-[#243b55]",
  sunset: "from-[#1a0a2e] via-[#6b2fa0] to-[#d4418e]",
  forest: "from-[#0a1a0a] via-[#1b4332] to-[#2d6a4f]",
  nebula: "from-[#16082b] via-[#4a1a7a] to-[#1a0a3e]",
  ember: "from-[#1a0a0a] via-[#7a1a1a] to-[#3e1a0a]",
};

interface WelcomeImageEditorProps {
  guildId: string;
  settings: WelcomeImageSettings;
  onChange: (settings: WelcomeImageSettings) => void;
  type: "welcome" | "farewell";
}

export function WelcomeImageEditor({
  guildId,
  settings,
  onChange,
  type,
}: WelcomeImageEditorProps) {
  const { data: templateData } = useWelcomeTemplates();
  const { data: fontData } = useWelcomeFonts();
  const { data: presetData } = useWelcomePresets();
  const preview = useWelcomeImagePreview(guildId);
  const uploadBg = useUploadBackground(guildId);
  const deleteBg = useDeleteBackground(guildId);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const templates = templateData?.templates ?? [];
  const fonts = fontData?.fonts ?? [];
  const presets = presetData?.backgrounds ?? [];

  // Auto-generate preview on settings change (debounced)
  const generatePreview = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      preview.mutate(
        { settings, type },
        {
          onSuccess: (url) => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(url);
          },
        },
      );
    }, 600);
  }, [settings, type]);

  useEffect(() => {
    generatePreview();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [generatePreview]);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  function update<K extends keyof WelcomeImageSettings>(
    key: K,
    value: WelcomeImageSettings[K],
  ) {
    onChange({ ...settings, [key]: value });
  }

  function updateNested<
    K extends keyof WelcomeImageSettings,
    V extends WelcomeImageSettings[K],
  >(key: K, field: keyof V & string, value: V[keyof V]) {
    onChange({
      ...settings,
      [key]: { ...((settings[key] ?? {}) as Record<string, unknown>), [field]: value },
    });
  }

  async function handleBackgroundUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      toast.error("Background image must be under 3 MB");
      return;
    }

    uploadBg.mutate(file, {
      onSuccess: (result) => {
        update("background", {
          ...settings.background,
          type: "image",
          imageKey: result.key,
        });
        toast.success("Background uploaded");
      },
      onError: () => toast.error("Failed to upload background"),
    });
  }

  function handleRemoveBackground() {
    if (settings.background.imageKey) {
      deleteBg.mutate(settings.background.imageKey);
    }
    update("background", {
      ...settings.background,
      type: "color",
      imageKey: undefined,
    });
  }

  return (
    <div className="space-y-6">
      {/* Live Preview */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Eye className="h-4 w-4 text-text-muted" />
          <Label className="text-sm font-semibold">Live Preview</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => generatePreview()}
            disabled={preview.isPending}
            className="ms-auto"
          >
            <RefreshCw className={`me-1 h-3 w-3 ${preview.isPending ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border border-border/50 bg-background">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={`${type} image preview`}
              className="w-full"
            />
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-text-muted">
              {preview.isPending ? "Generating preview..." : "Preview will appear here"}
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Template Selection */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Template</Label>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {templates.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => update("template", t.name)}
              className={`rounded-lg border p-3 text-start transition-all ${
                settings.template === t.name
                  ? "border-primary bg-primary/10"
                  : "border-border/50 hover:border-border"
              }`}
            >
              <span className="text-sm font-medium">{t.displayName}</span>
              <p className="mt-0.5 text-xs text-text-muted line-clamp-2">
                {t.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Background */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Image className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Background</Label>
        </div>

        <div className="mb-4 flex gap-2">
          {(["color", "preset", "image"] as const).map((bgType) => (
            <Button
              key={bgType}
              variant={settings.background.type === bgType ? "default" : "outline"}
              size="sm"
              onClick={() =>
                update("background", { ...settings.background, type: bgType })
              }
            >
              {bgType === "color" && "Solid Color"}
              {bgType === "preset" && "Gradient"}
              {bgType === "image" && "Custom Image"}
            </Button>
          ))}
        </div>

        {settings.background.type === "color" && (
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.background.color}
              onChange={(e) =>
                updateNested("background", "color", e.target.value)
              }
              className="h-10 w-10 cursor-pointer rounded border border-border/50"
            />
            <Input
              value={settings.background.color}
              onChange={(e) =>
                updateNested("background", "color", e.target.value)
              }
              className="w-28"
              placeholder="#1a1a2e"
            />
          </div>
        )}

        {settings.background.type === "preset" && (
          <div className="grid grid-cols-3 gap-2">
            {presets.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() =>
                  update("background", {
                    ...settings.background,
                    type: "preset",
                    preset: name,
                  })
                }
                className={`h-16 rounded-lg border bg-gradient-to-br transition-all ${
                  PRESET_GRADIENT_COLORS[name] ?? ""
                } ${
                  settings.background.preset === name
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border/50 hover:border-border"
                }`}
              >
                <span className="text-xs font-medium capitalize text-white/80">
                  {name}
                </span>
              </button>
            ))}
          </div>
        )}

        {settings.background.type === "image" && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleBackgroundUpload}
              className="hidden"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadBg.isPending}
              >
                <Upload className="mr-1 h-3 w-3" />
                {uploadBg.isPending ? "Uploading..." : "Upload Image"}
              </Button>
              {settings.background.imageKey && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveBackground}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Remove
                </Button>
              )}
            </div>
            {settings.background.imageKey && (
              <Badge variant="outline" className="text-xs">
                Background set
              </Badge>
            )}
            <p className="text-xs text-text-muted">
              JPG, PNG, or WebP. Max 3 MB.
            </p>
          </div>
        )}
      </div>

      {/* Overlay */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <Label className="text-sm font-semibold">Overlay Darkening</Label>
          <Switch
            checked={settings.overlay.enabled}
            onCheckedChange={(v) => updateNested("overlay", "enabled", v)}
          />
        </div>
        {settings.overlay.enabled && (
          <div className="flex items-center gap-4">
            <span className="text-xs text-text-muted">Opacity</span>
            <Slider
              value={[settings.overlay.opacity * 100]}
              onValueChange={([v]) =>
                updateNested("overlay", "opacity", v / 100)
              }
              max={100}
              step={5}
              className="flex-1"
            />
            <span className="w-8 text-xs text-text-muted">
              {Math.round(settings.overlay.opacity * 100)}%
            </span>
          </div>
        )}
      </div>

      <Separator />

      {/* Avatar */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Circle className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Avatar</Label>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Shape</Label>
            <Select
              value={settings.avatar.shape}
              onValueChange={(v) =>
                updateNested("avatar", "shape", v as "circle" | "rounded" | "square")
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="circle">Circle</SelectItem>
                <SelectItem value="rounded">Rounded Square</SelectItem>
                <SelectItem value="square">Square</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Border Width</Label>
            <Slider
              value={[settings.avatar.borderWidth]}
              onValueChange={([v]) => updateNested("avatar", "borderWidth", v)}
              max={12}
              step={1}
              className="mt-3"
            />
          </div>
          <div>
            <Label className="text-xs">Border Color</Label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={settings.avatar.borderColor}
                onChange={(e) =>
                  updateNested("avatar", "borderColor", e.target.value)
                }
                className="h-8 w-8 cursor-pointer rounded"
              />
              <Input
                value={settings.avatar.borderColor}
                onChange={(e) =>
                  updateNested("avatar", "borderColor", e.target.value)
                }
                className="w-28"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Glow Effect</Label>
              <Switch
                checked={settings.avatar.glowEnabled}
                onCheckedChange={(v) =>
                  updateNested("avatar", "glowEnabled", v)
                }
              />
            </div>
            {settings.avatar.glowEnabled && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  value={settings.avatar.glowColor}
                  onChange={(e) =>
                    updateNested("avatar", "glowColor", e.target.value)
                  }
                  className="h-8 w-8 cursor-pointer rounded"
                />
                <Input
                  value={settings.avatar.glowColor}
                  onChange={(e) =>
                    updateNested("avatar", "glowColor", e.target.value)
                  }
                  className="w-28"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Typography */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Type className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Typography</Label>
        </div>

        {/* Title (Username) */}
        <div className="mb-4">
          <Label className="text-xs text-text-muted">Title (Username)</Label>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Font</Label>
              <Select
                value={settings.title.font}
                onValueChange={(v) => updateNested("title", "font", v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fonts.map((f) => (
                    <SelectItem key={f.name} value={f.name}>
                      {f.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Color</Label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={settings.title.color}
                  onChange={(e) => updateNested("title", "color", e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded"
                />
                <Input
                  value={settings.title.color}
                  onChange={(e) => updateNested("title", "color", e.target.value)}
                  className="w-24"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Size</Label>
              <Slider
                value={[settings.title.size]}
                onValueChange={([v]) => updateNested("title", "size", v)}
                min={16}
                max={56}
                step={2}
                className="mt-3"
              />
            </div>
          </div>
        </div>

        {/* Subtitle (Custom text) */}
        <div>
          <Label className="text-xs text-text-muted">Subtitle (Custom Text)</Label>
          <div className="mt-2 space-y-3">
            <div>
              <Label className="text-xs">Text</Label>
              <Input
                value={settings.subtitle.text}
                onChange={(e) => updateNested("subtitle", "text", e.target.value)}
                placeholder="Welcome to {server}!"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-text-muted">
                Variables: {"{user.name}"} {"{server}"} {"{membercount}"}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">Font</Label>
                <Select
                  value={settings.subtitle.font}
                  onValueChange={(v) => updateNested("subtitle", "font", v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fonts.map((f) => (
                      <SelectItem key={f.name} value={f.name}>
                        {f.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Color</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.subtitle.color}
                    onChange={(e) =>
                      updateNested("subtitle", "color", e.target.value)
                    }
                    className="h-8 w-8 cursor-pointer rounded"
                  />
                  <Input
                    value={settings.subtitle.color}
                    onChange={(e) =>
                      updateNested("subtitle", "color", e.target.value)
                    }
                    className="w-24"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Size</Label>
                <Slider
                  value={[settings.subtitle.size]}
                  onValueChange={([v]) => updateNested("subtitle", "size", v)}
                  min={12}
                  max={36}
                  step={1}
                  className="mt-3"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Accent Color & Delivery */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <Label className="text-sm font-semibold">Accent Color</Label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.accentColor}
              onChange={(e) => update("accentColor", e.target.value)}
              className="h-10 w-10 cursor-pointer rounded border border-border/50"
            />
            <Input
              value={settings.accentColor}
              onChange={(e) => update("accentColor", e.target.value)}
              className="w-28"
            />
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Used for decorations, borders, and template accents.
          </p>
        </div>

        <div>
          <Label className="mb-2 text-sm font-semibold">Delivery Mode</Label>
          <Select
            value={settings.sendMode}
            onValueChange={(v) =>
              update("sendMode", v as "with" | "before" | "only")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="with">With embed message</SelectItem>
              <SelectItem value="before">Before embed message</SelectItem>
              <SelectItem value="only">Image only (no embed)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
