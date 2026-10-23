/**
 * The screensaver's order: your games, the ones you play and the ones waiting to
 * be picked back up more often than the rest, all of them once before repeating.
 * It's a weighted shuffle: each game gets random^(1/weight) and they go from the
 * highest, so a game with weight 4 tends to come up early without always being first.
 */
import { isComeback } from './comeback.js'

/** Played in the last two months, or waiting to be picked back up: 4; played before: 2; never: 1 */
export const SAVER_WEIGHTS = { recent: 4, comeback: 4, played: 2, never: 1 }
const RECENT_MS = 60 * 24 * 60 * 60 * 1000

/**
 * @param {string} id
 * @param {import('./comeback.js').ComebackData} data
 */
export function saverWeight(id, data) {
  const last = data.lastPlayed[id]
  if (typeof last === 'number' && data.now - last < RECENT_MS) return SAVER_WEIGHTS.recent
  if (isComeback(id, data)) return SAVER_WEIGHTS.comeback
  return last || data.playtime[id] ? SAVER_WEIGHTS.played : SAVER_WEIGHTS.never
}

/**
 * Every game once, the ones that weigh more toward the front.
 * @template {{ id: string }} G
 * @param {G[]} games
 * @param {import('./comeback.js').ComebackData} data
 * @param {() => number} [random]
 * @returns {G[]}
 */
export function saverOrder(games, data, random = Math.random) {
  return games
    .map((game) => ({ game, key: Math.pow(Math.max(random(), 1e-9), 1 / saverWeight(game.id, data)) }))
    .sort((a, b) => b.key - a.key)
    .map(({ game }) => game)
}
