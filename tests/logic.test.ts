import { describe, expect, it } from 'vitest';
import { sanitizeEntry, type Entry } from '../shared/model';
import { hashPassword, tempPassword, verifyPassword } from '../functions/lib/crypto';
import { blankForm, entryFromForm, formFromEntry, validateForm } from '../src/lib/form';
import { computeReport, reportFileBase, reportText } from '../src/lib/report';
import { relTime, summary } from '../src/lib/format';

const NOW = new Date('2026-10-03T09:30:00');
let n = 0;
const mk = (e: Partial<Entry> & Pick<Entry, 'type' | 'date' | 'time'>): Entry => ({ id: `t${++n}`, updatedAt: 1, ...e }) as Entry;

const sample: Entry[] = [
  mk({ type: 'presion', date: '2026-10-03', time: '07:10', sys: 120, dia: 80, pulse: 70, obs: 'Al despertar' }),
  mk({ type: 'presion', date: '2026-10-02', time: '07:10', sys: 134, dia: 86 }),
  mk({ type: 'presion', date: '2026-09-01', time: '07:10', sys: 110, dia: 70 }), // fuera de 30 días
  mk({ type: 'lpm', date: '2026-10-03', time: '13:30', value: 74 }),
  mk({ type: 'lpm', date: '2026-10-01', time: '13:30', value: 96 }),
  mk({ type: 'dolor', date: '2026-10-02', time: '17:45', zone: 'Cabeza', constant: false, duration: 30, intensity: 6 }),
  mk({ type: 'dolor', date: '2026-10-01', time: '17:45', zone: 'Otro', zoneOther: 'Rodilla', constant: true, duration: null, intensity: 3 }),
  mk({ type: 'dolor', date: '2026-09-30', time: '17:45', zone: 'Cabeza', constant: false, duration: 20, intensity: 8 }),
  mk({ type: 'mareo', date: '2026-10-02', time: '11:20', duration: 6, intensity: 3 }),
  mk({ type: 'medicamento', date: '2026-10-03', time: '08:00', med: 'Losartán', dose: '50 mg' }),
  mk({ type: 'medicamento', date: '2026-10-02', time: '08:00', med: 'Losartán', dose: '50 mg' }),
  mk({ type: 'medicamento', date: '2026-10-02', time: '18:05', med: 'Paracetamol', dose: '500 mg', symptom: 'Dolor' }),
  mk({ type: 'bano', date: '2026-10-03', time: '07:40', kind: 'pipi', amount: 'Regular' }),
  mk({ type: 'bano', date: '2026-10-02', time: '10:05', kind: 'popo', amount: 'Poco' }),
  mk({ type: 'lpm', date: '2026-10-03', time: '09:00', value: 200, deleted: 1 }), // borrado: se ignora
];

describe('computeReport', () => {
  const r = computeReport(sample, { range: '30', types: ['dolor', 'mareo', 'lpm', 'presion', 'medicamento', 'bano'], name: 'Julián' }, NOW);
  const stat = (type: string, label: string) => r.sections.find((s) => s.type === type)!.stats.find((s) => s.label === label)?.value;

  it('filtra por periodo e ignora borrados', () => {
    expect(r.from).toBe('2026-09-04');
    expect(r.to).toBe('2026-10-03');
    expect(r.total).toBe(13);
  });

  it('estadísticas de presión', () => {
    expect(stat('presion', 'Tomas')).toBe('2');
    expect(stat('presion', 'Promedio')).toBe('127/83');
    expect(stat('presion', 'Más alta')).toBe('134/86');
    expect(stat('presion', 'Más baja')).toBe('120/80');
    expect(stat('presion', 'Pulso prom.')).toBe('70 lpm');
  });

  it('estadísticas de pulso, dolor, mareo, medicamento y baño', () => {
    expect(stat('lpm', 'Promedio')).toBe('85 lpm');
    expect(stat('lpm', 'Mínimo')).toBe('74 lpm');
    expect(stat('lpm', 'Máximo')).toBe('96 lpm');
    expect(stat('dolor', 'Intensidad prom.')).toBe('5.7/10');
    expect(stat('dolor', 'Constantes')).toBe('1');
    expect(stat('dolor', 'Cabeza')).toBe('2 veces');
    expect(stat('dolor', 'Rodilla')).toBe('1 vez');
    expect(stat('mareo', 'Duración prom.')).toBe('6 min');
    expect(stat('medicamento', 'Losartán')).toBe('2 tomas');
    expect(stat('medicamento', 'Paracetamol')).toBe('1 toma');
    expect(stat('bano', 'Pipí')).toBe('1');
    expect(stat('bano', 'Popó')).toBe('1');
  });

  it('filas del más reciente al más antiguo', () => {
    const rows = r.sections.find((s) => s.type === 'presion')!.rows;
    expect(rows[0].text).toBe('120/80 · 70 lpm · Al despertar');
    expect(rows[1].text).toBe('134/86 · Sin observaciones');
  });

  it('respeta los tipos incluidos y el rango "Todo"', () => {
    const only = computeReport(sample, { range: 'all', types: ['presion'], name: 'X' }, NOW);
    expect(only.sections.map((s) => s.type)).toEqual(['presion']);
    expect(only.total).toBe(3);
    expect(only.rangeLabel).toBe('Todo el historial');
  });

  it('texto y nombre de archivo', () => {
    expect(reportText(r)).toContain('PRESIÓN ARTERIAL');
    expect(reportFileBase(r)).toBe('VitaLogs_Julian_2026-09-04_2026-10-03');
  });
});

describe('formulario', () => {
  it('valida con los mensajes del diseño', () => {
    expect(validateForm(blankForm('dolor', NOW))).toBe('Selecciona la zona del dolor.');
    expect(validateForm({ ...blankForm('dolor', NOW), zone: 'Otro' })).toBe('Especifica la zona.');
    expect(validateForm(blankForm('lpm', NOW))).toBe('Ingresa el resultado.');
    expect(validateForm({ ...blankForm('presion', NOW), sys: '120' })).toBe('Ingresa sistólica y diastólica.');
    expect(validateForm(blankForm('medicamento', NOW))).toBe('Selecciona un medicamento.');
    expect(validateForm(blankForm('bano', NOW))).toBe('Selecciona pipí o popó.');
    expect(validateForm({ ...blankForm('mareo', NOW), time: '' })).toBe('Indica fecha y hora.');
    expect(validateForm(blankForm('mareo', NOW))).toBe('');
  });

  it('convierte a registro válido y de vuelta', () => {
    const f = { ...blankForm('dolor', NOW), zone: 'Cuello', constant: true, duration: '15', intensity: 7 };
    const e = entryFromForm(f, 'abc', 5);
    expect(e).toMatchObject({ type: 'dolor', zone: 'Cuello', constant: true, duration: null, intensity: 7, date: '2026-10-03', time: '09:30' });
    expect(sanitizeEntry(e)).not.toBeNull();
    expect(formFromEntry(e).zone).toBe('Cuello');
    expect(summary(e).detail).toBe('Constante · Fuerte');
  });
});

describe('sanitizeEntry', () => {
  it('rechaza datos inválidos o tipos desconocidos', () => {
    expect(sanitizeEntry({ id: 'a', type: 'lpm', date: '2026-10-03', time: '09:00', updatedAt: 1, value: 'x' })).toBeNull();
    expect(sanitizeEntry({ id: 'a', type: 'hack', date: '2026-10-03', time: '09:00', updatedAt: 1 })).toBeNull();
    expect(sanitizeEntry({ id: 'a', type: 'presion', date: '03/10/2026', time: '09:00', updatedAt: 1, sys: 1, dia: 1 })).toBeNull();
  });
  it('descarta campos que no pertenecen al tipo', () => {
    const e = sanitizeEntry({ id: 'a', type: 'lpm', date: '2026-10-03', time: '09:00', updatedAt: 1, value: 70, evil: '<script>' });
    expect(e && 'evil' in e).toBe(false);
  });
});

describe('formato', () => {
  it('tiempo relativo', () => {
    expect(relTime(mk({ type: 'lpm', date: '2026-10-03', time: '09:10', value: 70 }), NOW)).toBe('Hace 20 min');
    expect(relTime(undefined, NOW)).toBe('Sin registros');
  });
});

describe('contraseñas', () => {
  it('hash PBKDF2 y verificación', async () => {
    const h = await hashPassword('secreta-123', 1000);
    expect(h.startsWith('pbkdf2$1000$')).toBe(true);
    expect(await verifyPassword('secreta-123', h)).toBe(true);
    expect(await verifyPassword('otra', h)).toBe(false);
  });
  it('contraseña temporal legible', () => {
    expect(tempPassword()).toMatch(/^[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}$/);
  });
});
