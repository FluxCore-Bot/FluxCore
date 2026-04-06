import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAnalytics } from "../../../features/overview/hooks/useAnalytics";
import { useConstants } from "../../../shared/hooks/useConstants";
import { PageHeader } from "../../../shared/components/PageHeader";
import { CardGridSkeleton } from "../../../shared/ui/skeletons";
import { StatsCard } from "../../../shared/components/StatsCard";
import { ExecutionChart } from "../../../features/overview/components/ExecutionChart";
import { EventDistributionChart } from "../../../features/overview/components/EventDistributionChart";
import { RecentActivityFeed } from "../../../features/overview/components/RecentActivityFeed";
import { Button } from "../../../shared/ui/button";

export function OverviewPage() {
  const { t } = useTranslation("overview");
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const [days, setDays] = useState(7);
  const { data: analytics, isLoading } = useAnalytics(guildId, days);
  const { data: constants } = useConstants();

  if (isLoading || !analytics) return <CardGridSkeleton />;

  const { summary } = analytics;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          label={t("stats.actionRules")}
          value={summary.totalRules}
          accentColor="border-accent"
        />
        <StatsCard
          label={t("stats.activeNow")}
          value={summary.activeRules}
          accentColor="border-success"
          valueClassName="text-success"
        />
        <StatsCard
          label={t("stats.executions")}
          value={summary.totalExecutions.toLocaleString()}
          accentColor="border-secondary"
        />
        <StatsCard
          label={t("stats.successRate")}
          value={`${summary.successRate}%`}
          accentColor={summary.successRate >= 90 ? "border-success" : "border-danger"}
          valueClassName={summary.successRate >= 90 ? "text-success" : "text-danger"}
        />
      </div>

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
          <span className="ms-auto flex items-center gap-1.5 rounded-full bg-danger/10 px-3 py-1 text-xs font-medium text-danger">
            {t("errorsInLast24h", { count: summary.recentErrors })}
          </span>
        )}
      </div>

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

      <RecentActivityFeed
        data={analytics.recentActivity}
        guildId={guildId}
        constants={constants}
      />
    </div>
  );
}
