import assert from 'node:assert/strict';
import { test } from 'node:test';
import { breakdownWeek, payableHours } from '../shared/pay/classify.ts';
import { payWeekOf } from '../shared/pay/calendar.ts';
import { forecastWeek } from '../shared/pay/forecast.ts';
import type { RateCard, Shift } from '../shared/types.ts';

/** Turnos con la forma de los reales: `end` puede pasar de 1440 si cruza medianoche. */
function shift(date: string, start: number, end: number, id = `${date}-${start}`): Shift {
  return {
    id,
    source: 'roster',
    date,
    startMinute: Math.round(start * 60),
    endMinute: Math.round(end * 60),
    area: null,
    employeeComment: null,
    approved: true,
    kmDeclared: null,
  };
}

/** Tarifas vigentes desde el 1 de julio de 2026, tomadas de un payslip real. */
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

const NO_HOLIDAYS = new Set<string>();

test('la franja 22:00-06:00 no genera horas pagables', () => {
  assert.deepEqual(payableHours(20 * 60, 30 * 60), { ordinary: 0, evening: 2 });
  assert.deepEqual(payableHours(6 * 60, 9 * 60), { ordinary: 3, evening: 0 });
});

test('un turno 20:00-08:00 paga 2 h de tarde y 2 h ordinarias del dia siguiente', () => {
  assert.deepEqual(payableHours(20 * 60, 32 * 60), { ordinary: 2, evening: 2 });
});

test('la categoria la fija el dia en que arranca el turno, no el dia de reloj', () => {
  // Viernes 16:00 al sabado 09:00: las 3 h del sabado se pagaron como ordinarias.
  // Verificado contra el payslip de la semana del 12 al 18 de marzo de 2026.
  const week = payWeekOf('2026-03-13');
  const result = breakdownWeek([shift('2026-03-13', 16, 33)], week.start, week.end, NO_HOLIDAYS);
  assert.equal(result.hours.ordinary, 7);
  assert.equal(result.hours.evening, 2);
  assert.equal(result.hours.saturday, 0);
  assert.equal(result.sleepovers, 1);
});

test('un feriado se lleva todas las horas del turno, incluido el recargo de tarde', () => {
  // Lunes 4 de mayo de 2026, Labour Day: 17:30-06:00 dio 4.5 h de Public Holiday.
  const week = payWeekOf('2026-05-04');
  const result = breakdownWeek(
    [shift('2026-05-04', 17.5, 30)],
    week.start,
    week.end,
    new Set(['2026-05-04']),
  );
  assert.equal(result.hours.holiday, 4.5);
  assert.equal(result.hours.evening, 0);
  assert.equal(result.hours.ordinary, 0);
});

test('dos bloques pegados son un turno seguido, no un turno partido', () => {
  const week = payWeekOf('2026-08-04');
  const result = breakdownWeek(
    [shift('2026-08-04', 16, 20), shift('2026-08-04', 20, 30)],
    week.start,
    week.end,
    NO_HOLIDAYS,
  );
  assert.equal(result.brokenShiftDays, 0);
});

test('dos bloques con hueco real si son un turno partido', () => {
  const week = payWeekOf('2026-08-04');
  const result = breakdownWeek(
    [shift('2026-08-04', 6, 9), shift('2026-08-04', 16, 20)],
    week.start,
    week.end,
    NO_HOLIDAYS,
  );
  assert.equal(result.brokenShiftDays, 1);
});

test('pasadas 10 h seguidas el excedente va a overtime sobre la tarifa del dia', () => {
  // Domingo 9 de agosto de 2026: 11:00-20:00 y 20:00-06:00 seguidos dan 11 h
  // pagables. El payslip liquido 10 h dominicales y 1 h de overtime a $92.99.
  const week = payWeekOf('2026-08-09');
  const result = breakdownWeek(
    [shift('2026-08-09', 11, 20), shift('2026-08-09', 20, 30)],
    week.start,
    week.end,
    NO_HOLIDAYS,
  );
  assert.equal(result.hours.sunday, 10);
  assert.deepEqual(result.overtime, [{ base: 'sunday', hours: 1 }]);
});

test('reproduce la liquidacion completa de la semana del 6 al 12 de agosto de 2026', () => {
  // Turnos reales de Deputy contra el payslip real, salvo 2 h que el empleador
  // no pago (el hallazgo esta cubierto aparte).
  const shifts = [
    shift('2026-08-06', 20, 30),
    shift('2026-08-07', 8, 10),
    shift('2026-08-07', 16, 20),
    shift('2026-08-07', 20, 30),
    shift('2026-08-08', 8, 10),
    shift('2026-08-09', 11, 20),
    shift('2026-08-09', 20, 30),
    shift('2026-08-10', 13, 15),
    shift('2026-08-11', 20, 32),
    shift('2026-08-12', 16, 20),
  ];
  const week = payWeekOf('2026-08-06');
  const forecast = forecastWeek({
    week,
    shifts,
    rates: RATES,
    holidays: NO_HOLIDAYS,
    kmRate: 0.99,
    payslip: null,
  });

  const amountOf = (label: string): number =>
    forecast.lines.find((line) => line.label === label)?.amount ?? 0;

  assert.equal(amountOf('Evening Hours'), 227.28);
  assert.equal(amountOf('Saturday Hours'), 96.42);
  assert.equal(amountOf('Sunday Hours'), 619.9);
  assert.equal(amountOf('Overtime Hours (exempt from super)'), 92.99);
  assert.equal(amountOf('Sleepover Allowance'), 251.48);
  assert.equal(amountOf('Broken Shift Allowance'), 21.81);
  assert.equal(forecast.paymentDate, '2026-08-13');

  // El overtime esta exento de jubilacion: la base baja $92.99.
  assert.equal(
    forecast.superannuation,
    Math.round((forecast.gross - 92.99) * 12) / 100,
  );
  assert.equal(forecast.net, Math.round((forecast.gross - forecast.tax) * 100) / 100);
});

test('los viaticos quedan fuera del bruto pero entran al banco', () => {
  const week = payWeekOf('2026-08-06');
  const withKm: Shift = { ...shift('2026-08-07', 9, 12), kmDeclared: 10 };
  const forecast = forecastWeek({
    week,
    shifts: [withKm],
    rates: RATES,
    holidays: NO_HOLIDAYS,
    kmRate: 0.99,
    payslip: null,
  });

  assert.equal(forecast.reimbursements, 9.9);
  assert.equal(forecast.gross, Math.round((3 * 34.44 + 3 * 0.56) * 100) / 100);
  assert.equal(forecast.bankPayment, Math.round((forecast.net + 9.9) * 100) / 100);
});

test('una semana sin turnos no inventa plata', () => {
  const week = payWeekOf('2026-09-10');
  const forecast = forecastWeek({
    week,
    shifts: [],
    rates: RATES,
    holidays: NO_HOLIDAYS,
    kmRate: 0.99,
    payslip: null,
  });

  assert.equal(forecast.basis, 'empty');
  assert.equal(forecast.gross, 0);
  assert.equal(forecast.tax, 0);
  assert.equal(forecast.bankPayment, 0);
  assert.equal(forecast.lines.length, 0);
});
