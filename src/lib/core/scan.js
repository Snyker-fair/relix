/**
 * Turns the files the shell found in roms\<console>\ into games.
 *
 * The roms folder is the source of truth: what's there gets listed, even
 * without an ES-DE gamelist. If ES-DE has data for that file (name, year,
 * description, favorite, hidden), it's used; otherwise the name comes from the file.
 *
 * Rules:
 *   - Only the console's formats (platforms.js). A .bin next to its .cue doesn't show up.
 *   - Multi-disc games: if there's an .m3u, only the .m3u is listed; otherwise, only disc 1.
 *   - Wii U in folders (Game/code/game.rpx): the name is the folder's.
 *   - Files with a generic name (Game/default.xex, Game/disc.gdi): the same.
 *   - Clean names: "Legend of Zelda, The - Wind Waker (USA) [!]" -> "The Legend of Zelda: Wind Waker".
 *     If two games end up with the same name, the region is added: "Okami (Europe)".
 */

import { bySortName, fileStem, normalizeRelativePath, titleStem } from './esde.js'

/** @typedef {import('./esde.js').Game} Game */
/** @typedef {import('./platforms.js').Platform} Platform */

const DISC = /\s*\(Disc\s*(\d+)(?:\s*of\s*\d+)?\)/i
const TAGS = /\s*[([][^)\]]*[)\]]/g
const LEADING_ARTICLE = /^(.+?), (The|A|An|El|La|Los|Las)(\s+-\s+.*)?$/i

/** "Sub/Game.chd" -> "chd" */
function extensionOf(/** @type {string} */ path) {
  const name = path.split('/').pop() ?? ''
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/** "Sub/Game.chd" -> "sub" ; "Game.chd" -> "" */
function folderOf(/** @type {string} */ path) {
  const i = path.lastIndexOf('/')
  return i >= 0 ? path.slice(0, i).toLowerCase() : ''
}

/**
 * The name to show, from the file name.
 * @param {string} stem  the name without its extension
 */
export function cleanTitle(stem) {
  const name = stem
    .replace(TAGS, '')
    .replace(/_/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(LEADING_ARTICLE, (_, main, article, rest = '') => `${article} ${main}${rest}`)
    // Files can't have ":", that's why they use " - " for the subtitle
    .replace(/\s+-\s+/g, ': ')
  return name || stem
}

/** The first tag in parentheses, usually the region: "Okami (Europe) (En,Fr)" -> "Europe" */
function regionOf(/** @type {string} */ stem) {
  const match = /\(([^)]+)\)/.exec(stem.replace(DISC, ''))
  return match ? match[1] : ''
}

/**
 * @param {string} system
 * @param {string} path      the relative path inside the console's folder
 * @param {string} rawName   the file or folder name, without the extension
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
 * Games from the list of files in roms\<console>\.
 * @param {string[]} files   relative paths with "/" (as the shell sends them)
 * @param {Platform} platform
 * @returns {Game[]}
 */
export function gamesFromFiles(files, platform) {
  const formats = new Set(platform.extensions)
  const paths = files.map(normalizeRelativePath)

  // .m3u files that exist, by folder and name: "sub/final fantasy vii (usa)"
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
      // Wii U in folders: .../Game [ID]/code/file.rpx
      const parts = path.split('/')
      if (parts.length < 3 || parts.at(-2)?.toLowerCase() !== 'code') continue
      games.push(makeGame(platform.id, path, titleStem(path)))
      continue
    }

    const stem = fileStem(path)
    const disc = DISC.exec(stem)
    if (disc) {
      const withoutDisc = stem.replace(DISC, '').toLowerCase()
      if (playlists.has(`${folderOf(path)}/${withoutDisc}`)) continue // the .m3u opens it
      if (Number(disc[1]) !== 1) continue // without an .m3u: only disc 1
    }
    games.push(makeGame(platform.id, path, titleStem(path)))
  }

  // The same name twice (e.g. the USA and Europe versions): the region is added
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
 * Merges what was scanned with ES-DE's data. What's on the USB drive rules:
 *   - a file with data in ES-DE   -> ES-DE's data is used
 *   - a file without data         -> the file's clean name
 *   - a file hidden in ES-DE      -> doesn't show up
 *   - an ES-DE entry without a file -> doesn't show up (it couldn't be opened)
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
