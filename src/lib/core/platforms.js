/**
 * Each console's configuration.
 *
 * `id` uses the same system names as ES-DE (psx, snes, megadrive...),
 * so the `gamelists/<id>` and `downloaded_media/<id>` folders match by themselves.
 *
 * `emulators` are the emulators it can be opened with; the first one is the
 * recommended one. Each says how it's opened on Xbox:
 *   - kind 'retroarch'  -> the `retroarch:` protocol + a libretro core (.dll)
 *   - kind 'standalone' -> the emulator's own protocol + its .exe
 * The standalone protocols are the same ones RetroPass uses
 * (UrlSchemeGenerator.cs), another Xbox frontend that already opens them.
 *
 * Without emulators (Wii U): Relix shows the games, but can't open them yet.
 *
 * @typedef {{ kind: 'retroarch', protocol: string, core: string }
 *         | { kind: 'standalone', protocol: string, exe: string }} Launcher
 *
 * @typedef {Object} Emulator
 * @property {string} id
 * @property {string} name        "RetroArch · SwanStation"
 * @property {Launcher} launcher
 * @property {string} [note]      a short warning (e.g. "experimental")
 *
 * @typedef {Object} Platform
 * @property {string} id
 * @property {string} name        The visible name
 * @property {string} shortName   A short name for the channel
 * @property {string} maker
 * @property {number} year        The console's release year
 * @property {string} color       The channel's color
 * @property {string} ink         The text color on `color`
 * @property {Emulator[]} emulators
 * @property {string} [noEmulatorNote]  why it can't be opened (if there are no emulators)
 * @property {string[]} folders     Accepted names for its folder in roms\ (the first one that exists)
 * @property {string[]} extensions  Game formats Relix lists when scanning
 * @property {string} libretro      The console's folder in libretro-thumbnails (covers)
 * @property {string} wikipedia     Its English Wikipedia article: Relix finds its Wikidata item from it (game info)
 * @property {number} coverAspect   Width / height of its box (PS1 is square, SNES is landscape)
 */

/** @param {string} id @param {string} name @param {string} core @param {string} [note] */
const retroarch = (id, name, core, note) => ({
  id,
  name: `RetroArch · ${name}`,
  launcher: /** @type {Launcher} */ ({ kind: 'retroarch', protocol: 'retroarch', core }),
  ...(note ? { note } : {}),
})

/** @param {string} id @param {string} name @param {string} protocol @param {string} exe @param {string} [note] */
const standalone = (id, name, protocol, exe, note) => ({
  id,
  name,
  launcher: /** @type {Launcher} */ ({ kind: 'standalone', protocol, exe }),
  ...(note ? { note } : {}),
})

/**
 * In home screen order: by maker and, within each, by year.
 * @type {Platform[]}
 */
export const PLATFORMS = [
  // ── Sony ──────────────────────────────────────────────
  {
    id: 'psx',
    name: 'PlayStation',
    shortName: 'PS1',
    maker: 'Sony',
    year: 1994,
    color: '#FF8A5B',
    ink: '#3A1606',
    emulators: [
      retroarch('swanstation', 'SwanStation', 'swanstation_libretro.dll'),
      retroarch('beetle-psx', 'Beetle PSX HW', 'mednafen_psx_hw_libretro.dll'),
      standalone('duckstation', 'DuckStation', 'duckstation', 'duckstation.exe'),
    ],
    folders: ['psx', 'ps1', 'playstation'],
    extensions: ['chd', 'cue', 'pbp', 'm3u'],
    libretro: 'Sony - PlayStation',
    wikipedia: 'PlayStation (console)',
    coverAspect: 1,
  },
  {
    id: 'ps2',
    name: 'PlayStation 2',
    shortName: 'PS2',
    maker: 'Sony',
    year: 2000,
    color: '#23B5A6',
    ink: '#03302B',
    emulators: [standalone('xbsx2', 'XBSX2', 'xbsx2', 'xbsx2.exe')],
    folders: ['ps2', 'playstation2'],
    extensions: ['chd', 'iso', 'cso'],
    libretro: 'Sony - PlayStation 2',
    wikipedia: 'PlayStation 2',
    coverAspect: 0.71,
  },
  {
    id: 'psp',
    name: 'PlayStation Portable',
    shortName: 'PSP',
    maker: 'Sony',
    year: 2004,
    color: '#5B8CFF',
    ink: '#0A1A47',
    emulators: [
      standalone('ppsspp', 'PPSSPP', 'ppsspp', 'ppsspp.exe'),
      retroarch('ppsspp-ra', 'PPSSPP', 'ppsspp_libretro.dll'),
    ],
    folders: ['psp'],
    extensions: ['iso', 'cso', 'chd', 'pbp'],
    libretro: 'Sony - PlayStation Portable',
    wikipedia: 'PlayStation Portable',
    coverAspect: 0.58,
  },

  // ── Nintendo ──────────────────────────────────────────
  {
    id: 'snes',
    name: 'Super Nintendo',
    shortName: 'SNES',
    maker: 'Nintendo',
    year: 1990,
    color: '#B07FE0',
    ink: '#2A0C45',
    emulators: [
      retroarch('snes9x', 'Snes9x', 'snes9x_libretro.dll'),
      retroarch('bsnes', 'bsnes', 'bsnes_libretro.dll'),
    ],
    folders: ['snes', 'sfc', 'superfamicom'],
    extensions: ['sfc', 'smc', 'zip', '7z'],
    libretro: 'Nintendo - Super Nintendo Entertainment System',
    wikipedia: 'Super Nintendo Entertainment System',
    coverAspect: 1.38,
  },
  {
    id: 'n64',
    name: 'Nintendo 64',
    shortName: 'N64',
    maker: 'Nintendo',
    year: 1996,
    color: '#E5484D',
    ink: '#3D0A0C',
    emulators: [
      retroarch('mupen64plus', 'Mupen64Plus-Next', 'mupen64plus_next_libretro.dll'),
      retroarch('parallel-n64', 'ParaLLEl N64', 'parallel_n64_libretro.dll'),
    ],
    folders: ['n64', 'nintendo64'],
    extensions: ['z64', 'n64', 'v64', 'zip', '7z'],
    libretro: 'Nintendo - Nintendo 64',
    wikipedia: 'Nintendo 64',
    coverAspect: 1.38,
  },
  {
    id: 'gba',
    name: 'Game Boy Advance',
    shortName: 'GBA',
    maker: 'Nintendo',
    year: 2001,
    color: '#1FB5D6',
    ink: '#04303B',
    emulators: [
      retroarch('mgba', 'mGBA', 'mgba_libretro.dll'),
      retroarch('gpsp', 'gpSP', 'gpsp_libretro.dll'),
      retroarch('vbam', 'VBA-M', 'vbam_libretro.dll'),
    ],
    folders: ['gba'],
    extensions: ['gba', 'zip', '7z'],
    libretro: 'Nintendo - Game Boy Advance',
    wikipedia: 'Game Boy Advance',
    coverAspect: 1,
  },
  {
    id: 'gc',
    name: 'GameCube',
    shortName: 'GameCube',
    maker: 'Nintendo',
    year: 2001,
    color: '#8E6CF2',
    ink: '#1E0C52',
    emulators: [
      retroarch('dolphin-ra', 'Dolphin', 'dolphin_libretro.dll'),
      // The standalone Dolphin has launching from frontends broken in its
      // latest version; DevStore recommends the RetroArch core for this.
      standalone('dolphin', 'Dolphin', 'dolphin', 'dolphin.exe', 'su última versión no abre juegos desde otras apps'),
    ],
    folders: ['gc', 'gamecube', 'ngc'],
    extensions: ['rvz', 'iso', 'gcz', 'gcm', 'ciso'],
    libretro: 'Nintendo - GameCube',
    wikipedia: 'GameCube',
    coverAspect: 0.71,
  },
  {
    id: 'wiiu',
    name: 'Wii U',
    shortName: 'Wii U',
    maker: 'Nintendo',
    year: 2012,
    color: '#F2B705',
    ink: '#3B2C00',
    emulators: [],
    noEmulatorNote:
      'Cemu para Xbox todavía no se deja abrir desde otra app: ábrelo desde Dev Home y elige el juego ahí.',
    folders: ['wiiu'],
    extensions: ['wua', 'wux', 'wud', 'rpx'],
    libretro: 'Nintendo - Wii U',
    wikipedia: 'Wii U',
    coverAspect: 0.71,
  },
  {
    id: 'n3ds',
    name: 'Nintendo 3DS',
    shortName: '3DS',
    maker: 'Nintendo',
    year: 2011,
    color: '#5468E8',
    ink: '#0B1240',
    emulators: [
      // "RetroArch 3DS" on DevStore; RetroPass opens it with the citrara: protocol
      standalone('citrara', 'RetroArch 3DS', 'citrara', 'citrara.exe', 'experimental'),
      standalone('panda3ds', 'Panda3DS', 'panda', 'Alber.exe', 'experimental'),
    ],
    folders: ['n3ds', '3ds'],
    extensions: ['3ds', 'cci', 'cxi', '3dsx'],
    libretro: 'Nintendo - Nintendo 3DS',
    wikipedia: 'Nintendo 3DS',
    coverAspect: 0.9,
  },

  // ── Sega ──────────────────────────────────────────────
  {
    id: 'megadrive',
    name: 'Mega Drive',
    shortName: 'Mega Drive',
    maker: 'Sega',
    year: 1988,
    color: '#3A4558',
    ink: '#E6ECF5',
    emulators: [
      retroarch('genesis-plus-gx', 'Genesis Plus GX', 'genesis_plus_gx_libretro.dll'),
      retroarch('picodrive', 'PicoDrive', 'picodrive_libretro.dll'),
    ],
    folders: ['megadrive', 'genesis', 'md'],
    extensions: ['md', 'gen', 'smd', 'bin', 'zip', '7z'],
    libretro: 'Sega - Mega Drive - Genesis',
    wikipedia: 'Sega Genesis',
    coverAspect: 0.71,
  },
  {
    id: 'dreamcast',
    name: 'Dreamcast',
    shortName: 'Dreamcast',
    maker: 'Sega',
    year: 1998,
    color: '#F59A3D',
    ink: '#3D1E00',
    emulators: [
      retroarch('flycast-ra', 'Flycast', 'flycast_libretro.dll'),
      standalone('flycast', 'Flycast', 'flycast', 'flycast.exe'),
    ],
    folders: ['dreamcast', 'dc'],
    extensions: ['chd', 'cdi', 'gdi', 'm3u'],
    libretro: 'Sega - Dreamcast',
    wikipedia: 'Dreamcast',
    coverAspect: 1,
  },

  // ── Microsoft ─────────────────────────────────────────
  {
    id: 'xbox360',
    name: 'Xbox 360',
    shortName: 'Xbox 360',
    maker: 'Microsoft',
    year: 2005,
    color: '#7CC242',
    ink: '#1C3305',
    emulators: [
      standalone('xenia-canary', 'Xenia Canary', 'xeniacanary', 'xeniacanary.exe'),
      standalone('xenia', 'Xenia', 'xenia', 'xenia.exe'),
    ],
    folders: ['xbox360'],
    extensions: ['iso', 'xex', 'zar'],
    libretro: 'Microsoft - Xbox 360',
    wikipedia: 'Xbox 360',
    coverAspect: 0.71,
  },
]

/** @param {string} id */
export function getPlatform(id) {
  return PLATFORMS.find((p) => p.id === id) ?? null
}

/** @param {Platform} platform @param {string} id */
export function getEmulator(platform, id) {
  return platform.emulators.find((e) => e.id === id) ?? null
}

/** For display: "retroarch: · swanstation_libretro.dll" @param {Launcher} launcher */
export function launcherDetail(launcher) {
  return `${launcher.protocol}: · ${launcher.kind === 'retroarch' ? launcher.core : launcher.exe}`
}
