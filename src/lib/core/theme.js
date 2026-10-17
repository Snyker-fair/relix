/**
 * Tema de Relix: Claro, Oscuro ("Noche azul") o Automático, que es oscuro de
 * noche. Los colores de cada tema están en app.css; aquí solo se decide cuál toca.
 */

/** @typedef {'light'|'dark'|'auto'} ThemeChoice */

/** @type {ThemeChoice[]} */
export const THEMES = ['light', 'dark', 'auto']

export const THEME_NAMES = { light: 'Claro', dark: 'Oscuro', auto: 'Automático' }

/** En Automático es de noche desde las 20:00 hasta las 7:00 */
export const NIGHT = { from: 20, to: 7 }

/**
 * Color de fondo del shell mientras carga la interfaz (AARRGGBB), para que al
 * abrir de noche no haya un destello celeste.
 */
export const SHELL_BACKGROUND = { light: 'FFDDEBF7', dark: 'FF0F1524' }

/** @param {Date} date */
export function isNight(date) {
  const hour = date.getHours()
  return hour >= NIGHT.from || hour < NIGHT.to
}

/**
 * El tema que se ve ahora.
 * @param {string} choice  lo que eligió el jugador
 * @param {Date} [date]
 * @returns {'light'|'dark'}
 */
export function effectiveTheme(choice, date = new Date()) {
  if (choice === 'dark') return 'dark'
  if (choice === 'auto') return isNight(date) ? 'dark' : 'light'
  return 'light'
}
