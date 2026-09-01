/** Normalizacion de un conjunto de payslips: deduplicar e inferir sleepovers.
 *
 *  Son funciones puras y sin pdfjs a proposito. Las usan los dos caminos que
 *  escriben en la base -el importador de la carpeta y la subida desde la UI- y
 *  las dos necesitan operar sobre el historial completo, no sobre un archivo. */

import type { Payslip } from '../../shared/types.js';

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
 *  Necesita el historial completo para acertar. Por eso subir un payslip suelto
 *  obliga a recalcular sobre todos los que ya estan guardados. */
export function inferSleepoverCounts(payslips: readonly Payslip[]): Payslip[] {
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

/** Deduplica payslips que aparecen en mas de un PDF: mismo periodo, mismo pago.
 *
 *  Los de `incoming` se procesan despues que los de `existing`, asi que ante un
 *  empate de calidad gana el que ya estaba: volver a subir el mismo archivo no
 *  cambia nada. */
export function dedupe(payslips: readonly Payslip[]): Payslip[] {
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
