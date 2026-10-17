/**
 * Traducciones. Los textos se escriben en español y se pasan por t():
 *
 *   t('Seguir jugando')                      -> "Continue playing" en inglés
 *   t('Juego {n} de {total}', { n, total })  -> "Game 3 of 9"
 *   tn(n, '{n} juego nuevo', '{n} juegos nuevos')
 *
 * El español es el texto mismo; en.js tiene cada texto en inglés. Si falta una
 * traducción se ve el español (y queda anotada en i18n.missing, que revisan los
 * tests y la auditoría de pantallas).
 *
 * t() lee el idioma activo, así que un texto en el HTML de un componente o en
 * un $derived cambia solo al elegir otro idioma.
 */
import { DATE_LOCALES, effectiveLanguage, interpolate } from '../core/language.js'
import EN from './en.js'

/** Los idiomas que prefiere la consola (WebView2 usa los de Windows) */
function preferredLanguages() {
  try {
    return [...(navigator.languages ?? []), navigator.language].filter(Boolean)
  } catch {
    return []
  }
}

class I18n {
  /** Lo que eligió el jugador: 'auto', 'es' o 'en' (lo guarda settings) */
  /** @type {import('../core/language.js').LanguageChoice} */
  choice = $state('auto')
  /** Idiomas de la consola, para Automático */
  system = preferredLanguages()
  /** 'es' o 'en': el que se ve ahora */
  current = $derived(effectiveLanguage(this.choice, this.system))
  /** Para fechas y horas: 'es-CL' o 'en-US' */
  dateLocale = $derived(DATE_LOCALES[this.current])
  /** Textos sin traducción que aparecieron en pantalla (para los tests y la auditoría) */
  missing = new Set()
}

export const i18n = new I18n()

try {
  // La auditoría de pantallas (Playwright) lee lo que faltó traducir
  /** @type {any} */ (globalThis).__relixMissing = i18n.missing
} catch {
  // sin globalThis no hay auditoría
}

/** @type {Record<string, string>} */
const catalog = EN

/**
 * El texto en el idioma activo.
 * @param {string} text  en español, tal como está en el código
 * @param {Record<string, string | number>} [params]  valores para {nombre}
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
 * Singular o plural según n, con {n} ya reemplazado.
 * @param {number} n
 * @param {string} one   "{n} juego nuevo"
 * @param {string} many  "{n} juegos nuevos"
 * @param {Record<string, string | number>} [params]
 */
export function tn(n, one, many, params) {
  return t(n === 1 ? one : many, { n, ...params })
}

/**
 * plural(1, 'juego', 'juegos') -> "1 juego" ("1 game" en inglés: cada palabra
 * pasa por t()).
 * @param {number} n @param {string} one @param {string} many
 */
export function plural(n, one, many) {
  return `${n} ${t(n === 1 ? one : many)}`
}

/**
 * Una lista en palabras: "a y b", "a, b y c" ("a, b, and c" en inglés).
 * Con 'disjunction': "a, b o c" ("a, b, or c").
 * @param {string[]} items
 * @param {'conjunction'|'disjunction'} [type]
 */
export function listJoin(items, type = 'conjunction') {
  return new Intl.ListFormat(i18n.dateLocale, { type }).format(items)
}
