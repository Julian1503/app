/** Chequeos que salen de comparar la estimacion contra el payslip real.
 *
 *  Son de dos clases distintas y conviene no confundirlas:
 *
 *  - **El empleador liquido distinto de lo que dice el roster.** Es plata, y va
 *    como hallazgo de pago con el detalle de que concepto no coincide.
 *  - **Nuestro modelo se quedo viejo.** La tabla de retencion cambio, o la tasa
 *    de jubilacion, o apareció un feriado que no esta en la lista. Va como
 *    hallazgo de datos: no hay que reclamarle nada a nadie, hay que actualizar
 *    la herramienta. */

import type { I18n } from '../i18n/index.js';
import type { Finding, PayForecast, Payslip, PayslipLineKind, Shift } from '../types.js';
import { SUPER_RATE } from './rules.js';
import { PAY_TOLERANCE } from './settlement.js';
import { isTaxTableStale, weeklyWithholding } from './tax.js';

/** Debajo de esto es redondeo de la nomina, no un error. */
const MONEY_TOLERANCE = PAY_TOLERANCE;
const HOURS_TOLERANCE = 0.12;

/** El payslip nombra el feriado concreto (`Public Holiday (Labour Day)`) y la
 *  estimacion no puede saberlo, asi que el parentesis final se descarta para
 *  comparar. Sin esto, cada feriado aparece como dos conceptos que no cierran. */
function normaliseLabel(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/** Suma por etiqueta, para poder comparar concepto contra concepto.
 *
 *  El `Back Pay` queda afuera: es plata de otras semanas y compararlo contra una
 *  estimacion que no lo tiene daria una diferencia por cada reintegro cobrado. */
function amountsByLabel(
  lines: ReadonlyArray<{ label: string; kind: PayslipLineKind; amount: number }>,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (line.kind === 'backpay') continue;
    const key = normaliseLabel(line.label);
    totals.set(key, (totals.get(key) ?? 0) + line.amount);
  }
  return totals;
}

/** Conceptos en que la estimacion y el payslip no coinciden. */
function differingLabels(forecast: PayForecast, payslip: Payslip, i18n: I18n): string[] {
  const expected = amountsByLabel(forecast.lines);
  const actual = amountsByLabel(payslip.lines);
  const labels = new Set([...expected.keys(), ...actual.keys()]);

  const differences: string[] = [];
  for (const label of [...labels].sort()) {
    const mine = expected.get(label) ?? 0;
    const theirs = actual.get(label) ?? 0;
    if (Math.abs(mine - theirs) <= MONEY_TOLERANCE) continue;
    differences.push(
      i18n.t('f.payLines.item', {
        // Las etiquetas son las del payslip y quedan en ingles a proposito: son
        // los nombres con los que hay que reclamar.
        label,
        expected: i18n.money(mine),
        actual: i18n.money(theirs),
      }),
    );
  }
  return differences;
}

/** Semanas donde el payslip no da lo que el roster dice que deberia dar.
 *
 *  Una semana corta deja de estarlo cuando el faltante vuelve como `Back Pay`.
 *  El hallazgo no desaparece: cambia de tono. Sigue listado, pero como algo ya
 *  cobrado y no como plata a reclamar, porque es la prueba de que el reclamo se
 *  hizo y se pago, y porque conviene revisar que haya vuelto entero. */
export function checkForecastAgainstPayslips(
  forecasts: readonly PayForecast[],
  i18n: I18n,
): Finding[] {
  const findings: Finding[] = [];

  for (const forecast of forecasts) {
    const { actual, grossDelta, settlement } = forecast;
    if (!actual || grossDelta === null) continue;
    if (settlement.status === 'matches' || settlement.status === 'pending') continue;

    const id = `pay-delta:${forecast.weekStart}`;
    const range = i18n.range(forecast.weekStart, forecast.weekEnd);
    const detail = i18n.t('f.payDelta.detail', {
      range,
      expected: i18n.money(forecast.gross),
      actual: i18n.money(actual.gross - settlement.carried),
    });

    if (settlement.status === 'settled') {
      findings.push({
        id,
        severity: 'info',
        category: 'pay',
        title: i18n.t('f.payDelta.titleSettled', { money: i18n.money(settlement.recovered) }),
        detail:
          detail +
          i18n.t('f.payDelta.settledNote', {
            money: i18n.money(settlement.recovered),
            date: i18n.date(settlement.recoveredIn?.paymentDate ?? forecast.paymentDate),
          }),
        amount: null,
        date: forecast.weekStart,
      });
      continue;
    }

    if (settlement.status === 'partial') {
      findings.push({
        id,
        severity: 'high',
        category: 'pay',
        title: i18n.t('f.payDelta.titlePartial', { money: i18n.money(settlement.outstanding) }),
        detail:
          detail +
          i18n.t('f.payDelta.partialNote', {
            money: i18n.money(settlement.recovered),
            date: i18n.date(settlement.recoveredIn?.paymentDate ?? forecast.paymentDate),
          }),
        amount: settlement.outstanding,
        date: forecast.weekStart,
      });
      continue;
    }

    const short = settlement.status === 'short';
    findings.push({
      id,
      severity: short ? 'high' : 'medium',
      category: 'pay',
      title: short
        ? i18n.t('f.payDelta.titleShort', { money: i18n.money(grossDelta) })
        : i18n.t('f.payDelta.titleOver', { money: i18n.money(-grossDelta) }),
      detail: short ? detail : detail + i18n.t('f.payDelta.overNote'),
      amount: short ? settlement.outstanding : null,
      date: forecast.weekStart,
    });
  }

  return findings;
}

/** Back Pay cobrado que el desglose del payslip no explica.
 *
 *  Sin desglose la plata no se puede imputar a ninguna semana, asi que las
 *  semanas que la reclamaban seguirian figurando cortas para siempre. Es un
 *  problema de lectura del PDF, no del empleador: por eso va como `data`. */
export function checkBackPayBreakdown(payslips: readonly Payslip[], i18n: I18n): Finding[] {
  const findings: Finding[] = [];

  for (const payslip of payslips) {
    const { backPay } = payslip;
    if (!backPay) continue;
    if (Math.abs(backPay.unallocated) <= MONEY_TOLERANCE && backPay.unreadable.length === 0) continue;

    findings.push({
      id: `back-pay-breakdown:${payslip.periodStart}`,
      severity: 'medium',
      category: 'data',
      title: i18n.t('f.backPay.title', { money: i18n.money(backPay.unallocated) }),
      detail: i18n.t('f.backPay.detail', {
        range: i18n.range(payslip.periodStart, payslip.periodEnd),
        amount: i18n.money(backPay.amount),
        count: backPay.allocations.length,
        lines: backPay.unreadable.join(' | '),
      }),
      amount: null,
      date: payslip.periodStart,
    });
  }

  return findings;
}

/** Detalle por concepto de las semanas que no cierran. Se emite aparte del
 *  total para que el hallazgo grande diga cuanta plata y este diga por que. */
export function checkForecastLines(
  forecasts: readonly PayForecast[],
  payslips: readonly Payslip[],
  i18n: I18n,
): Finding[] {
  const byStart = new Map(payslips.map((slip) => [slip.periodStart, slip]));
  const findings: Finding[] = [];

  for (const forecast of forecasts) {
    const payslip = byStart.get(forecast.weekStart);
    if (!payslip) continue;

    // Una semana ya reintegrada no tiene nada que reclamar: el detalle concepto
    // por concepto solo repetiria lo que el payslip original decia.
    if (forecast.settlement.status === 'settled') continue;

    const differences = differingLabels(forecast, payslip, i18n);
    if (differences.length === 0) continue;

    const hoursDelta = Math.round((payslip.paidHours - forecast.paidHours) * 100) / 100;
    const hoursNote =
      Math.abs(hoursDelta) > HOURS_TOLERANCE
        ? i18n.t('f.payLines.hoursNote', {
            expected: forecast.paidHours,
            actual: payslip.paidHours,
          })
        : '';

    findings.push({
      id: `pay-lines:${forecast.weekStart}`,
      severity: 'medium',
      category: 'pay',
      title: i18n.t('f.payLines.title', { count: differences.length }),
      detail: i18n.t('f.payLines.detail', {
        range: i18n.range(forecast.weekStart, forecast.weekEnd),
        differences: differences.join('; '),
        hoursNote,
      }),
      amount: null,
      date: forecast.weekStart,
    });
  }

  return findings;
}

/** Contrasta la formula de retencion y la tasa de jubilacion contra cada payslip.
 *  Si alguna deja de reproducir la realidad, el pronostico esta mintiendo y hay
 *  que actualizar las tablas antes de creerle. */
export function checkPayrollModel(payslips: readonly Payslip[], i18n: I18n): Finding[] {
  const findings: Finding[] = [];
  const taxMisses: string[] = [];
  const superMisses: string[] = [];

  for (const payslip of payslips) {
    const payDate = payslip.paymentDate ?? payslip.periodEnd;

    // Los atrasados no se retienen con la tabla semanal: van por el Schedule 5,
    // que los reparte entre los periodos a los que corresponden. En el unico
    // caso observado (13-19 ago 2026, $348.36 de Back Pay) el empleador retuvo
    // $19, exactamente la tabla semanal sobre el bruto **sin** los atrasados;
    // aplicarla sobre el total daria $89 y una falsa alarma de modelo viejo.
    const taxBase = payslip.totalEarnings - (payslip.backPay?.amount ?? 0);
    const expectedTax = weeklyWithholding(taxBase, payDate);
    if (Math.abs(expectedTax - payslip.taxWithheld) > MONEY_TOLERANCE) {
      taxMisses.push(
        i18n.t('f.taxDrift.sample', {
          date: payslip.periodStart,
          gross: i18n.money(taxBase),
          expected: i18n.money(expectedTax),
          actual: i18n.money(payslip.taxWithheld),
        }),
      );
    }

    // El overtime esta exento de jubilacion; se lo descuenta de la base.
    const overtime = payslip.lines
      .filter((line) => /^Overtime/i.test(line.label))
      .reduce((sum, line) => sum + line.amount, 0);
    const expectedSuper = Math.round((payslip.totalEarnings - overtime) * SUPER_RATE * 100) / 100;
    if (Math.abs(expectedSuper - payslip.superannuation) > 0.02 && payslip.superannuation > 0) {
      superMisses.push(
        i18n.t('f.superDrift.sample', {
          date: payslip.periodStart,
          expected: i18n.money(expectedSuper),
          actual: i18n.money(payslip.superannuation),
        }),
      );
    }
  }

  if (taxMisses.length > 0) {
    findings.push({
      id: 'tax-model-drift',
      severity: 'medium',
      category: 'data',
      title: i18n.t('f.taxDrift.title', { count: taxMisses.length }),
      detail: i18n.t('f.taxDrift.detail', { samples: taxMisses.slice(0, 4).join(' | ') }),
      amount: null,
      date: null,
    });
  }

  if (superMisses.length > 0) {
    findings.push({
      id: 'super-model-drift',
      severity: 'high',
      category: 'pay',
      title: i18n.t('f.superDrift.title', {
        count: superMisses.length,
        rate: `${(SUPER_RATE * 100).toFixed(0)}%`,
      }),
      detail: i18n.t('f.superDrift.detail', { samples: superMisses.slice(0, 4).join(' | ') }),
      amount: null,
      date: null,
    });
  }

  return findings;
}

/** Semanas donde el payslip pago un feriado que no esta en el calendario local.
 *
 *  Pasa siempre con los feriados regionales: el Toowoomba Show Day cambia de
 *  fecha todos los años y no hay forma de calcularlo. Sin este aviso, el
 *  pronostico de esa semana se queda corto y nadie se entera. */
export function checkHolidayCalendar(
  payslips: readonly Payslip[],
  shifts: readonly Shift[],
  holidays: ReadonlySet<string>,
  i18n: I18n,
): Finding[] {
  const findings: Finding[] = [];

  for (const payslip of payslips) {
    const paidHoliday = payslip.lines
      .filter((line) => /^Public Holiday/i.test(line.label))
      .reduce((sum, line) => sum + (line.quantity ?? 0), 0);
    if (paidHoliday <= 0) continue;

    const worked = shifts
      .filter((shift) => shift.date >= payslip.periodStart && shift.date <= payslip.periodEnd)
      .map((shift) => shift.date);
    if (worked.some((date) => holidays.has(date))) continue;

    findings.push({
      id: `holiday-missing:${payslip.periodStart}`,
      severity: 'info',
      category: 'data',
      title: i18n.t('f.holidayMissing.title'),
      detail: i18n.t('f.holidayMissing.detail', {
        range: i18n.range(payslip.periodStart, payslip.periodEnd),
        hours: paidHoliday,
        dates: [...new Set(worked)].join(', '),
      }),
      amount: null,
      date: payslip.periodStart,
    });
  }

  return findings;
}

/** Aviso cuando el proximo pago cae en un año fiscal sin tabla cargada. */
export function checkTaxTableCoverage(next: PayForecast | null, i18n: I18n): Finding[] {
  if (!next || !isTaxTableStale(next.paymentDate)) return [];
  return [
    {
      id: 'tax-table-missing',
      severity: 'medium',
      category: 'data',
      title: i18n.t('f.taxTable.title'),
      detail: i18n.t('f.taxTable.detail', { date: i18n.date(next.paymentDate) }),
      amount: null,
      date: next.paymentDate,
    },
  ];
}
