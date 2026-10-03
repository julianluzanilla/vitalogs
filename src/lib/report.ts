import { ORDER, TYPES, type Entry, type EntryType } from '../../shared/model';
import { ds, longDate, shortDate, summary, zoneName } from './format';

export type RangeKey = '7' | '30' | '90' | 'all' | 'custom';

export const RANGES: [RangeKey, string][] = [
  ['7', '7 días'],
  ['30', '30 días'],
  ['90', '90 días'],
  ['all', 'Todo'],
  ['custom', 'Personalizado'],
];

export interface ReportOptions {
  range: RangeKey;
  from?: string;
  to?: string;
  types: EntryType[];
  name: string;
}

export interface Stat {
  label: string;
  value: string;
}

export interface ReportRow {
  when: string;
  text: string;
}

export interface ReportSection {
  type: EntryType;
  title: string;
  icon: string;
  stats: Stat[];
  rows: ReportRow[];
  /** Registros del tipo, del más reciente al más antiguo. */
  entries: Entry[];
}

export interface Report {
  name: string;
  from: string | null;
  to: string;
  rangeLabel: string;
  generated: string; // YYYY-MM-DD
  total: number;
  sections: ReportSection[];
}

const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
const avg1 = (a: number[]) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '0');

function stats(t: EntryType, L: Entry[]): [string, string | number][] {
  switch (t) {
    case 'presion': {
      const P = L as Extract<Entry, { type: 'presion' }>[];
      const mx = P.reduce((a, b) => (b.sys > a.sys ? b : a));
      const mn = P.reduce((a, b) => (b.sys < a.sys ? b : a));
      const st: [string, string | number][] = [
        ['Tomas', P.length],
        ['Promedio', `${avg(P.map((e) => e.sys))}/${avg(P.map((e) => e.dia))}`],
        ['Más alta', `${mx.sys}/${mx.dia}`],
        ['Más baja', `${mn.sys}/${mn.dia}`],
      ];
      const pulses = P.filter((e) => e.pulse).map((e) => e.pulse as number);
      if (pulses.length) st.push(['Pulso prom.', `${avg(pulses)} lpm`]);
      return st;
    }
    case 'lpm': {
      const V = (L as Extract<Entry, { type: 'lpm' }>[]).map((e) => e.value);
      return [
        ['Tomas', V.length],
        ['Promedio', `${avg(V)} lpm`],
        ['Mínimo', `${Math.min(...V)} lpm`],
        ['Máximo', `${Math.max(...V)} lpm`],
      ];
    }
    case 'dolor': {
      const D = L as Extract<Entry, { type: 'dolor' }>[];
      const z: Record<string, number> = {};
      D.forEach((e) => {
        const k = zoneName(e);
        z[k] = (z[k] || 0) + 1;
      });
      const st: [string, string | number][] = [
        ['Episodios', D.length],
        ['Intensidad prom.', `${avg1(D.map((e) => e.intensity))}/10`],
        ['Constantes', D.filter((e) => e.constant).length],
      ];
      Object.entries(z)
        .sort((a, b) => b[1] - a[1])
        .forEach(([k, v]) => st.push([k, `${v} ${v === 1 ? 'vez' : 'veces'}`]));
      return st;
    }
    case 'mareo': {
      const M = L as Extract<Entry, { type: 'mareo' }>[];
      const durations = M.filter((e) => e.duration).map((e) => e.duration as number);
      return [
        ['Episodios', M.length],
        ['Duración prom.', `${avg(durations)} min`],
        ['Intensidad prom.', `${avg1(M.map((e) => e.intensity))}/10`],
      ];
    }
    case 'medicamento': {
      const m: Record<string, number> = {};
      (L as Extract<Entry, { type: 'medicamento' }>[]).forEach((e) => (m[e.med] = (m[e.med] || 0) + 1));
      const st: [string, string | number][] = [['Tomas', L.length]];
      Object.entries(m).forEach(([k, v]) => st.push([k, `${v} ${v === 1 ? 'toma' : 'tomas'}`]));
      return st;
    }
    case 'bano': {
      const p = (L as Extract<Entry, { type: 'bano' }>[]).filter((e) => e.kind !== 'popo').length;
      return [
        ['Pipí', p],
        ['Popó', L.length - p],
      ];
    }
  }
}

export function rangeBounds(opts: Pick<ReportOptions, 'range' | 'from' | 'to'>, now = new Date()): { from: string | null; to: string } {
  let from: string | null = null;
  let to = ds(now);
  if (opts.range === 'custom') {
    from = opts.from || null;
    to = opts.to || to;
  } else if (opts.range !== 'all') {
    const d = new Date(now);
    d.setDate(d.getDate() - (Number(opts.range) - 1));
    from = ds(d);
  }
  return { from, to };
}

export function computeReport(all: Entry[], opts: ReportOptions, now = new Date()): Report {
  const { from, to } = rangeBounds(opts, now);
  const list = all
    .filter((e) => !e.deleted && (!from || e.date >= from) && e.date <= to)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const sections: ReportSection[] = [];
  let total = 0;
  for (const t of ORDER) {
    if (!opts.types.includes(t)) continue;
    const L = list.filter((e) => e.type === t);
    if (!L.length) continue;
    total += L.length;
    const newest = L.slice().reverse();
    sections.push({
      type: t,
      title: TYPES[t].title,
      icon: TYPES[t].icon,
      stats: stats(t, L).map(([label, value]) => ({ label, value: String(value) })),
      rows: newest.map((e) => {
        const x = summary(e);
        const head = t === 'dolor' || t === 'bano' ? x.title.split(' · ')[1] : t === 'medicamento' ? x.title : '';
        return { when: `${shortDate(e.date)} · ${e.time}`, text: [x.badge, head, x.detail].filter(Boolean).join(' · ') };
      }),
      entries: newest,
    });
  }
  return {
    name: opts.name,
    from,
    to,
    rangeLabel: from ? `${longDate(from)} – ${longDate(to)}` : 'Todo el historial',
    generated: ds(now),
    total,
    sections,
  };
}

export function reportText(r: Report): string {
  let out = `Reporte de salud — ${r.name}\n${r.rangeLabel}\n`;
  for (const sec of r.sections) {
    out += `\n${sec.title.toUpperCase()}\n${sec.stats.map((s) => `${s.label}: ${s.value}`).join(' · ')}\n`;
    for (const rw of sec.rows) out += `  ${rw.when}  ${rw.text}\n`;
  }
  return out;
}

/** Nombre base de archivo, p. ej. "VitaLogs_Julian_2026-09-04_2026-10-03". */
export function reportFileBase(r: Report): string {
  const name = (r.name || 'reporte')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return ['VitaLogs', name, r.from || 'inicio', r.to].join('_');
}
