import ContentLoader from "react-content-loader";

interface FormSkeletonProps {
  rows?: number;
}

export function FormSkeleton({ rows = 4 }: FormSkeletonProps) {
  const fieldHeight = 68;
  const totalHeight = rows * fieldHeight + 56;

  return (
    <ContentLoader
      speed={1.5}
      width="100%"
      height={totalHeight}
      viewBox={`0 0 800 ${totalHeight}`}
      backgroundColor="#0e0e10"
      foregroundColor="#252540"
      style={{ width: "100%" }}
    >
      {Array.from({ length: rows }).map((_, i) => {
        const y = i * fieldHeight;
        return (
          <g key={i}>
            {/* Label */}
            <rect x="0" y={y} rx="4" ry="4" width="120" height="16" />
            {/* Input */}
            <rect x="0" y={y + 24} rx="4" ry="4" width="400" height="36" />
          </g>
        );
      })}

      {/* Submit button */}
      <rect
        x="0"
        y={rows * fieldHeight + 16}
        rx="4"
        ry="4"
        width="120"
        height="36"
      />
    </ContentLoader>
  );
}
