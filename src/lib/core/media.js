/**
 * Each game's images and videos, beyond the cover. They're in
 * ES-DE/downloaded_media/<console>/<type>/, with the same name as the game:
 * ES-DE leaves them when scraping on the PC, and Relix adds screenshots from libretro.
 *
 *   background: the fan art; if there's none, a screenshot; otherwise, the title screen
 *   logo:       marquees (ES-DE keeps the game's logo there, with transparency)
 *   video:      videos (the preview in the game panel)
 */

/** Folders the shell is asked for (covers go separately: covers) */
export const MEDIA_LISTED = ['screenshots', 'titlescreens', 'fanart', 'marquees', 'videos']

/** For the background, in order of preference */
export const BACKGROUND_TYPES = ['fanart', 'screenshots', 'titlescreens']

/**
 * @typedef {Record<string, string[]>} MediaFiles  type -> files with their extension ("Okami (USA).png")
 * @typedef {Map<string, Map<string, string>>} MediaIndex  type -> (lowercase key -> file)
 * @typedef {{ type: string, file: string }} MediaPick
 * @typedef {{ background: MediaPick | null, logo: MediaPick | null, video: MediaPick | null }} GameMedia
 */

/** "FF7 (USA)/FF7 (USA).png" -> "ff7 (usa)/ff7 (usa)" @param {string} file */
export const fileKey = (file) => file.replace(/\.[^./]+$/, '').toLowerCase()

/**
 * Sorts a console's files to look them up by game.
 * @param {MediaFiles | undefined} files
 * @returns {MediaIndex}
 */
export function indexMedia(files) {
  /** @type {MediaIndex} */
  const index = new Map()
  for (const [type, list] of Object.entries(files ?? {})) {
    index.set(type, new Map(list.map((file) => [fileKey(file), file])))
  }
  return index
}

/**
 * Which background, logo and video a game has.
 * @param {string} key  the game's coverKey (its path without the extension), in any case
 * @param {MediaIndex} index
 * @returns {GameMedia}
 */
export function pickMedia(key, index) {
  const k = key.toLowerCase()
  /** @param {string} type @returns {MediaPick | null} */
  const find = (type) => {
    const file = index.get(type)?.get(k)
    return file ? { type, file } : null
  }
  let background = null
  for (const type of BACKGROUND_TYPES) {
    background = find(type)
    if (background) break
  }
  return { background, logo: find('marquees'), video: find('videos') }
}

/**
 * Does it already have a background? (fan art, screenshot or title screen)
 * @param {string} key @param {MediaIndex} index
 */
export function hasBackground(key, index) {
  return pickMedia(key, index).background !== null
}
