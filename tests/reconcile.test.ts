import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Payslip, Shift } from '../shared/types.js';
import { createI18n } from '../shared/i18n/index.js';
import { analyseSpans, checkBrokenShifts } from '../shared/reconcile/broken-shift.js';
import { extractKm, reconcileKm } from '../shared/reconcile/km.js';
import { checkPaidHours } from '../shared/reconcile/payslip-vs-roster.js';

const I18N = createI18n('es');

function shift(date: string, start: number, end: number, comment: string | null = null): Shift {
  return {
    id: `${date}-${start}`,
    source: 'timesheet',
    date,
    startMinute: start * 60,
    endMinute: end * 60,
    area: null,
    employeeComment: comment,
    approved: true,
    kmDeclared: extractKm(comment),
  };
}

function payslip(overrides: Partial<Payslip> = {}): Payslip {
  return {
    file: 'test.pdf',
    periodStart: '2026-08-06',
    periodEnd: '2026-08-12',
    paymentDate: '2026-08-13',
    totalEarnings: 1000,
    netPay: 800,
    lines: [],
    paidHours: 0,
    sleepoverCount: 0,
    sleepoverAmount: 0,
    travelCostsPaid: 0,
    nightHours: 0,
    taxWithheld: 0,
    superannuation: 0,
    bankPayment: 800,
    backPay: null,
    arithmeticMismatch: false,
    ...overrides,
  };
}

test('extrae los km del comentario del timesheet', () => {
  assert.equal(extractKm('Drove to appointment, 10.9 km'), 10.9);
  assert.equal(extractKm('18 kms return'), 18);
  assert.equal(extractKm('7,4 km'), 7.4);
  assert.equal(extractKm('drove to the shops'), null);
  assert.equal(extractKm(null), null);
});

test('reclama los km declarados y no pagados', () => {
  const shifts = [shift('2026-08-07', 9, 12, 'Took client out, 10 km')];
  const result = reconcileKm([payslip({ travelCostsPaid: 0 })], shifts, 0.99, I18N);
  assert.equal(result.owed, 10);
  assert.equal(result.moneyOwed, 9.9);
  assert.equal(result.findings.filter((finding) => finding.category === 'km').length >= 1, true);
});

test('no reclama nada si los km se pagaron completos', () => {
  const shifts = [shift('2026-08-07', 9, 12, '10 km')];
  const result = reconcileKm([payslip({ travelCostsPaid: 9.9 })], shifts, 0.99, I18N);
  assert.equal(result.owed, 0);
  assert.equal(result.moneyOwed, 0);
});

test('detecta el lapso mayor a 12 h entre bloques del mismo dia', () => {
  const shifts = [shift('2026-08-17', 6, 9), shift('2026-08-17', 20, 30)];
  const [span] = analyseSpans(shifts);
  assert.equal(span?.spanHours, 24);
  assert.equal(span?.exceedsSpan, true);
  assert.equal(checkBrokenShifts(shifts, I18N).length, 1);
});

test('un dia con dos bloques dentro de las 12 h si es turno partido', () => {
  const shifts = [shift('2026-08-17', 6, 9), shift('2026-08-17', 14, 17)];
  const [span] = analyseSpans(shifts);
  assert.equal(span?.spanHours, 11);
  assert.equal(span?.exceedsSpan, false);
  assert.deepEqual(checkBrokenShifts(shifts, I18N), []);
});

// La diferencia entre horas pagadas y horas del roster ya no se reporta aca:
// la cubre `pay/findings.ts`, que ademas dice cuanta plata hay en juego.
// Ver tests/pay-findings.test.ts.

test('las Night Hours se reportan como impacto en la visa', () => {
  const shifts = [shift('2026-08-07', 9, 15)];
  const findings = checkPaidHours([payslip({ paidHours: 6, nightHours: 2 })], shifts, I18N);
  const night = findings.find((finding) => finding.id.startsWith('night:'));
  assert.equal(night?.severity, 'critical');
  assert.equal(night?.category, 'visa');
});

test('un reintegro que llega en el payslip siguiente no se reclama dos veces', () => {
  // La semana del 6 declara 10 km y cobra $0; la del 13 no declara ninguno y
  // cobra $9.90. Es el mismo reintegro, llegado tarde: no se debe nada.
  const shifts = [shift('2026-08-07', 9, 12, '10 km')];
  const payslips = [
    payslip({ travelCostsPaid: 0 }),
    payslip({
      periodStart: '2026-08-13',
      periodEnd: '2026-08-19',
      paymentDate: '2026-08-20',
      travelCostsPaid: 9.9,
    }),
  ];
  const result = reconcileKm(payslips, shifts, 0.99, I18N);

  assert.equal(result.owed, 0);
  assert.equal(result.moneyOwed, 0);

  const claim = result.findings.find((finding) => finding.id === 'km:2026-08-06');
  assert.equal(claim?.severity, 'info', 'el hallazgo queda como constancia, no como reclamo');
  assert.equal(claim?.amount, null);
});

test('un reintegro tardio parcial deja abierto solo el resto', () => {
  const shifts = [shift('2026-08-07', 9, 12, '10 km')];
  const payslips = [
    payslip({ travelCostsPaid: 0 }),
    payslip({
      periodStart: '2026-08-13',
      periodEnd: '2026-08-19',
      paymentDate: '2026-08-20',
      travelCostsPaid: 3.96,
    }),
  ];
  const result = reconcileKm(payslips, shifts, 0.99, I18N);

  assert.equal(result.owed, 6);
  assert.equal(result.moneyOwed, 5.94);

  const claim = result.findings.find((finding) => finding.id === 'km:2026-08-06');
  assert.equal(claim?.severity, 'high');
  assert.equal(claim?.amount, 5.94);
});

test('el orden de los payslips no cambia la imputacion del reintegro tardio', () => {
  const shifts = [shift('2026-08-07', 9, 12, '10 km')];
  const later = payslip({
    periodStart: '2026-08-13',
    periodEnd: '2026-08-19',
    paymentDate: '2026-08-20',
    travelCostsPaid: 9.9,
  });
  const result = reconcileKm([later, payslip({ travelCostsPaid: 0 })], shifts, 0.99, I18N);

  assert.equal(result.owed, 0);
});

test('cobrar km sin haberlos declarado no genera un credito a favor', () => {
  // Sin ninguna semana corta previa el excedente no se imputa a nada: el total
  // adeudado no puede quedar en negativo ni compensar reclamos futuros.
  const shifts = [shift('2026-08-07', 9, 12, '10 km')];
  const payslips = [
    payslip({ travelCostsPaid: 19.8 }),
    payslip({
      periodStart: '2026-08-13',
      periodEnd: '2026-08-19',
      paymentDate: '2026-08-20',
      travelCostsPaid: 0,
    }),
  ];
  const result = reconcileKm(payslips, shifts, 0.99, I18N);

  assert.equal(result.owed, 0);
  assert.equal(result.moneyOwed, 0);
});
