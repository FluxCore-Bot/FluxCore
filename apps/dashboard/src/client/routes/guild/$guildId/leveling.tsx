import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiError } from "../../../lib/client";
import { PageHeader } from "../../../components/PageHeader";
import {
  useLeaderboard,
  useLevelSettings,
  useUpdateLevelSettings,
  useLevelRewards,
  useAddLevelReward,
  useRemoveLevelReward,
} from "../../../lib/hooks/useLeveling";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Card } from "../../../components/ui/card";
import { Switch } from "../../../components/ui/switch";
import { Textarea } from "../../../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Separator } from "../../../components/ui/separator";
import { Icon } from "../../../components/Icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Progress } from "../../../components/ui/progress";

function formatVoiceTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

export function LevelingPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
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
  const [newRewardRole, setNewRewardRole] = useState("");

  // Exclusion form state
  const [noXpChannelsInput, setNoXpChannelsInput] = useState("");
  const [noXpRolesInput, setNoXpRolesInput] = useState("");

  // Multiplier form state
  const [multiplierType, setMultiplierType] = useState<"channels" | "roles">("channels");
  const [multiplierId, setMultiplierId] = useState("");
  const [multiplierValue, setMultiplierValue] = useState("");

  const totalPages = leaderboardData
    ? Math.max(1, Math.ceil(leaderboardData.total / 10))
    : 1;

  function handleToggleSetting(key: "enabled" | "voiceXpEnabled" | "announceEnabled", value: boolean) {
    updateSettings.mutate(
      { [key]: value },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Failed to update setting"),
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
          toast.error(err instanceof ApiError ? err.message : "Failed to update setting"),
      },
    );
  }

  function handleAnnounceChannelChange(value: string) {
    const channel = value === "same" ? null : value === "dm" ? "dm" : value;
    updateSettings.mutate(
      { announceChannel: channel },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Failed to update setting"),
      },
    );
  }

  function handleAnnounceMessageChange(value: string) {
    updateSettings.mutate(
      { announceMessage: value },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Failed to update setting"),
      },
    );
  }

  function handleAddReward() {
    const level = parseInt(newRewardLevel, 10);
    if (!Number.isFinite(level) || level < 1 || level > 100) {
      toast.error("Level must be between 1 and 100");
      return;
    }
    if (!newRewardRole.trim()) {
      toast.error("Role ID is required");
      return;
    }
    addReward.mutate(
      { level, roleId: newRewardRole.trim() },
      {
        onSuccess: () => {
          toast.success("Reward added");
          setNewRewardLevel("");
          setNewRewardRole("");
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Failed to add reward"),
      },
    );
  }

  function handleRemoveReward(id: number) {
    removeReward.mutate(id, {
      onSuccess: () => toast.success("Reward removed"),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to remove reward"),
    });
  }

  function handleSaveExclusions() {
    const channels = noXpChannelsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const roles = noXpRolesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateSettings.mutate(
      { noXpChannels: channels, noXpRoles: roles },
      {
        onSuccess: () => toast.success("Exclusions saved"),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Failed to save exclusions"),
      },
    );
  }

  function handleAddMultiplier() {
    if (!multiplierId.trim() || !multiplierValue.trim()) {
      toast.error("ID and multiplier value are required");
      return;
    }
    const val = parseFloat(multiplierValue);
    if (!Number.isFinite(val) || val <= 0 || val > 10) {
      toast.error("Multiplier must be between 0 and 10");
      return;
    }

    const currentMultipliers = settings?.xpMultipliers ?? {};
    const updated = {
      ...currentMultipliers,
      [multiplierType]: {
        ...(currentMultipliers[multiplierType] ?? {}),
        [multiplierId.trim()]: val,
      },
    };

    updateSettings.mutate(
      { xpMultipliers: updated },
      {
        onSuccess: () => {
          toast.success("Multiplier added");
          setMultiplierId("");
          setMultiplierValue("");
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Failed to add multiplier"),
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
        onSuccess: () => toast.success("Multiplier removed"),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Failed to remove multiplier"),
      },
    );
  }

  // Initialize exclusion inputs from settings
  const noXpChannelsValue =
    noXpChannelsInput || (settings?.noXpChannels ?? []).join(", ");
  const noXpRolesValue =
    noXpRolesInput || (settings?.noXpRoles ?? []).join(", ");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Leveling System"
        subtitle="Configure XP earning, level-up announcements, role rewards, and multipliers."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">Ranked Members</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {leaderboardLoading ? "..." : leaderboardData?.total ?? 0}
          </p>
        </Card>
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">Role Rewards</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {rewardsLoading ? "..." : rewards?.length ?? 0}
          </p>
        </Card>
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">System Status</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {settingsLoading ? "..." : settings?.enabled ? "Enabled" : "Disabled"}
          </p>
        </Card>
      </div>

      <Tabs defaultValue="leaderboard">
        <TabsList>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="rewards">Role Rewards</TabsTrigger>
          <TabsTrigger value="exclusions">Exclusions</TabsTrigger>
          <TabsTrigger value="multipliers">Multipliers</TabsTrigger>
        </TabsList>

        {/* Leaderboard */}
        <TabsContent value="leaderboard">
          <Card className="bg-surface p-6">
            {leaderboardLoading ? (
              <p className="text-text-muted">Loading leaderboard...</p>
            ) : leaderboardData && leaderboardData.entries.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>XP</TableHead>
                      <TableHead>Messages</TableHead>
                      <TableHead>Voice Time</TableHead>
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
                        <TableCell>{formatVoiceTime(entry.voiceMinutes)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-text-muted">
                      Page {page} of {totalPages} ({leaderboardData.total} total)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-text-muted">No members have earned XP yet.</p>
            )}
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          <Card className="bg-surface p-6">
            <h3 className="mb-4 text-lg font-semibold">Leveling Settings</h3>

            {settingsLoading ? (
              <p className="text-text-muted">Loading...</p>
            ) : settings ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable Leveling</p>
                    <p className="text-sm text-text-muted">
                      Toggle the entire leveling system on or off.
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
                    <p className="font-medium">XP per Message</p>
                    <p className="text-sm text-text-muted">
                      Base XP awarded per message (randomness of 0-9 is added).
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
                    <p className="font-medium">XP Cooldown (seconds)</p>
                    <p className="text-sm text-text-muted">
                      Minimum time between XP grants per user.
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
                    <p className="font-medium">Voice XP</p>
                    <p className="text-sm text-text-muted">
                      Grant XP for time spent in voice channels.
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
                        <p className="font-medium">Voice XP per Minute</p>
                        <p className="text-sm text-text-muted">
                          XP awarded per minute in voice.
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
                    <p className="font-medium">Level-up Announcements</p>
                    <p className="text-sm text-text-muted">
                      Announce when a member levels up.
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
                        <Label>Announcement Destination</Label>
                        <Select
                          value={settings.announceChannel === null ? "same" : settings.announceChannel === "dm" ? "dm" : "channel"}
                          onValueChange={handleAnnounceChannelChange}
                        >
                          <SelectTrigger className="w-64">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="same">Same Channel</SelectItem>
                            <SelectItem value="dm">Direct Message</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="mt-1 text-xs text-text-muted">
                          You can also enter a channel ID directly in the input above.
                        </p>
                      </div>
                      <div>
                        <Label>Announcement Message</Label>
                        <Textarea
                          value={settings.announceMessage}
                          onChange={(e) => handleAnnounceMessageChange(e.target.value)}
                          placeholder="{user} just reached **Level {level}**!"
                          className="mt-1"
                        />
                        <p className="mt-1 text-xs text-text-muted">
                          Variables: {"{user}"}, {"{level}"}, {"{username}"}
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
          <Card className="bg-surface p-6">
            <h3 className="mb-4 text-lg font-semibold">Role Rewards</h3>
            <p className="mb-4 text-sm text-text-muted">
              Automatically assign roles when members reach certain levels.
            </p>

            {rewardsLoading ? (
              <p className="text-text-muted">Loading...</p>
            ) : rewards && rewards.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Level</TableHead>
                    <TableHead>Role ID</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-bold">Level {r.level}</TableCell>
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
            ) : (
              <p className="mb-4 text-text-muted">No role rewards configured.</p>
            )}

            <Separator className="my-6" />

            <h4 className="mb-3 text-sm font-semibold">Add Role Reward</h4>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div>
                <Label htmlFor="reward-level">Level</Label>
                <Input
                  id="reward-level"
                  type="number"
                  min={1}
                  max={100}
                  placeholder="e.g. 5"
                  value={newRewardLevel}
                  onChange={(e) => setNewRewardLevel(e.target.value)}
                  className="w-24"
                />
              </div>
              <div>
                <Label htmlFor="reward-role">Role ID</Label>
                <Input
                  id="reward-role"
                  placeholder="e.g. 123456789"
                  value={newRewardRole}
                  onChange={(e) => setNewRewardRole(e.target.value)}
                  className="w-48"
                />
              </div>
              <Button
                onClick={handleAddReward}
                disabled={addReward.isPending}
              >
                Add Reward
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Exclusions */}
        <TabsContent value="exclusions">
          <Card className="bg-surface p-6">
            <h3 className="mb-4 text-lg font-semibold">XP Exclusions</h3>
            <p className="mb-4 text-sm text-text-muted">
              Channels and roles that do not earn XP.
            </p>

            <div className="space-y-4">
              <div>
                <Label htmlFor="no-xp-channels">No-XP Channels (comma-separated IDs)</Label>
                <Input
                  id="no-xp-channels"
                  placeholder="e.g. 123456789, 987654321"
                  value={noXpChannelsValue}
                  onChange={(e) => setNoXpChannelsInput(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="no-xp-roles">No-XP Roles (comma-separated IDs)</Label>
                <Input
                  id="no-xp-roles"
                  placeholder="e.g. 123456789, 987654321"
                  value={noXpRolesValue}
                  onChange={(e) => setNoXpRolesInput(e.target.value)}
                />
              </div>
              <Button
                onClick={handleSaveExclusions}
                disabled={updateSettings.isPending}
              >
                Save Exclusions
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Multipliers */}
        <TabsContent value="multipliers">
          <Card className="bg-surface p-6">
            <h3 className="mb-4 text-lg font-semibold">XP Multipliers</h3>
            <p className="mb-4 text-sm text-text-muted">
              Set XP multipliers per channel or role. A multiplier of 2 doubles the XP earned.
            </p>

            {/* Current multipliers */}
            {settings?.xpMultipliers && (
              <div className="mb-6 space-y-4">
                {settings.xpMultipliers.channels &&
                  Object.entries(settings.xpMultipliers.channels).length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold">Channel Multipliers</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Channel ID</TableHead>
                            <TableHead>Multiplier</TableHead>
                            <TableHead className="w-16" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(settings.xpMultipliers.channels).map(
                            ([id, value]) => (
                              <TableRow key={id}>
                                <TableCell className="font-mono text-xs">{id}</TableCell>
                                <TableCell>{value}x</TableCell>
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
                  )}

                {settings.xpMultipliers.roles &&
                  Object.entries(settings.xpMultipliers.roles).length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold">Role Multipliers</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Role ID</TableHead>
                            <TableHead>Multiplier</TableHead>
                            <TableHead className="w-16" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(settings.xpMultipliers.roles).map(
                            ([id, value]) => (
                              <TableRow key={id}>
                                <TableCell className="font-mono text-xs">{id}</TableCell>
                                <TableCell>{value}x</TableCell>
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
                  )}
              </div>
            )}

            <Separator className="my-6" />

            <h4 className="mb-3 text-sm font-semibold">Add Multiplier</h4>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div>
                <Label>Type</Label>
                <Select value={multiplierType} onValueChange={(v) => setMultiplierType(v as "channels" | "roles")}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="channels">Channel</SelectItem>
                    <SelectItem value="roles">Role</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="multiplier-id">ID</Label>
                <Input
                  id="multiplier-id"
                  placeholder="Channel or Role ID"
                  value={multiplierId}
                  onChange={(e) => setMultiplierId(e.target.value)}
                  className="w-48"
                />
              </div>
              <div>
                <Label htmlFor="multiplier-value">Multiplier</Label>
                <Input
                  id="multiplier-value"
                  type="number"
                  min={0.1}
                  max={10}
                  step={0.1}
                  placeholder="e.g. 2"
                  value={multiplierValue}
                  onChange={(e) => setMultiplierValue(e.target.value)}
                  className="w-24"
                />
              </div>
              <Button
                onClick={handleAddMultiplier}
                disabled={updateSettings.isPending}
              >
                Add Multiplier
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
