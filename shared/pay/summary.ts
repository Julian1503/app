/** Armado del panel de plata: que semanas mostrar y cual es el proximo deposito. */

import { addDays } from '../dates.js';
import type { IsoDate, PayForecast, PaySummary, Payslip, Shift } from '../types.js';
import { financialYearOf, payWeeksBetween } from './calendar.js';
import { forecastWeek } from './forecast.js';
import { buildRateTimeline, rateCardFor } from './rates.js';
import { creditsByWeek, summariseBackPay } from './settlement.js';
import { taxTableYearFor } from './tax.js';

/** Piso de historial cuando todavia no hay payslips cargados. */
const MIN_WEEKS_BACK = 8;

export interface PaySummaryInput {
  readonly shifts: readonly Shift[];
  readonly payslips: readonly Payslip[];
  readonly holidays: ReadonlySet<IsoDate>;
  readonly kmRate: number;
  readonly today: IsoDate;
}

export function buildPaySummary(input: PaySummaryInput): PaySummary {
  const { shifts, payslips, holidays, kmRate, today } = input;

  const timeline = buildRateTimeline(payslips);
  const byPeriodStart = new Map(payslips.map((slip) => [slip.periodStart, slip]));
  const backPayCredits = creditsByWeek(payslips);

  // Hacia atras el rango cubre **todos** los payslips, no una ventana: los
  // reclamos mas grandes que encontro esta herramienta son de meses atras y una
  // ventana corta los dejaria sin detectar. Hacia adelante llega hasta el ultimo
  // turno conocido, porque el roster publicado va varias semanas por delante y
  // esas son justamente las semanas que se quieren anticipar.
  const firstPayslip = payslips.reduce<IsoDate | null>(
    (min, slip) => (min === null || slip.periodStart < min ? slip.periodStart : min),
    null,
  );
  const defaultStart = addDays(today, -7 * MIN_WEEKS_BACK);
  const from = firstPayslip !== null && firstPayslip < defaultStart ? firstPayslip : defaultStart;
  const lastShift = shifts.reduce<IsoDate>((max, shift) => (shift.date > max ? shift.date : max), today);
  const weeks = payWeeksBetween(from, lastShift);

  const forecasts: PayForecast[] = weeks.map((week) =>
    forecastWeek({
      week,
      shifts,
      rates: rateCardFor(timeline, week.start),
      holidays,
      kmRate,
      payslip: byPeriodStart.get(week.start) ?? null,
      backPayCredit: backPayCredits.get(week.start) ?? null,
    }),
  );

  const next = forecasts.find((forecast) => forecast.paymentDate >= today) ?? null;

  const financialYear = financialYearOf(today);
  const yearSlips = payslips.filter(
    (slip) => financialYearOf(slip.paymentDate ?? slip.periodEnd) === financialYear,
  );
  const sum = (pick: (slip: Payslip) => number): number =>
    Math.round(yearSlips.reduce((total, slip) => total + pick(slip), 0) * 100) / 100;

  return {
    next,
    weeks: forecasts,
    backPay: summariseBackPay(forecasts),
    rates: rateCardFor(timeline, next?.weekStart ?? today),
    taxYear: taxTableYearFor(next?.paymentDate ?? today),
    yearToDate: {
      financialYear,
      gross: sum((slip) => slip.totalEarnings),
      tax: sum((slip) => slip.taxWithheld),
      superannuation: sum((slip) => slip.superannuation),
      bankPayment: sum((slip) => slip.bankPayment),
      payslips: yearSlips.length,
    },
  };
}
