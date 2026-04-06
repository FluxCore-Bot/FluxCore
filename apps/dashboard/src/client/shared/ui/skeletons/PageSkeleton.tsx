import ContentLoader from "react-content-loader";

interface PageSkeletonProps {
  cards?: number;
}

export function PageSkeleton({ cards = 2 }: PageSkeletonProps) {
  const cardHeight = 120;
  const cardGap = 16;
  const headerHeight = 64;
  const contentStart = headerHeight + 32;
  const totalHeight =
    contentStart + cards * cardHeight + (cards - 1) * cardGap + 16;

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
      {/* Page title */}
      <rect x="0" y="0" rx="4" ry="4" width="240" height="32" />
      {/* Subtitle */}
      <rect x="0" y="40" rx="4" ry="4" width="360" height="16" />

      {/* Cards */}
      {Array.from({ length: cards }).map((_, i) => {
        const y = contentStart + i * (cardHeight + cardGap);
        return (
          <rect
            key={i}
            x="0"
            y={y}
            rx="8"
            ry="8"
            width="800"
            height={cardHeight}
          />
        );
      })}
    </ContentLoader>
  );
}
