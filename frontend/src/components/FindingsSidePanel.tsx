"use client";

import { useMemo } from "react";
import { X } from "lucide-react";

import { FindingDetailView } from "@/components/FindingDetailView";
import { ClauseLink } from "@/components/ClauseLink";
import type { Finding } from "@/lib/api";
import {
  badgeLabelForFinding,
  findingVisualWeight,
  labelCategory,
} from "@/lib/findings";
import {
  btnGhost,
  panelBackdrop,
  panelHeader,
  panelShell,
} from "@/lib/ui";
import { useSidePanel } from "@/hooks/useSidePanel";

interface FindingsSidePanelProps {
  open: boolean;
  title: string;
  subtitle?: string;
  findings: Finding[];
  onClose: () => void;
}

export function FindingsSidePanel({
  open,
  title,
  subtitle,
  findings,
  onClose,
}: FindingsSidePanelProps) {
  const panelRef = useSidePanel(open, onClose);

  const headerWeight = useMemo(() => {
    if (findings.length !== 1) return null;
    return findingVisualWeight(findings[0].status, findings[0].severity);
  }, [findings]);

  return (
    <>
      <div
        className={`${panelBackdrop} ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        ref={panelRef}
        className={`${panelShell} ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        tabIndex={-1}
      >
        <header
          className={`${panelHeader} ${headerWeight?.header ?? ""}`}
        >
          <div className="min-w-0">
            <h2
              className={`text-lg text-icta-black ${
                headerWeight?.name ?? "font-semibold"
              }`}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-sm text-icta-gray-600">{subtitle}</p>
            )}
            {findings.length === 1 && (
              <p className="mt-1 text-xs text-icta-gray-600">
                <span
                  className={`mr-2 inline-block rounded px-1.5 py-0.5 uppercase ${headerWeight?.badge ?? ""}`}
                >
                  {badgeLabelForFinding(findings[0])}
                </span>
                <span className={headerWeight?.severityLabel}>
                  {findings[0].severity}
                </span>{" "}
                severity ·{" "}
                <ClauseLink
                  clause={findings[0].clause_reference}
                  showPrefix
                />
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={btnGhost}
            aria-label="Close panel"
          >
            <X className="size-4" aria-hidden="true" />
            Close
          </button>
        </header>

        <div className="panel-content-in flex-1 overflow-y-auto px-5 py-4">
          {findings.length === 0 ? (
            <p className="text-sm text-icta-gray-600">No findings in this view.</p>
          ) : (
            <ul className="space-y-4">
              {findings.map((f) => {
                const weight = findingVisualWeight(f.status, f.severity);
                return (
                  <li
                    key={`${f.category}-${f.check_name}-${f.clause_reference}`}
                    className={`border-b border-icta-gray-100 pb-4 pl-3 last:border-0 ${weight.row}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs uppercase ${weight.badge}`}
                      >
                        {badgeLabelForFinding(f)}
                      </span>
                      <span className={`text-sm ${weight.name}`}>
                        {f.check_name}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-icta-gray-600">
                      {labelCategory(f.category)} ·{" "}
                      <ClauseLink clause={f.clause_reference} showPrefix /> ·{" "}
                      <span className={weight.severityLabel}>{f.severity}</span>{" "}
                      · {f.automatability_type}
                    </div>
                    <FindingDetailView detail={f.detail ?? {}} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
