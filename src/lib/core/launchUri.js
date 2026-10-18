/**
 * Builds the URI the Xbox opens an emulator with, passing it the game.
 *
 * Format (the same existing frontends use, e.g. RetroPass):
 *
 *   RetroArch:   retroarch:?cmd=retroarch -L cores\<core>.dll "<path>"&launchOnExit=<app>:
 *   Standalone:  <protocol>:?cmd=<exe> "<path>"&launchOnExit=<app>:
 *
 * - The game's path is escaped (equivalent to .NET's Uri.EscapeDataString).
 * - `launchOnExit` is OUR app's protocol: when the emulator closes,
 *   the Xbox goes back to Relix automatically.
 * - The rest of the string is left as is; the C# shell does `new Uri(...)`
 *   and `Launcher.LaunchUriAsync`, which takes care of the spaces.
 */
import { t } from '../i18n/i18n.svelte.js'

export const APP_PROTOCOL = 'relix'

/**
 * The same as Uri.EscapeDataString (RFC 3986): it only leaves letters,
 * digits and - _ . ~ unescaped.
 * encodeURIComponent also leaves ! ' ( ) * so we escape them by hand.
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
 * @param {string} romPath  The game's absolute path on the console, e.g. E:\roms\ps2\Okami.chd
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
