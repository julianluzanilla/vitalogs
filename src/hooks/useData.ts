import { useLiveQuery } from 'dexie-react-hooks';
import type { Entry, Med, Profile } from '../../shared/model';
import { db, getKV } from '../data/db';
import { byNewest } from '../lib/format';

const NONE: never[] = [];

/** Registros activos, del más reciente al más antiguo. */
export function useEntries(): Entry[] {
  return useLiveQuery(async () => (await db.entries.toArray()).filter((e) => !e.deleted).sort(byNewest), []) ?? NONE;
}

export function useMeds(): Med[] {
  return useLiveQuery(async () => (await db.meds.toArray()).filter((m) => !m.deleted).sort((a, b) => a.name.localeCompare(b.name, 'es')), []) ?? NONE;
}

export function useProfile(): Profile | undefined {
  return useLiveQuery(() => getKV<Profile>('profile'), []);
}

export function usePendingCount(): number {
  return useLiveQuery(() => db.outbox.count(), []) ?? 0;
}
