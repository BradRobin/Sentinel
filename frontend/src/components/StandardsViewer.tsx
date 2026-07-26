"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import {
  STANDARDS_DOC_LABEL,
  STANDARDS_PDF_PATH,
  WEBSITES_SECTION_PAGE,
  normalizeClauseRef,
  pdfPageForClause,
  standardsPdfUrl,
} from "@/lib/standards";
import { btnSecondarySm, linkQuiet } from "@/lib/ui";

export function StandardsViewer() {
  const searchParams = useSearchParams();
  const pageParam = searchParams.get("page");
  const clauseParam = searchParams.get("clause");

  const page = useMemo(() => {
    const fromQuery = pageParam ? Number.parseInt(pageParam, 10) : NaN;
    if (Number.isFinite(fromQuery) && fromQuery > 0) return fromQuery;
    if (clauseParam) {
      return pdfPageForClause(normalizeClauseRef(clauseParam)) ?? WEBSITES_SECTION_PAGE;
    }
    return WEBSITES_SECTION_PAGE;
  }, [pageParam, clauseParam]);

  const clause = clauseParam ? normalizeClauseRef(clauseParam) : null;
  const iframeSrc = `${STANDARDS_PDF_PATH}#page=${page}`;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-icta-gray-200 px-6 py-4">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link href="/" className={`mb-2 inline-block ${linkQuiet}`}>
              ← Back
            </Link>
            <h1 className="text-xl font-bold text-icta-black sm:text-2xl">
              {STANDARDS_DOC_LABEL}
            </h1>
            <p className="mt-1 text-sm text-icta-gray-600">
              Embedded official standard
              {clause ? (
                <>
                  {" "}
                  · showing clause{" "}
                  <span className="font-medium text-icta-black">{clause}</span>
                </>
              ) : null}
              {" "}
              · page {page}
            </p>
            <p className="mt-1 text-xs text-icta-gray-600">
              Sentinel cites ICTA.6.002:2019 §6.4 IDs; website rules appear under
              §6.5 in this 2023 document. Links open the closest matching page.
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
            <a
              href={STANDARDS_PDF_PATH}
              download
              className={btnSecondarySm}
            >
              Download
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6">
        <iframe
          key={iframeSrc}
          title={STANDARDS_DOC_LABEL}
          src={iframeSrc}
          className="h-[min(80vh,900px)] w-full rounded-md border border-icta-gray-200 bg-icta-gray-50"
        />
      </div>
    </div>
  );
}
