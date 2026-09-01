/** Muestra la app solo cuando hay sesion de Supabase; si no, la pantalla de
 *  acceso. Envuelve todo para que ningun componente llegue a pedir datos sin
 *  token y coma un 401. */

import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Login } from './Login.tsx';
import { useI18n } from '../lib/i18n.tsx';
import { supabase } from '../lib/supabase.ts';

export function SessionGate({ children }: { children: ReactNode }): JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    // Cubre el refresh del token y el cierre de sesion en otra pestaña.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (checking) return <div className="card empty">Cargando…</div>;
  if (!session) return <Login />;
  return <>{children}</>;
}

/** Cierra la sesion de la app. Es distinto de `connect.logout`, que solo
 *  desconecta Deputy y deja la sesion abierta. */
export function SignOutButton(): JSX.Element {
  const { i18n } = useI18n();
  return (
    <button className="button button--ghost" onClick={() => void supabase.auth.signOut()}>
      {i18n.t('app.signOut')}
    </button>
  );
}
