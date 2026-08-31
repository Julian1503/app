/** Ensamblado del reporte completo. Funcion pura: mismas entradas, mismo reporte. */

import { roundHours } from './dates.ts';
import {
  checkBackPayBreakdown,
  checkForecastAgainstPayslips,
  checkForecastLines,
  checkHolidayCalendar,
  checkPayrollModel,
  checkTaxTableCoverage,
} from './pay/findings.ts';
import { buildPaySummary } from './pay/summary.ts';
import type { I18n } from './i18n/index.ts';
import { checkBrokenShifts } from './reconcile/broken-shift.ts';
import { reconcileKm } from './reconcile/km.ts';
import { checkMissingPayslips, checkPaidHours } from './reconcile/payslip-vs-roster.ts';
import type { AnalysisReport, Finding, IsoDate, Payslip, Shift } from './types.ts';
import { planDrops } from './visa/drop-planner.ts';
import { checkFortnights } from './visa/findings.ts';
import type { TermBreak } from './visa/fortnights.ts';
import { buildFortnights, currentFortnight, upcomingFortnights } from './visa/fortnights.ts';
import { aggregateDaily } from './visa/shift-hours.ts';

const SEVERITY_ORDER: Record<Finding['severity'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  info: 3,
};

export interface ReportInput {
  readonly shifts: readonly Shift[];
  readonly payslips: readonly Payslip[];
  readonly breaks: readonly TermBreak[];
  /** Feriados que aplican en el lugar de trabajo (QLD + Toowoomba). */
  readonly holidays: readonly IsoDate[];
  readonly limit: number;
  readonly kmRate: number;
  readonly today: string;
  /** Idioma en que se redactan los hallazgos. */
  readonly i18n: I18n;
}

export function buildReport(input: ReportInput): AnalysisReport {
  const { shifts, payslips, breaks, limit, kmRate, today, i18n } = input;
  const holidays = new Set(input.holidays);

  const daily = aggregateDaily(shifts);
  const fortnights = buildFortnights(daily, breaks, limit);
  const km = reconcileKm(payslips, shifts, kmRate, i18n);
  const pay = buildPaySummary({ shifts, payslips, holidays, kmRate, today });

  const findings: Finding[] = [
    ...checkFortnights(fortnights, limit, today, i18n),
    ...checkPaidHours(payslips, shifts, i18n),
    ...checkMissingPayslips(payslips, shifts, today, i18n),
    ...checkBrokenShifts(shifts, i18n),
    ...checkForecastAgainstPayslips(pay.weeks, i18n),
    ...checkForecastLines(pay.weeks, payslips, i18n),
    ...checkBackPayBreakdown(payslips, i18n),
    ...checkHolidayCalendar(payslips, shifts, holidays, i18n),
    ...checkPayrollModel(payslips, i18n),
    ...checkTaxTableCoverage(pay.next, i18n),
    ...km.findings,
  ].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return bySeverity !== 0 ? bySeverity : (b.date ?? '').localeCompare(a.date ?? '');
  });

  return {
    generatedAt: new Date().toISOString(),
    limit,
    daily,
    fortnights,
    current: currentFortnight(fortnights, today),
    upcoming: upcomingFortnights(fortnights, today),
    payslips,
    findings,
    dropPlan: planDrops(shifts, breaks, limit, today),
    pay,
    totals: {
      rosterHours: roundHours(daily.reduce((sum, day) => sum + day.countable, 0)),
      paidHours: roundHours(payslips.reduce((sum, slip) => sum + slip.paidHours, 0)),
      grossPaid: roundHours(payslips.reduce((sum, slip) => sum + slip.totalEarnings, 0)),
      netPaid: roundHours(payslips.reduce((sum, slip) => sum + slip.netPay, 0)),
      kmOwed: km.owed,
      moneyOwed: km.moneyOwed,
      // Lo que sigue abierto, no lo que alguna vez falto: un faltante que ya
      // volvio como Back Pay no es plata a reclamar, y dejarlo sumando aca haria
      // que el total nunca bajara por mas que el empleador pagara.
      payShortfall: pay.backPay.outstanding,
      payRecovered: pay.backPay.recovered,
    },
  };
}
