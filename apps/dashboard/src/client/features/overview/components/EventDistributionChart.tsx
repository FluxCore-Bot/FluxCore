import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { Constants } from "../../../shared/lib/schemas";

interface EventDistributionChartProps {
  data: Array<{ eventType: string; count: number }>;
  constants?: Constants;
}

const BAR_COLORS = [
  "#a3a6ff",
  "#ac8aff",
  "#57f287",
  "#ff6e84",
  "#ffa657",
  "#79e8c8",
  "#7dc4e4",
  "#f5a97f",
];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { label: string; count: number } }> }) {
  if (!active || !payload?.[0]) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg bg-surface-high p-3 text-xs shadow-lg glass-edge">
      <p className="font-label font-semibold text-text">{item.label}</p>
      <p className="text-text-muted">{item.count} executions</p>
    </div>
  );
}

export function EventDistributionChart({ data, constants }: EventDistributionChartProps) {
  const chartData = data.slice(0, 8).map((item) => ({
    ...item,
    label: constants?.eventTypes[item.eventType]?.label ?? item.eventType,
    shortLabel:
      (constants?.eventTypes[item.eventType]?.label ?? item.eventType).length > 12
        ? (constants?.eventTypes[item.eventType]?.label ?? item.eventType).slice(0, 12) + "..."
        : constants?.eventTypes[item.eventType]?.label ?? item.eventType,
  }));

  return (
    <div className="rounded-lg bg-surface-low p-6 glass-edge">
      <h3 className="mb-5 section-label text-text-muted">
        Top Events
      </h3>
      <div className="h-64">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-text-muted">
            No event data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
              <XAxis
                type="number"
                tick={{ fill: "rgba(249,245,248,0.4)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="shortLabel"
                tick={{ fill: "rgba(249,245,248,0.4)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={100}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {chartData.map((_, index) => (
                  <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
