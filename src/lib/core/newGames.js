/**
 * The "New" mark: the games a scan brought to a console that already had its list.
 * It lasts until you play the game or for 14 days, whichever comes first. The
 * first scan of a console doesn't mark anything (everything would be new).
 *
 *   { "ps2/Okami (USA).chd": 1761100000000 }   when it showed up (ms)
 *
 * It's backed up in data.json with the rest of your data; the ones that no longer
 * count are dropped, so it stays small.
 */

/** How long a game is new if you don't play it */
export const NEW_DAYS = 14
const NEW_MS = NEW_DAYS * 24 * 60 * 60 * 1000

/** @typedef {Record<string, number>} NewGames */

/**
 * The games a scan brought, marked as new now (the ones already marked keep their date).
 * @param {NewGames} newGames
 * @param {string[]} ids
 * @param {number} now
 * @returns {NewGames}
 */
export function addNewGames(newGames, ids, now) {
  const next = { ...newGames }
  for (const id of ids) next[id] ??= now
  return next
}

/**
 * @param {NewGames} newGames
 * @param {string} id
 * @param {Record<string, number>} lastPlayed
 * @param {number} now
 */
export function isNewGame(newGames, id, lastPlayed, now) {
  const since = newGames[id]
  if (!since || now - since >= NEW_MS) return false
  return !((lastPlayed[id] ?? 0) >= since)
}

/**
 * Only the ones that still count: real dates, under 14 days, not played since and
 * still in the library. What comes from the USB drive goes through here too.
 * @param {unknown} newGames
 * @param {{ now: number, lastPlayed?: Record<string, number>, exists?: (id: string) => boolean }} options
 * @returns {NewGames}
 */
export function cleanNewGames(newGames, { now, lastPlayed = {}, exists = () => true }) {
  /** @type {NewGames} */
  const clean = {}
  if (!newGames || typeof newGames !== 'object' || Array.isArray(newGames)) return clean
  for (const [id, since] of Object.entries(newGames)) {
    const at = Number(since)
    if (Number.isFinite(at) && at > 0 && exists(id) && isNewGame({ [id]: at }, id, lastPlayed, now)) clean[id] = at
  }
  return clean
}
