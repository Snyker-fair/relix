/**
 * Filtros de la biblioteca (Y › Filtrar): por género o para jugar con alguien.
 * Usan los datos de ES-DE (gamelist.xml); los juegos sin datos no entran en
 * ningún filtro, y si una consola no tiene datos, el menú no ofrece la opción.
 */

/** @typedef {{ kind: 'genre', value: string } | { kind: 'players' }} GameFilter */
/** @typedef {{ genre?: string, players?: string }} FilterableGame */

/** "plataformas" -> "Plataformas" @param {string} s */
const capitalize = (s) => s.charAt(0).toLocaleUpperCase('es') + s.slice(1)

/** Sin tildes ni mayúsculas, para comparar @param {string} s */
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Los géneros de un juego. ES-DE a veces guarda varios o uno con subgénero:
 *   "Acción / Plataformas" -> ["Acción", "Plataformas"]
 *   "Lucha, Arcade"        -> ["Lucha", "Arcade"]
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
 * Hasta cuántos juegan: "1-2" -> 2, "1 - 4" -> 4, "2" -> 2, "" -> 0.
 * @param {string | undefined} players
 */
export function maxPlayers(players) {
  const numbers = (players ?? '').match(/\d+/g)?.map(Number) ?? []
  return numbers.length > 0 ? Math.max(...numbers) : 0
}

/**
 * Qué filtros tienen sentido en una lista: los géneros (de más a menos juegos)
 * y cuántos juegos son para 2 o más.
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
 * Los juegos que pasan el filtro (sin filtro, todos).
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

/** Cómo se lee el filtro en pantalla @param {GameFilter} filter */
export function filterLabel(filter) {
  return filter.kind === 'players' ? '2 o más jugadores' : filter.value
}

/** @param {GameFilter | null | undefined} a @param {GameFilter | null | undefined} b */
export function sameFilter(a, b) {
  if (!a || !b) return !a && !b
  if (a.kind === 'players' || b.kind === 'players') return a.kind === b.kind
  return fold(a.value) === fold(b.value)
}
