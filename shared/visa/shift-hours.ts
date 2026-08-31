/** Conversion de turnos a horas computables por dia de reloj.
 *
 *  Regla verificada contra los payslips: las horas computables de un turno son
 *  su duracion menos el solapamiento con la franja 22:00-06:00, y se imputan al
 *  dia de reloj real en que ocurren.
 *
 *  Ejemplos:
 *    20:00-06:00  ->  2 h el dia uno, 0 h el dia dos
 *    20:00-08:00  ->  2 h el dia uno, 2 h el dia dos
 *    06:00-09:00  ->  3 h el mismo dia
 */

import { addDays, roundHours } from '../dates.js';
import type { DailyHours, IsoDate, Shift } from '../types.js';
import {
  NIGHT_END_MINUTE,
  NIGHT_START_MINUTE,
  SLEEPOVER_MIN_NIGHT_HOURS,
} from './rules.js';

const MINUTES_PER_DAY = 1440;

interface DayPortion {
  readonly date: IsoDate;
  readonly countable: number;
  readonly gross: number;
  readonly nightHours: number;
}

/** Minutos de solapamiento entre dos intervalos [aStart, aEnd) y [bStart, bEnd). */
function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/** Minutos de un tramo dentro de un mismo dia que caen en la franja nocturna.
 *  La franja se parte en dos: 00:00-06:00 y 22:00-24:00. */
function nightMinutesWithinDay(startMinute: number, endMinute: number): number {
  return (
    overlapMinutes(startMinute, endMinute, 0, NIGHT_END_MINUTE) +
    overlapMinutes(startMinute, endMinute, NIGHT_START_MINUTE, MINUTES_PER_DAY)
  );
}

/** Reparte un turno en los dias de reloj que toca. */
export function splitShiftByDay(shift: Shift): DayPortion[] {
  const portions: DayPortion[] = [];
  const totalMinutes = shift.endMinute - shift.startMinute;
  if (totalMinutes <= 0) return portions;

  let cursor = shift.startMinute;
  let dayIndex = 0;

  while (cursor < shift.endMinute) {
    const dayStart = dayIndex * MINUTES_PER_DAY;
    const dayEnd = dayStart + MINUTES_PER_DAY;
    const chunkStart = Math.max(cursor, dayStart);
    const chunkEnd = Math.min(shift.endMinute, dayEnd);

    if (chunkEnd > chunkStart) {
      const localStart = chunkStart - dayStart;
      const localEnd = chunkEnd - dayStart;
      const grossMinutes = chunkEnd - chunkStart;
      const nightMinutes = nightMinutesWithinDay(localStart, localEnd);
      portions.push({
        date: addDays(shift.date, dayIndex),
        countable: (grossMinutes - nightMinutes) / 60,
        gross: grossMinutes / 60,
        nightHours: nightMinutes / 60,
      });
    }

    cursor = dayEnd;
    dayIndex += 1;
  }

  return portions;
}

/** Noches de sleepover que cubre un turno, fechadas por el dia en que *empieza*
 *  la franja nocturna.
 *
 *  Se evalua contra la franja completa 22:00-06:00, que cruza la medianoche. Si
 *  se midiera dia por dia, un turno 20:00-06:00 acumularia 2 h de noche el
 *  primer dia y 6 h el segundo, y el sleepover terminaria fechado el dia
 *  equivocado, corriendolo de quincena. */
export function sleepoverNights(shift: Shift): IsoDate[] {
  const nights: IsoDate[] = [];
  const lastDayIndex = Math.floor((shift.endMinute - 1) / MINUTES_PER_DAY);

  for (let dayIndex = -1; dayIndex <= lastDayIndex; dayIndex += 1) {
    const bandStart = dayIndex * MINUTES_PER_DAY + NIGHT_START_MINUTE;
    const bandEnd = (dayIndex + 1) * MINUTES_PER_DAY + NIGHT_END_MINUTE;
    const covered = overlapMinutes(shift.startMinute, shift.endMinute, bandStart, bandEnd) / 60;
    if (covered >= SLEEPOVER_MIN_NIGHT_HOURS) nights.push(addDays(shift.date, dayIndex));
  }

  return nights;
}

/** Agrega una lista de turnos en horas por dia de reloj.
 *  Los turnos duplicados por id se ignoran: el roster publicado y el timesheet
 *  del mismo dia describen el mismo trabajo. */
export function aggregateDaily(shifts: readonly Shift[]): DailyHours[] {
  interface Entry {
    countable: number;
    gross: number;
    sleepovers: number;
    shiftIds: Set<string>;
  }

  const byDate = new Map<IsoDate, Entry>();
  const entryFor = (date: IsoDate): Entry => {
    const existing = byDate.get(date);
    if (existing) return existing;
    const created: Entry = { countable: 0, gross: 0, sleepovers: 0, shiftIds: new Set<string>() };
    byDate.set(date, created);
    return created;
  };

  for (const shift of shifts) {
    for (const portion of splitShiftByDay(shift)) {
      const entry = entryFor(portion.date);
      entry.countable += portion.countable;
      entry.gross += portion.gross;
      entry.shiftIds.add(shift.id);
    }
    for (const night of sleepoverNights(shift)) {
      entryFor(night).sleepovers += 1;
    }
  }

  return [...byDate.entries()]
    .map(([date, entry]) => ({
      date,
      countable: roundHours(entry.countable),
      gross: roundHours(entry.gross),
      sleepovers: entry.sleepovers,
      shiftIds: [...entry.shiftIds],
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Horas computables que aporta un turno completo, sumando todos sus dias. */
export function countableHoursOf(shift: Shift): number {
  return roundHours(
    splitShiftByDay(shift).reduce((sum, portion) => sum + portion.countable, 0),
  );
}
