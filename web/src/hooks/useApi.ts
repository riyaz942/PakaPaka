import { useEffect, useState } from 'react';

export type UseApiState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'error'; data: null; error: string }
  | { status: 'ok'; data: T; error: null };

export function useApi<T>(url: string | null): UseApiState<T> {
  const [state, setState] = useState<UseApiState<T>>({
    status: 'loading',
    data: null,
    error: null,
  });

  useEffect(() => {
    if (url === null) {
      setState({ status: 'loading', data: null, error: null });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading', data: null, error: null });

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text();
          throw new Error(body || `${res.status} ${res.statusText}`);
        }
        return res.json() as Promise<T>;
      })
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'ok', data, error: null });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Request failed';
          setState({ status: 'error', data: null, error: message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
