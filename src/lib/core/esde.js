/**
 * Lectura de la biblioteca de ES-DE.
 *
 * Estructura que ES-DE deja en el disco (y que copiamos al USB de la Xbox):
 *
 *   ES-DE/gamelists/<sistema>/gamelist.xml
 *   ES-DE/downloaded_media/<sistema>/covers/<nombre-del-rom>.png|jpg
 *   ES-DE/downloaded_media/<sistema>/screenshots/...
 *   ES-DE/downloaded_media/<sistema>/fanart/...
 *   roms/<sistema>/<nombre-del-rom>.<ext>
 *
 * A diferencia del EmulationStation clásico, ES-DE no guarda las rutas de las
 * imágenes en el XML: se encuentran por el nombre del archivo del juego.
 */

/**
 * @typedef {Object} Game
 * @property {string} id           Identificador estable: `<sistema>/<ruta relativa>`
 * @property {string} system
 * @property {string} path         Ruta relativa tal como viene en el XML, sin "./"
 * @property {string} name
 * @property {string} sortName
 * @property {string} description
 * @property {number|null} year
 * @property {string} developer
 * @property {string} publisher
 * @property {string} genre
 * @property {string} players
 * @property {number|null} rating  De 0 a 1
 * @property {boolean} favorite
 * @property {boolean} hidden
 * @property {number} playCount
 */

/** Tipos de imagen de ES-DE que usamos, en orden de preferencia para la portada. */
export const MEDIA_TYPES = ['covers', 'screenshots', 'titlescreens', 'fanart', 'marquees', 'miniatures']
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp']

/** @param {Element} el @param {string} tag */
function text(el, tag) {
  return el.getElementsByTagName(tag)[0]?.textContent?.trim() ?? ''
}

/** "./Carpeta/Juego.chd" -> "Carpeta/Juego.chd" (normaliza separadores) */
export function normalizeRelativePath(p) {
  return p.replace(/\\/g, '/').replace(/^\.\//, '')
}

/** "19991231T000000" -> 1999 */
export function parseYear(releaseDate) {
  const m = /^(\d{4})/.exec(releaseDate ?? '')
  return m ? Number(m[1]) : null
}

/** El nombre de archivo sin carpeta ni extensión: "Sub/Okami (USA).chd" -> "Okami (USA)" */
export function fileStem(relPath) {
  const name = normalizeRelativePath(relPath).split('/').pop() ?? ''
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

/**
 * Lee un gamelist.xml de ES-DE.
 * @param {string} xml
 * @param {string} system  id del sistema (psx, ps2...)
 * @returns {Game[]}
 */
export function parseGamelist(xml, system) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(`El gamelist.xml de "${system}" no es un XML válido.`)
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

  return games
    .filter((g) => !g.hidden)
    .sort((a, b) => a.sortName.localeCompare(b.sortName, 'es', { sensitivity: 'base' }))
}

/**
 * Ruta absoluta (estilo Windows) del juego en la consola.
 * @param {string} romRoot  p. ej. "E:\\roms"
 * @param {Game} game
 */
export function romAbsolutePath(romRoot, game) {
  const root = romRoot.replace(/[\\/]+$/, '')
  return [root, game.system, ...game.path.split('/')].join('\\')
}

/**
 * Rutas posibles de una imagen del juego, en orden. El shell revisa cuál existe.
 * @param {string} mediaRoot  p. ej. "E:\\ES-DE\\downloaded_media"
 * @param {Game} game
 * @param {string} type       uno de MEDIA_TYPES
 */
export function mediaCandidates(mediaRoot, game, type) {
  const root = mediaRoot.replace(/[\\/]+$/, '')
  const parts = game.path.split('/')
  parts[parts.length - 1] = fileStem(game.path)
  const base = [root, game.system, type, ...parts].join('\\')
  return IMAGE_EXTENSIONS.map((ext) => `${base}.${ext}`)
}
