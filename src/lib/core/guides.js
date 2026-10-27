/**
 * Short guides to get each console working: installing the emulator, the
 * files it needs, where the games go and how to test.
 *
 * Emulators for Xbox in Developer Mode are downloaded from DevStore
 * (xbdev.store) on the PC and installed with the Device Portal. The names of
 * each emulator's menus are in English, which is how they show up by default.
 *
 * The BIOS, the keys and the games must come from your own consoles and
 * discs: the guides don't link to sites to download them.
 *
 * The texts are written in Spanish with {system} and {tool} instead of the paths;
 * guideSteps() translates them (t) and fills in the paths.
 */
import { t } from '../i18n/i18n.svelte.js'

/** DevStore's list of emulators: that's where they're downloaded from (each guide's QR code) */
export const DEVSTORE_URL = 'https://xbdev.store/category/4/'
export const DEVSTORE_LABEL = 'xbdev.store › Emuladores'
/** The tool that gives the USB drive its permissions (on DevStore, Windows only) */
export const USB_TOOL = 'Xbox USB Permissions Tool'

/** RetroArch with the cores included (the Lite version comes without cores) */
const RETROARCH = 'RetroArch Full (Series S/X)'
const RA_SYSTEM = 'E:\\RetroArch\\system'
/** What replaces {system} and {tool} in the guides' texts */
const PATHS = { system: RA_SYSTEM, tool: USB_TOOL }
/** So RetroArch looks for the BIOS on the USB drive and it can be copied from the PC */
const RA_SETUP = [
  'En RetroArch: **Settings › Directory › System/BIOS** → elige `{system}` (créala desde el PC si no existe).',
  'Luego **Main Menu › Configuration File › Save Current Configuration**.',
]

/**
 * @typedef {Object} EmulatorGuide
 * @property {string} download  how it shows up on DevStore
 * @property {string[]} [setup] settings the first time, inside the emulator
 * @property {string[]} files   extra files and where they go ([] = it needs nothing else)
 * @property {string} [note]    a short warning
 */

/** @type {Record<string, EmulatorGuide>} by emulator id (platforms.js) */
export const EMULATOR_GUIDES = {
  // PS1
  swanstation: {
    download: RETROARCH,
    setup: RA_SETUP,
    files: [
      'BIOS de PS1, copiada de tu consola, en `{system}`: **scph5501.bin** (EE. UU.), **scph5502.bin** (Europa) o **scph5500.bin** (Japón).',
    ],
  },
  'beetle-psx': {
    download: RETROARCH,
    setup: RA_SETUP,
    files: [
      'BIOS de PS1, copiada de tu consola, en `{system}`: **scph5501.bin** (EE. UU.), **scph5502.bin** (Europa) o **scph5500.bin** (Japón).',
    ],
  },
  duckstation: {
    download: 'DuckStation',
    setup: ['En DuckStation: **Settings › BIOS › BIOS Directory** → `E:\\DuckStation\\bios`.'],
    files: ['BIOS de PS1, copiada de tu consola, en `E:\\DuckStation\\bios`.'],
    note: 'DevStore recomienda SwanStation (RetroArch): DuckStation para Xbox ya no recibe cambios.',
  },
  // PS2
  xbsx2: {
    download: 'XBSX2',
    setup: ['En XBSX2: **Settings › BIOS Settings › Search Directory** → `E:\\XBSX2\\BIOS`.'],
    files: ['BIOS de PS2, copiada de tu consola, en `E:\\XBSX2\\BIOS` (sin comprimir; la extensión da igual: .bin, .rom0…).'],
  },
  // PSP
  ppsspp: {
    download: 'PPSSPP',
    setup: ['La primera vez pregunta dónde guardar sus datos: crea y elige `E:\\PPSSPP`.'],
    files: [],
  },
  'ppsspp-ra': { download: RETROARCH, files: [] },
  // SNES
  snes9x: { download: RETROARCH, files: [] },
  bsnes: { download: RETROARCH, files: [] },
  // N64
  mupen64plus: {
    download: RETROARCH,
    files: [],
    note: 'Si un juego no abre, prueba ParaLLEl N64 con Y › Abrir con…',
  },
  'parallel-n64': { download: RETROARCH, files: [] },
  // GBA
  mgba: {
    download: RETROARCH,
    setup: RA_SETUP,
    files: ['Opcional: **gba_bios.bin** en `{system}`. Sin ella también funciona.'],
  },
  gpsp: {
    download: RETROARCH,
    setup: RA_SETUP,
    files: ['Opcional: **gba_bios.bin** en `{system}`. Sin ella también funciona.'],
  },
  vbam: { download: RETROARCH, files: [] },
  // GameCube
  'dolphin-ra': { download: RETROARCH, files: [] },
  dolphin: {
    download: 'Dolphin',
    files: [],
    note: 'Su última versión no abre juegos desde otras apps: mejor usa el núcleo de RetroArch.',
  },
  // 3DS
  citrara: {
    download: 'RetroArch 3DS',
    files: ['Tus juegos desencriptados (.3ds o .cci), copiados de tu propia consola.'],
    note: 'Experimental y solo para Xbox Series.',
  },
  panda3ds: {
    download: 'Panda3DS',
    files: ['Tus juegos desencriptados (.3ds o .cci), copiados de tu propia consola.'],
    note: 'Experimental: no todos los juegos andan.',
  },
  // Mega Drive
  'genesis-plus-gx': { download: RETROARCH, files: [] },
  picodrive: { download: RETROARCH, files: [] },
  // Dreamcast
  'flycast-ra': {
    download: RETROARCH,
    setup: RA_SETUP,
    files: [
      'Opcional: **dc_boot.bin** y **dc_flash.bin** en `{system}\\dc`. Flycast trae una BIOS de reemplazo.',
    ],
  },
  flycast: {
    download: 'Flycast',
    files: ['Opcional: **dc_boot.bin** y **dc_flash.bin**. Flycast trae una BIOS de reemplazo.'],
  },
  // Xbox 360
  'xenia-canary': {
    download: 'Xenia Canary',
    setup: ['Dale permisos al USB con **{tool}** (DevStore): sin ellos Xenia no ve los juegos.'],
    files: [],
  },
  xenia: {
    download: 'Xenia',
    setup: ['Dale permisos al USB con **{tool}** (DevStore): sin ellos Xenia no ve los juegos.'],
    files: [],
    note: 'Versión anterior: DevStore recomienda Xenia Canary.',
  },
}

/** Format tips per console (what takes the most space or causes the most confusion) */
/** @type {Record<string, string>} */
const GAME_TIPS = {
  psx: 'Juegos de varios discos: crea un .m3u con la lista de discos y Relix muestra uno solo.',
  ps2: '.chd ocupa bastante menos que .iso.',
  psp: '.cso ocupa menos que .iso.',
  snes: 'Puedes dejarlos dentro de su .zip.',
  n64: 'Puedes dejarlos dentro de su .zip.',
  gba: 'Puedes dejarlos dentro de su .zip.',
  gc: '.rvz ocupa bastante menos que .iso.',
  wiiu: 'Un .wua por juego, o la carpeta del juego con code\\*.rpx adentro.',
  n3ds: 'Tienen que estar desencriptados (.3ds o .cci).',
  megadrive: 'Puedes dejarlos dentro de su .zip.',
  dreamcast: '.chd, .cdi, o una carpeta por juego con su disc.gdi.',
  xbox360: 'Mejor .zar o la carpeta del juego con default.xex: si un .iso no abre, conviértelo a .zar en el PC.',
}

/** Wii U has no emulator Relix can open: the guide explains Cemu anyway */
const CEMU = {
  download: 'Cemu',
  files: ['Si tus juegos están encriptados, importa tu **keys.txt** en Cemu (**My games › Import keys.txt**).'],
  note: 'Relix todavía no puede abrir Cemu: ábrelo desde Dev Home y elige el juego ahí.',
}

/**
 * @typedef {{ id: string, title: string, lines: string[], done?: boolean | null }} GuideStep
 *   done: true ready, false missing, null can't be known from Relix
 */

/**
 * The steps of a console's guide, for the emulator it uses.
 * @param {import('./platforms.js').Platform} platform
 * @param {import('./platforms.js').Emulator | null} emulator
 * @param {{ folder: string, installed: boolean | null, games: number }} status
 *   folder: the games folder on the USB drive (E:\roms\ps1); installed and games: what Relix already knows
 * @returns {GuideStep[]}
 */
export function guideSteps(platform, emulator, status) {
  /** @type {EmulatorGuide | undefined} */
  const guide = emulator ? EMULATOR_GUIDES[emulator.id] : CEMU
  if (!guide) return []
  /** A text from the tables above, translated and with its paths @param {string} line */
  const tr = (line) => t(line, PATHS)

  /** @type {GuideStep[]} */
  const steps = [
    {
      id: 'install',
      title: t('Instala {emulator}', { emulator: guide.download === RETROARCH ? 'RetroArch' : guide.download }),
      lines: [
        t('En el PC, entra a **{store}** y descarga **{emulator}**.', { store: t(DEVSTORE_LABEL), emulator: guide.download }),
        t('Abre el Device Portal (la dirección que muestra Dev Home) › **My games & apps › Add** y elige el archivo.'),
        t(
          'En Dev Home, sobre el emulador: botón Vista ⧉ › **View details** › cambia el tipo de **App** a **Game**: así tiene más memoria.',
        ),
      ],
      done: status.installed,
    },
  ]

  const setup = [...(guide.setup ?? []), ...guide.files].map(tr)
  steps.push({
    id: 'files',
    title: guide.files.length > 0 || guide.setup ? t('Archivos y ajustes') : t('Archivos extra'),
    lines: setup.length > 0 ? setup : [t('No necesita nada más: ni BIOS ni ajustes.')],
    done: setup.length > 0 ? null : true,
  })

  const tip = GAME_TIPS[platform.id]
  steps.push({
    id: 'games',
    title: t('Tus juegos'),
    lines: [
      t('Desde el PC, copia tus juegos en `{folder}` (créala si no existe).', { folder: status.folder }),
      `${t('Formatos: {formats}.', { formats: platform.extensions.map((e) => `.${e}`).join(' ') })} ${tip ? tr(tip) : ''}`.trim(),
      t('En Relix: **≡ › Biblioteca › {console}** para escanear la carpeta.', { console: platform.name }),
      t('¿Relix no ve el USB? Dale permisos con **{tool}** (DevStore, para Windows).', { tool: USB_TOOL }),
    ],
    done: status.games > 0,
  })

  steps.push({
    id: 'play',
    title: emulator ? t('Prueba') : t('Juega'),
    lines: emulator
      ? [
          t('Elige un juego y pulsa A.'),
          t('Si vuelves a Relix enseguida, Relix te dice qué revisar.'),
          ...(guide.note ? [tr(guide.note)] : []),
        ]
      : [guide.note ? tr(guide.note) : '', t('Relix igual muestra tus juegos, sus portadas y el tiempo jugado.')],
    done: null,
  })

  return steps
}

/**
 * Text with **bold** and `paths` split into parts, to draw it without raw HTML.
 * @param {string} line
 * @returns {Array<{ text: string, kind: 'plain' | 'bold' | 'code' }>}
 */
export function richText(line) {
  /** @type {Array<{ text: string, kind: 'plain' | 'bold' | 'code' }>} */
  const parts = []
  const pattern = /\*\*(.+?)\*\*|`(.+?)`/g
  let last = 0
  for (const match of line.matchAll(pattern)) {
    const at = match.index ?? 0
    if (at > last) parts.push({ text: line.slice(last, at), kind: 'plain' })
    parts.push(match[1] !== undefined ? { text: match[1], kind: 'bold' } : { text: match[2], kind: 'code' })
    last = at + match[0].length
  }
  if (last < line.length) parts.push({ text: line.slice(last), kind: 'plain' })
  return parts
}
