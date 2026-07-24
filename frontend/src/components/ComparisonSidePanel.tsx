"use client";

import { useEffect, useMemo } from "react";

import type { ComparisonResponse } from "@/lib/api";
import { labelCategory } from "@/lib/findings";

/** Scored categories only — same order as scoring_weights / historical jsonb keys */
const SCORED_CATEGORIES = [
  "domain_identity",
  "security",
  "interoperability",
  "accessibility",
  "design_branding",
  "multimedia_performance",
  "legal_content",
  "seo",
] as const;

interface ComparisonSidePanelProps {
  open: boolean;
  comparison: ComparisonResponse | null;
  onClose: () => void;
}

function formatSigned(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (rounded > 0) return `+${rounded.toFixed(1)}`;
  if (rounded < 0) return rounded.toFixed(1);
  return "0.0";
}

function DeltaBadge({ delta }: { delta: number }) {
  const improved = delta > 0;
  const declined = delta < 0;
  const arrow = improved ? "↑" : declined ? "↓" : "→";
  const tone = improved
    ? "text-icta-green"
    : declined
      ? "text-icta-red"
      : "text-icta-gray-600";

  return (
    <span className={`inline-flex items-center gap-1 font-mono text-sm ${tone}`}>
      <span aria-hidden="true">{arrow}</span>
      <span>
        {formatSigned(delta)}
        <span className="sr-only">
          {improved ? " improved" : declined ? " declined" : " unchanged"}
        </span>
      </span>
    </span>
  );
}

export function ComparisonSidePanel({
  open,
  comparison,
  onClose,
}: ComparisonSidePanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const rows = useMemo(() => {
    if (!comparison?.has_history || !comparison.delta || !comparison.current || !comparison.previous) {
      return [];
    }
    const { current, previous, delta } = comparison;
    return [...SCORED_CATEGORIES]
      .map((key) => ({
        key,
        label: labelCategory(key),
        current: current.category_breakdown[key] ?? 0,
        previous: previous.category_breakdown[key] ?? 0,
        delta: delta.category_breakdown[key] ?? 0,
      }))
      // Largest declines first (most negative delta)
      .sort((a, b) => a.delta - b.delta);
  }, [comparison]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-icta-black/20 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-icta-gray-200 bg-white shadow-xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Compare to last quarter"
        aria-hidden={!open}
      >
        <header className="flex items-start justify-between gap-4 border-b border-icta-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-icta-black">
              Compare to last quarter
            </h2>
            {comparison?.has_history && comparison.current && comparison.previous && (
              <p className="mt-1 text-sm text-icta-gray-600">
                {comparison.previous.quarter} → {comparison.current.quarter}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-sm text-icta-gray-600 hover:bg-icta-gray-50 hover:text-icta-black"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!comparison?.has_history || !comparison.delta || !comparison.current || !comparison.previous ? (
            <p className="text-sm text-icta-gray-600">
              No historical data yet — check back next quarter.
            </p>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-icta-gray-600">
                  Overall compliance
                </p>
                <div className="mt-2 flex flex-wrap items-baseline gap-3">
                  <span className="text-3xl font-bold text-icta-black">
                    {comparison.current.overall_score.toFixed(1)}%
                  </span>
                  <DeltaBadge delta={comparison.delta.overall} />
                </div>
                <p className="mt-1 text-sm text-icta-gray-600">
                  Was {comparison.previous.overall_score.toFixed(1)}% in{" "}
                  {comparison.previous.quarter}
                </p>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-icta-black">
                  By category
                </h3>
                <p className="mb-3 text-xs text-icta-gray-600">
                  Sorted by largest decline first
                </p>
                <ul className="divide-y divide-icta-gray-100 border border-icta-gray-200">
                  {rows.map((row) => (
                    <li key={row.key} className="px-3 py-3 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-icta-black">
                          {row.label}
                        </span>
                        <DeltaBadge delta={row.delta} />
                      </div>
                      <div className="mt-1 font-mono text-xs text-icta-gray-600">
                        {row.previous.toFixed(1)}% → {row.current.toFixed(1)}%
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
