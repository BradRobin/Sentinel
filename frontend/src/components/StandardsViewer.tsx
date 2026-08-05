"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, ExternalLink } from "lucide-react";

import {
  CLAUSE_PDF_TARGET,
  STANDARDS_DOC_LABEL,
  STANDARDS_PDF_PATH,
  WEBSITES_SECTION_PAGE,
  normalizeClauseRef,
  pdfTargetForClause,
  standardsPdfUrl,
  standardsViewerHref,
  type ClausePdfTarget,
} from "@/lib/standards";
import { btnSecondarySm } from "@/lib/ui";
import { Skeleton } from "@/components/Skeleton";

const StandardsPdfPage = dynamic(
  () =>
    import("@/components/StandardsPdfPage").then((m) => m.StandardsPdfPage),
  {
    ssr: false,
    loading: () => (
      <div
        className="px-4 py-16"
        role="status"
        aria-busy="true"
      >
        <div className="mx-auto max-w-3xl space-y-3">
          <Skeleton className="h-4 w-1/3 rounded-md" />
          <Skeleton className="h-96 w-full rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>
      </div>
    ),
  },
);

const pagerBtn =
  "inline-flex items-center gap-0.5 rounded px-2.5 py-1 text-sm font-medium text-icta-gray-600 transition-colors hover:bg-icta-gray-50 hover:text-icta-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black disabled:pointer-events-none disabled:opacity-40";

function itemClass(active: boolean): string {
  return `block w-full rounded px-2 py-1 text-left text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black ${
    active
      ? "bg-icta-gray-100 font-semibold text-icta-gray-900"
      : "text-icta-gray-600 hover:bg-icta-gray-50 hover:text-icta-gray-900"
  }`;
}

function ClauseIndex({
  groups,
  page,
  clause,
  onPage,
  onClause,
}: {
  groups: Array<[number, ClausePdfTarget[]]>;
  page: number;
  clause: string | null;
  onPage: (page: number) => void;
  onClause: (ref: string) => void;
}) {
  return (
    <nav
      aria-label="Clause index"
      className="max-h-[min(80vh,900px)] overflow-y-auto rounded-md border border-icta-gray-200 bg-white p-3"
    >
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-icta-gray-600 font-serif">
        Clause index
      </h2>
      <ul className="space-y-3">
        {groups.map(([groupPage, targets]) => {
          const pageActive = groupPage === page;
          return (
            <li key={groupPage}>
              <button
                type="button"
                onClick={() => onPage(groupPage)}
                className={`${itemClass(pageActive)} text-[11px] font-semibold uppercase tracking-wide ${
                  pageActive ? "" : "text-icta-gray-600"
                }`}
                aria-current={pageActive ? "page" : undefined}
              >
                Page {groupPage}
              </button>
              <ul className="mt-1 space-y-0.5 border-l border-icta-gray-200 pl-2">
                {targets.map((target) => {
                  const clauseActive = clause === target.docClause;
                  return (
                    <li key={target.docClause}>
                      <button
                        type="button"
                        onClick={() => onClause(target.docClause)}
                        className={`${itemClass(clauseActive)} font-serif`}
                        aria-current={clauseActive ? "true" : undefined}
                      >
                        {target.highlight}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function StandardsViewer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageParam = searchParams.get("page");
  const clauseParam = searchParams.get("clause");

  const clause = clauseParam ? normalizeClauseRef(clauseParam) : null;
  const target = clause ? pdfTargetForClause(clause) : null;
  const [pageCount, setPageCount] = useState<number | null>(null);

  const onDocumentInfo = useCallback(
    (info: { pageCount: number; pageNumber: number }) => {
      setPageCount(info.pageCount);
    },
    [],
  );

  const page = useMemo(() => {
    const fromQuery = pageParam ? Number.parseInt(pageParam, 10) : NaN;
    if (Number.isFinite(fromQuery) && fromQuery > 0) return fromQuery;
    if (target) return target.page;
    return WEBSITES_SECTION_PAGE;
  }, [pageParam, target]);

  const highlightText = target?.highlight ?? null;

  // Clamp an out-of-range page param once the document is loaded.
  useEffect(() => {
    if (pageCount !== null && page > pageCount) {
      router.replace(standardsViewerHref({ page: pageCount }));
    }
  }, [page, pageCount, router]);

  const clauseGroups = useMemo(() => {
    const groups = new Map<number, ClausePdfTarget[]>();
    for (const item of Object.values(CLAUSE_PDF_TARGET)) {
      const list = groups.get(item.page) ?? [];
      list.push(item);
      groups.set(item.page, list);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, []);

  function goToPage(next: number) {
    const clamped =
      pageCount !== null
        ? Math.min(Math.max(next, 1), pageCount)
        : Math.max(next, 1);
    router.replace(standardsViewerHref({ page: clamped }));
  }

  function goToClause(ref: string) {
    const clauseTarget = pdfTargetForClause(ref);
    if (!clauseTarget) return;
    router.replace(
      standardsViewerHref({
        page: clauseTarget.page,
        clause: clauseTarget.docClause,
      }),
    );
  }

  function commitJump(raw: string) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    goToPage(n);
  }

  const canPrev = page > 1;
  const canNext = pageCount === null || page < pageCount;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-icta-gray-200 px-6 py-4">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-icta-gray-900 sm:text-2xl font-serif">
              {STANDARDS_DOC_LABEL}
            </h1>
            <p className="mt-1 text-sm text-icta-gray-600">
              Embedded official standard
              {clause ? (
                <>
                  {" "}
                  · clause{" "}
                  <span className="font-medium text-icta-gray-900 font-serif">{clause}</span>
                </>
              ) : null}
              {" "}
              · page {page}
              {pageCount ? ` of ${pageCount}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-icta-gray-200 bg-white p-1">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={!canPrev}
                className={pagerBtn}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Prev
              </button>
              <input
                type="number"
                key={page}
                defaultValue={page}
                min={1}
                max={pageCount ?? undefined}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitJump((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                onBlur={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  if (Number.isFinite(n) && n !== page) commitJump(e.target.value);
                }}
                aria-label="Jump to page"
                className="w-14 rounded border border-icta-gray-200 bg-icta-gray-50 px-1.5 py-1 text-center text-sm tabular-nums text-icta-gray-900 focus:border-icta-black focus:outline-none focus:ring-2 focus:ring-icta-black/10"
              />
              <span className="px-1 text-sm tabular-nums text-icta-gray-600" aria-hidden>
                / {pageCount ?? "…"}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={!canNext}
                className={pagerBtn}
                aria-label="Next page"
              >
                Next
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
            <a
              href={standardsPdfUrl(page)}
              target="_blank"
              rel="noopener noreferrer"
              className={btnSecondarySm}
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Open PDF in new tab
            </a>
            <a href={STANDARDS_PDF_PATH} download className={btnSecondarySm}>
              <Download className="size-3.5" aria-hidden="true" />
              Download
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <aside className="hidden lg:block lg:w-60 lg:shrink-0">
            <div className="lg:sticky lg:top-4">
              <ClauseIndex
                groups={clauseGroups}
                page={page}
                clause={clause}
                onPage={goToPage}
                onClause={goToClause}
              />
            </div>
          </aside>

          <details className="mb-2 lg:hidden">
            <summary className="cursor-pointer select-none text-sm font-semibold text-icta-gray-900">
              Clause index
            </summary>
            <div className="mt-2">
              <ClauseIndex
                groups={clauseGroups}
                page={page}
                clause={clause}
                onPage={goToPage}
                onClause={goToClause}
              />
            </div>
          </details>

          <div className="min-w-0 flex-1">
            <StandardsPdfPage
              key={`${page}-${highlightText ?? ""}`}
              pageNumber={page}
              highlightText={highlightText}
              title={STANDARDS_DOC_LABEL}
              onDocumentInfo={onDocumentInfo}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
