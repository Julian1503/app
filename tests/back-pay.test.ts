/** El Back Pay es el unico mecanismo por el que un reclamo aceptado vuelve a
 *  entrar, y llega desordenado: la plata se cobra en la semana en curso pero
 *  pertenece a semanas viejas. Estos tests fijan las dos mitades del arreglo,
 *  que se rompen de formas distintas: leer el desglose del PDF y volver a
 *  imputar la plata a la semana que le corresponde. */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAllocation, readBackPay } from '../server/payslips/back-pay.js';
import type { TextRow } from '../server/payslips/pdf-text.js';
import { createI18n } from '../shared/i18n/index.js';
import { payWeekOf } from '../shared/pay/calendar.js';
import { checkForecastAgainstPayslips } from '../shared/pay/findings.js';
import { forecastWeek } from '../shared/pay/forecast.js';
import { creditsByWeek, settle, summariseBackPay } from '../shared/pay/settlement.js';
import { FALLBACK_RATES } from '../shared/pay/rules.js';
import type {
  BackPayAllocation,
  IsoDate,
  PayForecast,
  Payslip,
  RateCard,
  Settlement,
} from '../shared/types.js';

const I18N = createI18n('es');

function row(text: string): TextRow {
  return { y: 0, tokens: [], text };
}

function payslip(overrides: Partial<Payslip> = {}): Payslip {
  return {
    file: 'test.pdf',
    periodStart: '2026-08-13',
    periodEnd: '2026-08-19',
    paymentDate: '2026-08-20',
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

function allocation(overrides: Partial<BackPayAllocation> = {}): BackPayAllocation {
  return { periodStart: '2026-02-12', periodEnd: '2026-02-18', hours: 4, amount: 131.52, ...overrides };
}

// --- Lectura del desglose -------------------------------------------------

test('lee un tramo con mes y año una sola vez, al final', () => {
  assert.deepEqual(parseAllocation('12th to 18th February 2026 4 hours $131.52'), {
    periodStart: '2026-02-12',
    periodEnd: '2026-02-18',
    hours: 4,
    amount: 131.52,
  });
});

test('el ordinal del dia de cierre puede faltar', () => {
  // Renglon real del payslip del 13 al 19 de agosto de 2026: el empleador
  // escribe "6th to 12 August", sin el "th" del cierre.
  assert.deepEqual(parseAllocation('6th to 12 August 2026 2 hours $68.88'), {
    periodStart: '2026-08-06',
    periodEnd: '2026-08-12',
    hours: 2,
    amount: 68.88,
  });
});

test('un tramo con horas fraccionadas conserva los decimales', () => {
  assert.equal(parseAllocation('23rd to 29th April 2026 3.5 hours $115.08')?.hours, 3.5);
});

test('un tramo que cambia de mes toma el mes de cada punta', () => {
  const parsed = parseAllocation('30th April to 6th May 2026 5 hours $164.40');
  assert.equal(parsed?.periodStart, '2026-04-30');
  assert.equal(parsed?.periodEnd, '2026-05-06');
});

test('un tramo que cruza el año nuevo arranca el año anterior', () => {
  // Sin esto, "31st December to 6th January 2026" quedaria empezando despues de
  // terminar y la semana no existiria.
  const parsed = parseAllocation('31st December to 6th January 2026 3 hours $98.64');
  assert.equal(parsed?.periodStart, '2025-12-31');
  assert.equal(parsed?.periodEnd, '2026-01-06');
});

test('un renglon que no es un tramo no se interpreta', () => {
  assert.equal(parseAllocation('Back pay is broken down as below:'), null);
  assert.equal(parseAllocation('Please contact payroll with any questions'), null);
});

test('el desglose puede continuar en la pagina siguiente', () => {
  // El bloque MESSAGES se corta a mitad de hoja y el resto queda en una pagina
  // sin encabezado. Descartarla dejaria plata sin imputar.
  const backPay = readBackPay(
    348.36,
    [
      row('MESSAGES'),
      row('Back pay is broken down as below:'),
      row('12th to 18th February 2026 4 hours $131.52'),
      row('9th to 15th April 2026 1 hour $32.88'),
      row('23rd to 29th April 2026 3.5 hours $115.08'),
    ],
    [row('6th to 12 August 2026 2 hours $68.88')],
  );

  assert.equal(backPay?.allocations.length, 4);
  assert.equal(backPay?.unallocated, 0);
  assert.deepEqual(backPay?.unreadable, []);
});

test('lo que el desglose no explica queda a la vista, no repartido', () => {
  const backPay = readBackPay(
    200,
    [row('MESSAGES'), row('Back pay is broken down as below:'), row('12th to 18th February 2026 4 hours $131.52')],
    [],
  );

  assert.equal(backPay?.unallocated, 68.48);
});

test('un renglon ilegible del desglose se reporta en vez de perderse', () => {
  const backPay = readBackPay(
    131.52,
    [
      row('MESSAGES'),
      row('Back pay is broken down as below:'),
      row('February 2026 adjustment, see attached'),
    ],
    [],
  );

  assert.deepEqual(backPay?.unreadable, ['February 2026 adjustment, see attached']);
});

test('un payslip sin Back Pay no tiene desglose', () => {
  assert.equal(readBackPay(0, [row('MESSAGES'), row('Have a nice week')], []), null);
});

// --- Imputacion a la semana correcta --------------------------------------

test('el reintegro se acredita a la semana que lo genero, no a la que lo cobro', () => {
  const credits = creditsByWeek([
    payslip({
      backPay: { amount: 131.52, allocations: [allocation()], unallocated: 0, unreadable: [] },
    }),
  ]);

  assert.equal(credits.get('2026-08-13'), undefined);
  assert.deepEqual(credits.get('2026-02-12'), {
    amount: 131.52,
    periodStart: '2026-08-13',
    paymentDate: '2026-08-20',
  });
});

test('un tramo que cita un dia suelto cae igual en su semana de pago', () => {
  const credits = creditsByWeek([
    payslip({
      backPay: {
        amount: 50,
        // El lunes 16 de febrero cae dentro de la semana que arranca el jueves 12.
        allocations: [allocation({ periodStart: '2026-02-16', periodEnd: '2026-02-16', amount: 50 })],
        unallocated: 0,
        unreadable: [],
      },
    }),
  ]);

  assert.equal(credits.get('2026-02-12')?.amount, 50);
});

test('dos reintegros para la misma semana se suman', () => {
  const credits = creditsByWeek([
    payslip({
      periodStart: '2026-06-04',
      periodEnd: '2026-06-10',
      paymentDate: '2026-06-11',
      backPay: { amount: 30, allocations: [allocation({ amount: 30 })], unallocated: 0, unreadable: [] },
    }),
    payslip({
      backPay: { amount: 101.52, allocations: [allocation({ amount: 101.52 })], unallocated: 0, unreadable: [] },
    }),
  ]);

  const credit = credits.get('2026-02-12');
  assert.equal(credit?.amount, 131.52);
  // Manda el ultimo: es el que cierra la cuenta y el que hay que citar.
  assert.equal(credit?.paymentDate, '2026-08-20');
});

// --- Estados ---------------------------------------------------------------

test('un faltante cubierto entero queda saldado', () => {
  const result = settle(131.52, { amount: 131.52, periodStart: '2026-08-13', paymentDate: '2026-08-20' }, 0);
  assert.equal(result.status, 'settled');
  assert.equal(result.outstanding, 0);
  assert.equal(result.recoveredIn?.paymentDate, '2026-08-20');
});

test('un faltante cubierto a medias sigue abierto por el resto', () => {
  const result = settle(158.61, { amount: 115.08, periodStart: '2026-08-13', paymentDate: '2026-08-20' }, 0);
  assert.equal(result.status, 'partial');
  assert.equal(result.outstanding, 43.53);
});

test('un reintegro de mas no deja la semana en positivo', () => {
  // El excedente no es plata de esta semana: imputarlo aca la haria aparecer
  // pagada de mas y taparia el error de imputacion.
  const result = settle(50, { amount: 200, periodStart: '2026-08-13', paymentDate: '2026-08-20' }, 0);
  assert.equal(result.recovered, 50);
  assert.equal(result.outstanding, 0);
});

test('sin payslip la semana esta pendiente, no saldada', () => {
  assert.equal(settle(null, null, 0).status, 'pending');
});

// --- Efecto sobre la semana que cobra el reintegro -------------------------

const RATES: RateCard = {
  effectiveFrom: '2026-07-09',
  hourly: {
    ordinary: FALLBACK_RATES.ordinary,
    evening: FALLBACK_RATES.evening,
    saturday: FALLBACK_RATES.saturday,
    sunday: FALLBACK_RATES.sunday,
    holiday: FALLBACK_RATES.holiday,
    overtime: FALLBACK_RATES.ordinary * 1.5,
    night: FALLBACK_RATES.night,
  },
  sleepover: FALLBACK_RATES.sleepover,
  brokenShift: FALLBACK_RATES.brokenShift,
  firstAid: FALLBACK_RATES.firstAid,
};

/** Semana sin turnos cuyo payslip solo liquida el reintegro de otras semanas.
 *  Tomado literal, el payslip diria que pagaron $348.36 de mas. */
function carrierForecast() {
  return forecastWeek({
    week: payWeekOf('2026-08-13'),
    shifts: [],
    rates: RATES,
    holidays: new Set<string>(),
    kmRate: 0.99,
    payslip: payslip({
      totalEarnings: 348.36,
      backPay: {
        amount: 348.36,
        allocations: [allocation({ amount: 348.36 })],
        unallocated: 0,
        unreadable: [],
      },
      lines: [{ label: 'Back Pay', kind: 'backpay', quantity: null, rate: null, amount: 348.36 }],
    }),
    backPayCredit: null,
  });
}

test('la semana que cobra el reintegro no aparece pagada de mas', () => {
  const forecast = carrierForecast();
  // Sin descontar el Back Pay, esta semana diria "+$348.36" y ademas taparia
  // cualquier faltante propio.
  assert.equal(forecast.settlement.carried, 348.36);
  assert.equal(forecast.grossDelta, 0);
  assert.equal(forecast.settlement.status, 'matches');
});

test('el reintegro cobrado no genera un hallazgo de pago de mas', () => {
  assert.deepEqual(checkForecastAgainstPayslips([carrierForecast()], I18N), []);
});

// --- Hallazgos -------------------------------------------------------------

function shortWeek(recovered: number) {
  const forecast = forecastWeek({
    week: payWeekOf('2026-02-12'),
    shifts: [],
    rates: RATES,
    holidays: new Set<string>(),
    kmRate: 0.99,
    payslip: payslip({
      periodStart: '2026-02-12',
      periodEnd: '2026-02-18',
      paymentDate: '2026-02-19',
      totalEarnings: -133.68,
    }),
    backPayCredit:
      recovered > 0
        ? { amount: recovered, periodStart: '2026-08-13', paymentDate: '2026-08-20' }
        : null,
  });
  return checkForecastAgainstPayslips([forecast], I18N);
}

test('una semana saldada deja de pedir plata y pasa a informativa', () => {
  const [finding] = shortWeek(133.68);
  assert.equal(finding?.severity, 'info');
  assert.equal(finding?.amount, null);
  assert.match(finding?.title ?? '', /Recuperaste/);
});

test('una semana saldada a medias reclama solo lo que falta', () => {
  const [finding] = shortWeek(100);
  assert.equal(finding?.severity, 'high');
  assert.equal(finding?.amount, 33.68);
});

test('una semana sin reintegro reclama todo el faltante', () => {
  const [finding] = shortWeek(0);
  assert.equal(finding?.severity, 'high');
  assert.equal(finding?.amount, 133.68);
});

// --- Resumen del reclamo ---------------------------------------------------

/** Semana con su liquidacion ya resuelta, para armar el resumen sin volver a
 *  pasar por el pronostico entero. */
function week(weekStart: IsoDate, settlement: Partial<Settlement>): PayForecast {
  return {
    weekStart,
    weekEnd: weekStart,
    paymentDate: weekStart,
    basis: 'payslip',
    lines: [],
    paidHours: 0,
    visaHours: 0,
    gross: 0,
    tax: 0,
    net: 0,
    reimbursements: 0,
    bankPayment: 0,
    superannuation: 0,
    actual: null,
    grossDelta: 0,
    settlement: {
      status: 'matches',
      recovered: 0,
      outstanding: 0,
      recoveredIn: null,
      carried: 0,
      ...settlement,
    },
  };
}

test('sin ningun reintegro cobrado el resumen no tiene fecha que citar', () => {
  // El faltante se sigue contando igual: es la unica cuenta de cuanto falta. Lo
  // que queda vacio es la fecha, y de eso se agarra la UI para no mostrar un
  // cartel que diga "recuperaste $0" tapando los reclamos abiertos.
  const rollup = summariseBackPay([week('2026-02-12', { status: 'short', outstanding: 131.5 })]);

  assert.equal(rollup.lastPaymentDate, null);
  assert.equal(rollup.recovered, 0);
  assert.equal(rollup.outstanding, 131.5);
  assert.equal(rollup.weeksOpen, 1);
});

test('el resumen suma lo recuperado y lo que sigue abierto en todas las semanas', () => {
  const rollup = summariseBackPay([
    week('2026-01-15', { status: 'short', outstanding: 131.5 }),
    week('2026-02-12', {
      status: 'partial',
      recovered: 131.52,
      outstanding: 2.16,
      recoveredIn: { periodStart: '2026-08-13', paymentDate: '2026-08-20' },
    }),
    week('2026-04-09', {
      status: 'settled',
      recovered: 32.88,
      outstanding: 0,
      recoveredIn: { periodStart: '2026-08-13', paymentDate: '2026-08-20' },
    }),
    // Una semana pagada de mas no compensa un faltante: es otra cosa.
    week('2026-03-12', { status: 'over', outstanding: -133.42 }),
  ]);

  assert.equal(rollup.recovered, 164.4);
  assert.equal(rollup.weeksRecovered, 2);
  assert.equal(rollup.outstanding, 133.66);
  assert.equal(rollup.weeksOpen, 2);
});

test('el resumen cita el ultimo deposito que trajo plata', () => {
  const rollup = summariseBackPay([
    week('2026-02-12', {
      status: 'settled',
      recovered: 100,
      recoveredIn: { periodStart: '2026-06-04', paymentDate: '2026-06-11' },
    }),
    week('2026-04-09', {
      status: 'settled',
      recovered: 32.88,
      recoveredIn: { periodStart: '2026-08-13', paymentDate: '2026-08-20' },
    }),
  ]);

  assert.equal(rollup.lastPaymentDate, '2026-08-20');
});

test('cubierto todo, el resumen no deja saldo abierto', () => {
  const rollup = summariseBackPay([
    week('2026-02-12', {
      status: 'settled',
      recovered: 131.52,
      outstanding: 0,
      recoveredIn: { periodStart: '2026-08-13', paymentDate: '2026-08-20' },
    }),
  ]);

  assert.equal(rollup.outstanding, 0);
  assert.equal(rollup.weeksOpen, 0);
});
