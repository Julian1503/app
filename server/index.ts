/** Servidor local para `npm run dev`.
 *
 *  La app en si se arma en `app.ts`; aca solo se la pone a escuchar. Por
 *  defecto en 127.0.0.1: mientras no haya login, el loopback es lo unico que
 *  separa tus sueldos y los reportes de salud de cualquiera en la red. */

import { config, hasDatabase, hasOAuthCredentials, isPubliclyReachable } from './config.ts';
import { createApp } from './app.ts';

createApp().listen(config.port, config.host, () => {
  console.log(`[horas] API en ${config.apiOrigin}`);
  console.log(`[horas] Front en ${config.webOrigin}`);
  if (isPubliclyReachable()) {
    console.warn(
      `[horas] ATENCION: escuchando en ${config.host}, no en loopback, y la app no tiene login. ` +
        'Cualquiera que llegue a este host ve sueldos y reportes de salud.',
    );
  }
  if (!hasDatabase()) {
    console.error(
      '[horas] Sin SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: no hay donde guardar nada. Ver README.',
    );
  }
  if (!hasOAuthCredentials()) {
    console.warn(
      '[horas] Sin DEPUTY_CLIENT_ID / DEPUTY_CLIENT_SECRET: la app abre igual pero no puede sincronizar.',
    );
  }
});
