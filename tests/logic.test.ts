import { describe, expect, it } from 'vitest';
import { sanitizeEntry, sanitizeMed, sanitizeProfile, type Entry } from '../shared/model';
import { bmi, bmiLabel, navyFat, navyMissing } from '../src/lib/body';
import { COLUMNS, columnsFor } from '../src/lib/export/columns';
import { hashPassword, tempPassword, verifyPassword } from '../functions/lib/crypto';
import { blankForm, entryFromForm, formFromEntry, validateForm } from '../src/lib/form';
import { computeReport, reportFileBase, reportText, SECTION_KEYS } from '../src/lib/report';
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
  const r = computeReport(sample, { range: '30', types: ['dolor', 'mareo', 'lpm', 'presion', 'medicamento', 'pipi', 'popo'], name: 'Julián' }, NOW);
  const stat = (key: string, label: string) => r.sections.find((s) => s.key === key)!.stats.find((s) => s.label === label)?.value;

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
    expect(stat('pipi', 'Veces')).toBe('1');
    expect(stat('popo', 'Veces')).toBe('1');
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
    expect(validateForm({ ...blankForm('dolor', NOW), zone: 'Otro' })).toBe('Especifica la zona en Observaciones.');
    expect(validateForm({ ...blankForm('dolor', NOW), zone: 'Otro', obs: 'Rodilla' })).toBe('');
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

describe('campos nuevos', () => {
  it('dolor: observaciones en cualquier zona', () => {
    const e = entryFromForm({ ...blankForm('dolor', NOW), zone: 'Espalda', obs: 'Espalda baja, punzante', duration: '10' }, 'd1', 1);
    expect(sanitizeEntry(e)).not.toBeNull();
    expect(summary(e)).toMatchObject({ title: 'Dolor · Espalda', detail: 'Espalda baja, punzante · 10 min · Moderado' });
    expect(COLUMNS.dolor.find((c) => c.header === 'Observaciones')!.value(e, {})).toBe('Espalda baja, punzante');
  });
  it('dolor "Otro": las observaciones son la zona', () => {
    const e = entryFromForm({ ...blankForm('dolor', NOW), zone: 'Otro', obs: 'Rodilla derecha' }, 'd2', 1);
    expect(summary(e).title).toBe('Dolor · Rodilla derecha');
    expect(summary(e).detail).toBe('Duración no indicada · Moderado');
  });
  it('dolor heredado con zoneOther se edita como observaciones', () => {
    const old = mk({ type: 'dolor', date: '2026-10-01', time: '10:00', zone: 'Otro', zoneOther: 'Rodilla', constant: false, intensity: 4 });
    expect(summary(old).title).toBe('Dolor · Rodilla');
    const f = formFromEntry(old);
    expect(f.obs).toBe('Rodilla');
    const saved = entryFromForm(f, old.id, 2);
    expect(summary(saved).title).toBe('Dolor · Rodilla');
  });
  it('medicamento: para qué es', () => {
    const e = entryFromForm({ ...blankForm('medicamento', NOW), med: 'Losartán', dose: '50 mg', purpose: 'Control de hipertensión' }, 'm1', 1);
    expect(sanitizeEntry(e)).toMatchObject({ purpose: 'Control de hipertensión' });
    expect(summary(e).detail).toBe('50 mg · Control de hipertensión');
    expect(formFromEntry(e).purpose).toBe('Control de hipertensión');
    expect(sanitizeMed({ id: 'x', name: 'Losartán', dose: '50 mg', purpose: 'Hipertensión', updatedAt: 1 })?.purpose).toBe('Hipertensión');
  });
});

describe('baño: pipí y popó por separado', () => {
  const b = (date: string, time: string, kind: 'pipi' | 'popo', amount: 'Muy poco' | 'Poco' | 'Regular' | 'Mucho') => mk({ type: 'bano', date, time, kind, amount });
  const L = [
    b('2026-10-01', '07:00', 'pipi', 'Mucho'),
    b('2026-10-01', '12:00', 'pipi', 'Regular'),
    b('2026-10-01', '23:30', 'pipi', 'Poco'),
    b('2026-10-02', '03:10', 'pipi', 'Poco'),
    b('2026-10-02', '09:00', 'pipi', 'Regular'),
    b('2026-10-02', '10:00', 'popo', 'Regular'),
    b('2026-10-03', '08:00', 'pipi', 'Regular'), // día en curso
  ];

  it('solo pipí: sin popó en el reporte', () => {
    const r = computeReport(L, { range: '7', types: ['pipi'], name: 'X' }, NOW);
    expect(r.sections.map((s) => s.key)).toEqual(['pipi']);
    expect(r.total).toBe(6);
    expect(reportText(r)).not.toContain('Popó');
  });

  it('estadísticas y conteo por día (sin el día en curso en los promedios)', () => {
    const sec = computeReport(L, { range: '7', types: ['pipi', 'popo'], name: 'X' }, NOW).sections[0];
    const st = Object.fromEntries(sec.stats.map((s) => [s.label, s.value]));
    expect(st['Veces']).toBe('6');
    expect(st['Días con registro']).toBe('3');
    expect(st['Promedio por día*']).toBe('2.5');
    expect(st['Máximo en un día']).toBe('3');
    expect(st['Mínimo en un día']).toBe('2');
    expect(st['Nocturnas (22–6 h)']).toBe('2');
    expect(st['Poco']).toBe('2 veces');
    expect(sec.daily!.map((d) => [d.date, d.total, d.partial])).toEqual([
      ['2026-10-03', 1, true],
      ['2026-10-02', 2, false],
      ['2026-10-01', 3, false],
    ]);
    expect(sec.daily![2].amounts).toEqual({ 'Muy poco': 0, Poco: 1, Regular: 1, Mucho: 1 });
  });

  it('todas las secciones están disponibles por defecto', () => {
    expect(SECTION_KEYS).toEqual(['dolor', 'mareo', 'lpm', 'presion', 'medicamento', 'pipi', 'popo', 'peso']);
  });
});

describe('peso, IMC y % de grasa', () => {
  it('IMC con clasificación', () => {
    expect(bmi(80, 178)).toBe(25.2);
    expect(bmiLabel(25.2)).toBe('Sobrepeso');
    expect(bmi(80, null)).toBeNull();
  });

  it('fórmula US Navy', () => {
    expect(navyFat({ waist: 90, neck: 38 }, { height: 178, sex: 'M' })).toBeCloseTo(20.2, 0);
    expect(navyFat({ waist: 75, neck: 33, hip: 100 }, { height: 165, sex: 'F' })).toBeCloseTo(29.4, 0);
    expect(navyFat({ waist: 75, neck: 33 }, { height: 165, sex: 'F' })).toBeNull(); // falta cadera
    expect(navyFat({ waist: 90, neck: 38 }, { height: 178 })).toBeNull(); // falta sexo
    expect(navyMissing({ waist: 90 }, { height: 178, sex: 'M' })).toContain('cuello');
  });

  it('formulario: valida, acepta coma decimal y vuelve a editarse', () => {
    expect(validateForm(blankForm('peso', NOW))).toBe('Ingresa tu peso en kg.');
    expect(validateForm({ ...blankForm('peso', NOW), weight: '80', waist: '5' })).toBe('Revisa la medida de cintura (cm).');
    const e = entryFromForm({ ...blankForm('peso', NOW), weight: '80,45', waist: '90', neck: '38' }, 'p1', 1);
    expect(e).toMatchObject({ type: 'peso', weight: 80.5, waist: 90, neck: 38, hip: null, fat: null });
    expect(sanitizeEntry(e)).not.toBeNull();
    expect(formFromEntry(e).weight).toBe('80.5');
    expect(summary(e, { height: 178, sex: 'M' })).toMatchObject({ badge: '80.5 kg', detail: 'IMC 25.4 · Grasa 20.1 % · Cintura 90 cm' });
  });

  it('reporte: cambio de peso, IMC y columnas sin medidas vacías', () => {
    const P = [
      mk({ type: 'peso', date: '2026-09-28', time: '07:00', weight: 82, waist: 92, neck: 38 }),
      mk({ type: 'peso', date: '2026-10-03', time: '07:00', weight: 80.5, fat: 22 }),
    ];
    const body = { height: 178, sex: 'M' as const };
    const sec = computeReport(P, { range: '30', types: ['peso'], name: 'X', body }, NOW).sections[0];
    const st = Object.fromEntries(sec.stats.map((s) => [s.label, s.value]));
    expect(st['Último peso']).toBe('80.5 kg');
    expect(st['Cambio en el periodo']).toBe('−1.5 kg');
    expect(st['IMC actual']).toBe('25.4 · Sobrepeso');
    expect(st['% grasa (báscula)']).toBe('22 %');
    expect(st['% grasa (US Navy)']).toMatch(/^2\d\.\d %$/);
    expect(columnsFor('peso', sec.entries, body).map((c) => c.header)).not.toContain('Cadera (cm)');
  });

  it('perfil: datos corporales opcionales', () => {
    expect(sanitizeProfile({ reportName: 'X', updatedAt: 1 })).toEqual({ reportName: 'X', updatedAt: 1 });
    expect(sanitizeProfile({ reportName: 'X', updatedAt: 1, height: 178, sex: 'M' })).toMatchObject({ height: 178, sex: 'M' });
    expect(sanitizeProfile({ reportName: 'X', updatedAt: 1, height: 10 })).toBeNull();
    expect(sanitizeProfile({ reportName: 'X', updatedAt: 1, sex: 'X' })).toBeNull();
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
