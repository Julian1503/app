/// <reference types="vite/client" />

/** `types: ["node"]` en el tsconfig apaga la inclusion automatica de @types, y
 *  sin esta referencia `import.meta.env` no existe para TypeScript. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
