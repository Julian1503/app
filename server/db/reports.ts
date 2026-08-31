/** Reportes de turno. Hablan de la salud de una persona identificable: la
 *  tabla tiene RLS habilitada y sin politicas, o sea que solo entra el servidor
 *  con la service_role key. Es el equivalente al 0600 que tenia el archivo. */

import type { FieldAnswer, Gap } from '../../shared/form/answers.js';
import type { Observation, ReportStatus, ShiftReport } from '../../shared/reports/types.js';
import { assertOk, db, unwrap } from './client.js';

interface ReportRow {
  shift_id: string;
  date: string;
  observations: Observation[];
  presentation_tags: string[];
  presentation: string;
  support: string;
  form_answers: FieldAnswer[];
  gaps: Gap[];
  draft: string | null;
  drafted_at: string | null;
  status: ReportStatus;
  updated_at: string;
}

function toReport(row: ReportRow): ShiftReport {
  return {
    shiftId: row.shift_id,
    date: row.date,
    observations: row.observations ?? [],
    presentationTags: row.presentation_tags ?? [],
    presentation: row.presentation,
    support: row.support,
    formAnswers: row.form_answers ?? [],
    gaps: row.gaps ?? [],
    draft: row.draft,
    draftedAt: row.drafted_at,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function toRow(report: ShiftReport): ReportRow {
  return {
    shift_id: report.shiftId,
    date: report.date,
    observations: [...report.observations],
    presentation_tags: [...report.presentationTags],
    presentation: report.presentation,
    support: report.support,
    form_answers: [...report.formAnswers],
    gaps: [...report.gaps],
    draft: report.draft,
    drafted_at: report.draftedAt,
    status: report.status,
    updated_at: report.updatedAt,
  };
}

export async function readReports(): Promise<Record<string, ShiftReport>> {
  const rows = unwrap(
    await db().from('shift_reports').select('*'),
    'No se pudieron leer los reportes',
  ) as ReportRow[];

  return Object.fromEntries(rows.map((row) => [row.shift_id, toReport(row)]));
}

export async function readReport(shiftId: string): Promise<ShiftReport | null> {
  const result = await db().from('shift_reports').select('*').eq('shift_id', shiftId).maybeSingle();
  assertOk(result, `No se pudo leer el reporte del turno ${shiftId}`);
  return result.data ? toReport(result.data as ReportRow) : null;
}

export async function writeReport(report: ShiftReport): Promise<void> {
  assertOk(
    await db().from('shift_reports').upsert(toRow(report), { onConflict: 'shift_id' }),
    `No se pudo guardar el reporte del turno ${report.shiftId}`,
  );
}
