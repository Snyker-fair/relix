/**
 * Relix's language: Automatic (the Xbox's), Español or English.
 *
 * The texts are written in Spanish in the code and go through t()
 * (src/lib/i18n/i18n.svelte.js); src/lib/i18n/en.js has the English
 * translation of each one. Here it's only decided which language applies.
 */

/** @typedef {'auto'|'es'|'en'} LanguageChoice */
/** @typedef {'es'|'en'} Language */

/** @type {LanguageChoice[]} */
export const LANGUAGES = ['auto', 'es', 'en']

/** Each language's name in that same language, as in any language menu */
export const LANGUAGE_NAMES = { es: 'Español', en: 'English' }

/** How dates and times are written in each language */
export const DATE_LOCALES = { es: 'es-CL', en: 'en-US' }

/**
 * The console's language: Spanish if the first one it prefers is Spanish, English
 * in any other case (it's the only other one Relix has).
 * @param {readonly string[]} preferred  navigator.languages, from most to least preferred
 * @returns {Language}
 */
export function systemLanguage(preferred) {
  const first = String(preferred.find(Boolean) ?? '').toLowerCase()
  return first === 'es' || first.startsWith('es-') ? 'es' : 'en'
}

/**
 * The language shown now.
 * @param {string} choice  what the player chose
 * @param {readonly string[]} preferred  the console's languages
 * @returns {Language}
 */
export function effectiveLanguage(choice, preferred) {
  if (choice === 'es' || choice === 'en') return choice
  return systemLanguage(preferred)
}

/**
 * Replaces {name} with its value: interpolate('{n} games', { n: 3 }) -> "3 games".
 * A {name} without a value stays as it is, so it shows when checking.
 * @param {string} text
 * @param {Record<string, string | number>} params
 */
export function interpolate(text, params) {
  return text.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key]) : match))
}
