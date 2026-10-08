import { AMOUNTS, TYPES, type Amount, type Entry, type EntryType } from '../../shared/model';
import { bmi, bmiLabel, fmt1, navyFat, type Body } from './body';
import { ds, longDate, shortDate, summary, zoneName } from './format';

export type RangeKey = '7' | '30' | '90' | 'all' | 'custom';

export const RANGES: [RangeKey, string][] = [
  ['7', '7 días'],
  ['30', '30 días'],
  ['90', '90 días'],
  ['all', 'Todo'],
  ['custom', 'Personalizado'],
];

/** Secciones del reporte. Baño se divide en pipí y popó para poder compartir solo una. */
export type SectionKey = Exclude<EntryType, 'bano'> | 'pipi' | 'popo';

export const SECTIONS: { key: SectionKey; type: EntryType; label: string; title: string; icon: string }[] = [
  ...(['dolor', 'mareo', 'lpm', 'presion', 'medicamento'] as const).map((t) => ({ key: t, type: t, label: TYPES[t].label, title: TYPES[t].title, icon: TYPES[t].icon })),
  { key: 'pipi', type: 'bano', label: 'Pipí', title: 'Baño · Pipí', icon: 'bano' },
  { key: 'popo', type: 'bano', label: 'Popó', title: 'Baño · Popó', icon: 'bano' },
  { key: 'peso', type: 'peso', label: 'Peso', title: TYPES.peso.title, icon: TYPES.peso.icon },
];
export const SECTION_KEYS = SECTIONS.map((s) => s.key);

const inSection = (key: SectionKey, e: Entry) => (e.type === 'bano' ? (e.kind === 'popo' ? 'popo' : 'pipi') === key : e.type === key);

export interface ReportOptions {
  range: RangeKey;
  from?: string;
  to?: string;
  types: SectionKey[];
  name: string;
  /** Estatura y sexo del perfil, para IMC y % de grasa. */
  body?: Body;
}

export interface Stat {
  label: string;
  value: string;
}

export interface ReportRow {
  when: string;
  text: string;
}

/** Conteo de un día (pipí / popó): veces y cuántas de cada cantidad. */
export interface DailyRow {
  date: string;
  total: number;
  amounts: Record<Amount, number>;
  /** Es el día en que se generó el reporte (aún en curso). */
  partial: boolean;
}

export interface ReportSection {
  key: SectionKey;
  type: EntryType;
  title: string;
  icon: string;
  stats: Stat[];
  rows: ReportRow[];
  /** Registros de la sección, del más reciente al más antiguo. */
  entries: Entry[];
  /** Resumen por día (solo pipí / popó), del más reciente al más antiguo. */
  daily?: DailyRow[];
}

export interface Report {
  name: string;
  from: string | null;
  to: string;
  rangeLabel: string;
  generated: string; // YYYY-MM-DD
  total: number;
  body: Body;
  sections: ReportSection[];
}

const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
const avg1 = (a: number[]) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '0');
const vez = (n: number) => `${n} ${n === 1 ? 'vez' : 'veces'}`;
/** Horario nocturno: de 22:00 a 05:59. */
const isNight = (time: string) => time >= '22:00' || time < '06:00';

/** Agrupa idas al baño por día, del más reciente al más antiguo. */
export function dailyRows(L: Entry[], today: string): DailyRow[] {
  const m = new Map<string, DailyRow>();
  for (const e of L) {
    if (e.type !== 'bano') continue;
    let d = m.get(e.date);
    if (!d) {
      d = { date: e.date, total: 0, amounts: Object.fromEntries(AMOUNTS.map((a) => [a, 0])) as Record<Amount, number>, partial: e.date === today };
      m.set(e.date, d);
    }
    d.total++;
    d.amounts[e.amount]++;
  }
  return [...m.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** Los promedios por día usan solo días completos (el día en curso bajaría el promedio), salvo que no haya otros. */
const fullDays = (daily: DailyRow[]) => {
  const full = daily.filter((d) => !d.partial);
  return full.length ? full : daily;
};

function banoStats(L: Extract<Entry, { type: 'bano' }>[], daily: DailyRow[]): [string, string | number][] {
  const days = fullDays(daily);
  const counts = days.map((d) => d.total);
  const st: [string, string | number][] = [
    ['Veces', L.length],
    ['Días con registro', daily.length],
    [days.length < daily.length ? 'Promedio por día*' : 'Promedio por día', avg1(counts)],
    ['Máximo en un día', Math.max(...counts)],
    ['Mínimo en un día', Math.min(...counts)],
    ['Nocturnas (22–6 h)', L.filter((e) => isNight(e.time)).length],
  ];
  for (const a of AMOUNTS) {
    const n = L.filter((e) => e.amount === a).length;
    if (n) st.push([a, vez(n)]);
  }
  return st;
}

/** Último registro (más reciente) que cumple la condición. */
const lastWhere = <T,>(L: T[], ok: (e: T) => unknown) => {
  for (let i = L.length - 1; i >= 0; i--) if (ok(L[i])) return L[i];
  return undefined;
};

function pesoStats(P: Extract<Entry, { type: 'peso' }>[], body: Body): [string, string | number][] {
  const first = P[0];
  const last = P[P.length - 1];
  const W = P.map((e) => e.weight);
  const st: [string, string | number][] = [
    ['Registros', P.length],
    ['Último peso', `${fmt1(last.weight)} kg`],
  ];
  if (P.length > 1) {
    const d = Math.round((last.weight - first.weight) * 10) / 10;
    st.push(['Cambio en el periodo', `${d > 0 ? '+' : d < 0 ? '−' : ''}${fmt1(Math.abs(d))} kg`]);
    st.push(['Mínimo', `${fmt1(Math.min(...W))} kg`]);
    st.push(['Máximo', `${fmt1(Math.max(...W))} kg`]);
  }
  const i = bmi(last.weight, body.height);
  if (i) st.push(['IMC actual', `${fmt1(i)} · ${bmiLabel(i)}`]);
  const navy = lastWhere(P, (e) => navyFat(e, body) != null);
  if (navy) st.push(['% grasa (US Navy)', `${fmt1(navyFat(navy, body)!)} %`]);
  const scale = lastWhere(P, (e) => e.fat);
  if (scale) st.push(['% grasa (báscula)', `${fmt1(scale.fat!)} %`]);
  const waist = lastWhere(P, (e) => e.waist);
  if (waist) st.push(['Cintura', `${fmt1(waist.waist!)} cm`]);
  return st;
}

function stats(t: EntryType, L: Entry[], body: Body, daily: DailyRow[]): [string, string | number][] {
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
        .forEach(([k, v]) => st.push([k, vez(v)]));
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
    case 'bano':
      return banoStats(L as Extract<Entry, { type: 'bano' }>[], daily);
    case 'peso':
      return pesoStats(L as Extract<Entry, { type: 'peso' }>[], body);
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
  const body = opts.body || {};
  const today = ds(now);
  const sections: ReportSection[] = [];
  let total = 0;
  for (const sec of SECTIONS) {
    if (!opts.types.includes(sec.key)) continue;
    const t = sec.type;
    const L = list.filter((e) => inSection(sec.key, e));
    if (!L.length) continue;
    total += L.length;
    const newest = L.slice().reverse();
    const daily = t === 'bano' ? dailyRows(L, today) : undefined;
    sections.push({
      key: sec.key,
      type: t,
      title: sec.title,
      icon: sec.icon,
      stats: stats(t, L, body, daily || []).map(([label, value]) => ({ label, value: String(value) })),
      rows: newest.map((e) => {
        const x = summary(e, body);
        const head = t === 'dolor' ? x.title.split(' · ')[1] : t === 'medicamento' ? x.title : '';
        return { when: `${shortDate(e.date)} · ${e.time}`, text: [x.badge, head, x.detail].filter(Boolean).join(' · ') };
      }),
      entries: newest,
      daily,
    });
  }
  return {
    name: opts.name,
    from,
    to,
    rangeLabel: from ? `${longDate(from)} – ${longDate(to)}` : 'Todo el historial',
    generated: today,
    total,
    body,
    sections,
  };
}

/** "2 Regular, 1 Mucho" */
export const amountsText = (d: DailyRow) =>
  AMOUNTS.filter((a) => d.amounts[a])
    .map((a) => `${d.amounts[a]} ${a}`)
    .join(', ');

/** Nota para las secciones cuyo promedio por día excluye el día en curso. */
export const PARTIAL_NOTE = '* El promedio por día no incluye el día en curso.';
export const hasPartialNote = (sec: ReportSection) => sec.stats.some((s) => s.label.endsWith('*'));

export function reportText(r: Report): string {
  let out = `Reporte de salud — ${r.name}\n${r.rangeLabel}\n`;
  for (const sec of r.sections) {
    out += `\n${sec.title.toUpperCase()}\n${sec.stats.map((s) => `${s.label}: ${s.value}`).join(' · ')}\n`;
    if (hasPartialNote(sec)) out += `${PARTIAL_NOTE}\n`;
    if (sec.daily) {
      out += 'Por día:\n';
      for (const d of sec.daily) out += `  ${shortDate(d.date)}${d.partial ? ' (en curso)' : ''}: ${vez(d.total)} — ${amountsText(d)}\n`;
      out += 'Detalle:\n';
    }
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
