import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ApiError } from "../../../lib/client";
import { PageHeader } from "../../../components/PageHeader";
import {
  useGiveaways,
  useCreateGiveaway,
  useEndGiveaway,
  useRerollGiveaway,
} from "../../../lib/hooks/useGiveaways";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Card } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Separator } from "../../../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { StatsCard } from "../../../components/StatsCard";

function formatTimeRemaining(endsAt: string): string {
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  const diff = end - now;

  if (diff <= 0) return "Ended";

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export function GiveawaysPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { t } = useTranslation("giveaways");
  const [activePage, setActivePage] = useState(1);
  const [pastPage, setPastPage] = useState(1);

  // Data
  const { data: activeData, isLoading: activeLoading } = useGiveaways(guildId, {
    active: true,
    page: activePage,
    limit: 10,
  });
  const { data: pastData, isLoading: pastLoading } = useGiveaways(guildId, {
    active: false,
    page: pastPage,
    limit: 10,
  });

  // Mutations
  const createGiveaway = useCreateGiveaway(guildId);
  const endGiveaway = useEndGiveaway(guildId);
  const rerollGiveaway = useRerollGiveaway(guildId);

  // Form state
  const [prize, setPrize] = useState("");
  const [channelId, setChannelId] = useState("");
  const [winnersCount, setWinnersCount] = useState("1");
  const [durationValue, setDurationValue] = useState("1");
  const [durationUnit, setDurationUnit] = useState("h");
  const [requiredRoleId, setRequiredRoleId] = useState("");

  const activeTotalPages = activeData
    ? Math.max(1, Math.ceil(activeData.total / 10))
    : 1;
  const pastTotalPages = pastData
    ? Math.max(1, Math.ceil(pastData.total / 10))
    : 1;

  function handleCreate() {
    if (!prize.trim()) {
      toast.error(t("toast.createFailed"));
      return;
    }
    if (!channelId.trim()) {
      toast.error(t("toast.createFailed"));
      return;
    }

    const dur = parseFloat(durationValue);
    if (!Number.isFinite(dur) || dur <= 0) {
      toast.error(t("toast.createFailed"));
      return;
    }

    const unitMultipliers: Record<string, number> = {
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
      w: 604_800_000,
    };
    const durationMs = dur * (unitMultipliers[durationUnit] ?? 3_600_000);

    const winners = parseInt(winnersCount, 10);
    if (!Number.isFinite(winners) || winners < 1 || winners > 20) {
      toast.error(t("toast.createFailed"));
      return;
    }

    const requiredRoleIds = requiredRoleId.trim()
      ? requiredRoleId
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    createGiveaway.mutate(
      {
        channelId: channelId.trim(),
        prize: prize.trim(),
        winners,
        durationMs,
        requiredRoleIds,
      },
      {
        onSuccess: () => {
          toast.success(t("toast.created"));
          setPrize("");
          setChannelId("");
          setWinnersCount("1");
          setDurationValue("1");
          setRequiredRoleId("");
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.createFailed")),
      },
    );
  }

  function handleEnd(id: number) {
    endGiveaway.mutate(id, {
      onSuccess: () => toast.success(t("toast.ended")),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : t("toast.endFailed")),
    });
  }

  function handleReroll(id: number) {
    rerollGiveaway.mutate(id, {
      onSuccess: () => toast.success(t("toast.rerolled")),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : t("toast.rerollFailed")),
    });
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
          label={t("stats.activeGiveaways")}
          value={activeLoading ? "..." : activeData?.total ?? 0}
        />
        <StatsCard
          label={t("stats.pastGiveaways")}
          value={pastLoading ? "..." : pastData?.total ?? 0}
        />
        <StatsCard
          label={t("stats.totalEntries")}
          value={activeLoading ? "..." : (activeData?.giveaways ?? []).reduce((sum, g) => sum + g.entrantIds.length, 0)}
        />
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">{t("statuses.active")}</TabsTrigger>
          <TabsTrigger value="past">{t("statuses.ended")}</TabsTrigger>
          <TabsTrigger value="create">{t("common:actions.create")}</TabsTrigger>
        </TabsList>

        {/* Active Giveaways */}
        <TabsContent value="active">
          <Card className="bg-surface-container p-6 glass-edge">
            {activeLoading ? (
              <p className="text-text-muted">{t("loading")}</p>
            ) : activeData && activeData.giveaways.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">{t("table.status")}</TableHead>
                        <TableHead>{t("table.prize")}</TableHead>
                        <TableHead>{t("table.winners")}</TableHead>
                        <TableHead>{t("table.entries")}</TableHead>
                        <TableHead>{t("table.endsIn")}</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeData.giveaways.map((g) => (
                        <TableRow key={g.id}>
                          <TableCell className="font-mono text-xs font-bold">
                            #{g.id}
                          </TableCell>
                          <TableCell className="font-medium">{g.prize}</TableCell>
                          <TableCell>{g.winners}</TableCell>
                          <TableCell>{g.entrantIds.length}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {formatTimeRemaining(g.endsAt)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleEnd(g.id)}
                              disabled={endGiveaway.isPending}
                            >
                              {t("actions.end")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {activeTotalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-text-muted">
                      Page {activePage} of {activeTotalPages} ({activeData.total} total)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                        disabled={activePage <= 1}
                      >
                        {t("common:actions.back")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setActivePage((p) => Math.min(activeTotalPages, p + 1))
                        }
                        disabled={activePage >= activeTotalPages}
                      >
                        {t("common:actions.next")}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-text-muted">{t("empty")}</p>
            )}
          </Card>
        </TabsContent>

        {/* Past Giveaways */}
        <TabsContent value="past">
          <Card className="bg-surface-container p-6 glass-edge">
            {pastLoading ? (
              <p className="text-text-muted">{t("loading")}</p>
            ) : pastData && pastData.giveaways.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">{t("table.status")}</TableHead>
                        <TableHead>{t("table.prize")}</TableHead>
                        <TableHead>{t("table.winners")}</TableHead>
                        <TableHead>{t("table.entries")}</TableHead>
                        <TableHead>{t("statuses.ended")}</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pastData.giveaways.map((g) => (
                        <TableRow key={g.id}>
                          <TableCell className="font-mono text-xs font-bold">
                            #{g.id}
                          </TableCell>
                          <TableCell className="font-medium">{g.prize}</TableCell>
                          <TableCell>
                            {g.winnerIds.length > 0
                              ? g.winnerIds.map((id) => id.slice(0, 8)).join(", ")
                              : t("common:labels.none")}
                          </TableCell>
                          <TableCell>{g.entrantIds.length}</TableCell>
                          <TableCell>
                            {new Date(g.endsAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReroll(g.id)}
                              disabled={rerollGiveaway.isPending}
                            >
                              {t("actions.reroll")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {pastTotalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-text-muted">
                      Page {pastPage} of {pastTotalPages} ({pastData.total} total)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPastPage((p) => Math.max(1, p - 1))}
                        disabled={pastPage <= 1}
                      >
                        {t("common:actions.back")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPastPage((p) => Math.min(pastTotalPages, p + 1))
                        }
                        disabled={pastPage >= pastTotalPages}
                      >
                        {t("common:actions.next")}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-text-muted">{t("empty")}</p>
            )}
          </Card>
        </TabsContent>

        {/* Create Giveaway */}
        <TabsContent value="create">
          <Card className="bg-surface-container p-6 glass-edge">
            <h3 className="mb-4 font-label text-lg font-semibold">{t("actions.create")}</h3>
            <p className="mb-6 text-sm text-text-muted">
              {t("subtitle")}
            </p>

            <div className="space-y-4">
              <div>
                <Label htmlFor="gw-prize">{t("form.prize")}</Label>
                <Input
                  id="gw-prize"
                  placeholder={t("form.prize")}
                  value={prize}
                  onChange={(e) => setPrize(e.target.value)}
                  maxLength={256}
                />
              </div>

              <div>
                <Label htmlFor="gw-channel">{t("form.channel")}</Label>
                <Input
                  id="gw-channel"
                  placeholder="e.g. 123456789012345678"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div>
                  <Label htmlFor="gw-duration">{t("form.duration")}</Label>
                  <Input
                    id="gw-duration"
                    type="number"
                    min={1}
                    placeholder="1"
                    value={durationValue}
                    onChange={(e) => setDurationValue(e.target.value)}
                    className="w-24"
                  />
                </div>
                <div>
                  <Label>{t("common:labels.type")}</Label>
                  <Select value={durationUnit} onValueChange={setDurationUnit}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="m">{t("common:time.minutes")}</SelectItem>
                      <SelectItem value="h">{t("common:time.hours")}</SelectItem>
                      <SelectItem value="d">{t("common:time.days")}</SelectItem>
                      <SelectItem value="w">{t("common:time.weeks")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="gw-winners">{t("form.winnersCount")}</Label>
                <Input
                  id="gw-winners"
                  type="number"
                  min={1}
                  max={20}
                  value={winnersCount}
                  onChange={(e) => setWinnersCount(e.target.value)}
                  className="w-24"
                />
              </div>

              <div>
                <Label htmlFor="gw-role">{t("form.requiredRole")} ({t("common:labels.optional")})</Label>
                <Input
                  id="gw-role"
                  placeholder="e.g. 123456789012345678"
                  value={requiredRoleId}
                  onChange={(e) => setRequiredRoleId(e.target.value)}
                />
              </div>

              <Separator />

              <Button
                onClick={handleCreate}
                disabled={createGiveaway.isPending}
              >
                {t("actions.create")}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
