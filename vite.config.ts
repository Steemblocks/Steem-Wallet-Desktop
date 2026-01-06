import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Known Steem API endpoints for dev proxy
const STEEM_PROXY_TARGETS: Record<string, string> = {
  'moecki': 'https://api.moecki.online',
  'steemworld': 'https://steemd.steemworld.org',
  'pennsif': 'https://api.pennsif.net',
  'steemit': 'https://api.steemit.com',
  'justyy': 'https://api.justyy.com',
  'wherein': 'https://api.wherein.io',
  'steememory': 'https://api.steememory.com',
  'boylikegirl': 'https://steemapi.boylikegirl.club',
  'steemitdev': 'https://api.steemitdev.com',
};

// Create proxy config for each node
const createProxyConfig = () => {
  const proxyConfig: Record<string, any> = {};
  
  for (const [key, target] of Object.entries(STEEM_PROXY_TARGETS)) {
    proxyConfig[`/api/steem/${key}`] = {
      target,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(new RegExp(`^/api/steem/${key}`), ''),
      configure: (proxy: any) => {
        proxy.on('proxyReq', (proxyReq: any) => {
          proxyReq.setHeader('Origin', target);
        });
      }
    };
  }
  
  return proxyConfig;
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    // Proxy for development to avoid CORS issues with Steem API
    proxy: createProxyConfig()
  },
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
