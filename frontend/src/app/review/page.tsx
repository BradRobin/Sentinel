"use client";

import { useEffect, useState } from "react";

import {
  getManualReviewQueueItems,
  type ManualReviewCheckType,
  type ManualReviewQueueItem,
} from "@/lib/api";
import { ClauseLink } from "@/components/ClauseLink";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import {
  btnPrimary,
  inputBase,
  inputError,
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
            <h1 className="text-2xl font-bold text-icta-black">
              Officer manual review queue
            </h1>
            <p className="mt-1 text-sm text-icta-gray-600">
              Resolve pending ICTA checks so they can count toward scoring on
              subsequent scans.
            </p>
          </div>
        </div>

        <section className="mb-6 rounded-md border border-icta-gray-200 p-4">
          <h2 className="text-sm font-semibold text-icta-black">
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
              Load queue
            </button>
            {authError && (
              <p className="text-sm text-icta-red">{authError}</p>
            )}
          </div>
        </section>

        <section className="mb-4 rounded-md border border-icta-gray-200 p-4">
          <h2 className="text-sm font-semibold text-icta-black">Filters</h2>
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

        <section className="rounded-md border border-icta-gray-200">
          <div className="border-b border-icta-gray-200 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-icta-black">
                Pending items ({items.length})
              </h2>
              <p className="text-xs text-icta-gray-600">
                Sort: oldest pending first
              </p>
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
                    <div className="text-xs text-icta-gray-600">
                      {it.domain_url} ·{" "}
                      <ClauseLink clause={it.clause_reference} showPrefix />
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

