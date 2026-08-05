import type { ReactNode } from "react";

interface EmptyStateProps {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  /** Optional leading icon shown in a soft tile above the copy. */
  icon?: ReactNode;
  /** "box" = dashed-border callout; "inset" = borderless copy inside a card. */
  variant?: "box" | "inset";
  className?: string;
}

/** Standardized empty-state block (dashed callout or borderless inset). */
export function EmptyState({
  title,
  children,
  action,
  icon,
  variant = "box",
  className,
}: EmptyStateProps) {
  if (variant === "inset") {
    return (
      <div
        className={`px-4 py-6 text-sm text-icta-gray-600 ${className ?? ""}`.trim()}
      >
        {title ? <p className="font-medium text-icta-gray-900">{title}</p> : null}
        {children}
        {action}
      </div>
    );
  }
  return (
    <div
      className={`flex flex-col items-center rounded-xl border border-dashed border-icta-gray-300 bg-white/60 px-6 py-10 text-center ${className ?? ""}`.trim()}
    >
      {icon ? (
        <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-icta-gray-100 text-icta-gray-500 ring-1 ring-inset ring-icta-gray-200/70">
          {icon}
        </span>
      ) : null}
      {title ? (
        <p className="text-sm font-medium text-icta-gray-900">{title}</p>
      ) : null}
      {children ? (
        <div className="mt-1 max-w-sm text-sm text-icta-gray-600">{children}</div>
      ) : null}
      {action ? (
        <div className="mt-4 flex justify-center">{action}</div>
      ) : null}
    </div>
  );
}
