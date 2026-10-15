/**
 * Configuración de cada consola.
 *
 * `id` usa los mismos nombres de sistema que ES-DE (psx, psp, ps2, gc, wiiu),
 * así las carpetas `gamelists/<id>` y `downloaded_media/<id>` calzan solas.
 *
 * `launcher` describe cómo se abre el emulador en Xbox:
 *   - kind 'retroarch'  -> protocolo `retroarch:` + núcleo libretro (.dll)
 *   - kind 'standalone' -> protocolo propio del emulador + su .exe
 *   - null              -> todavía no hay forma confirmada de lanzarlo
 *
 * @typedef {{ kind: 'retroarch', protocol: string, core: string }
 *         | { kind: 'standalone', protocol: string, exe: string }} Launcher
 *
 * @typedef {Object} Platform
 * @property {string} id
 * @property {string} name        Nombre visible
 * @property {string} shortName   Nombre corto para el canal
 * @property {string} maker
 * @property {number} year        Año de lanzamiento de la consola
 * @property {string} color       Color del canal
 * @property {string} ink         Color de texto sobre `color`
 * @property {string} emulatorName
 * @property {Launcher|null} launcher
 * @property {string} [launcherNote]
 * @property {string[]} folders     Nombres aceptados para su carpeta en roms\ (el primero que exista)
 * @property {string[]} extensions  Formatos de juego que Relix lista al escanear
 */

/** @type {Platform[]} */
export const PLATFORMS = [
  {
    id: 'psx',
    name: 'PlayStation',
    shortName: 'PS1',
    maker: 'Sony',
    year: 1994,
    color: '#FF8A5B',
    ink: '#3A1606',
    emulatorName: 'RetroArch · SwanStation',
    launcher: { kind: 'retroarch', protocol: 'retroarch', core: 'swanstation_libretro.dll' },
    folders: ['psx', 'ps1', 'playstation'],
    extensions: ['chd', 'cue', 'pbp', 'm3u'],
  },
  {
    id: 'psp',
    name: 'PlayStation Portable',
    shortName: 'PSP',
    maker: 'Sony',
    year: 2004,
    color: '#5B8CFF',
    ink: '#0A1A47',
    emulatorName: 'PPSSPP',
    launcher: { kind: 'standalone', protocol: 'ppsspp', exe: 'ppsspp.exe' },
    folders: ['psp'],
    extensions: ['iso', 'cso', 'chd', 'pbp'],
  },
  {
    id: 'ps2',
    name: 'PlayStation 2',
    shortName: 'PS2',
    maker: 'Sony',
    year: 2000,
    color: '#23B5A6',
    ink: '#03302B',
    emulatorName: 'XBSX2',
    launcher: { kind: 'standalone', protocol: 'xbsx2', exe: 'xbsx2.exe' },
    folders: ['ps2', 'playstation2'],
    extensions: ['chd', 'iso', 'cso'],
  },
  {
    id: 'gc',
    name: 'GameCube',
    shortName: 'GameCube',
    maker: 'Nintendo',
    year: 2001,
    color: '#8E6CF2',
    ink: '#1E0C52',
    emulatorName: 'RetroArch · Dolphin',
    // El Dolphin standalone tiene roto el lanzamiento desde frontends en su
    // última versión; DevStore recomienda el núcleo de RetroArch para esto.
    launcher: { kind: 'retroarch', protocol: 'retroarch', core: 'dolphin_libretro.dll' },
    folders: ['gc', 'gamecube', 'ngc'],
    extensions: ['rvz', 'iso', 'gcz', 'gcm', 'ciso'],
  },
  {
    id: 'wiiu',
    name: 'Wii U',
    shortName: 'Wii U',
    maker: 'Nintendo',
    year: 2012,
    color: '#F2B705',
    ink: '#3B2C00',
    emulatorName: 'Cemu (experimental)',
    launcher: null,
    launcherNote: 'El port de Cemu para Xbox aún no tiene un protocolo de lanzamiento documentado.',
    folders: ['wiiu'],
    extensions: ['wua', 'wux', 'wud', 'rpx'],
  },
]

/** @param {string} id */
export function getPlatform(id) {
  return PLATFORMS.find((p) => p.id === id) ?? null
}
