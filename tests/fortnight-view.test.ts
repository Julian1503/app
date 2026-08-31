/** El panel de quincena cambia el consejo segun donde cae respecto de hoy:
 *  sobre una quincena ya cerrada no se puede negociar el roster. */

import assert from 'node:assert/strict';
import test from 'node:test';
import type { Fortnight } from '../shared/types.ts';
import { createI18n } from '../shared/i18n/index.ts';
import { headlineFor, labelFor, positionOf, verdictFor } from '../src/lib/fortnight-view.ts';

const { t } = createI18n('es');

const TODAY = '2026-08-14';

function fortnight(patch: Partial<Fortnight>): Fortnight {
  return {
    start: '2026-08-03',
    end: '2026-08-16',
    total: 46.5,
    inSession: 46.5,
    conservative: 94.5,
    breakDays: 0,
    overBy: 0,
    status: 'warning',
    ...patch,
  };
}

test('ubica la quincena que contiene hoy como vigente', () => {
  assert.equal(positionOf(fortnight({}), TODAY), 'current');
});

test('una quincena terminada ayer es pasada', () => {
  assert.equal(positionOf(fortnight({ start: '2025-11-24', end: '2026-08-13' }), TODAY), 'past');
});

test('una quincena que arranca manana es futura', () => {
  assert.equal(positionOf(fortnight({ start: '2026-08-15', end: '2026-08-28' }), TODAY), 'future');
});

test('los bordes del rango cuentan como vigente', () => {
  assert.equal(positionOf(fortnight({ start: TODAY, end: '2026-08-27' }), TODAY), 'current');
  assert.equal(positionOf(fortnight({ start: '2026-08-01', end: TODAY }), TODAY), 'current');
});

test('cada posicion tiene su etiqueta', () => {
  assert.equal(labelFor('past', t), 'Quincena cerrada');
  assert.equal(labelFor('current', t), 'Quincena vigente');
  assert.equal(labelFor('future', t), 'Quincena futura');
});

test('el titular de la vigente habla del margen que queda', () => {
  assert.equal(headlineFor(fortnight({ inSession: 46.5 }), 48, 'current', t), 'Te quedan 1.5 h');
  assert.equal(headlineFor(fortnight({ inSession: 54 }), 48, 'current', t), 'Te pasaste por 6 h');
});

test('el titular de una cerrada va en pasado', () => {
  assert.equal(headlineFor(fortnight({ inSession: 40 }), 48, 'past', t), 'Cerró con 8 h de margen');
  assert.equal(headlineFor(fortnight({ inSession: 54 }), 48, 'past', t), 'Cerró 6 h por encima');
});

test('el titular de una futura atribuye el exceso al roster, no a algo ya hecho', () => {
  assert.equal(
    headlineFor(fortnight({ inSession: 52 }), 48, 'future', t),
    'El roster te deja 4 h por encima',
  );
});

test('a una quincena cerrada no le pide negociar el roster', () => {
  const cerrada = verdictFor('past', 'over', t);
  assert.match(cerrada, /Ya no se corrige con el roster/);
  assert.doesNotMatch(cerrada, /Pedí que te saquen/);
});

test('a una abierta por encima si le pide sacar turnos', () => {
  assert.match(verdictFor('current', 'over', t), /Pedí que te saquen turnos/);
  assert.match(verdictFor('future', 'over', t), /todavía estás a tiempo/);
});

test('hay veredicto para toda combinacion de posicion y estado', () => {
  for (const position of ['past', 'current', 'future'] as const) {
    for (const status of ['ok', 'warning', 'over'] as const) {
      assert.ok(verdictFor(position, status, t).length > 0, `${position}/${status} sin texto`);
    }
  }
});
