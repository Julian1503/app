/** Puerta de entrada al API: nadie pasa sin sesion de Supabase.
 *
 *  Va siempre activo, tambien en desarrollo. Un flag para apagarlo seria comodo
 *  hoy y el motivo de una filtracion manana: la app maneja sueldos y reportes
 *  de salud de una persona identificable.
 *
 *  Entra cualquier usuario del proyecto de Supabase. Quien puede entrar se
 *  decide alla, no aca: si el registro publico queda habilitado
 *  (Authentication -> Sign In / Providers -> "Allow new users to sign up"),
 *  cualquiera se crea una cuenta y pasa esta puerta. */

import type { RequestHandler } from 'express';
import { db } from './db/client.js';

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

  db()
    .auth.getUser(token)
    .then(({ data, error }) => {
      if (error || !data.user) {
        res.status(401).json({ error: 'Sesion invalida o vencida.', needsLogin: true });
        return;
      }
      next();
    })
    .catch(next);
};
