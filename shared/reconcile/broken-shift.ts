/** Control del Broken Shift Allowance.
 *
 *  La clausula 25.6 del SCHADS exige que el lapso entre el inicio del primer
 *  bloque y el fin del ultimo no supere las 12 h para que el dia sea un turno
 *  partido. La forma habitual del roster (bloque a las 06:00 + bloque a las
 *  16:00/20:00) da lapsos de 14-16 h: son turnos separados, no partidos.
 *
 *  El empleador igual paga el allowance en cualquier dia con dos bloques. Eso
 *  abre dos lecturas y conviene tener ambas a la vista:
 *    - Si NO son turnos partidos, el allowance esta pago de mas (a favor tuyo).
 *    - Si el empleador sostiene que SI lo son, entonces incumple el tope de 12 h
 *      y corresponde double time por las horas posteriores a la hora 12. */

import { roundHours } from '../dates.js';
import type { I18n } from '../i18n/index.js';
import type { Finding, Shift } from '../types.js';
import { BROKEN_SHIFT_MAX_SPAN_HOURS } from '../visa/rules.js';

export interface SpanDay {
  readonly date: string;
  readonly blocks: number;
  readonly spanHours: number;
  readonly exceedsSpan: boolean;
  readonly hoursBeyondSpan: number;
}

/** Dias con mas de un bloque de trabajo, con su lapso total. */
export function analyseSpans(shifts: readonly Shift[]): SpanDay[] {
  const byDate = new Map<string, Shift[]>();
  for (const shift of shifts) {
    byDate.set(shift.date, [...(byDate.get(shift.date) ?? []), shift]);
  }

  const out: SpanDay[] = [];
  for (const [date, dayShifts] of byDate) {
    if (dayShifts.length < 2) continue;
    const first = Math.min(...dayShifts.map((shift) => shift.startMinute));
    const last = Math.max(...dayShifts.map((shift) => shift.endMinute));
    const spanHours = roundHours((last - first) / 60);
    out.push({
      date,
      blocks: dayShifts.length,
      spanHours,
      exceedsSpan: spanHours > BROKEN_SHIFT_MAX_SPAN_HOURS,
      hoursBeyondSpan: roundHours(Math.max(0, spanHours - BROKEN_SHIFT_MAX_SPAN_HOURS)),
    });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function checkBrokenShifts(shifts: readonly Shift[], i18n: I18n): Finding[] {
  const exceeding = analyseSpans(shifts).filter((day) => day.exceedsSpan);
  if (exceeding.length === 0) return [];

  const worst = exceeding.reduce((a, b) => (b.spanHours > a.spanHours ? b : a));

  return [
    {
      id: 'broken-shift:span',
      severity: 'medium',
      category: 'pay',
      title: i18n.t('f.brokenShift.title', {
        count: exceeding.length,
        maxSpan: BROKEN_SHIFT_MAX_SPAN_HOURS,
      }),
      detail: i18n.t('f.brokenShift.detail', {
        date: i18n.date(worst.date),
        span: worst.spanHours,
      }),
      amount: null,
      date: worst.date,
    },
  ];
}
