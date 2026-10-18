/**
 * Library filters (Y › Filter): by genre or to play with someone.
 * They use ES-DE's data (gamelist.xml); games without data don't fall into
 * any filter, and if a console has no data, the menu doesn't offer the option.
 */
import { t } from '../i18n/i18n.svelte.js'

/** @typedef {{ kind: 'genre', value: string } | { kind: 'players' }} GameFilter */
/** @typedef {{ genre?: string, players?: string }} FilterableGame */

/** "platform" -> "Platform" @param {string} s */
const capitalize = (s) => s.charAt(0).toLocaleUpperCase('es') + s.slice(1)

/** Without accents or uppercase, to compare @param {string} s */
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * A game's genres. ES-DE sometimes keeps several, or one with a subgenre:
 *   "Action / Platform"   -> ["Action", "Platform"]
 *   "Fighting, Arcade"    -> ["Fighting", "Arcade"]
 * @param {string | undefined} genre
 */
export function genresOf(genre) {
  return (genre ?? '')
    .split(/\s*[/,;|]\s*|\s+-\s+/)
    .map((g) => g.trim())
    .filter(Boolean)
    .map(capitalize)
}

/**
 * Up to how many play: "1-2" -> 2, "1 - 4" -> 4, "2" -> 2, "" -> 0.
 * @param {string | undefined} players
 */
export function maxPlayers(players) {
  const numbers = (players ?? '').match(/\d+/g)?.map(Number) ?? []
  return numbers.length > 0 ? Math.max(...numbers) : 0
}

/**
 * Which filters make sense in a list: the genres (from most to fewest games)
 * and how many games are for 2 or more.
 * @param {FilterableGame[]} games
 */
export function filterOptions(games) {
  /** @type {Map<string, { name: string, count: number }>} */
  const genres = new Map()
  let multiplayer = 0
  for (const game of games) {
    const seen = new Set()
    for (const name of genresOf(game.genre)) {
      const key = fold(name)
      if (seen.has(key)) continue
      seen.add(key)
      const entry = genres.get(key)
      if (entry) entry.count++
      else genres.set(key, { name, count: 1 })
    }
    if (maxPlayers(game.players) >= 2) multiplayer++
  }
  return {
    genres: [...genres.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es')),
    multiplayer,
  }
}

/**
 * The games that pass the filter (without a filter, all of them).
 * @template {FilterableGame} T
 * @param {T[]} games
 * @param {GameFilter | null | undefined} filter
 * @returns {T[]}
 */
export function applyFilter(games, filter) {
  if (!filter) return games
  if (filter.kind === 'players') return games.filter((g) => maxPlayers(g.players) >= 2)
  const wanted = fold(filter.value)
  return games.filter((g) => genresOf(g.genre).some((name) => fold(name) === wanted))
}

/** How the filter reads on screen @param {GameFilter} filter */
export function filterLabel(filter) {
  return filter.kind === 'players' ? t('2 o más jugadores') : filter.value
}

/** @param {GameFilter | null | undefined} a @param {GameFilter | null | undefined} b */
export function sameFilter(a, b) {
  if (!a || !b) return !a && !b
  if (a.kind === 'players' || b.kind === 'players') return a.kind === b.kind
  return fold(a.value) === fold(b.value)
}
