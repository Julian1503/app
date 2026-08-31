/** Tarifas leidas de los payslips, no hardcodeadas.
 *
 *  El award sube todos los 1 de julio y el empleador puede reclasificarte en
 *  cualquier momento. Si las tarifas vivieran en el codigo, el pronostico
 *  quedaria viejo sin avisar. Aca se arma una linea de tiempo de tarifas: cada
 *  payslip aporta las que trae y arrastra las que no.
 *
 *  Ejemplo real: hasta el 30 de junio de 2026 la hora ordinaria valia $32.88 y
 *  desde el 1 de julio $34.44. */

import type { IsoDate, PayCategory, Payslip, RateCard } from '../types.js';
import { FALLBACK_RATES } from './rules.js';

const HOURLY_LABELS: ReadonlyArray<readonly [RegExp, PayCategory]> = [
  [/^Ordinary Hours/i, 'ordinary'],
  [/^Evening Hours/i, 'evening'],
  [/^Saturday Hours/i, 'saturday'],
  [/^Sunday Hours/i, 'sunday'],
  [/^Public Holiday/i, 'holiday'],
  [/^Night Hours/i, 'night'],
  [/^Overtime/i, 'overtime'],
];

const BROKEN_SHIFT_LABEL = /Broken Shift Allowance/i;
const FIRST_AID_LABEL = /First Aid Allowance/i;

const FALLBACK_CARD: RateCard = {
  effectiveFrom: '1970-01-01',
  hourly: {
    ordinary: FALLBACK_RATES.ordinary,
    evening: FALLBACK_RATES.evening,
    saturday: FALLBACK_RATES.saturday,
    sunday: FALLBACK_RATES.sunday,
    holiday: FALLBACK_RATES.holiday,
    night: FALLBACK_RATES.night,
    // El overtime no tiene tarifa propia: se calcula sobre la categoria del turno.
    overtime: 0,
  },
  sleepover: FALLBACK_RATES.sleepover,
  brokenShift: FALLBACK_RATES.brokenShift,
  firstAid: FALLBACK_RATES.firstAid,
};

/** Tarifa unitaria del sleepover. El payslip imprime el importe pero casi nunca
 *  la cantidad, asi que `loadPayslips` la deduce antes; aca solo se divide. */
function sleepoverRateOf(payslip: Payslip): number | null {
  if (payslip.sleepoverAmount <= 0 || payslip.sleepoverCount <= 0) return null;
  return Math.round((payslip.sleepoverAmount / payslip.sleepoverCount) * 100) / 100;
}

/** Linea de tiempo de tarifas, una entrada por payslip que cambie algo. */
export function buildRateTimeline(payslips: readonly Payslip[]): RateCard[] {
  const ordered = [...payslips].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  const timeline: RateCard[] = [];
  let current = FALLBACK_CARD;

  for (const payslip of ordered) {
    const hourly: Record<PayCategory, number> = { ...current.hourly };
    let brokenShift = current.brokenShift;
    let firstAid = current.firstAid;

    for (const line of payslip.lines) {
      if (line.rate === null || line.rate <= 0) continue;
      const match = HOURLY_LABELS.find(([pattern]) => pattern.test(line.label));
      if (match) hourly[match[1]] = line.rate;
      else if (BROKEN_SHIFT_LABEL.test(line.label)) brokenShift = line.rate;
      else if (FIRST_AID_LABEL.test(line.label)) firstAid = line.rate;
    }

    current = {
      effectiveFrom: payslip.periodStart,
      hourly,
      sleepover: sleepoverRateOf(payslip) ?? current.sleepover,
      brokenShift,
      firstAid,
    };
    timeline.push(current);
  }

  return timeline;
}

/** Tarifas vigentes en una fecha. Para fechas futuras devuelve las ultimas
 *  conocidas, que es la mejor apuesta hasta que llegue el proximo payslip. */
export function rateCardFor(timeline: readonly RateCard[], date: IsoDate): RateCard {
  if (timeline.length === 0) return FALLBACK_CARD;
  let chosen = timeline[0]!;
  for (const card of timeline) {
    if (card.effectiveFrom > date) break;
    chosen = card;
  }
  return chosen;
}
