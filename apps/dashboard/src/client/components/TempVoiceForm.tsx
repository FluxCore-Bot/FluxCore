import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { Icon } from "./Icon";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Alert } from "./ui/alert";
import { Card } from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { EmptyState } from "./EmptyState";
import { PageSkeleton } from "./PageSkeleton";
import { useChannels } from "../lib/hooks/useChannels";
import {
  useTempVoiceConfigs,
  useCreateTempVoice,
  useUpdateTempVoice,
  useDeleteTempVoice,
} from "../lib/hooks/useTempVoice";
import { toast } from "sonner";
import { TempVoiceFormSchema, type TempVoiceConfig } from "../lib/schemas";
import { ApiError } from "../lib/client";

const MAX_CONFIGS = 10;

export function TempVoiceForm() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: configs = [], isLoading } = useTempVoiceConfigs(guildId);
  const { data: channels = [] } = useChannels(guildId);
  const createConfig = useCreateTempVoice(guildId);
  const updateConfig = useUpdateTempVoice(guildId);
  const deleteConfig = useDeleteTempVoice(guildId);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [hubChannelId, setHubChannelId] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [nameTemplate, setNameTemplate] = useState("{user}'s Channel");
  const [error, setError] = useState("");

  if (isLoading) return <PageSkeleton />;

  const voiceChannels = channels.filter((c) => c.type === 2);
  const categories = channels.filter((c) => c.type === 4);

  // Filter out hub channels already in use (except the one being edited)
  const availableVoiceChannels = voiceChannels.filter(
    (c) =>
      !configs.some((cfg) => cfg.hubChannelId === c.id && cfg.id !== editingId),
  );

  const resetForm = () => {
    setHubChannelId("");
    setCategoryId(null);
    setNameTemplate("{user}'s Channel");
    setError("");
  };

  const openCreateForm = () => {
    resetForm();
    setEditingId(null);
    setShowForm(true);
  };

  const openEditForm = (cfg: TempVoiceConfig) => {
    setHubChannelId(cfg.hubChannelId);
    setCategoryId(cfg.categoryId);
    setNameTemplate(cfg.nameTemplate);
    setError("");
    setEditingId(cfg.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const result = TempVoiceFormSchema.safeParse({
      hubChannelId,
      categoryId,
      nameTemplate,
    });

    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    try {
      if (editingId !== null) {
        await updateConfig.mutateAsync({
          configId: editingId,
          data: result.data,
        });
        toast.success("Configuration updated");
      } else {
        await createConfig.mutateAsync(result.data);
        toast.success("Configuration created");
      }
      closeForm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    }
  };

  const handleDelete = async (configId: number) => {
    try {
      await deleteConfig.mutateAsync(configId);
      toast.success("Configuration removed");
      if (editingId === configId) closeForm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    }
  };

  const getChannelName = (channelId: string) =>
    channels.find((c) => c.id === channelId)?.name ?? channelId;

  const isPending =
    createConfig.isPending || updateConfig.isPending || deleteConfig.isPending;

  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Configured Hubs</h3>
        {!showForm && configs.length < MAX_CONFIGS && (
          <Button onClick={openCreateForm}>
            <Icon name="add" /> Add Hub
          </Button>
        )}
      </div>

      {error && !showForm && (
        <Alert variant="destructive" className="mb-4">{error}</Alert>
      )}

      {/* Config list */}
      {configs.length > 0 && (
        <div className="mb-6 space-y-3">
          {configs.map((cfg) => (
            <div
              key={cfg.id}
              className="flex flex-col gap-3 rounded-md bg-surface-high px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Hub: #{getChannelName(cfg.hubChannelId)}
                </p>
                <p className="text-xs text-text-muted">
                  Template: {cfg.nameTemplate}
                  {cfg.categoryId &&
                    ` — Category: #${getChannelName(cfg.categoryId)}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => openEditForm(cfg)} disabled={isPending}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => handleDelete(cfg.id)} disabled={isPending}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {configs.length === 0 && !showForm && (
        <EmptyState
          icon="settings_voice"
          title="No configurations yet"
          description="Click 'Add Hub' to create your first temporary voice channel configuration."
          action={
            <Button onClick={openCreateForm}>
              <Icon name="add" /> Add Hub
            </Button>
          }
        />
      )}

      {/* Add/Edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg bg-surface-high p-5 space-y-5"
        >
          <h4 className="text-sm font-semibold">
            {editingId !== null ? "Edit Configuration" : "New Configuration"}
          </h4>

          {error && (
            <Alert variant="destructive">{error}</Alert>
          )}

          <div>
            <Label>Hub Channel <span className="text-danger">*</span></Label>
            <Select
              value={hubChannelId || undefined}
              onValueChange={setHubChannelId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select voice channel..." />
              </SelectTrigger>
              <SelectContent>
                {availableVoiceChannels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Category (optional)</Label>
            <Select
              value={categoryId ?? "none"}
              onValueChange={(v) => setCategoryId(v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Same as hub channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Same as hub channel</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Name Template</Label>
            <Input
              type="text"
              value={nameTemplate}
              onChange={(e) => setNameTemplate(e.target.value)}
              placeholder="{user}'s Channel"
              maxLength={100}
            />
            <p className="mt-1 text-xs text-text-muted">
              Use {"{user}"} for the member's display name
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving..."
                : editingId !== null
                  ? "Update"
                  : "Create"}
            </Button>
            <Button type="button" variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
