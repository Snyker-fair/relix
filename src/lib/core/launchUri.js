/**
 * Construye la URI con la que Xbox abre un emulador y le pasa el juego.
 *
 * Formato (el mismo que usan los frontends existentes, p. ej. RetroPass):
 *
 *   RetroArch:   retroarch:?cmd=retroarch -L cores\<nucleo>.dll "<ruta>"&launchOnExit=<app>:
 *   Standalone:  <protocolo>:?cmd=<exe> "<ruta>"&launchOnExit=<app>:
 *
 * - La ruta del juego va escapada (equivalente a Uri.EscapeDataString de .NET).
 * - `launchOnExit` es el protocolo de NUESTRA app: al cerrar el emulador,
 *   Xbox vuelve automáticamente a Relix.
 * - El resto de la cadena se deja tal cual; el shell en C# hace `new Uri(...)`
 *   y `Launcher.LaunchUriAsync`, que se encarga de los espacios.
 */
import { t } from '../i18n/i18n.svelte.js'

export const APP_PROTOCOL = 'relix'

/**
 * Igual que Uri.EscapeDataString (RFC 3986): solo deja sin escapar
 * letras, números y - _ . ~
 * encodeURIComponent deja además ! ' ( ) * así que los escapamos a mano.
 * @param {string} value
 */
export function escapeDataString(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  )
}

/**
 * @param {import('./platforms.js').Launcher|null} launcher
 * @param {string} romPath  Ruta absoluta del juego en la consola, p. ej. E:\roms\ps2\Okami.chd
 * @param {string} [appProtocol]
 * @returns {string}
 */
export function buildLaunchUri(launcher, romPath, appProtocol = APP_PROTOCOL) {
  if (!launcher) {
    throw new Error(t('Esta consola todavía no tiene un emulador configurado para lanzar juegos.'))
  }
  if (!romPath) {
    throw new Error(t('Falta la ruta del juego.'))
  }

  const game = `"${escapeDataString(romPath)}"`
  const back = `&launchOnExit=${appProtocol}:`

  if (launcher.kind === 'retroarch') {
    return `${launcher.protocol}:?cmd=retroarch -L cores\\${launcher.core} ${game}${back}`
  }
  if (launcher.kind === 'standalone') {
    return `${launcher.protocol}:?cmd=${launcher.exe} ${game}${back}`
  }
  throw new Error(t('Tipo de lanzador desconocido: {kind}', { kind: /** @type {any} */ (launcher).kind }))
}
