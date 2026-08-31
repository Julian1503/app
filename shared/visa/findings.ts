/** Hallazgos relativos a la condicion 8105. */

import { roundHours } from '../dates.ts';
import type { I18n } from '../i18n/index.ts';
import type { Finding, Fortnight } from '../types.ts';

export function checkFortnights(
  fortnights: readonly Fortnight[],
  limit: number,
  today: string,
  i18n: I18n,
): Finding[] {
  const { t, range } = i18n;
  const findings: Finding[] = [];

  const pastOver = fortnights.filter((f) => f.status === 'over' && f.end < today);
  if (pastOver.length > 0) {
    const worst = pastOver.reduce((a, b) => (b.inSession > a.inSession ? b : a));
    findings.push({
      id: 'visa:past-over',
      severity: 'critical',
      category: 'visa',
      title: t('f.visa.pastOver.title', { count: pastOver.length, limit }),
      detail: t('f.visa.pastOver.detail', {
        range: range(worst.start, worst.end),
        hours: worst.inSession,
        over: worst.overBy,
      }),
      amount: null,
      date: worst.start,
    });
  }

  const futureOver = fortnights.filter((f) => f.status === 'over' && f.end >= today);
  for (const fortnight of futureOver) {
    findings.push({
      id: `visa:over:${fortnight.start}`,
      severity: 'critical',
      category: 'visa',
      title: t('f.visa.over.title', { hours: fortnight.inSession, over: fortnight.overBy }),
      detail: t('f.visa.over.detail', { range: range(fortnight.start, fortnight.end) }),
      amount: null,
      date: fortnight.start,
    });
  }

  const warnings = fortnights.filter((f) => f.status === 'warning' && f.end >= today);
  for (const fortnight of warnings) {
    findings.push({
      id: `visa:warn:${fortnight.start}`,
      severity: 'high',
      category: 'visa',
      title: t('f.visa.warn.title', { hours: fortnight.inSession, limit }),
      detail: t('f.visa.warn.detail', {
        range: range(fortnight.start, fortnight.end),
        margin: roundHours(limit - fortnight.inSession),
      }),
      amount: null,
      date: fortnight.start,
    });
  }

  // Escenario conservador: si Home Affairs contara el sleepover completo.
  const conservativeOver = fortnights.filter(
    (f) => f.end >= today && f.status !== 'over' && f.conservative > limit,
  );
  if (conservativeOver.length > 0) {
    const worst = conservativeOver.reduce((a, b) => (b.conservative > a.conservative ? b : a));
    findings.push({
      id: 'visa:conservative',
      severity: 'info',
      category: 'visa',
      title: t('f.visa.conservative.title', { count: conservativeOver.length }),
      detail: t('f.visa.conservative.detail', {
        range: range(worst.start, worst.end),
        hours: worst.conservative,
      }),
      amount: null,
      date: worst.start,
    });
  }

  return findings;
}
