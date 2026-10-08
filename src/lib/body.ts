// Cálculos corporales: IMC y % de grasa con la fórmula de la US Navy (Hodgdon y Beckett, 1984).
import type { PesoData, Profile, Sex } from '../../shared/model';

/** Datos del perfil que se usan en los cálculos. */
export interface Body {
  height?: number | null;
  sex?: Sex | null;
}

export const bodyOf = (p: Profile | undefined | null): Body => ({ height: p?.height ?? null, sex: p?.sex ?? null });

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Índice de masa corporal (kg/m²), o null sin estatura. */
export function bmi(weight: number, height?: number | null): number | null {
  if (!height || !weight) return null;
  return r1(weight / (height / 100) ** 2);
}

/** Clasificación de la OMS para adultos. */
export function bmiLabel(v: number): string {
  return v < 18.5 ? 'Bajo peso' : v < 25 ? 'Normal' : v < 30 ? 'Sobrepeso' : 'Obesidad';
}

/**
 * % de grasa corporal, fórmula US Navy en cm.
 * Hombres: cintura (a la altura del ombligo) y cuello. Mujeres: cintura (parte más estrecha), cadera y cuello.
 * Devuelve null si faltan datos o el resultado no es plausible.
 */
export function navyFat(m: Pick<PesoData, 'waist' | 'neck' | 'hip'>, body: Body): number | null {
  const { height, sex } = body;
  const { waist, neck, hip } = m;
  if (!height || !sex || !waist || !neck) return null;
  let v: number;
  if (sex === 'M') {
    if (waist - neck <= 0) return null;
    v = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450;
  } else {
    if (!hip || waist + hip - neck <= 0) return null;
    v = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(height)) - 450;
  }
  return v > 0 && v < 75 ? r1(v) : null;
}

/** Qué medidas faltan para calcular el % de grasa US Navy ('' si no falta nada). */
export function navyMissing(m: Pick<PesoData, 'waist' | 'neck' | 'hip'>, body: Body): string {
  if (!body.height || !body.sex) return 'Agrega tu estatura y sexo en Perfil para calcular IMC y % de grasa.';
  const need = [!m.waist && 'cintura', !m.neck && 'cuello', body.sex === 'F' && !m.hip && 'cadera'].filter(Boolean);
  return need.length ? `Para el % de grasa (US Navy) falta: ${need.join(', ')}.` : '';
}

/** Número con un decimal como máximo (72.5, 80). */
export const fmt1 = (n: number) => String(r1(n));
