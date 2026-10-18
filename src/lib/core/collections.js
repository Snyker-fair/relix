/**
 * Custom collections in ES-DE's format, so they work in Relix and in
 * ES-DE at the same time:
 *
 *   ES-DE/collections/custom-<Name>.cfg
 *
 * One line per game, relative to the ROM folder:
 *
 *   %ROMPATH%/psx/Final Fantasy VII (USA)/Final Fantasy VII (USA).m3u
 *   %ROMPATH%/ps2/Ookami (USA).chd
 *
 * The lines Relix doesn't recognize (consoles it doesn't handle yet, paths to
 * other drives) are kept as they are when saving.
 */

export const ROMPATH = '%ROMPATH%'
const PREFIX = 'custom-'
const EXTENSION = '.cfg'

/**
 * A collection name fit for a file: without the characters Windows doesn't
 * accept, without repeated spaces and up to 40 characters long.
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

/** "With friends" -> "custom-With friends.cfg" */
export function collectionFileName(/** @type {string} */ name) {
  return `${PREFIX}${cleanCollectionName(name)}${EXTENSION}`
}

/** "custom-With friends.cfg" -> "With friends"; null if it isn't a custom collection */
export function collectionNameFromFile(/** @type {string} */ file) {
  const lower = file.toLowerCase()
  if (!lower.startsWith(PREFIX) || !lower.endsWith(EXTENSION)) return null
  return file.slice(PREFIX.length, -EXTENSION.length) || null
}

/**
 * The lines of a .cfg: without empty or repeated ones.
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
 * The line for a game. `folder` is its console's real folder inside roms.
 * @param {string} folder  e.g. "ps1"
 * @param {string} path    the game's path inside that folder, with "/"
 */
export function lineForGame(folder, path) {
  return `${ROMPATH}/${folder}/${path}`
}

/**
 * Which game a line points to.
 * @param {string} line
 * @param {Map<string, string>} folderToSystem  lowercase folder -> console id
 * @param {string} [romRoot]  e.g. "E:\\roms", for lines with a full path
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
 * The game ids ("psx/Game.chd") of a collection, in lowercase to compare them.
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
 * Adds a game to a collection or removes it, without touching the other lines.
 * @param {string[]} lines
 * @param {{ system: string, path: string }} game
 * @param {string} folder  its console's real folder (for the new line)
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
