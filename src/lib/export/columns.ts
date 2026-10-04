import type { Entry, EntryType } from '../../../shared/model';
import { intLabel, zoneName } from '../format';

export type Cell = string | number | null;

export interface Column {
  header: string;
  value: (e: Entry) => Cell;
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
};

/** YYYY-MM-DD → DD/MM/YYYY */
export const dmy = (d: string) => d.split('-').reverse().join('/');
