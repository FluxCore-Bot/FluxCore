import { LogsTable } from "../../../components/LogsTable";
import { PageHeader } from "../../../components/PageHeader";

export function LogsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Activity Logs"
        subtitle="Monitor rule executions and automated action history."
      />
      <LogsTable />
    </div>
  );
}
