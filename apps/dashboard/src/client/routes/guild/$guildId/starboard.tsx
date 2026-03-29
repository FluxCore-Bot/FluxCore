import { useState, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiError } from "../../../lib/client";
import { PageHeader } from "../../../components/PageHeader";
import {
  useStarboardSettings,
  useUpdateStarboardSettings,
  useStarboardEntries,
} from "../../../lib/hooks/useStarboard";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Card } from "../../../components/ui/card";
import { Switch } from "../../../components/ui/switch";
import { Separator } from "../../../components/ui/separator";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Badge } from "../../../components/ui/badge";
import { Icon } from "../../../components/Icon";

export function StarboardPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: settings, isLoading } = useStarboardSettings(guildId);
  const updateSettings = useUpdateStarboardSettings(guildId);
  const [page, setPage] = useState(1);
  const { data: entriesData, isLoading: entriesLoading } = useStarboardEntries(guildId, page);

  // Local state for form
  const [enabled, setEnabled] = useState(true);
  const [channelId, setChannelId] = useState("");
  const [emoji, setEmoji] = useState("\u2B50");
  const [threshold, setThreshold] = useState(3);
  const [selfStar, setSelfStar] = useState(false);
  const [ignoredChannels, setIgnoredChannels] = useState("");
  const [nsfwHandling, setNsfwHandling] = useState<"ignore" | "separate">("ignore");

  // Sync from server
  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setChannelId(settings.channelId ?? "");
      setEmoji(settings.emoji);
      setThreshold(settings.threshold);
      setSelfStar(settings.selfStar);
      setIgnoredChannels(settings.ignoredChannels.join(", "));
      setNsfwHandling(settings.nsfwHandling);
    }
  }, [settings]);

  function handleSave() {
    const ignored = ignoredChannels
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    updateSettings.mutate(
      {
        enabled,
        channelId: channelId || null,
        emoji,
        threshold,
        selfStar,
        ignoredChannels: ignored,
        nsfwHandling,
      },
      {
        onSuccess: () => toast.success("Starboard settings saved"),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Failed to save settings"),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Starboard"
          subtitle="Automatically highlight popular messages in a dedicated channel."
        />
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  const totalPages = entriesData ? Math.ceil(entriesData.total / 20) : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Starboard"
        subtitle="Automatically highlight popular messages in a dedicated channel."
      />

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="entries">Starred Messages</TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card className="bg-surface p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Starboard Configuration</h3>
                <p className="text-sm text-text-muted">
                  Messages that receive enough star reactions will be posted to your starboard
                  channel.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <Separator className="mb-6" />

            <div className="space-y-6">
              {/* Channel */}
              <div>
                <Label htmlFor="starboard-channel">Starboard Channel ID</Label>
                <Input
                  id="starboard-channel"
                  placeholder="Channel ID..."
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  className="mt-1 w-64"
                />
                <p className="mt-1 text-xs text-text-muted">
                  The channel where starred messages will be posted.
                </p>
              </div>

              {/* Emoji & Threshold */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="starboard-emoji">Star Emoji</Label>
                  <Input
                    id="starboard-emoji"
                    placeholder="\u2B50"
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    The emoji users react with to star a message. Default: star.
                  </p>
                </div>
                <div>
                  <Label htmlFor="starboard-threshold">Star Threshold</Label>
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
                    Number of reactions needed for a message to be starred.
                  </p>
                </div>
              </div>

              {/* Self-star toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Allow Self-Star</p>
                  <p className="text-sm text-text-muted">
                    Whether message authors can star their own messages.
                  </p>
                </div>
                <Switch checked={selfStar} onCheckedChange={setSelfStar} />
              </div>

              {/* Ignored Channels */}
              <div>
                <Label htmlFor="starboard-ignored">Ignored Channel IDs</Label>
                <Input
                  id="starboard-ignored"
                  placeholder="123456789, 987654321"
                  value={ignoredChannels}
                  onChange={(e) => setIgnoredChannels(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-text-muted">
                  Comma-separated list of channel IDs to exclude from starboard.
                </p>
              </div>

              {/* NSFW Handling */}
              <div>
                <Label>NSFW Channel Handling</Label>
                <Select value={nsfwHandling} onValueChange={(v) => setNsfwHandling(v as "ignore" | "separate")}>
                  <SelectTrigger className="mt-1 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ignore">Ignore NSFW</SelectItem>
                    <SelectItem value="separate">Allow NSFW</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-text-muted">
                  Whether messages from NSFW channels can appear on the starboard.
                </p>
              </div>
            </div>
          </Card>

          <div className="mt-6 flex gap-3">
            <Button onClick={handleSave} disabled={updateSettings.isPending}>
              {updateSettings.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </TabsContent>

        {/* Starred Messages Tab */}
        <TabsContent value="entries">
          <Card className="bg-surface p-6">
            <h3 className="mb-2 text-lg font-semibold">Starred Messages</h3>
            <p className="mb-4 text-sm text-text-muted">
              Browse all messages that have been starred in this server.
            </p>

            <Separator className="mb-4" />

            {entriesLoading ? (
              <p className="text-text-muted">Loading entries...</p>
            ) : !entriesData?.entries.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Icon name="star" size={48} className="mb-3 text-text-muted/30" />
                <p className="text-text-muted">No starred messages yet.</p>
                <p className="text-sm text-text-muted/60">
                  Messages will appear here once they receive enough star reactions.
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Message ID</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Stars</TableHead>
                      <TableHead>Date</TableHead>
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
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
