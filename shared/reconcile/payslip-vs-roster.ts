/** Cruce entre lo que dice el roster y lo que efectivamente pago el payslip. */

import { addDays, rangeDays } from '../dates.js';
import type { I18n } from '../i18n/index.js';
import type { DailyHours, Finding, Payslip, Shift } from '../types.js';
import { aggregateDaily } from '../visa/shift-hours.js';

function sumSleepovers(daily: readonly DailyHours[], from: string, to: string): number {
  return daily
    .filter((day) => day.date >= from && day.date <= to)
    .reduce((sum, day) => sum + day.sleepovers, 0);
}

/** Chequeos del payslip contra el roster que no son de plata.
 *
 *  La diferencia de horas ya no se reporta aca: la cubre `pay/findings.ts`, que
 *  compara concepto por concepto y ademas dice cuanta plata hay en juego. Aca
 *  quedan los chequeos que no se deducen del importe. */
export function checkPaidHours(
  payslips: readonly Payslip[],
  shifts: readonly Shift[],
  i18n: I18n,
): Finding[] {
  const { t } = i18n;
  const daily = aggregateDaily(shifts);
  const findings: Finding[] = [];

  for (const payslip of payslips) {
    const period = i18n.range(payslip.periodStart, payslip.periodEnd);
    const rosteredSleepovers = sumSleepovers(daily, payslip.periodStart, payslip.periodEnd);
    if (rosteredSleepovers !== payslip.sleepoverCount && rosteredSleepovers > 0) {
      findings.push({
        id: `sleepover:${payslip.periodStart}`,
        severity: payslip.sleepoverCount < rosteredSleepovers ? 'high' : 'info',
        category: 'pay',
        title: t('f.sleepover.title', {
          paid: payslip.sleepoverCount,
          rostered: rosteredSleepovers,
        }),
        detail: t('f.sleepover.detail', {
          range: period,
          rostered: rosteredSleepovers,
          paid: payslip.sleepoverCount,
        }),
        amount: null,
        date: payslip.periodStart,
      });
    }

    if (payslip.arithmeticMismatch) {
      findings.push({
        id: `arith:${payslip.periodStart}`,
        severity: 'medium',
        category: 'pay',
        title: t('f.arith.title'),
        detail: t('f.arith.detail', {
          file: payslip.file,
          total: i18n.money(payslip.totalEarnings),
        }),
        amount: null,
        date: payslip.periodStart,
      });
    }

    if (payslip.nightHours > 0) {
      findings.push({
        id: `night:${payslip.periodStart}`,
        severity: 'critical',
        category: 'visa',
        title: t('f.night.title', { hours: payslip.nightHours }),
        detail: t('f.night.detail', { range: period }),
        amount: null,
        date: payslip.periodStart,
      });
    }
  }

  return findings;
}

/** Semanas con turnos trabajados para las que no hay payslip cargado. */
export function checkMissingPayslips(
  payslips: readonly Payslip[],
  shifts: readonly Shift[],
  today: string,
  i18n: I18n,
): Finding[] {
  const covered = new Set<string>();
  for (const payslip of payslips) {
    for (const date of rangeDays(payslip.periodStart, payslip.periodEnd)) covered.add(date);
  }

  const worked = shifts
    .filter((shift) => shift.source === 'timesheet' && shift.date < today)
    .map((shift) => shift.date);

  const gaps = [...new Set(worked)].filter((date) => !covered.has(date)).sort();
  if (gaps.length === 0) return [];

  // Agrupa dias contiguos para no escupir un hallazgo por dia.
  const blocks: Array<[string, string]> = [];
  let blockStart = gaps[0]!;
  let previous = gaps[0]!;
  for (const date of gaps.slice(1)) {
    if (date !== addDays(previous, 1)) {
      blocks.push([blockStart, previous]);
      blockStart = date;
    }
    previous = date;
  }
  blocks.push([blockStart, previous]);

  return blocks.map(([from, to]) => ({
    id: `missing-payslip:${from}`,
    severity: 'high' as const,
    category: 'data' as const,
    title: i18n.t('f.missingPayslip.title'),
    detail: i18n.t('f.missingPayslip.detail', { range: i18n.range(from, to) }),
    amount: null,
    date: from,
  }));
}
