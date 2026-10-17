/**
 * Imágenes y videos de cada juego, más allá de la portada. Están en
 * ES-DE/downloaded_media/<consola>/<tipo>/, con el mismo nombre que el juego:
 * los deja ES-DE al escrapear en el PC, y Relix suma capturas de libretro.
 *
 *   fondo: el fanart; si no hay, una captura; si no, la pantalla de título
 *   logo:  marquees (ES-DE guarda ahí el logo del juego, con transparencia)
 *   video: videos (vista previa en el panel del juego)
 */

/** Carpetas que se le piden al shell (las portadas van aparte: covers) */
export const MEDIA_LISTED = ['screenshots', 'titlescreens', 'fanart', 'marquees', 'videos']

/** Para el fondo, en orden de preferencia */
export const BACKGROUND_TYPES = ['fanart', 'screenshots', 'titlescreens']

/**
 * @typedef {Record<string, string[]>} MediaFiles  tipo -> archivos con extensión ("Okami (USA).png")
 * @typedef {Map<string, Map<string, string>>} MediaIndex  tipo -> (clave en minúsculas -> archivo)
 * @typedef {{ type: string, file: string }} MediaPick
 * @typedef {{ background: MediaPick | null, logo: MediaPick | null, video: MediaPick | null }} GameMedia
 */

/** "FF7 (USA)/FF7 (USA).png" -> "ff7 (usa)/ff7 (usa)" @param {string} file */
export const fileKey = (file) => file.replace(/\.[^./]+$/, '').toLowerCase()

/**
 * Ordena los archivos de una consola para buscarlos por juego.
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
 * Qué fondo, logo y video tiene un juego.
 * @param {string} key  coverKey del juego (ruta sin extensión), en cualquier mayúscula
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
 * ¿Ya tiene fondo? (fanart, captura o pantalla de título)
 * @param {string} key @param {MediaIndex} index
 */
export function hasBackground(key, index) {
  return pickMedia(key, index).background !== null
}
