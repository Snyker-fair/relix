/**
 * Reading the ES-DE library.
 *
 * The structure ES-DE leaves on the drive (and that we copy to the Xbox's USB drive):
 *
 *   ES-DE/gamelists/<system>/gamelist.xml
 *   ES-DE/downloaded_media/<system>/covers/<rom-name>.png|jpg
 *   ES-DE/downloaded_media/<system>/screenshots/...
 *   ES-DE/downloaded_media/<system>/fanart/...
 *   roms/<system>/<rom-name>.<ext>
 *
 * Unlike classic EmulationStation, ES-DE doesn't keep the image paths in the
 * XML: they're found by the game's file name.
 */
import { t } from '../i18n/i18n.svelte.js'

/**
 * @typedef {Object} Game
 * @property {string} id           A stable identifier: `<system>/<relative path>`
 * @property {string} system
 * @property {string} path         The relative path as it comes in the XML, without "./"
 * @property {string} name
 * @property {string} sortName
 * @property {string} description
 * @property {number|null} year
 * @property {string} developer
 * @property {string} publisher
 * @property {string} genre
 * @property {string} players
 * @property {number|null} rating  From 0 to 1
 * @property {boolean} favorite
 * @property {boolean} hidden
 * @property {number} playCount
 */

/** ES-DE image types we use, in order of preference for the cover. */
export const MEDIA_TYPES = ['covers', 'screenshots', 'titlescreens', 'fanart', 'marquees', 'miniatures']
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp']

/** @param {Element} el @param {string} tag */
function text(el, tag) {
  return el.getElementsByTagName(tag)[0]?.textContent?.trim() ?? ''
}

/** "./Folder/Game.chd" -> "Folder/Game.chd" (normalizes separators) */
export function normalizeRelativePath(p) {
  return p.replace(/\\/g, '/').replace(/^\.\//, '')
}

/** "19991231T000000" -> 1999 */
export function parseYear(releaseDate) {
  const m = /^(\d{4})/.exec(releaseDate ?? '')
  return m ? Number(m[1]) : null
}

/** The file name without folder or extension: "Sub/Okami (USA).chd" -> "Okami (USA)" */
export function fileStem(relPath) {
  const name = normalizeRelativePath(relPath).split('/').pop() ?? ''
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

/** Files with a generic name: the game's name is its folder's */
const GENERIC_STEMS = /^(default|disc|disco|game|track\s*0*1)$/i

/**
 * Where a game's name comes from (to show it and find its cover):
 *   "Okami (USA).chd"                 -> "Okami (USA)"
 *   "Halo 3 (USA)/default.xex"        -> "Halo 3 (USA)"   (Xbox 360)
 *   "Shenmue (USA)/disc.gdi"          -> "Shenmue (USA)"  (Dreamcast)
 *   "Zelda [ABC]/code/zelda.rpx"      -> "Zelda [ABC]"    (Wii U in folders)
 * @param {string} relPath
 */
export function titleStem(relPath) {
  const folder = titleFolderIndex(relPath)
  return folder >= 0 ? normalizeRelativePath(relPath).split('/')[folder] : fileStem(relPath)
}

/**
 * Which part of the path the game's name comes from: the index of that folder in
 * the path's parts ("Halo 3 (USA)/default.xex" -> 0), or -1 for the file itself.
 * @param {string} relPath
 */
export function titleFolderIndex(relPath) {
  const parts = normalizeRelativePath(relPath).split('/')
  if (/\.rpx$/i.test(relPath) && parts.length >= 3 && parts.at(-2)?.toLowerCase() === 'code') {
    return parts.length - 3
  }
  if (GENERIC_STEMS.test(fileStem(relPath)) && parts.length >= 2) return parts.length - 2
  return -1
}

/**
 * Reads an ES-DE gamelist.xml.
 * @param {string} xml
 * @param {string} system  the system's id (psx, ps2...)
 * @param {{ includeHidden?: boolean }} [options]  includeHidden: also return
 *   the hidden games (with hidden: true), so scanning doesn't show them again
 * @returns {Game[]}
 */
export function parseGamelist(xml, system, { includeHidden = false } = {}) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(t('El gamelist.xml de "{system}" no es un XML válido.', { system }))
  }

  /** @type {Game[]} */
  const games = []
  for (const el of Array.from(doc.getElementsByTagName('game'))) {
    const path = normalizeRelativePath(text(el, 'path'))
    if (!path) continue

    const name = text(el, 'name') || fileStem(path)
    const rating = Number.parseFloat(text(el, 'rating'))

    games.push({
      id: `${system}/${path}`,
      system,
      path,
      name,
      sortName: text(el, 'sortname') || name,
      description: text(el, 'desc'),
      year: parseYear(text(el, 'releasedate')),
      developer: text(el, 'developer'),
      publisher: text(el, 'publisher'),
      genre: text(el, 'genre'),
      players: text(el, 'players'),
      rating: Number.isFinite(rating) ? rating : null,
      favorite: text(el, 'favorite') === 'true',
      hidden: text(el, 'hidden') === 'true',
      playCount: Number.parseInt(text(el, 'playcount'), 10) || 0,
    })
  }

  return games.filter((g) => includeHidden || !g.hidden).sort(bySortName)
}

/** Alphabetical order in Spanish, ignoring case and accents */
export function bySortName(/** @type {Game} */ a, /** @type {Game} */ b) {
  return a.sortName.localeCompare(b.sortName, 'es', { sensitivity: 'base' })
}

/**
 * The game's absolute path (Windows style) on the console.
 * @param {string} romRoot  e.g. "E:\\roms"
 * @param {Game} game
 * @param {string} [folder]  the console's real folder inside roms (e.g. "ps1");
 *   by default, the system's id
 */
export function romAbsolutePath(romRoot, game, folder = game.system) {
  const root = romRoot.replace(/[\\/]+$/, '')
  return [root, folder, ...game.path.split('/')].join('\\')
}

/**
 * The URL of a game image served by the shell (RelixShell).
 * It has no extension: the shell tries .png, .jpg, .jpeg and .webp on the USB drive.
 *
 *   mediaUrl('https://relix.example/media', game, 'covers')
 *   -> https://relix.example/media/psx/covers/Final%20Fantasy%20VII%20(USA)/Final%20Fantasy%20VII%20(USA)
 *
 * @param {string} mediaBase
 * @param {Game} game
 * @param {string} type  one of MEDIA_TYPES
 */
export function mediaUrl(mediaBase, game, type) {
  const parts = game.path.split('/')
  parts[parts.length - 1] = fileStem(game.path)
  return [mediaBase.replace(/\/+$/, ''), game.system, type, ...parts.map(encodeURIComponent)].join('/')
}

/**
 * The possible paths of a game image, in order. The shell checks which one exists.
 * @param {string} mediaRoot  e.g. "E:\\ES-DE\\downloaded_media"
 * @param {Game} game
 * @param {string} type       one of MEDIA_TYPES
 */
export function mediaCandidates(mediaRoot, game, type) {
  const root = mediaRoot.replace(/[\\/]+$/, '')
  const parts = game.path.split('/')
  parts[parts.length - 1] = fileStem(game.path)
  const base = [root, game.system, type, ...parts].join('\\')
  return IMAGE_EXTENSIONS.map((ext) => `${base}.${ext}`)
}
