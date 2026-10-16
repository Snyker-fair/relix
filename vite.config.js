import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import pkg from './package.json' with { type: 'json' }

// `npm run build`         -> dist/ normal (para empaquetar dentro de la app UWP)
// `npm run build:single`  -> dist-single/index.html autocontenido (vista previa / demo)
export default defineConfig(({ mode }) => ({
  base: './',
  // Versión y fecha de compilación, para Opciones › Acerca de
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [svelte(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    // Chromium de WebView2 en Xbox es moderno; no hace falta transpilar a ES5
    target: 'es2022',
    rollupOptions: {
      // Nombres fijos, sin código aleatorio (index.js y no index-CDvk.js).
      // Visual Studio arma el paquete con la lista de archivos de ui/; si los
      // nombres cambiaran en cada compilación, podría quedar apuntando a
      // archivos que ya no existen.
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
}))
