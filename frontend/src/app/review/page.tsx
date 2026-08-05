"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Inbox, SlidersHorizontal, UserCircle } from "lucide-react";

import {
  getManualReviewQueueItems,
  type ManualReviewCheckType,
  type ManualReviewQueueItem,
} from "@/lib/api";
import { ClauseLink } from "@/components/ClauseLink";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Spinner } from "@/components/Spinner";
import {
  badgeNeutral,
  btnFilterActive,
  btnFilterIdle,
  btnPrimary,
  inputBase,
  inputError,
  meta,
  sectionPanel,
} from "@/lib/ui";
import { ManualReviewResolutionPanel } from "@/components/ManualReviewResolutionPanel";
import { labelCategory, SCORED_CATEGORIES } from "@/lib/findings";

const OFFICER_STORAGE_KEY = "sentinel.officer.id";

function formatPendingAge(pendingSinceIso: string | null | undefined): string {
  if (!pendingSinceIso) return "—";
  const d = new Date(pendingSinceIso);
  if (Number.isNaN(d.getTime())) return "—";
  const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days > 0) return `${days}d`;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours > 0) return `${hours}h`;
  const mins = Math.floor(ms / (1000 * 60));
  return `${Math.max(1, mins)}m`;
}

type QueueFilters = {
  check_type: ManualReviewCheckType | "";
  category: string | "";
  domainQuery: string;
};

export default function ReviewQueuePage() {
  const [officerId, setOfficerId] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);

  const [items, setItems] = useState<ManualReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<QueueFilters>({
    check_type: "",
    category: "",
    domainQuery: "",
  });

  const [selected, setSelected] = useState<ManualReviewQueueItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const [summaryItems, setSummaryItems] = useState<ManualReviewQueueItem[]>([]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(OFFICER_STORAGE_KEY);
      if (saved) setOfficerId(saved);
    } catch {
      // ignore
    }
  }, []);

  async function loadQueue() {
    if (!officerId.trim()) return;
    setLoading(true);
    setError(null);
    setAuthError(null);
    try {
      const data = await getManualReviewQueueItems({
        officerId,
        check_type: filters.check_type,
        category: filters.category,
        domain_query: filters.domainQuery,
        limit: 400,
      });
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officerId, filters.check_type, filters.category, filters.domainQuery]);

  // Whole-queue snapshot (no filters) so the by-type summary stays accurate
  // while the list below is server-side filtered.
  useEffect(() => {
    if (!officerId.trim()) return;
    let cancelled = false;
    getManualReviewQueueItems({ officerId, limit: 400 })
      .then((data) => {
        if (!cancelled) setSummaryItems(data);
      })
      .catch(() => {
        // Best-effort summary; the list surfaces real errors.
      });
    return () => {
      cancelled = true;
    };
  }, [officerId]);

  const typeCounts = useMemo(() => {
    const counts: Record<ManualReviewCheckType, number> = {
      site_inspection: 0,
      institutional_attestation: 0,
    };
    for (const it of summaryItems) {
      if (it.check_type in counts) counts[it.check_type] += 1;
    }
    return counts;
  }, [summaryItems]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of summaryItems) {
      map.set(it.category, (map.get(it.category) ?? 0) + 1);
    }
    const ordered: { category: string; label: string; count: number }[] = [];
    for (const c of SCORED_CATEGORIES) {
      if (map.has(c)) {
        ordered.push({ category: c, label: labelCategory(c), count: map.get(c)! });
        map.delete(c);
      }
    }
    for (const [category, count] of map) {
      ordered.push({ category, label: labelCategory(category), count });
    }
    return ordered;
  }, [summaryItems]);

  function toggleCheckTypeFilter(type: ManualReviewCheckType) {
    setFilters((prev) => ({
      ...prev,
      check_type: prev.check_type === type ? "" : type,
    }));
  }

  function toggleCategoryFilter(category: string) {
    setFilters((prev) => ({
      ...prev,
      category: prev.category === category ? "" : category,
    }));
  }

  function onOpenItem(item: ManualReviewQueueItem) {
    setSelected(item);
    setPanelOpen(true);
  }

  function onClosePanel() {
    setPanelOpen(false);
  }

  return (
    <div className="flex min-h-[70vh] flex-1 flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-icta-gray-900 font-serif">
              Officer manual review queue
            </h1>
            <p className="mt-1 text-sm text-icta-gray-600">
              Resolve pending ICTA checks so they can count toward scoring on
              subsequent scans.
            </p>
          </div>
        </div>

        <section className={`${sectionPanel} mb-6 p-4`}>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-icta-gray-900">
            <UserCircle className="size-4 text-icta-gray-500" aria-hidden="true" />
            Officer identity
          </h2>
          <p className="mt-1 text-xs text-icta-gray-600">
            This prototype uses a simple header-based auth. Set the officer ID
            that exists in the database.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={officerId}
              onChange={(e) => {
                setOfficerId(e.target.value);
                setAuthError(null);
              }}
              placeholder="UUID (x-officer-id)"
              className={`${inputBase} sm:max-w-md ${
                authError ? inputError : ""
              }`}
            />
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                const trimmed = officerId.trim();
                if (!trimmed) {
                  setAuthError("Enter an officer UUID.");
                  return;
                }
                try {
                  sessionStorage.setItem(OFFICER_STORAGE_KEY, trimmed);
                } catch {
                  // ignore
                }
                void loadQueue();
              }}
            >
              {loading ? (
                <>
                  <Spinner size="sm" />
                  Loading…
                </>
              ) : (
                "Load queue"
              )}
            </button>
            {authError && (
              <p className="text-sm text-icta-red">{authError}</p>
            )}
          </div>
        </section>

        <section className={`${sectionPanel} mb-4 p-4`}>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-icta-gray-900">
            <SlidersHorizontal className="size-4 text-icta-gray-500" aria-hidden="true" />
            Filters
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-icta-gray-600">
                Check type
              </span>
              <select
                value={filters.check_type}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    check_type: e.target.value as QueueFilters["check_type"],
                  }))
                }
                className={inputBase}
              >
                <option value="">All</option>
                <option value="site_inspection">Site inspection</option>
                <option value="institutional_attestation">
                  Institutional attestation
                </option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-icta-gray-600">
                Category
              </span>
              <select
                value={filters.category}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    category: e.target.value as QueueFilters["category"],
                  }))
                }
                className={inputBase}
              >
                <option value="">All</option>
                {SCORED_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {labelCategory(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-icta-gray-600">
                Domain URL contains
              </span>
              <input
                value={filters.domainQuery}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    domainQuery: e.target.value,
                  }))
                }
                placeholder="e.g. ict.go.ke"
                className={inputBase}
              />
            </label>
          </div>
        </section>

        {error && <ErrorState message={error} className="mb-4" />}

        {officerId.trim() && (
          <section
            className={`${sectionPanel} mb-4 p-4`}
            aria-label="Pending items by type"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-icta-gray-900">
                <ClipboardList className="size-4 text-icta-gray-500" aria-hidden="true" />
                Pending summary
              </h2>
              <p className={`${meta}`}>{summaryItems.length} total pending</p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(["site_inspection", "institutional_attestation"] as const).map(
                (type) => {
                  const active = filters.check_type === type;
                  const label =
                    type === "site_inspection"
                      ? "Site inspection"
                      : "Institutional attestation";
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleCheckTypeFilter(type)}
                      aria-pressed={active}
                      className={active ? btnFilterActive : btnFilterIdle}
                    >
                      {label} · {typeCounts[type]}
                    </button>
                  );
                },
              )}
            </div>

            {categoryCounts.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {categoryCounts.map((c) => {
                  const active = filters.category === c.category;
                  return (
                    <button
                      key={c.category}
                      type="button"
                      onClick={() => toggleCategoryFilter(c.category)}
                      aria-pressed={active}
                      className={active ? btnFilterActive : btnFilterIdle}
                    >
                      {c.label} · {c.count}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section className={sectionPanel}>
          <div className="border-b border-icta-gray-200 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-icta-gray-900">
                <Inbox className="size-4 text-icta-gray-500" aria-hidden="true" />
                Pending items ({items.length})
              </h2>
              <p className={`${meta}`}>Sort: oldest pending first</p>
            </div>
          </div>

          {loading ? (
            <div
              className="space-y-2.5 px-4 py-6"
              role="status"
              aria-busy="true"
            >
              <Skeleton className="h-4 w-2/3 rounded-md" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
              <Skeleton className="h-4 w-3/5 rounded-md" />
              <Skeleton className="h-4 w-2/3 rounded-md" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState variant="inset">
              No pending items match the current filters.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-icta-gray-100">
              {items.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => onOpenItem(it)}
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-icta-gray-50"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-icta-black">
                        {it.question_title}
                      </span>
                      <span className="text-xs text-icta-gray-600">
                        Pending {formatPendingAge(it.pending_since)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-icta-gray-600">
                      <span className={badgeNeutral}>
                        {labelCategory(it.category)}
                      </span>
                      <span className="text-icta-gray-600">{it.domain_url}</span>
                      <span aria-hidden="true">·</span>
                      <ClauseLink clause={it.clause_reference} showPrefix />
                      <span aria-hidden="true">·</span>
                      <span>
                        {it.check_type === "site_inspection"
                          ? "Site inspection"
                          : "Institutional attestation"}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <ManualReviewResolutionPanel
        open={panelOpen}
        item={selected}
        officerId={officerId}
        onClose={onClosePanel}
        onResolved={() => {
          setSelected(null);
          setPanelOpen(false);
          void loadQueue();
        }}
      />
    </div>
  );
}

