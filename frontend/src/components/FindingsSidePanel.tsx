"use client";

import { useEffect } from "react";

import type { Finding } from "@/lib/api";
import { labelCategory } from "@/lib/findings";

interface FindingsSidePanelProps {
  open: boolean;
  title: string;
  subtitle?: string;
  findings: Finding[];
  onClose: () => void;
}

function statusClass(status: string): string {
  if (status === "pass") return "text-icta-green";
  if (status === "fail") return "text-icta-red";
  return "text-icta-gray-600";
}

export function FindingsSidePanel({
  open,
  title,
  subtitle,
  findings,
  onClose,
}: FindingsSidePanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
        aria-label={title}
        aria-hidden={!open}
      >
        <header className="flex items-start justify-between gap-4 border-b border-icta-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-icta-black">{title}</h2>
            {subtitle && (
              <p className="mt-1 text-sm text-icta-gray-600">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-icta-gray-600 hover:bg-icta-gray-50 hover:text-icta-black"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {findings.length === 0 ? (
            <p className="text-sm text-icta-gray-600">No findings in this view.</p>
          ) : (
            <ul className="space-y-4">
              {findings.map((f) => (
                <li
                  key={`${f.category}-${f.check_name}-${f.clause_reference}`}
                  className="border-b border-icta-gray-100 pb-4 last:border-0"
                >
                  <div className={`text-sm font-semibold ${statusClass(f.status)}`}>
                    [{f.status}] {f.check_name}
                  </div>
                  <div className="mt-1 text-xs text-icta-gray-600">
                    {labelCategory(f.category)} · clause {f.clause_reference} ·{" "}
                    {f.severity} · {f.automatability_type}
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded bg-icta-gray-50 p-2 text-xs text-icta-black">
                    {JSON.stringify(f.detail, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
