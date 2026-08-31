/** Validacion y normalizacion de los reportes que manda la UI.
 *
 *  La persistencia vive en server/db/reports.ts; aca se reexporta para no
 *  tocar los llamadores. */

import { isBehaviourId } from '../../shared/reports/behaviours.js';
import type { AnswerStatus, FieldAnswer, Gap } from '../../shared/form/answers.js';
import { isFieldId } from '../../shared/form/schema.js';
import { isTagId } from '../../shared/reports/tags.js';
import type { Observation, ReportStatus, ShiftReport } from '../../shared/reports/types.js';

export { readReport, readReports, writeReport } from '../db/reports.js';

const STATUSES: readonly ReportStatus[] = ['pending', 'drafted', 'submitted'];

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Normaliza lo que manda la UI. Una conducta desconocida se descarta en vez de
 *  guardarse: el catalogo es cerrado a proposito. */
export function parseObservations(value: unknown): Observation[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .filter((entry) => isBehaviourId(entry.behaviourId))
    .map((entry) => ({
      behaviourId: entry.behaviourId as string,
      value:
        typeof entry.value === 'number' && Number.isFinite(entry.value) && entry.value >= 0
          ? entry.value
          : null,
      note: readString(entry.note).slice(0, 2000),
    }));
}

export function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  // `Set` saca repetidos: la UI no deberia mandarlos, pero un tag duplicado en
  // el prompt se lee como enfasis y no lo es.
  return [...new Set(value.filter(isTagId))];
}

const STATUSES_ANSWER: readonly AnswerStatus[] = ['documented', 'confirmed', 'unavailable'];

export function parseFormAnswers(value: unknown): FieldAnswer[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .filter((entry) => isFieldId(entry.fieldId))
    .map((entry) => ({
      fieldId: entry.fieldId as string,
      values: Array.isArray(entry.values)
        ? entry.values.filter((v): v is string => typeof v === 'string').map((v) => v.slice(0, 4000))
        : [],
      status: (STATUSES_ANSWER.includes(entry.status as AnswerStatus)
        ? entry.status
        : 'documented') as AnswerStatus,
      evidence: readString(entry.evidence).slice(0, 1000),
    }));
}

export function parseGaps(value: unknown): Gap[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .filter((entry) => isFieldId(entry.fieldId) && typeof entry.question === 'string')
    .map((entry) => ({
      fieldId: entry.fieldId as string,
      question: (entry.question as string).slice(0, 500),
      options: Array.isArray(entry.options)
        ? entry.options.filter((o): o is string => typeof o === 'string').slice(0, 8)
        : [],
      multi: entry.multi === true,
    }));
}

export function parseStatus(value: unknown, fallback: ReportStatus): ReportStatus {
  return STATUSES.includes(value as ReportStatus) ? (value as ReportStatus) : fallback;
}

export function parseReportBody(
  body: Record<string, unknown>,
  current: ShiftReport,
): ShiftReport {
  return {
    ...current,
    observations: parseObservations(body.observations),
    presentationTags: parseTags(body.presentationTags),
    formAnswers: parseFormAnswers(body.formAnswers),
    gaps: parseGaps(body.gaps),
    presentation: readString(body.presentation).slice(0, 4000),
    support: readString(body.support).slice(0, 4000),
    status: parseStatus(body.status, current.status),
    updatedAt: new Date().toISOString(),
  };
}
