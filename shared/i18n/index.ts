/** Idioma de la app. Un solo objeto `I18n` viaja por todos lados en vez de tres
 *  parametros sueltos: traducir un texto casi siempre implica tambien formatear
 *  una fecha o un importe, y separarlos garantiza que tarde o temprano uno quede
 *  en el idioma equivocado.
 *
 *  El reporte se arma en el servidor ya traducido, porque los hallazgos son
 *  prosa con interpolaciones y mantenerlos como claves + parametros hasta la UI
 *  costaria mas de lo que rinde. El cliente vuelve a pedir `/api/report` cuando
 *  cambia de idioma. */

import type { IsoDate } from '../types.js';
import { en } from './en.js';
import { es, type Messages } from './es.js';

export type Locale = 'es' | 'en';

export const LOCALES: readonly Locale[] = ['es', 'en'];

export const DEFAULT_LOCALE: Locale = 'es';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Normaliza cualquier entrada (query param, localStorage, `navigator.language`)
 *  a un idioma soportado. */
export function resolveLocale(value: unknown): Locale {
  if (isLocale(value)) return value;
  if (typeof value === 'string' && value.toLowerCase().startsWith('en')) return 'en';
  return DEFAULT_LOCALE;
}

const CATALOGUES: Readonly<Record<Locale, Messages>> = { es, en };

/** Los parametros de una clave salen de su propia entrada: las que son texto
 *  plano no reciben nada y las que son funcion reciben exactamente su objeto. */
type ParamsOf<K extends keyof Messages> = Messages[K] extends (params: infer P) => string
  ? [params: P]
  : [];

export type Translate = <K extends keyof Messages>(key: K, ...params: ParamsOf<K>) => string;

const DAY_NAMES: Readonly<Record<Locale, readonly string[]>> = {
  es: ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

const MONTH_NAMES: Readonly<Record<Locale, readonly string[]>> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** Los importes se muestran igual en los dos idiomas: son dolares australianos y
 *  el payslip los imprime en formato australiano. Traducir el separador de miles
 *  solo lograria que el numero no coincidiera con el PDF que tenes al lado. */
const MONEY = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  currencyDisplay: 'narrowSymbol',
});

export interface I18n {
  readonly locale: Locale;
  readonly t: Translate;
  /** `jue 13 ago` / `Thu 13 Aug`. */
  readonly date: (iso: IsoDate) => string;
  /** `jue 6 ago - mie 12 ago` / `Thu 6 Aug - Wed 12 Aug`. */
  readonly range: (from: IsoDate, to: IsoDate) => string;
  /** `$1,740.52` en ambos idiomas. */
  readonly money: (value: number) => string;
  /** Fecha y hora completas, para el sello del ultimo sync. */
  readonly dateTime: (value: string) => string;
}

export function createI18n(locale: Locale): I18n {
  const catalogue = CATALOGUES[locale];

  const t = ((key, ...params) => {
    const entry = catalogue[key];
    return typeof entry === 'function'
      ? (entry as (p: unknown) => string)(params[0])
      : (entry as string);
  }) as Translate;

  // Se parsea a mano en UTC, igual que el resto de la app: dejarlo en manos del
  // huso del navegador corre los dias y arruina las quincenas.
  const date = (iso: IsoDate): string => {
    const value = new Date(`${iso}T00:00:00Z`);
    const day = DAY_NAMES[locale][value.getUTCDay()];
    const month = MONTH_NAMES[locale][value.getUTCMonth()];
    return `${day} ${value.getUTCDate()} ${month}`;
  };

  return {
    locale,
    t,
    date,
    range: (from, to) => `${date(from)} - ${date(to)}`,
    money: (value) => MONEY.format(value),
    dateTime: (value) =>
      new Date(value).toLocaleString(locale === 'es' ? 'es-AR' : 'en-AU', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
  };
}

export type { Messages };
