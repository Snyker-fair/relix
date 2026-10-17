/**
 * Busca la portada de cada juego en libretro-thumbnails (las mismas portadas
 * que usa RetroArch). libretro nombra cada imagen con el nombre estándar del
 * juego (Redump / No-Intro), p. ej. "Kingdom Hearts II (USA).png".
 *
 * Se busca en tres niveles:
 *   1. Nombre exacto: el archivo ya tiene el nombre estándar (lo habitual al
 *      convertir a CHD). Es seguro.
 *   2. Mismo título: "kingdom_hearts_2.iso" -> "Kingdom Hearts II (USA)".
 *      Ignora mayúsculas, tildes, guiones bajos, "The" y números romanos.
 *      Si el archivo dice la región, se respeta; si no, se usa la preferida.
 *   3. Candidatas: apodos como "Zelda Wind Waker". No se elige solo: se
 *      ofrecen las más parecidas para que el jugador elija.
 */

import { fileStem, titleStem } from './esde.js'

export const THUMBNAILS_SERVER = 'https://thumbnails.libretro.com'

/** Regiones que aparecen en los nombres estándar */
const REGION_WORDS = new Set([
  'USA', 'Canada', 'Europe', 'Japan', 'World', 'Spain', 'France', 'Germany', 'Italy', 'UK',
  'Asia', 'Korea', 'China', 'Taiwan', 'Australia', 'Brazil', 'Netherlands', 'Scandinavia',
  'Russia', 'Latin America', 'Mexico', 'Argentina', 'Portugal', 'Sweden', 'Hong Kong',
])

/** Orden de preferencia cuando el archivo no dice su región */
export const REGION_PREFERENCES = {
  usa: ['USA', 'Canada', 'World', 'Latin America', 'Mexico', 'Brazil', 'Europe', 'Spain', 'UK', 'Australia', 'Asia', 'Japan'],
  europe: ['Spain', 'Europe', 'World', 'UK', 'Australia', 'France', 'Italy', 'Germany', 'USA', 'Canada', 'Asia', 'Japan'],
  japan: ['Japan', 'Asia', 'World', 'USA', 'Canada', 'Europe', 'Spain'],
}

/** @typedef {keyof typeof REGION_PREFERENCES} RegionPreference */

/** Nombre visible de cada preferencia */
export const REGION_NAMES = { usa: 'EE. UU.', europe: 'Europa', japan: 'Japón' }

/** Versiones que no queremos como portada si hay otra opción */
const UNWANTED = /\b(Beta|Proto|Prototype|Demo|Sample|Taikenban|Kiosk|Trial|Preview|Promo|Debug|Pirate|Unl)\b|\bDisc [2-9]\b/i

const ROMAN = /** @type {Record<string, string>} */ ({
  ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10',
  xi: '11', xii: '12', xiii: '13', xiv: '14', xv: '15',
})
const STOP_WORDS = new Set(['the', 'a', 'an', 'and'])
const TAG = /\s*[([][^)\]]*[)\]]/g

/** Caracteres que libretro reemplaza por "_" en los nombres de archivo */
export function libretroSafeName(/** @type {string} */ name) {
  return name.replace(/[&*/:`<>?\\|"]/g, '_')
}

/** "Okami (USA) (En,Ja)" -> ["USA", "En,Ja"] */
export function tagsOf(/** @type {string} */ name) {
  return [...name.matchAll(/\(([^)]*)\)/g)].map((m) => m[1])
}

/** "Okami (USA) [!]" -> "Okami" */
export function baseTitle(/** @type {string} */ name) {
  return name.replace(TAG, '').trim()
}

/**
 * Clave de comparación de títulos.
 * "Legend of Zelda, The - The Wind Waker (USA)" -> "legend of zelda wind waker"
 * "kingdom_hearts_2"                             -> "kingdom hearts 2"
 */
export function titleKey(/** @type {string} */ name) {
  const text = baseTitle(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/_/g, ' ')
    .replace(/&/g, ' and ')
  const tokens = (text.match(/[a-z0-9]+/g) ?? []).map((t) => ROMAN[t] ?? t)
  const kept = tokens.filter((t) => !STOP_WORDS.has(t))
  return (kept.length > 0 ? kept : tokens).join(' ')
}

/** Regiones que dice un nombre: "Gran Turismo 4 (USA, Canada) (v1.01)" -> ["USA", "Canada"] */
export function regionsOf(/** @type {string} */ name) {
  return tagsOf(name)
    .flatMap((tag) => tag.split(/,\s*/))
    .filter((word) => REGION_WORDS.has(word))
}

/**
 * Qué tan buena es una versión como portada (menor = mejor):
 * primero las que no son demo/beta, luego la región, luego la más simple.
 * @param {string} name @param {string[]} order regiones en orden de preferencia
 */
function rank(name, order) {
  const regions = regionsOf(name)
  const regionIndex = Math.min(...regions.map((r) => order.indexOf(r)).filter((i) => i >= 0), 99)
  return [UNWANTED.test(name) ? 1 : 0, regionIndex, tagsOf(name).length, name.length]
}

/** @param {string[]} names @param {string[]} order */
function best(names, order) {
  return names
    .map((name) => ({ name, r: rank(name, order) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || a.r[2] - b.r[2] || a.r[3] - b.r[3] || (a.name < b.name ? -1 : 1))[0]
    .name
}

/**
 * @typedef {Object} CoverIndex
 * @property {string[]} names
 * @property {Map<string, string>} exact            nombre en minúsculas -> nombre
 * @property {Map<string, string[]>} byTitle        titleKey -> versiones
 * @property {Array<{ key: string, tokens: Set<string> }>} titles  para buscar candidatas
 */

/**
 * Prepara la lista de portadas de una consola para buscar rápido.
 * @param {string[]} names  nombres sin ".png", tal como están en libretro
 * @returns {CoverIndex}
 */
export function buildCoverIndex(names) {
  /** @type {Map<string, string[]>} */
  const byTitle = new Map()
  for (const name of names) {
    const key = titleKey(name)
    const list = byTitle.get(key)
    if (list) list.push(name)
    else byTitle.set(key, [name])
  }
  return {
    names,
    exact: new Map(names.map((n) => [n.toLowerCase(), n])),
    byTitle,
    titles: [...byTitle.keys()].map((key) => ({ key, tokens: new Set(key.split(' ')) })),
  }
}

/** @param {string} query @param {RegionPreference} preference */
function regionOrder(query, preference) {
  return [...new Set([...regionsOf(query), ...(REGION_PREFERENCES[preference] ?? REGION_PREFERENCES.usa)])]
}

/**
 * Busca la portada segura de un juego.
 * @param {string} query  nombre del archivo sin extensión (o carpeta, en Wii U)
 * @param {CoverIndex} index
 * @param {{ region?: RegionPreference, altTitle?: string }} [options]
 *   altTitle: el nombre que trae ES-DE, por si el archivo tiene un nombre raro
 * @returns {{ name: string, how: 'exact'|'title' } | null}
 */
export function matchCover(query, index, { region = 'usa', altTitle } = {}) {
  const exact = index.exact.get(libretroSafeName(query).toLowerCase())
  if (exact) return { name: exact, how: 'exact' }

  const versions =
    index.byTitle.get(titleKey(query)) ?? (altTitle ? index.byTitle.get(titleKey(altTitle)) : undefined)
  if (!versions) return null
  return { name: best(versions, regionOrder(query, region)), how: 'title' }
}

/**
 * @typedef {{ name: string, title: string, region: string }} CoverCandidate
 */

/**
 * Portadas parecidas para elegir a mano: la mejor versión de cada título,
 * ordenadas por cuántas palabras comparten con el nombre del juego.
 * @param {string} query
 * @param {CoverIndex} index
 * @param {{ region?: RegionPreference, altTitle?: string, limit?: number }} [options]
 * @returns {CoverCandidate[]}
 */
export function coverCandidates(query, index, { region = 'usa', altTitle, limit = 6 } = {}) {
  const queries = [titleKey(query), altTitle ? titleKey(altTitle) : ''].filter(Boolean)
  /** @type {Map<string, number>} */
  const scores = new Map()
  for (const q of queries) {
    const wanted = [...new Set(q.split(' '))]
    for (const { key, tokens } of index.titles) {
      let hits = 0
      let wordHit = false // que coincida algo más que un número ("Persona 4" no es "Gran Turismo 4")
      for (const t of wanted) {
        const hit = tokenHit(t, tokens)
        hits += hit
        if (hit > 0 && !/^\d+$/.test(t)) wordHit = true
      }
      const score = hits / wanted.length
      if (wordHit && score >= 0.5 && score > (scores.get(key) ?? 0)) scores.set(key, score)
    }
  }
  const order = regionOrder(query, region)
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].split(' ').length - b[0].split(' ').length || (a[0] < b[0] ? -1 : 1))
    .slice(0, limit)
    .map(([key]) => {
      const name = best(index.byTitle.get(key) ?? [], order)
      return { name, title: baseTitle(name), region: regionLabel(name) }
    })
}

/**
 * Cuánto cuenta una palabra del juego en un título: 1 si está tal cual,
 * 0.8 si difiere en una letra ("Okami" / "Ookami"), 0 si no está.
 * @param {string} word @param {Set<string>} tokens
 */
function tokenHit(word, tokens) {
  if (tokens.has(word)) return 1
  if (word.length < 4 || /\d/.test(word)) return 0
  for (const t of tokens) {
    if (t.length >= 4 && Math.abs(t.length - word.length) <= 1 && oneEditApart(word, t)) return 0.8
  }
  return 0
}

/** true si a y b difieren en una sola letra (cambiada, agregada o quitada) */
function oneEditApart(/** @type {string} */ a, /** @type {string} */ b) {
  if (a.length > b.length) [a, b] = [b, a]
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1)
  return a.slice(i) === b.slice(i + 1)
}

const REGION_LABELS = /** @type {Record<string, string>} */ ({
  USA: 'EE. UU.', Canada: 'Canadá', Europe: 'Europa', Japan: 'Japón', World: 'Mundial',
  Spain: 'España', France: 'Francia', Germany: 'Alemania', Italy: 'Italia', UK: 'Reino Unido',
  Asia: 'Asia', Korea: 'Corea', China: 'China', Australia: 'Australia', Brazil: 'Brasil',
})

/** "Okami (Europe, Australia) (En,Fr)" -> "Europa" */
export function regionLabel(/** @type {string} */ name) {
  const region = regionsOf(name)[0]
  return region ? (REGION_LABELS[region] ?? region) : ''
}

/**
 * Qué nombre se busca para un juego: el archivo sin extensión o, en Wii U
 * por carpetas (Juego/code/juego.rpx), el nombre de la carpeta.
 * @param {{ path: string }} game
 */
export function coverQuery(game) {
  return titleStem(game.path)
}

/**
 * Dónde se guarda la portada, relativa a downloaded_media/<consola>/covers,
 * sin extensión. Es la misma regla de ES-DE: la ruta del juego sin extensión.
 * "Final Fantasy VII (USA)/Final Fantasy VII (USA).m3u" -> "Final Fantasy VII (USA)/Final Fantasy VII (USA)"
 * @param {{ path: string }} game
 */
export function coverKey(game) {
  const parts = game.path.split('/')
  parts[parts.length - 1] = fileStem(game.path)
  return parts.join('/')
}

/**
 * URL de una portada en el servidor de libretro (para ver las candidatas).
 * @param {string} libretroSystem  p. ej. "Sony - PlayStation 2"
 * @param {string} name            nombre sin ".png"
 * @param {string} [folder]        Named_Boxarts (portada), Named_Snaps (captura) o Named_Titles
 */
export function remoteCoverUrl(libretroSystem, name, folder = 'Named_Boxarts') {
  return `${THUMBNAILS_SERVER}/${encodeURIComponent(libretroSystem)}/${folder}/${encodeURIComponent(name)}.png`
}
