/** Idioma en el lado del navegador.
 *
 *  El idioma elegido no se queda en la UI: viaja al servidor en cada llamada,
 *  porque los hallazgos del reporte se redactan alla. Por eso el proveedor
 *  guarda el idioma en un modulo aparte (`api.ts` lo lee sin ser un componente)
 *  ademas de en el contexto de React. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createI18n, resolveLocale, type I18n, type Locale } from '@shared/i18n/index.ts';

const STORAGE_KEY = 'horas.locale';

/** Ultimo idioma elegido, para que el cliente HTTP lo lea sin pasar por React. */
let activeLocale: Locale = 'es';

export function currentLocale(): Locale {
  return activeLocale;
}

function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return resolveLocale(stored);
  } catch {
    // localStorage puede fallar en modo privado; el idioma del navegador alcanza.
  }
  return resolveLocale(navigator.language);
}

interface I18nContextValue {
  readonly i18n: I18n;
  readonly locale: Locale;
  readonly setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface Props {
  readonly children: ReactNode;
}

export function I18nProvider({ children }: Props): JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);
  const i18n = useMemo(() => createI18n(locale), [locale]);

  activeLocale = locale;

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = i18n.t('app.documentTitle');
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Sin persistencia se pierde la eleccion al recargar, nada mas.
    }
  }, [locale, i18n]);

  // `activeLocale` se actualiza antes que el estado para que un fetch disparado
  // por el mismo cambio ya viaje con el idioma nuevo.
  const setLocale = useCallback((next: Locale): void => {
    activeLocale = next;
    setLocaleState(next);
  }, []);

  const value = useMemo(() => ({ i18n, locale, setLocale }), [i18n, locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n necesita estar dentro de <I18nProvider>.');
  return value;
}
