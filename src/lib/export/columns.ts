import { AMOUNTS, type Entry, type EntryType } from '../../../shared/model';
import { bmi, navyFat, type Body } from '../body';
import { intLabel, zoneName } from '../format';

export type Cell = string | number | null;

export interface Column {
  header: string;
  /** `body` (estatura y sexo del perfil) solo lo usan las columnas calculadas de peso. */
  value: (e: Entry, body: Body) => Cell;
  /** Ancho aproximado en caracteres (Excel). */
  width: number;
  numeric?: boolean;
}

const date: Column = { header: 'Fecha', value: (e) => e.date, width: 12 };
const time: Column = { header: 'Hora', value: (e) => e.time, width: 8 };
const obs = (e: Entry): Cell => ('obs' in e && e.obs) || null;

/** Columnas de la tabla detallada por tipo (PDF y Excel). */
export const COLUMNS: Record<EntryType, Column[]> = {
  presion: [
    date,
    time,
    { header: 'Sistólica', value: (e) => (e.type === 'presion' ? e.sys : null), width: 10, numeric: true },
    { header: 'Diastólica', value: (e) => (e.type === 'presion' ? e.dia : null), width: 10, numeric: true },
    { header: 'Pulso (lpm)', value: (e) => (e.type === 'presion' ? (e.pulse ?? null) : null), width: 11, numeric: true },
    { header: 'Observaciones', value: obs, width: 40 },
  ],
  lpm: [
    date,
    time,
    { header: 'LPM', value: (e) => (e.type === 'lpm' ? e.value : null), width: 8, numeric: true },
    { header: 'Observaciones', value: obs, width: 40 },
  ],
  dolor: [
    date,
    time,
    { header: 'Zona', value: (e) => (e.type === 'dolor' ? zoneName(e) : null), width: 16 },
    { header: 'Duración (min)', value: (e) => (e.type === 'dolor' ? (e.constant ? 'Constante' : (e.duration ?? null)) : null), width: 14 },
    { header: 'Intensidad (1-10)', value: (e) => (e.type === 'dolor' ? e.intensity : null), width: 16, numeric: true },
    { header: 'Nivel', value: (e) => (e.type === 'dolor' ? intLabel(e.intensity) : null), width: 11 },
    // En "Otro" las observaciones ya aparecen como zona.
    { header: 'Observaciones', value: (e) => (e.type === 'dolor' && !(e.zone === 'Otro' && !e.zoneOther) ? e.obs || null : null), width: 36 },
  ],
  mareo: [
    date,
    time,
    { header: 'Duración (min)', value: (e) => (e.type === 'mareo' ? (e.duration ?? null) : null), width: 14, numeric: true },
    { header: 'Intensidad (1-10)', value: (e) => (e.type === 'mareo' ? e.intensity : null), width: 16, numeric: true },
    { header: 'Nivel', value: (e) => (e.type === 'mareo' ? intLabel(e.intensity) : null), width: 11 },
  ],
  medicamento: [
    date,
    time,
    { header: 'Medicamento', value: (e) => (e.type === 'medicamento' ? e.med : null), width: 20 },
    { header: 'Dosis', value: (e) => (e.type === 'medicamento' ? e.dose || null : null), width: 14 },
    { header: 'Para qué', value: (e) => (e.type === 'medicamento' ? e.purpose || null : null), width: 24 },
    { header: 'Síntoma', value: (e) => (e.type === 'medicamento' ? e.symptom || null : null), width: 30 },
  ],
  bano: [
    date,
    time,
    { header: 'Tipo', value: (e) => (e.type === 'bano' ? (e.kind === 'popo' ? 'Popó' : 'Pipí') : null), width: 8 },
    { header: 'Cantidad', value: (e) => (e.type === 'bano' ? e.amount : null), width: 11 },
    { header: 'Observaciones', value: obs, width: 40 },
  ],
  peso: [
    date,
    time,
    { header: 'Peso (kg)', value: (e) => (e.type === 'peso' ? e.weight : null), width: 10, numeric: true },
    { header: 'IMC', value: (e, b) => (e.type === 'peso' ? bmi(e.weight, b.height) : null), width: 7, numeric: true },
    { header: 'Cintura (cm)', value: (e) => (e.type === 'peso' ? (e.waist ?? null) : null), width: 12, numeric: true },
    { header: 'Cuello (cm)', value: (e) => (e.type === 'peso' ? (e.neck ?? null) : null), width: 11, numeric: true },
    { header: 'Cadera (cm)', value: (e) => (e.type === 'peso' ? (e.hip ?? null) : null), width: 11, numeric: true },
    { header: '% grasa US Navy', value: (e, b) => (e.type === 'peso' ? navyFat(e, b) : null), width: 15, numeric: true },
    { header: '% grasa báscula', value: (e) => (e.type === 'peso' ? (e.fat ?? null) : null), width: 15, numeric: true },
    { header: 'Observaciones', value: obs, width: 30 },
  ],
};

/** Columnas de una sección. En peso se omiten las medidas opcionales que no se capturaron en el periodo. */
export function columnsFor(type: EntryType, entries: Entry[], body: Body): Column[] {
  const cols = COLUMNS[type];
  if (type !== 'peso') return cols;
  return cols.filter((c, i) => i < 3 || entries.some((e) => c.value(e, body) != null));
}

/** Columnas de la tabla "por día" de pipí / popó. */
export const DAILY_HEADERS = ['Fecha', 'Veces', ...AMOUNTS];

/** YYYY-MM-DD → DD/MM/YYYY */
export const dmy = (d: string) => d.split('-').reverse().join('/');
