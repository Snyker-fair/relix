/**
 * Finds each game's cover in libretro-thumbnails (the same covers RetroArch
 * uses). libretro names each image with the game's standard name
 * (Redump / No-Intro), e.g. "Kingdom Hearts II (USA).png".
 *
 * It searches on three levels:
 *   1. Exact name: the file already has the standard name (the usual case after
 *      converting to CHD). It's safe.
 *   2. Same title: "kingdom_hearts_2.iso" -> "Kingdom Hearts II (USA)".
 *      It ignores case, accents, underscores, "The" and Roman numerals.
 *      If the file names its region, that's respected; otherwise the preferred one is used.
 *   3. Candidates: nicknames like "Zelda Wind Waker". It doesn't pick by itself:
 *      the closest ones are offered so the player chooses.
 */

import { t } from '../i18n/i18n.svelte.js'
import { fileStem, titleStem } from './esde.js'

export const THUMBNAILS_SERVER = 'https://thumbnails.libretro.com'

/** Regions that show up in the standard names */
const REGION_WORDS = new Set([
  'USA', 'Canada', 'Europe', 'Japan', 'World', 'Spain', 'France', 'Germany', 'Italy', 'UK',
  'Asia', 'Korea', 'China', 'Taiwan', 'Australia', 'Brazil', 'Netherlands', 'Scandinavia',
  'Russia', 'Latin America', 'Mexico', 'Argentina', 'Portugal', 'Sweden', 'Hong Kong',
])

/** Order of preference when the file doesn't name its region */
export const REGION_PREFERENCES = {
  usa: ['USA', 'Canada', 'World', 'Latin America', 'Mexico', 'Brazil', 'Europe', 'Spain', 'UK', 'Australia', 'Asia', 'Japan'],
  europe: ['Spain', 'Europe', 'World', 'UK', 'Australia', 'France', 'Italy', 'Germany', 'USA', 'Canada', 'Asia', 'Japan'],
  japan: ['Japan', 'Asia', 'World', 'USA', 'Canada', 'Europe', 'Spain'],
}

/** @typedef {keyof typeof REGION_PREFERENCES} RegionPreference */

/** The visible name of each preference */
export const REGION_NAMES = { usa: 'EE. UU.', europe: 'Europa', japan: 'Japón' }

/** Versions we don't want as the cover if there's another option */
const UNWANTED = /\b(Beta|Proto|Prototype|Demo|Sample|Taikenban|Kiosk|Trial|Preview|Promo|Debug|Pirate|Unl)\b|\bDisc [2-9]\b/i

const ROMAN = /** @type {Record<string, string>} */ ({
  ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10',
  xi: '11', xii: '12', xiii: '13', xiv: '14', xv: '15',
})
const STOP_WORDS = new Set(['the', 'a', 'an', 'and'])
const TAG = /\s*[([][^)\]]*[)\]]/g

/** Characters libretro replaces with "_" in file names */
export function libretroSafeName(/** @type {string} */ name) {
  return name.replace(/[&*/:`<>?\\|"]/g, '_')
}

/** "Okami (USA) (En,Ja)" -> ["USA", "En,Ja"] */
export function tagsOf(/** @type {string} */ name) {
  return [...name.matchAll(/\(([^)]*)\)/g)].map((m) => m[1])
}

/** "Okami (USA) [!]" -> "Okami" */
export function baseTitle(/** @type {string} */ name) {
  return name.replace(TAG, '').trim()
}

/**
 * The key for comparing titles.
 * "Legend of Zelda, The - The Wind Waker (USA)" -> "legend of zelda wind waker"
 * "kingdom_hearts_2"                             -> "kingdom hearts 2"
 */
export function titleKey(/** @type {string} */ name) {
  const text = baseTitle(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/_/g, ' ')
    .replace(/&/g, ' and ')
  const tokens = (text.match(/[a-z0-9]+/g) ?? []).map((t) => ROMAN[t] ?? t)
  const kept = tokens.filter((t) => !STOP_WORDS.has(t))
  return (kept.length > 0 ? kept : tokens).join(' ')
}

/** The regions a name says: "Gran Turismo 4 (USA, Canada) (v1.01)" -> ["USA", "Canada"] */
export function regionsOf(/** @type {string} */ name) {
  return tagsOf(name)
    .flatMap((tag) => tag.split(/,\s*/))
    .filter((word) => REGION_WORDS.has(word))
}

/**
 * How good a version is as the cover (lower = better):
 * first the ones that aren't demo/beta, then the region, then the simplest.
 * @param {string} name @param {string[]} order regions in order of preference
 */
function rank(name, order) {
  const regions = regionsOf(name)
  const regionIndex = Math.min(...regions.map((r) => order.indexOf(r)).filter((i) => i >= 0), 99)
  return [UNWANTED.test(name) ? 1 : 0, regionIndex, tagsOf(name).length, name.length]
}

/** @param {string[]} names @param {string[]} order */
function best(names, order) {
  return names
    .map((name) => ({ name, r: rank(name, order) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || a.r[2] - b.r[2] || a.r[3] - b.r[3] || (a.name < b.name ? -1 : 1))[0]
    .name
}

/**
 * @typedef {Object} CoverIndex
 * @property {string[]} names
 * @property {Map<string, string>} exact            lowercase name -> name
 * @property {Map<string, string[]>} byTitle        titleKey -> versions
 * @property {Array<{ key: string, tokens: Set<string> }>} titles  to look for candidates
 */

/**
 * Prepares a console's list of covers for fast lookups.
 * @param {string[]} names  names without ".png", as they are on libretro
 * @returns {CoverIndex}
 */
export function buildCoverIndex(names) {
  /** @type {Map<string, string[]>} */
  const byTitle = new Map()
  for (const name of names) {
    const key = titleKey(name)
    const list = byTitle.get(key)
    if (list) list.push(name)
    else byTitle.set(key, [name])
  }
  return {
    names,
    exact: new Map(names.map((n) => [n.toLowerCase(), n])),
    byTitle,
    titles: [...byTitle.keys()].map((key) => ({ key, tokens: new Set(key.split(' ')) })),
  }
}

/** @param {string} query @param {RegionPreference} preference */
function regionOrder(query, preference) {
  return [...new Set([...regionsOf(query), ...(REGION_PREFERENCES[preference] ?? REGION_PREFERENCES.usa)])]
}

/**
 * Finds a game's safe cover.
 * @param {string} query  the file name without its extension (or the folder, on Wii U)
 * @param {CoverIndex} index
 * @param {{ region?: RegionPreference, altTitle?: string }} [options]
 *   altTitle: the name ES-DE has, in case the file has an odd name
 * @returns {{ name: string, how: 'exact'|'title' } | null}
 */
export function matchCover(query, index, { region = 'usa', altTitle } = {}) {
  const exact = index.exact.get(libretroSafeName(query).toLowerCase())
  if (exact) return { name: exact, how: 'exact' }

  const versions =
    index.byTitle.get(titleKey(query)) ?? (altTitle ? index.byTitle.get(titleKey(altTitle)) : undefined)
  if (!versions) return null
  return { name: best(versions, regionOrder(query, region)), how: 'title' }
}

/**
 * @typedef {{ name: string, title: string, region: string }} CoverCandidate
 */

/**
 * Similar covers to pick by hand: the best version of each title,
 * sorted by how many words they share with the game's name.
 * @param {string} query
 * @param {CoverIndex} index
 * @param {{ region?: RegionPreference, altTitle?: string, limit?: number }} [options]
 * @returns {CoverCandidate[]}
 */
export function coverCandidates(query, index, { region = 'usa', altTitle, limit = 6 } = {}) {
  const queries = [titleKey(query), altTitle ? titleKey(altTitle) : ''].filter(Boolean)
  /** @type {Map<string, number>} */
  const scores = new Map()
  for (const q of queries) {
    const wanted = [...new Set(q.split(' '))]
    for (const { key, tokens } of index.titles) {
      let hits = 0
      let wordHit = false // more than a number has to match ("Persona 4" isn't "Gran Turismo 4")
      for (const t of wanted) {
        const hit = tokenHit(t, tokens)
        hits += hit
        if (hit > 0 && !/^\d+$/.test(t)) wordHit = true
      }
      const score = hits / wanted.length
      if (wordHit && score >= 0.5 && score > (scores.get(key) ?? 0)) scores.set(key, score)
    }
  }
  const order = regionOrder(query, region)
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].split(' ').length - b[0].split(' ').length || (a[0] < b[0] ? -1 : 1))
    .slice(0, limit)
    .map(([key]) => {
      const name = best(index.byTitle.get(key) ?? [], order)
      return { name, title: baseTitle(name), region: regionLabel(name) }
    })
}

/**
 * How much a word from the game counts in a title: 1 if it's there as is,
 * 0.8 if it differs by one letter ("Okami" / "Ookami"), 0 if it isn't there.
 * @param {string} word @param {Set<string>} tokens
 */
function tokenHit(word, tokens) {
  if (tokens.has(word)) return 1
  if (word.length < 4 || /\d/.test(word)) return 0
  for (const t of tokens) {
    if (t.length >= 4 && Math.abs(t.length - word.length) <= 1 && oneEditApart(word, t)) return 0.8
  }
  return 0
}

/** true if a and b differ by a single letter (changed, added or removed) */
function oneEditApart(/** @type {string} */ a, /** @type {string} */ b) {
  if (a.length > b.length) [a, b] = [b, a]
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1)
  return a.slice(i) === b.slice(i + 1)
}

const REGION_LABELS = /** @type {Record<string, string>} */ ({
  USA: 'EE. UU.', Canada: 'Canadá', Europe: 'Europa', Japan: 'Japón', World: 'Mundial',
  Spain: 'España', France: 'Francia', Germany: 'Alemania', Italy: 'Italia', UK: 'Reino Unido',
  Asia: 'Asia', Korea: 'Corea', China: 'China', Australia: 'Australia', Brazil: 'Brasil',
})

/** "Okami (Europe, Australia) (En,Fr)" -> "Europa" ("Europe" in English) */
export function regionLabel(/** @type {string} */ name) {
  const region = regionsOf(name)[0]
  return region ? (REGION_LABELS[region] ? t(REGION_LABELS[region]) : region) : ''
}

/**
 * Which name is looked up for a game: the file without its extension or, for
 * Wii U in folders (Game/code/game.rpx), the folder's name.
 * @param {{ path: string }} game
 */
export function coverQuery(game) {
  return titleStem(game.path)
}

/**
 * Where the cover is saved, relative to downloaded_media/<console>/covers,
 * without an extension. It's ES-DE's rule: the game's path without its extension.
 * "Final Fantasy VII (USA)/Final Fantasy VII (USA).m3u" -> "Final Fantasy VII (USA)/Final Fantasy VII (USA)"
 * @param {{ path: string }} game
 */
export function coverKey(game) {
  const parts = game.path.split('/')
  parts[parts.length - 1] = fileStem(game.path)
  return parts.join('/')
}

/**
 * The URL of a cover on libretro's server (to see the candidates).
 * @param {string} libretroSystem  e.g. "Sony - PlayStation 2"
 * @param {string} name            the name without ".png"
 * @param {string} [folder]        Named_Boxarts (cover), Named_Snaps (screenshot) or Named_Titles
 */
export function remoteCoverUrl(libretroSystem, name, folder = 'Named_Boxarts') {
  return `${THUMBNAILS_SERVER}/${encodeURIComponent(libretroSystem)}/${folder}/${encodeURIComponent(name)}.png`
}
