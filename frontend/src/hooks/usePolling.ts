import { useEffect, type DependencyList } from "react";

interface UsePollingOptions {
  /** Delay between polls, in ms. The first poll runs immediately. */
  intervalMs?: number;
  /** Hard cap on attempts; `onExhausted` fires when reached. Default: unlimited. */
  maxAttempts?: number;
  /** When false, no polling happens (cleanup still cancels any in-flight run). */
  enabled?: boolean;
  /** Keep polling after the poll function throws (non-fatal errors). */
  retryOnError?: boolean;
  onError?: (error: unknown) => void;
  /** Called when the poll function returns `true`. */
  onDone?: () => void;
  /** Called when `maxAttempts` is reached without the poll returning `true`. */
  onExhausted?: () => void;
}

/**
 * Runs `poll` immediately, then every `intervalMs`, until `poll` returns
 * `true`, throws (unless `retryOnError`), `maxAttempts` is reached, or the
 * hook unmounts / `deps` change. Poll bodies may update state freely — they
 * only run inside async callbacks.
 *
 * @param poll   Async step; return `true` to stop, `false`/`void` to continue.
 * @param deps   Dependencies that restart the polling session (like `useEffect`).
 */
export function usePolling(
  poll: (attempt: number) => Promise<boolean | void>,
  deps: DependencyList,
  options: UsePollingOptions = {},
): void {
  const {
    intervalMs = 2000,
    maxAttempts = Number.POSITIVE_INFINITY,
    enabled = true,
    retryOnError = false,
    onError,
    onDone,
    onExhausted,
  } = options;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    async function tick() {
      if (cancelled) return;
      attempt += 1;
      let done = false;
      try {
        done = (await poll(attempt)) === true;
      } catch (err) {
        if (cancelled) return;
        onError?.(err);
        if (!retryOnError) return;
      }
      if (cancelled) return;
      if (done) {
        onDone?.();
        return;
      }
      if (attempt >= maxAttempts) {
        onExhausted?.();
        return;
      }
      timer = setTimeout(() => void tick(), intervalMs);
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps is caller-supplied
  }, deps);
}
