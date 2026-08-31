import { useMemo, useState } from 'react';
import { createI18n } from '@shared/i18n/index.ts';
import type { DropSuggestion, Fortnight } from '@shared/types.ts';
import { useI18n } from '../lib/i18n.tsx';

interface Props {
  readonly plan: readonly DropSuggestion[];
  readonly overFortnights: readonly Fortnight[];
  readonly limit: number;
}

/** El borrador va **siempre en inglés**, sin importar el idioma de la app: se
 *  manda tal cual a un manager australiano. Por eso arma sus propias fechas con
 *  un formateador en inglés en vez del que sigue al selector de idioma.
 *
 *  Deliberadamente no menciona la visa como un problema: pide reducción de
 *  carga, que es lo que se negocia. */
function draftMessage(
  plan: readonly DropSuggestion[],
  overFortnights: readonly Fortnight[],
): string {
  const english = createI18n('en');
  const periods = overFortnights.map((f) => english.range(f.start, f.end)).join('; ');
  const bullets = plan
    .map(
      (item) =>
        `  - ${english.date(item.date)} ${item.time}${item.area ? ` · ${item.area}` : ''} (${item.hoursFreed} h)`,
    )
    .join('\n');
  const totalFreed = plan.reduce((sum, item) => sum + item.hoursFreed, 0);

  return [
    'Hi,',
    '',
    'I need to reduce my rostered hours for the coming period. As a student I have a',
    'cap of 48 hours per fortnight while my course is in session, and the current',
    `roster puts me over it${periods ? ` (${periods})` : ''}.`,
    '',
    'Could these shifts be reassigned, please?',
    bullets,
    '',
    `That would bring me back under the cap (${Math.round(totalFreed * 100) / 100} h in total).`,
    'Happy to keep everything else as rostered, and to pick up extra shifts during the',
    'term breaks, when the cap does not apply.',
    '',
    'Thanks,',
    'Julian',
  ].join('\n');
}

export function DropPlan({ plan, overFortnights, limit }: Props): JSX.Element {
  const { i18n } = useI18n();
  const { t } = i18n;
  const [copied, setCopied] = useState(false);
  const message = useMemo(() => draftMessage(plan, overFortnights), [plan, overFortnights]);

  if (plan.length === 0) {
    return <div className="card empty">{t('drop.empty', { limit })}</div>;
  }

  const totalFreed = Math.round(plan.reduce((sum, item) => sum + item.hoursFreed, 0) * 100) / 100;

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="card drop">
      <div>
        <p className="eyebrow">{t('drop.eyebrow')}</p>
        <h3>{t('drop.headline', { shifts: plan.length, hours: totalFreed })}</h3>
        <p className="section__note">{t('drop.note')}</p>
      </div>

      <ul className="drop__list">
        {plan.map((item) => (
          <li key={item.shiftId} className="drop__item">
            <span>
              {i18n.date(item.date)} {item.time}
              {item.area ? ` · ${item.area}` : ''}
            </span>
            <span className="drop__freed">−{item.hoursFreed} h</span>
          </li>
        ))}
      </ul>

      <div>
        <div className="section__head">
          <h2>{t('drop.managerMessage')}</h2>
          <button type="button" className="button button--ghost" onClick={copy}>
            {copied ? t('drop.copied') : t('drop.copy')}
          </button>
        </div>
        <p className="section__note">{t('drop.managerNote')}</p>
        {/* `key` fuerza el remontaje: sin eso el textarea, que no es controlado,
            se queda con el borrador viejo despues de un sync. */}
        <textarea
          key={message}
          className="draft"
          defaultValue={message}
          spellCheck={false}
          lang="en"
        />
      </div>
    </section>
  );
}
