import ContentLoader from "react-content-loader";

interface CardGridSkeletonProps {
  cards?: number;
  columns?: number;
}

export function CardGridSkeleton({
  cards = 6,
  columns = 3,
}: CardGridSkeletonProps) {
  const cardWidth = Math.floor((800 - (columns - 1) * 16) / columns);
  const cardHeight = 140;
  const gap = 16;
  const rowCount = Math.ceil(cards / columns);
  const totalHeight = rowCount * (cardHeight + gap);

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
      {Array.from({ length: cards }).map((_, i) => {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = col * (cardWidth + gap);
        const y = row * (cardHeight + gap);
        return (
          <rect
            key={i}
            x={x}
            y={y}
            rx="8"
            ry="8"
            width={cardWidth}
            height={cardHeight}
          />
        );
      })}
    </ContentLoader>
  );
}
