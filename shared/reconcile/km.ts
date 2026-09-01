/** Reconciliacion de km de viaje: lo declarado en el comentario del timesheet
 *  contra lo que el payslip pago bajo REIMBURSEMENTS > Travel Costs. */

import type { I18n } from '../i18n/index.js';
import type { Finding, Payslip, Shift } from '../types.js';
import { KM_SELF_APPROVE_LIMIT } from '../visa/rules.js';

/** Frases con las que se declaran los km dentro del `employeeComment`. */
const KM_PATTERN = /(\d+(?:[.,]\d+)?)\s*(?:km|kms|kilometros|kilometres)\b/i;

/** Menciona haber manejado pero sin cifra: no es reclamable, pero conviene verlo. */
const DRIVING_PATTERN = /\b(drove|driving|drive|travel|travelled|traveling|manej|viaj)/i;

/** Debajo de esto es redondeo al dividir el importe por la tarifa, no un faltante. */
const KM_TOLERANCE = 0.5;

const round1 = (value: number): number => Math.round(value * 10) / 10;
const money = (value: number): number => Math.round(value * 100) / 100;

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

/** Un periodo de pago con sus km: lo que se declaro y lo que se pago. */
interface KmPeriod {
  readonly payslip: Payslip;
  readonly declared: number;
  readonly paidKm: number;
  /** Turnos del periodo, para poder citar cuales declararon km. */
  readonly shifts: readonly Shift[];
}

/** Un periodo que quedo corto de km, con lo que se recupero despues. */
interface KmClaim {
  readonly period: KmPeriod;
  /** Km que faltaron en su propio periodo. */
  readonly short: number;
  /** Cuantos de esos km volvieron en un payslip posterior. */
  readonly recovered: number;
  /** El payslip que los reintegro, si lo hubo. */
  readonly recoveredIn: Payslip | null;
}

function periodsOf(
  payslips: readonly Payslip[],
  shifts: readonly Shift[],
  kmRate: number,
): KmPeriod[] {
  // Se ordena una copia: la imputacion de reintegros tardios necesita recorrer
  // los periodos en orden y el orden del arreglo de entrada no esta garantizado.
  return [...payslips]
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
    .map((payslip) => {
      const inPeriod = shifts.filter(
        (shift) => shift.date >= payslip.periodStart && shift.date <= payslip.periodEnd,
      );
      return {
        payslip,
        declared: inPeriod.reduce((sum, shift) => sum + (shift.kmDeclared ?? 0), 0),
        paidKm: kmRate > 0 ? payslip.travelCostsPaid / kmRate : 0,
        shifts: inPeriod,
      };
    });
}

/** Reparte un excedente entre los periodos que siguen abiertos, del mas viejo al
 *  mas nuevo. Un reintegro no puede dejar un periodo en positivo: como mucho
 *  cubre lo que falto, y lo que sobra pasa al siguiente. */
function applyCredit(claims: readonly KmClaim[], credit: number, paidBy: Payslip): KmClaim[] {
  let left = credit;
  return claims.map((claim) => {
    const open = round1(claim.short - claim.recovered);
    if (left <= 0 || open <= 0) return claim;
    const applied = Math.min(open, left);
    left = round1(left - applied);
    return { ...claim, recovered: round1(claim.recovered + applied), recoveredIn: paidBy };
  });
}

/** Periodos cortos de km, ya netos de los reintegros que llegaron tarde.
 *
 *  El empleador no siempre reembolsa en el payslip de la semana en que se
 *  manejo: a veces los km aparecen en el payslip siguiente. Leido literal eso
 *  cuenta el faltante dos veces -el periodo original queda debiendo para siempre
 *  y el excedente del otro se descarta en silencio-, que es exactamente la forma
 *  de inflar un reclamo. Por eso lo pagado de mas se imputa hacia atras. */
function claimsOf(periods: readonly KmPeriod[]): KmClaim[] {
  let claims: readonly KmClaim[] = [];

  for (const period of periods) {
    const gap = round1(period.declared - period.paidKm);

    if (gap > KM_TOLERANCE) {
      claims = [...claims, { period, short: gap, recovered: 0, recoveredIn: null }];
      continue;
    }

    const credit = round1(-gap);
    if (credit <= KM_TOLERANCE) continue;
    claims = applyCredit(claims, credit, period.payslip);
  }

  return [...claims];
}

/** Hallazgo por periodo corto. Uno ya reintegrado no desaparece: baja de tono.
 *  Sigue listado como prueba de que el reclamo se hizo y se pago, y para poder
 *  revisar que haya vuelto entero. */
function claimFinding(claim: KmClaim, kmRate: number, i18n: I18n): Finding {
  const { t } = i18n;
  const { payslip } = claim.period;
  const open = round1(claim.short - claim.recovered);

  const shiftsWithKm = claim.period.shifts
    .filter((shift) => (shift.kmDeclared ?? 0) > 0)
    .map((shift) => `${i18n.date(shift.date)} (${shift.kmDeclared} km)`)
    .join(', ');

  const detail = t('f.km.detail', {
    range: i18n.range(payslip.periodStart, payslip.periodEnd),
    declared: round1(claim.period.declared),
    paidMoney: i18n.money(payslip.travelCostsPaid),
    paidKm: round1(claim.period.paidKm),
    rate: kmRate,
    shifts: shiftsWithKm || t('f.km.noDetail'),
  });

  const settled = open <= KM_TOLERANCE;
  const note =
    claim.recoveredIn !== null
      ? t(settled ? 'f.km.settledNote' : 'f.km.partialNote', {
          km: claim.recovered,
          money: i18n.money(money(claim.recovered * kmRate)),
          date: i18n.date(claim.recoveredIn.paymentDate ?? claim.recoveredIn.periodEnd),
        })
      : '';

  return {
    id: `km:${payslip.periodStart}`,
    severity: settled ? 'info' : 'high',
    category: 'km',
    title: settled
      ? t('f.km.titleSettled', {
          km: claim.recovered,
          money: i18n.money(money(claim.recovered * kmRate)),
        })
      : t('f.km.title', { km: open, money: i18n.money(money(open * kmRate)) }),
    detail: detail + note,
    amount: settled ? null : money(open * kmRate),
    date: payslip.periodStart,
  };
}

/** Avisos que salen del turno suelto y no del cruce contra el payslip. */
function shiftFindings(shifts: readonly Shift[], i18n: I18n): Finding[] {
  const { t } = i18n;
  const findings: Finding[] = [];

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

  return findings;
}

export function reconcileKm(
  payslips: readonly Payslip[],
  shifts: readonly Shift[],
  kmRate: number,
  i18n: I18n,
): KmReconciliation {
  const periods = periodsOf(payslips, shifts, kmRate);
  const claims = claimsOf(periods);

  const owed = round1(
    claims.reduce((sum, claim) => sum + Math.max(round1(claim.short - claim.recovered), 0), 0),
  );

  return {
    declared: round1(periods.reduce((sum, period) => sum + period.declared, 0)),
    paid: round1(periods.reduce((sum, period) => sum + period.paidKm, 0)),
    owed,
    moneyOwed: money(owed * kmRate),
    findings: [
      ...claims.map((claim) => claimFinding(claim, kmRate, i18n)),
      ...shiftFindings(shifts, i18n),
    ],
  };
}
