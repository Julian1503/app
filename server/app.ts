/** Construccion del Express. Vive separado de `index.ts` porque tiene dos
 *  consumidores con formas distintas de arrancar: el servidor local, que llama
 *  a `listen()`, y la funcion serverless de Vercel (`api/index.ts`), que no
 *  puede escuchar un puerto y exporta la app como handler. */

import express from 'express';
import { requireUser } from './auth.js';
import { config } from './config.js';
import { NotAuthenticatedError } from './deputy/client.js';
import { analysisRouter } from './routes/analysis.js';
import { authRouter } from './routes/auth.js';
import { reportsRouter } from './routes/reports.js';
import { syncRouter } from './routes/sync.js';

export function createApp(): express.Express {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  // Con el front y el API en el mismo dominio esto no hace falta, pero en
  // desarrollo son dos origenes (5173 y 8787) y sin esto el navegador bloquea.
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', config.webOrigin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Nada de /api responde sin sesion valida.
  app.use(requireUser);

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

  return app;
}
