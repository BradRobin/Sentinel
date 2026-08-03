"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import {
  STANDARDS_DOC_LABEL,
  STANDARDS_PDF_PATH,
  WEBSITES_SECTION_PAGE,
  normalizeClauseRef,
  pdfTargetForClause,
  standardsPdfUrl,
} from "@/lib/standards";
import { btnSecondarySm } from "@/lib/ui";

const StandardsPdfPage = dynamic(
  () =>
    import("@/components/StandardsPdfPage").then((m) => m.StandardsPdfPage),
  {
    ssr: false,
    loading: () => (
      <p className="px-4 py-16 text-center text-sm text-icta-gray-600">
        Loading standard…
      </p>
    ),
  },
);

export function StandardsViewer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageParam = searchParams.get("page");
  const clauseParam = searchParams.get("clause");

  const clause = clauseParam ? normalizeClauseRef(clauseParam) : null;
  const target = clause ? pdfTargetForClause(clause) : null;

  const page = useMemo(() => {
    const fromQuery = pageParam ? Number.parseInt(pageParam, 10) : NaN;
    if (Number.isFinite(fromQuery) && fromQuery > 0) return fromQuery;
    if (target) return target.page;
    return WEBSITES_SECTION_PAGE;
  }, [pageParam, target]);

  const highlightText = target?.highlight ?? null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-icta-gray-200 px-6 py-4">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-icta-black sm:text-2xl">
              {STANDARDS_DOC_LABEL}
            </h1>
            <p className="mt-1 text-sm text-icta-gray-600">
              Embedded official standard
              {clause ? (
                <>
                  {" "}
                  · clause{" "}
                  <span className="font-medium text-icta-black">{clause}</span>
                </>
              ) : null}
              {" "}
              · page {page}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={standardsPdfUrl(page)}
              target="_blank"
              rel="noopener noreferrer"
              className={btnSecondarySm}
            >
              Open PDF in new tab
            </a>
            <a href={STANDARDS_PDF_PATH} download className={btnSecondarySm}>
              Download
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6">
        <StandardsPdfPage
          key={`${page}-${highlightText ?? ""}`}
          pageNumber={page}
          highlightText={highlightText}
          title={STANDARDS_DOC_LABEL}
        />
      </div>
    </div>
  );
}
