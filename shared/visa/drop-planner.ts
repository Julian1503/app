/** Sugeridor de recorte: que turnos concretos conviene pedir que saquen del roster
 *  para volver por debajo del limite, tocando la menor cantidad de turnos posible.
 *
 *  Solo propone turnos de hoy en adelante: el pasado ya esta trabajado y no se
 *  puede deshacer, negociar sobre eso no sirve de nada.
 *
 *  Estrategia voraz: en cada vuelta elige el turno que resuelve mas quincenas
 *  excedidas y, a igualdad, el que libera mas horas. Recalcula despues de cada
 *  eleccion porque sacar un turno mueve todas las ventanas que lo contienen. */

import { formatMinute } from '../dates.js';
import type { DropSuggestion, Fortnight, Shift } from '../types.js';
import type { TermBreak } from './fortnights.js';
import { buildFortnights } from './fortnights.js';
import { aggregateDaily, countableHoursOf } from './shift-hours.js';

const MAX_SUGGESTIONS = 12;

function overFortnights(fortnights: readonly Fortnight[], today: string): Fortnight[] {
  return fortnights.filter((f) => f.status === 'over' && f.end >= today);
}

function shiftTouches(shift: Shift, fortnight: Fortnight): boolean {
  return shift.date >= fortnight.start && shift.date <= fortnight.end;
}

function timeOf(shift: Shift): string {
  return `${formatMinute(shift.startMinute)}-${formatMinute(shift.endMinute)}`;
}

/**
 * Devuelve la lista minima de turnos a soltar para que ninguna quincena futura
 * supere el limite. Si aun soltando todo lo futuro queda alguna excedida, la
 * lista incluye lo que si se puede arreglar y el excedente remanente queda
 * visible en el reporte.
 */
export function planDrops(
  shifts: readonly Shift[],
  breaks: readonly TermBreak[],
  limit: number,
  today: string,
): DropSuggestion[] {
  const suggestions: DropSuggestion[] = [];
  let remaining = [...shifts];

  for (let round = 0; round < MAX_SUGGESTIONS; round += 1) {
    const fortnights = buildFortnights(aggregateDaily(remaining), breaks, limit);
    const problems = overFortnights(fortnights, today);
    if (problems.length === 0) break;

    const candidates = remaining.filter(
      (shift) => shift.date >= today && problems.some((f) => shiftTouches(shift, f)),
    );
    if (candidates.length === 0) break;

    const best = candidates.reduce((champion, shift) => {
      const score = (candidate: Shift) => {
        const fixes = problems.filter((f) => shiftTouches(candidate, f)).length;
        return fixes * 1000 + countableHoursOf(candidate);
      };
      return score(shift) > score(champion) ? shift : champion;
    });

    const hoursFreed = countableHoursOf(best);
    if (hoursFreed <= 0) {
      remaining = remaining.filter((shift) => shift.id !== best.id);
      continue;
    }

    remaining = remaining.filter((shift) => shift.id !== best.id);
    const after = buildFortnights(aggregateDaily(remaining), breaks, limit);
    const stillOver = new Set(overFortnights(after, today).map((f) => f.start));

    suggestions.push({
      shiftId: best.id,
      date: best.date,
      time: timeOf(best),
      area: best.area,
      hoursFreed,
      fixesFortnights: problems
        .filter((f) => !stillOver.has(f.start))
        .map((f) => f.start),
    });
  }

  return suggestions;
}
