import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        checkout: resolve(__dirname, 'src/checkout.js'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    // Don't minify for easier debugging
    minify: false,
    // Generate sourcemaps
    sourcemap: true,
  },
  // Define global constants
  define: {
    'process.env': {},
  },
});
