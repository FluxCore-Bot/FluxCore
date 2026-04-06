import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LogsTable } from "../../../features/logging/components/LogsTable";
import { PageHeader } from "../../../shared/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../shared/ui/tabs";
import { EventLogConfig } from "../../../features/logging/components/EventLogConfig";
import { EventLogBrowser } from "../../../features/logging/components/EventLogBrowser";

export function LogsPage() {
  const { t } = useTranslation("logs");
  const [activeTab, setActiveTab] = useState("activity");

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="activity">{t("tabs.activity")}</TabsTrigger>
          <TabsTrigger value="events">{t("tabs.events")}</TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          <LogsTable />
        </TabsContent>

        <TabsContent value="events">
          <div className="space-y-8">
            <EventLogConfig />
            <EventLogBrowser />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
