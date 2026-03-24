import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { LogsTable } from "../../../components/LogsTable";
import { PageHeader } from "../../../components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import { EventLogConfig } from "../../../components/EventLogConfig";
import { EventLogBrowser } from "../../../components/EventLogBrowser";

export function LogsPage() {
  const [activeTab, setActiveTab] = useState("activity");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Logs"
        subtitle="Monitor rule executions and event logging."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="activity">Activity Logs</TabsTrigger>
          <TabsTrigger value="events">Event Logs</TabsTrigger>
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
