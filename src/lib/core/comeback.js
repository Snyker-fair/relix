/**
 * "Back to it?": games you gave hours to and haven't touched in a month. Relix
 * measures that time itself, so nobody else has the same list. One of them takes
 * the last place in Continue playing ("Back to it? · 12 h", a different one each
 * day among the five you played most), and the screensaver shows them more often.
 *
 * Taking it out of Continue playing (Y) leaves it out of here too, until you
 * play it again.
 */

/** Played at least this much… */
export const COMEBACK_MIN_SECONDS = 2 * 60 * 60
/** …and not for this many days */
export const COMEBACK_IDLE_DAYS = 30
/** The day's pick goes around the first ones */
const ROTATION = 5

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * @typedef {Object} ComebackData
 * @property {Record<string, { seconds: number }>} playtime
 * @property {Record<string, number>} lastPlayed  ms
 * @property {number} now
 * @property {string[]} [skip]  taken out of Continue playing
 */

/**
 * Whether a game is waiting to be picked back up.
 * @param {string} id
 * @param {ComebackData} data
 */
export function isComeback(id, { playtime, lastPlayed, now, skip = [] }) {
  const last = lastPlayed[id]
  return (
    (playtime[id]?.seconds ?? 0) >= COMEBACK_MIN_SECONDS &&
    typeof last === 'number' &&
    now - last >= COMEBACK_IDLE_DAYS * DAY_MS &&
    !skip.includes(id)
  )
}

/**
 * The games waiting to be picked back up, the most played first.
 * @template {{ id: string }} G
 * @param {G[]} games
 * @param {ComebackData} data
 * @returns {G[]}
 */
export function comebackGames(games, data) {
  return games
    .filter((g) => isComeback(g.id, data))
    .sort((a, b) => (data.playtime[b.id]?.seconds ?? 0) - (data.playtime[a.id]?.seconds ?? 0))
}

/**
 * The one for today: it changes each day among the five most played.
 * @template T
 * @param {T[]} candidates  comebackGames(...)
 * @param {number} now
 * @returns {T | null}
 */
export function comebackOfTheDay(candidates, now) {
  if (candidates.length === 0) return null
  const d = new Date(now)
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS)
  return candidates[day % Math.min(ROTATION, candidates.length)]
}
