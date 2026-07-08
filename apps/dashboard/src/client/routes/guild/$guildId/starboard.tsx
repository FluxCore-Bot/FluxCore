import { useState, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ApiError } from "../../../shared/lib/client";
import { PageHeader } from "../../../shared/components/PageHeader";
import {
  useStarboardSettings,
  useUpdateStarboardSettings,
  useStarboardEntries,
} from "../../../features/starboard/hooks/useStarboard";
import { DiscordSelect } from "../../../shared/ui/discord-select";
import { DiscordMultiSelect } from "../../../shared/ui/discord-multi-select";
import { Button } from "../../../shared/ui/button";
import { Input } from "../../../shared/ui/input";
import { Label } from "../../../shared/ui/label";
import { Card } from "../../../shared/ui/card";
import { Switch } from "../../../shared/ui/switch";
import { Separator } from "../../../shared/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../shared/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/ui/tabs";
import { Badge } from "../../../shared/ui/badge";
import { Icon } from "../../../shared/components/Icon";
import { PageSkeleton, TableSkeleton } from "../../../shared/ui/skeletons";

export function StarboardPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { t } = useTranslation("starboard");
  const { data: settings, isLoading } = useStarboardSettings(guildId);
  const updateSettings = useUpdateStarboardSettings(guildId);
  const [page, setPage] = useState(1);
  const { data: entriesData, isLoading: entriesLoading } = useStarboardEntries(guildId, page);

  // Local state for form
  const [enabled, setEnabled] = useState(true);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [emoji, setEmoji] = useState("\u2B50");
  const [threshold, setThreshold] = useState(3);
  const [selfStar, setSelfStar] = useState(false);
  const [ignoredChannels, setIgnoredChannels] = useState<string[]>([]);
  const [nsfwHandling, setNsfwHandling] = useState<"ignore" | "separate">("ignore");

  // Sync from server
  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setChannelId(settings.channelId ?? null);
      setEmoji(settings.emoji);
      setThreshold(settings.threshold);
      setSelfStar(settings.selfStar);
      setIgnoredChannels(settings.ignoredChannels);
      setNsfwHandling(settings.nsfwHandling);
    }
  }, [settings]);

  function handleSave() {
    updateSettings.mutate(
      {
        enabled,
        channelId: channelId,
        emoji,
        threshold,
        selfStar,
        ignoredChannels: ignoredChannels,
        nsfwHandling,
      },
      {
        onSuccess: () => toast.success(t("toast.saved")),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.saveFailed")),
      },
    );
  }

  if (isLoading) {
    return <PageSkeleton stats={0} tabCount={2} content="form" />;
  }

  const totalPages = entriesData ? Math.ceil(entriesData.total / 20) : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">{t("tabs.settings")}</TabsTrigger>
          <TabsTrigger value="entries">{t("tabs.starredMessages")}</TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card className="bg-surface-container p-6 glass-edge">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="font-label text-lg font-semibold">{t("settings.title")}</h3>
                <p className="text-sm text-text-muted">
                  {t("settings.description")}
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <Separator className="mb-6" />

            <div className="space-y-6">
              {/* Channel */}
              <div>
                <Label htmlFor="starboard-channel">{t("settings.channelId")}</Label>
                <DiscordSelect
                  guildId={guildId}
                  type="text"
                  value={channelId}
                  onValueChange={setChannelId}
                  placeholder={t("settings.channelId")}
                  allowNone
                />
                <p className="mt-1 text-xs text-text-muted">
                  {t("settings.channelIdDesc")}
                </p>
              </div>

              {/* Emoji & Threshold */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="starboard-emoji">{t("settings.starEmoji")}</Label>
                  <Input
                    id="starboard-emoji"
                    placeholder={"\u2B50"}
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    {t("settings.starEmojiDesc")}
                  </p>
                </div>
                <div>
                  <Label htmlFor="starboard-threshold">{t("settings.threshold")}</Label>
                  <Input
                    id="starboard-threshold"
                    type="number"
                    min={1}
                    max={100}
                    value={threshold}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (Number.isFinite(val) && val >= 1) setThreshold(val);
                    }}
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    {t("settings.thresholdDesc")}
                  </p>
                </div>
              </div>

              {/* Self-star toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">{t("settings.selfStar")}</p>
                  <p className="text-sm text-text-muted">
                    {t("settings.selfStarDesc")}
                  </p>
                </div>
                <Switch checked={selfStar} onCheckedChange={setSelfStar} />
              </div>

              {/* Ignored Channels */}
              <div>
                <Label htmlFor="starboard-ignored">{t("settings.ignoredChannels")}</Label>
                <DiscordMultiSelect
                  guildId={guildId}
                  type="text"
                  selectedIds={ignoredChannels}
                  onChange={setIgnoredChannels}
                  placeholder={t("settings.ignoredChannels")}
                />
                <p className="mt-1 text-xs text-text-muted">
                  {t("settings.ignoredChannelsDesc")}
                </p>
              </div>

              {/* NSFW Handling */}
              <div>
                <Label>{t("settings.nsfwAllowed")}</Label>
                <Select value={nsfwHandling} onValueChange={(v) => setNsfwHandling(v as "ignore" | "separate")}>
                  <SelectTrigger className="mt-1 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ignore">{t("common:actions.disable")}</SelectItem>
                    <SelectItem value="separate">{t("common:actions.enable")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-text-muted">
                  {t("settings.nsfwAllowedDesc")}
                </p>
              </div>
            </div>
          </Card>

          <div className="mt-6 flex gap-3">
            <Button onClick={handleSave} disabled={updateSettings.isPending}>
              {updateSettings.isPending ? t("actions.saving") : t("actions.save")}
            </Button>
          </div>
        </TabsContent>

        {/* Starred Messages Tab */}
        <TabsContent value="entries">
          <Card className="bg-surface-container p-6 glass-edge">
            <h3 className="mb-2 font-label text-lg font-semibold">{t("tabs.starredMessages")}</h3>
            <p className="mb-4 text-sm text-text-muted">
              {t("settings.description")}
            </p>

            <Separator className="mb-4" />

            {entriesLoading ? (
              <TableSkeleton columns={5} />
            ) : !entriesData?.entries.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Icon name="star" size={48} className="mb-3 text-text-muted/30" />
                <p className="text-text-muted">{t("messages.noMessages")}</p>
                <p className="text-sm text-text-muted/60">
                  {t("settings.thresholdDesc")}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("messages.table.original")}</TableHead>
                        <TableHead>{t("messages.table.channel")}</TableHead>
                        <TableHead>{t("messages.table.author")}</TableHead>
                        <TableHead>{t("messages.table.stars")}</TableHead>
                        <TableHead>{t("messages.table.date")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entriesData.entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-mono text-xs">
                            {entry.originalMessageId}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {entry.originalChannelId}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{entry.authorId}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {settings?.emoji ?? "\u2B50"} {entry.starCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-text-muted">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-text-muted">
                      Page {page} of {totalPages} ({entriesData.total} total)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                      >
                        {t("common:actions.back")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                      >
                        {t("common:actions.next")}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
