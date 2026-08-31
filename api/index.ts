/** Punto de entrada de la funcion serverless de Vercel.
 *
 *  Vercel entrega req/res de Node crudos, que es exactamente lo que una app de
 *  Express espera recibir, asi que la app sirve de handler tal cual. El
 *  `vercel.json` manda todo /api/* aca y el router de Express reparte. */

import { createApp } from '../server/app.ts';

export default createApp();
