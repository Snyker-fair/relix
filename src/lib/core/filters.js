/**
 * Library filters (Y › Filter): by genre.
 * They use ES-DE's data (gamelist.xml); games without data don't fall into
 * any filter, and if a console has no data, the menu doesn't offer the option.
 * There's no filter by players: that data is often wrong (many fighting games
 * say 1 player), so it would hide the very games you'd look for.
 */
/** @typedef {{ kind: 'genre', value: string }} GameFilter */
/** @typedef {{ genre?: string }} FilterableGame */

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
 * Which filters make sense in a list: the genres, from most to fewest games.
 * @param {FilterableGame[]} games
 */
export function filterOptions(games) {
  /** @type {Map<string, { name: string, count: number }>} */
  const genres = new Map()
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
  }
  return {
    genres: [...genres.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es')),
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
  const wanted = fold(filter.value)
  return games.filter((g) => genresOf(g.genre).some((name) => fold(name) === wanted))
}

/** How the filter reads on screen @param {GameFilter} filter */
export function filterLabel(filter) {
  return filter.value
}

/** @param {GameFilter | null | undefined} a @param {GameFilter | null | undefined} b */
export function sameFilter(a, b) {
  if (!a || !b) return !a && !b
  return fold(a.value) === fold(b.value)
}
