/**
 * Versión de Relix (la de package.json) y fecha de compilación.
 * Vite las reemplaza al compilar (ver `define` en vite.config.js).
 */

/* global __APP_VERSION__, __BUILD_DATE__ */
export const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
export const BUILD_DATE = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : ''
