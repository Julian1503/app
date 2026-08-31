import { createI18n, LOCALES } from '@shared/i18n/index.ts';
import { useI18n } from '../lib/i18n.tsx';

/** Selector de idioma. Cada opción se rotula en su propio idioma —"Español",
 *  "English"— porque si se tradujeran, quien no entiende el idioma actual no
 *  podría encontrar el suyo. */
export function LanguageToggle(): JSX.Element {
  const { locale, setLocale, i18n } = useI18n();

  return (
    <div className="langswitch" role="group" aria-label={i18n.t('app.language')}>
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          className={`langswitch__option${option === locale ? ' is-active' : ''}`}
          aria-pressed={option === locale}
          onClick={() => setLocale(option)}
        >
          {createI18n(option).t('app.languageName')}
        </button>
      ))}
    </div>
  );
}
