import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build`         -> dist/ normal (para empaquetar dentro de la app UWP)
// `npm run build:single`  -> dist-single/index.html autocontenido (vista previa / demo)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [svelte(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    // Chromium de WebView2 en Xbox es moderno; no hace falta transpilar a ES5
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
}))
