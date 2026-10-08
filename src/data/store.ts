// Escrituras locales: se guardan en IndexedDB y se encolan para sincronizar.
import { HEIGHT_RANGE, sanitizeEntry, sanitizeMed, type Entry, type Med, type Profile } from '../../shared/model';
import { db, getKV, setKV } from './db';
import { scheduleSync } from './sync';

/** Reloj monótono: evita empates de updatedAt dentro del mismo milisegundo. */
let last = 0;
export function now(): number {
  last = Math.max(Date.now(), last + 1);
  return last;
}

export const newId = () => crypto.randomUUID();

export async function saveEntry(e: Entry) {
  const rec = { ...e, updatedAt: now(), deleted: 0 as const };
  await db.transaction('rw', [db.entries, db.outbox], async () => {
    await db.entries.put(rec);
    await db.outbox.put({ key: `entry:${rec.id}`, kind: 'entry', id: rec.id, updatedAt: rec.updatedAt });
  });
  scheduleSync();
}

export async function deleteEntry(id: string) {
  await db.transaction('rw', [db.entries, db.outbox], async () => {
    const e = await db.entries.get(id);
    if (!e) return;
    const rec = { ...e, deleted: 1 as const, updatedAt: now() };
    await db.entries.put(rec);
    await db.outbox.put({ key: `entry:${id}`, kind: 'entry', id, updatedAt: rec.updatedAt });
  });
  scheduleSync();
}

/** Deshace un borrado (toast "Deshacer"). */
export async function restoreEntry(id: string) {
  await db.transaction('rw', [db.entries, db.outbox], async () => {
    const e = await db.entries.get(id);
    if (!e) return;
    const rec = { ...e, deleted: 0 as const, updatedAt: now() };
    await db.entries.put(rec);
    await db.outbox.put({ key: `entry:${id}`, kind: 'entry', id, updatedAt: rec.updatedAt });
  });
  scheduleSync();
}

export async function addMed(name: string, dose: string, purpose = '') {
  const m: Med = { id: newId(), name: name.trim(), dose: dose.trim(), purpose: purpose.trim(), updatedAt: now(), deleted: 0 };
  await db.transaction('rw', [db.meds, db.outbox], async () => {
    await db.meds.put(m);
    await db.outbox.put({ key: `med:${m.id}`, kind: 'med', id: m.id, updatedAt: m.updatedAt });
  });
  scheduleSync();
}

export async function updateMed(id: string, name: string, dose: string, purpose: string) {
  await db.transaction('rw', [db.meds, db.outbox], async () => {
    const m = await db.meds.get(id);
    if (!m) return;
    const rec: Med = { ...m, name: name.trim(), dose: dose.trim(), purpose: purpose.trim(), updatedAt: now(), deleted: 0 };
    await db.meds.put(rec);
    await db.outbox.put({ key: `med:${id}`, kind: 'med', id, updatedAt: rec.updatedAt });
  });
  scheduleSync();
}

export async function removeMed(id: string) {
  await db.transaction('rw', [db.meds, db.outbox], async () => {
    const m = await db.meds.get(id);
    if (!m) return;
    const rec = { ...m, deleted: 1 as const, updatedAt: now() };
    await db.meds.put(rec);
    await db.outbox.put({ key: `med:${id}`, kind: 'med', id, updatedAt: rec.updatedAt });
  });
  scheduleSync();
}

export async function setReportName(reportName: string) {
  await setProfile({ reportName });
}

/** Actualiza campos del perfil conservando el resto (nombre, estatura, sexo). */
export async function setProfile(patch: Partial<Omit<Profile, 'updatedAt'>>) {
  await db.transaction('rw', [db.kv, db.outbox], async () => {
    const cur = await getKV<Profile>('profile');
    const p: Profile = { reportName: '', height: null, sex: null, ...cur, ...patch, updatedAt: now() };
    await setKV('profile', p);
    await db.outbox.put({ key: 'profile', kind: 'profile', id: 'profile', updatedAt: p.updatedAt });
  });
  scheduleSync(1500);
}

// ───────────── Respaldo JSON ─────────────

export interface Backup {
  app: 'VitaLogs';
  version: 2;
  exported: string;
  name: string;
  height?: number | null;
  sex?: Profile['sex'];
  entries: Entry[];
  meds: Med[];
}

export async function buildBackup(): Promise<Backup> {
  const entries = (await db.entries.toArray()).filter((e) => !e.deleted);
  const meds = (await db.meds.toArray()).filter((m) => !m.deleted);
  const profile = await getKV<Profile>('profile');
  return { app: 'VitaLogs', version: 2, exported: new Date().toISOString(), name: profile?.reportName || '', height: profile?.height ?? null, sex: profile?.sex ?? null, entries, meds };
}

/**
 * Restaura un respaldo: agrega o actualiza los registros del archivo (no borra los existentes).
 * Acepta también el formato del prototipo (ids "e123", números como texto, meds sin id).
 */
export async function restoreBackup(raw: unknown): Promise<number> {
  const data = raw as { entries?: unknown[]; meds?: unknown[]; name?: string; height?: unknown; sex?: unknown };
  if (!data || !Array.isArray(data.entries)) throw new Error('Archivo no válido');
  const t = now();
  const entries: Entry[] = [];
  for (const r of data.entries) {
    const e = sanitizeEntry(normalizeLegacy(r as Record<string, unknown>, t));
    if (e && !e.deleted) entries.push({ ...e, updatedAt: now() });
  }
  const existingMeds = await db.meds.toArray();
  const meds: Med[] = [];
  for (const r of data.meds || []) {
    const raw = r as Record<string, unknown>;
    const m = sanitizeMed({ id: raw.id || newId(), name: raw.name, dose: raw.dose || '', purpose: raw.purpose || '', updatedAt: t });
    if (!m || m.deleted) continue;
    if (existingMeds.some((x) => !x.deleted && x.name === m.name && x.dose === m.dose)) continue;
    meds.push({ ...m, updatedAt: now() });
  }
  await db.transaction('rw', [db.entries, db.meds, db.outbox], async () => {
    await db.entries.bulkPut(entries);
    await db.meds.bulkPut(meds);
    await db.outbox.bulkPut([
      ...entries.map((e) => ({ key: `entry:${e.id}`, kind: 'entry' as const, id: e.id, updatedAt: e.updatedAt })),
      ...meds.map((m) => ({ key: `med:${m.id}`, kind: 'med' as const, id: m.id, updatedAt: m.updatedAt })),
    ]);
  });
  const cur = await getKV<Profile>('profile');
  const patch: Partial<Profile> = {};
  if (data.name && !cur?.reportName) patch.reportName = data.name;
  if (typeof data.height === 'number' && data.height >= HEIGHT_RANGE[0] && data.height <= HEIGHT_RANGE[1] && !cur?.height) patch.height = data.height;
  if ((data.sex === 'M' || data.sex === 'F') && !cur?.sex) patch.sex = data.sex;
  if (Object.keys(patch).length) await setProfile(patch);
  scheduleSync(100);
  return entries.length;
}

function normalizeLegacy(r: Record<string, unknown>, t: number): Record<string, unknown> {
  const out: Record<string, unknown> = { ...r, updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : t };
  const num = (k: string, opt: boolean) => {
    const v = out[k];
    if (v === '' || v == null) {
      if (opt) out[k] = null;
      return;
    }
    const n = Number(v);
    out[k] = Number.isFinite(n) ? n : v;
  };
  if (typeof out.id !== 'string' || !out.id) out.id = newId();
  for (const k of ['value', 'sys', 'dia', 'intensity', 'weight']) if (k in out) num(k, false);
  for (const k of ['duration', 'pulse', 'waist', 'neck', 'hip', 'fat']) if (k in out) num(k, true);
  for (const k of ['obs', 'zoneOther', 'dose', 'purpose', 'symptom']) if (out[k] === '') delete out[k];
  if (out.type === 'dolor') out.constant = !!out.constant;
  return out;
}
