/**
 * Idioma de Relix: Automático (el de la Xbox), Español o English.
 *
 * Los textos se escriben en español en el código y pasan por t()
 * (src/lib/i18n/i18n.svelte.js); src/lib/i18n/en.js tiene la traducción de
 * cada uno al inglés. Aquí solo se decide qué idioma toca.
 */

/** @typedef {'auto'|'es'|'en'} LanguageChoice */
/** @typedef {'es'|'en'} Language */

/** @type {LanguageChoice[]} */
export const LANGUAGES = ['auto', 'es', 'en']

/** El nombre de cada idioma en ese mismo idioma, como en cualquier menú de idiomas */
export const LANGUAGE_NAMES = { es: 'Español', en: 'English' }

/** Cómo se escriben fechas y horas en cada idioma */
export const DATE_LOCALES = { es: 'es-CL', en: 'en-US' }

/**
 * El idioma de la consola: español si el primero que prefiere es español, inglés
 * en cualquier otro caso (es el único otro que tiene Relix).
 * @param {readonly string[]} preferred  navigator.languages, del más preferido al menos
 * @returns {Language}
 */
export function systemLanguage(preferred) {
  const first = String(preferred.find(Boolean) ?? '').toLowerCase()
  return first === 'es' || first.startsWith('es-') ? 'es' : 'en'
}

/**
 * El idioma que se ve ahora.
 * @param {string} choice  lo que eligió el jugador
 * @param {readonly string[]} preferred  idiomas de la consola
 * @returns {Language}
 */
export function effectiveLanguage(choice, preferred) {
  if (choice === 'es' || choice === 'en') return choice
  return systemLanguage(preferred)
}

/**
 * Reemplaza {nombre} por su valor: interpolate('{n} juegos', { n: 3 }) -> "3 juegos".
 * Un {nombre} sin valor queda tal cual, así se nota al revisar.
 * @param {string} text
 * @param {Record<string, string | number>} params
 */
export function interpolate(text, params) {
  return text.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key]) : match))
}
