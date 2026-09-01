/** Subida de payslips desde la UI. */

import { Router, raw } from 'express';
import { createI18n, resolveLocale } from '../../shared/i18n/index.js';
import { ingestPayslipPdf, PayslipParseError } from '../payslips/ingest.js';

export const payslipsRouter = Router();

/** Un payslip ronda los 100 kb. El tope deja margen para varios periodos en un
 *  mismo PDF sin habilitar subidas de cualquier tamaño. */
const MAX_PDF_BYTES = 8 * 1024 * 1024;

const PDF_MAGIC = '%PDF-';

payslipsRouter.post(
  '/payslips',
  raw({ type: 'application/pdf', limit: MAX_PDF_BYTES }),
  async (req, res, next) => {
    try {
      const { t } = createI18n(resolveLocale(req.query.locale));
      const body = req.body as Buffer | undefined;

      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: t('server.payslips.empty') });
        return;
      }

      // Verificar la firma evita mandar a pdfjs cualquier cosa que alguien
      // renombro a .pdf, y da un error entendible en vez de uno del parser.
      if (body.subarray(0, PDF_MAGIC.length).toString('latin1') !== PDF_MAGIC) {
        res.status(400).json({ error: t('server.payslips.notPdf') });
        return;
      }

      const name = typeof req.query.filename === 'string' ? req.query.filename : 'subido.pdf';
      res.json(await ingestPayslipPdf(new Uint8Array(body), name));
    } catch (error) {
      if (error instanceof PayslipParseError) {
        res.status(422).json({ error: error.message });
        return;
      }
      next(error);
    }
  },
);
