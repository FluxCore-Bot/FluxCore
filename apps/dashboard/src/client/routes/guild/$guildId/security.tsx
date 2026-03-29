import { useState, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
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
  { value: "kick", label: "Kick" },
  { value: "ban", label: "Ban" },
  { value: "timeout", label: "Timeout" },
];

function ActionSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
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
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function eventTypeLabel(type: string): string {
  switch (type) {
    case "join_spike":
      return "Join Spike";
    case "account_age":
      return "Account Age";
    case "nuke_attempt":
      return "Nuke Attempt";
    case "lockdown":
      return "Lockdown";
    default:
      return type;
  }
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

function RaidEventRow({ event }: { event: RaidEventData }) {
  const date = new Date(event.triggeredAt);
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-surface-high/30 px-4 py-3">
      <div className="flex items-center gap-3">
        <Badge variant={eventTypeBadgeVariant(event.eventType)}>
          {eventTypeLabel(event.eventType)}
        </Badge>
        <div className="text-sm">
          {event.details.reason && (
            <span className="text-text-muted">{event.details.reason}</span>
          )}
          {event.details.action && (
            <span className="ml-2 text-xs text-text-muted">
              Action: {event.details.action}
            </span>
          )}
          {event.details.userIds && event.details.userIds.length > 0 && (
            <span className="ml-2 text-xs text-text-muted">
              Users: {event.details.userIds.length}
            </span>
          )}
          {event.details.ageDays !== undefined && (
            <span className="ml-2 text-xs text-text-muted">
              Account age: {event.details.ageDays}d
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
        onSuccess: () => toast.success("Anti-raid configuration saved"),
        onError: (err) =>
          toast.error(
            err instanceof ApiError ? err.message : "Failed to save configuration",
          ),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Security"
          subtitle="Configure anti-raid protection and server security settings."
        />
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Security"
        subtitle="Configure anti-raid protection and server security settings."
      />

      {/* Master Toggle */}
      <Card className="bg-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Anti-Raid Protection</h3>
            <p className="text-sm text-text-muted">
              Enable automatic detection and response to coordinated raids, suspicious accounts,
              and destructive actions.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </Card>

      <Tabs defaultValue="join-rate">
        <TabsList>
          <TabsTrigger value="join-rate">Join Rate</TabsTrigger>
          <TabsTrigger value="account-age">Account Age</TabsTrigger>
          <TabsTrigger value="anti-nuke">Anti-Nuke</TabsTrigger>
          <TabsTrigger value="lockdown">Lockdown</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        {/* Join Rate Detection */}
        <TabsContent value="join-rate">
          <Card className="bg-surface p-6">
            <h3 className="mb-2 text-lg font-semibold">Join Rate Detection</h3>
            <p className="mb-4 text-sm text-text-muted">
              Detect mass joins by monitoring the rate of new members joining.
            </p>

            <Separator className="mb-6" />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="join-threshold">Join Threshold</Label>
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
                  Number of joins to trigger detection
                </p>
              </div>

              <div>
                <Label htmlFor="join-window">Time Window (seconds)</Label>
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
                  Window in which joins are counted
                </p>
              </div>

              <div>
                <Label htmlFor="join-action">Action on Detection</Label>
                <div className="mt-1">
                  <ActionSelect id="join-action" value={joinAction} onChange={setJoinAction} />
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  Action to take on suspected raid members
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Account Age Filter */}
        <TabsContent value="account-age">
          <Card className="bg-surface p-6">
            <h3 className="mb-2 text-lg font-semibold">Account Age Filter</h3>
            <p className="mb-4 text-sm text-text-muted">
              Automatically action accounts that are younger than a minimum age. Set to 0 to
              disable.
            </p>

            <Separator className="mb-6" />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="account-age-days">Minimum Account Age (days)</Label>
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
                  0 = disabled. Accounts younger than this will be actioned.
                </p>
              </div>

              <div>
                <Label htmlFor="account-age-action">Action</Label>
                <div className="mt-1">
                  <ActionSelect
                    id="account-age-action"
                    value={accountAgeAction}
                    onChange={setAccountAgeAction}
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
                <h3 className="text-lg font-semibold">Anti-Nuke Protection</h3>
                <p className="text-sm text-text-muted">
                  Detect mass channel/role deletions and quarantine the responsible user by
                  removing all their roles.
                </p>
              </div>
              <Switch checked={antiNukeEnabled} onCheckedChange={setAntiNukeEnabled} />
            </div>

            <Separator className="mb-6" />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="nuke-threshold">Deletion Threshold</Label>
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
                  Number of deletions within 10 seconds to trigger quarantine
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
                <h3 className="text-lg font-semibold">Auto-Lockdown on Raid</h3>
                <p className="text-sm text-text-muted">
                  Automatically lock all channels when a raid is detected.
                </p>
              </div>
              <Switch checked={lockdownOnRaid} onCheckedChange={setLockdownOnRaid} />
            </div>

            <Separator className="mb-6" />

            <div className="space-y-6">
              <div>
                <Label htmlFor="whitelist-roles">Whitelisted Role IDs (comma-separated)</Label>
                <Input
                  id="whitelist-roles"
                  placeholder="123456789, 987654321"
                  value={whitelistedRoleIds}
                  onChange={(e) => setWhitelistedRoleIds(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-text-muted">
                  Members with these roles will be exempt from raid detection.
                </p>
              </div>

              <div>
                <Label htmlFor="log-channel">Log Channel ID</Label>
                <Input
                  id="log-channel"
                  placeholder="Channel ID for raid event logs..."
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
            <h3 className="mb-2 text-lg font-semibold">Recent Raid Events</h3>
            <p className="mb-4 text-sm text-text-muted">
              Timeline of detected raids, account age blocks, and lockdown events.
            </p>

            <Separator className="mb-6" />

            {eventsData && eventsData.events.length > 0 ? (
              <div className="space-y-2">
                {eventsData.events.map((event) => (
                  <RaidEventRow key={event.id} event={event} />
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
                      Previous
                    </Button>
                    <span className="text-xs text-text-muted">
                      Page {eventsPage} of {Math.ceil(eventsData.total / 20)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={eventsPage >= Math.ceil(eventsData.total / 20)}
                      onClick={() => setEventsPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                No raid events recorded yet. Events will appear here when raid detection
                triggers.
              </p>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={updateConfig.isPending}>
          {updateConfig.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
