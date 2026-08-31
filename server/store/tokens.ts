/** Guarda el par access/refresh token de Deputy cifrado en Supabase.
 *
 *  La clave se deriva del client secret, que vive en el .env y no en la base.
 *  Asi la tabla `deputy_tokens` por si sola no sirve de nada: hace falta
 *  tambien el .env para descifrarla. */

import crypto from 'node:crypto';
import { config } from '../config.js';
import { clearEnvelope, type EncryptedEnvelope, readEnvelope, writeEnvelope } from '../db/tokens.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_SALT = 'horas.deputy.tokens.v1';

export interface TokenSet {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Epoch en ms en que vence el access token. */
  readonly expiresAt: number;
  /** Endpoint que devuelve Deputy al canjear el code; manda sobre el del .env. */
  readonly endpoint: string | null;
  readonly obtainedAt: number;
}

function deriveKey(): Buffer {
  if (!config.clientSecret) {
    throw new Error(
      'Falta DEPUTY_CLIENT_SECRET en el .env: sin el no se pueden cifrar ni leer los tokens.',
    );
  }
  return crypto.scryptSync(config.clientSecret, KEY_SALT, 32);
}

function encrypt(value: TokenSet): EncryptedEnvelope {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return {
    v: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  };
}

function decrypt(envelope: EncryptedEnvelope): TokenSet {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    deriveKey(),
    Buffer.from(envelope.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(plain.toString('utf8')) as TokenSet;
}

export async function loadTokens(): Promise<TokenSet | null> {
  const envelope = await readEnvelope();
  if (!envelope) return null;
  try {
    return decrypt(envelope);
  } catch {
    // Pasa si cambiaste el client secret: la sesion vieja ya no sirve.
    return null;
  }
}

export async function saveTokens(tokens: TokenSet): Promise<void> {
  await writeEnvelope(encrypt(tokens));
}

export async function clearTokens(): Promise<void> {
  await clearEnvelope();
}
