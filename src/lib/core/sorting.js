/**
 * Orden de la biblioteca y saltos con LT / RT.
 *
 *   az      A–Z (el normal). Los saltos van de letra en letra.
 *   recent  jugados recientemente primero; los nunca jugados al final, en A–Z.
 *           Los saltos avanzan de a una página.
 *   year    por año de lanzamiento (dato de ES-DE); los sin año al final.
 *           Los saltos van de año en año.
 */

import { bySortName } from './esde.js'

/** @typedef {'az'|'recent'|'year'} SortOrder */

/** Nombre visible de cada orden */
export const SORT_NAMES = /** @type {Record<SortOrder, string>} */ ({
  az: 'A–Z',
  recent: 'Recientes',
  year: 'Año',
})

/**
 * Letra de un nombre para el índice: sin tildes; números y símbolos van en "#".
 * @param {string} name
 */
export function letterOf(name) {
  const first = name.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase()
  return /[A-Z]/.test(first) ? first : '#'
}

/**
 * @template {import('./esde.js').Game} T
 * @param {T[]} games
 * @param {SortOrder} order
 * @param {Record<string, number>} [lastPlayed]  id -> fecha en que se jugó por última vez (ms)
 * @returns {T[]}
 */
export function sortGames(games, order, lastPlayed = {}) {
  const az = [...games].sort(bySortName)
  // sort es estable: dentro de un mismo año o sin jugar, queda el orden A–Z
  if (order === 'recent') return az.sort((a, b) => (lastPlayed[b.id] ?? 0) - (lastPlayed[a.id] ?? 0))
  if (order === 'year') return az.sort((a, b) => (a.year ?? 99999) - (b.year ?? 99999))
  return az
}

/**
 * A qué sección pertenece un juego en un orden (lo que se muestra al saltar).
 * null = ese orden no tiene secciones.
 * @param {import('./esde.js').Game} game
 * @param {SortOrder} order
 */
export function sectionOf(game, order) {
  if (order === 'az') return letterOf(game.sortName)
  if (order === 'year') return game.year ? String(game.year) : 'Sin año'
  return null
}

/**
 * A dónde lleva LT (-1) o RT (+1) desde un juego.
 *   RT: al primer juego de la sección siguiente.
 *   LT: al primero de la sección actual o, si ya está ahí, al de la anterior.
 * Sin secciones, avanza o retrocede una página.
 * @param {import('./esde.js').Game[]} games  ya ordenados
 * @param {number} index
 * @param {1|-1} direction
 * @param {SortOrder} order
 * @param {number} [pageSize]
 */
export function jumpIndex(games, index, direction, order, pageSize = 15) {
  if (games.length === 0) return 0
  const at = Math.min(Math.max(index, 0), games.length - 1)
  const current = sectionOf(games[at], order)

  if (current === null) {
    return Math.min(Math.max(at + direction * pageSize, 0), games.length - 1)
  }

  if (direction === 1) {
    for (let i = at + 1; i < games.length; i++) {
      if (sectionOf(games[i], order) !== current) return i
    }
    return at // ya está en la última sección
  }

  let start = at
  while (start > 0 && sectionOf(games[start - 1], order) === current) start--
  if (start < at) return start
  if (start === 0) return 0
  const previous = sectionOf(games[start - 1], order)
  let i = start - 1
  while (i > 0 && sectionOf(games[i - 1], order) === previous) i--
  return i
}
