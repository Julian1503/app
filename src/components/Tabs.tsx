/** Barra de pestañas del tablero.
 *
 *  La pestaña activa vive en la URL (`?tab=pagos`) y no en el estado local: asi
 *  un F5 no te devuelve al principio y podes dejar el link donde lo usas.
 *
 *  Implementa el patron ARIA de tabs completo -roving tabindex y flechas- en
 *  vez de unos botones sueltos: con siete secciones repartidas, moverse con el
 *  teclado deja de ser un lujo. */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface TabDef {
  readonly id: string;
  readonly label: string;
  /** Numero al lado del nombre: cuantos hallazgos, cuantos payslips. */
  readonly badge?: number | null;
}

const PARAM = 'tab';

function readTabFromUrl(tabs: readonly TabDef[]): string {
  const wanted = new URLSearchParams(window.location.search).get(PARAM);
  return tabs.some((tab) => tab.id === wanted) ? wanted! : tabs[0]!.id;
}

export function useTabs(tabs: readonly TabDef[]): [string, (id: string) => void] {
  const [active, setActive] = useState(() => readTabFromUrl(tabs));

  const select = useCallback((id: string): void => {
    setActive(id);
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM, id);
    window.history.replaceState({}, '', url);
  }, []);

  // El boton "atras" del navegador cambia la URL sin remontar el componente.
  useEffect(() => {
    const onPop = (): void => setActive(readTabFromUrl(tabs));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [tabs]);

  return [active, select];
}

interface Props {
  readonly tabs: readonly TabDef[];
  readonly active: string;
  readonly onSelect: (id: string) => void;
}

export function Tabs({ tabs, active, onSelect }: Props): JSX.Element {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function move(delta: number): void {
    const index = tabs.findIndex((tab) => tab.id === active);
    const next = tabs[(index + delta + tabs.length) % tabs.length]!;
    onSelect(next.id);
    refs.current[next.id]?.focus();
  }

  function handleKey(event: React.KeyboardEvent): void {
    if (event.key === 'ArrowRight') move(1);
    else if (event.key === 'ArrowLeft') move(-1);
    else if (event.key === 'Home') onSelect(tabs[0]!.id);
    else if (event.key === 'End') onSelect(tabs[tabs.length - 1]!.id);
    else return;
    event.preventDefault();
  }

  return (
    <div className="navtabs" role="tablist" aria-label="Secciones" onKeyDown={handleKey}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[tab.id] = node;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-controls={`panel-${tab.id}`}
            aria-selected={selected}
            // Roving tabindex: el Tab del teclado entra a la barra una sola vez
            // y despues se navega con las flechas.
            tabIndex={selected ? 0 : -1}
            className={selected ? 'navtabs__item navtabs__item--active' : 'navtabs__item'}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
            {typeof tab.badge === 'number' && <span className="navtabs__badge">{tab.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  id,
  active,
  children,
}: {
  readonly id: string;
  readonly active: string;
  readonly children: React.ReactNode;
}): JSX.Element | null {
  if (id !== active) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={-1}>
      {children}
    </div>
  );
}
