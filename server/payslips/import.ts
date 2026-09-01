/** Parseo de los PDF del disco. Es el trabajo del importador
 *  (`npm run payslips:import`), no del servidor.
 *
 *  Vive aparte de `load.ts` a proposito: este modulo arrastra pdfjs-dist, unos
 *  500 kb que la funcion serverless no tiene por que cargar para leer una tabla
 *  de Postgres. Mientras nadie lo importe desde una ruta, no entra al bundle. */

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import type { Payslip } from '../../shared/types.js';
import type { PayslipLoadResult } from './load.js';
import { extractPages } from './pdf-text.js';
import { dedupe, inferSleepoverCounts } from './normalize.js';
import { parsePayslipPages } from './parse.js';

async function listPdfs(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
    .map((entry) => entry.name)
    .sort();
}

/** Parsea la carpeta de PDF entera y devuelve el set completo, ya deduplicado
 *  y con los sleepovers inferidos, listo para escribir en la base. */
export async function parsePayslipsFromDisk(): Promise<PayslipLoadResult> {
  let files: string[];
  try {
    files = await listPdfs(config.payslipsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        payslips: [],
        filesRead: 0,
        failures: [
          {
            file: config.payslipsDir,
            reason: 'La carpeta de payslips no existe. Revisa PAYSLIPS_DIR en el .env.',
          },
        ],
      };
    }
    throw error;
  }

  const failures: PayslipLoadResult['failures'] = [];
  const collected: Payslip[] = [];

  for (const file of files) {
    try {
      const data = await fs.readFile(path.join(config.payslipsDir, file));
      const pages = await extractPages(new Uint8Array(data));
      const parsed = parsePayslipPages(pages, file);

      if (parsed.length === 0) {
        failures.push({ file, reason: 'No se pudo reconocer ningun periodo de pago en el PDF.' });
      }
      collected.push(...parsed);
    } catch (error) {
      failures.push({ file, reason: (error as Error).message });
    }
  }

  return {
    payslips: inferSleepoverCounts(dedupe(collected)),
    filesRead: files.length,
    failures,
  };
}
