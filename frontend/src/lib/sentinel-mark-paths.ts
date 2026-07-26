/** Sentinel mark geometry and complete-state wind-down constants. */

export const RIBBON_PATH =
  "M 82 32 C 92 48 88 68 72 78 C 56 88 36 84 26 70 C 18 58 20 42 32 34 C 42 27 54 30 58 40 C 61 48 56 55 48 54";

/** Check starts at the ribbon’s settle anchor (48, 54). */
export const CHECK_PATH = "M 48 54 L 56 63 L 74 43";

export const RIBBON_ANCHOR = { x: 48, y: 54 } as const;

export const CHECK_DASH = 40;

export const WIND_INTO_ANCHOR = {
  totalDegrees: 1080,
  endScale: 0.06,
  startStrokeWidth: 9,
  endStrokeWidth: 5,
  durationMs: 900,
  checkDelayMs: 150,
  checkDrawMs: 420,
} as const;

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export type SentinelMarkState = "idle" | "processing" | "complete" | "error";

export const SENTINEL_MARK_LABELS: Record<SentinelMarkState, string> = {
  idle: "Ready",
  processing: "Loading…",
  complete: "Complete",
  error: "Error",
};
