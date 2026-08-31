import assert from 'node:assert/strict';
import { test } from 'node:test';
import { financialYearOf, payWeekOf, payWeeksBetween, startOfPayWeek } from '../shared/pay/calendar.ts';
import { isTaxTableStale, weeklyWithholding } from '../shared/pay/tax.ts';

test('la semana de pago va de jueves a miercoles y se cobra el jueves siguiente', () => {
  // Periodo real del payslip del 6 al 12 de agosto de 2026, pagado el 13.
  const week = payWeekOf('2026-08-09');
  assert.equal(week.start, '2026-08-06');
  assert.equal(week.end, '2026-08-12');
  assert.equal(week.paymentDate, '2026-08-13');
});

test('un jueves ya es el inicio de su propia semana', () => {
  assert.equal(startOfPayWeek('2026-08-06'), '2026-08-06');
  assert.equal(startOfPayWeek('2026-08-05'), '2026-07-30');
});

test('las semanas de un rango no se pisan ni dejan huecos', () => {
  const weeks = payWeeksBetween('2026-08-01', '2026-08-25');
  assert.deepEqual(
    weeks.map((week) => week.start),
    ['2026-07-30', '2026-08-06', '2026-08-13', '2026-08-20'],
  );
});

test('el año fiscal australiano arranca el 1 de julio', () => {
  assert.equal(financialYearOf('2026-06-30'), '2025-26');
  assert.equal(financialYearOf('2026-07-01'), '2026-27');
  assert.equal(financialYearOf('2027-01-15'), '2026-27');
});

test('reproduce la retencion de payslips reales del año fiscal 2025-26', () => {
  // bruto -> PAYG retenido, tal cual figuran en los PDF.
  const cases: ReadonlyArray<readonly [number, number]> = [
    [186.28, 0],
    [379.72, 3],
    [484.92, 20],
    [634.46, 56],
    [718.86, 72],
    [937.71, 123],
    [1241.0, 221],
    [1407.02, 274],
  ];
  for (const [gross, expected] of cases) {
    assert.equal(weeklyWithholding(gross, '2026-04-16'), expected, `bruto ${gross}`);
  }
});

test('reproduce la retencion de payslips reales del año fiscal 2026-27', () => {
  const cases: ReadonlyArray<readonly [number, number, string]> = [
    [244.75, 0, '2026-07-16'],
    [970.62, 128, '2026-08-06'],
    [1020.05, 144, '2026-07-30'],
    [1102.59, 171, '2026-07-23'],
    [1740.52, 375, '2026-08-13'],
  ];
  for (const [gross, expected, payDate] of cases) {
    assert.equal(weeklyWithholding(gross, payDate), expected, `bruto ${gross}`);
  }
});

test('reproduce la tabla semanal publicada para 2026-27', () => {
  const cases: ReadonlyArray<readonly [number, number]> = [
    [400, 6],
    [450, 13],
    [500, 21],
    [550, 30],
    [600, 42],
    [650, 55],
    [700, 65],
    [750, 74],
    [800, 83],
    [900, 106],
    [1000, 138],
  ];
  for (const [gross, expected] of cases) {
    assert.equal(weeklyWithholding(gross, '2026-09-03'), expected, `bruto ${gross}`);
  }
});

test('la baja de la tasa minima hace que 2026-27 retenga menos que 2025-26', () => {
  assert.ok(weeklyWithholding(1000, '2026-09-03') < weeklyWithholding(1000, '2026-06-04'));
});

test('un bruto por debajo del umbral no retiene nada', () => {
  assert.equal(weeklyWithholding(0, '2026-08-13'), 0);
  assert.equal(weeklyWithholding(300, '2026-08-13'), 0);
});

test('avisa cuando el pago cae en un año fiscal sin tabla cargada', () => {
  assert.equal(isTaxTableStale('2026-08-13'), false);
  assert.equal(isTaxTableStale('2027-08-12'), true);
});
