/** Pantalla de acceso. Es lo unico que se ve sin sesion.
 *
 *  No hay registro a proposito: la cuenta se crea a mano en el panel de
 *  Supabase y el servidor ademas exige que el id coincida con ALLOWED_USER_ID.
 *  Una app con sueldos y reportes de salud no lleva alta publica. */

import { useState, type FormEvent } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase.ts';

export function Login(): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: failure } = await supabase.auth.signInWithPassword({ email, password });
    if (failure) setError(failure.message);
    setBusy(false);
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="card empty">
        <p>Faltan SUPABASE_URL y SUPABASE_ANON_KEY en el entorno del front.</p>
      </div>
    );
  }

  return (
    <form className="card login" onSubmit={handleSubmit}>
      <h1>Horas</h1>
      <p className="login__note">Control de la condición 8105 y auditoría de pagos.</p>

      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <label htmlFor="password">Contraseña</label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      {error && <p className="login__error">{error}</p>}

      <button className="button" type="submit" disabled={busy}>
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
