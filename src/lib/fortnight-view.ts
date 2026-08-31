/** Texto del panel de quincena segun donde cae respecto de hoy.
 *
 *  Una quincena cerrada no admite el mismo consejo que una abierta: sobre la
 *  pasada ya no se puede negociar el roster, asi que decirle "pedi que te saquen
 *  turnos" seria mentira. */

import { roundHours } from '@shared/dates.ts';
import type { Translate } from '@shared/i18n/index.ts';
import type { Fortnight } from '@shared/types.ts';

export type FortnightPosition = 'past' | 'current' | 'future';

export function positionOf(fortnight: Fortnight, today: string): FortnightPosition {
  if (fortnight.end < today) return 'past';
  if (fortnight.start > today) return 'future';
  return 'current';
}

export function labelFor(position: FortnightPosition, t: Translate): string {
  if (position === 'past') return t('gauge.position.past');
  if (position === 'future') return t('gauge.position.future');
  return t('gauge.position.current');
}

export function headlineFor(
  fortnight: Fortnight,
  limit: number,
  position: FortnightPosition,
  t: Translate,
): string {
  const margin = roundHours(limit - fortnight.inSession);
  const hours = Math.abs(margin);

  if (position === 'past') {
    return margin >= 0
      ? t('gauge.headline.pastUnder', { hours: margin })
      : t('gauge.headline.pastOver', { hours });
  }
  if (margin >= 0) return t('gauge.headline.left', { hours: margin });
  return position === 'future'
    ? t('gauge.headline.futureOver', { hours })
    : t('gauge.headline.currentOver', { hours });
}

export function verdictFor(
  position: FortnightPosition,
  status: Fortnight['status'],
  t: Translate,
): string {
  const key = `gauge.verdict.${position}.${status === 'ok' ? 'ok' : status}` as const;
  // El mapa explicito evita construir claves que el catalogo no tenga.
  switch (key) {
    case 'gauge.verdict.past.ok':
    case 'gauge.verdict.past.warning':
    case 'gauge.verdict.past.over':
    case 'gauge.verdict.current.ok':
    case 'gauge.verdict.current.warning':
    case 'gauge.verdict.current.over':
    case 'gauge.verdict.future.ok':
    case 'gauge.verdict.future.warning':
    case 'gauge.verdict.future.over':
      return t(key);
  }
}
