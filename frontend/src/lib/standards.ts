/**
 * ICTA Systems & Applications Standard (embedded PDF).
 *
 * Source document: ICTA.6.003:2023. Sentinel findings still cite ICTA.6.002:2019
 * §6.4 clause IDs; website requirements live under §6.5 in the 2023 PDF.
 * Pages below map each Sentinel clause_reference to the best matching §6.5 page.
 */

export const STANDARDS_PDF_PATH =
  "/standards/ICTA-6.003-2023-Systems-Applications.pdf";

export const STANDARDS_DOC_LABEL = "ICTA.6.003:2023 Systems & Applications Standard";

/** Websites section start (2023 §6.5). */
export const WEBSITES_SECTION_PAGE = 31;

/**
 * Sentinel clause_reference (2019 §6.4 numbering) → 1-based PDF page in the
 * 2023 standard (content-equivalent §6.5 location).
 */
export const CLAUSE_PDF_PAGE: Record<string, number> = {
  "6.4.4": 32,
  "6.4.5": 32,
  "6.4.6": 33,
  "6.4.7": 35,
  "6.4.8": 33,
  "6.4.9": 34,
  "6.4.11": 33,
  "6.4.12": 35,
  "6.4.13": 35,
  "6.4.16": 35,
  "6.4.17": 36,
  "6.4.18.i": 36,
  "6.4.18.ii": 36,
  "6.4.18.iii": 36,
  "6.4.18.iv": 37,
  "6.4.19": 36,
  "6.4.20": 33,
  "6.4.21": 38,
  "6.4.22": 38,
  "6.4.23": 38,
};

export function normalizeClauseRef(ref: string): string {
  return ref.trim().replace(/^clause\s+/i, "");
}

export function pdfPageForClause(ref: string): number | null {
  const key = normalizeClauseRef(ref);
  return CLAUSE_PDF_PAGE[key] ?? null;
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
  const page = pdfPageForClause(clause) ?? WEBSITES_SECTION_PAGE;
  return standardsViewerHref({ page, clause });
}

/** Direct PDF URL with browser/#page= fragment (fallback / new-tab). */
export function standardsPdfUrl(page?: number | null): string {
  if (page && page > 0) return `${STANDARDS_PDF_PATH}#page=${page}`;
  return STANDARDS_PDF_PATH;
}
