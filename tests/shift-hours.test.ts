import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Shift } from '../shared/types.ts';
import { aggregateDaily, countableHoursOf, splitShiftByDay } from '../shared/visa/shift-hours.ts';

function shift(date: string, start: number, end: number, id = `${date}-${start}`): Shift {
  return {
    id,
    source: 'roster',
    date,
    startMinute: start,
    endMinute: end,
    area: null,
    employeeComment: null,
    approved: true,
    kmDeclared: null,
  };
}

const at = (hour: number): number => hour * 60;

test('un turno diurno cuenta completo', () => {
  assert.equal(countableHoursOf(shift('2026-08-03', at(6), at(9))), 3);
});

test('20:00-06:00 cuenta solo las 2 h previas a la franja nocturna', () => {
  // El resto es sleepover: se paga como allowance, sin horas asociadas.
  assert.equal(countableHoursOf(shift('2026-08-03', at(20), at(30))), 2);
});

test('20:00-08:00 cuenta 2 h el primer dia y 2 h el segundo', () => {
  const portions = splitShiftByDay(shift('2026-08-11', at(20), at(32)));
  assert.deepEqual(
    portions.map((portion) => [portion.date, portion.countable]),
    [
      ['2026-08-11', 2],
      ['2026-08-12', 2],
    ],
  );
});

test('un turno enteramente nocturno no aporta horas computables', () => {
  assert.equal(countableHoursOf(shift('2026-08-03', at(23), at(29))), 0);
});

test('la franja nocturna se detecta como sleepover', () => {
  const daily = aggregateDaily([shift('2026-08-03', at(20), at(30))]);
  assert.equal(daily[0]?.sleepovers, 1);
  assert.equal(daily[0]?.gross, 4);
});

test('un turno corto que roza la noche no es sleepover', () => {
  const daily = aggregateDaily([shift('2026-08-03', at(21), at(23))]);
  assert.equal(daily[0]?.sleepovers, 0);
  assert.equal(daily[0]?.countable, 1);
});

test('dos bloques en el mismo dia se suman', () => {
  const daily = aggregateDaily([
    shift('2026-08-17', at(13), at(15)),
    shift('2026-08-17', at(16), at(20)),
    shift('2026-08-17', at(20), at(30)),
  ]);
  // 2 h + 4 h + 2 h = 8 h, tal como el roster del 17 de agosto.
  assert.equal(daily[0]?.countable, 8);
});

test('los medios turnos conservan los minutos', () => {
  assert.equal(countableHoursOf(shift('2026-08-03', 17 * 60 + 30, at(20))), 2.5);
});

test('un turno invertido o vacio se descarta', () => {
  assert.deepEqual(splitShiftByDay(shift('2026-08-03', at(10), at(10))), []);
  assert.deepEqual(splitShiftByDay(shift('2026-08-03', at(12), at(9))), []);
});
