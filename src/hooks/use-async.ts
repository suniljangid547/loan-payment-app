import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const fnRef = useRef(fn);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    let alive = true;
    Promise.resolve(fnRef.current())
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (alive) setError(e);
      });
    return () => {
      alive = false;
    };
    // deps are plain values provided by the caller each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, reload };
}
