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
import { parsePayslipPages } from './parse.js';

async function listPdfs(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
    .map((entry) => entry.name)
    .sort();
}

/** Tarifa de la hora ordinaria de un payslip. Marca la era salarial: el award
 *  sube todos los 1 de julio y ese dia se mueven todas las tarifas juntas. */
function ordinaryRateOf(payslip: Payslip): number | null {
  const line = payslip.lines.find((entry) => /^Ordinary Hours/i.test(entry.label));
  return line?.rate ?? null;
}

/** Los payslips no imprimen cuantos sleepovers liquidaron, solo el importe. La
 *  tarifa unitaria se deduce del menor importe positivo, que corresponde a una
 *  semana con un unico sleepover.
 *
 *  El calculo va **por era salarial**, no sobre todo el historial: el sleepover
 *  paso de $60.02 a $62.87 el 1 de julio de 2026, y usar el minimo global daria
 *  cantidades infladas en las semanas nuevas (11 noches a $62.87 divididas por
 *  $60.02 dan 12). Las eras se separan por la tarifa de la hora ordinaria.
 *
 *  Necesita el historial completo para acertar, y por eso corre al importar la
 *  carpeta entera y no payslip por payslip. */
function inferSleepoverCounts(payslips: readonly Payslip[]): Payslip[] {
  const eras = new Map<string, number[]>();
  let lastRate = 'sin-tarifa';

  for (const slip of payslips) {
    const rate = ordinaryRateOf(slip);
    if (rate !== null) lastRate = String(rate);
    if (slip.sleepoverAmount > 0) {
      eras.set(lastRate, [...(eras.get(lastRate) ?? []), slip.sleepoverAmount]);
    }
  }

  const unitRates = new Map<string, number>();
  for (const [era, amounts] of eras) unitRates.set(era, Math.min(...amounts));

  lastRate = 'sin-tarifa';
  return payslips.map((slip) => {
    const rate = ordinaryRateOf(slip);
    if (rate !== null) lastRate = String(rate);
    if (slip.sleepoverCount > 0 || slip.sleepoverAmount <= 0) return slip;

    const unitRate = unitRates.get(lastRate);
    if (!unitRate || unitRate <= 0) return slip;
    return { ...slip, sleepoverCount: Math.round(slip.sleepoverAmount / unitRate) };
  });
}

/** Deduplica payslips que aparecen en mas de un PDF: mismo periodo, mismo pago. */
function dedupe(payslips: readonly Payslip[]): Payslip[] {
  const byPeriod = new Map<string, Payslip>();
  for (const payslip of payslips) {
    const key = `${payslip.periodStart}:${payslip.periodEnd}`;
    const existing = byPeriod.get(key);
    // Ante duplicados gana el que tenga mas lineas parseadas.
    if (!existing || payslip.lines.length > existing.lines.length) {
      byPeriod.set(key, payslip);
    }
  }
  return [...byPeriod.values()].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
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
