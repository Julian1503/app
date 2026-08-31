/** Feriados y recesos academicos: las dos tablas que se editan a mano.
 *
 *  Antes vivian en data/holidays.json y data/term-breaks.json. Los feriados se
 *  siguen cargando a mano (ahora desde el table editor de Supabase) porque los
 *  regionales cambian de fecha todos los años; los recesos los edita la UI. */

import type { TermBreak } from '../../shared/visa/fortnights.ts';
import { assertOk, db, unwrap } from './client.ts';

export interface Holiday {
  readonly date: string;
  readonly label: string;
  /** true cuando la fecha esta corroborada por un payslip. */
  readonly confirmed?: boolean;
}

export async function readHolidays(): Promise<Holiday[]> {
  const rows = unwrap(
    await db().from('holidays').select('date, label, confirmed').order('date', { ascending: true }),
    'No se pudieron leer los feriados',
  ) as Array<{ date: string; label: string; confirmed: boolean }>;

  return rows.map((row) => ({ date: row.date, label: row.label, confirmed: row.confirmed }));
}

export async function readTermBreaks(): Promise<TermBreak[]> {
  const rows = unwrap(
    await db()
      .from('term_breaks')
      .select('start_date, end_date, label')
      .order('start_date', { ascending: true }),
    'No se pudieron leer los recesos',
  ) as Array<{ start_date: string; end_date: string; label: string | null }>;

  return rows.map((row) => ({
    start: row.start_date,
    end: row.end_date,
    label: row.label ?? undefined,
  }));
}

/** La UI manda la lista entera, no un delta: se reemplaza todo. */
export async function writeTermBreaks(breaks: readonly TermBreak[]): Promise<void> {
  assertOk(
    await db().from('term_breaks').delete().gte('start_date', '0001-01-01'),
    'No se pudieron borrar los recesos anteriores',
  );

  if (breaks.length === 0) return;

  assertOk(
    await db().from('term_breaks').insert(
      breaks.map((entry) => ({
        start_date: entry.start,
        end_date: entry.end,
        label: entry.label ?? null,
      })),
    ),
    'No se pudieron guardar los recesos',
  );
}
