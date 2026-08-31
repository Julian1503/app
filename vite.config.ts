import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  // El '' final desactiva el filtro por prefijo, asi que `env` trae todo el
  // .env. Eso vive solo aca, en el proceso de build: al bundle llega
  // unicamente lo que se liste abajo en `define`.
  const env = loadEnv(mode, process.cwd(), '');
  const serverPort = env.SERVER_PORT ?? '8787';

  return {
    plugins: [react()],

    // Lista explicita de lo que ve el navegador. Se prefiere esto al prefijo
    // VITE_ para poder usar nombres limpios en el .env, pero el precio es que
    // hay que agregar aca cada variable nueva del front.
    //
    // NUNCA agregar SUPABASE_SERVICE_ROLE_KEY, DEPUTY_CLIENT_SECRET ni
    // ANTHROPIC_API_KEY: cualquiera de esas queda legible en el JS publicado.
    define: {
      'import.meta.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL ?? ''),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY ?? ''),
    },

    resolve: {
      alias: {
        '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
