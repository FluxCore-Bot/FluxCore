import { useState, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ApiError } from "../../../shared/lib/client";
import { PageHeader } from "../../../shared/components/PageHeader";
import {
  useLeaderboard,
  useLevelSettings,
  useUpdateLevelSettings,
  useLevelRewards,
  useAddLevelReward,
  useRemoveLevelReward,
} from "../../../features/leveling/hooks/useLeveling";
import { Button } from "../../../shared/ui/button";
import { Input } from "../../../shared/ui/input";
import { Label } from "../../../shared/ui/label";
import { Card } from "../../../shared/ui/card";
import { Switch } from "../../../shared/ui/switch";
import { Textarea } from "../../../shared/ui/textarea";
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
import { Separator } from "../../../shared/ui/separator";
import { Icon } from "../../../shared/components/Icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/ui/tabs";
import { StatsCard } from "../../../shared/components/StatsCard";
import { DiscordSelect } from "../../../shared/ui/discord-select";
import { DiscordMultiSelect } from "../../../shared/ui/discord-multi-select";

function formatVoiceTime(minutes: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return t("formatters.voiceTimeMinutesOnly", { minutes: mins });
  return t("formatters.voiceTime", { hours, minutes: mins });
}

export function LevelingPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { t } = useTranslation("leveling");
  const [page, setPage] = useState(1);

  // Leaderboard
  const { data: leaderboardData, isLoading: leaderboardLoading } = useLeaderboard(guildId, {
    page,
    limit: 10,
  });

  // Settings
  const { data: settings, isLoading: settingsLoading } = useLevelSettings(guildId);
  const updateSettings = useUpdateLevelSettings(guildId);

  // Rewards
  const { data: rewards, isLoading: rewardsLoading } = useLevelRewards(guildId);
  const addReward = useAddLevelReward(guildId);
  const removeReward = useRemoveLevelReward(guildId);

  // Reward form state
  const [newRewardLevel, setNewRewardLevel] = useState("");
  const [newRewardRole, setNewRewardRole] = useState<string | null>(null);

  // Exclusion form state
  const [noXpChannels, setNoXpChannels] = useState<string[]>([]);
  const [noXpRoles, setNoXpRoles] = useState<string[]>([]);

  // Multiplier form state
  const [multiplierType, setMultiplierType] = useState<"channels" | "roles">("channels");
  const [multiplierId, setMultiplierId] = useState("");
  const [multiplierValue, setMultiplierValue] = useState("");

  useEffect(() => {
    if (settings) {
      setNoXpChannels(settings.noXpChannels ?? []);
      setNoXpRoles(settings.noXpRoles ?? []);
    }
  }, [settings]);

  const totalPages = leaderboardData
    ? Math.max(1, Math.ceil(leaderboardData.total / 10))
    : 1;

  function handleToggleSetting(key: "enabled" | "voiceXpEnabled" | "announceEnabled", value: boolean) {
    updateSettings.mutate(
      { [key]: value },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.saveFailed")),
      },
    );
  }

  function handleNumberSetting(key: "xpPerMessage" | "xpCooldownSeconds" | "voiceXpPerMinute", value: string) {
    const num = parseInt(value, 10);
    if (!Number.isFinite(num) || num < 0) return;
    updateSettings.mutate(
      { [key]: num },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.saveFailed")),
      },
    );
  }

  function handleAnnounceChannelChange(value: string) {
    const channel = value === "same" ? null : value === "dm" ? "dm" : value;
    updateSettings.mutate(
      { announceChannel: channel },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.saveFailed")),
      },
    );
  }

  function handleAnnounceMessageChange(value: string) {
    updateSettings.mutate(
      { announceMessage: value },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.saveFailed")),
      },
    );
  }

  function handleAddReward() {
    const level = parseInt(newRewardLevel, 10);
    if (!Number.isFinite(level) || level < 1 || level > 100) {
      toast.error(t("toast.levelValidation"));
      return;
    }
    if (!newRewardRole) {
      toast.error(t("toast.roleIdRequired"));
      return;
    }
    addReward.mutate(
      { level, roleId: newRewardRole },
      {
        onSuccess: () => {
          toast.success(t("toast.rewardAdded"));
          setNewRewardLevel("");
          setNewRewardRole(null);
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.rewardAddFailed")),
      },
    );
  }

  function handleRemoveReward(id: number) {
    removeReward.mutate(id, {
      onSuccess: () => toast.success(t("toast.rewardRemoved")),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : t("toast.rewardRemoveFailed")),
    });
  }

  function handleSaveExclusions() {
    updateSettings.mutate(
      { noXpChannels: noXpChannels, noXpRoles: noXpRoles },
      {
        onSuccess: () => toast.success(t("toast.exclusionUpdated")),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.exclusionFailed")),
      },
    );
  }

  function handleAddMultiplier() {
    if (!multiplierId || !multiplierValue.trim()) {
      toast.error(t("toast.multiplierIdRequired"));
      return;
    }
    const val = parseFloat(multiplierValue);
    if (!Number.isFinite(val) || val <= 0 || val > 10) {
      toast.error(t("toast.multiplierRange"));
      return;
    }

    const currentMultipliers = settings?.xpMultipliers ?? {};
    const updated = {
      ...currentMultipliers,
      [multiplierType]: {
        ...(currentMultipliers[multiplierType] ?? {}),
        [multiplierId]: val,
      },
    };

    updateSettings.mutate(
      { xpMultipliers: updated },
      {
        onSuccess: () => {
          toast.success(t("toast.multiplierAdded"));
          setMultiplierId("");
          setMultiplierValue("");
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.multiplierAddFailed")),
      },
    );
  }

  function handleRemoveMultiplier(type: "channels" | "roles", id: string) {
    const currentMultipliers = settings?.xpMultipliers ?? {};
    const group = { ...(currentMultipliers[type] ?? {}) };
    delete group[id];
    const updated = {
      ...currentMultipliers,
      [type]: group,
    };

    updateSettings.mutate(
      { xpMultipliers: updated },
      {
        onSuccess: () => toast.success(t("toast.multiplierRemoved")),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.multiplierRemoveFailed")),
      },
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          label={t("stats.rankedMembers")}
          value={leaderboardLoading ? "..." : leaderboardData?.total ?? 0}
        />
        <StatsCard
          label={t("stats.roleRewards")}
          value={rewardsLoading ? "..." : rewards?.length ?? 0}
        />
        <StatsCard
          label={t("stats.systemStatus")}
          value={settingsLoading ? "..." : settings?.enabled ? t("stats.enabled") : t("stats.disabled")}
        />
      </div>

      <Tabs defaultValue="leaderboard">
        <TabsList>
          <TabsTrigger value="leaderboard">{t("tabs.leaderboard")}</TabsTrigger>
          <TabsTrigger value="settings">{t("tabs.settings")}</TabsTrigger>
          <TabsTrigger value="rewards">{t("tabs.roleRewards")}</TabsTrigger>
          <TabsTrigger value="exclusions">{t("tabs.exclusions")}</TabsTrigger>
          <TabsTrigger value="multipliers">{t("tabs.multipliers")}</TabsTrigger>
        </TabsList>

        {/* Leaderboard */}
        <TabsContent value="leaderboard">
          <Card className="bg-surface-container p-6 glass-edge">
            {leaderboardLoading ? (
              <p className="text-text-muted">{t("loading")}</p>
            ) : leaderboardData && leaderboardData.entries.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">{t("table.rank")}</TableHead>
                        <TableHead>{t("table.userId")}</TableHead>
                        <TableHead>{t("table.level")}</TableHead>
                        <TableHead>{t("table.xp")}</TableHead>
                        <TableHead>{t("table.messages")}</TableHead>
                        <TableHead>{t("table.voiceTime")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboardData.entries.map((entry, i) => (
                        <TableRow key={entry.userId}>
                          <TableCell className="font-mono text-xs font-bold">
                            #{(page - 1) * 10 + i + 1}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{entry.userId}</TableCell>
                          <TableCell className="font-bold">{entry.level}</TableCell>
                          <TableCell>{entry.xp.toLocaleString()}</TableCell>
                          <TableCell>{entry.messageCount.toLocaleString()}</TableCell>
                          <TableCell>{formatVoiceTime(entry.voiceMinutes, t)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-text-muted">
                      {t("pagination.pageInfo", { page, totalPages, total: leaderboardData.total })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                      >
                        {t("pagination.previous")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                      >
                        {t("pagination.next")}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-text-muted">{t("emptyLeaderboard")}</p>
            )}
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          <Card className="bg-surface-container p-6 glass-edge">
            <h3 className="mb-4 font-label text-lg font-semibold">{t("settings.title")}</h3>

            {settingsLoading ? (
              <p className="text-text-muted">{t("loadingGeneric")}</p>
            ) : settings ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.enabled")}</p>
                    <p className="text-sm text-text-muted">
                      {t("settings.enabledDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={settings.enabled}
                    onCheckedChange={(checked) => handleToggleSetting("enabled", checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.xpPerMessage")}</p>
                    <p className="text-sm text-text-muted">
                      {t("settings.xpPerMessageDesc")}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={settings.xpPerMessage}
                    onChange={(e) => handleNumberSetting("xpPerMessage", e.target.value)}
                    className="w-24"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.xpCooldown")}</p>
                    <p className="text-sm text-text-muted">
                      {t("settings.xpCooldownDesc")}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={3600}
                    value={settings.xpCooldownSeconds}
                    onChange={(e) => handleNumberSetting("xpCooldownSeconds", e.target.value)}
                    className="w-24"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.voiceXpEnabled")}</p>
                    <p className="text-sm text-text-muted">
                      {t("settings.voiceXpEnabledDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={settings.voiceXpEnabled}
                    onCheckedChange={(checked) => handleToggleSetting("voiceXpEnabled", checked)}
                  />
                </div>

                {settings.voiceXpEnabled && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{t("settings.voiceXpPerMinute")}</p>
                        <p className="text-sm text-text-muted">
                          {t("settings.voiceXpPerMinuteDesc")}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={settings.voiceXpPerMinute}
                        onChange={(e) => handleNumberSetting("voiceXpPerMinute", e.target.value)}
                        className="w-24"
                      />
                    </div>
                  </>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.levelUpAnnouncements")}</p>
                    <p className="text-sm text-text-muted">
                      {t("settings.levelUpAnnouncementsDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={settings.announceEnabled}
                    onCheckedChange={(checked) => handleToggleSetting("announceEnabled", checked)}
                  />
                </div>

                {settings.announceEnabled && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div>
                        <Label>{t("settings.announceDest")}</Label>
                        <Select
                          value={settings.announceChannel === null ? "same" : settings.announceChannel === "dm" ? "dm" : "channel"}
                          onValueChange={handleAnnounceChannelChange}
                        >
                          <SelectTrigger className="w-64">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="same">{t("settings.announceDestSameChannel")}</SelectItem>
                            <SelectItem value="dm">{t("settings.announceDestDM")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="mt-1 text-xs text-text-muted">
                          {t("settings.announceDestHint")}
                        </p>
                      </div>
                      <div>
                        <Label>{t("settings.announceMessage")}</Label>
                        <Textarea
                          value={settings.announceMessage}
                          onChange={(e) => handleAnnounceMessageChange(e.target.value)}
                          placeholder={t("settings.announceMessagePlaceholder")}
                          className="mt-1"
                        />
                        <p className="mt-1 text-xs text-text-muted">
                          {t("settings.announceMessageVars")}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </Card>
        </TabsContent>

        {/* Role Rewards */}
        <TabsContent value="rewards">
          <Card className="bg-surface-container p-6 glass-edge">
            <h3 className="mb-4 font-label text-lg font-semibold">{t("roleRewards.title")}</h3>
            <p className="mb-4 text-sm text-text-muted">
              {t("roleRewards.description")}
            </p>

            {rewardsLoading ? (
              <p className="text-text-muted">{t("loadingGeneric")}</p>
            ) : rewards && rewards.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("roleRewards.level")}</TableHead>
                      <TableHead>{t("roleRewards.roleId")}</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rewards.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-bold">{t("roleRewards.levelPrefix", { level: r.level })}</TableCell>
                        <TableCell className="font-mono text-xs">{r.roleId}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveReward(r.id)}
                            disabled={removeReward.isPending}
                          >
                            <Icon name="delete" size={16} className="text-danger" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="mb-4 text-text-muted">{t("roleRewards.noRewards")}</p>
            )}

            <Separator className="my-6" />

            <h4 className="mb-3 font-label text-sm font-semibold">{t("roleRewards.addRewardTitle")}</h4>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div>
                <Label htmlFor="reward-level">{t("roleRewards.level")}</Label>
                <Input
                  id="reward-level"
                  type="number"
                  min={1}
                  max={100}
                  placeholder={t("roleRewards.levelPlaceholder")}
                  value={newRewardLevel}
                  onChange={(e) => setNewRewardLevel(e.target.value)}
                  className="w-24"
                />
              </div>
              <div>
                <Label htmlFor="reward-role">{t("roleRewards.roleId")}</Label>
                <DiscordSelect
                  guildId={guildId}
                  type="role"
                  value={newRewardRole}
                  onValueChange={setNewRewardRole}
                  placeholder={t("roleRewards.rolePlaceholder")}
                  className="w-48"
                />
              </div>
              <Button
                onClick={handleAddReward}
                disabled={addReward.isPending}
              >
                {t("roleRewards.addReward")}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Exclusions */}
        <TabsContent value="exclusions">
          <Card className="bg-surface-container p-6 glass-edge">
            <h3 className="mb-4 font-label text-lg font-semibold">{t("exclusions.title")}</h3>
            <p className="mb-4 text-sm text-text-muted">
              {t("exclusions.description")}
            </p>

            <div className="space-y-4">
              <div>
                <Label>{t("exclusions.noXpChannels")}</Label>
                <DiscordMultiSelect
                  guildId={guildId}
                  type="text"
                  selectedIds={noXpChannels}
                  onChange={setNoXpChannels}
                  placeholder={t("exclusions.noXpChannelsPlaceholder")}
                />
              </div>
              <div>
                <Label>{t("exclusions.noXpRoles")}</Label>
                <DiscordMultiSelect
                  guildId={guildId}
                  type="role"
                  selectedIds={noXpRoles}
                  onChange={setNoXpRoles}
                  placeholder={t("exclusions.noXpRolesPlaceholder")}
                />
              </div>
              <Button
                onClick={handleSaveExclusions}
                disabled={updateSettings.isPending}
              >
                {t("exclusions.save")}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Multipliers */}
        <TabsContent value="multipliers">
          <Card className="bg-surface-container p-6 glass-edge">
            <h3 className="mb-4 font-label text-lg font-semibold">{t("multipliers.title")}</h3>
            <p className="mb-4 text-sm text-text-muted">
              {t("multipliers.description")}
            </p>

            {/* Current multipliers */}
            {settings?.xpMultipliers && (
              <div className="mb-6 space-y-4">
                {settings.xpMultipliers.channels &&
                  Object.entries(settings.xpMultipliers.channels).length > 0 && (
                    <div>
                      <h4 className="mb-2 font-label text-sm font-semibold">{t("multipliers.channelMultipliers")}</h4>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("multipliers.channelId")}</TableHead>
                              <TableHead>{t("multipliers.multiplier")}</TableHead>
                              <TableHead className="w-16" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(settings.xpMultipliers.channels).map(
                              ([id, value]) => (
                                <TableRow key={id}>
                                  <TableCell className="font-mono text-xs">{id}</TableCell>
                                  <TableCell>{t("multipliers.multiplierSuffix", { value })}</TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveMultiplier("channels", id)}
                                    >
                                      <Icon name="delete" size={16} className="text-danger" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ),
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                {settings.xpMultipliers.roles &&
                  Object.entries(settings.xpMultipliers.roles).length > 0 && (
                    <div>
                      <h4 className="mb-2 font-label text-sm font-semibold">{t("multipliers.roleMultipliers")}</h4>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("multipliers.roleId")}</TableHead>
                              <TableHead>{t("multipliers.multiplier")}</TableHead>
                              <TableHead className="w-16" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(settings.xpMultipliers.roles).map(
                              ([id, value]) => (
                                <TableRow key={id}>
                                  <TableCell className="font-mono text-xs">{id}</TableCell>
                                  <TableCell>{t("multipliers.multiplierSuffix", { value })}</TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveMultiplier("roles", id)}
                                    >
                                      <Icon name="delete" size={16} className="text-danger" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ),
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
              </div>
            )}

            <Separator className="my-6" />

            <h4 className="mb-3 font-label text-sm font-semibold">{t("multipliers.addTitle")}</h4>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div>
                <Label>{t("multipliers.type")}</Label>
                <Select value={multiplierType} onValueChange={(v) => setMultiplierType(v as "channels" | "roles")}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="channels">{t("multipliers.typeChannel")}</SelectItem>
                    <SelectItem value="roles">{t("multipliers.typeRole")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("multipliers.id")}</Label>
                <DiscordSelect
                  guildId={guildId}
                  type={multiplierType === "channels" ? "text" : "role"}
                  value={multiplierId || null}
                  onValueChange={(v) => setMultiplierId(v ?? "")}
                  placeholder={t("multipliers.idPlaceholder")}
                />
              </div>
              <div>
                <Label htmlFor="multiplier-value">{t("multipliers.value")}</Label>
                <Input
                  id="multiplier-value"
                  type="number"
                  min={0.1}
                  max={10}
                  step={0.1}
                  placeholder={t("multipliers.valuePlaceholder")}
                  value={multiplierValue}
                  onChange={(e) => setMultiplierValue(e.target.value)}
                  className="w-24"
                />
              </div>
              <Button
                onClick={handleAddMultiplier}
                disabled={updateSettings.isPending}
              >
                {t("multipliers.add")}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
