/** Cliente de Claude API, compartido por las dos etapas del formulario.
 *
 *  Se usa el SDK oficial en vez de fetch a pelo para no reimplementar reintentos,
 *  timeouts y el tipado de la respuesta. */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

export class MissingApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingApiKeyError';
  }
}

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!config.anthropicApiKey) {
    throw new MissingApiKeyError(
      'Falta ANTHROPIC_API_KEY en el .env: sin eso no se puede redactar el reporte.',
    );
  }
  // Se cachea: el SDK mantiene el pool de conexiones y crear uno por request lo tira.
  client ??= new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
}
