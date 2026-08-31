/** Turnos sincronizados desde Deputy y estado del ultimo sync. */

import type { Shift, ShiftSource } from '../../shared/types.ts';
import { assertOk, db, unwrap } from './client.ts';

export interface SyncState {
  readonly shifts: Shift[];
  readonly lastSyncAt: string | null;
  readonly from: string | null;
  readonly to: string | null;
}

interface ShiftRow {
  id: string;
  source: string;
  date: string;
  start_minute: number;
  end_minute: number;
  area: string | null;
  employee_comment: string | null;
  approved: boolean;
  km_declared: number | string | null;
}

/** Postgres devuelve los `numeric` como string para no perder precision. */
function toNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toShift(row: ShiftRow): Shift {
  return {
    id: row.id,
    source: row.source as ShiftSource,
    date: row.date,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    area: row.area,
    employeeComment: row.employee_comment,
    approved: row.approved,
    kmDeclared: toNumber(row.km_declared),
  };
}

function toRow(shift: Shift, syncedAt: string): ShiftRow & { synced_at: string } {
  return {
    id: shift.id,
    source: shift.source,
    date: shift.date,
    start_minute: shift.startMinute,
    end_minute: shift.endMinute,
    area: shift.area,
    employee_comment: shift.employeeComment,
    approved: shift.approved,
    km_declared: shift.kmDeclared,
    synced_at: syncedAt,
  };
}

export async function readShifts(): Promise<SyncState> {
  const [shiftsResult, stateResult] = await Promise.all([
    db().from('shifts').select('*').order('date', { ascending: true }),
    db().from('sync_state').select('*').maybeSingle(),
  ]);

  const rows = unwrap(shiftsResult, 'No se pudieron leer los turnos');
  assertOk(stateResult, 'No se pudo leer el estado del sync');
  const state = stateResult.data as
    | { last_sync_at: string | null; range_from: string | null; range_to: string | null }
    | null;

  return {
    shifts: (rows as ShiftRow[]).map(toShift),
    lastSyncAt: state?.last_sync_at ?? null,
    from: state?.range_from ?? null,
    to: state?.range_to ?? null,
  };
}

/** Reemplaza el set completo de turnos, que es lo que hacia el archivo.
 *
 *  El orden importa: primero se escriben los nuevos y despues se borran los que
 *  quedaron con un `synced_at` viejo. Al reves habria una ventana con la tabla
 *  vacia, y si el insert falla ahi te quedaste sin turnos. */
export async function writeShifts(shifts: readonly Shift[], from: string, to: string): Promise<string> {
  const syncedAt = new Date().toISOString();

  if (shifts.length > 0) {
    assertOk(
      await db()
        .from('shifts')
        .upsert(shifts.map((shift) => toRow(shift, syncedAt)), { onConflict: 'id' }),
      'No se pudieron guardar los turnos',
    );
  }

  assertOk(
    await db().from('shifts').delete().lt('synced_at', syncedAt),
    'No se pudieron limpiar los turnos viejos',
  );

  assertOk(
    await db()
      .from('sync_state')
      .upsert({ id: true, last_sync_at: syncedAt, range_from: from, range_to: to }, { onConflict: 'id' }),
    'No se pudo guardar el estado del sync',
  );

  return syncedAt;
}
