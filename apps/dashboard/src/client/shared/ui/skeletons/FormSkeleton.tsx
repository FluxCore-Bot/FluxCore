import { Skeleton } from "../skeleton";

interface FormSkeletonProps {
  rows?: number;
}

export function FormSkeleton({ rows = 4 }: FormSkeletonProps) {
  return (
    <div className="animate-pulse space-y-6">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <div>
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-1.5 h-3 w-56" />
          </div>
          {i % 3 === 0 ? (
            <Skeleton className="h-5 w-10 rounded-full" />
          ) : i % 3 === 1 ? (
            <Skeleton className="h-9 w-24 rounded-md" />
          ) : (
            <Skeleton className="h-9 w-40 rounded-md" />
          )}
        </div>
      ))}
      {/* Submit button */}
      <Skeleton className="h-9 w-28 rounded-md" />
    </div>
  );
}
