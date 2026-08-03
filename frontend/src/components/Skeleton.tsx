/**
 * Shimmer placeholder for pending content.
 * Wires the `.skeleton` CSS in globals.css (`@keyframes shimmer`).
 * Compose with sizing utilities, e.g. `<Skeleton className="h-4 w-40 rounded-md" />`.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`skeleton ${className ?? ""}`.trim()} />
  );
}

/** Stacked skeleton text lines for list/paragraph placeholders. */
export function SkeletonText({
  lines = 1,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`.trim()}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-4 rounded-md" />
      ))}
    </div>
  );
}
