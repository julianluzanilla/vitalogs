import type { Amount, Entry, EntryType } from '../../shared/model';
import { ds, tms } from './format';

/** Estado editable del formulario (los números se editan como texto). */
export interface FormState {
  type: EntryType | null;
  step: 'type' | 'fields';
  editing: string | null;
  date: string;
  time: string;
  zone: string;
  constant: boolean;
  duration: string;
  intensity: number;
  value: string;
  sys: string;
  dia: string;
  pulse: string;
  obs: string;
  med: string;
  dose: string;
  purpose: string;
  symptom: string;
  kind: '' | 'pipi' | 'popo';
  amount: Amount;
  weight: string;
  waist: string;
  neck: string;
  hip: string;
  fat: string;
  err: string;
}

export function blankForm(type: EntryType | null, now = new Date()): FormState {
  return {
    type,
    step: type ? 'fields' : 'type',
    editing: null,
    date: ds(now),
    time: tms(now),
    zone: '',
    constant: false,
    duration: '',
    intensity: 5,
    value: '',
    sys: '',
    dia: '',
    pulse: '',
    obs: '',
    med: '',
    dose: '',
    purpose: '',
    symptom: '',
    kind: '',
    amount: 'Regular',
    weight: '',
    waist: '',
    neck: '',
    hip: '',
    fat: '',
    err: '',
  };
}

const s = (v: number | null | undefined) => (v == null ? '' : String(v));

export function formFromEntry(e: Entry): FormState {
  const f = blankForm(e.type);
  f.editing = e.id;
  f.date = e.date;
  f.time = e.time;
  switch (e.type) {
    case 'dolor':
      // Registros antiguos guardaban el detalle de "Otro" en zoneOther.
      Object.assign(f, { zone: e.zone, obs: [e.zoneOther, e.obs].filter(Boolean).join(', '), constant: !!e.constant, duration: s(e.duration), intensity: e.intensity });
      break;
    case 'mareo':
      Object.assign(f, { duration: s(e.duration), intensity: e.intensity });
      break;
    case 'lpm':
      Object.assign(f, { value: s(e.value), obs: e.obs || '' });
      break;
    case 'presion':
      Object.assign(f, { sys: s(e.sys), dia: s(e.dia), pulse: s(e.pulse), obs: e.obs || '' });
      break;
    case 'medicamento':
      Object.assign(f, { med: e.med, dose: e.dose || '', purpose: e.purpose || '', symptom: e.symptom || '' });
      break;
    case 'bano':
      Object.assign(f, { kind: e.kind, amount: e.amount, obs: e.obs || '' });
      break;
    case 'peso':
      Object.assign(f, { weight: s(e.weight), waist: s(e.waist), neck: s(e.neck), hip: s(e.hip), fat: s(e.fat), obs: e.obs || '' });
      break;
  }
  return f;
}

const posInt = (v: string) => {
  const n = Number(v);
  return v.trim() !== '' && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};
const optInt = (v: string) => {
  const n = Number(v);
  return v.trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

/** Número con decimales (acepta coma decimal), redondeado a 0.1; null si está vacío o no es válido. */
export const dec = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return v.trim() !== '' && Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null;
};
const inRange = (v: string, min: number, max: number) => {
  const n = dec(v);
  return n != null && n >= min && n <= max;
};

/** Devuelve el mensaje de error de validación, o '' si es válido. */
export function validateForm(f: FormState): string {
  const t = f.type;
  if (!f.date || !f.time) return 'Indica fecha y hora.';
  if (t === 'dolor' && !f.zone) return 'Selecciona la zona del dolor.';
  if (t === 'dolor' && f.zone === 'Otro' && !f.obs.trim()) return 'Especifica la zona en Observaciones.';
  if (t === 'lpm' && !posInt(f.value)) return 'Ingresa el resultado.';
  if (t === 'presion' && (!posInt(f.sys) || !posInt(f.dia))) return 'Ingresa sistólica y diastólica.';
  if (t === 'medicamento' && !f.med) return 'Selecciona un medicamento.';
  if (t === 'bano' && !f.kind) return 'Selecciona pipí o popó.';
  if (t === 'peso') {
    if (!inRange(f.weight, 1, 500)) return 'Ingresa tu peso en kg.';
    for (const [k, label] of [['waist', 'cintura'], ['neck', 'cuello'], ['hip', 'cadera']] as const)
      if (f[k].trim() && !inRange(f[k], 10, 300)) return `Revisa la medida de ${label} (cm).`;
    if (f.fat.trim() && !inRange(f.fat, 1, 75)) return 'El % de grasa debe estar entre 1 y 75.';
  }
  return '';
}

/** Convierte un formulario válido en un registro. */
export function entryFromForm(f: FormState, id: string, updatedAt: number): Entry {
  const base = { id, date: f.date, time: f.time, updatedAt };
  const obs = f.obs.trim() || undefined;
  switch (f.type) {
    case 'dolor':
      return {
        ...base,
        type: 'dolor',
        zone: f.zone,
        obs,
        constant: f.constant,
        duration: f.constant ? null : optInt(f.duration),
        intensity: f.intensity,
      };
    case 'mareo':
      return { ...base, type: 'mareo', duration: optInt(f.duration), intensity: f.intensity };
    case 'lpm':
      return { ...base, type: 'lpm', value: posInt(f.value)!, obs };
    case 'presion':
      return { ...base, type: 'presion', sys: posInt(f.sys)!, dia: posInt(f.dia)!, pulse: posInt(f.pulse), obs };
    case 'medicamento':
      return { ...base, type: 'medicamento', med: f.med, dose: f.dose.trim() || undefined, purpose: f.purpose.trim() || undefined, symptom: f.symptom.trim() || undefined };
    case 'bano':
      return { ...base, type: 'bano', kind: f.kind as 'pipi' | 'popo', amount: f.amount, obs };
    case 'peso':
      return { ...base, type: 'peso', weight: dec(f.weight)!, waist: dec(f.waist), neck: dec(f.neck), hip: dec(f.hip), fat: dec(f.fat), obs };
    default:
      throw new Error('Tipo de registro no seleccionado');
  }
}
