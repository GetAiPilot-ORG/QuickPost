import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDev = mode === 'development';
  const apiTarget = env.VITE_DEV_API_URL || env.VITE_API_URL || 'http://127.0.0.1:5000';

  return {
    plugins: [react()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          timeout: 300000,
          proxyTimeout: 300000,
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        },
      },
    },

    build: {
      sourcemap: isDev,
      chunkSizeWarningLimit: 400,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'scheduler'],
            'motion-vendor': ['framer-motion', 'gsap'],
            'supabase-vendor': ['@supabase/supabase-js'],
            'icons-vendor': ['lucide-react', 'react-icons'],
            'radix-vendor': [
              '@radix-ui/react-avatar',
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-label',
              '@radix-ui/react-select',
              '@radix-ui/react-separator',
              '@radix-ui/react-slot',
              '@radix-ui/react-switch',
              '@radix-ui/react-tabs',
            ],
          },
        },
      },
    },

    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'framer-motion',
        '@supabase/supabase-js',
        'axios',
        'lucide-react',
      ],
      exclude: ['gsap'],
    },
  };
});
