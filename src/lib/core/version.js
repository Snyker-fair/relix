/**
 * Relix's version (the one in package.json) and build date.
 * Vite replaces them when building (see `define` in vite.config.js).
 */

/* global __APP_VERSION__, __BUILD_DATE__ */
export const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
export const BUILD_DATE = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : ''
