interface StatsCardProps {
  label: string;
  value: string | number;
  accentColor?: string;
  valueClassName?: string;
}

export function StatsCard({ label, value, accentColor = "border-accent", valueClassName }: StatsCardProps) {
  return (
    <div className={`border-l-2 ${accentColor} bg-surface-low px-5 py-4 rounded-lg min-h-22 glass-edge`}>
      <p className="section-label text-text-muted">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold ${valueClassName ?? ""}`}>{value}</p>
    </div>
  );
}
