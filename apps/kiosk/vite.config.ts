import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Kiosk build tuned for a Raspberry Pi 3 B+ running Cog/WPE WebKit.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  css: {
    modules: {
      // Short, stable class names in production keep the CSS small.
      generateScopedName: mode === 'production' ? '[hash:base64:6]' : '[name]_[local]',
    },
  },
  server: {
    // Music agent search API (pnpm --filter @hub/music-agent start).
    proxy: {
      '/api/music': {
        target: 'http://127.0.0.1:8787',
        rewrite: (path) => path.replace(/^\/api\/music/, ''),
      },
    },
  },
  preview: {
    proxy: {
      '/api/music': {
        target: 'http://127.0.0.1:8787',
        rewrite: (path) => path.replace(/^\/api\/music/, ''),
      },
    },
  },
  build: {
    // WPE WebKit tracks Safari; keep output conservative.
    target: ['es2020', 'safari14'],
    cssTarget: ['safari14'],
    sourcemap: false,
    // One small chunk per screen (see React.lazy in App.tsx).
    chunkSizeWarningLimit: 400,
  },
}))
