/** Descarga de turnos desde Deputy y normalizacion al tipo `Shift`.
 *
 *  Se usan dos fuentes complementarias:
 *    - timesheets: lo efectivamente trabajado y aprobado (pasado)
 *    - rosters:    lo publicado todavia sin trabajar (futuro, negociable)
 *
 *  Deputy devuelve horarios como epoch UTC y, segun el endpoint, tambien una
 *  version localizada. Se prefiere la localizada; si no viene, se aplica el
 *  offset de Queensland, que no tiene horario de verano. */

import { extractKm } from '../../shared/reconcile/km.js';
import type { Shift } from '../../shared/types.js';
import { deputyFetch } from './client.js';

/** Queensland: UTC+10 todo el año. */
const QLD_OFFSET_MINUTES = 600;
const MINUTES_PER_DAY = 1440;

interface WallClock {
  readonly date: string;
  readonly minute: number;
}


function fromLocalisedString(value: string): WallClock | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  return {
    date: match[1]!,
    minute: Number.parseInt(match[2]!, 10) * 60 + Number.parseInt(match[3]!, 10),
  };
}

function fromEpochSeconds(epoch: number): WallClock {
  const shifted = new Date((epoch + QLD_OFFSET_MINUTES * 60) * 1000);
  return {
    date: shifted.toISOString().slice(0, 10),
    minute: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function readWallClock(record: Record<string, unknown>, epochKey: string, localKey: string): WallClock | null {
  const localised = record[localKey];
  if (typeof localised === 'string') {
    const parsed = fromLocalisedString(localised);
    if (parsed) return parsed;
  }
  const epoch = record[epochKey];
  if (typeof epoch === 'number' && epoch > 0) return fromEpochSeconds(epoch);
  return null;
}

function readString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

function readArea(record: Record<string, unknown>): string | null {
  const meta = record._DPMetaData as Record<string, unknown> | undefined;
  if (meta && typeof meta === 'object') {
    const unit = meta.OperationalUnitInfo as Record<string, unknown> | undefined;
    const name = unit && typeof unit === 'object' ? unit.OperationalUnitName : undefined;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return readString(record, 'OperationalUnitName', 'AreaName');
}

/** Convierte un registro crudo de Deputy en un turno normalizado. */
function toShift(record: Record<string, unknown>, source: Shift['source']): Shift | null {
  const start = readWallClock(record, 'StartTime', 'StartTimeLocalized');
  const end = readWallClock(record, 'EndTime', 'EndTimeLocalized');
  if (!start || !end) return null;

  // Si el turno cruza medianoche, el fin cae al dia siguiente: se expresa
  // como minutos acumulados desde la medianoche del dia de inicio.
  let endMinute = end.minute;
  if (end.date > start.date) {
    const daysCrossed = Math.round(
      (Date.parse(`${end.date}T00:00:00Z`) - Date.parse(`${start.date}T00:00:00Z`)) / 86_400_000,
    );
    endMinute += daysCrossed * MINUTES_PER_DAY;
  }
  if (endMinute <= start.minute) return null;

  const comment = readString(record, 'EmployeeComment', 'Comment');
  const id = record.Id ?? record.id;

  return {
    id: `${source}:${typeof id === 'number' || typeof id === 'string' ? id : `${start.date}-${start.minute}`}`,
    source,
    date: start.date,
    startMinute: start.minute,
    endMinute,
    area: readArea(record),
    employeeComment: comment,
    approved: record.TimeApproved === true || record.Approved === true,
    kmDeclared: extractKm(comment),
  };
}

export function asRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === 'object') {
    // `/api/v1/resource/.../QUERY` devuelve un array pelado; los endpoints
    // `/api/management/v2` lo envuelven en `data`.
    const wrapped = (payload as Record<string, unknown>).result ?? (payload as Record<string, unknown>).data;
    if (Array.isArray(wrapped)) return wrapped as Record<string, unknown>[];
  }
  return [];
}

/** Deputy corta las consultas en paginas; `start` corre la ventana. */
const PAGE_SIZE = 500;
const MAX_PAGES = 20;

async function queryAll(
  resource: string,
  search: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const payload = await deputyFetch<unknown>(`/api/v1/resource/${resource}/QUERY`, {
      method: 'POST',
      body: { search, max: PAGE_SIZE, start: page * PAGE_SIZE },
    });
    const records = asRecords(payload);
    all.push(...records);
    if (records.length < PAGE_SIZE) return all;
  }
  throw new Error(
    `${resource} devolvio mas de ${PAGE_SIZE * MAX_PAGES} registros: acota el rango de fechas.`,
  );
}

export async function fetchTimesheets(
  employeeId: number,
  from: string,
  to: string,
): Promise<Shift[]> {
  const records = await queryAll('Timesheet', {
    byEmployee: { field: 'Employee', data: employeeId, type: 'eq' },
    fromDate: { field: 'Date', data: from, type: 'ge' },
    toDate: { field: 'Date', data: to, type: 'le' },
  });

  return timesheetsFromRecords(records);
}

/** Las licencias y los timesheets descartados no son horas trabajadas: si entraran
 *  al conteo inflarian la quincena y dispararian alertas falsas del limite 8105. */
export function timesheetsFromRecords(records: readonly Record<string, unknown>[]): Shift[] {
  return records
    .filter((record) => record.IsLeave !== true && record.Discarded !== true)
    .map((record) => toShift(record, 'timesheet'))
    .filter((shift): shift is Shift => shift !== null);
}

export async function fetchRosters(
  employeeId: number,
  from: string,
  to: string,
): Promise<Shift[]> {
  // El recurso Roster esta denegado para tokens de empleado ("Access to
  // object-type denied"). Este endpoint devuelve el roster propio, pero no
  // acepta filtros: se recorta el rango aca.
  const payload = await deputyFetch<unknown>('/api/v1/my/roster');
  return rostersFromRecords(asRecords(payload), employeeId, from, to);
}

export function rostersFromRecords(
  records: readonly Record<string, unknown>[],
  employeeId: number,
  from: string,
  to: string,
): Shift[] {
  return records
    .filter((record) => record.Employee === employeeId)
    .map((record) => toShift(record, 'roster'))
    .filter((shift): shift is Shift => shift !== null && shift.date >= from && shift.date <= to);
}

/** Une timesheets y rosters sin duplicar.
 *
 *  Un dia con timesheet **aprobado** se resuelve por el timesheet: es lo
 *  realmente trabajado y es lo que el empleador liquida.
 *
 *  Un timesheet **sin aprobar** no manda. Mientras el turno esta abierto,
 *  Deputy devuelve el fichaje en curso: si el sync corre en el medio, el
 *  `StartTime` es el momento en que se toco el boton, no el horario del turno.
 *  Caso real: el turno del 28 ago 2026 (20:00-06:00) se sincronizo a las 22:26
 *  y entro como 22:20-06:00, con lo que las 2 h pagables de 20:00 a 22:00
 *  desaparecieron de la semana y de la cuenta de la visa. Ese dia el roster
 *  publicado es la mejor estimacion hasta que el timesheet cierre y se apruebe. */
export function mergeShifts(timesheets: readonly Shift[], rosters: readonly Shift[]): Shift[] {
  const settledDates = new Set(
    timesheets.filter((shift) => shift.approved).map((shift) => shift.date),
  );
  const rosterDates = new Set(rosters.map((shift) => shift.date));

  const kept = timesheets.filter(
    (shift) => shift.approved || !rosterDates.has(shift.date),
  );
  const missing = rosters.filter((shift) => !settledDates.has(shift.date));

  return [...kept, ...missing].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute,
  );
}
