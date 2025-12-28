import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    target: 'ES2020',
    minify: 'terser',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          'dsteem': ['dsteem'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
        }
      },
      onwarn(warning, warn) {
        // Suppress eval warning from dsteem
        if (warning.code === 'EVAL' && warning.id?.includes('dsteem')) {
          return;
        }
        warn(warning);
      }
    }
  },
  plugins: [
    react(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['regenerator-runtime']
  }
}));
