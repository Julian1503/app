/** Contrasta la estimacion semanal contra los payslips que ya llegaron.
 *
 *  Es la red de seguridad del pronostico: si una regla se rompe o el empleador
 *  cambia como liquida, esto lo muestra antes de que la app diga un numero
 *  equivocado. Uso: `npm run forecast:check`. */

import { config } from '../server/config.ts';
import { readShifts } from '../server/db/shifts.ts';
import { readHolidays } from '../server/holidays.ts';
import { loadPayslips } from '../server/payslips/load.ts';
import { payWeekOf } from '../shared/pay/calendar.ts';
import { forecastWeek } from '../shared/pay/forecast.ts';
import { buildRateTimeline, rateCardFor } from '../shared/pay/rates.ts';
import { SUPER_RATE } from '../shared/pay/rules.ts';
import { weeklyWithholding } from '../shared/pay/tax.ts';

const pad = (value: string | number, width: number): string => String(value).padStart(width);
const money = (value: number): string => `$${value.toFixed(2)}`;

async function main(): Promise<void> {
  const { shifts } = await readShifts();
  const { payslips } = await loadPayslips();
  const holidays = new Set((await readHolidays()).map((holiday) => holiday.date));
  const timeline = buildRateTimeline(payslips);

  let grossExact = 0;
  let taxExact = 0;
  let superExact = 0;

  console.log('periodo                 bruto est / real      dif |   tax est/real |  super est/real');
  console.log('-'.repeat(88));

  for (const payslip of payslips) {
    const week = payWeekOf(payslip.periodStart);
    const forecast = forecastWeek({
      week,
      shifts,
      rates: rateCardFor(timeline, week.start),
      holidays,
      kmRate: config.kmRate,
      payslip: null,
    });

    const payDate = payslip.paymentDate ?? payslip.periodEnd;
    // El Back Pay se cobra en esta semana pero es plata de semanas anteriores:
    // compararlo contra el pronostico de esta semana marcaria un excedente que
    // no existe. La jubilacion si lo incluye (se aporta sobre los atrasados),
    // pero la retencion no: los atrasados van por el Schedule 5, no por la
    // tabla semanal.
    const backPay = payslip.backPay?.amount ?? 0;
    const earnings = Math.round((payslip.totalEarnings - backPay) * 100) / 100;

    // El impuesto y la jubilacion se prueban sobre el bruto **real**, para
    // separar un error de la formula de un error de las horas.
    const taxOnActual = weeklyWithholding(earnings, payDate);
    const overtime = payslip.lines
      .filter((line) => /^Overtime/i.test(line.label))
      .reduce((sum, line) => sum + line.amount, 0);
    const superOnActual = Math.round((payslip.totalEarnings - overtime) * SUPER_RATE * 100) / 100;

    const grossDelta = Math.round((forecast.gross - earnings) * 100) / 100;
    if (Math.abs(grossDelta) <= 1) grossExact += 1;
    if (Math.abs(taxOnActual - payslip.taxWithheld) <= 0.5) taxExact += 1;
    if (Math.abs(superOnActual - payslip.superannuation) <= 0.02) superExact += 1;

    const flag = Math.abs(grossDelta) <= 1 ? '  ' : '!!';
    console.log(
      `${flag}${payslip.periodStart} ${pad(money(forecast.gross), 10)} /${pad(money(earnings), 10)} ${pad(money(grossDelta), 9)} |` +
        `${pad(taxOnActual, 7)}/${pad(payslip.taxWithheld, 6)} |` +
        `${pad(money(superOnActual), 9)}/${pad(money(payslip.superannuation), 9)}`,
    );
  }

  const total = payslips.length;
  console.log('-'.repeat(88));
  console.log(`bruto exacto:  ${grossExact}/${total}`);
  console.log(`PAYG exacto:   ${taxExact}/${total}`);
  console.log(`super exacto:  ${superExact}/${total}`);

  if (taxExact < total || superExact < total) {
    console.error('\nLa formula de retencion o la tasa de jubilacion dejaron de reproducir la realidad.');
    process.exitCode = 1;
  }
}

await main();
