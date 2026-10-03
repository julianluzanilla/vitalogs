import Dexie, { type EntityTable } from 'dexie';
import type { Entry, Me, Med, Profile } from '../../shared/model';

/** Cambio local pendiente de subir. La clave colapsa ediciones repetidas del mismo objeto. */
export interface OutboxItem {
  key: string; // 'entry:<id>' | 'med:<id>' | 'profile'
  kind: 'entry' | 'med' | 'profile';
  id: string;
  updatedAt: number;
}

export interface KV {
  key: 'me' | 'cursor' | 'profile' | 'lastSync';
  value: unknown;
}

export class VitaDB extends Dexie {
  entries!: EntityTable<Entry, 'id'>;
  meds!: EntityTable<Med, 'id'>;
  outbox!: EntityTable<OutboxItem, 'key'>;
  kv!: EntityTable<KV, 'key'>;

  constructor() {
    super('vitalogs');
    this.version(1).stores({
      entries: 'id, date, type',
      meds: 'id',
      outbox: 'key',
      kv: 'key',
    });
  }
}

export const db = new VitaDB();

export async function getKV<T>(key: KV['key']): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined;
}

export async function setKV(key: KV['key'], value: unknown) {
  await db.kv.put({ key, value });
}

export const getMe = () => getKV<Me>('me');
export const getProfile = () => getKV<Profile>('profile');

/** Borra todos los datos locales (cierre de sesión o cambio de usuario). */
export async function wipeLocal() {
  await db.transaction('rw', [db.entries, db.meds, db.outbox, db.kv], async () => {
    await Promise.all([db.entries.clear(), db.meds.clear(), db.outbox.clear(), db.kv.clear()]);
  });
}
