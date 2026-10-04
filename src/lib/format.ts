import type { Entry } from '../../shared/model';

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha local en formato YYYY-MM-DD. */
export const ds = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Hora local en formato HH:MM. */
export const tms = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const noon = (date: string) => new Date(`${date}T12:00`);

export function dayLabel(date: string, now = new Date()): string {
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (date === ds(now)) return 'Hoy';
  if (date === ds(y)) return 'Ayer';
  return cap(noon(date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
}

export const shortDate = (date: string) => noon(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
export const longDate = (date: string) => noon(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
export const todayLong = (now = new Date()) => cap(now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));

export function intLabel(n: number): string {
  return n <= 3 ? 'Leve' : n <= 6 ? 'Moderado' : n <= 8 ? 'Fuerte' : 'Severo';
}

export function greeting(name: string, now = new Date()): string {
  const h = now.getHours();
  const first = (name || '').split(' ')[0];
  return (h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches') + (first ? `, ${first}` : '');
}

export function relTime(e: Entry | undefined, now = new Date()): string {
  if (!e) return 'Sin registros';
  const m = Math.round((now.getTime() - new Date(`${e.date}T${e.time}`).getTime()) / 60000);
  if (m < 1) return 'Justo ahora';
  if (m < 60) return `Hace ${m} min`;
  if (m < 1440) return `Hace ${Math.round(m / 60)} h`;
  return `${dayLabel(e.date, now)} · ${e.time}`;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export const countLabel = (n: number) => plural(n, 'registro', 'registros');

/** Zona del dolor. Para "Otro" se usa lo que se especificó (campo heredado zoneOther u Observaciones). */
export function zoneName(e: { zone: string; zoneOther?: string; obs?: string }): string {
  return e.zone === 'Otro' ? e.zoneOther || e.obs || 'Otro' : e.zone;
}

export interface Summary {
  title: string;
  detail: string;
  badge: string;
}

export function summary(e: Entry): Summary {
  switch (e.type) {
    case 'dolor':
      return {
        title: `Dolor · ${zoneName(e)}`,
        detail: [
          // En "Otro" las observaciones ya son el título.
          e.zone === 'Otro' && !e.zoneOther ? '' : e.obs,
          e.constant ? 'Constante' : e.duration ? `${e.duration} min` : 'Duración no indicada',
          intLabel(e.intensity),
        ]
          .filter(Boolean)
          .join(' · '),
        badge: `${e.intensity}/10`,
      };
    case 'mareo':
      return {
        title: 'Mareo',
        detail: `${e.duration ? `${e.duration} min` : 'Duración no indicada'} · ${intLabel(e.intensity)}`,
        badge: `${e.intensity}/10`,
      };
    case 'lpm':
      return { title: 'Pulso', detail: e.obs || 'Sin observaciones', badge: `${e.value} lpm` };
    case 'presion':
      return {
        title: 'Presión arterial',
        detail: [e.pulse ? `${e.pulse} lpm` : '', e.obs].filter(Boolean).join(' · ') || 'Sin observaciones',
        badge: `${e.sys}/${e.dia}`,
      };
    case 'medicamento':
      return { title: e.med, detail: [e.dose, e.purpose, e.symptom ? `Por: ${e.symptom}` : ''].filter(Boolean).join(' · ') || '—', badge: '' };
    case 'bano':
      return { title: `Baño · ${e.kind === 'popo' ? 'Popó' : 'Pipí'}`, detail: [e.amount, e.obs].filter(Boolean).join(' · '), badge: '' };
  }
}

/** Orden cronológico descendente (más reciente primero). */
export const byNewest = (a: Entry, b: Entry) => (b.date + b.time).localeCompare(a.date + a.time);
