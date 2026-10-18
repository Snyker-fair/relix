/**
 * Library order and jumps with LT / RT.
 *
 *   az      A–Z (the normal one). Jumps go letter by letter.
 *   recent  recently played first; the never played at the end, A–Z.
 *           Jumps move a page at a time.
 *   played  most time played first; the never played at the end, A–Z.
 *           Jumps move a page at a time.
 *   year    by release year (ES-DE data); the ones without a year at the end.
 *           Jumps go year by year.
 */

import { t } from '../i18n/i18n.svelte.js'
import { bySortName } from './esde.js'

/** @typedef {'az'|'recent'|'played'|'year'} SortOrder */

/** The visible name of each order */
export const SORT_NAMES = /** @type {Record<SortOrder, string>} */ ({
  az: 'A–Z',
  recent: 'Recientes',
  played: 'Más jugados',
  year: 'Año',
})

/**
 * A name's letter for the index: without accents; digits and symbols go under "#".
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
 * @param {Record<string, number>} [lastPlayed]  id -> the date it was last played (ms)
 * @param {Record<string, { seconds: number }>} [playtime]  id -> time played
 * @returns {T[]}
 */
export function sortGames(games, order, lastPlayed = {}, playtime = {}) {
  const az = [...games].sort(bySortName)
  // sort is stable: within the same year or unplayed, the A–Z order stays
  if (order === 'recent') return az.sort((a, b) => (lastPlayed[b.id] ?? 0) - (lastPlayed[a.id] ?? 0))
  if (order === 'played') return az.sort((a, b) => (playtime[b.id]?.seconds ?? 0) - (playtime[a.id]?.seconds ?? 0))
  if (order === 'year') return az.sort((a, b) => (a.year ?? 99999) - (b.year ?? 99999))
  return az
}

/**
 * Which section a game belongs to in an order (what's shown when jumping).
 * null = that order has no sections.
 * @param {import('./esde.js').Game} game
 * @param {SortOrder} order
 */
export function sectionOf(game, order) {
  if (order === 'az') return letterOf(game.sortName)
  if (order === 'year') return game.year ? String(game.year) : t('Sin año')
  return null
}

/**
 * Where LT (-1) or RT (+1) takes you from a game.
 *   RT: to the first game of the next section.
 *   LT: to the first one of the current section or, if it's already there, of the previous one.
 * Without sections, it moves a page forward or back.
 * @param {import('./esde.js').Game[]} games  already sorted
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
    return at // it's already in the last section
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
