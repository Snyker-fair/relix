/**
 * Where you were when a game opened. The session in progress keeps it, and it's on
 * the USB drive before the Xbox switches to the emulator, so if the Xbox closes Relix
 * while you play (it does that to apps of the Game type), Relix opens there again:
 * the same library with that game focused, or the home screen on the same channel.
 *
 * @typedef {{ view: 'home' | 'library', channel: string | null }} Place
 *   channel: the open library ("ps2", "favorites", "collection:With friends") or the
 *   channel focused on the home screen
 * @typedef {{ view: 'library', channel: string, gameId: string } | { view: 'home', channel: string | null }} Return
 */

/**
 * The place a game is opened from.
 * @param {{ name: string, systemId?: string }} screen  the screen it was opened on
 * @param {string | null} focusedId  the channel focused on the home screen
 * @returns {Place}
 */
export function placeFor(screen, focusedId) {
  return screen.name === 'library' && screen.systemId
    ? { view: 'library', channel: screen.systemId }
    : { view: 'home', channel: focusedId ?? null }
}

/**
 * Where to open when you come back from a game and Relix had been closed.
 * The place comes from your data on the USB drive, so it's checked as it is.
 * @param {unknown} place
 * @param {{ id: string, system: string } | undefined} game  the game you played (undefined: it's not in the library anymore)
 * @param {(channel: string) => boolean} showsGame  whether a channel shows that game now
 * @returns {Return | null}  null: the home screen as always
 */
export function returnTo(place, game, showsGame) {
  if (!game || !place || typeof place !== 'object') return null
  const { view, channel } = /** @type {Record<string, unknown>} */ (place)
  if (view === 'home') return { view: 'home', channel: typeof channel === 'string' ? channel : null }
  if (view !== 'library') return null
  // The same library or, if it no longer shows the game (a collection it left, a
  // favorite no longer, a filter), its console's
  for (const candidate of [channel, game.system]) {
    if (typeof candidate === 'string' && showsGame(candidate)) return { view: 'library', channel: candidate, gameId: game.id }
  }
  return { view: 'home', channel: game.system }
}
