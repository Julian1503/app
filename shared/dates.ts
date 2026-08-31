/** Utilidades de fecha. Todo se maneja en UTC puro sobre strings YYYY-MM-DD
 *  para evitar que el huso horario del navegador corra los dias.
 *  Queensland no tiene horario de verano, asi que no hace falta nada mas. */

import type { IsoDate } from './types.js';

const MS_PER_DAY = 86_400_000;

export function toDate(iso: IsoDate): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return toIso(new Date(toDate(iso).getTime() + days * MS_PER_DAY));
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / MS_PER_DAY);
}

/** 0 = domingo, 1 = lunes ... 6 = sabado. */
export function weekday(iso: IsoDate): number {
  return toDate(iso).getUTCDay();
}

/** Retrocede hasta el lunes de esa semana (o se queda si ya es lunes). */
export function startOfWeek(iso: IsoDate): IsoDate {
  const day = weekday(iso);
  const back = day === 0 ? 6 : day - 1;
  return addDays(iso, -back);
}

export function rangeDays(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) out.push(cursor);
  return out;
}

/* El formateo de fechas con nombre de dia y de mes vive en `i18n/`, porque
   depende del idioma. Aca solo queda la aritmetica, que no. */

/** Convierte minutos desde medianoche a HH:MM, tolerando valores > 1440. */
export function formatMinute(minute: number): string {
  const normalised = ((minute % 1440) + 1440) % 1440;
  const hours = Math.floor(normalised / 60);
  const mins = normalised % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}
