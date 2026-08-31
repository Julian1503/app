/** Servidor local. No se expone fuera de localhost: es una herramienta personal
 *  que maneja datos de empleo y credenciales de Deputy. Los datos viven en
 *  Supabase, pero no hay login todavia, asi que la unica puerta sigue siendo
 *  que el proceso escucha en 127.0.0.1. */

import express from 'express';
import { config, hasDatabase, hasOAuthCredentials, isPubliclyReachable } from './config.ts';
import { NotAuthenticatedError } from './deputy/client.ts';
import { analysisRouter } from './routes/analysis.ts';
import { authRouter } from './routes/auth.ts';
import { reportsRouter } from './routes/reports.ts';
import { syncRouter } from './routes/sync.ts';

const app = express();

app.use(express.json({ limit: '1mb' }));

// Solo se aceptan peticiones del front local.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', config.webOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use('/api/auth', authRouter);
app.use('/api', syncRouter);
app.use('/api', analysisRouter);
app.use('/api', reportsRouter);

app.use((req, res) => {
  res.status(404).json({ error: `Ruta desconocida: ${req.method} ${req.path}` });
});

app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ): void => {
    if (error instanceof NotAuthenticatedError) {
      res.status(401).json({ error: error.message, needsAuth: true });
      return;
    }
    console.error('[horas]', error);
    res.status(500).json({ error: error.message });
  },
);

app.listen(config.port, config.host, () => {
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
