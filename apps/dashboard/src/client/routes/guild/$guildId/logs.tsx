import { LogsTable } from "../../../components/LogsTable";

export function LogsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Activity Logs</h2>
        <p className="mt-1 text-sm text-text-muted">Monitor rule executions and automated action history.</p>
      </div>
      <LogsTable />
    </div>
  );
}
