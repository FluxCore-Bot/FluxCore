import ContentLoader from "react-content-loader";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  const rowHeight = 48;
  const headerHeight = 40;
  const gap = 4;
  const totalHeight = headerHeight + gap + rows * (rowHeight + gap) + 16;
  const colWidth = Math.floor(760 / columns);

  return (
    <div className="rounded-lg bg-surface-low p-4 shadow-2xl glass-edge">
      <ContentLoader
        speed={1.5}
        width="100%"
        height={totalHeight}
        viewBox={`0 0 800 ${totalHeight}`}
        backgroundColor="#0e0e10"
        foregroundColor="#252540"
        style={{ width: "100%" }}
      >
        {/* Header row */}
        {Array.from({ length: columns }).map((_, c) => (
          <rect
            key={`h-${c}`}
            x={20 + c * colWidth}
            y="8"
            rx="4"
            ry="4"
            width={colWidth - 32}
            height="20"
          />
        ))}

        {/* Data rows */}
        {Array.from({ length: rows }).map((_, r) => {
          const y = headerHeight + gap + r * (rowHeight + gap);
          return Array.from({ length: columns }).map((_, c) => (
            <rect
              key={`r${r}-c${c}`}
              x={20 + c * colWidth}
              y={y + 14}
              rx="4"
              ry="4"
              width={colWidth - 32}
              height="20"
            />
          ));
        })}
      </ContentLoader>
    </div>
  );
}
