/**
 * The system checkup: with what the shell measures (USB drive, space, folders,
 * BIOS files, internet) and what Relix already knows (games, emulators,
 * backup), it builds a list of checks with their state and how to fix each one.
 *
 * The BIOS can only be checked if it's on the USB drive, in the folders the
 * guides point to. If you put it inside the emulator (Device Portal), Relix
 * can't see it and says so without marking it as an error.
 */
import { i18n, listJoin, plural, t } from '../i18n/i18n.svelte.js'
import { PS1_BIOS, ps1BiosRegion } from './quickExit.js'

/** BIOS folders on the USB drive, the same as in the guides (relative to the root) */
export const BIOS_FOLDERS = {
  retroarch: 'RetroArch\\system',
  duckstation: 'DuckStation\\bios',
  xbsx2: 'XBSX2\\BIOS',
}
/** What the shell is asked to list */
export const CHECK_FOLDERS = Object.values(BIOS_FOLDERS)

/** Less than this free is too little to keep adding games */
const LOW_SPACE_BYTES = 2 * 1024 ** 3

const REGION_NAMES = { japan: 'Japón', usa: 'EE. UU.', europe: 'Europa' }

/**
 * @typedef {'ok'|'warn'|'error'|'info'|'update'} CheckState  update: there's a new version of Relix
 * @typedef {{ kind: 'guide', systemId: string }} CheckAction
 * @typedef {{ id: string, state: CheckState, title: string, detail: string, action?: CheckAction }} Check
 *
 * @typedef {Object} ShellCheck  what the shell answers (see SystemCheck.cs)
 * @property {string} drive
 * @property {boolean} writable
 * @property {{ free: number, total: number } | null} space
 * @property {string[]} romFolders
 * @property {Record<string, string[] | null>} folders
 * @property {boolean} internet
 *
 * @typedef {Object} ConsoleInfo
 * @property {import('./platforms.js').Platform} platform
 * @property {Array<{ path: string }>} games
 * @property {import('./platforms.js').Emulator | null} emulator
 * @property {boolean | null} installed
 */

/** "182 GB", "1,5 GB" in Spanish ("1.5 GB" in English) @param {number} bytes */
export function formatBytes(bytes) {
  const gb = bytes / 1024 ** 3
  if (gb >= 10) return `${Math.round(gb)} GB`
  if (gb >= 1) return `${i18n.current === 'es' ? gb.toFixed(1).replace('.', ',') : gb.toFixed(1)} GB`
  return `${Math.round(bytes / 1024 ** 2)} MB`
}

/** Is the file in the list? Case-insensitive (the Xbox doesn't tell them apart) */
const hasFile = (/** @type {string[]} */ files, /** @type {string} */ name) =>
  files.some((f) => f.toLowerCase() === name.toLowerCase())

/**
 * The PS1 BIOS: which files are needed according to your games' regions.
 * @param {ConsoleInfo} info
 * @param {Record<string, string[] | null>} folders
 * @param {string} driveRoot  "E:\"
 * @returns {Check | null}
 */
function ps1Bios(info, folders, driveRoot) {
  const { emulator, games } = info
  if (!emulator) return null
  const folder = emulator.launcher.kind === 'retroarch' ? BIOS_FOLDERS.retroarch : emulator.id === 'duckstation' ? BIOS_FOLDERS.duckstation : null
  if (!folder) return null
  const where = `${driveRoot}${folder}`
  const action = /** @type {CheckAction} */ ({ kind: 'guide', systemId: 'psx' })
  const files = folders[folder]

  if (files === undefined) return null
  if (files === null) {
    return {
      id: 'bios:psx',
      state: 'info',
      title: t('BIOS de PS1: no la veo en el USB'),
      detail: t('No existe {where}. Si la pusiste dentro del emulador con el Device Portal, Relix no puede verla.', { where }),
      action,
    }
  }

  // How many games from each region: each one needs its own file
  /** @type {Record<string, number>} */
  const byRegion = {}
  for (const game of games) {
    const region = ps1BiosRegion(game.path.split('/').pop() ?? '')
    if (region) byRegion[region] = (byRegion[region] ?? 0) + 1
  }
  const regions = /** @type {Array<keyof typeof PS1_BIOS>} */ (Object.keys(byRegion))
  const anyBios = Object.values(PS1_BIOS).some((b) => hasFile(files, b.file))

  if (regions.length === 0) {
    return anyBios
      ? { id: 'bios:psx', state: 'ok', title: t('BIOS de PS1 en su lugar'), detail: where, action }
      : {
          id: 'bios:psx',
          state: 'warn',
          title: t('BIOS de PS1: falta'),
          detail: t('Copia scph5501.bin (o la de tu región) en {where}.', { where }),
          action,
        }
  }

  const missing = regions.filter((r) => !hasFile(files, PS1_BIOS[r].file))
  if (missing.length === 0) {
    return {
      id: 'bios:psx',
      state: 'ok',
      title: t('BIOS de PS1 en su lugar'),
      detail: t('{files} en {where}', { files: regions.map((r) => PS1_BIOS[r].file).join(', '), where }),
      action,
    }
  }
  const needing = listJoin(
    missing.map((r) => t('{games} de {region}', { games: plural(byRegion[r], 'juego', 'juegos'), region: t(REGION_NAMES[r]) })),
  )
  return {
    id: 'bios:psx',
    state: 'warn',
    title: t('BIOS de PS1: falta {files}', { files: listJoin(missing.map((r) => PS1_BIOS[r].file)) }),
    detail:
      missing.length === 1 && byRegion[missing[0]] === 1
        ? t('{games} la necesita. Va en {where}.', { games: needing, where })
        : t('{games} la necesitan. Va en {where}.', { games: needing, where }),
    action,
  }
}

/**
 * Files that come with a PS2 BIOS but aren't the BIOS: the ones left by the
 * program that copies it from your console (.nvm, .mec, .rom1, .rom2, .erom) and texts.
 */
const PS2_COMPANION = /\.(nvm|mec|rom1|rom2|erom|ini|txt|cfg|json|xml|md|nfo|url|db)$/i
/** A compressed BIOS: XBSX2 doesn't read it until it's extracted */
const ARCHIVE = /\.(zip|7z|rar|gz)$/i

/**
 * The PS2 BIOS (XBSX2). XBSX2, like PCSX2, recognizes it by its content and not
 * by its extension (.bin, .rom0, no extension…): any file works as long as it
 * isn't a companion file or compressed.
 * @param {ConsoleInfo} info
 * @param {Record<string, string[] | null>} folders
 * @param {string} driveRoot
 * @returns {Check | null}
 */
function ps2Bios(info, folders, driveRoot) {
  if (info.emulator?.id !== 'xbsx2') return null
  const folder = BIOS_FOLDERS.xbsx2
  const files = folders[folder]
  const where = `${driveRoot}${folder}`
  const action = /** @type {CheckAction} */ ({ kind: 'guide', systemId: 'ps2' })
  if (files === undefined) return null
  if (files === null) {
    return {
      id: 'bios:ps2',
      state: 'info',
      title: t('BIOS de PS2: no la veo en el USB'),
      detail: t('No existe {where}. Si la elegiste desde otra carpeta en XBSX2, Relix no puede verla.', { where }),
      action,
    }
  }
  const visible = files.filter((f) => !f.startsWith('.'))
  const bios = visible.filter((f) => !PS2_COMPANION.test(f) && !ARCHIVE.test(f))
  if (bios.length > 0) {
    return { id: 'bios:ps2', state: 'ok', title: t('BIOS de PS2 en su lugar'), detail: t('{files} en {where}', { files: bios[0], where }), action }
  }
  const zipped = visible.find((f) => ARCHIVE.test(f))
  if (zipped) {
    return {
      id: 'bios:ps2',
      state: 'warn',
      title: t('BIOS de PS2: está comprimida'),
      detail: t('XBSX2 no lee {file}: descomprímela en el PC y deja el archivo de la BIOS en {where}.', { file: zipped, where }),
      action,
    }
  }
  if (visible.length > 0) {
    return {
      id: 'bios:ps2',
      state: 'warn',
      title: t('BIOS de PS2: falta el archivo principal'),
      detail: t('En {where} solo hay archivos de apoyo ({files}). Falta la BIOS, el archivo de unos 4 MB.', {
        where,
        files: visible.slice(0, 2).join(', '),
      }),
      action,
    }
  }
  return {
    id: 'bios:ps2',
    state: 'warn',
    title: t('BIOS de PS2: la carpeta está vacía'),
    detail: t('Copia la BIOS de tu consola en {where}.', { where }),
    action,
  }
}

/**
 * The list of checks, in order: USB drive, consoles, internet and your data.
 * @param {Object} input
 * @param {ShellCheck | null} input.shell        null = the shell isn't answering yet
 * @param {string} input.romRoot                  "E:\roms"
 * @param {ConsoleInfo[]} input.consoles          every console
 * @param {string[]} input.knownFolders           folders Relix recognizes (ps1, psx, snes...)
 * @param {'saved'|'pending'|'error'|'off'} input.dataStatus
 * @param {boolean} [input.shellFailed]           the shell didn't answer (or is from before step 6)
 * @returns {Check[]}
 */
export function buildChecks({ shell, romRoot, consoles, knownFolders, dataStatus, shellFailed = false }) {
  /** @type {Check[]} */
  const checks = []
  const withGames = consoles.filter((c) => c.games.length > 0)
  const drive = shell?.drive ?? romRoot.replace(/roms[\\/]*$/i, '')

  // ── USB ──
  checks.push({
    id: 'usb',
    state: withGames.length > 0 ? 'ok' : 'warn',
    title: withGames.length > 0 ? t('USB con tus juegos') : t('El USB no tiene juegos todavía'),
    detail:
      withGames.length > 0
        ? t('{files} en {where}', {
            files: plural(withGames.reduce((n, c) => n + c.games.length, 0), 'juego', 'juegos'),
            where: romRoot,
          })
        : t('Crea una carpeta por consola en {where} (psx, ps2, snes…) y copia ahí tus juegos.', { where: romRoot }),
  })
  if (!shell && shellFailed) {
    checks.push({
      id: 'shell',
      state: 'warn',
      title: t('No se pudo revisar el USB a fondo'),
      detail: t(
        'El shell no respondió a tiempo: faltan permisos, espacio y BIOS. Si actualizaste solo la interfaz, actualiza también el proyecto C#.',
      ),
    })
  }
  if (shell) {
    checks.push(
      shell.writable
        ? { id: 'write', state: 'ok', title: t('Relix puede guardar en el USB'), detail: t('Portadas, colecciones y tus datos.') }
        : {
            id: 'write',
            state: 'error',
            title: t('El USB no deja guardar'),
            detail: t(
              'Sin permisos no se guardan portadas, colecciones ni tus datos. En el PC, aplícale Xbox USB Permissions Tool (DevStore).',
            ),
          },
    )
    if (shell.space) {
      const { free, total } = shell.space
      const low = free < LOW_SPACE_BYTES
      checks.push({
        id: 'space',
        state: low ? 'warn' : 'ok',
        title: low ? t('Queda poco espacio en el USB') : t('Espacio en el USB'),
        detail: low
          ? t('{free} libres de {total}. Las portadas y los juegos nuevos pueden no caber.', {
              free: formatBytes(free),
              total: formatBytes(total),
            })
          : t('{free} libres de {total}.', { free: formatBytes(free), total: formatBytes(total) }),
      })
    }
    const known = new Set(knownFolders.map((f) => f.toLowerCase()))
    const unknown = shell.romFolders.filter((f) => !known.has(f.toLowerCase()))
    if (unknown.length > 0) {
      checks.push({
        id: 'folders',
        state: 'info',
        title: t('Carpetas que Relix no usa: {folders}', {
          folders: `${unknown.slice(0, 4).join(', ')}${unknown.length > 4 ? '…' : ''}`,
        }),
        detail: t('Sus juegos no aparecen: Relix todavía no abre esas consolas, o el nombre de la carpeta es otro.'),
      })
    }
  }

  // ── Consoles with games: their emulator and their BIOS ──
  for (const info of withGames) {
    const { platform, emulator, installed, games } = info
    const action = /** @type {CheckAction} */ ({ kind: 'guide', systemId: platform.id })
    const count = plural(games.length, 'juego', 'juegos')
    if (!emulator) {
      checks.push({
        id: `emu:${platform.id}`,
        state: 'info',
        title: t('{console}: se abre desde Dev Home', { console: platform.name }),
        detail: `${count}. ${platform.noEmulatorNote ? t(platform.noEmulatorNote) : t('Relix todavía no puede abrir esta consola.')}`,
        action,
      })
      continue
    }
    checks.push(
      installed === false
        ? {
            id: `emu:${platform.id}`,
            state: 'error',
            title: t('{console}: falta {emulator}', { console: platform.name, emulator: emulator.name }),
            detail: t('Tienes {games} y el emulador no está instalado. La guía explica cómo.', { games: count }),
            action,
          }
        : {
            id: `emu:${platform.id}`,
            state: installed === true ? 'ok' : 'info',
            title: `${platform.name}: ${emulator.name}`,
            detail: installed === true ? t('{games}. Instalado.', { games: count }) : t('{games}. Se revisa en la Xbox.', { games: count }),
            action,
          },
    )
    if (shell) {
      const bios = platform.id === 'psx' ? ps1Bios(info, shell.folders, drive) : platform.id === 'ps2' ? ps2Bios(info, shell.folders, drive) : null
      if (bios) checks.push(bios)
    }
  }

  // ── Internet and your data ──
  if (shell) {
    checks.push(
      shell.internet
        ? { id: 'internet', state: 'ok', title: t('Conexión a internet'), detail: t('Para bajar portadas.') }
        : {
            id: 'internet',
            state: 'warn',
            title: t('Sin conexión al servidor de portadas'),
            detail: t('Revisa la red de la Xbox. Lo demás funciona igual.'),
          },
    )
  }
  checks.push(
    dataStatus === 'error'
      ? {
          id: 'data',
          state: 'error',
          title: t('Tus datos no se pueden guardar en el USB'),
          detail: t('Quedan solo en la app hasta que el USB tenga permisos.'),
        }
      : dataStatus === 'off'
        ? { id: 'data', state: 'warn', title: t('Tus datos solo están en la app'), detail: t('No se encontró el USB al abrir Relix.') }
        : {
            id: 'data',
            state: 'ok',
            title: t('Tus datos se respaldan en el USB'),
            detail: t('{file} y una copia por día.', { file: `${drive}relix\\data.json` }),
          },
  )
  return checks
}

/** How many errors and warnings there are @param {Check[]} checks */
export function summarize(checks) {
  return {
    errors: checks.filter((c) => c.state === 'error').length,
    warnings: checks.filter((c) => c.state === 'warn').length,
  }
}
