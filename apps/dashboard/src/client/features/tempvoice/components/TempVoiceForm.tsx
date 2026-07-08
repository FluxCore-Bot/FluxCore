import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "@tanstack/react-router";
import { Icon } from "../../../shared/components/Icon";
import { Button } from "../../../shared/ui/button";
import { Input } from "../../../shared/ui/input";
import { Label } from "../../../shared/ui/label";
import { Alert } from "../../../shared/ui/alert";
import { Card } from "../../../shared/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/ui/select";
import { EmptyState } from "../../../shared/components/EmptyState";
import { FormSkeleton } from "../../../shared/ui/skeletons";
import { useChannels } from "../../../shared/hooks/useChannels";
import {
  useTempVoiceConfigs,
  useCreateTempVoice,
  useUpdateTempVoice,
  useDeleteTempVoice,
} from "../hooks/useTempVoice";
import { toast } from "sonner";
import { TempVoiceFormSchema, type TempVoiceConfig } from "../../../shared/lib/schemas";
import { ApiError } from "../../../shared/lib/client";

const MAX_CONFIGS = 10;

export function TempVoiceForm() {
  const { t } = useTranslation(["tempvoice", "common"]);
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

  if (isLoading) return <FormSkeleton />;

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
        toast.success(t("toast.updated"));
      } else {
        await createConfig.mutateAsync(result.data);
        toast.success(t("toast.created"));
      }
      closeForm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common:accessibility.error"));
    }
  };

  const handleDelete = async (configId: number) => {
    try {
      await deleteConfig.mutateAsync(configId);
      toast.success(t("toast.removed"));
      if (editingId === configId) closeForm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common:accessibility.error"));
    }
  };

  const getChannelName = (channelId: string) =>
    channels.find((c) => c.id === channelId)?.name ?? channelId;

  const isPending =
    createConfig.isPending || updateConfig.isPending || deleteConfig.isPending;

  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-label text-lg font-semibold">{t("hubs.configured")}</h3>
        {!showForm && configs.length < MAX_CONFIGS && (
          <Button onClick={openCreateForm}>
            <Icon name="add" /> {t("hubs.add")}
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
                  {t("hubs.hubLabel", { channel: getChannelName(cfg.hubChannelId) })}
                </p>
                <p className="text-xs text-text-muted">
                  {t("hubs.templateLabel", { template: cfg.nameTemplate })}
                  {cfg.categoryId &&
                    t("hubs.categorySuffix", { channel: getChannelName(cfg.categoryId) })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => openEditForm(cfg)} disabled={isPending}>
                  {t("form.edit")}
                </Button>
                <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => handleDelete(cfg.id)} disabled={isPending}>
                  {t("form.delete")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {configs.length === 0 && !showForm && (
        <EmptyState
          icon="settings_voice"
          title={t("empty.noConfigs")}
          description={t("empty.noConfigsDesc")}
          action={
            <Button onClick={openCreateForm}>
              <Icon name="add" /> {t("empty.addFirst")}
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
            {editingId !== null ? t("form.editConfig") : t("form.addConfig")}
          </h4>

          {error && (
            <Alert variant="destructive">{error}</Alert>
          )}

          <div>
            <Label htmlFor="tempvoice-hub-channel">{t("form.hubChannel")} <span className="text-danger">*</span></Label>
            <Select
              value={hubChannelId || undefined}
              onValueChange={setHubChannelId}
            >
              <SelectTrigger id="tempvoice-hub-channel">
                <SelectValue placeholder={t("form.selectHub")} />
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
            <Label htmlFor="tempvoice-category">{t("form.category")}</Label>
            <Select
              value={categoryId ?? "none"}
              onValueChange={(v) => setCategoryId(v === "none" ? null : v)}
            >
              <SelectTrigger id="tempvoice-category">
                <SelectValue placeholder={t("form.sameAsHub")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("form.sameAsHub")}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="tempvoice-name-template">{t("form.nameTemplate")}</Label>
            <Input
              id="tempvoice-name-template"
              type="text"
              value={nameTemplate}
              onChange={(e) => setNameTemplate(e.target.value)}
              placeholder={t("form.defaultNameTemplate")}
              maxLength={100}
            />
            <p className="mt-1 text-xs text-text-muted">
              {t("form.nameTemplateHint")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? t("form.saving") : editingId !== null ? t("form.save") : t("form.save")}
            </Button>
            <Button type="button" variant="ghost" onClick={closeForm}>
              {t("form.cancel")}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
