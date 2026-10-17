/**
 * Guías cortas para dejar andando cada consola: instalar el emulador, los
 * archivos que pide, dónde van los juegos y cómo probar.
 *
 * Los emuladores para Xbox en Modo Desarrollador se descargan desde DevStore
 * (xbdev.store) en el PC y se instalan con el Device Portal. Los nombres de
 * los menús de cada emulador van en inglés, que es como aparecen por defecto.
 *
 * La BIOS, las llaves y los juegos deben salir de tus propias consolas y
 * discos: las guías no enlazan sitios para bajarlos.
 */

/** Lista de emuladores de DevStore: de ahí se descargan (el QR de cada guía) */
export const DEVSTORE_URL = 'https://xbdev.store/category/4/'
export const DEVSTORE_LABEL = 'xbdev.store › Emuladores'
/** Herramienta para dar permisos al USB (en DevStore, solo para Windows) */
export const USB_TOOL = 'Xbox USB Permissions Tool'

/** RetroArch con los núcleos incluidos (la versión Lite viene sin núcleos) */
const RETROARCH = 'RetroArch Full (Series S/X)'
const RA_SYSTEM = 'E:\\RetroArch\\system'
/** Para que RetroArch busque la BIOS en el USB y se pueda copiar desde el PC */
const RA_SETUP = [
  `En RetroArch: **Settings › Directory › System/BIOS** → elige \`${RA_SYSTEM}\` (créala desde el PC si no existe).`,
  'Luego **Main Menu › Configuration File › Save Current Configuration**.',
]

/**
 * @typedef {Object} EmulatorGuide
 * @property {string} download  cómo aparece en DevStore
 * @property {string[]} [setup] ajustes la primera vez, dentro del emulador
 * @property {string[]} files   archivos extra y dónde van ([] = no necesita nada más)
 * @property {string} [note]    advertencia corta
 */

/** @type {Record<string, EmulatorGuide>} por id de emulador (platforms.js) */
export const EMULATOR_GUIDES = {
  // PS1
  swanstation: {
    download: RETROARCH,
    setup: RA_SETUP,
    files: [
      `BIOS de PS1, copiada de tu consola, en \`${RA_SYSTEM}\`: **scph5501.bin** (EE. UU.), **scph5502.bin** (Europa) o **scph5500.bin** (Japón).`,
    ],
  },
  'beetle-psx': {
    download: RETROARCH,
    setup: RA_SETUP,
    files: [
      `BIOS de PS1, copiada de tu consola, en \`${RA_SYSTEM}\`: **scph5501.bin** (EE. UU.), **scph5502.bin** (Europa) o **scph5500.bin** (Japón).`,
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
    files: [`Opcional: **gba_bios.bin** en \`${RA_SYSTEM}\`. Sin ella también funciona.`],
  },
  gpsp: {
    download: RETROARCH,
    setup: RA_SETUP,
    files: [`Opcional: **gba_bios.bin** en \`${RA_SYSTEM}\`. Sin ella también funciona.`],
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
      `Opcional: **dc_boot.bin** y **dc_flash.bin** en \`${RA_SYSTEM}\\dc\`. Flycast trae una BIOS de reemplazo.`,
    ],
  },
  flycast: {
    download: 'Flycast',
    files: ['Opcional: **dc_boot.bin** y **dc_flash.bin**. Flycast trae una BIOS de reemplazo.'],
  },
  // Xbox 360
  'xenia-canary': {
    download: 'Xenia Canary',
    setup: [`Dale permisos al USB con **${USB_TOOL}** (DevStore): sin ellos Xenia no ve los juegos.`],
    files: [],
  },
  xenia: {
    download: 'Xenia',
    setup: [`Dale permisos al USB con **${USB_TOOL}** (DevStore): sin ellos Xenia no ve los juegos.`],
    files: [],
    note: 'Versión anterior: DevStore recomienda Xenia Canary.',
  },
}

/** Consejos de formato por consola (lo que más ocupa o lo que más confunde) */
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

/** Wii U no tiene emulador que Relix pueda abrir: la guía explica Cemu igual */
const CEMU = {
  download: 'Cemu',
  files: ['Si tus juegos están encriptados, importa tu **keys.txt** en Cemu (**My games › Import keys.txt**).'],
  note: 'Relix todavía no puede abrir Cemu: ábrelo desde Dev Home y elige el juego ahí.',
}

/**
 * @typedef {{ id: string, title: string, lines: string[], done?: boolean | null }} GuideStep
 *   done: true listo, false falta, null no se puede saber desde Relix
 */

/**
 * Los pasos de la guía de una consola, para el emulador que usa.
 * @param {import('./platforms.js').Platform} platform
 * @param {import('./platforms.js').Emulator | null} emulator
 * @param {{ folder: string, installed: boolean | null, games: number }} status
 *   folder: carpeta de juegos en el USB (E:\roms\ps1); installed y games: lo que Relix ya sabe
 * @returns {GuideStep[]}
 */
export function guideSteps(platform, emulator, status) {
  const guide = emulator ? EMULATOR_GUIDES[emulator.id] : CEMU
  if (!guide) return []

  /** @type {GuideStep[]} */
  const steps = [
    {
      id: 'install',
      title: `Instala ${guide.download === RETROARCH ? 'RetroArch' : guide.download}`,
      lines: [
        `En el PC, entra a **${DEVSTORE_LABEL}** y descarga **${guide.download}**.`,
        'Abre el Device Portal (la dirección que muestra Dev Home) › **My games & apps › Add** y elige el archivo.',
        'En Dev Home, sobre el emulador: botón Vista ⧉ › **View details** › cambia el tipo de **App** a **Game**: así tiene más memoria.',
      ],
      done: status.installed,
    },
  ]

  const setup = [...(guide.setup ?? []), ...guide.files]
  steps.push({
    id: 'files',
    title: guide.files.length > 0 || guide.setup ? 'Archivos y ajustes' : 'Archivos extra',
    lines: setup.length > 0 ? setup : ['No necesita nada más: ni BIOS ni ajustes.'],
    done: setup.length > 0 ? null : true,
  })

  steps.push({
    id: 'games',
    title: 'Tus juegos',
    lines: [
      `Desde el PC, copia tus juegos en \`${status.folder}\` (créala si no existe).`,
      `Formatos: ${platform.extensions.map((e) => `.${e}`).join(' ')}. ${GAME_TIPS[platform.id] ?? ''}`.trim(),
      `En Relix: **≡ › Biblioteca › ${platform.name}** para escanear la carpeta.`,
      `¿Relix no ve el USB? Dale permisos con **${USB_TOOL}** (DevStore, para Windows).`,
    ],
    done: status.games > 0,
  })

  steps.push({
    id: 'play',
    title: emulator ? 'Prueba' : 'Juega',
    lines: emulator
      ? [
          'Elige un juego y pulsa A.',
          'Si vuelves a Relix enseguida, Relix te dice qué revisar.',
          ...(guide.note ? [guide.note] : []),
        ]
      : [guide.note ?? '', 'Relix igual muestra tus juegos, sus portadas y el tiempo jugado.'],
    done: null,
  })

  return steps
}

/**
 * Texto con **negrita** y `rutas` en partes, para dibujarlo sin HTML crudo.
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
