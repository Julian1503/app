/** Payslips ya parseados. Los PDF originales no se guardan: viven en el disco
 *  de quien corre `npm run payslips:import`, que es el unico que los lee. */

import type { BackPay, Payslip, PayslipLine } from '../../shared/types.ts';
import { assertOk, db, unwrap } from './client.ts';

interface PayslipRow {
  file: string;
  period_start: string;
  period_end: string;
  payment_date: string | null;
  total_earnings: string | number;
  net_pay: string | number;
  lines: PayslipLine[];
  paid_hours: string | number;
  sleepover_count: number;
  sleepover_amount: string | number;
  travel_costs_paid: string | number;
  night_hours: string | number;
  tax_withheld: string | number;
  superannuation: string | number;
  bank_payment: string | number;
  back_pay: BackPay | null;
  arithmetic_mismatch: boolean;
}

/** Postgres devuelve los `numeric` como string para no perder precision al
 *  serializar. Sin esto, `slip.netPay + otro` concatena en vez de sumar. */
function num(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPayslip(row: PayslipRow): Payslip {
  return {
    file: row.file,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    paymentDate: row.payment_date,
    totalEarnings: num(row.total_earnings),
    netPay: num(row.net_pay),
    lines: row.lines ?? [],
    paidHours: num(row.paid_hours),
    sleepoverCount: row.sleepover_count,
    sleepoverAmount: num(row.sleepover_amount),
    travelCostsPaid: num(row.travel_costs_paid),
    nightHours: num(row.night_hours),
    taxWithheld: num(row.tax_withheld),
    superannuation: num(row.superannuation),
    bankPayment: num(row.bank_payment),
    backPay: row.back_pay,
    arithmeticMismatch: row.arithmetic_mismatch,
  };
}

function toRow(slip: Payslip): PayslipRow {
  return {
    file: slip.file,
    period_start: slip.periodStart,
    period_end: slip.periodEnd,
    payment_date: slip.paymentDate,
    total_earnings: slip.totalEarnings,
    net_pay: slip.netPay,
    lines: [...slip.lines],
    paid_hours: slip.paidHours,
    sleepover_count: slip.sleepoverCount,
    sleepover_amount: slip.sleepoverAmount,
    travel_costs_paid: slip.travelCostsPaid,
    night_hours: slip.nightHours,
    tax_withheld: slip.taxWithheld,
    superannuation: slip.superannuation,
    bank_payment: slip.bankPayment,
    back_pay: slip.backPay,
    arithmetic_mismatch: slip.arithmeticMismatch,
  };
}

export async function readPayslips(): Promise<Payslip[]> {
  const rows = unwrap(
    await db().from('payslips').select('*').order('period_start', { ascending: true }),
    'No se pudieron leer los payslips',
  ) as PayslipRow[];
  return rows.map(toPayslip);
}

/** Guarda el resultado de parsear la carpeta de PDF. La PK es el periodo, asi
 *  que reimportar el mismo payslip lo pisa en vez de duplicarlo. */
export async function writePayslips(payslips: readonly Payslip[]): Promise<void> {
  if (payslips.length === 0) return;
  assertOk(
    await db()
      .from('payslips')
      .upsert(payslips.map(toRow), { onConflict: 'period_start,period_end' }),
    'No se pudieron guardar los payslips',
  );
}
