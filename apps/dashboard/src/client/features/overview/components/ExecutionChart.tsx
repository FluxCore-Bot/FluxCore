import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

interface ExecutionChartProps {
  data: Array<{ date: string; total: number; success: number; error: number }>;
}

function CustomTooltip({ active, payload, label, t }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string; t: TFunction }) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg bg-surface-high p-3 text-xs shadow-lg glass-edge">
      <p className="mb-1 font-label font-semibold text-text">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-text-muted">
          <span
            className="me-1.5 inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.dataKey === "success" ? "#57f287" : "#ff6e84" }}
          />
          {entry.dataKey === "success" ? t("executionChart.success") : t("executionChart.errors")}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export function ExecutionChart({ data }: ExecutionChartProps) {
  const { t } = useTranslation("overview");
  return (
    <div className="rounded-lg bg-surface-low p-6 glass-edge">
      <h3 className="mb-5 section-label text-text-muted">
        {t("executionChart.title")}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#57f287" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#57f287" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff6e84" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ff6e84" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="date"
              tick={{ fill: "rgba(249,245,248,0.4)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
            />
            <YAxis
              tick={{ fill: "rgba(249,245,248,0.4)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip t={t} />} />
            <Area
              type="monotone"
              dataKey="success"
              stroke="#57f287"
              strokeWidth={2}
              fill="url(#successGradient)"
            />
            <Area
              type="monotone"
              dataKey="error"
              stroke="#ff6e84"
              strokeWidth={2}
              fill="url(#errorGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
