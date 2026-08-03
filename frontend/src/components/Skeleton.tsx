import { cn } from "@/lib/utils"

/**
 * Shimmer placeholder for pending content.
 * Uses Tailwind's built-in animate-pulse for a modern, professional feel.
 * Compose with sizing utilities, e.g. `<Skeleton className="h-4 w-40 rounded-md" />`.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div 
      aria-hidden="true" 
      className={cn("animate-pulse rounded-md bg-icta-gray-100", className)} 
    />
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
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}
