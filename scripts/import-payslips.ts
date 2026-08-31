/** Parsea la carpeta de PDF y guarda el resultado en Supabase.
 *
 *  Se corre a mano: cuando llega un payslip nuevo, y cada vez que toques
 *  server/payslips/parse.ts (antes eso lo resolvia el CACHE_VERSION; ahora lo
 *  resolves corriendo esto de nuevo, que reparsea todo y pisa las filas).
 *
 *  Lee la carpeta entera siempre, no de a un archivo: `inferSleepoverCounts`
 *  necesita el historial completo para separar las eras salariales.
 *
 *  Uso: npm run payslips:import */

import { config } from '../server/config.ts';
import { writePayslips } from '../server/db/payslips.ts';
import { parsePayslipsFromDisk } from '../server/payslips/load.ts';

async function main(): Promise<void> {
  console.log(`Leyendo ${config.payslipsDir}\n`);
  const result = await parsePayslipsFromDisk();

  console.log(`Archivos leidos:      ${result.filesRead}`);
  console.log(`Payslips reconocidos: ${result.payslips.length}`);

  if (result.failures.length > 0) {
    console.log(`\nFallos (${result.failures.length}):`);
    for (const failure of result.failures) {
      console.log(`  ${failure.file}: ${failure.reason}`);
    }
  }

  if (result.payslips.length === 0) {
    console.log('\nNo hay nada que guardar.');
    process.exitCode = result.failures.length > 0 ? 1 : 0;
    return;
  }

  await writePayslips(result.payslips);
  console.log(`\nGuardados ${result.payslips.length} payslips en Supabase.`);

  const broken = result.payslips.filter((slip) => slip.arithmeticMismatch);
  if (broken.length > 0) {
    console.log(`\nOjo: ${broken.length} no cierran aritmeticamente. Detalle: npm run payslips:check`);
  }
}

await main();
