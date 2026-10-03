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
  zoneOther: string;
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
  symptom: string;
  kind: '' | 'pipi' | 'popo';
  amount: Amount;
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
    zoneOther: '',
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
    symptom: '',
    kind: '',
    amount: 'Regular',
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
      Object.assign(f, { zone: e.zone, zoneOther: e.zoneOther || '', constant: !!e.constant, duration: s(e.duration), intensity: e.intensity });
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
      Object.assign(f, { med: e.med, dose: e.dose || '', symptom: e.symptom || '' });
      break;
    case 'bano':
      Object.assign(f, { kind: e.kind, amount: e.amount, obs: e.obs || '' });
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

/** Devuelve el mensaje de error de validación, o '' si es válido. */
export function validateForm(f: FormState): string {
  const t = f.type;
  if (!f.date || !f.time) return 'Indica fecha y hora.';
  if (t === 'dolor' && !f.zone) return 'Selecciona la zona del dolor.';
  if (t === 'dolor' && f.zone === 'Otro' && !f.zoneOther.trim()) return 'Especifica la zona.';
  if (t === 'lpm' && !posInt(f.value)) return 'Ingresa el resultado.';
  if (t === 'presion' && (!posInt(f.sys) || !posInt(f.dia))) return 'Ingresa sistólica y diastólica.';
  if (t === 'medicamento' && !f.med) return 'Selecciona un medicamento.';
  if (t === 'bano' && !f.kind) return 'Selecciona pipí o popó.';
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
        zoneOther: f.zone === 'Otro' ? f.zoneOther.trim() : undefined,
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
      return { ...base, type: 'medicamento', med: f.med, dose: f.dose.trim() || undefined, symptom: f.symptom.trim() || undefined };
    case 'bano':
      return { ...base, type: 'bano', kind: f.kind as 'pipi' | 'popo', amount: f.amount, obs };
    default:
      throw new Error('Tipo de registro no seleccionado');
  }
}
