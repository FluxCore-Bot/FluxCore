import { useState, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ApiError } from "../../../lib/client";
import { PageHeader } from "../../../components/PageHeader";
import {
  useAntiRaidConfig,
  useUpdateAntiRaidConfig,
  useRaidEvents,
  type RaidEventData,
} from "../../../lib/hooks/useAntiRaid";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Card } from "../../../components/ui/card";
import { Switch } from "../../../components/ui/switch";
import { Separator } from "../../../components/ui/separator";
import { Badge } from "../../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";

const ACTION_OPTIONS = [
  { value: "kick", labelKey: "joinRate.actions.kick" },
  { value: "ban", labelKey: "joinRate.actions.ban" },
  { value: "timeout", labelKey: "joinRate.actions.timeout" },
];

function ActionSelect({
  value,
  onChange,
  id,
  t,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
  t: (key: string) => string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
    >
      {ACTION_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {t(opt.labelKey)}
        </option>
      ))}
    </select>
  );
}

function eventTypeLabel(type: string, t: (key: string) => string): string {
  const key = `raidEventTypes.${type}`;
  const translated = t(key);
  // If the key doesn't exist, t() returns the key itself — fall back to raw type
  return translated === key ? type : translated;
}

function eventTypeBadgeVariant(
  type: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (type) {
    case "join_spike":
      return "destructive";
    case "nuke_attempt":
      return "destructive";
    case "account_age":
      return "secondary";
    case "lockdown":
      return "outline";
    default:
      return "default";
  }
}

function RaidEventRow({ event, t }: { event: RaidEventData; t: (key: string, opts?: Record<string, unknown>) => string }) {
  const date = new Date(event.triggeredAt);
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-surface-high/30 px-4 py-3">
      <div className="flex items-center gap-3">
        <Badge variant={eventTypeBadgeVariant(event.eventType)}>
          {eventTypeLabel(event.eventType, t)}
        </Badge>
        <div className="text-sm">
          {event.details.reason && (
            <span className="text-text-muted">{event.details.reason}</span>
          )}
          {event.details.action && (
            <span className="ms-2 text-xs text-text-muted">
              {t("events.actionLabel", { action: event.details.action })}
            </span>
          )}
          {event.details.userIds && event.details.userIds.length > 0 && (
            <span className="ms-2 text-xs text-text-muted">
              {t("events.usersLabel", { count: event.details.userIds.length })}
            </span>
          )}
          {event.details.ageDays !== undefined && (
            <span className="ms-2 text-xs text-text-muted">
              {t("events.accountAgeLabel", { days: event.details.ageDays })}
            </span>
          )}
        </div>
      </div>
      <span className="text-xs text-text-muted">
        {date.toLocaleDateString()} {date.toLocaleTimeString()}
      </span>
    </div>
  );
}

export function SecurityPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { t } = useTranslation("security");
  const { data: config, isLoading } = useAntiRaidConfig(guildId);
  const updateConfig = useUpdateAntiRaidConfig(guildId);
  const [eventsPage, setEventsPage] = useState(1);
  const { data: eventsData } = useRaidEvents(guildId, eventsPage);

  // Local form state
  const [enabled, setEnabled] = useState(false);
  const [joinThreshold, setJoinThreshold] = useState("10");
  const [joinWindow, setJoinWindow] = useState("10");
  const [joinAction, setJoinAction] = useState("kick");
  const [accountAgeMinDays, setAccountAgeMinDays] = useState("0");
  const [accountAgeAction, setAccountAgeAction] = useState("kick");
  const [antiNukeEnabled, setAntiNukeEnabled] = useState(false);
  const [antiNukeThreshold, setAntiNukeThreshold] = useState("3");
  const [lockdownOnRaid, setLockdownOnRaid] = useState(false);
  const [whitelistedRoleIds, setWhitelistedRoleIds] = useState("");
  const [logChannelId, setLogChannelId] = useState("");

  // Sync from server
  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setJoinThreshold(String(config.joinThreshold));
      setJoinWindow(String(config.joinWindow));
      setJoinAction(config.joinAction);
      setAccountAgeMinDays(String(config.accountAgeMinDays));
      setAccountAgeAction(config.accountAgeAction);
      setAntiNukeEnabled(config.antiNukeEnabled);
      setAntiNukeThreshold(String(config.antiNukeThreshold));
      setLockdownOnRaid(config.lockdownOnRaid);
      setWhitelistedRoleIds(config.whitelistedRoleIds.join(", "));
      setLogChannelId(config.logChannelId ?? "");
    }
  }, [config]);

  function handleSave() {
    const roleIds = whitelistedRoleIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    updateConfig.mutate(
      {
        enabled,
        joinThreshold: parseInt(joinThreshold, 10) || 10,
        joinWindow: parseInt(joinWindow, 10) || 10,
        joinAction,
        accountAgeMinDays: parseInt(accountAgeMinDays, 10) || 0,
        accountAgeAction,
        antiNukeEnabled,
        antiNukeThreshold: parseInt(antiNukeThreshold, 10) || 3,
        lockdownOnRaid,
        whitelistedRoleIds: roleIds,
        logChannelId: logChannelId || null,
      },
      {
        onSuccess: () => toast.success(t("toast.saved")),
        onError: (err) =>
          toast.error(
            err instanceof ApiError ? err.message : t("toast.saveFailed"),
          ),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <PageHeader
          title={t("title")}
          subtitle={t("subtitle")}
        />
        <p className="text-text-muted">{t("common:actions.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />

      {/* Master Toggle */}
      <Card className="bg-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{t("antiRaid.title")}</h3>
            <p className="text-sm text-text-muted">
              {t("antiRaid.description")}
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </Card>

      <Tabs defaultValue="join-rate">
        <TabsList>
          <TabsTrigger value="join-rate">{t("sections.joinRate")}</TabsTrigger>
          <TabsTrigger value="account-age">{t("sections.accountAge")}</TabsTrigger>
          <TabsTrigger value="anti-nuke">{t("sections.antiNuke")}</TabsTrigger>
          <TabsTrigger value="lockdown">{t("sections.lockdown")}</TabsTrigger>
          <TabsTrigger value="events">{t("sections.events")}</TabsTrigger>
        </TabsList>

        {/* Join Rate Detection */}
        <TabsContent value="join-rate">
          <Card className="bg-surface p-6">
            <h3 className="mb-2 text-lg font-semibold">{t("joinRate.title")}</h3>
            <p className="mb-4 text-sm text-text-muted">
              {t("joinRate.description")}
            </p>

            <Separator className="mb-6" />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="join-threshold">{t("joinRate.threshold")}</Label>
                <Input
                  id="join-threshold"
                  type="number"
                  min={2}
                  max={100}
                  value={joinThreshold}
                  onChange={(e) => setJoinThreshold(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-text-muted">
                  {t("joinRate.thresholdHint")}
                </p>
              </div>

              <div>
                <Label htmlFor="join-window">{t("joinRate.window")}</Label>
                <Input
                  id="join-window"
                  type="number"
                  min={1}
                  max={120}
                  value={joinWindow}
                  onChange={(e) => setJoinWindow(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-text-muted">
                  {t("joinRate.windowHint")}
                </p>
              </div>

              <div>
                <Label htmlFor="join-action">{t("joinRate.action")}</Label>
                <div className="mt-1">
                  <ActionSelect id="join-action" value={joinAction} onChange={setJoinAction} t={t} />
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {t("joinRate.actionHint")}
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Account Age Filter */}
        <TabsContent value="account-age">
          <Card className="bg-surface p-6">
            <h3 className="mb-2 text-lg font-semibold">{t("accountAge.title")}</h3>
            <p className="mb-4 text-sm text-text-muted">
              {t("accountAge.description")}
            </p>

            <Separator className="mb-6" />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="account-age-days">{t("accountAge.minAge")}</Label>
                <Input
                  id="account-age-days"
                  type="number"
                  min={0}
                  max={365}
                  value={accountAgeMinDays}
                  onChange={(e) => setAccountAgeMinDays(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-text-muted">
                  {t("accountAge.minAgeHint")}
                </p>
              </div>

              <div>
                <Label htmlFor="account-age-action">{t("accountAge.action")}</Label>
                <div className="mt-1">
                  <ActionSelect
                    id="account-age-action"
                    value={accountAgeAction}
                    onChange={setAccountAgeAction}
                    t={t}
                  />
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Anti-Nuke */}
        <TabsContent value="anti-nuke">
          <Card className="bg-surface p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{t("antiNuke.title")}</h3>
                <p className="text-sm text-text-muted">
                  {t("antiNuke.description")}
                </p>
              </div>
              <Switch checked={antiNukeEnabled} onCheckedChange={setAntiNukeEnabled} />
            </div>

            <Separator className="mb-6" />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="nuke-threshold">{t("antiNuke.threshold")}</Label>
                <Input
                  id="nuke-threshold"
                  type="number"
                  min={1}
                  max={20}
                  value={antiNukeThreshold}
                  onChange={(e) => setAntiNukeThreshold(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-text-muted">
                  {t("antiNuke.thresholdHint")}
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Lockdown & Whitelist */}
        <TabsContent value="lockdown">
          <Card className="bg-surface p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{t("lockdown.title")}</h3>
                <p className="text-sm text-text-muted">
                  {t("lockdown.description")}
                </p>
              </div>
              <Switch checked={lockdownOnRaid} onCheckedChange={setLockdownOnRaid} />
            </div>

            <Separator className="mb-6" />

            <div className="space-y-6">
              <div>
                <Label htmlFor="whitelist-roles">{t("lockdown.whitelistedRoles")}</Label>
                <Input
                  id="whitelist-roles"
                  placeholder={t("lockdown.whitelistedRolesPlaceholder")}
                  value={whitelistedRoleIds}
                  onChange={(e) => setWhitelistedRoleIds(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-text-muted">
                  {t("lockdown.whitelistedRolesHint")}
                </p>
              </div>

              <div>
                <Label htmlFor="log-channel">{t("lockdown.logChannel")}</Label>
                <Input
                  id="log-channel"
                  placeholder={t("lockdown.logChannelPlaceholder")}
                  value={logChannelId}
                  onChange={(e) => setLogChannelId(e.target.value)}
                  className="mt-1 w-64"
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Recent Events */}
        <TabsContent value="events">
          <Card className="bg-surface p-6">
            <h3 className="mb-2 text-lg font-semibold">{t("events.title")}</h3>
            <p className="mb-4 text-sm text-text-muted">
              {t("events.description")}
            </p>

            <Separator className="mb-6" />

            {eventsData && eventsData.events.length > 0 ? (
              <div className="space-y-2">
                {eventsData.events.map((event) => (
                  <RaidEventRow key={event.id} event={event} t={t} />
                ))}

                {/* Pagination */}
                {eventsData.total > 20 && (
                  <div className="flex items-center justify-between pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={eventsPage <= 1}
                      onClick={() => setEventsPage((p) => Math.max(1, p - 1))}
                    >
                      {t("pagination.previous")}
                    </Button>
                    <span className="text-xs text-text-muted">
                      {t("pagination.page", { current: eventsPage, total: Math.ceil(eventsData.total / 20) })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={eventsPage >= Math.ceil(eventsData.total / 20)}
                      onClick={() => setEventsPage((p) => p + 1)}
                    >
                      {t("pagination.next")}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                {t("events.empty")}
              </p>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={updateConfig.isPending}>
          {updateConfig.isPending ? t("saveButton.saving") : t("saveButton.save")}
        </Button>
      </div>
    </div>
  );
}
