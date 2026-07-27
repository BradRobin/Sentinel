"use client";

import { useEffect, useState, type FormEvent } from "react";

import type {
  ManualReviewCheckType,
  ManualReviewQueueItem,
  ManualReviewResolvedStatus,
} from "@/lib/api";
import { resolveManualReviewItem } from "@/lib/api";
import { btnGhost, btnPrimary, btnSecondary, inputBase, inputError } from "@/lib/ui";
import {
  panelBackdrop,
  panelHeader,
  panelShell,
} from "@/lib/ui";
import { ClauseLink } from "@/components/ClauseLink";

interface ManualReviewResolutionPanelProps {
  open: boolean;
  item: ManualReviewQueueItem | null;
  officerId: string;
  onClose: () => void;
  onResolved: () => void;
}

function liveSiteLabel(checkType: ManualReviewCheckType): string | null {
  return checkType === "site_inspection" ? "Open live site" : null;
}

export function ManualReviewResolutionPanel({
  open,
  item,
  officerId,
  onClose,
  onResolved,
}: ManualReviewResolutionPanelProps) {
  const [status, setStatus] = useState<ManualReviewResolvedStatus>("pass");
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<string | null>(null);

  const minJustificationLen = 15;

  // Reset form when selecting a new item.
  useEffect(() => {
    if (!item) return;
    setStatus("pass");
    setJustification("");
    setError(null);
  }, [item?.id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = justification.trim();
    if (trimmed.length < minJustificationLen) {
      setError(`Justification must be at least ${minJustificationLen} characters.`);
      return;
    }
    try {
      await resolveManualReviewItem({
        officerId,
        itemId: item!.id,
        current_status: status,
        justification: trimmed,
      });
      onClose();
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve item");
    }
  }

  const liveSiteUrl = item?.domain_url ?? null;
  const liveSiteCta = item ? liveSiteLabel(item.check_type) : null;

  return (
    <>
      <div
        className={`${panelBackdrop} ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`${panelShell} ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Resolve manual review item"
        aria-hidden={!open}
      >
        <header className={panelHeader}>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-icta-black">
              Resolve manual review
            </h2>
            {item && (
              <p className="mt-1 text-sm text-icta-gray-600">
                <ClauseLink clause={item.clause_reference} showPrefix /> ·{" "}
                {item.check_name}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={btnGhost}
            aria-label="Close panel"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!item ? (
            <p className="text-sm text-icta-gray-600">Select an item from the queue.</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-icta-black">
                  {item.question_title}
                </h3>
                <p className="mt-1 text-xs text-icta-gray-600">
                  Domain: <span className="font-medium">{item.domain_url}</span>
                </p>
                {liveSiteUrl && liveSiteCta && (
                  <div className="mt-3">
                    <a
                      href={liveSiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={btnSecondary}
                    >
                      {liveSiteCta}
                    </a>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-icta-gray-600">
                  Resolution outcome
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["pass", "fail", "flagged"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setStatus(v)}
                      className={
                        status === v ? btnPrimary : btnSecondary
                      }
                      aria-pressed={status === v}
                    >
                      {v === "pass" ? "Pass" : v === "fail" ? "Fail" : "Flagged"}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-icta-gray-600">
                  A justification is required to record officer judgment.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium uppercase tracking-wide text-icta-gray-600">
                  Justification
                </label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className={`${inputBase} h-28 resize-none ${
                    error ? inputError : ""
                  }`}
                />
                <p className="text-xs text-icta-gray-600">
                  Minimum {minJustificationLen} characters.
                </p>
              </div>

              {error && (
                <div
                  className="rounded-md border border-icta-red/20 bg-icta-red/5 px-4 py-3 text-sm text-icta-red"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <button type="submit" className={btnPrimary}>
                  Save resolution
                </button>
                <button type="button" className={btnGhost} onClick={onClose}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </aside>
    </>
  );
}

