/** Semanas de pago. El ciclo va de jueves a miercoles y se deposita el jueves
 *  siguiente, verificado en los 35 payslips: `Pay Period: 06/08/2026 -
 *  12/08/2026`, `Payment Date: 13/08/2026`. */

import { addDays, weekday } from '../dates.js';
import type { IsoDate } from '../types.js';
import { PAYMENT_LAG_DAYS, PAY_WEEK_START_WEEKDAY } from './rules.js';

export interface PayWeek {
  /** Jueves en que arranca el periodo. */
  readonly start: IsoDate;
  /** Miercoles en que cierra. */
  readonly end: IsoDate;
  /** Jueves en que se deposita. */
  readonly paymentDate: IsoDate;
}

/** Retrocede hasta el jueves de esa semana de pago (o se queda si ya es jueves). */
export function startOfPayWeek(iso: IsoDate): IsoDate {
  const back = (weekday(iso) - PAY_WEEK_START_WEEKDAY + 7) % 7;
  return addDays(iso, -back);
}

export function payWeekOf(iso: IsoDate): PayWeek {
  const start = startOfPayWeek(iso);
  const end = addDays(start, 6);
  return { start, end, paymentDate: addDays(end, PAYMENT_LAG_DAYS) };
}

/** Semanas de pago que tocan el rango, de la mas vieja a la mas nueva. */
export function payWeeksBetween(from: IsoDate, to: IsoDate): PayWeek[] {
  const weeks: PayWeek[] = [];
  for (let cursor = startOfPayWeek(from); cursor <= to; cursor = addDays(cursor, 7)) {
    weeks.push(payWeekOf(cursor));
  }
  return weeks;
}

/** Año fiscal australiano de una fecha: del 1 de julio al 30 de junio. */
export function financialYearOf(iso: IsoDate): string {
  const year = Number.parseInt(iso.slice(0, 4), 10);
  const month = Number.parseInt(iso.slice(5, 7), 10);
  const start = month >= 7 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}
