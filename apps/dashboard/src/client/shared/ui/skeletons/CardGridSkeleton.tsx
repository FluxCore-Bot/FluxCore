import { Skeleton } from "../skeleton";

interface CardGridSkeletonProps {
  cards?: number;
  columns?: number;
}

export function CardGridSkeleton({
  cards = 6,
  columns = 3,
}: CardGridSkeletonProps) {
  return (
    <div
      className="animate-pulse grid grid-cols-1 gap-4"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="rounded-md border border-border/30 bg-surface-low p-5 space-y-3"
        >
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="mt-2 h-8 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}
