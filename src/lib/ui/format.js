/**
 * Textos que se arman con números y fechas, en el idioma activo.
 */
import { i18n, plural, t, tn } from '../i18n/i18n.svelte.js'

export { plural }

/**
 * Una hora en punto: "20:00" en español, "8 PM" en inglés.
 * @param {number} hour  0 a 23
 */
export function formatHour(hour) {
  if (i18n.current === 'es') return `${hour}:00`
  return `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`
}

/**
 * Una fecha con las opciones de Intl, en el idioma activo ("16 oct 2026", "Oct 16, 2026").
 * Sin el punto de las abreviaturas en español ("oct." -> "oct").
 * @param {Date} date
 * @param {Intl.DateTimeFormatOptions} options
 */
export function formatDate(date, options) {
  const text = date.toLocaleDateString(i18n.dateLocale, options)
  return i18n.current === 'es' ? text.replace(/\./g, '') : text
}

/**
 * Cuánto pasó desde una fecha, en palabras: "hace un momento", "hace 5 min",
 * "hace 3 h", "ayer", "hace 4 días".
 * @param {number} timestamp  ms
 * @param {number} [now]      ms
 */
export function timeAgo(timestamp, now = Date.now()) {
  const minutes = Math.floor((now - timestamp) / 60_000)
  if (minutes < 1) return t('hace un momento')
  if (minutes < 60) return t('hace {n} min', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('hace {n} h', { n: hours })
  const days = Math.floor(hours / 24)
  if (days === 1) return t('ayer')
  return t('hace {n} días', { n: days })
}

/**
 * Resumen de un escaneo para el aviso:
 * "PS2: 3 juegos nuevos y 1 quitado (12 en total)"
 * @param {string} consoleName
 * @param {{ added: number, removed: number, total: number }} change
 */
export function scanSummary(consoleName, { added, removed, total }) {
  const parts = []
  if (added > 0) parts.push(tn(added, '{n} juego nuevo', '{n} juegos nuevos'))
  if (removed > 0)
    parts.push(added > 0 ? tn(removed, '{n} quitado', '{n} quitados') : tn(removed, '{n} juego quitado', '{n} juegos quitados'))
  if (parts.length === 0) return t('{console}: sin cambios ({games})', { console: consoleName, games: plural(total, 'juego', 'juegos') })
  const changes = parts.length === 2 ? t('{a} y {b}', { a: parts[0], b: parts[1] }) : parts[0]
  return t('{console}: {changes} ({total} en total)', { console: consoleName, changes, total })
}

/**
 * Resumen de una búsqueda de portadas para el aviso:
 * "PS2: 7 portadas nuevas · 2 para elegir a mano · 1 sin resultados"
 * @param {string} consoleName
 * @param {{ saved: number, failed: number, toChoose: number, notFound: number, shots?: number }} result
 *   shots: capturas de libretro bajadas para el fondo del panel
 */
export function coverSummary(consoleName, { saved, failed, toChoose, notFound, shots = 0 }) {
  const parts = []
  if (saved > 0) parts.push(tn(saved, '{n} portada nueva', '{n} portadas nuevas'))
  if (shots > 0) parts.push(tn(shots, '{n} captura para el fondo', '{n} capturas para el fondo'))
  if (toChoose > 0) parts.push(t('{n} para elegir a mano', { n: toChoose }))
  if (notFound > 0) parts.push(t('{n} sin resultados', { n: notFound }))
  if (failed > 0) parts.push(tn(failed, '{n} no se pudo bajar', '{n} no se pudieron bajar'))
  if (parts.length === 0) return t('{console}: ya tenías todas las portadas', { console: consoleName })
  return `${consoleName}: ${parts.join(' · ')}`
}

/**
 * Tiempo jugado: "45 min", "3 h 20 min", "3 h", "128 h".
 * Pasadas las 10 horas, los minutos ya no aportan.
 * @param {number} seconds
 */
export function formatPlaytime(seconds) {
  const minutes = Math.floor(seconds / 60)
  if (minutes < 1) return t('menos de 1 min')
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours >= 10 || rest === 0) return `${hours} h`
  return `${hours} h ${rest} min`
}
