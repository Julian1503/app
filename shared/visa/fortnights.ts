/** Ventanas quincenales de la condicion 8105.
 *
 *  Home Affairs no mira quincenas fijas de calendario: mira *cualquier* periodo
 *  de 14 dias que empiece un lunes. Por eso se generan ventanas deslizantes con
 *  paso semanal, de modo que cada lunes del historial abre su propia quincena.
 *  Basta con que una sola de esas ventanas supere las 48 h para estar en falta.
 *
 *  Durante los term breaks del curso no hay tope, asi que esos dias se descuentan
 *  del conteo "en sesion", que es el que realmente importa. */

import { addDays, roundHours, startOfWeek } from '../dates.js';
import type { DailyHours, Fortnight, IsoDate } from '../types.js';
import { NIGHT_BAND_HOURS, WARNING_RATIO } from './rules.js';

export interface TermBreak {
  readonly start: IsoDate;
  readonly end: IsoDate;
  readonly label?: string;
}

const FORTNIGHT_DAYS = 14;
const WINDOW_STEP_DAYS = 7;

export function isInTermBreak(date: IsoDate, breaks: readonly TermBreak[]): boolean {
  return breaks.some((term) => date >= term.start && date <= term.end);
}

function classify(inSession: number, limit: number): Fortnight['status'] {
  if (inSession > limit) return 'over';
  if (inSession >= limit * WARNING_RATIO) return 'warning';
  return 'ok';
}

/**
 * Construye todas las ventanas de 14 dias que empiezan un lunes y tocan datos.
 * `until` permite proyectar mas alla del ultimo dia con horas cargadas.
 */
export function buildFortnights(
  daily: readonly DailyHours[],
  breaks: readonly TermBreak[],
  limit: number,
  until?: IsoDate,
): Fortnight[] {
  if (daily.length === 0) return [];

  const hoursByDate = new Map(daily.map((day) => [day.date, day]));
  const firstDate = daily[0]!.date;
  const lastDate = until && until > daily[daily.length - 1]!.date
    ? until
    : daily[daily.length - 1]!.date;

  const windows: Fortnight[] = [];
  let windowStart = startOfWeek(firstDate);

  while (windowStart <= lastDate) {
    const windowEnd = addDays(windowStart, FORTNIGHT_DAYS - 1);
    let total = 0;
    let inSession = 0;
    let conservative = 0;
    let breakDays = 0;

    for (let offset = 0; offset < FORTNIGHT_DAYS; offset += 1) {
      const date = addDays(windowStart, offset);
      const day = hoursByDate.get(date);
      const countable = day?.countable ?? 0;
      total += countable;

      if (isInTermBreak(date, breaks)) {
        breakDays += 1;
        continue;
      }
      inSession += countable;
      conservative += countable + (day?.sleepovers ?? 0) * NIGHT_BAND_HOURS;
    }

    windows.push({
      start: windowStart,
      end: windowEnd,
      total: roundHours(total),
      inSession: roundHours(inSession),
      conservative: roundHours(conservative),
      breakDays,
      overBy: roundHours(Math.max(0, inSession - limit)),
      status: classify(inSession, limit),
    });

    windowStart = addDays(windowStart, WINDOW_STEP_DAYS);
  }

  return windows;
}

/** Quincena vigente: la ventana abierta mas reciente que contiene a `today`. */
export function currentFortnight(
  fortnights: readonly Fortnight[],
  today: IsoDate,
): Fortnight | null {
  const containing = fortnights.filter((f) => f.start <= today && today <= f.end);
  if (containing.length === 0) return null;
  // La mas restrictiva de las que estan abiertas hoy.
  return containing.reduce((worst, f) => (f.inSession > worst.inSession ? f : worst));
}

/** Ventanas que todavia no cerraron: sobre estas se puede negociar el roster. */
export function upcomingFortnights(
  fortnights: readonly Fortnight[],
  today: IsoDate,
): Fortnight[] {
  return fortnights.filter((f) => f.end >= today);
}
