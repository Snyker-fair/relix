import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import pkg from './package.json' with { type: 'json' }

// `npm run build`         -> the normal dist/ (to package inside the UWP app)
// `npm run build:single`  -> dist-single/index.html, self-contained (preview / demo)
export default defineConfig(({ mode }) => ({
  base: './',
  // Version and build date, for Options › About
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [svelte(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    // WebView2's Chromium on Xbox is modern; there's no need to transpile to ES5
    target: 'es2022',
    rollupOptions: {
      // Fixed names, without random code (index.js and not index-CDvk.js).
      // Visual Studio builds the package with the list of files in ui/; if the
      // names changed on every build, it could end up pointing at
      // files that no longer exist.
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
    setupFiles: ['tests/setup.js'],
  },
}))
