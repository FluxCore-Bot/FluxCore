import { Skeleton } from "../skeleton";

interface PageSkeletonProps {
  /** Number of stats cards to show (default: 3) */
  stats?: number;
  /** Whether to show a tab bar (default: true) */
  tabs?: boolean;
  /** Number of tab buttons (default: 3) */
  tabCount?: number;
  /** Content type below tabs (default: "table") */
  content?: "table" | "form" | "cards";
  /** Number of table rows or form fields (default: 5) */
  rows?: number;
}

export function PageSkeleton({
  stats = 3,
  tabs = true,
  tabCount = 3,
  content = "table",
  rows = 5,
}: PageSkeletonProps) {
  return (
    <div className="animate-pulse space-y-8">
      {/* PageHeader */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-8 w-56 sm:h-9" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
      </div>

      {/* Stats row */}
      {stats > 0 && (
        <div
          className="grid grid-cols-1 gap-4"
          style={{
            gridTemplateColumns: `repeat(${Math.min(stats, 4)}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: stats }).map((_, i) => (
            <StatsCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Tabs + content */}
      {tabs && (
        <div className="space-y-4">
          {/* Tab bar */}
          <div className="flex gap-1 rounded-md bg-surface-low p-1">
            {Array.from({ length: tabCount }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-sm" />
            ))}
          </div>

          {/* Tab content */}
          {content === "table" && <TableContentSkeleton rows={rows} />}
          {content === "form" && <FormContentSkeleton rows={rows} />}
          {content === "cards" && <CardContentSkeleton />}
        </div>
      )}
    </div>
  );
}

function StatsCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-md border border-border/30 bg-surface-low p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2.5 h-7 w-16 sm:h-8" />
        </div>
        <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
      </div>
    </div>
  );
}

function TableContentSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-md border border-border/30 bg-surface-container p-6">
      {/* Table header */}
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      {/* Header row */}
      <div className="flex gap-4 border-b border-border/20 pb-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-24 flex-1" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border/10 py-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-32 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

function FormContentSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-md border border-border/30 bg-surface-container p-6 space-y-6">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <div>
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-1.5 h-3 w-56" />
          </div>
          {i % 2 === 0 ? (
            <Skeleton className="h-5 w-10 rounded-full" />
          ) : (
            <Skeleton className="h-9 w-24 rounded-md" />
          )}
        </div>
      ))}
    </div>
  );
}

function CardContentSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-md border border-border/30 bg-surface-low p-5 space-y-3"
        >
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
