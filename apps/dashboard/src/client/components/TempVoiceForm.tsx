import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { Icon } from "./Icon";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Alert } from "./ui/alert";
import { Card } from "./ui/card";
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

  if (isLoading) return <p className="text-text-muted">Loading...</p>;

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
      <div className="mb-4 flex items-center justify-between">
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
        <div className="mb-4 space-y-3">
          {configs.map((cfg) => (
            <div
              key={cfg.id}
              className="flex items-center justify-between rounded-md bg-surface-high px-4 py-3"
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
        <p className="mb-4 text-sm text-text-muted">
          No configurations yet. Click "Add Configuration" to get started.
        </p>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-md bg-surface-high p-4"
        >
          <h4 className="mb-3 text-sm font-semibold">
            {editingId !== null ? "Edit Configuration" : "New Configuration"}
          </h4>

          {error && (
            <Alert variant="destructive" className="mb-3">{error}</Alert>
          )}

          <div className="mb-3">
            <Label>Hub Channel <span className="text-danger">*</span></Label>
            <select
              value={hubChannelId}
              onChange={(e) => setHubChannelId(e.target.value)}
            >
              <option value="">Select voice channel...</option>
              {availableVoiceChannels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <Label>Category (optional)</Label>
            <select
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(e.target.value || null)}
            >
              <option value="">Same as hub channel</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <Label>Name Template</Label>
            <input
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
