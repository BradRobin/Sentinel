/**
 * ICTA Systems & Applications Standard (embedded PDF).
 *
 * Source document: ICTA.6.003:2023. Sentinel findings still cite ICTA.6.002:2019
 * §6.4 clause IDs; the matching website requirements are under §6.5 in this PDF.
 * Each entry points at the exact §6.5 heading page and highlight text.
 */

export const STANDARDS_PDF_PATH =
  "/standards/ICTA-6.003-2023-Systems-Applications.pdf";

export const STANDARDS_DOC_LABEL = "ICTA.6.003:2023 Systems & Applications Standard";

/** Websites section start (2023 §6.5). */
export const WEBSITES_SECTION_PAGE = 31;

export type ClausePdfTarget = {
  /** 1-based page in the 2023 PDF. */
  page: number;
  /** Exact §6.5 clause id(s) in the 2023 document. */
  docClause: string;
  /** Unique text on that page used to highlight the standard. */
  highlight: string;
};

/**
 * Sentinel clause_reference (2019 §6.4 numbering) → exact 2023 §6.5 location.
 */
export const CLAUSE_PDF_TARGET: Record<string, ClausePdfTarget> = {
  "6.4.4": { page: 32, docClause: "6.5.6–6.5.8", highlight: "6.5.6" },
  "6.4.5": { page: 32, docClause: "6.5.8", highlight: "6.5.8" },
  "6.4.6": { page: 33, docClause: "6.5.10", highlight: "6.5.10 Design" },
  "6.4.7": { page: 35, docClause: "6.5.16", highlight: "6.5.16 Fonts" },
  "6.4.8": { page: 33, docClause: "6.5.11", highlight: "6.5.11 Interoperability" },
  "6.4.9": {
    page: 37,
    docClause: "6.5.23",
    highlight: "6.5.23 General Considerations",
  },
  "6.4.11": { page: 33, docClause: "6.5.10", highlight: "Server-side scripting" },
  "6.4.12": { page: 35, docClause: "6.5.15", highlight: "6.5.15 Main Element" },
  "6.4.13": { page: 35, docClause: "6.5.15", highlight: "6.5.15 Main Element" },
  "6.4.16": { page: 35, docClause: "6.5.19", highlight: "6.5.19 Multi media" },
  "6.4.17": {
    page: 36,
    docClause: "6.5.20",
    highlight: "6.5.20 Online Visibility",
  },
  "6.4.18.i": { page: 36, docClause: "6.5.21.i", highlight: "i. Security" },
  "6.4.18.ii": { page: 36, docClause: "6.5.21.ii", highlight: "ii. Privacy" },
  "6.4.18.iii": { page: 36, docClause: "6.5.21.ii", highlight: "ii. Privacy" },
  "6.4.18.iv": { page: 37, docClause: "6.5.21.iv", highlight: "iv. Disclaimer" },
  "6.4.19": {
    page: 36,
    docClause: "6.5.21.iii",
    highlight: "iii. Intellectual Property",
  },
  "6.4.20": {
    page: 34,
    docClause: "6.5.12",
    highlight: "6.5.12 Accessibility",
  },
  "6.4.21": { page: 38, docClause: "6.5.24", highlight: "6.5.24 Web Hosting" },
  "6.4.22": {
    page: 38,
    docClause: "6.5.25",
    highlight: "root/critical files",
  },
  "6.4.23": {
    page: 38,
    docClause: "6.5.26",
    highlight: "6.5.26 Monitoring and Evaluation",
  },
};

export function normalizeClauseRef(ref: string): string {
  return ref.trim().replace(/^clause\s+/i, "");
}

export function pdfTargetForClause(ref: string): ClausePdfTarget | null {
  const key = normalizeClauseRef(ref);
  return CLAUSE_PDF_TARGET[key] ?? null;
}

export function pdfPageForClause(ref: string): number | null {
  return pdfTargetForClause(ref)?.page ?? null;
}

/** In-app standards viewer URL with optional page + clause label. */
export function standardsViewerHref(options?: {
  page?: number | null;
  clause?: string | null;
}): string {
  const params = new URLSearchParams();
  const page = options?.page ?? null;
  const clause = options?.clause ? normalizeClauseRef(options.clause) : null;
  if (page && page > 0) params.set("page", String(page));
  if (clause) params.set("clause", clause);
  const qs = params.toString();
  return qs ? `/standards?${qs}` : "/standards";
}

export function standardsHrefForClause(clauseRef: string): string {
  const clause = normalizeClauseRef(clauseRef);
  const target = pdfTargetForClause(clause);
  const page = target?.page ?? WEBSITES_SECTION_PAGE;
  return standardsViewerHref({ page, clause });
}

/** Direct PDF URL with browser/#page= fragment (fallback / new-tab). */
export function standardsPdfUrl(page?: number | null): string {
  if (page && page > 0) return `${STANDARDS_PDF_PATH}#page=${page}`;
  return STANDARDS_PDF_PATH;
}
