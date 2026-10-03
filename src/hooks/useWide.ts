import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 700px)';

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

/** true en PC/iPad (≥ 700px): sidebar y modales; false en iPhone: tab bar y hojas inferiores. */
export function useWide(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches);
}
