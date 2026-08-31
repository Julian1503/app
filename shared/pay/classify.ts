/** Reparto de los turnos de una semana en las categorias con que se liquidan.
 *
 *  Reglas deducidas comparando el roster contra los 35 payslips. Las dos que no
 *  son obvias:
 *
 *  1. **La categoria la fija el dia en que el turno empieza**, no el dia de
 *     reloj de cada hora. Un turno del viernes 16:00 al sabado 09:00 se paga
 *     entero como viernes: las 3 h del sabado a la mañana salieron como
 *     `Ordinary Hours`, no como `Saturday Hours` (semana del 12 al 18 de marzo).
 *     Ojo: para la visa la imputacion es la contraria, por dia de reloj real,
 *     asi que las dos cuentas conviven y no hay que mezclarlas.
 *
 *  2. **La franja 22:00-06:00 no genera horas**: se paga como sleepover. Eso ya
 *     estaba verificado para la visa y vale igual para la plata.
 *
 *  De 34 semanas contrastadas, 26 dan exactas en todas las lineas. Las 8 que no
 *  cierran son diferencias reales entre roster y payslip, no fallas de la
 *  regla: turnos que faltan en Deputy o categorias mal liquidadas. */

import { addDays, roundHours, weekday } from '../dates.js';
import type { IsoDate, PayCategory, Shift } from '../types.js';
import { NIGHT_END_MINUTE, NIGHT_START_MINUTE, SLEEPOVER_MIN_NIGHT_HOURS } from '../visa/rules.js';
import { EVENING_START_MINUTE, MAX_CONTINUOUS_PAID_HOURS } from './rules.js';

const MINUTES_PER_DAY = 1440;

export interface WeekBreakdown {
  /** Horas por categoria, ya descontado lo que se fue a overtime. */
  readonly hours: Readonly<Record<PayCategory, number>>;
  /** Horas de overtime, separadas por la categoria sobre la que se calculan. */
  readonly overtime: ReadonlyArray<{ readonly base: PayCategory; readonly hours: number }>;
  readonly sleepovers: number;
  readonly brokenShiftDays: number;
  /** Km declarados en los comentarios de los turnos de la semana. */
  readonly kmDeclared: number;
  readonly sources: ReadonlySet<Shift['source']>;
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/** Horas pagables de un intervalo: todo menos la franja 22:00-06:00, separando
 *  las que caen despues de las 20:00 (recargo de tarde). */
export function payableHours(startMinute: number, endMinute: number): {
  ordinary: number;
  evening: number;
} {
  let ordinary = 0;
  let evening = 0;

  for (let day = 0; day * MINUTES_PER_DAY < endMinute; day += 1) {
    const offset = day * MINUTES_PER_DAY;
    const localStart = Math.max(startMinute - offset, 0);
    const localEnd = Math.min(endMinute - offset, MINUTES_PER_DAY);
    if (localEnd <= localStart) continue;

    const dayStart = Math.max(localStart, NIGHT_END_MINUTE);
    const dayEnd = Math.min(localEnd, NIGHT_START_MINUTE);
    if (dayEnd <= dayStart) continue;

    const eveningMinutes = overlap(dayStart, dayEnd, EVENING_START_MINUTE, NIGHT_START_MINUTE);
    evening += eveningMinutes / 60;
    ordinary += (dayEnd - dayStart - eveningMinutes) / 60;
  }

  return { ordinary, evening };
}

/** Noches de sleepover que cubre un turno, fechadas por el dia en que empieza
 *  la franja nocturna. Mismo criterio que usa el motor de la visa. */
export function sleepoverNightsOf(shift: Shift): IsoDate[] {
  const nights: IsoDate[] = [];
  const lastDay = Math.floor((shift.endMinute - 1) / MINUTES_PER_DAY);

  for (let day = -1; day <= lastDay; day += 1) {
    const bandStart = day * MINUTES_PER_DAY + NIGHT_START_MINUTE;
    const bandEnd = (day + 1) * MINUTES_PER_DAY + NIGHT_END_MINUTE;
    const covered = overlap(shift.startMinute, shift.endMinute, bandStart, bandEnd) / 60;
    if (covered >= SLEEPOVER_MIN_NIGHT_HOURS) nights.push(addDays(shift.date, day));
  }

  return nights;
}

/** Categoria base de un dia. `null` = dia habil, que ademas se parte entre
 *  ordinaria y tarde. */
function baseCategoryOf(date: IsoDate, holidays: ReadonlySet<IsoDate>): PayCategory | null {
  if (holidays.has(date)) return 'holiday';
  const day = weekday(date);
  if (day === 0) return 'sunday';
  if (day === 6) return 'saturday';
  return null;
}

interface Run {
  readonly start: number;
  readonly end: number;
}

/** Une los bloques de un dia que se tocan. Un 16:00-20:00 seguido de un
 *  20:00-06:00 es un solo tramo continuo, no un turno partido. */
function continuousRuns(shifts: readonly Shift[]): Run[] {
  const sorted = [...shifts].sort((a, b) => a.startMinute - b.startMinute);
  const runs: Run[] = [];
  let start = sorted[0]!.startMinute;
  let end = sorted[0]!.endMinute;

  for (const shift of sorted.slice(1)) {
    if (shift.startMinute > end) {
      runs.push({ start, end });
      start = shift.startMinute;
      end = shift.endMinute;
    } else {
      end = Math.max(end, shift.endMinute);
    }
  }
  runs.push({ start, end });

  return runs;
}

const EMPTY_HOURS: Record<PayCategory, number> = {
  ordinary: 0,
  evening: 0,
  saturday: 0,
  sunday: 0,
  holiday: 0,
  overtime: 0,
  night: 0,
};

/** Reparte los turnos que **empiezan** dentro de la semana de pago. */
export function breakdownWeek(
  shifts: readonly Shift[],
  from: IsoDate,
  to: IsoDate,
  holidays: ReadonlySet<IsoDate>,
): WeekBreakdown {
  const inWeek = shifts.filter((shift) => shift.date >= from && shift.date <= to);
  const hours: Record<PayCategory, number> = { ...EMPTY_HOURS };
  const overtime: Array<{ base: PayCategory; hours: number }> = [];
  const sources = new Set<Shift['source']>();
  const byDay = new Map<IsoDate, Shift[]>();

  let sleepovers = 0;
  let kmDeclared = 0;

  for (const shift of inWeek) {
    sources.add(shift.source);
    kmDeclared += shift.kmDeclared ?? 0;
    for (const night of sleepoverNightsOf(shift)) {
      if (night >= from && night <= to) sleepovers += 1;
    }
    byDay.set(shift.date, [...(byDay.get(shift.date) ?? []), shift]);
  }

  let brokenShiftDays = 0;

  for (const [date, dayShifts] of byDay) {
    const base = baseCategoryOf(date, holidays);
    const runs = continuousRuns(dayShifts);
    if (runs.length > 1) brokenShiftDays += 1;

    for (const run of runs) {
      const { ordinary, evening } = payableHours(run.start, run.end);
      const total = ordinary + evening;
      if (total <= 0) continue;

      // Pasadas las 10 h seguidas, el excedente se liquida como overtime sobre
      // la tarifa de la categoria del turno. Se descuenta de la ultima franja
      // que se trabaja, que es la de tarde.
      const excess = Math.max(0, total - MAX_CONTINUOUS_PAID_HOURS);
      if (excess > 0) overtime.push({ base: base ?? 'evening', hours: excess });

      const paid = total - excess;
      if (base) {
        hours[base] += paid;
      } else {
        const eveningPaid = Math.max(0, evening - excess);
        hours.evening += eveningPaid;
        hours.ordinary += paid - eveningPaid;
      }
    }
  }

  for (const key of Object.keys(hours) as PayCategory[]) hours[key] = roundHours(hours[key]);

  return {
    hours,
    overtime: overtime.map((entry) => ({ base: entry.base, hours: roundHours(entry.hours) })),
    sleepovers,
    brokenShiftDays,
    kmDeclared,
    sources,
  };
}
