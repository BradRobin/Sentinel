import type { StatFilter } from "@/lib/findings";

export type NarrativeStatKind = StatFilter | "score";

export interface NarrativeLinkSpan {
  start: number;
  end: number;
  kind: NarrativeStatKind;
}

export interface NarrativeStatCounts {
  fail: number;
  pass: number;
  manual_review: number;
  total: number;
}

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
] as const;

const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
] as const;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function numberWords(n: number): string[] {
  if (!Number.isFinite(n) || n < 0 || n > 99) return [];
  if (n < 20) return [ONES[n]];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  if (ones === 0) return [TENS[tens]];
  return [`${TENS[tens]}-${ONES[ones]}`, `${TENS[tens]} ${ONES[ones]}`];
}

function numberAlternation(n: number): string {
  const forms = [String(n), ...numberWords(n)].map(escapeRegex);
  return `(?:${forms.join("|")})`;
}

function overlaps(
  start: number,
  end: number,
  spans: NarrativeLinkSpan[],
): boolean {
  return spans.some((s) => start < s.end && end > s.start);
}

function collect(
  text: string,
  pattern: RegExp,
  kind: NarrativeStatKind,
  spans: NarrativeLinkSpan[],
): void {
  for (const match of text.matchAll(pattern)) {
    if (match.index == null || !match[0]) continue;
    const start = match.index;
    const end = start + match[0].length;
    if (overlaps(start, end, spans)) continue;
    spans.push({ start, end, kind });
  }
}

/**
 * Find officer-facing stat phrases in an LLM narrative and map them to
 * side-panel filters. Matches digits and common English number words for
 * the scan's actual counts.
 */
export function findNarrativeStatLinks(
  narrative: string,
  stats: NarrativeStatCounts,
  overallScore: number | null | undefined,
): NarrativeLinkSpan[] {
  if (!narrative.trim()) return [];

  const spans: NarrativeLinkSpan[] = [];
  const fail = numberAlternation(stats.fail);
  const review = numberAlternation(stats.manual_review);
  const pass = numberAlternation(stats.pass);
  const total = numberAlternation(stats.total);

  // Longer / more specific phrases first
  collect(
    narrative,
    new RegExp(
      `\\b(?:failed\\s+)?${fail}\\s+(?:critical\\s+)?(?:items?|failures?)\\b`,
      "gi",
    ),
    "fail",
    spans,
  );
  collect(
    narrative,
    new RegExp(`\\b${fail}\\s+failures?\\b`, "gi"),
    "fail",
    spans,
  );

  collect(
    narrative,
    new RegExp(
      `\\b${review}\\s+(?:items?\\s+)?(?:flagged(?:\\s+for\\s+(?:further\\s+)?inspection)?|needing\\s+review|for\\s+(?:further\\s+)?(?:manual\\s+)?(?:review|inspection))\\b`,
      "gi",
    ),
    "manual_review",
    spans,
  );
  collect(
    narrative,
    new RegExp(
      `\\b${review}\\s+(?:items?|checks?)\\s+(?:needing\\s+)?(?:manual\\s+)?review\\b`,
      "gi",
    ),
    "manual_review",
    spans,
  );

  collect(
    narrative,
    new RegExp(`\\b${pass}\\s+passes?\\b`, "gi"),
    "pass",
    spans,
  );

  collect(
    narrative,
    new RegExp(`\\b${total}\\s+checks?\\b`, "gi"),
    "all",
    spans,
  );

  if (overallScore != null && Number.isFinite(overallScore)) {
    const precise = Number(overallScore).toFixed(1);
    collect(
      narrative,
      new RegExp(`${escapeRegex(precise)}\\s*%`, "g"),
      "score",
      spans,
    );
    const rounded = String(Math.round(Number(overallScore)));
    if (rounded !== precise) {
      collect(
        narrative,
        new RegExp(`(?<!\\d)${escapeRegex(rounded)}\\s*%`, "g"),
        "score",
        spans,
      );
    }
  }

  return spans.sort((a, b) => a.start - b.start || b.end - a.end);
}
