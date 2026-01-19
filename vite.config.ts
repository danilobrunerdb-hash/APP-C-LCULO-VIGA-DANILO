import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente (como a API_KEY do Vercel)
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Isso permite que 'process.env.API_KEY' funcione no código do navegador
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});