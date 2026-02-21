import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Rename Vite's static asset directory so 'public/' can hold React source
  publicDir: 'static',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    // Vite dev server proxies API calls to Express when running standalone;
    // in integrated mode (server.js), Express attaches Vite as middleware instead.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
