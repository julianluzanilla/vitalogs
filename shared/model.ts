// Modelo de datos compartido entre el cliente y las Functions.

export type EntryType = 'dolor' | 'mareo' | 'lpm' | 'presion' | 'medicamento' | 'bano';

export const ORDER: EntryType[] = ['dolor', 'mareo', 'lpm', 'presion', 'medicamento', 'bano'];

export const TYPES: Record<EntryType, { label: string; title: string; icon: string }> = {
  dolor: { label: 'Dolor', title: 'Dolor', icon: 'dolor' },
  mareo: { label: 'Mareo', title: 'Mareo', icon: 'mareo' },
  lpm: { label: 'Pulso', title: 'Pulso', icon: 'lpm' },
  presion: { label: 'Presión', title: 'Presión arterial', icon: 'presion' },
  medicamento: { label: 'Medicamento', title: 'Medicamento', icon: 'medicamento' },
  bano: { label: 'Baño', title: 'Baño', icon: 'bano' },
};

export const ZONES = ['Cabeza', 'Espalda', 'Ciática', 'Cuello', 'Ojos', 'Muslo', 'Pantorrilla', 'Otro'] as const;
export const OBS_PRESETS = [
  'En reposo +10 min',
  'Al despertar',
  'Después de subir escaleras',
  'Después de comer',
  'Después de ejercicio',
  'Antes de dormir',
];
/** Sugerencias para "¿Para qué es?" de un medicamento. */
export const MED_PURPOSES = [
  'Control de hipertensión',
  'Dolor',
  'Desinflamatorio',
  'Antidepresivo',
  'Ansiolítico',
  'TDAH',
  'Conciliar el sueño',
  'Mareo / vértigo',
  'Protector gástrico',
  'Colesterol',
  'Diabetes',
  'Alergia',
  'Antibiótico',
  'Vitamina / suplemento',
];
export const AMOUNTS = ['Muy poco', 'Poco', 'Regular', 'Mucho'] as const;

export type Amount = (typeof AMOUNTS)[number];

/** `zoneOther` es heredado (versiones anteriores lo usaban solo para la zona "Otro"); ahora el detalle va en `obs`. */
export interface DolorData { zone: string; zoneOther?: string; obs?: string; constant: boolean; duration?: number | null; intensity: number }
export interface MareoData { duration?: number | null; intensity: number }
export interface LpmData { value: number; obs?: string }
export interface PresionData { sys: number; dia: number; pulse?: number | null; obs?: string }
export interface MedicamentoData { med: string; dose?: string; purpose?: string; symptom?: string }
export interface BanoData { kind: 'pipi' | 'popo'; amount: Amount; obs?: string }

interface Base<T extends EntryType> {
  id: string;
  type: T;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  updatedAt: number; // ms epoch, asignado por el cliente (last-write-wins)
  deleted?: 0 | 1;
}

export type DolorEntry = Base<'dolor'> & DolorData;
export type MareoEntry = Base<'mareo'> & MareoData;
export type LpmEntry = Base<'lpm'> & LpmData;
export type PresionEntry = Base<'presion'> & PresionData;
export type MedicamentoEntry = Base<'medicamento'> & MedicamentoData;
export type BanoEntry = Base<'bano'> & BanoData;

export type Entry = DolorEntry | MareoEntry | LpmEntry | PresionEntry | MedicamentoEntry | BanoEntry;

export interface Med {
  id: string;
  name: string;
  dose: string;
  /** Para qué es el medicamento (p. ej. "Control de hipertensión"). */
  purpose?: string;
  updatedAt: number;
  deleted?: 0 | 1;
}

export interface Profile {
  reportName: string;
  updatedAt: number;
}

export interface Me {
  id: string;
  username: string;
  displayName: string;
  mustChangePassword: boolean;
}

export interface SyncRequest {
  cursor: number;
  entries: Entry[];
  meds: Med[];
  profile?: Profile | null;
}

export interface SyncResponse {
  cursor: number;
  hasMore: boolean;
  entries: Entry[];
  meds: Med[];
  profile: Profile | null;
}

/** Máximo de cambios por petición de sincronización (límite de consultas D1 por invocación). */
export const SYNC_BATCH = 40;

/** Campos propios de cada tipo (lo que va en la columna `data`). */
export const DATA_FIELDS: Record<EntryType, string[]> = {
  dolor: ['zone', 'zoneOther', 'obs', 'constant', 'duration', 'intensity'],
  mareo: ['duration', 'intensity'],
  lpm: ['value', 'obs'],
  presion: ['sys', 'dia', 'pulse', 'obs'],
  medicamento: ['med', 'dose', 'purpose', 'symptom'],
  bano: ['kind', 'amount', 'obs'],
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const isNum = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const optNum = (v: unknown, min: number, max: number) => v == null || isNum(v, min, max);
const optStr = (v: unknown, max = 500) => v == null || (typeof v === 'string' && v.length <= max);
const str = (v: unknown, max = 500) => typeof v === 'string' && v.length > 0 && v.length <= max;

/**
 * Valida la forma de un registro recibido por la API (o restaurado de un respaldo).
 * Devuelve el registro normalizado, o null si no es válido.
 */
export function sanitizeEntry(raw: unknown): Entry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const type = r.type as EntryType;
  if (!str(r.id, 64) || !ORDER.includes(type)) return null;
  if (typeof r.date !== 'string' || !DATE_RE.test(r.date)) return null;
  if (typeof r.time !== 'string' || !TIME_RE.test(r.time)) return null;
  if (!isNum(r.updatedAt, 0, 1e14)) return null;
  const deleted = r.deleted ? 1 : 0;
  const base = { id: r.id as string, type, date: r.date, time: r.time, updatedAt: r.updatedAt as number, deleted } as const;
  if (deleted) {
    // Las lápidas no necesitan datos válidos, pero se conservan si vienen.
    const data: Record<string, unknown> = {};
    for (const k of DATA_FIELDS[type]) if (k in r) data[k] = r[k];
    return { ...data, ...base } as unknown as Entry;
  }
  let ok = false;
  switch (type) {
    case 'dolor':
      ok = str(r.zone, 80) && optStr(r.zoneOther, 120) && optStr(r.obs, 1000) && typeof r.constant === 'boolean' && optNum(r.duration, 0, 100000) && isNum(r.intensity, 1, 10);
      break;
    case 'mareo':
      ok = optNum(r.duration, 0, 100000) && isNum(r.intensity, 1, 10);
      break;
    case 'lpm':
      ok = isNum(r.value, 1, 400) && optStr(r.obs, 1000);
      break;
    case 'presion':
      ok = isNum(r.sys, 1, 400) && isNum(r.dia, 1, 400) && optNum(r.pulse, 1, 400) && optStr(r.obs, 1000);
      break;
    case 'medicamento':
      ok = str(r.med, 120) && optStr(r.dose, 120) && optStr(r.purpose, 120) && optStr(r.symptom, 300);
      break;
    case 'bano':
      ok = (r.kind === 'pipi' || r.kind === 'popo') && (AMOUNTS as readonly string[]).includes(r.amount as string) && optStr(r.obs, 1000);
      break;
  }
  if (!ok) return null;
  const data: Record<string, unknown> = {};
  for (const k of DATA_FIELDS[type]) if (r[k] !== undefined) data[k] = r[k];
  return { ...data, ...base } as unknown as Entry;
}

export function sanitizeMed(raw: unknown): Med | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!str(r.id, 64) || !isNum(r.updatedAt, 0, 1e14)) return null;
  const deleted = r.deleted ? 1 : 0;
  if (!deleted && !str(r.name, 120)) return null;
  if (!optStr(r.dose, 120) || !optStr(r.purpose, 120)) return null;
  return { id: r.id as string, name: (r.name as string) || '', dose: (r.dose as string) || '', purpose: (r.purpose as string) || '', updatedAt: r.updatedAt as number, deleted };
}

/** Separa los campos propios del tipo para guardarlos como JSON. */
export function entryData(e: Entry): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const rec = e as unknown as Record<string, unknown>;
  for (const k of DATA_FIELDS[e.type]) if (rec[k] !== undefined) out[k] = rec[k];
  return out;
}
