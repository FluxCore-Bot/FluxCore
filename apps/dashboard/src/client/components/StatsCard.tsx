interface StatsCardProps {
  label: string;
  value: string | number;
  accentColor?: string;
  valueClassName?: string;
}

export function StatsCard({ label, value, accentColor = "border-accent", valueClassName }: StatsCardProps) {
  return (
    <div className={`border-l-2 ${accentColor} bg-surface-low p-4 glass-edge`}>
      <p className="font-label text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className={`font-mono text-2xl font-bold ${valueClassName ?? ""}`}>{value}</p>
    </div>
  );
}
