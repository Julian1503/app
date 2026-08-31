/** Estimacion de lo que entra cada jueves.
 *
 *  Arma la liquidacion de una semana con la misma estructura que el payslip real
 *  para poder ponerlos lado a lado: mismas etiquetas, mismo orden, mismos
 *  totales. Cuando el payslip llega, la estimacion no se descarta: queda al lado
 *  y la diferencia se vuelve un hallazgo. */

import { roundHours } from '../dates.js';
import type {
  ForecastBasis,
  ForecastLine,
  IsoDate,
  PayCategory,
  PayForecast,
  Payslip,
  RateCard,
  Shift,
} from '../types.js';
import { aggregateDaily } from '../visa/shift-hours.js';
import type { PayWeek } from './calendar.js';
import { breakdownWeek } from './classify.js';
import { BROKEN_SHIFT_PAID_FROM, OVERTIME_MULTIPLIER, SUPER_RATE } from './rules.js';
import { type BackPayCredit, settle } from './settlement.js';
import { weeklyWithholding } from './tax.js';

const money = (value: number): number => Math.round(value * 100) / 100;

/** Etiquetas tal cual las imprime el payslip, para poder cruzarlas. */
const HOURLY_LABELS: ReadonlyArray<readonly [PayCategory, string]> = [
  ['ordinary', 'Ordinary Hours'],
  ['evening', 'Evening Hours'],
  ['saturday', 'Saturday Hours'],
  ['sunday', 'Sunday Hours'],
  ['holiday', 'Public Holiday'],
  ['night', 'Night Hours'],
];

const OVERTIME_LABEL = 'Overtime Hours (exempt from super)';

function basisOf(sources: ReadonlySet<Shift['source']>, hasPayslip: boolean): ForecastBasis {
  if (hasPayslip) return 'payslip';
  if (sources.size === 0) return 'empty';
  if (sources.size > 1) return 'mixed';
  return sources.has('timesheet') ? 'timesheet' : 'roster';
}

export interface ForecastInput {
  readonly week: PayWeek;
  readonly shifts: readonly Shift[];
  readonly rates: RateCard;
  readonly holidays: ReadonlySet<IsoDate>;
  readonly kmRate: number;
  /** El payslip de esa semana, si ya llego. */
  readonly payslip: Payslip | null;
  /** Reintegro cobrado despues por esta semana, si lo hubo. */
  readonly backPayCredit?: BackPayCredit | null;
}

export function forecastWeek(input: ForecastInput): PayForecast {
  const { week, shifts, rates, holidays, kmRate, payslip } = input;
  const backPayCredit = input.backPayCredit ?? null;
  const breakdown = breakdownWeek(shifts, week.start, week.end, holidays);
  const lines: ForecastLine[] = [];

  // Las `Night Hours` son el sleepover interrumpido: dependen de si el cliente
  // te desperto esa noche, asi que no hay forma de pronosticarlas. Cuando el
  // payslip ya llego se toman de ahi como dato, no como prediccion; si no,
  // quedan en cero y la semana aparece corta contra el payslip por una razon
  // que no es del empleador. La alerta por esas horas la emite `findings.ts`.
  const hours: Record<PayCategory, number> = {
    ...breakdown.hours,
    night: payslip?.nightHours ?? 0,
  };

  for (const [category, label] of HOURLY_LABELS) {
    if (hours[category] <= 0) continue;
    const rate = rates.hourly[category];
    lines.push({
      label,
      kind: 'hours',
      quantity: hours[category],
      rate,
      amount: money(hours[category] * rate),
    });
  }

  // El overtime puede salir de categorias distintas (un domingo y un dia habil
  // rinden tarifas distintas), asi que se agrupa por tarifa resultante.
  const overtimeByRate = new Map<number, number>();
  for (const entry of breakdown.overtime) {
    const rate = money(rates.hourly[entry.base] * OVERTIME_MULTIPLIER);
    overtimeByRate.set(rate, (overtimeByRate.get(rate) ?? 0) + entry.hours);
  }
  let overtimeAmount = 0;
  for (const [rate, hours] of [...overtimeByRate].sort((a, b) => a[0] - b[0])) {
    const amount = money(hours * rate);
    overtimeAmount += amount;
    lines.push({ label: OVERTIME_LABEL, kind: 'hours', quantity: hours, rate, amount });
  }

  const paidHours = roundHours(
    lines.filter((line) => line.kind === 'hours').reduce((sum, line) => sum + (line.quantity ?? 0), 0),
  );

  if (paidHours > 0 && rates.firstAid > 0) {
    lines.push({
      label: 'First Aid Allowance',
      kind: 'allowance',
      quantity: paidHours,
      rate: rates.firstAid,
      amount: money(paidHours * rates.firstAid),
    });
  }

  // El empleador no liquidaba el turno partido antes de esa fecha. Pronosticarlo
  // hacia atras inventaria plata; hacia adelante es lo que viene pagando.
  if (breakdown.brokenShiftDays > 0 && week.start >= BROKEN_SHIFT_PAID_FROM) {
    lines.push({
      label: 'Broken Shift Allowance',
      kind: 'allowance',
      quantity: breakdown.brokenShiftDays,
      rate: rates.brokenShift,
      amount: money(breakdown.brokenShiftDays * rates.brokenShift),
    });
  }

  if (breakdown.sleepovers > 0) {
    lines.push({
      label: 'Sleepover Allowance',
      kind: 'allowance',
      quantity: breakdown.sleepovers,
      rate: rates.sleepover,
      amount: money(breakdown.sleepovers * rates.sleepover),
    });
  }

  const reimbursements = money(breakdown.kmDeclared * kmRate);
  if (reimbursements > 0) {
    lines.push({
      label: 'Travel Costs',
      kind: 'reimbursement',
      quantity: breakdown.kmDeclared,
      rate: kmRate,
      amount: reimbursements,
    });
  }

  // Los viaticos van fuera de Total Earnings: no se gravan ni generan aporte.
  const gross = money(
    lines.filter((line) => line.kind !== 'reimbursement').reduce((sum, line) => sum + line.amount, 0),
  );
  const tax = weeklyWithholding(gross, week.paymentDate);
  const net = money(gross - tax);
  const superannuation = money((gross - overtimeAmount) * SUPER_RATE);

  const visaHours = roundHours(
    aggregateDaily(shifts)
      .filter((day) => day.date >= week.start && day.date <= week.end)
      .reduce((sum, day) => sum + day.countable, 0),
  );

  // El Back Pay que trae este payslip es plata de semanas anteriores: contarlo
  // aca haria aparecer un excedente que no existe, y de paso taparia un faltante
  // real de esta misma semana.
  const carried = payslip?.backPay?.amount ?? 0;
  const grossDelta = payslip ? money(gross - (payslip.totalEarnings - carried)) : null;

  return {
    weekStart: week.start,
    weekEnd: week.end,
    paymentDate: week.paymentDate,
    basis: basisOf(breakdown.sources, payslip !== null),
    lines,
    paidHours,
    visaHours,
    gross,
    tax,
    net,
    reimbursements,
    bankPayment: money(net + reimbursements),
    superannuation,
    actual: payslip
      ? {
          gross: payslip.totalEarnings,
          tax: payslip.taxWithheld,
          net: payslip.netPay,
          superannuation: payslip.superannuation,
          bankPayment: payslip.bankPayment,
          paidHours: payslip.paidHours,
        }
      : null,
    grossDelta,
    settlement: settle(grossDelta, backPayCredit, carried),
  };
}
