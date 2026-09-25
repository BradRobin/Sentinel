/**
 * Accessibility preference store for the Sentinel prototype.
 *
 * Prefs live in localStorage (same pattern as mock auth) and are applied as
 * classes / CSS variables on documentElement so every route inherits them.
 */

export type A11yTextStep = -2 | -1 | 0 | 1 | 2;

export interface A11yPrefs {
  /** Relative text size step. 0 = 100%, each step ≈ 12.5%. */
  textStep: A11yTextStep;
  grayscale: boolean;
  highContrast: boolean;
  negativeContrast: boolean;
  lightBackground: boolean;
  underlineLinks: boolean;
  readableFont: boolean;
}

export const A11Y_STORAGE_KEY = "sentinel.a11y.prefs";
export const A11Y_TEXT_EVENT = "sentinel:a11y-text-step";

export const DEFAULT_A11Y_PREFS: A11yPrefs = {
  textStep: 0,
  grayscale: false,
  highContrast: false,
  negativeContrast: false,
  lightBackground: false,
  underlineLinks: false,
  readableFont: false,
};

const TEXT_SCALE: Record<A11yTextStep, number> = {
  [-2]: 0.875,
  [-1]: 0.9375,
  0: 1,
  1: 1.125,
  2: 1.25,
};

/** Classes toggled on <html> for CSS-driven modes. */
export const A11Y_CLASS = {
  grayscale: "a11y-grayscale",
  highContrast: "a11y-high-contrast",
  negativeContrast: "a11y-negative-contrast",
  lightBackground: "a11y-light-background",
  underlineLinks: "a11y-underline-links",
  readableFont: "a11y-readable-font",
} as const;

const ALL_A11Y_CLASSES = Object.values(A11Y_CLASS);

let cachedPrefs: A11yPrefs | undefined;
const listeners = new Set<() => void>();

function clampTextStep(n: number): A11yTextStep {
  if (n <= -2) return -2;
  if (n === -1) return -1;
  if (n === 1) return 1;
  if (n >= 2) return 2;
  return 0;
}

function isPrefs(value: unknown): value is A11yPrefs {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.textStep === "number" &&
    typeof v.grayscale === "boolean" &&
    typeof v.highContrast === "boolean" &&
    typeof v.negativeContrast === "boolean" &&
    typeof v.lightBackground === "boolean" &&
    typeof v.underlineLinks === "boolean" &&
    typeof v.readableFont === "boolean"
  );
}

function loadPrefs(): A11yPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_A11Y_PREFS };
  try {
    const raw = window.localStorage.getItem(A11Y_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_A11Y_PREFS };
    const parsed = JSON.parse(raw) as unknown;
    if (!isPrefs(parsed)) return { ...DEFAULT_A11Y_PREFS };
    return {
      ...DEFAULT_A11Y_PREFS,
      ...parsed,
      textStep: clampTextStep(parsed.textStep),
    };
  } catch {
    return { ...DEFAULT_A11Y_PREFS };
  }
}

function savePrefs(prefs: A11yPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // storage unavailable — in-memory prefs still apply for the session
  }
}

function emitChange(): void {
  for (const listener of listeners) listener();
}

export function a11ySubscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable snapshot for useSyncExternalStore. */
export function readA11yPrefs(): A11yPrefs {
  if (cachedPrefs === undefined) {
    cachedPrefs = loadPrefs();
  }
  return cachedPrefs;
}

export function readA11yPrefsServer(): A11yPrefs {
  return DEFAULT_A11Y_PREFS;
}

export function textStepScale(step: A11yTextStep): number {
  return TEXT_SCALE[step];
}

/**
 * Apply prefs to <html>: classes + root font-size for rem scaling.
 * Safe to call from effects or the inline boot script.
 */
export function applyA11yToDocument(prefs: A11yPrefs): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  for (const cls of ALL_A11Y_CLASSES) {
    root.classList.remove(cls);
  }
  if (prefs.grayscale) root.classList.add(A11Y_CLASS.grayscale);
  if (prefs.highContrast) root.classList.add(A11Y_CLASS.highContrast);
  if (prefs.negativeContrast) root.classList.add(A11Y_CLASS.negativeContrast);
  if (prefs.lightBackground) root.classList.add(A11Y_CLASS.lightBackground);
  if (prefs.underlineLinks) root.classList.add(A11Y_CLASS.underlineLinks);
  if (prefs.readableFont) root.classList.add(A11Y_CLASS.readableFont);

  const scale = textStepScale(prefs.textStep);
  root.style.setProperty("--a11y-text-scale", String(scale));
  root.style.fontSize = `${(scale * 100).toFixed(2)}%`;
}

function notifyTextStepChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(A11Y_TEXT_EVENT));
}

export function setA11yPrefs(patch: Partial<A11yPrefs>): A11yPrefs {
  const prev = readA11yPrefs();
  let next: A11yPrefs = {
    ...prev,
    ...patch,
    textStep:
      patch.textStep !== undefined
        ? clampTextStep(patch.textStep)
        : prev.textStep,
  };

  // Mutual exclusion: high contrast ↔ negative contrast
  if (patch.highContrast === true) next.negativeContrast = false;
  if (patch.negativeContrast === true) next.highContrast = false;

  cachedPrefs = next;
  savePrefs(next);
  applyA11yToDocument(next);
  if (patch.textStep !== undefined && patch.textStep !== prev.textStep) {
    notifyTextStepChanged();
  }
  emitChange();
  return next;
}

export function bumpTextStep(delta: -1 | 1): A11yPrefs {
  const current = readA11yPrefs().textStep;
  return setA11yPrefs({ textStep: clampTextStep(current + delta) });
}

export function resetA11yPrefs(): A11yPrefs {
  cachedPrefs = { ...DEFAULT_A11Y_PREFS };
  savePrefs(cachedPrefs);
  applyA11yToDocument(cachedPrefs);
  notifyTextStepChanged();
  emitChange();
  return cachedPrefs;
}

export function prefsAreDefault(prefs: A11yPrefs): boolean {
  return (
    prefs.textStep === DEFAULT_A11Y_PREFS.textStep &&
    prefs.grayscale === DEFAULT_A11Y_PREFS.grayscale &&
    prefs.highContrast === DEFAULT_A11Y_PREFS.highContrast &&
    prefs.negativeContrast === DEFAULT_A11Y_PREFS.negativeContrast &&
    prefs.lightBackground === DEFAULT_A11Y_PREFS.lightBackground &&
    prefs.underlineLinks === DEFAULT_A11Y_PREFS.underlineLinks &&
    prefs.readableFont === DEFAULT_A11Y_PREFS.readableFont
  );
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === A11Y_STORAGE_KEY) {
      cachedPrefs = undefined;
      const prefs = readA11yPrefs();
      applyA11yToDocument(prefs);
      notifyTextStepChanged();
      emitChange();
    }
  });
}
