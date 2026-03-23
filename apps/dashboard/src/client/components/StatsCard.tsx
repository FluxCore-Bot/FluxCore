interface StatsCardProps {
  label: string;
  value: string | number;
  accentColor?: string;
  valueClassName?: string;
}

export function StatsCard({ label, value, accentColor = "border-accent", valueClassName }: StatsCardProps) {
  return (
    <div className={`border-l-2 ${accentColor} bg-surface-low px-3 py-3 rounded-lg min-h-18 sm:px-5 sm:py-4 sm:min-h-22 glass-edge`}>
      <p className="section-label text-text-muted">{label}</p>
      <p className={`mt-1 font-mono text-xl font-bold sm:text-2xl ${valueClassName ?? ""}`}>{value}</p>
    </div>
  );
}
