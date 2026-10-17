/**
 * Revisión del sistema: con lo que mide el shell (USB, espacio, carpetas,
 * archivos de BIOS, internet) y lo que Relix ya sabe (juegos, emuladores,
 * respaldo), arma una lista de chequeos con su estado y cómo arreglar cada uno.
 *
 * La BIOS solo se puede revisar si está en el USB, en las carpetas que indican
 * las guías. Si la pusiste dentro del emulador (Device Portal), Relix no la ve
 * y lo dice sin marcarlo como error.
 */
import { PS1_BIOS, ps1BiosRegion } from './quickExit.js'

/** "1 juego", "3 juegos" @param {number} n @param {string} one @param {string} many */
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/** Carpetas de BIOS en el USB, las mismas de las guías (relativas a la raíz) */
export const BIOS_FOLDERS = {
  retroarch: 'RetroArch\\system',
  duckstation: 'DuckStation\\bios',
  xbsx2: 'XBSX2\\BIOS',
}
/** Lo que se le pide al shell que liste */
export const CHECK_FOLDERS = Object.values(BIOS_FOLDERS)

/** Menos que esto libre es poco para seguir sumando juegos */
const LOW_SPACE_BYTES = 2 * 1024 ** 3

const REGION_NAMES = { japan: 'Japón', usa: 'EE. UU.', europe: 'Europa' }

/**
 * @typedef {'ok'|'warn'|'error'|'info'} CheckState
 * @typedef {{ kind: 'guide', systemId: string }} CheckAction
 * @typedef {{ id: string, state: CheckState, title: string, detail: string, action?: CheckAction }} Check
 *
 * @typedef {Object} ShellCheck  lo que responde el shell (ver SystemCheck.cs)
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

/** "182 GB" @param {number} bytes */
export function formatBytes(bytes) {
  const gb = bytes / 1024 ** 3
  if (gb >= 10) return `${Math.round(gb)} GB`
  if (gb >= 1) return `${gb.toFixed(1).replace('.', ',')} GB`
  return `${Math.round(bytes / 1024 ** 2)} MB`
}

/** ¿Está el archivo en la lista? Sin distinguir mayúsculas (la Xbox no las distingue) */
const hasFile = (/** @type {string[]} */ files, /** @type {string} */ name) =>
  files.some((f) => f.toLowerCase() === name.toLowerCase())

/**
 * La BIOS de PS1: qué archivos hacen falta según la región de tus juegos.
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
      title: 'BIOS de PS1: no la veo en el USB',
      detail: `No existe ${where}. Si la pusiste dentro del emulador con el Device Portal, Relix no puede verla.`,
      action,
    }
  }

  // Cuántos juegos de cada región: cada una pide su archivo
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
      ? { id: 'bios:psx', state: 'ok', title: 'BIOS de PS1 en su lugar', detail: where, action }
      : { id: 'bios:psx', state: 'warn', title: 'BIOS de PS1: falta', detail: `Copia scph5501.bin (o la de tu región) en ${where}.`, action }
  }

  const missing = regions.filter((r) => !hasFile(files, PS1_BIOS[r].file))
  if (missing.length === 0) {
    return {
      id: 'bios:psx',
      state: 'ok',
      title: 'BIOS de PS1 en su lugar',
      detail: `${regions.map((r) => PS1_BIOS[r].file).join(', ')} en ${where}`,
      action,
    }
  }
  return {
    id: 'bios:psx',
    state: 'warn',
    title: `BIOS de PS1: falta ${missing.map((r) => PS1_BIOS[r].file).join(' y ')}`,
    detail: `${missing.map((r) => `${plural(byRegion[r], 'juego', 'juegos')} de ${REGION_NAMES[r]}`).join(' y ')} ${missing.length === 1 && byRegion[missing[0]] === 1 ? 'la necesita' : 'la necesitan'}. Va en ${where}.`,
    action,
  }
}

/**
 * La BIOS de PS2 (XBSX2): cualquier .bin en su carpeta sirve.
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
      title: 'BIOS de PS2: no la veo en el USB',
      detail: `No existe ${where}. Si la elegiste desde otra carpeta en XBSX2, Relix no puede verla.`,
      action,
    }
  }
  const bios = files.filter((f) => /\.bin$/i.test(f))
  return bios.length > 0
    ? { id: 'bios:ps2', state: 'ok', title: 'BIOS de PS2 en su lugar', detail: `${bios[0]} en ${where}`, action }
    : { id: 'bios:ps2', state: 'warn', title: 'BIOS de PS2: la carpeta está vacía', detail: `Copia la BIOS de tu consola (.bin) en ${where}.`, action }
}

/**
 * La lista de chequeos, en orden: USB, consolas, internet y tus datos.
 * @param {Object} input
 * @param {ShellCheck | null} input.shell        null = el shell aún no responde
 * @param {string} input.romRoot                  "E:\roms"
 * @param {ConsoleInfo[]} input.consoles          todas las consolas
 * @param {string[]} input.knownFolders           carpetas que Relix reconoce (ps1, psx, snes...)
 * @param {'saved'|'pending'|'error'|'off'} input.dataStatus
 * @param {boolean} [input.shellFailed]           el shell no respondió (o es anterior al paso 6)
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
    title: withGames.length > 0 ? 'USB con tus juegos' : 'El USB no tiene juegos todavía',
    detail:
      withGames.length > 0
        ? `${plural(withGames.reduce((n, c) => n + c.games.length, 0), 'juego', 'juegos')} en ${romRoot}`
        : `Crea una carpeta por consola en ${romRoot} (psx, ps2, snes…) y copia ahí tus juegos.`,
  })
  if (!shell && shellFailed) {
    checks.push({
      id: 'shell',
      state: 'warn',
      title: 'No se pudo revisar el USB a fondo',
      detail: 'El shell no respondió a tiempo: faltan permisos, espacio y BIOS. Si actualizaste solo la interfaz, actualiza también el proyecto C#.',
    })
  }
  if (shell) {
    checks.push(
      shell.writable
        ? { id: 'write', state: 'ok', title: 'Relix puede guardar en el USB', detail: 'Portadas, colecciones y tus datos.' }
        : {
            id: 'write',
            state: 'error',
            title: 'El USB no deja guardar',
            detail: 'Sin permisos no se guardan portadas, colecciones ni tus datos. En el PC, aplícale Xbox USB Permissions Tool (DevStore).',
          },
    )
    if (shell.space) {
      const { free, total } = shell.space
      const low = free < LOW_SPACE_BYTES
      checks.push({
        id: 'space',
        state: low ? 'warn' : 'ok',
        title: low ? 'Queda poco espacio en el USB' : 'Espacio en el USB',
        detail: `${formatBytes(free)} libres de ${formatBytes(total)}.${low ? ' Las portadas y los juegos nuevos pueden no caber.' : ''}`,
      })
    }
    const known = new Set(knownFolders.map((f) => f.toLowerCase()))
    const unknown = shell.romFolders.filter((f) => !known.has(f.toLowerCase()))
    if (unknown.length > 0) {
      checks.push({
        id: 'folders',
        state: 'info',
        title: `Carpetas que Relix no usa: ${unknown.slice(0, 4).join(', ')}${unknown.length > 4 ? '…' : ''}`,
        detail: 'Sus juegos no aparecen: Relix todavía no abre esas consolas, o el nombre de la carpeta es otro.',
      })
    }
  }

  // ── Consolas con juegos: su emulador y su BIOS ──
  for (const info of withGames) {
    const { platform, emulator, installed, games } = info
    const action = /** @type {CheckAction} */ ({ kind: 'guide', systemId: platform.id })
    const count = plural(games.length, 'juego', 'juegos')
    if (!emulator) {
      checks.push({
        id: `emu:${platform.id}`,
        state: 'info',
        title: `${platform.name}: se abre desde Dev Home`,
        detail: `${count}. ${platform.noEmulatorNote ?? 'Relix todavía no puede abrir esta consola.'}`,
        action,
      })
      continue
    }
    checks.push(
      installed === false
        ? {
            id: `emu:${platform.id}`,
            state: 'error',
            title: `${platform.name}: falta ${emulator.name}`,
            detail: `Tienes ${count} y el emulador no está instalado. La guía explica cómo.`,
            action,
          }
        : {
            id: `emu:${platform.id}`,
            state: installed === true ? 'ok' : 'info',
            title: `${platform.name}: ${emulator.name}`,
            detail: installed === true ? `${count}. Instalado.` : `${count}. Se revisa en la Xbox.`,
            action,
          },
    )
    if (shell) {
      const bios = platform.id === 'psx' ? ps1Bios(info, shell.folders, drive) : platform.id === 'ps2' ? ps2Bios(info, shell.folders, drive) : null
      if (bios) checks.push(bios)
    }
  }

  // ── Internet y tus datos ──
  if (shell) {
    checks.push(
      shell.internet
        ? { id: 'internet', state: 'ok', title: 'Conexión a internet', detail: 'Para bajar portadas.' }
        : {
            id: 'internet',
            state: 'warn',
            title: 'Sin conexión al servidor de portadas',
            detail: 'Revisa la red de la Xbox. Lo demás funciona igual.',
          },
    )
  }
  checks.push(
    dataStatus === 'error'
      ? { id: 'data', state: 'error', title: 'Tus datos no se pueden guardar en el USB', detail: 'Quedan solo en la app hasta que el USB tenga permisos.' }
      : dataStatus === 'off'
        ? { id: 'data', state: 'warn', title: 'Tus datos solo están en la app', detail: 'No se encontró el USB al abrir Relix.' }
        : { id: 'data', state: 'ok', title: 'Tus datos se respaldan en el USB', detail: `${drive}relix\\datos.json y una copia por día.` },
  )
  return checks
}

/** Cuántos errores y advertencias hay @param {Check[]} checks */
export function summarize(checks) {
  return {
    errors: checks.filter((c) => c.state === 'error').length,
    warnings: checks.filter((c) => c.state === 'warn').length,
  }
}
