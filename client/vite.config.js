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
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'react-vendor', test: /node_modules\/(react|react-dom|scheduler)\// },
              { name: 'motion-vendor', test: /node_modules\/(framer-motion|gsap)\// },
              { name: 'supabase-vendor', test: /node_modules\/@supabase\// },
              { name: 'icons-vendor', test: /node_modules\/(lucide-react|react-icons)\// },
              { name: 'radix-vendor', test: /node_modules\/@radix-ui\// },
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
