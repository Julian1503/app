/** El `state` del login de Deputy, con TTL.
 *
 *  Es la defensa contra CSRF del flujo OAuth: se emite al mandar al usuario a
 *  Deputy y se exige de vuelta en el callback. Va a la base porque en
 *  serverless las dos mitades del flujo corren en instancias distintas. */

import { assertOk, db } from './client.ts';

/** Un login a medias no deberia bloquear el proximo intento. */
const TTL_MS = 10 * 60 * 1000;

export async function rememberState(state: string): Promise<void> {
  assertOk(
    await db()
      .from('oauth_states')
      .insert({ state, expires_at: new Date(Date.now() + TTL_MS).toISOString() }),
    'No se pudo iniciar el login de Deputy',
  );
}

/** Devuelve true una sola vez por state: si vuelve a aparecer, ya no existe. */
export async function consumeState(state: string | undefined): Promise<boolean> {
  if (!state) return false;

  // Se borra por `state` y se pide la fila de vuelta: si no vuelve nada, o no
  // existia o ya lo uso otro. El delete es la operacion atomica que evita que
  // dos callbacks simultaneos pasen los dos.
  const result = await db()
    .from('oauth_states')
    .delete()
    .eq('state', state)
    .gte('expires_at', new Date().toISOString())
    .select('state');

  assertOk(result, 'No se pudo validar el login de Deputy');
  return (result.data ?? []).length > 0;
}

/** Limpieza oportunista de los vencidos. No es critica: si falla, se ignora. */
export async function purgeExpiredStates(): Promise<void> {
  await db().from('oauth_states').delete().lt('expires_at', new Date().toISOString());
}
