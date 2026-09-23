import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      hmr: process.env.DISABLE_HMR !== 'true' ? { overlay: true } : false,
      watch: { usePolling: false },
    },
    build: {
      // OTIMIZAÇÃO MOBILE: chunk splitting + target moderno + minify
      target: 'es2018',
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'motion'],
            'supabase': ['@supabase/supabase-js'],
            'drawing': ['konva', 'react-konva'],
            'icons': ['lucide-react'],
          },
        },
      },
    },
    esbuild: {
      // Remove console em produção para economizar bytes
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
  };
});
