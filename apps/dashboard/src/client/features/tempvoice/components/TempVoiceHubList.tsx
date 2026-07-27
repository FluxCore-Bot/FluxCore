import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { MAX_TEMPVOICE_CONFIGS_PER_GUILD } from "@fluxcore/systems/tempVoice/constants";
import { Card } from "../../../shared/ui/card";
import { Button } from "../../../shared/ui/button";
import { Icon } from "../../../shared/components/Icon";
import { FormSkeleton } from "../../../shared/ui/skeletons";
import { useChannels } from "../../../shared/hooks/useChannels";
import type { TempVoiceFormData } from "../../../shared/lib/schemas";
import {
  useTempVoiceConfigs,
  useCreateTempVoice,
  useUpdateTempVoice,
  useDeleteTempVoice,
} from "../hooks/useTempVoice";
import { HubCard } from "./HubCard";
import { HubFlow, HubFlowStep } from "./HubFlow";
import { ChannelChip } from "./ChannelChip";

type Expanded = number | "new" | null;

export function TempVoiceHubList() {
  const { t } = useTranslation("tempvoice");
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: configs = [], isLoading } = useTempVoiceConfigs(guildId);
  const { data: channels = [] } = useChannels(guildId);
  const createConfig = useCreateTempVoice(guildId);
  const updateConfig = useUpdateTempVoice(guildId);
  const deleteConfig = useDeleteTempVoice(guildId);

  const [expanded, setExpanded] = useState<Expanded>(null);

  /** Collapses the open card and returns focus to whatever opened it.
   *  Without this, cancelling drops focus to <body> and a keyboard user
   *  loses their place in the list. */
  const collapse = (openedBy: number | "new") => {
    setExpanded(null);
    const id = openedBy === "new" ? "tv-add-hub" : `tv-edit-hub-${openedBy}`;
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  };

  if (isLoading) return <FormSkeleton />;

  const resolveChannelName = (id: string) =>
    channels.find((c) => c.id === id)?.name ?? id;

  const busy = createConfig.isPending || updateConfig.isPending || deleteConfig.isPending;
  const atCap = configs.length >= MAX_TEMPVOICE_CONFIGS_PER_GUILD;

  const otherHubIds = (selfId: number | "new") =>
    configs.filter((c) => c.id !== selfId).map((c) => c.hubChannelId);

  const handleSubmit = async (id: number | "new", data: TempVoiceFormData) => {
    if (id === "new") {
      await createConfig.mutateAsync(data);
      toast.success(t("toast.created"));
    } else {
      await updateConfig.mutateAsync({ configId: id, data });
      toast.success(t("toast.updated"));
    }
    collapse(id);
  };

  const handleDelete = async (id: number) => {
    const removed = configs.find((c) => c.id === id);
    if (!removed) return;
    await deleteConfig.mutateAsync(id);
    if (expanded === id) setExpanded(null);
    toast.success(t("toast.removed"), {
      action: {
        label: t("toast.undo"),
        onClick: () => {
          void createConfig.mutateAsync({
            hubChannelId: removed.hubChannelId,
            categoryId: removed.categoryId,
            nameTemplate: removed.nameTemplate,
          });
        },
      },
    });
  };

  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h3 className="font-label text-lg font-semibold">
          {t("list.heading")}{" "}
          <span className="text-sm font-normal text-text-muted">
            {t("list.counter", { used: configs.length, max: MAX_TEMPVOICE_CONFIGS_PER_GUILD })}
          </span>
        </h3>
        {expanded === null && !atCap && (
          <Button id="tv-add-hub" className="min-h-11" onClick={() => setExpanded("new")}>
            <Icon name="add" /> {t("list.add")}
          </Button>
        )}
      </div>

      {configs.length === 0 && expanded === null ? (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">{t("empty.exampleCaption")}</p>
          <HubFlow example>
            <HubFlowStep n={1} label={t("flow.step1")}>
              <ChannelChip kind="voice" name="Join to Create" />
            </HubFlowStep>
            <HubFlowStep n={2} label={t("flow.step2")}>
              <ChannelChip kind="voice" name="Ahmad's Channel" />
            </HubFlowStep>
            <HubFlowStep n={3} label={t("flow.step3")}>
              <ChannelChip kind="category" name="Voice Channels" />
            </HubFlowStep>
            <HubFlowStep n={4} label={t("flow.step4")} last />
          </HubFlow>
          <Button className="min-h-11" onClick={() => setExpanded("new")}>
            {t("empty.cta")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((cfg) => (
            <HubCard
              key={cfg.id}
              config={cfg}
              mode={expanded === cfg.id ? "editor" : "summary"}
              guildId={guildId}
              resolveChannelName={resolveChannelName}
              excludeHubIds={otherHubIds(cfg.id)}
              onEdit={() => setExpanded(cfg.id)}
              onDelete={() => void handleDelete(cfg.id)}
              onCancel={() => collapse(cfg.id)}
              onSubmit={(data) => handleSubmit(cfg.id, data)}
              busy={busy}
            />
          ))}
          {expanded === "new" && (
            <HubCard
              config={null}
              mode="editor"
              guildId={guildId}
              resolveChannelName={resolveChannelName}
              excludeHubIds={otherHubIds("new")}
              onEdit={() => {}}
              onDelete={() => {}}
              onCancel={() => collapse("new")}
              onSubmit={(data) => handleSubmit("new", data)}
              busy={busy}
            />
          )}
        </div>
      )}
    </Card>
  );
}
