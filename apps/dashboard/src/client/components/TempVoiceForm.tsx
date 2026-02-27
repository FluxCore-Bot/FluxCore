import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useChannels } from "../lib/hooks/useChannels";
import {
  useTempVoiceConfigs,
  useCreateTempVoice,
  useUpdateTempVoice,
  useDeleteTempVoice,
} from "../lib/hooks/useTempVoice";
import { useUiStore } from "../stores/uiStore";
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
  const addToast = useUiStore((s) => s.addToast);

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
        addToast("Configuration updated", "success");
      } else {
        await createConfig.mutateAsync(result.data);
        addToast("Configuration created", "success");
      }
      closeForm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    }
  };

  const handleDelete = async (configId: number) => {
    try {
      await deleteConfig.mutateAsync(configId);
      addToast("Configuration removed", "success");
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
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Temporary Voice Channels</h3>
          <p className="text-sm text-text-muted">
            Configure hub voice channels that create temporary voice rooms when
            users join.
          </p>
        </div>
        {!showForm && configs.length < MAX_CONFIGS && (
          <button
            onClick={openCreateForm}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            Add Configuration
          </button>
        )}
      </div>

      {error && !showForm && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Config list */}
      {configs.length > 0 && (
        <div className="mb-4 space-y-3">
          {configs.map((cfg) => (
            <div
              key={cfg.id}
              className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3"
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
                <button
                  onClick={() => openEditForm(cfg)}
                  disabled={isPending}
                  className="rounded-md bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(cfg.id)}
                  disabled={isPending}
                  className="rounded-md bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/20 disabled:opacity-50"
                >
                  Delete
                </button>
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
          className="rounded-md border border-border bg-background p-4"
        >
          <h4 className="mb-3 text-sm font-semibold">
            {editingId !== null ? "Edit Configuration" : "New Configuration"}
          </h4>

          {error && (
            <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="mb-3">
            <label className="mb-1 block text-xs text-text-muted">
              Hub Channel <span className="text-danger">*</span>
            </label>
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
            <label className="mb-1 block text-xs text-text-muted">
              Category (optional)
            </label>
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
            <label className="mb-1 block text-xs text-text-muted">
              Name Template
            </label>
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
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
            >
              {isPending
                ? "Saving..."
                : editingId !== null
                  ? "Update"
                  : "Create"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-md bg-surface px-5 py-2 text-sm font-medium text-text-muted transition hover:bg-border"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
