import { SYNC_BATCH, type Entry, type Med, type Profile, type SyncRequest, type SyncResponse } from '../../shared/model';
import { ApiError, NetworkError, api } from './api';
import { db, getKV, setKV, type OutboxItem } from './db';

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

type Listener = (s: SyncState) => void;
const listeners = new Set<Listener>();
let state: SyncState = 'idle';
let onUnauthorized: (() => void) | null = null;

function setState(s: SyncState) {
  state = s;
  listeners.forEach((l) => l(s));
}

export const getSyncState = () => state;
export function subscribeSync(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Se llama cuando el servidor responde 401/403 (sesión vencida o cambio de contraseña pendiente). */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

let running: Promise<void> | null = null;
let again = false;
let enabled = false;

export function enableSync(on: boolean) {
  enabled = on;
}

/** Sincroniza ahora. Si ya hay una sincronización en curso, programa otra al terminar. */
export function syncNow(): Promise<void> {
  if (!enabled) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncLoop();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

let debounce: ReturnType<typeof setTimeout> | undefined;
export function scheduleSync(ms = 800) {
  clearTimeout(debounce);
  debounce = setTimeout(() => void syncNow(), ms);
}

async function syncLoop() {
  setState('syncing');
  try {
    // Límite de vueltas para no quedarse en bucle ante un error inesperado.
    for (let round = 0; round < 200; round++) {
      const pending = await db.outbox.limit(SYNC_BATCH).toArray();
      const req = await buildRequest(pending);
      const res = await api<SyncResponse>('/sync', { body: req });
      await applyResponse(res, pending);
      const more = (await db.outbox.count()) > 0;
      if (!res.hasMore && !more) break;
    }
    await setKV('lastSync', Date.now());
    setState('idle');
  } catch (err) {
    if (err instanceof NetworkError) setState('offline');
    else if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      setState('idle');
      onUnauthorized?.();
    } else {
      console.error(err);
      setState('error');
    }
  }
}

async function buildRequest(pending: OutboxItem[]): Promise<SyncRequest> {
  const cursor = (await getKV<number>('cursor')) ?? 0;
  const entryIds = pending.filter((p) => p.kind === 'entry').map((p) => p.id);
  const medIds = pending.filter((p) => p.kind === 'med').map((p) => p.id);
  const entries = (await db.entries.bulkGet(entryIds)).filter(Boolean) as Entry[];
  const meds = (await db.meds.bulkGet(medIds)).filter(Boolean) as Med[];
  const profile = pending.some((p) => p.kind === 'profile') ? ((await getKV<Profile>('profile')) ?? null) : null;
  return { cursor, entries, meds, profile };
}

async function applyResponse(res: SyncResponse, sent: OutboxItem[]) {
  await db.transaction('rw', [db.entries, db.meds, db.outbox, db.kv], async () => {
    // Quita de la cola lo enviado, salvo que se haya vuelto a editar mientras tanto.
    for (const item of sent) {
      const current = await db.outbox.get(item.key);
      if (current && current.updatedAt === item.updatedAt) await db.outbox.delete(item.key);
    }
    const pendingKeys = new Set((await db.outbox.toArray()).map((o) => o.key));

    for (const e of res.entries) {
      if (pendingKeys.has(`entry:${e.id}`)) continue; // el cambio local más nuevo gana
      const local = await db.entries.get(e.id);
      if (!local || e.updatedAt >= local.updatedAt) await db.entries.put(e);
    }
    for (const m of res.meds) {
      if (pendingKeys.has(`med:${m.id}`)) continue;
      const local = await db.meds.get(m.id);
      if (!local || m.updatedAt >= local.updatedAt) await db.meds.put(m);
    }
    if (res.profile && !pendingKeys.has('profile')) {
      const local = await getKV<Profile>('profile');
      if (!local || res.profile.updatedAt >= local.updatedAt) await setKV('profile', res.profile);
    }
    await setKV('cursor', res.cursor);
  });
}

/** Arranca los disparadores automáticos de sincronización. Devuelve la función para detenerlos. */
export function startAutoSync(): () => void {
  const onOnline = () => void syncNow();
  const onVisible = () => document.visibilityState === 'visible' && void syncNow();
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  const timer = setInterval(() => void syncNow(), 60_000);
  void syncNow();
  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(timer);
  };
}
