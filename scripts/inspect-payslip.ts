/** Herramienta de diagnostico: muestra como quedo parseado un payslip.
 *  Uso: npx tsx scripts/inspect-payslip.ts "../payslips/06 aug - 12 aug.pdf" */

import fs from 'node:fs/promises';
import { extractPages } from '../server/payslips/pdf-text.ts';
import { parsePayslipPages } from '../server/payslips/parse.ts';

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error('Falta la ruta del PDF.');
    process.exitCode = 1;
    return;
  }

  const data = await fs.readFile(file);
  const pages = await extractPages(new Uint8Array(data));
  console.log(`Paginas: ${pages.length}`);

  if (process.argv.includes('--tokens')) {
    for (const row of pages[0]?.rows ?? []) {
      const detail = row.tokens.map((token) => `${token.text}@${token.x.toFixed(0)}`).join('  ');
      console.log(`y=${row.y.toFixed(0).padStart(4)}  ${detail}`);
    }
    return;
  }

  const slips = parsePayslipPages(pages, file);
  if (slips.length === 0) {
    console.log('No se reconocio ningun payslip. Volcado de las primeras filas:');
    for (const row of pages[0]?.rows.slice(0, 30) ?? []) {
      console.log(`  y=${row.y.toFixed(0).padStart(4)}  ${row.text}`);
    }
    return;
  }

  for (const slip of slips) {
    console.log(`\n=== ${slip.periodStart} -> ${slip.periodEnd} (pago ${slip.paymentDate}) ===`);
    console.log(
      `total $${slip.totalEarnings} | neto $${slip.netPay} | cierra: ${!slip.arithmeticMismatch}`,
    );
    console.log(
      `horas ${slip.paidHours} | sleepovers ${slip.sleepoverCount} | night ${slip.nightHours} | travel $${slip.travelCostsPaid}`,
    );
    for (const line of slip.lines) {
      const qty = String(line.quantity ?? '-').padStart(9);
      const rate = String(line.rate ?? '-').padStart(9);
      console.log(`  ${line.label.padEnd(36)} ${qty} x ${rate} = ${line.amount}`);
    }
    const sum = slip.lines.reduce((acc, line) => acc + line.amount, 0);
    console.log(`  suma de lineas: ${Math.round(sum * 100) / 100}`);

    // El Back Pay se cobra aca pero es plata de otras semanas: sin ver a cuales
    // se imputa no se puede saber si alguna quedo saldada a medias.
    if (slip.backPay) {
      console.log(`  back pay: $${slip.backPay.amount} (sin imputar $${slip.backPay.unallocated})`);
      for (const entry of slip.backPay.allocations) {
        console.log(
          `    ${entry.periodStart} -> ${entry.periodEnd}  ${entry.hours} h  $${entry.amount}`,
        );
      }
      for (const line of slip.backPay.unreadable) console.log(`    ilegible: ${line}`);
    }
  }
}

await main();
