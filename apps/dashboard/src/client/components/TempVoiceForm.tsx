import { useState, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { useChannels } from "../lib/hooks/useChannels";
import {
  useTempVoice,
  useUpdateTempVoice,
  useDeleteTempVoice,
} from "../lib/hooks/useTempVoice";
import { useUiStore } from "../stores/uiStore";
import { TempVoiceFormSchema } from "../lib/schemas";
import { ApiError } from "../lib/client";

export function TempVoiceForm() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: config, isLoading } = useTempVoice(guildId);
  const { data: channels = [] } = useChannels(guildId);
  const updateConfig = useUpdateTempVoice(guildId);
  const deleteConfig = useDeleteTempVoice(guildId);
  const addToast = useUiStore((s) => s.addToast);

  const [hubChannelId, setHubChannelId] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [nameTemplate, setNameTemplate] = useState("{user}'s Channel");
  const [error, setError] = useState("");

  useEffect(() => {
    if (config) {
      setHubChannelId(config.hubChannelId);
      setCategoryId(config.categoryId);
      setNameTemplate(config.nameTemplate);
    }
  }, [config]);

  if (isLoading) return <p className="text-text-muted">Loading...</p>;

  const voiceChannels = channels.filter((c) => c.type === 2);
  const categories = channels.filter((c) => c.type === 4);

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
      await updateConfig.mutateAsync(result.data);
      addToast("TempVoice config saved", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteConfig.mutateAsync();
      setHubChannelId("");
      setCategoryId(null);
      setNameTemplate("{user}'s Channel");
      addToast("TempVoice config removed", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-6"
    >
      <h3 className="mb-4 text-lg font-semibold">Temporary Voice Channels</h3>
      <p className="mb-6 text-sm text-text-muted">
        Configure a hub voice channel that creates temporary voice rooms when
        users join.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="mb-1 block text-xs text-text-muted">
          Hub Channel <span className="text-danger">*</span>
        </label>
        <select
          value={hubChannelId}
          onChange={(e) => setHubChannelId(e.target.value)}
        >
          <option value="">Select voice channel...</option>
          {voiceChannels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
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

      <div className="mb-6">
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
          disabled={updateConfig.isPending}
          className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {updateConfig.isPending ? "Saving..." : "Save Config"}
        </button>
        {config && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteConfig.isPending}
            className="rounded-md bg-danger px-5 py-2 text-sm font-medium text-white transition hover:bg-danger-hover disabled:opacity-50"
          >
            {deleteConfig.isPending ? "Removing..." : "Remove Config"}
          </button>
        )}
      </div>
    </form>
  );
}
