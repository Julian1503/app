/** El typecheck ya garantiza que los dos catalogos tengan las mismas claves y
 *  los mismos parametros. Lo que no puede garantizar es que las entradas digan
 *  algo: una cadena vacia o un texto sin traducir compila igual de bien. */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { en } from '../shared/i18n/en.ts';
import { es } from '../shared/i18n/es.ts';
import { createI18n, LOCALES, resolveLocale } from '../shared/i18n/index.ts';

/** Parametros de relleno con los que renderizar cualquier entrada. Las claves
 *  que no correspondan se ignoran, asi que un unico objeto sirve para todas. */
const SAMPLE = {
  count: 2,
  limit: 48,
  hours: 12,
  over: 4,
  margin: 1.5,
  range: 'jue 6 ago - mie 12 ago',
  date: 'jue 6 ago',
  when: '13/8/26 09:00',
  reason: 'motivo',
  status: 500,
  taxYear: '2026-27',
  year: '2026-27',
  gross: '$1,000.00',
  tax: '$100.00',
  superannuation: '$120.00',
  shortfall: '$50.00',
  km: 10,
  money: '$9.90',
  files: 3,
  paid: 20,
  roster: 22,
  shifts: 2,
  inSession: 40,
  total: 46,
  breakDays: 0,
  paidHours: 20,
  visaHours: 18,
  rostered: 3,
  file: 'test.pdf',
  comment: 'drove somewhere',
  declared: 10,
  paidMoney: '$0.00',
  paidKm: 0,
  rate: 0.99,
  label: 'Ordinary Hours',
  expected: '$100.00',
  actual: '$90.00',
  differences: 'Ordinary Hours',
  hoursNote: '',
  dates: '2026-08-07',
  samples: 'ejemplo',
  missing: true,
  amount: '$10.00',
  recovered: '$348.36',
  hasRecovered: true,
  lines: 'renglon',
  weeks: 'jue 12 feb - mie 18 feb',
};

const CATALOGUES = { es, en };

for (const locale of LOCALES) {
  test(`ninguna entrada de "${locale}" queda vacia`, () => {
    const catalogue = CATALOGUES[locale];
    for (const [key, entry] of Object.entries(catalogue)) {
      const rendered = typeof entry === 'function' ? entry(SAMPLE as never) : entry;
      assert.equal(typeof rendered, 'string', `${key} no rinde texto`);
      assert.ok(rendered.trim().length > 0, `${key} esta vacia`);
    }
  });
}

/** Entradas que legitimamente se escriben igual en los dos idiomas: son terminos
 *  de la nomina australiana o etiquetas que copian el payslip, y traducirlas
 *  haria que dejaran de coincidir con el PDF. */
const INTENTIONALLY_IDENTICAL = [
  'backPay.eyebrow',
  'findings.category.km',
  'findings.category.visa',
  'pay.col.delta',
  'payslips.col.nightHours',
  'payslips.col.sleepovers',
  'payslips.ok',
  'section.payslips.title',
];

test('no quedan textos sin traducir', () => {
  // Un catalogo copiado y no traducido pasaria todos los demas chequeos.
  const shared = Object.keys(es)
    .filter(
      (key) =>
        typeof es[key as keyof typeof es] === 'string' &&
        es[key as keyof typeof es] === en[key as keyof typeof en],
    )
    .sort();

  assert.deepEqual(shared, INTENTIONALLY_IDENTICAL);
});

test('resuelve cualquier entrada a un idioma soportado', () => {
  assert.equal(resolveLocale('en'), 'en');
  assert.equal(resolveLocale('en-AU'), 'en');
  assert.equal(resolveLocale('es-AR'), 'es');
  assert.equal(resolveLocale('fr'), 'es');
  assert.equal(resolveLocale(undefined), 'es');
  assert.equal(resolveLocale(42), 'es');
});

test('las fechas siguen el idioma y se leen en UTC', () => {
  // El 6 de agosto de 2026 es jueves: si el huso corriera el dia, diria otro.
  assert.equal(createI18n('es').date('2026-08-06'), 'jue 6 ago');
  assert.equal(createI18n('en').date('2026-08-06'), 'Thu 6 Aug');
  assert.equal(createI18n('en').range('2026-08-06', '2026-08-12'), 'Thu 6 Aug - Wed 12 Aug');
});

test('los importes se muestran en dolares australianos en los dos idiomas', () => {
  // El payslip los imprime asi; cambiar el formato solo lograria que el numero
  // no coincidiera con el PDF que tenes al lado.
  assert.equal(createI18n('es').money(1740.52), '$1,740.52');
  assert.equal(createI18n('en').money(1740.52), '$1,740.52');
});

test('interpola los parametros de la clave', () => {
  assert.equal(createI18n('es').t('gauge.of', { limit: 48 }), 'de 48 h');
  assert.equal(createI18n('en').t('gauge.of', { limit: 48 }), 'of 48 h');
});
