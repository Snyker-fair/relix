/**
 * Relix's theme: Light, Dark ("Night blue") or Automatic, which is dark at
 * night. Each theme's colors are in app.css; here it's only decided which one applies.
 */

/** @typedef {'light'|'dark'|'auto'} ThemeChoice */

/** @type {ThemeChoice[]} */
export const THEMES = ['light', 'dark', 'auto']

export const THEME_NAMES = { light: 'Claro', dark: 'Oscuro', auto: 'Automático' }

/** In Automatic, night is from 20:00 to 7:00 */
export const NIGHT = { from: 20, to: 7 }

/**
 * The shell's background color while the interface loads (AARRGGBB), so that
 * opening at night has no light blue flash.
 */
export const SHELL_BACKGROUND = { light: 'FFDDEBF7', dark: 'FF0F1524' }

/** @param {Date} date */
export function isNight(date) {
  const hour = date.getHours()
  return hour >= NIGHT.from || hour < NIGHT.to
}

/**
 * The theme shown now.
 * @param {string} choice  what the player chose
 * @param {Date} [date]
 * @returns {'light'|'dark'}
 */
export function effectiveTheme(choice, date = new Date()) {
  if (choice === 'dark') return 'dark'
  if (choice === 'auto') return isNight(date) ? 'dark' : 'light'
  return 'light'
}
