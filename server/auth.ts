/** Puerta de entrada al API: nadie pasa sin sesion de Supabase.
 *
 *  Va siempre activo, tambien en desarrollo. Un flag para apagarlo seria comodo
 *  hoy y el motivo de una filtracion manana: la app maneja sueldos y reportes
 *  de salud de una persona identificable.
 *
 *  Doble control a proposito. El JWT prueba que la sesion es valida; el
 *  `ALLOWED_USER_ID` prueba que ademas sos vos. Con solo lo primero, cualquiera
 *  que consiga registrarse en el proyecto de Supabase entraria. */

import type { RequestHandler } from 'express';
import { config } from './config.ts';
import { db } from './db/client.ts';

/** Deputy vuelve de su login por redirect del navegador, sin forma de mandar un
 *  header. Esa ruta se protege con el `state` de OAuth, no con el JWT. */
const PUBLIC_PATHS = new Set(['/api/auth/callback']);

function bearerFrom(header: string | undefined): string {
  const match = /^Bearer\s+(.+)$/i.exec(header ?? '');
  return match ? match[1].trim() : '';
}

export const requireUser: RequestHandler = (req, res, next) => {
  if (PUBLIC_PATHS.has(req.path)) {
    next();
    return;
  }

  // `/api/auth/login` tambien es una navegacion del navegador: ahi el token
  // viaja en la query, porque un <a href> no lleva headers.
  const token = bearerFrom(req.headers.authorization) ||
    (typeof req.query.token === 'string' ? req.query.token : '');

  if (!token) {
    res.status(401).json({ error: 'Falta la sesion.', needsLogin: true });
    return;
  }

  // El token se valida primero: quien no tiene sesion se va con un 401 y sin
  // enterarse de como esta configurado el servidor.
  db()
    .auth.getUser(token)
    .then(({ data, error }) => {
      if (error || !data.user) {
        res.status(401).json({ error: 'Sesion invalida o vencida.', needsLogin: true });
        return;
      }
      if (!config.allowedUserId) {
        // Fallar cerrado: sin la variable no hay forma de saber quien deberia
        // entrar, y adivinar seria dejar la puerta abierta.
        console.error('[horas] ALLOWED_USER_ID sin configurar: se rechaza todo.');
        res.status(503).json({ error: 'El servidor no esta configurado para aceptar sesiones.' });
        return;
      }
      if (data.user.id !== config.allowedUserId) {
        res.status(403).json({ error: 'Esta cuenta no tiene acceso.' });
        return;
      }
      next();
    })
    .catch(next);
};
