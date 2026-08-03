import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DependencyList,
} from "react";

interface UseApiResourceOptions {
  /** When false, no request is made. */
  enabled?: boolean;
  onError?: (error: unknown) => void;
}

/**
 * Loads a one-shot API resource and keeps `data` / `error` / `loading` in
 * sync. Re-runs when `deps` change or `reload()` is called. Unlike a bare
 * `useEffect`, `loading` is true from the first render and `data` is only
 * replaced once the request settles — so consumers never render a flash of
 * empty/error while refetching.
 */
export function useApiResource<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  options: UseApiResourceOptions = {},
): {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => void;
} {
  const { enabled = true, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(enabled);
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  const onErrorRef = useRef(onError);

  const reload = useCallback(() => {
    setError(null);
    setLoading(true);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    fetcherRef.current = fetcher;
    onErrorRef.current = onError;
    let cancelled = false;

    (async () => {
      try {
        const result = await fetcherRef.current();
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
          onErrorRef.current?.(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps is caller-supplied
  }, [...deps, enabled, nonce]);

  return { data, error, loading, reload };
}
