/**
 * Colecciones personalizadas con el formato de ES-DE, para que sirvan en
 * Relix y en ES-DE a la vez:
 *
 *   ES-DE/collections/custom-<Nombre>.cfg
 *
 * Una línea por juego, relativa a la carpeta de ROMs:
 *
 *   %ROMPATH%/psx/Final Fantasy VII (USA)/Final Fantasy VII (USA).m3u
 *   %ROMPATH%/ps2/Ookami (USA).chd
 *
 * Las líneas que Relix no reconoce (consolas que todavía no maneja, rutas a
 * otros discos) se conservan tal cual al guardar.
 */

export const ROMPATH = '%ROMPATH%'
const PREFIX = 'custom-'
const EXTENSION = '.cfg'

/**
 * Nombre de colección apto para archivo: sin los caracteres que Windows no
 * acepta, sin espacios repetidos y de hasta 40 caracteres.
 * @param {string} name
 */
export function cleanCollectionName(name) {
  return name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
    .trim()
}

/** "Con amigos" -> "custom-Con amigos.cfg" */
export function collectionFileName(/** @type {string} */ name) {
  return `${PREFIX}${cleanCollectionName(name)}${EXTENSION}`
}

/** "custom-Con amigos.cfg" -> "Con amigos"; null si no es una colección personalizada */
export function collectionNameFromFile(/** @type {string} */ file) {
  const lower = file.toLowerCase()
  if (!lower.startsWith(PREFIX) || !lower.endsWith(EXTENSION)) return null
  return file.slice(PREFIX.length, -EXTENSION.length) || null
}

/**
 * Líneas de un .cfg: sin vacías ni repetidas.
 * @param {string} text
 * @returns {string[]}
 */
export function parseCollection(text) {
  /** @type {string[]} */
  const lines = []
  const seen = new Set()
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || seen.has(line.toLowerCase())) continue
    seen.add(line.toLowerCase())
    lines.push(line)
  }
  return lines
}

/** @param {string[]} lines */
export function serializeCollection(lines) {
  return lines.length > 0 ? `${lines.join('\n')}\n` : ''
}

/**
 * Línea para un juego. `folder` es la carpeta real de su consola dentro de roms.
 * @param {string} folder  p. ej. "ps1"
 * @param {string} path    ruta del juego dentro de esa carpeta, con "/"
 */
export function lineForGame(folder, path) {
  return `${ROMPATH}/${folder}/${path}`
}

/**
 * Qué juego indica una línea.
 * @param {string} line
 * @param {Map<string, string>} folderToSystem  carpeta en minúsculas -> id de consola
 * @param {string} [romRoot]  p. ej. "E:\\roms", para líneas con ruta completa
 * @returns {{ system: string, path: string } | null}
 */
export function resolveLine(line, folderToSystem, romRoot = '') {
  const normalized = line.replace(/\\/g, '/')
  let rest = null
  if (normalized.startsWith(`${ROMPATH}/`)) {
    rest = normalized.slice(ROMPATH.length + 1)
  } else if (romRoot) {
    const root = `${romRoot.replace(/\\/g, '/').replace(/\/+$/, '')}/`
    if (normalized.toLowerCase().startsWith(root.toLowerCase())) rest = normalized.slice(root.length)
  }
  if (!rest) return null

  const slash = rest.indexOf('/')
  if (slash <= 0) return null
  const system = folderToSystem.get(rest.slice(0, slash).toLowerCase())
  const path = rest.slice(slash + 1)
  return system && path ? { system, path } : null
}

/**
 * Ids de juego ("psx/Juego.chd") de una colección, en minúsculas para compararlos.
 * @param {string[]} lines
 * @param {Map<string, string>} folderToSystem
 * @param {string} [romRoot]
 */
export function collectionGameKeys(lines, folderToSystem, romRoot) {
  /** @type {Set<string>} */
  const keys = new Set()
  for (const line of lines) {
    const game = resolveLine(line, folderToSystem, romRoot)
    if (game) keys.add(`${game.system}/${game.path}`.toLowerCase())
  }
  return keys
}

/**
 * Agrega o quita un juego de una colección, sin tocar las demás líneas.
 * @param {string[]} lines
 * @param {{ system: string, path: string }} game
 * @param {string} folder  carpeta real de su consola (para la línea nueva)
 * @param {boolean} include
 * @param {Map<string, string>} folderToSystem
 * @param {string} [romRoot]
 */
export function setInCollection(lines, game, folder, include, folderToSystem, romRoot) {
  const key = `${game.system}/${game.path}`.toLowerCase()
  const kept = lines.filter((line) => {
    const found = resolveLine(line, folderToSystem, romRoot)
    return !found || `${found.system}/${found.path}`.toLowerCase() !== key
  })
  return include ? [...kept, lineForGame(folder, game.path)] : kept
}
