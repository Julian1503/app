/** Importa a Supabase lo que hay en data/*.json. Se corre una sola vez.
 *
 *  Es idempotente: todo se escribe con upsert sobre la clave natural, asi que
 *  volver a correrlo pisa lo mismo en vez de duplicar. Los archivos no se
 *  borran: quedan como respaldo hasta que verifiques que la app anda.
 *
 *  Uso: npm run db:migrate */

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../server/config.ts';
import { assertOk, db } from '../server/db/client.ts';
import type { ShiftReport } from '../shared/reports/types.ts';
import type { Shift } from '../shared/types.ts';

const DATA_DIR = path.resolve(config.appRoot, 'data');

async function readFileJson<T>(name: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, name), 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log(`  data/${name}: no existe, se saltea`);
      return null;
    }
    throw error;
  }
}

/** Los upsert grandes se parten: PostgREST acepta el lote entero, pero un error
 *  en 500 filas no dice cual fue. De a 200 el mensaje es util. */
const CHUNK = 200;

async function upsertAll(
  table: string,
  rows: readonly Record<string, unknown>[],
  onConflict: string,
): Promise<void> {
  for (let index = 0; index < rows.length; index += CHUNK) {
    assertOk(
      await db().from(table).upsert(rows.slice(index, index + CHUNK), { onConflict }),
      `Fallo el upsert en ${table} (fila ${index})`,
    );
  }
}

async function migrateShifts(): Promise<void> {
  const state = await readFileJson<{
    shifts: Shift[];
    lastSyncAt: string | null;
    from: string | null;
    to: string | null;
  }>('shifts.json');
  if (!state) return;

  const syncedAt = state.lastSyncAt ?? new Date().toISOString();
  await upsertAll(
    'shifts',
    state.shifts.map((shift) => ({
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
    })),
    'id',
  );

  assertOk(
    await db().from('sync_state').upsert(
      { id: true, last_sync_at: state.lastSyncAt, range_from: state.from, range_to: state.to },
      { onConflict: 'id' },
    ),
    'Fallo el upsert de sync_state',
  );
  console.log(`  shifts: ${state.shifts.length}`);
}

async function migrateHolidays(): Promise<void> {
  const rows = await readFileJson<Array<{ date: string; label?: string; confirmed?: boolean }>>(
    'holidays.json',
  );
  if (!rows) return;
  await upsertAll(
    'holidays',
    rows.map((row) => ({ date: row.date, label: row.label ?? '', confirmed: row.confirmed ?? false })),
    'date',
  );
  console.log(`  holidays: ${rows.length}`);
}

async function migrateTermBreaks(): Promise<void> {
  const rows = await readFileJson<Array<{ start: string; end: string; label?: string }>>(
    'term-breaks.json',
  );
  if (!rows) return;
  await upsertAll(
    'term_breaks',
    rows.map((row) => ({ start_date: row.start, end_date: row.end, label: row.label ?? null })),
    'start_date,end_date',
  );
  console.log(`  term_breaks: ${rows.length}`);
}

async function migrateReports(): Promise<void> {
  const map = await readFileJson<Record<string, ShiftReport>>('shift-reports.json');
  if (!map) return;
  const reports = Object.values(map);
  await upsertAll(
    'shift_reports',
    reports.map((report) => ({
      shift_id: report.shiftId,
      date: report.date,
      observations: report.observations,
      presentation_tags: report.presentationTags,
      presentation: report.presentation,
      support: report.support,
      form_answers: report.formAnswers,
      gaps: report.gaps,
      draft: report.draft,
      drafted_at: report.draftedAt,
      status: report.status,
      updated_at: report.updatedAt,
    })),
    'shift_id',
  );
  console.log(`  shift_reports: ${reports.length}`);
}

/** Los tokens se copian tal cual: el sobre ya viene cifrado y la clave sigue
 *  siendo el DEPUTY_CLIENT_SECRET del .env. Si cambiaste el secret desde la
 *  ultima sesion, esto migra basura y vas a tener que loguearte de nuevo,
 *  que es exactamente lo que pasaba antes con el archivo. */
async function migrateTokens(): Promise<void> {
  const envelope = await readFileJson<{ v: number; iv: string; tag: string; data: string }>(
    'tokens.json',
  );
  if (!envelope) return;
  assertOk(
    await db().from('deputy_tokens').upsert(
      { id: true, v: envelope.v, iv: envelope.iv, tag: envelope.tag, data: envelope.data },
      { onConflict: 'id' },
    ),
    'Fallo el upsert de deputy_tokens',
  );
  console.log('  deputy_tokens: 1 (sesion de Deputy)');
}

async function main(): Promise<void> {
  console.log(`Migrando ${DATA_DIR} -> ${config.supabaseUrl}\n`);
  await migrateShifts();
  await migrateHolidays();
  await migrateTermBreaks();
  await migrateReports();
  await migrateTokens();
  console.log('\nListo. Los payslips van aparte: npm run payslips:import');
}

await main();
