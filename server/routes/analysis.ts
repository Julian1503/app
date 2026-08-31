/** Reporte completo y edicion del calendario academico. */

import { Router } from 'express';
import { config } from '../config.js';
import { createI18n, resolveLocale } from '../../shared/i18n/index.js';
import { buildReport } from '../../shared/report.js';
import type { TermBreak } from '../../shared/visa/fortnights.js';
import { readHolidays, readTermBreaks, writeTermBreaks } from '../db/calendar.js';
import { loadPayslips } from '../payslips/load.js';
import { readShifts } from './sync.js';

export const analysisRouter = Router();

analysisRouter.get('/term-breaks', async (_req, res, next) => {
  try {
    res.json(await readTermBreaks());
  } catch (error) {
    next(error);
  }
});

analysisRouter.put('/term-breaks', async (req, res, next) => {
  try {
    const { t } = createI18n(resolveLocale(req.query.locale));
    const body: unknown = req.body;
    if (!Array.isArray(body)) {
      res.status(400).json({ error: t('server.termBreaks.notAList') });
      return;
    }

    const invalid = body.find(
      (entry) =>
        typeof entry !== 'object' ||
        entry === null ||
        !/^\d{4}-\d{2}-\d{2}$/.test((entry as TermBreak).start ?? '') ||
        !/^\d{4}-\d{2}-\d{2}$/.test((entry as TermBreak).end ?? ''),
    );
    if (invalid) {
      res.status(400).json({ error: t('server.termBreaks.badDates') });
      return;
    }

    await writeTermBreaks(body as TermBreak[]);
    res.json(body);
  } catch (error) {
    next(error);
  }
});

analysisRouter.get('/report', async (req, res, next) => {
  try {
    const i18n = createI18n(resolveLocale(req.query.locale));
    const [state, payslipResult, breaks, holidays] = await Promise.all([
      readShifts(),
      loadPayslips(),
      readTermBreaks(),
      readHolidays(),
    ]);

    const report = buildReport({
      shifts: state.shifts,
      payslips: payslipResult.payslips,
      breaks,
      holidays: holidays.map((holiday) => holiday.date),
      limit: config.limit,
      kmRate: config.kmRate,
      today: new Date().toISOString().slice(0, 10),
      i18n,
    });

    res.json({
      report,
      meta: {
        lastSyncAt: state.lastSyncAt,
        shiftCount: state.shifts.length,
        payslipFiles: payslipResult.filesRead,
        payslipFailures: payslipResult.failures,
        termBreaks: breaks,
        holidays,
        kmRate: config.kmRate,
        locale: i18n.locale,
      },
    });
  } catch (error) {
    next(error);
  }
});
