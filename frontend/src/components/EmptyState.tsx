import type { ReactNode } from "react";

interface EmptyStateProps {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  /** "box" = dashed-border callout; "inset" = borderless copy inside a card. */
  variant?: "box" | "inset";
  className?: string;
}

/** Standardized empty-state block (dashed callout or borderless inset). */
export function EmptyState({
  title,
  children,
  action,
  variant = "box",
  className,
}: EmptyStateProps) {
  if (variant === "inset") {
    return (
      <div
        className={`px-4 py-6 text-sm text-icta-gray-600 ${className ?? ""}`.trim()}
      >
        {title ? <p className="font-medium text-icta-black">{title}</p> : null}
        {children}
        {action}
      </div>
    );
  }
  return (
    <div
      className={`rounded-md border border-dashed border-icta-gray-200 px-4 py-8 text-center ${className ?? ""}`.trim()}
    >
      {title ? (
        <p className="text-sm font-medium text-icta-black">{title}</p>
      ) : null}
      {children ? (
        <div className="mt-1 text-sm text-icta-gray-600">{children}</div>
      ) : null}
      {action ? (
        <div className="mt-3 flex justify-center">{action}</div>
      ) : null}
    </div>
  );
}
