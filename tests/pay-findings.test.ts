import assert from 'node:assert/strict';
import { test } from 'node:test';
import { payWeekOf } from '../shared/pay/calendar.ts';
import { createI18n } from '../shared/i18n/index.ts';
import {
  checkForecastAgainstPayslips,
  checkForecastLines,
  checkHolidayCalendar,
  checkPayrollModel,
} from '../shared/pay/findings.ts';
import { forecastWeek } from '../shared/pay/forecast.ts';
import { buildRateTimeline, rateCardFor } from '../shared/pay/rates.ts';
import type { Payslip, PayslipLine, RateCard, Shift } from '../shared/types.ts';

function shift(date: string, start: number, end: number): Shift {
  return {
    id: `${date}-${start}`,
    source: 'timesheet',
    date,
    startMinute: start * 60,
    endMinute: end * 60,
    area: null,
    employeeComment: null,
    approved: true,
    kmDeclared: null,
  };
}

function payslip(overrides: Partial<Payslip> = {}): Payslip {
  return {
    file: 'test.pdf',
    periodStart: '2026-08-06',
    periodEnd: '2026-08-12',
    paymentDate: '2026-08-13',
    totalEarnings: 0,
    netPay: 0,
    lines: [],
    paidHours: 0,
    sleepoverCount: 0,
    sleepoverAmount: 0,
    travelCostsPaid: 0,
    nightHours: 0,
    taxWithheld: 0,
    superannuation: 0,
    bankPayment: 0,
    backPay: null,
    arithmeticMismatch: false,
    ...overrides,
  };
}

function hoursLine(label: string, quantity: number, rate: number): PayslipLine {
  return { label, kind: 'hours', quantity, rate, amount: Math.round(quantity * rate * 100) / 100 };
}

const I18N = createI18n('es');

const RATES: RateCard = {
  effectiveFrom: '2026-07-09',
  hourly: {
    ordinary: 34.44,
    evening: 37.88,
    saturday: 48.21,
    sunday: 61.99,
    holiday: 72.33,
    night: 36.82,
    overtime: 0,
  },
  sleepover: 62.87,
  brokenShift: 21.81,
  firstAid: 0.56,
};

/** Estimacion de una semana con un unico turno de 6 h ordinarias. */
function forecastOf(actual: Payslip | null) {
  const week = payWeekOf('2026-08-06');
  return forecastWeek({
    week,
    shifts: [shift('2026-08-07', 9, 15)],
    rates: RATES,
    holidays: new Set<string>(),
    kmRate: 0.99,
    payslip: actual,
  });
}

test('reporta la plata faltante cuando el payslip paga menos que el roster', () => {
  // 6 h ordinarias son $206.64 mas $3.36 de primeros auxilios.
  const actual = payslip({ totalEarnings: 140, netPay: 140, bankPayment: 140 });
  const findings = checkForecastAgainstPayslips([forecastOf(actual)], I18N);

  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.severity, 'high');
  assert.equal(findings[0]?.category, 'pay');
  assert.ok((findings[0]?.amount ?? 0) > 0, 'deberia cuantificar el faltante');
});

test('no reporta nada cuando la diferencia es redondeo de la nomina', () => {
  const forecast = forecastOf(null);
  const actual = payslip({ totalEarnings: forecast.gross + 0.4 });
  assert.deepEqual(checkForecastAgainstPayslips([forecastOf(actual)], I18N), []);
});

test('detalla que concepto no coincide', () => {
  const actual = payslip({
    totalEarnings: 140,
    paidHours: 4,
    lines: [hoursLine('Ordinary Hours', 4, 34.44)],
  });
  const findings = checkForecastLines([forecastOf(actual)], [actual], I18N);

  assert.equal(findings.length, 1);
  assert.match(findings[0]?.detail ?? '', /Ordinary Hours/);
});

test('el nombre del feriado no cuenta como concepto distinto', () => {
  // El payslip escribe `Public Holiday (Labour Day)` y la estimacion no puede
  // saber cual feriado es. Sin normalizar, cada feriado daria dos diferencias.
  const week = payWeekOf('2026-05-04');
  const forecast = forecastWeek({
    week,
    shifts: [shift('2026-05-04', 17, 22)],
    rates: RATES,
    holidays: new Set(['2026-05-04']),
    kmRate: 0.99,
    payslip: null,
  });
  const actual = payslip({
    periodStart: week.start,
    periodEnd: week.end,
    lines: [
      hoursLine('Public Holiday (Labour Day)', 5, 72.33),
      { label: 'First Aid Allowance', kind: 'allowance', quantity: 5, rate: 0.56, amount: 2.8 },
    ],
  });

  assert.deepEqual(checkForecastLines([forecast], [actual], I18N), []);
});

test('avisa cuando el payslip paga un feriado que no esta en el calendario', () => {
  const actual = payslip({
    lines: [hoursLine('Public Holiday', 4, 72.33)],
  });
  const findings = checkHolidayCalendar(
    [actual],
    [shift('2026-08-07', 9, 15)],
    new Set<string>(),
    I18N,
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.category, 'data');
  assert.match(findings[0]?.detail ?? '', /2026-08-07/);
});

test('no avisa si el feriado pagado ya esta en el calendario', () => {
  const actual = payslip({ lines: [hoursLine('Public Holiday', 4, 72.33)] });
  const findings = checkHolidayCalendar(
    [actual],
    [shift('2026-08-07', 9, 15)],
    new Set(['2026-08-07']),
    I18N,
  );
  assert.deepEqual(findings, []);
});

test('avisa si la formula de retencion deja de reproducir un payslip', () => {
  const bad = payslip({ totalEarnings: 1000, taxWithheld: 999, superannuation: 120 });
  const findings = checkPayrollModel([bad], I18N);
  assert.ok(findings.some((finding) => finding.id === 'tax-model-drift'));
});

test('avisa si el aporte jubilatorio no da el 12%', () => {
  const bad = payslip({ totalEarnings: 1000, taxWithheld: 138, superannuation: 90 });
  const findings = checkPayrollModel([bad], I18N);
  assert.ok(findings.some((finding) => finding.id === 'super-model-drift'));
});

test('las tarifas se leen del payslip y arrastran las que no cambian', () => {
  const timeline = buildRateTimeline([
    payslip({
      periodStart: '2026-06-04',
      lines: [hoursLine('Ordinary Hours', 10, 32.88), hoursLine('Evening Hours', 2, 36.16)],
    }),
    payslip({
      periodStart: '2026-07-09',
      lines: [hoursLine('Ordinary Hours', 10, 34.44)],
    }),
  ]);

  assert.equal(rateCardFor(timeline, '2026-06-30').hourly.ordinary, 32.88);
  assert.equal(rateCardFor(timeline, '2026-07-16').hourly.ordinary, 34.44);
  // La tarifa de tarde no aparece en el segundo payslip: se arrastra la anterior.
  assert.equal(rateCardFor(timeline, '2026-07-16').hourly.evening, 36.16);
  // Una fecha futura usa las ultimas tarifas conocidas.
  assert.equal(rateCardFor(timeline, '2027-01-01').hourly.ordinary, 34.44);
});
