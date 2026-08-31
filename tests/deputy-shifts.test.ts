/** Normalizacion de la respuesta de Deputy. Los registros de ejemplo estan
 *  recortados de respuestas reales del install (`Timesheet/QUERY` y `my/roster`). */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  asRecords,
  mergeShifts,
  rostersFromRecords,
  timesheetsFromRecords,
} from '../server/deputy/shifts.js';

/** 2025-11-27 15:00-19:00 en Queensland (UTC+10). */
const TIMESHEET = {
  Id: 5110,
  Employee: 51,
  Date: '2025-11-27T00:00:00+10:00',
  StartTime: 1764219600,
  EndTime: 1764234000,
  TotalTime: 4,
  EmployeeComment: 'Turno normal, 15 km ida y vuelta.',
  TimeApproved: true,
  IsLeave: false,
  Discarded: false,
  StartTimeLocalized: '2025-11-27T15:00:00+10:00',
  EndTimeLocalized: '2025-11-27T19:00:00+10:00',
  _DPMetaData: { OperationalUnitInfo: { Id: 67, OperationalUnitName: 'Joshua Jones' } },
};

const ROSTER = {
  Id: 22707,
  Employee: 51,
  Date: '2026-08-17T00:00:00+10:00',
  StartTime: 1786053600,
  EndTime: 1786060800,
  StartTimeLocalized: '2026-08-17T13:00:00+10:00',
  EndTimeLocalized: '2026-08-17T15:00:00+10:00',
  Comment: '',
  _DPMetaData: { OperationalUnitInfo: { Id: 102, OperationalUnitName: 'Taylor Sullivan' } },
};

test('asRecords acepta el array pelado de /resource/QUERY', () => {
  assert.equal(asRecords([TIMESHEET]).length, 1);
});

test('asRecords desenvuelve result y data', () => {
  assert.equal(asRecords({ result: [TIMESHEET] }).length, 1);
  assert.equal(asRecords({ success: true, data: [TIMESHEET] }).length, 1);
});

test('asRecords devuelve vacio ante una respuesta inesperada', () => {
  assert.deepEqual(asRecords(null), []);
  assert.deepEqual(asRecords({ success: false }), []);
  assert.deepEqual(asRecords('nope'), []);
});

test('normaliza un timesheet con hora local, area y km del comentario', () => {
  const [shift] = timesheetsFromRecords([TIMESHEET]);

  assert.equal(shift?.id, 'timesheet:5110');
  assert.equal(shift?.date, '2025-11-27');
  assert.equal(shift?.startMinute, 15 * 60);
  assert.equal(shift?.endMinute, 19 * 60);
  assert.equal(shift?.area, 'Joshua Jones');
  assert.equal(shift?.approved, true);
  assert.equal(shift?.kmDeclared, 15);
});

test('descarta licencias: no son horas trabajadas para la visa', () => {
  const leave = { ...TIMESHEET, Id: 10579, IsLeave: true, LeaveRule: 1 };
  assert.deepEqual(timesheetsFromRecords([leave]), []);
});

test('descarta timesheets marcados como Discarded', () => {
  const discarded = { ...TIMESHEET, Id: 6258, Discarded: true };
  assert.deepEqual(timesheetsFromRecords([discarded]), []);
});

test('conserva los timesheets validos del mismo lote', () => {
  const lote = [TIMESHEET, { ...TIMESHEET, Id: 1, IsLeave: true }, { ...TIMESHEET, Id: 2, Discarded: true }];
  assert.equal(timesheetsFromRecords(lote).length, 1);
});

test('el roster recorta por rango porque /my/roster no acepta filtros', () => {
  const dentro = rostersFromRecords([ROSTER], 51, '2026-08-01', '2026-08-31');
  const fuera = rostersFromRecords([ROSTER], 51, '2026-09-01', '2026-09-30');

  assert.equal(dentro.length, 1);
  assert.equal(dentro[0]?.id, 'roster:22707');
  assert.equal(dentro[0]?.area, 'Taylor Sullivan');
  assert.equal(dentro[0]?.approved, false);
  assert.deepEqual(fuera, []);
});

test('el roster ignora turnos de otro empleado', () => {
  assert.deepEqual(rostersFromRecords([{ ...ROSTER, Employee: 99 }], 51, '2026-08-01', '2026-08-31'), []);
});

test('un dia con timesheet le gana al roster publicado', () => {
  const timesheets = timesheetsFromRecords([TIMESHEET]);
  const mismoDia = rostersFromRecords(
    [{ ...ROSTER, Date: '2025-11-27T00:00:00+10:00', StartTimeLocalized: '2025-11-27T13:00:00+10:00', EndTimeLocalized: '2025-11-27T15:00:00+10:00' }],
    51,
    '2025-11-01',
    '2025-12-31',
  );

  const merged = mergeShifts(timesheets, mismoDia);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.source, 'timesheet');
});

test('un timesheet sin aprobar no le gana al roster publicado', () => {
  // El sync corrio en el medio del turno: Deputy devolvio el fichaje en curso
  // (22:20) en vez del horario del turno (20:00). Caso real del 28 ago 2026.
  const enCurso = timesheetsFromRecords([
    {
      ...TIMESHEET,
      Id: 13458,
      TimeApproved: false,
      StartTimeLocalized: '2026-08-28T22:20:00+10:00',
      EndTimeLocalized: '2026-08-29T06:00:00+10:00',
    },
  ]);
  const publicado = rostersFromRecords(
    [
      {
        ...ROSTER,
        Id: 23735,
        StartTimeLocalized: '2026-08-28T20:00:00+10:00',
        EndTimeLocalized: '2026-08-29T06:00:00+10:00',
      },
    ],
    51,
    '2026-08-01',
    '2026-08-31',
  );

  const merged = mergeShifts(enCurso, publicado);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.source, 'roster');
  assert.equal(merged[0]?.startMinute, 20 * 60);
  assert.equal(merged[0]?.endMinute, 30 * 60);
});

test('un timesheet sin aprobar se conserva si ese dia no hay roster', () => {
  const enCurso = timesheetsFromRecords([{ ...TIMESHEET, TimeApproved: false }]);
  const merged = mergeShifts(enCurso, []);

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.source, 'timesheet');
});
