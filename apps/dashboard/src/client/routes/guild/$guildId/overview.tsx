import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useAnalytics } from "../../../lib/hooks/useAnalytics";
import { useConstants } from "../../../lib/hooks/useConstants";
import { PageHeader } from "../../../components/PageHeader";
import { PageSkeleton } from "../../../components/PageSkeleton";
import { StatsCard } from "../../../components/StatsCard";
import { ExecutionChart } from "../../../components/overview/ExecutionChart";
import { EventDistributionChart } from "../../../components/overview/EventDistributionChart";
import { RecentActivityFeed } from "../../../components/overview/RecentActivityFeed";
import { Button } from "../../../components/ui/button";

export function OverviewPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const [days, setDays] = useState(7);
  const { data: analytics, isLoading } = useAnalytics(guildId, days);
  const { data: constants } = useConstants();

  if (isLoading || !analytics) return <PageSkeleton />;

  const { summary } = analytics;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        subtitle="Monitor your automation performance and activity at a glance."
      />

      {/* Summary Stats (Stitch: module-oriented cards) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          label="Action Rules"
          value={summary.totalRules}
          accentColor="border-accent"
        />
        <StatsCard
          label="Active Now"
          value={summary.activeRules}
          accentColor="border-success"
          valueClassName="text-success"
        />
        <StatsCard
          label="Executions"
          value={summary.totalExecutions.toLocaleString()}
          accentColor="border-secondary"
        />
        <StatsCard
          label="Success Rate"
          value={`${summary.successRate}%`}
          accentColor={summary.successRate >= 90 ? "border-success" : "border-danger"}
          valueClassName={summary.successRate >= 90 ? "text-success" : "text-danger"}
        />
      </div>

      {/* Period Toggle */}
      <div className="flex gap-1">
        {[7, 30].map((d) => (
          <Button
            key={d}
            variant={days === d ? "default" : "ghost"}
            size="sm"
            onClick={() => setDays(d)}
          >
            {d}d
          </Button>
        ))}
        {summary.recentErrors > 0 && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-danger/10 px-3 py-1 text-xs font-medium text-danger">
            {summary.recentErrors} error{summary.recentErrors !== 1 ? "s" : ""} in last 24h
          </span>
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ExecutionChart data={analytics.executionTrend} />
        </div>
        <div>
          <EventDistributionChart
            data={analytics.eventDistribution}
            constants={constants}
          />
        </div>
      </div>

      {/* Recent Activity */}
      <RecentActivityFeed
        data={analytics.recentActivity}
        guildId={guildId}
        constants={constants}
      />
    </div>
  );
}
