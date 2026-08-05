"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, ExternalLink, Flag, X, XCircle } from "lucide-react";

import type {
  ManualReviewCheckType,
  ManualReviewQueueItem,
  ManualReviewResolvedStatus,
} from "@/lib/api";
import { resolveManualReviewItem } from "@/lib/api";
import {
  btnDanger,
  btnGhost,
  btnPrimary,
  btnSecondary,
  inputBase,
  inputError,
  panelBackdrop,
  panelHeader,
  panelShell,
} from "@/lib/ui";
import { ClauseLink } from "@/components/ClauseLink";
import { ErrorState } from "@/components/ErrorState";
import { Spinner } from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import { getReviewGuide } from "@/lib/manualReviewGuides";
import { useSidePanel } from "@/hooks/useSidePanel";

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
  const { toast } = useToast();
  const panelRef = useSidePanel(open, onClose);
  const [status, setStatus] = useState<ManualReviewResolvedStatus>("pass");
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>(
    {},
  );
  const [liveSiteOpened, setLiveSiteOpened] = useState(false);
  const [saving, setSaving] = useState(false);

  const minJustificationLen = 15;

  const guide = useMemo(
    () => (item ? getReviewGuide(item.check_name, item.check_type) : null),
    [item],
  );

  const allStepsDone = useMemo(() => {
    if (!guide) return false;
    return guide.steps.every((step) => {
      if (step.requiresLiveSite) {
        return liveSiteOpened && Boolean(completedSteps[step.id]);
      }
      return Boolean(completedSteps[step.id]);
    });
  }, [guide, completedSteps, liveSiteOpened]);

  const remainingCount = useMemo(() => {
    if (!guide) return 0;
    return guide.steps.filter((step) => {
      if (step.requiresLiveSite) {
        return !(liveSiteOpened && completedSteps[step.id]);
      }
      return !completedSteps[step.id];
    }).length;
  }, [guide, completedSteps, liveSiteOpened]);

  function toggleStep(stepId: string, requiresLiveSite?: boolean) {
    if (requiresLiveSite && !liveSiteOpened) {
      setError("Open the live site first, then mark that step complete.");
      return;
    }
    setError(null);
    setCompletedSteps((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!allStepsDone) {
      setError(
        `Complete all ${guide?.steps.length ?? 0} guided review steps before resolving.`,
      );
      return;
    }
    const trimmed = justification.trim();
    if (trimmed.length < minJustificationLen) {
      setError(`Justification must be at least ${minJustificationLen} characters.`);
      return;
    }
    setSaving(true);
    try {
      await resolveManualReviewItem({
        officerId,
        itemId: item!.id,
        current_status: status,
        justification: trimmed,
      });
      toast({
        title: "Resolution saved",
        description: `${item!.domain_url} — marked ${status}. The queue has been updated.`,
        variant: "success",
      });
      onClose();
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve item");
    } finally {
      setSaving(false);
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
        ref={panelRef}
        className={`${panelShell} ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Resolve manual review item"
        aria-hidden={!open}
        tabIndex={-1}
      >
        <header className={panelHeader}>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-icta-gray-900">
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
            <X className="size-4" aria-hidden="true" />
            Close
          </button>
        </header>

        <div className="panel-content-in flex-1 overflow-y-auto px-5 py-4">
          {!item || !guide ? (
            <p className="text-sm text-icta-gray-600">Select an item from the queue.</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-icta-gray-900">
                  {item.question_title}
                </h3>
                <p className="mt-1 text-xs text-icta-gray-600">
                  Domain: <span className="font-medium">{item.domain_url}</span>
                </p>
                <p className="mt-1 text-xs text-icta-gray-600">
                  {item.check_type === "site_inspection"
                    ? "Type: live site inspection"
                    : "Type: institutional attestation (evidence required)"}
                </p>
              </div>

              <section className="space-y-3 rounded-md border border-icta-gray-200 bg-icta-gray-50 p-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-icta-gray-600">
                    What to verify
                  </p>
                  <p className="mt-1 text-sm text-icta-gray-900">{guide.summary}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-icta-gray-600">
                    How to decide
                  </p>
                  <p className="mt-1 text-sm text-icta-gray-600">{guide.howToDecide}</p>
                </div>
              </section>

              {liveSiteUrl && liveSiteCta && (
                <div>
                  <a
                    href={liveSiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={btnSecondary}
                    onClick={() => {
                      setLiveSiteOpened(true);
                      setCompletedSteps((prev) => {
                        const liveStep = guide.steps.find((s) => s.requiresLiveSite);
                        if (!liveStep) return prev;
                        return { ...prev, [liveStep.id]: true };
                      });
                      setError(null);
                    }}
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                    {liveSiteCta}
                  </a>
                  {liveSiteOpened ? (
                    <p className="mt-2 text-xs text-icta-green">
                      Live site opened — continue the checklist below.
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-icta-gray-600">
                      Required first step for site inspections.
                    </p>
                  )}
                </div>
              )}

              <section className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-icta-gray-600">
                    Guided review steps
                  </p>
                  <p className="text-xs text-icta-gray-600">
                    {allStepsDone
                      ? "All steps complete"
                      : `${remainingCount} remaining`}
                  </p>
                </div>
                <ol className="space-y-2">
                  {guide.steps.map((step, index) => {
                    const checked = Boolean(completedSteps[step.id]);
                    const blocked =
                      Boolean(step.requiresLiveSite) && !liveSiteOpened;
                    return (
                      <li key={step.id}>
                        <label
                          className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                            checked
                              ? "border-icta-green/30 bg-icta-green/5"
                              : "border-icta-gray-200 bg-white hover:bg-icta-gray-50"
                          } ${blocked ? "opacity-70" : ""}`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0"
                            checked={checked}
                            disabled={blocked}
                            onChange={() =>
                              toggleStep(step.id, step.requiresLiveSite)
                            }
                          />
                          <span className="min-w-0">
                            <span className="font-medium text-icta-gray-900">
                              Step {index + 1}.{" "}
                            </span>
                            <span className="text-icta-gray-600">{step.label}</span>
                            {blocked && (
                              <span className="mt-1 block text-xs text-icta-gray-600">
                                Open the live site first to unlock this step.
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <div
                className={`space-y-2 ${
                  allStepsDone ? "" : "pointer-events-none opacity-45"
                }`}
                aria-disabled={!allStepsDone}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-icta-gray-600">
                  Resolution outcome
                </p>
                {!allStepsDone && (
                  <p className="text-xs text-icta-gray-600">
                    Complete the guided steps above before choosing Pass, Fail, or
                    Flagged.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {(["pass", "fail", "flagged"] as const).map((v) => {
                    const OutcomeIcon =
                      v === "pass"
                        ? CheckCircle2
                        : v === "fail"
                          ? XCircle
                          : Flag;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setStatus(v)}
                        disabled={!allStepsDone}
                        className={
                          status === v
                            ? v === "fail"
                              ? btnDanger
                              : btnPrimary
                            : btnSecondary
                        }
                        aria-pressed={status === v}
                      >
                        <OutcomeIcon className="size-4" aria-hidden="true" />
                        {v === "pass" ? "Pass" : v === "fail" ? "Fail" : "Flagged"}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className={`space-y-2 ${
                  allStepsDone ? "" : "pointer-events-none opacity-45"
                }`}
              >
                <label className="block text-xs font-medium uppercase tracking-wide text-icta-gray-600">
                  Justification
                </label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  disabled={!allStepsDone}
                  placeholder={
                    allStepsDone
                      ? "Describe what you verified and why this outcome applies…"
                      : "Unlocks after guided steps are complete"
                  }
                  className={`${inputBase} h-28 resize-none ${
                    error ? inputError : ""
                  }`}
                />
                <p className="text-xs text-icta-gray-600">
                  Minimum {minJustificationLen} characters. Include concrete
                  evidence from the steps above.
                </p>
              </div>

              {error && <ErrorState message={error} />}

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  className={btnPrimary}
                  disabled={!allStepsDone || saving}
                >
                  {saving ? (
                    <>
                      <Spinner size="sm" />
                      Saving…
                    </>
                  ) : (
                    "Save resolution"
                  )}
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
