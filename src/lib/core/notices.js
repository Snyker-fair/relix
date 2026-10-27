/**
 * The texts of the notices Relix shows on its own: what's left to fix when it
 * opens, and the time played when you come back from a game.
 */
import { plural, t } from '../i18n/i18n.svelte.js'

/**
 * What's left to fix, when Relix opens. As Game it says so by name: it's the step
 * that matters most (Dev Home installs it like that).
 * @param {number} errors  Checkup's (systemStatus.summary)
 * @param {'app'|'game'|string|null|undefined} appType
 * @returns {string | null}
 */
export function systemNotice(errors, appType) {
  if (errors <= 0) return null
  const found = plural(errors, 'cosa por arreglar', 'cosas por arreglar')
  if (appType !== 'game') return t('Relix encontró {found}: ≡ › Revisión', { found })
  return errors === 1
    ? t('Relix está como Game: cámbialo a App en Dev Home para volver al instante (≡ › Revisión)')
    : t('Relix encontró {found}, y está como Game: ≡ › Revisión', { found })
}

/**
 * "Okami: 45 min played · 12 h in total" (without the total the first time).
 * @param {string} name
 * @param {number} seconds  this time
 * @param {number} total  every time, this one included
 * @param {(seconds: number) => string} time  formatPlaytime
 */
export function playtimeNotice(name, seconds, total, time) {
  return total > seconds
    ? t('{game}: {time} jugados · {total} en total', { game: name, time: time(seconds), total: time(total) })
    : t('{game}: {time} jugados', { game: name, time: time(seconds) })
}
