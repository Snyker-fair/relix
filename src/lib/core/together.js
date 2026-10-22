/**
 * Playing together: with two or more controllers connected, the home screen shows
 * games for several players and "Surprise me" picks among them. A game counts
 * if its data (from ES-DE or Wikipedia, Y › Find info…) says 2 or more players;
 * the ones without that data don't.
 */
import { maxPlayers } from './filters.js'

/** From how many connected controllers Relix suggests playing together */
export const TOGETHER_CONTROLLERS = 2

/** @param {{ players?: string }} game */
export function isMultiplayer(game) {
  return maxPlayers(game.players) >= 2
}

/**
 * Games to play together, the likeliest first: the ones played most recently,
 * then the favorites, then the most played and then by name.
 * @template {{ id: string, name: string, players?: string }} G
 * @param {G[]} games
 * @param {{
 *   lastPlayed: Record<string, number>,
 *   playtime: Record<string, { seconds: number }>,
 *   isFavorite: (game: G) => boolean,
 *   limit?: number,
 * }} options
 * @returns {G[]}
 */
export function togetherGames(games, { lastPlayed, playtime, isFavorite, limit = 3 }) {
  return games
    .filter(isMultiplayer)
    .sort(
      (a, b) =>
        (lastPlayed[b.id] ?? 0) - (lastPlayed[a.id] ?? 0) ||
        Number(isFavorite(b)) - Number(isFavorite(a)) ||
        (playtime[b.id]?.seconds ?? 0) - (playtime[a.id]?.seconds ?? 0) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit)
}
