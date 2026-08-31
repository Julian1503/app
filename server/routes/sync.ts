/** Sincronizacion de turnos desde Deputy hacia la base. */

import { Router } from 'express';
import { config } from '../config.ts';
import { fetchIdentity } from '../deputy/client.ts';
import { fetchRosters, fetchTimesheets, mergeShifts } from '../deputy/shifts.ts';
import { readShifts, writeShifts } from '../db/shifts.ts';
import { addDays } from '../../shared/dates.ts';
import { createI18n, resolveLocale } from '../../shared/i18n/index.ts';
import type { Shift } from '../../shared/types.ts';

export const syncRouter = Router();

const DEFAULT_HISTORY_START = '2025-11-01';
const FUTURE_HORIZON_DAYS = 120;

export type { SyncState } from '../db/shifts.ts';
export { readShifts } from '../db/shifts.ts';

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

syncRouter.get('/shifts', async (_req, res, next) => {
  try {
    res.json(await readShifts());
  } catch (error) {
    next(error);
  }
});

syncRouter.post('/sync', async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const body = (req.body ?? {}) as Record<string, unknown>;

    const { t } = createI18n(resolveLocale(req.query.locale));

    const from = isIsoDate(body.from) ? body.from : DEFAULT_HISTORY_START;
    const to = isIsoDate(body.to) ? body.to : addDays(today, FUTURE_HORIZON_DAYS);
    if (from > to) {
      res.status(400).json({ error: t('server.sync.rangeInvalid') });
      return;
    }

    const identity = await fetchIdentity();
    const employeeId = identity.employeeId ?? config.employeeId;
    if (employeeId === null) {
      res.status(400).json({ error: t('server.sync.noEmployeeId') });
      return;
    }

    const timesheets = await fetchTimesheets(employeeId, from, to);

    // El roster futuro es opcional: si el install no expone el recurso, se sigue
    // con los timesheets en vez de fallar todo el sync.
    let rosters: Shift[] = [];
    let rosterWarning: string | null = null;
    try {
      rosters = await fetchRosters(employeeId, from, to);
    } catch (error) {
      rosterWarning = t('server.sync.rosterWarning', { reason: (error as Error).message });
    }

    const shifts = mergeShifts(timesheets, rosters);
    const lastSyncAt = await writeShifts(shifts, from, to);

    res.json({
      shifts,
      lastSyncAt,
      from,
      to,
      counts: { timesheets: timesheets.length, rosters: rosters.length, merged: shifts.length },
      identity,
      warning: rosterWarning,
    });
  } catch (error) {
    next(error);
  }
});
