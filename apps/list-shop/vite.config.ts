import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  css: {
    modules: {
      generateScopedName: mode === 'production' ? '[hash:base64:6]' : '[name]_[local]',
    },
  },
  build: {
    target: ['es2020'],
    cssCodeSplit: false,
    sourcemap: false,
    assetsInlineLimit: 100_000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'assets/app.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
}))
