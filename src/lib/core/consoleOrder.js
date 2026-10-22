/**
 * The order of the consoles: on the home screen, in the library's tabs and in
 * Options (Options › Consoles, X moves one). Favorites and Collections always go
 * first, Surprise me and Options last; this is only about the consoles.
 *
 * It's saved as the list of ids in the order the player chose, with the settings
 * (so it's on the USB drive too). A console the list doesn't name, like one a later
 * version adds, goes at the end, in Relix's order.
 */

/**
 * The consoles in the chosen order.
 * @template {{ id: string }} P
 * @param {P[]} platforms  in Relix's order
 * @param {string[]} order  the chosen one (empty: Relix's)
 * @returns {P[]}
 */
export function orderConsoles(platforms, order) {
  if (order.length === 0) return platforms
  const rank = new Map(order.map((id, i) => [id, i]))
  const named = platforms.filter((p) => rank.has(p.id)).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
  return [...named, ...platforms.filter((p) => !rank.has(p.id))]
}

/**
 * The list with one console moved a place up (-1) or down (1). At the ends it stays.
 * @param {string[]} ids  every console, in the current order
 * @param {string} id
 * @param {-1 | 1} delta
 */
export function moveConsole(ids, id, delta) {
  const from = ids.indexOf(id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= ids.length) return ids
  const next = [...ids]
  next[from] = next[to]
  next[to] = id
  return next
}

/**
 * What was saved, without anything strange: only known ids, once each.
 * @param {unknown} value
 * @param {string[]} known
 * @returns {string[]}
 */
export function cleanConsoleOrder(value, known) {
  if (!Array.isArray(value)) return []
  const valid = new Set(known)
  return [...new Set(value.filter((id) => typeof id === 'string' && valid.has(id)))]
}

/**
 * Whether the order is Relix's own (then it isn't saved: new consoles keep their place).
 * @param {string[]} ids  every console, in the chosen order
 * @param {string[]} relix  every console, in Relix's order
 */
export function isDefaultOrder(ids, relix) {
  return ids.length === relix.length && ids.every((id, i) => id === relix[i])
}
