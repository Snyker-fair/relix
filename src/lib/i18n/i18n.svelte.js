/**
 * Translations. The texts are written in Spanish and go through t():
 *
 *   t('Seguir jugando')                      -> "Continue playing" in English
 *   t('Juego {n} de {total}', { n, total })  -> "Game 3 of 9"
 *   tn(n, '{n} juego nuevo', '{n} juegos nuevos')
 *
 * The Spanish is the text itself; en.js has each text in English. If a
 * translation is missing, the Spanish shows (and it's noted in i18n.missing,
 * which the tests and the screen audit check).
 *
 * t() reads the active language, so a text in a component's HTML or in
 * a $derived changes by itself when another language is chosen.
 */
import { DATE_LOCALES, effectiveLanguage, interpolate } from '../core/language.js'
import EN from './en.js'

/** The languages the console prefers (WebView2 uses Windows's) */
function preferredLanguages() {
  try {
    return [...(navigator.languages ?? []), navigator.language].filter(Boolean)
  } catch {
    return []
  }
}

class I18n {
  /** What the player chose: 'auto', 'es' or 'en' (settings saves it) */
  /** @type {import('../core/language.js').LanguageChoice} */
  choice = $state('auto')
  /** The console's languages, for Automatic */
  system = preferredLanguages()
  /** 'es' or 'en': the one shown now */
  current = $derived(effectiveLanguage(this.choice, this.system))
  /** For dates and times: 'es-CL' or 'en-US' */
  dateLocale = $derived(DATE_LOCALES[this.current])
  /** Untranslated texts that showed up on screen (for the tests and the audit) */
  missing = new Set()
}

export const i18n = new I18n()

try {
  // The screen audit (Playwright) reads what was left untranslated
  /** @type {any} */ (globalThis).__relixMissing = i18n.missing
} catch {
  // without globalThis there's no audit
}

/** @type {Record<string, string>} */
const catalog = EN

/**
 * The text in the active language.
 * @param {string} text  in Spanish, as it is in the code
 * @param {Record<string, string | number>} [params]  values for {name}
 */
export function t(text, params) {
  let out = text
  if (i18n.current === 'en') {
    const english = catalog[text]
    if (english === undefined) i18n.missing.add(text)
    else out = english
  }
  return params ? interpolate(out, params) : out
}

/**
 * Singular or plural depending on n, with {n} already replaced.
 * @param {number} n
 * @param {string} one   "{n} juego nuevo"
 * @param {string} many  "{n} juegos nuevos"
 * @param {Record<string, string | number>} [params]
 */
export function tn(n, one, many, params) {
  return t(n === 1 ? one : many, { n, ...params })
}

/**
 * plural(1, 'juego', 'juegos') -> "1 juego" ("1 game" in English: each word
 * goes through t()).
 * @param {number} n @param {string} one @param {string} many
 */
export function plural(n, one, many) {
  return `${n} ${t(n === 1 ? one : many)}`
}

/**
 * A list in words: "a y b", "a, b y c" in Spanish ("a, b, and c" in English).
 * With 'disjunction': "a, b o c" ("a, b, or c").
 * @param {string[]} items
 * @param {'conjunction'|'disjunction'} [type]
 */
export function listJoin(items, type = 'conjunction') {
  return new Intl.ListFormat(i18n.dateLocale, { type }).format(items)
}
