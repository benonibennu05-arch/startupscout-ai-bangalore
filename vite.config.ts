import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
    watch: {
      ignored: [
        '**/data/**',
        '**/backups/**',
        '**/fixtures/**',
        '**/*.db*',
        '**/*.db-wal*',
        '**/*.db-shm*',
        '**/*.sqlite*',
        '**/database.json*',
        '**/server/**',
      ],
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: 'esbuild',
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react', 'motion'],
          sheet: ['xlsx'],
        },
      },
    },
  },
});
