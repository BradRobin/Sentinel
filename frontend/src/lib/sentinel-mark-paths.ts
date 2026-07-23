/** Path data for ribbon ↔ checkmark morph (shared cubic structure). */

export const RIBBON_NUMS = [
  82, 32, 92, 48, 88, 68, 72, 78, 56, 88, 36, 84, 26, 70, 18, 58, 20, 42, 32,
  34, 42, 27, 54, 30, 58, 40, 61, 48, 56, 55, 48, 54,
];

export const CHECK_NUMS = [
  38, 51, 39.33, 52.5, 40.67, 54, 42, 55.5, 43.33, 57, 44.67, 58.5, 46, 60, 48,
  57.78, 50, 55.56, 52, 53.33, 54, 51.11, 56, 48.89, 58, 46.67, 60, 44.44, 62,
  42.22, 64, 40,
];

export const RIBBON_PATH = buildPath(RIBBON_NUMS);

export function buildPath(nums: number[]): string {
  let d = `M ${nums[0]} ${nums[1]}`;
  for (let i = 0; i < 5; i++) {
    const c = nums.slice(2 + i * 6, 8 + i * 6);
    d += ` C ${c.join(" ")}`;
  }
  return d;
}

export function lerp(a: number[], b: number[], t: number): number[] {
  return a.map((v, i) => v + (b[i] - v) * t);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export type SentinelMarkState = "idle" | "processing" | "complete";

export const SENTINEL_MARK_LABELS: Record<SentinelMarkState, string> = {
  idle: "Ready",
  processing: "Loading…",
  complete: "Complete",
};
