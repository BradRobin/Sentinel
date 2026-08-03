import type { ReactNode } from "react";

interface ErrorStateProps {
  message: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  /** "compact" = px-3 py-2, for inline form errors. */
  compact?: boolean;
  /** Muted message copy (gray) instead of the red default — for scan-level errors with retry actions. */
  muted?: boolean;
  className?: string;
}

/** Standardized error alert — `role="alert"` red callout with optional hint/action. */
export function ErrorState({
  message,
  hint,
  action,
  compact,
  muted,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`rounded-md border border-icta-red/20 bg-icta-red/5 text-sm ${
        compact ? "px-3 py-2" : "px-4 py-3"
      } ${className ?? ""}`.trim()}
    >
      <p className={muted ? "text-icta-gray-600" : "text-icta-red"}>
        {message}
      </p>
      {hint ? (
        <div className="mt-1 block text-icta-gray-600">{hint}</div>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
