import type { ReactNode } from "react";
import { AlertCircle, Info } from "lucide-react";

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
      className={`flex items-start gap-2.5 rounded-xl border text-sm ${
        muted
          ? "border-icta-gray-200 bg-icta-gray-50"
          : "border-icta-red/20 bg-icta-red-tint/80"
      } ${compact ? "px-3 py-2.5" : "px-4 py-3.5"} ${className ?? ""}`.trim()}
    >
      {muted ? (
        <Info className="mt-0.5 size-4 shrink-0 text-icta-gray-500" aria-hidden="true" />
      ) : (
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-icta-red" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className={muted ? "text-icta-gray-700" : "font-medium text-icta-red-deep"}>
          {message}
        </p>
        {hint ? (
          <div className="mt-1 text-icta-gray-600">{hint}</div>
        ) : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
