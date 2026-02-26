import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useLogs } from "../lib/hooks/useLogs";
import { useConstants } from "../lib/hooks/useConstants";

export function LogsTable() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: constants } = useConstants();
  const [ruleFilter, setRuleFilter] = useState("");
  const { data: logs, isLoading } = useLogs(guildId, ruleFilter || undefined);

  if (isLoading) return <p className="text-text-muted">Loading...</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Action Logs</h3>
        <input
          type="text"
          value={ruleFilter}
          onChange={(e) => setRuleFilter(e.target.value)}
          placeholder="Filter by rule name..."
          className="w-64"
        />
      </div>

      {!logs || logs.length === 0 ? (
        <p className="py-10 text-center text-text-muted">No logs found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-text-muted">
                  Time
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-text-muted">
                  Rule
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-text-muted">
                  Event
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-text-muted">
                  Action
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium uppercase text-text-muted">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-text-muted">
                  Error
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border/50">
                  <td className="px-3 py-2 text-xs text-text-muted">
                    {new Date(log.executedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-sm">{log.ruleName}</td>
                  <td className="px-3 py-2 text-sm text-text-muted">
                    {constants?.eventTypes[log.eventType]?.label ??
                      log.eventType}
                  </td>
                  <td className="px-3 py-2 text-sm text-text-muted">
                    {constants?.actionTypes[log.actionType]?.label ??
                      log.actionType}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        log.success
                          ? "bg-success/20 text-success"
                          : "bg-danger/20 text-danger"
                      }`}
                    >
                      {log.success ? "OK" : "Error"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-danger">
                    {log.error ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
