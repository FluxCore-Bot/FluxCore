import ContentLoader from "react-content-loader";

export function SelectSkeleton() {
  return (
    <ContentLoader
      speed={1.5}
      width="100%"
      height={36}
      viewBox="0 0 400 36"
      backgroundColor="#0e0e10"
      foregroundColor="#252540"
      style={{ width: "100%" }}
    >
      <rect x="0" y="0" rx="4" ry="4" width="400" height="36" />
    </ContentLoader>
  );
}
