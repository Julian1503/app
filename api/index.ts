/** Punto de entrada de la funcion serverless de Vercel.
 *
 *  Vercel entrega req/res de Node crudos, que es lo que una app de Express
 *  espera, asi que la app sirve de handler tal cual.
 *
 *  La app se carga con `import()` dinamico y dentro de un try. El motivo es
 *  concreto: `server/config.ts` valida el entorno al importarse y lanza si
 *  falta algo. Con un import estatico, esa excepcion mata la funcion antes de
 *  que corra una sola linea nuestra, y Vercel devuelve un
 *  FUNCTION_INVOCATION_FAILED en texto plano que no dice nada. Asi el mismo
 *  fallo llega como JSON con el motivo. */

import type { IncomingMessage, ServerResponse } from 'node:http';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

let cached: Handler | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!cached) {
    try {
      const { createApp } = await import('../server/app.ts');
      cached = createApp() as unknown as Handler;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[horas] no se pudo iniciar la app:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: `El servidor no pudo iniciar: ${detail}` }));
      return;
    }
  }
  cached(req, res);
}
