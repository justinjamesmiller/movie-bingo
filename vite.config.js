import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  base: './', // relative asset paths so the build works from any subpath (e.g. GitHub Pages project sites)
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/test/**'],
    },
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@supabase/supabase-js')) return 'supabase';
          if (id.includes('qrcode.react')) return 'qrcode';
          return undefined;
        },
      },
    },
  },
});
