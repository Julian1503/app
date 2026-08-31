import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DailyHours, Shift } from '../shared/types.js';
import { buildFortnights, currentFortnight } from '../shared/visa/fortnights.js';
import { planDrops } from '../shared/visa/drop-planner.js';

function day(date: string, countable: number, sleepovers = 0): DailyHours {
  return { date, countable, gross: countable, sleepovers, shiftIds: [date] };
}

function shift(date: string, start: number, end: number): Shift {
  return {
    id: `${date}-${start}`,
    source: 'roster',
    date,
    startMinute: start * 60,
    endMinute: end * 60,
    area: null,
    employeeComment: null,
    approved: false,
    kmDeclared: null,
  };
}

test('las ventanas empiezan siempre un lunes', () => {
  // 2026-08-05 es miercoles; la ventana debe abrir el lunes 3.
  const windows = buildFortnights([day('2026-08-05', 4)], [], 48);
  assert.equal(windows[0]?.start, '2026-08-03');
  assert.equal(windows[0]?.end, '2026-08-16');
});

test('las ventanas se solapan avanzando de a una semana', () => {
  const windows = buildFortnights([day('2026-08-03', 4), day('2026-08-24', 4)], [], 48);
  assert.deepEqual(
    windows.map((window) => window.start),
    ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24'],
  );
});

test('una ventana por encima del limite queda marcada', () => {
  const days = [day('2026-08-03', 30), day('2026-08-10', 25)];
  const [window] = buildFortnights(days, [], 48);
  assert.equal(window?.inSession, 55);
  assert.equal(window?.status, 'over');
  assert.equal(window?.overBy, 7);
});

test('los dias en term break no suman al conteo en sesion', () => {
  const days = [day('2026-06-16', 30), day('2026-06-20', 25)];
  const breaks = [{ start: '2026-06-15', end: '2026-07-11' }];
  const [window] = buildFortnights(days, breaks, 48);
  assert.equal(window?.total, 55);
  assert.equal(window?.inSession, 0);
  assert.equal(window?.status, 'ok');
});

test('el escenario conservador suma las 8 h del sleepover', () => {
  const [window] = buildFortnights([day('2026-08-03', 2, 1)], [], 48);
  assert.equal(window?.inSession, 2);
  assert.equal(window?.conservative, 10);
});

test('el aviso se dispara al 90% del limite', () => {
  const [window] = buildFortnights([day('2026-08-03', 44)], [], 48);
  assert.equal(window?.status, 'warning');
});

test('la quincena vigente es la mas cargada de las abiertas', () => {
  const windows = buildFortnights([day('2026-08-03', 50), day('2026-08-17', 10)], [], 48);
  const current = currentFortnight(windows, '2026-08-14');
  assert.equal(current?.start, '2026-08-03');
});

test('el plan de recorte propone turnos futuros hasta volver bajo el limite', () => {
  const shifts = [
    shift('2026-08-17', 6, 18), // 12 h
    shift('2026-08-18', 6, 18),
    shift('2026-08-19', 6, 18),
    shift('2026-08-20', 6, 18),
    shift('2026-08-21', 6, 18), // 60 h en la quincena
  ];
  const plan = planDrops(shifts, [], 48, '2026-08-14');
  assert.ok(plan.length >= 1, 'deberia sugerir al menos un turno');
  const freed = plan.reduce((sum, item) => sum + item.hoursFreed, 0);
  assert.ok(freed >= 12, `deberia liberar al menos 12 h, libero ${freed}`);
});

test('el plan no propone turnos ya trabajados', () => {
  const shifts = [
    shift('2026-08-03', 6, 18),
    shift('2026-08-04', 6, 18),
    shift('2026-08-05', 6, 18),
    shift('2026-08-06', 6, 18),
    shift('2026-08-07', 6, 18),
  ];
  const plan = planDrops(shifts, [], 48, '2026-08-14');
  assert.deepEqual(plan, [], 'el pasado no se negocia');
});
