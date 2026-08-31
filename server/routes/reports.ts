/** Reportes de turno: listado, guardado, mapeo al formulario y salida final. */

import { Router, type Request, type Response } from 'express';
import { config } from '../config.js';
import { createI18n, resolveLocale } from '../../shared/i18n/index.js';
import { renderForForm, usableAnswers } from '../../shared/form/answers.js';
import { FORM_FIELDS } from '../../shared/form/schema.js';
import { BEHAVIOURS } from '../../shared/reports/behaviours.js';
import { selectClientShifts } from '../../shared/reports/select.js';
import { PRESENTATION_TAGS } from '../../shared/reports/tags.js';
import { emptyReport, type ReportEntry } from '../../shared/reports/types.js';
import { MissingApiKeyError } from '../reports/claude.js';
import { extractForm } from '../form/extract.js';
import { finaliseForm } from '../form/finalise.js';
import { parseReportBody, readReports, writeReport } from '../reports/store.js';
import { readShifts } from './sync.js';

export const reportsRouter = Router();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function buildEntries(): Promise<ReportEntry[]> {
  const [state, reports] = await Promise.all([readShifts(), readReports()]);
  const shifts = selectClientShifts(state.shifts, {
    clientName: config.reportsClientName,
    from: config.reportsStartDate,
    today: today(),
  });
  return shifts.map((shift) => ({ shift, report: reports[shift.id] ?? null }));
}

reportsRouter.get('/shift-reports', async (_req, res, next) => {
  try {
    res.json({
      entries: await buildEntries(),
      behaviours: BEHAVIOURS,
      tags: PRESENTATION_TAGS,
      fields: FORM_FIELDS,
      meta: {
        clientName: config.reportsClientName,
        from: config.reportsStartDate,
        model: config.anthropicModel,
        hasApiKey: config.anthropicApiKey.length > 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/** Busca el turno entre los que llevan reporte. */
async function findEntry(shiftId: string): Promise<ReportEntry | null> {
  const entries = await buildEntries();
  return entries.find((entry) => entry.shift.id === shiftId) ?? null;
}

/** Corre `run` sobre el turno pedido, guardando primero lo que hay en pantalla. */
async function withReport(
  req: Request,
  res: Response,
  run: (entry: ReportEntry, saved: ReturnType<typeof parseReportBody>) => Promise<unknown>,
): Promise<void> {
  const { t } = createI18n(resolveLocale(req.query.locale));
  const shiftId = String(req.params.shiftId);
  const entry = await findEntry(shiftId);
  if (!entry) {
    res.status(404).json({ error: t('server.reports.unknownShift') });
    return;
  }
  const current = entry.report ?? emptyReport(shiftId, entry.shift.date);
  const saved = parseReportBody((req.body ?? {}) as Record<string, unknown>, current);
  res.json(await run(entry, saved));
}

reportsRouter.put('/shift-reports/:shiftId', async (req, res, next) => {
  try {
    await withReport(req, res, async (_entry, saved) => {
      await writeReport(saved);
      return saved;
    });
  } catch (error) {
    next(error);
  }
});

/** Etapa 1: mapea la nota de Deputy al formulario y lista lo que falta. */
reportsRouter.post('/shift-reports/:shiftId/extract', async (req, res, next) => {
  try {
    await withReport(req, res, async (entry, saved) => {
      const { answers, gaps } = await extractForm(entry.shift, saved);

      // Lo que ya confirmaste a mano sobrevive al remapeo: solo se reemplaza lo
      // que salio de la nota.
      const confirmed = saved.formAnswers.filter((answer) => answer.status !== 'documented');
      const extractedIds = new Set(confirmed.map((answer) => answer.fieldId));

      const updated = {
        ...saved,
        formAnswers: [...confirmed, ...answers.filter((a) => !extractedIds.has(a.fieldId))],
        gaps,
        updatedAt: new Date().toISOString(),
      };
      await writeReport(updated);
      return updated;
    });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }
    next(error);
  }
});

/** Etapa 2: redacta los campos de texto libre y arma el formulario para pegar. */
reportsRouter.post('/shift-reports/:shiftId/finalise', async (req, res, next) => {
  try {
    await withReport(req, res, async (_entry, saved) => {
      const { t } = createI18n(resolveLocale(req.query.locale));
      if (usableAnswers(saved.formAnswers).length === 0) {
        throw new MissingApiKeyError(t('server.reports.nothingToFinalise'));
      }

      const finalised = await finaliseForm(saved.formAnswers);
      const updated = {
        ...saved,
        formAnswers: finalised,
        draft: renderForForm(finalised),
        draftedAt: new Date().toISOString(),
        status: saved.status === 'submitted' ? saved.status : ('drafted' as const),
        updatedAt: new Date().toISOString(),
      };
      await writeReport(updated);
      return updated;
    });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }
    next(error);
  }
});
