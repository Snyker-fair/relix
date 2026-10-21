/**
 * The time played day by day, for the charts (the game sheet and Options › About).
 * Until 1.3.0 Relix only kept each game's total (playtime), with no dates, so
 * these days start filling from then on. It's backed up on the USB drive with the
 * rest of your data, and only the last 26 weeks are kept.
 *
 *   { "2026-10-21": { "ps2/Okami (USA).chd": 1500 } }   seconds per game and day
 */

/** @typedef {Record<string, Record<string, number>>} PlayDays */

/** How many days are kept */
export const KEEP_DAYS = 26 * 7

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/
const pad = (/** @type {number} */ n) => String(n).padStart(2, '0')

/** "2026-10-21", the local day @param {Date | number} date */
export function dayKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The local midnight that starts that day @param {Date | number} date */
function startOfDay(date) {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** The local Monday that starts that week @param {Date | number} date */
export function startOfWeek(date) {
  const day = new Date(startOfDay(date))
  const sinceMonday = (day.getDay() + 6) % 7
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - sinceMonday).getTime()
}

/**
 * Adds a session that counted, split by day if it went past midnight, and drops
 * the days older than KEEP_DAYS.
 * @param {PlayDays} days
 * @param {string} id
 * @param {number} startedAt  ms
 * @param {number} endedAt    ms
 * @returns {PlayDays}
 */
export function addSession(days, id, startedAt, endedAt) {
  /** @type {PlayDays} */
  const next = { ...days }
  let from = startedAt
  while (from < endedAt) {
    const d = new Date(from)
    const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
    const to = Math.min(midnight, endedAt)
    const key = dayKey(from)
    const seconds = Math.round((to - from) / 1000)
    if (seconds > 0) next[key] = { ...next[key], [id]: (next[key]?.[id] ?? 0) + seconds }
    from = to
  }
  const oldest = dayKey(startOfDay(endedAt) - (KEEP_DAYS - 1) * DAY_MS)
  for (const key of Object.keys(next)) if (key < oldest) delete next[key]
  return next
}

/**
 * The seconds of each of the last weeks (Monday to Sunday), the oldest first; the
 * last one is this week.
 * @param {PlayDays} days
 * @param {{ now: number, weeks?: number, id?: string, keep?: (id: string) => boolean }} options
 *   id: only that game; keep: only the games still in the library
 * @returns {Array<{ start: number, seconds: number }>}  start: that Monday (ms)
 */
export function weeklyTotals(days, { now, weeks = 8, id, keep = () => true }) {
  const thisWeek = startOfWeek(now)
  const result = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(thisWeek)
    return { start: new Date(d.getFullYear(), d.getMonth(), d.getDate() - (weeks - 1 - i) * 7).getTime(), seconds: 0 }
  })
  for (const [key, games] of Object.entries(days)) {
    const [y, m, dd] = key.split('-').map(Number)
    const week = startOfWeek(new Date(y, m - 1, dd))
    const slot = result.find((w) => w.start === week)
    if (!slot) continue
    for (const [game, seconds] of Object.entries(games)) {
      if ((id === undefined || game === id) && keep(game)) slot.seconds += seconds
    }
  }
  return result
}

/**
 * What came from the USB drive, as it should be: real days, positive seconds.
 * @param {unknown} value
 * @returns {PlayDays}
 */
export function cleanPlayDays(value) {
  /** @type {PlayDays} */
  const clean = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return clean
  for (const [key, games] of Object.entries(value)) {
    if (!DAY_KEY.test(key) || !games || typeof games !== 'object' || Array.isArray(games)) continue
    /** @type {Record<string, number>} */
    const day = {}
    for (const [id, seconds] of Object.entries(games)) {
      const s = Math.round(Number(seconds))
      if (s > 0) day[id] = s
    }
    if (Object.keys(day).length > 0) clean[key] = day
  }
  return clean
}

/**
 * The same days with a game under its new id (renamed). null if it wasn't there.
 * @param {PlayDays} days
 * @param {string} oldId
 * @param {string} newId
 * @returns {PlayDays | null}
 */
export function renameInPlayDays(days, oldId, newId) {
  let touched = false
  const next = Object.fromEntries(
    Object.entries(days).map(([key, games]) => {
      if (!(oldId in games)) return [key, games]
      touched = true
      const { [oldId]: seconds, ...rest } = games
      return [key, { ...rest, [newId]: (rest[newId] ?? 0) + seconds }]
    }),
  )
  return touched ? next : null
}
