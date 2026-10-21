/**
 * "Surprise me": a random game, like browsing the rental store's shelf without
 * knowing what to take home. It prefers the ones you haven't played: almost
 * always one you never opened or barely played, sometimes any of them.
 */

/** How likely each game is, compared with one you've played a lot */
export const WEIGHTS = { never: 6, barely: 2, played: 1 }
/** Less than this is barely played */
const BARELY_SECONDS = 60 * 60

/**
 * @param {{ seconds: number } | undefined} stats  its time played
 * @param {number | undefined} lastPlayed
 */
export function surpriseWeight(stats, lastPlayed) {
  if (!stats && !lastPlayed) return WEIGHTS.never
  return (stats?.seconds ?? 0) < BARELY_SECONDS ? WEIGHTS.barely : WEIGHTS.played
}

/**
 * Picks a game. The ones already shown in this round are left out; once all of
 * them were shown, it starts over.
 * @template {{ id: string }} G
 * @param {G[]} games
 * @param {{
 *   playtime: Record<string, { seconds: number }>,
 *   lastPlayed: Record<string, number>,
 *   shown?: string[],
 *   random?: () => number,
 * }} options
 * @returns {G | null}
 */
export function pickSurprise(games, { playtime, lastPlayed, shown = [], random = Math.random }) {
  const skip = new Set(shown)
  const left = games.filter((g) => !skip.has(g.id))
  const pool = left.length > 0 ? left : games
  if (pool.length === 0) return null
  const weights = pool.map((g) => surpriseWeight(playtime[g.id], lastPlayed[g.id]))
  let r = random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r < 0) return pool[i]
  }
  return pool[pool.length - 1]
}
