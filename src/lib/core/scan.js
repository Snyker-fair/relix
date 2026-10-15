/**
 * Convierte los archivos que el shell encontró en roms\<consola>\ en juegos.
 *
 * La carpeta roms es la fuente de verdad: lo que está ahí se lista, aunque no
 * haya gamelist de ES-DE. Si ES-DE tiene datos de ese archivo (nombre, año,
 * descripción, favorito, oculto), se usan; si no, el nombre sale del archivo.
 *
 * Reglas:
 *   - Solo los formatos de la consola (platforms.js). Un .bin junto a su .cue no aparece.
 *   - Juegos de varios discos: si hay un .m3u, se lista solo el .m3u; si no, solo el disco 1.
 *   - Wii U en carpetas (Juego/code/juego.rpx): el nombre es el de la carpeta.
 *   - Nombres limpios: "Legend of Zelda, The - Wind Waker (USA) [!]" -> "The Legend of Zelda: Wind Waker".
 *     Si dos juegos quedan con el mismo nombre, se agrega la región: "Okami (Europe)".
 */

import { bySortName, fileStem, normalizeRelativePath } from './esde.js'

/** @typedef {import('./esde.js').Game} Game */
/** @typedef {import('./platforms.js').Platform} Platform */

const DISC = /\s*\(Disc\s*(\d+)(?:\s*of\s*\d+)?\)/i
const TAGS = /\s*[([][^)\]]*[)\]]/g
const LEADING_ARTICLE = /^(.+?), (The|A|An|El|La|Los|Las)(\s+-\s+.*)?$/i

/** "Sub/Juego.chd" -> "chd" */
function extensionOf(/** @type {string} */ path) {
  const name = path.split('/').pop() ?? ''
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/** "Sub/Juego.chd" -> "sub" ; "Juego.chd" -> "" */
function folderOf(/** @type {string} */ path) {
  const i = path.lastIndexOf('/')
  return i >= 0 ? path.slice(0, i).toLowerCase() : ''
}

/**
 * Nombre para mostrar a partir del nombre de archivo.
 * @param {string} stem  nombre sin extensión
 */
export function cleanTitle(stem) {
  const name = stem
    .replace(TAGS, '')
    .replace(/_/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(LEADING_ARTICLE, (_, main, article, rest = '') => `${article} ${main}${rest}`)
    // Los archivos no admiten ":", por eso usan " - " para el subtítulo
    .replace(/\s+-\s+/g, ': ')
  return name || stem
}

/** Primera etiqueta entre paréntesis, normalmente la región: "Okami (Europe) (En,Fr)" -> "Europe" */
function regionOf(/** @type {string} */ stem) {
  const match = /\(([^)]+)\)/.exec(stem.replace(DISC, ''))
  return match ? match[1] : ''
}

/**
 * @param {string} system
 * @param {string} path      ruta relativa dentro de la carpeta de la consola
 * @param {string} rawName   nombre de archivo o carpeta, sin extensión
 * @returns {Game & { region: string }}
 */
function makeGame(system, path, rawName) {
  const name = cleanTitle(rawName)
  return {
    id: `${system}/${path}`,
    system,
    path,
    name,
    sortName: name,
    description: '',
    year: null,
    developer: '',
    publisher: '',
    genre: '',
    players: '',
    rating: null,
    favorite: false,
    hidden: false,
    playCount: 0,
    region: regionOf(rawName),
  }
}

/**
 * Juegos a partir de la lista de archivos de roms\<consola>\.
 * @param {string[]} files   rutas relativas con "/" (como las manda el shell)
 * @param {Platform} platform
 * @returns {Game[]}
 */
export function gamesFromFiles(files, platform) {
  const formats = new Set(platform.extensions)
  const paths = files.map(normalizeRelativePath)

  // .m3u que existen, por carpeta y nombre: "sub/final fantasy vii (usa)"
  const playlists = new Set(
    paths
      .filter((p) => extensionOf(p) === 'm3u')
      .map((p) => `${folderOf(p)}/${fileStem(p).toLowerCase()}`),
  )

  /** @type {Array<Game & { region: string }>} */
  const games = []
  for (const path of paths) {
    const extension = extensionOf(path)
    if (!formats.has(extension)) continue

    if (extension === 'rpx') {
      // Wii U en carpetas: .../Juego [ID]/code/archivo.rpx
      const parts = path.split('/')
      if (parts.length < 3 || parts.at(-2)?.toLowerCase() !== 'code') continue
      games.push(makeGame(platform.id, path, parts.at(-3) ?? path))
      continue
    }

    const stem = fileStem(path)
    const disc = DISC.exec(stem)
    if (disc) {
      const withoutDisc = stem.replace(DISC, '').toLowerCase()
      if (playlists.has(`${folderOf(path)}/${withoutDisc}`)) continue // lo abre el .m3u
      if (Number(disc[1]) !== 1) continue // sin .m3u: solo el disco 1
    }
    games.push(makeGame(platform.id, path, stem))
  }

  // Mismo nombre dos veces (p. ej. versión USA y Europe): se agrega la región
  /** @type {Map<string, number>} */
  const count = new Map()
  for (const g of games) count.set(g.name.toLowerCase(), (count.get(g.name.toLowerCase()) ?? 0) + 1)
  for (const g of games) {
    if ((count.get(g.name.toLowerCase()) ?? 0) > 1 && g.region) {
      g.name = `${g.name} (${g.region})`
      g.sortName = g.name
    }
  }

  return games.sort(bySortName)
}

/**
 * Une lo escaneado con los datos de ES-DE. Manda lo que está en el USB:
 *   - archivo con datos en ES-DE  -> se usan los datos de ES-DE
 *   - archivo sin datos           -> nombre limpio del archivo
 *   - archivo oculto en ES-DE     -> no aparece
 *   - entrada de ES-DE sin archivo -> no aparece (no se podría abrir)
 * @param {Game[]} listed   parseGamelist(..., { includeHidden: true })
 * @param {Game[]} scanned  gamesFromFiles(...)
 * @returns {Game[]}
 */
export function mergeWithGamelist(listed, scanned) {
  const byPath = new Map(listed.map((g) => [g.path.toLowerCase(), g]))
  /** @type {Game[]} */
  const games = []
  for (const game of scanned) {
    const info = byPath.get(game.path.toLowerCase())
    if (!info) games.push(game)
    else if (!info.hidden) games.push({ ...info, path: game.path, id: game.id })
  }
  return games.sort(bySortName)
}
