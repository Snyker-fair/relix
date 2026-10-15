/**
 * Textos que se arman con números y fechas.
 */

/**
 * plural(1, 'juego', 'juegos') -> "1 juego"
 * @param {number} n @param {string} one @param {string} many
 */
export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * Cuánto pasó desde una fecha, en palabras: "hace un momento", "hace 5 min",
 * "hace 3 h", "ayer", "hace 4 días".
 * @param {number} timestamp  ms
 * @param {number} [now]      ms
 */
export function timeAgo(timestamp, now = Date.now()) {
  const minutes = Math.floor((now - timestamp) / 60_000)
  if (minutes < 1) return 'hace un momento'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}

/**
 * Resumen de un escaneo para el aviso:
 * "PS2: 3 juegos nuevos y 1 quitado (12 en total)"
 * @param {string} consoleName
 * @param {{ added: number, removed: number, total: number }} change
 */
export function scanSummary(consoleName, { added, removed, total }) {
  const parts = []
  if (added > 0) parts.push(added === 1 ? '1 juego nuevo' : `${added} juegos nuevos`)
  if (removed > 0) parts.push(added > 0 ? plural(removed, 'quitado', 'quitados') : plural(removed, 'juego quitado', 'juegos quitados'))
  if (parts.length === 0) return `${consoleName}: sin cambios (${plural(total, 'juego', 'juegos')})`
  return `${consoleName}: ${parts.join(' y ')} (${total} en total)`
}
