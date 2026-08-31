/// <reference types="vite/client" />

/** Lo que el navegador ve del entorno. Se inyecta desde el `define` de
 *  vite.config.ts, no por el prefijo VITE_, asi que cada variable nueva del
 *  front hay que declararla en los dos lados. */
interface ImportMetaEnv {
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
