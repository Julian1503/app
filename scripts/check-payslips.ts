/** Verificacion masiva: parsea todos los PDF y reporta cuales no cierran.
 *  Lee el disco, no la base: sirve para probar cambios en parse.ts antes de
 *  importarlos. Uso: npm run payslips:check */

import { parsePayslipsFromDisk } from '../server/payslips/load.ts';

const result = await parsePayslipsFromDisk();

console.log(`Archivos leidos: ${result.filesRead}`);
console.log(`Payslips reconocidos: ${result.payslips.length}`);

if (result.failures.length > 0) {
  console.log(`\nFallos (${result.failures.length}):`);
  for (const failure of result.failures) {
    console.log(`  ${failure.file}: ${failure.reason}`);
  }
}

const broken = result.payslips.filter((slip) => slip.arithmeticMismatch);
console.log(`\nNo cierran: ${broken.length} de ${result.payslips.length}`);
for (const slip of broken) {
  const sum = slip.lines
    .filter((line) => line.kind !== 'reimbursement')
    .reduce((acc, line) => acc + line.amount, 0);
  console.log(
    `  ${slip.periodStart} -> ${slip.periodEnd}: suma ${Math.round(sum * 100) / 100} vs total ${slip.totalEarnings}`,
  );
}

console.log('\nPeriodo      horas  sleep  night  travel   bruto');
for (const slip of result.payslips) {
  console.log(
    [
      slip.periodStart,
      String(slip.paidHours).padStart(6),
      String(slip.sleepoverCount).padStart(6),
      String(slip.nightHours).padStart(6),
      `$${slip.travelCostsPaid.toFixed(2)}`.padStart(8),
      `$${slip.totalEarnings.toFixed(2)}`.padStart(9),
    ].join(' '),
  );
}

const totals = result.payslips.reduce(
  (acc, slip) => ({
    hours: acc.hours + slip.paidHours,
    gross: acc.gross + slip.totalEarnings,
    travel: acc.travel + slip.travelCostsPaid,
  }),
  { hours: 0, gross: 0, travel: 0 },
);
console.log(
  `\nTotales: ${Math.round(totals.hours * 100) / 100} h | bruto $${totals.gross.toFixed(2)} | viaticos $${totals.travel.toFixed(2)}`,
);
