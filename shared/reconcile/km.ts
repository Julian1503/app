/** Reconciliacion de km de viaje: lo declarado en el comentario del timesheet
 *  contra lo que el payslip pago bajo REIMBURSEMENTS > Travel Costs. */

import type { I18n } from '../i18n/index.ts';
import type { Finding, Payslip, Shift } from '../types.ts';
import { KM_SELF_APPROVE_LIMIT } from '../visa/rules.ts';

/** Frases con las que se declaran los km dentro del `employeeComment`. */
const KM_PATTERN = /(\d+(?:[.,]\d+)?)\s*(?:km|kms|kilometros|kilometres)\b/i;

/** Menciona haber manejado pero sin cifra: no es reclamable, pero conviene verlo. */
const DRIVING_PATTERN = /\b(drove|driving|drive|travel|travelled|traveling|manej|viaj)/i;

export function extractKm(comment: string | null): number | null {
  if (!comment) return null;
  const match = KM_PATTERN.exec(comment);
  if (!match) return null;
  const value = Number.parseFloat(match[1]!.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

export interface KmReconciliation {
  readonly declared: number;
  readonly paid: number;
  readonly owed: number;
  readonly moneyOwed: number;
  readonly findings: readonly Finding[];
}

export function reconcileKm(
  payslips: readonly Payslip[],
  shifts: readonly Shift[],
  kmRate: number,
  i18n: I18n,
): KmReconciliation {
  const { t } = i18n;
  const findings: Finding[] = [];
  let declaredTotal = 0;
  let paidTotal = 0;
  let owedKm = 0;

  for (const payslip of payslips) {
    const inPeriod = shifts.filter(
      (shift) => shift.date >= payslip.periodStart && shift.date <= payslip.periodEnd,
    );
    const declared = inPeriod.reduce((sum, shift) => sum + (shift.kmDeclared ?? 0), 0);
    const paidKm = kmRate > 0 ? payslip.travelCostsPaid / kmRate : 0;

    declaredTotal += declared;
    paidTotal += paidKm;

    const gap = Math.round((declared - paidKm) * 10) / 10;
    if (gap > 0.5) {
      owedKm += gap;
      const money = Math.round(gap * kmRate * 100) / 100;
      const shiftsWithKm = inPeriod
        .filter((shift) => (shift.kmDeclared ?? 0) > 0)
        .map((shift) => `${i18n.date(shift.date)} (${shift.kmDeclared} km)`)
        .join(', ');

      findings.push({
        id: `km:${payslip.periodStart}`,
        severity: 'high',
        category: 'km',
        title: t('f.km.title', { km: gap, money: i18n.money(money) }),
        detail: t('f.km.detail', {
          range: i18n.range(payslip.periodStart, payslip.periodEnd),
          declared: Math.round(declared * 10) / 10,
          paidMoney: i18n.money(payslip.travelCostsPaid),
          paidKm: Math.round(paidKm * 10) / 10,
          rate: kmRate,
          shifts: shiftsWithKm || t('f.km.noDetail'),
        }),
        amount: money,
        date: payslip.periodStart,
      });
    }
  }

  for (const shift of shifts) {
    const km = shift.kmDeclared ?? 0;
    if (km > KM_SELF_APPROVE_LIMIT) {
      findings.push({
        id: `km-limit:${shift.id}`,
        severity: 'info',
        category: 'km',
        title: t('f.kmLimit.title', { km, limit: KM_SELF_APPROVE_LIMIT }),
        detail: t('f.kmLimit.detail', {
          date: i18n.date(shift.date),
          limit: KM_SELF_APPROVE_LIMIT,
        }),
        amount: null,
        date: shift.date,
      });
    }

    if (
      km === 0 &&
      shift.employeeComment &&
      DRIVING_PATTERN.test(shift.employeeComment) &&
      !KM_PATTERN.test(shift.employeeComment)
    ) {
      findings.push({
        id: `km-vague:${shift.id}`,
        severity: 'info',
        category: 'km',
        title: t('f.kmVague.title'),
        detail: t('f.kmVague.detail', {
          date: i18n.date(shift.date),
          comment: shift.employeeComment.slice(0, 120),
        }),
        amount: null,
        date: shift.date,
      });
    }
  }

  return {
    declared: Math.round(declaredTotal * 10) / 10,
    paid: Math.round(paidTotal * 10) / 10,
    owed: Math.round(owedKm * 10) / 10,
    moneyOwed: Math.round(owedKm * kmRate * 100) / 100,
    findings,
  };
}
