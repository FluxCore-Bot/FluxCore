import { Skeleton } from "../skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  const colWidths = generateColWidths(columns);

  return (
    <div className="animate-pulse">
      {/* Header row */}
      <div className="flex gap-4 border-b border-border/20 pb-3">
        {colWidths.map((w, i) => (
          <Skeleton key={i} className={`h-3 ${w}`} />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border/10 py-3.5">
          {colWidths.map((w, c) => (
            <Skeleton key={c} className={`h-4 ${w}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

function generateColWidths(columns: number): string[] {
  const pool = ["w-16", "w-20", "w-24", "w-32", "flex-1", "w-20", "w-16", "w-28"];
  return Array.from({ length: columns }, (_, i) => {
    if (i === 0) return "w-16";
    if (i === 1) return "flex-1";
    return pool[i % pool.length];
  });
}
