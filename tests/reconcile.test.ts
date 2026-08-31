import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Payslip, Shift } from '../shared/types.ts';
import { createI18n } from '../shared/i18n/index.ts';
import { analyseSpans, checkBrokenShifts } from '../shared/reconcile/broken-shift.ts';
import { extractKm, reconcileKm } from '../shared/reconcile/km.ts';
import { checkPaidHours } from '../shared/reconcile/payslip-vs-roster.ts';

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
