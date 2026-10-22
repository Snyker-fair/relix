/**
 * A game's information from Wikidata and Wikipedia (Y › Find info…, and Options ›
 * Library › Game info): its description, year, genre, developer and publisher, for
 * the games ES-DE didn't scrape. Not how many can play: that data is often wrong
 * (many fighting games say 1 player). No accounts or keys.
 *
 *   1. Wikidata finds the game by its name among the games of its console (the
 *      "platform" statement). Each console's item comes from its English Wikipedia
 *      article (platforms.js › wikipedia), so no ids are written by hand. Wikidata
 *      limits searches a lot (429 after a few), so for many games the console's
 *      whole list of names comes in one query (consoleIndex) and they're compared
 *      here, like libretro's list of covers; the search is only for one game
 *      that isn't on the list.
 *   2. The game's item says its date, genre, developer and publisher.
 *   3. The description is the introduction of its Wikipedia article, in Relix's
 *      language if there's one (in the other one if not), with the credit the
 *      CC BY-SA license asks for. Wikidata's data is CC0.
 *
 * What's found is written in ES-DE's gamelist.xml (mergeGameInfo) without
 * replacing anything already there, so ES-DE sees it too.
 *
 * Every request goes through a `getJson(url)` the caller passes: the interface
 * uses fetch with a timeout; the tests, recorded answers.
 */
import { buildCoverIndex, coverCandidates, titleKey } from './coverMatch.js'

export const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'
export const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql'
/** Wikimedia asks every program to say who it is (browsers can't change User-Agent) */
export const API_USER_AGENT = 'Relix (https://github.com/Snyker-fair/relix)'

/** Wikidata's "video game" item, for the search without a console */
const VIDEO_GAME = 'Q7889'
const P = {
  instanceOf: 'P31',
  platform: 'P400',
  date: 'P577',
  genre: 'P136',
  developer: 'P178',
  publisher: 'P123',
}

/** The fields Relix fills in a gamelist entry, in ES-DE's order */
export const INFO_FIELDS = /** @type {const} */ (['desc', 'releasedate', 'developer', 'publisher', 'genre'])

/** What each field is called on screen (the screens translate it with t()) */
export const INFO_FIELD_NAMES = /** @type {Record<(typeof INFO_FIELDS)[number], string>} */ ({
  desc: 'Descripción',
  releasedate: 'Año',
  developer: 'Desarrolladora',
  publisher: 'Editora',
  genre: 'Género',
})

/** A description longer than this is cut at the end of a paragraph */
const MAX_DESCRIPTION = 1200
/** How many search results are looked at per game */
const SEARCH_LIMIT = 5

/**
 * @typedef {(url: string) => Promise<any>} GetJson
 * @typedef {'es' | 'en'} Lang
 * @typedef {Partial<Record<(typeof INFO_FIELDS)[number], string>>} GameInfo
 *   desc, releasedate ("20060420T000000"), developer, publisher, genre ("Action / Adventure")
 *
 * @typedef {Object} InfoCandidate
 * @property {string} id            the Wikidata item ("Q123")
 * @property {string} title         its name in Relix's language (or the other one)
 * @property {string} summary       Wikidata's short description ("2006 video game")
 * @property {number | null} year
 * @property {GameInfo} info        without desc until withDescriptions()
 * @property {{ lang: Lang, title: string } | null} article  its Wikipedia article (the one the description comes from)
 * @property {Array<{ lang: Lang, title: string }>} articles  its articles in Relix's language and the other one, in that order
 * @property {string[]} names       its names and aliases, to compare
 * @property {boolean} onPlatform   it's listed on the game's console
 * @property {boolean} isGame       it's a video game (not its series or a character with the same name)
 */

/**
 * A getJson that's polite with Wikimedia, which answers 429 ("too many") to a
 * program that asks fast: one request at a time with a pause between them and,
 * after a 429 or 503, it waits what the server says (Retry-After) and tries again.
 * @param {{
 *   fetch: (url: string) => Promise<{ ok: boolean, status: number, headers: { get(name: string): string | null }, json(): Promise<any> }>,
 *   minInterval?: number, retries?: number,
 *   sleep?: (ms: number) => Promise<void>, now?: () => number,
 * }} options
 * @returns {GetJson}
 */
export function politeGetJson({
  fetch: doFetch,
  minInterval = 700,
  retries = 4,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
}) {
  let last = -Infinity
  /** @type {Promise<unknown>} */
  let queue = Promise.resolve()
  return (url) => {
    const run = async () => {
      for (let attempt = 0; ; attempt++) {
        const wait = last + minInterval - now()
        if (wait > 0) await sleep(wait)
        last = now()
        const response = await doFetch(url)
        if ((response.status === 429 || response.status === 503) && attempt < retries) {
          const after = Number(response.headers.get('Retry-After'))
          await sleep(Number.isFinite(after) && after > 0 ? Math.min(after, 60) * 1000 : 2000 * 2 ** attempt)
          continue
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const json = await response.json()
        if (json?.error) throw new Error(String(json.error.info ?? json.error.code ?? 'API error'))
        return json
      }
    }
    const result = queue.then(run, run)
    queue = result.catch(() => {})
    return result
  }
}

/** An API URL with the parameters every request takes (JSON, anonymous CORS) */
export function apiUrl(/** @type {string} */ base, /** @type {Record<string, string>} */ params) {
  const query = new URLSearchParams({ ...params, format: 'json', formatversion: '2', origin: '*' })
  return `${base}?${query}`
}

/** @param {Lang} lang */
export function wikipediaApi(lang) {
  return `https://${lang}.wikipedia.org/w/api.php`
}

/** @template T @param {T[]} list @param {number} size @returns {T[][]} */
function chunks(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/**
 * Where a list of titles ended up after MediaWiki normalized them and followed
 * redirects ("Nintendo GameCube" -> "GameCube").
 * @param {any} query  the answer's `query`
 * @param {string} title
 */
function finalTitle(query, title) {
  let current = title
  for (const step of [query?.normalized ?? [], query?.redirects ?? []]) {
    const found = step.find((/** @type {any} */ r) => r.from === current)
    if (found) current = found.to
  }
  return current
}

// ── 1. The consoles' items ──────────────────────────────────────────────

/**
 * Each console's Wikidata item, from its English Wikipedia article.
 * @param {Array<{ id: string, wikipedia: string }>} platforms
 * @param {GetJson} getJson
 * @returns {Promise<Record<string, string>>}  console id -> "Q10680"
 */
export async function platformItems(platforms, getJson) {
  /** @type {Record<string, string>} */
  const items = {}
  for (const group of chunks(platforms, 50)) {
    const answer = await getJson(
      apiUrl(wikipediaApi('en'), {
        action: 'query',
        prop: 'pageprops',
        ppprop: 'wikibase_item',
        redirects: '1',
        titles: group.map((p) => p.wikipedia).join('|'),
      }),
    )
    const pages = new Map((answer?.query?.pages ?? []).map((/** @type {any} */ p) => [p.title, p]))
    for (const platform of group) {
      const item = pages.get(finalTitle(answer?.query, platform.wikipedia))?.pageprops?.wikibase_item
      if (item) items[platform.id] = item
    }
  }
  return items
}

// ── 2. Finding the game ─────────────────────────────────────────────────

/**
 * What's searched: the game's name without what the search engine would read as
 * its own syntax (quotes, ":", a "-" before a word...).
 * "Castlevania: Symphony of the Night" -> "Castlevania Symphony of the Night"
 * @param {string} name
 */
export function searchText(name) {
  return name
    .replace(/\s*[([][^)\]]*[)\]]/g, ' ')
    .replace(/["():[\]{}!*?~^\\/|<>=]/g, ' ')
    .replace(/(^|\s)[-+]+/g, '$1')
    .replace(/_/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * The items that may be the game: first among its console's games; if there are
 * none, among every game (then it's never a sure match).
 * @param {string} name
 * @param {string | undefined} platformItem
 * @param {GetJson} getJson
 * @returns {Promise<{ ids: string[], onPlatform: boolean }>}
 */
export async function searchGame(name, platformItem, getJson) {
  const text = searchText(name)
  if (!text) return { ids: [], onPlatform: false }
  /** @param {string} filter */
  const search = async (filter) => {
    const answer = await getJson(
      apiUrl(WIKIDATA_API, {
        action: 'query',
        list: 'search',
        srsearch: `${text} ${filter}`,
        srnamespace: '0',
        srlimit: String(SEARCH_LIMIT),
      }),
    )
    return (answer?.query?.search ?? [])
      .map((/** @type {any} */ r) => String(r.title))
      .filter((/** @type {string} */ id) => /^Q\d+$/.test(id))
  }
  if (platformItem) {
    const ids = await search(`haswbstatement:${P.platform}=${platformItem}`)
    if (ids.length > 0) return { ids, onPlatform: true }
  }
  return { ids: await search(`haswbstatement:${P.instanceOf}=${VIDEO_GAME}`), onPlatform: false }
}

// ── 3. What the items say ───────────────────────────────────────────────

/**
 * Items with their names, descriptions, statements and Wikipedia articles.
 * @param {string[]} ids
 * @param {GetJson} getJson
 * @param {{ props?: string }} [options]
 * @returns {Promise<Map<string, any>>}
 */
export async function fetchEntities(ids, getJson, { props = 'labels|descriptions|aliases|claims|sitelinks' } = {}) {
  /** @type {Map<string, any>} */
  const entities = new Map()
  for (const group of chunks([...new Set(ids)], 50)) {
    const answer = await getJson(
      apiUrl(WIKIDATA_API, {
        action: 'wbgetentities',
        ids: group.join('|'),
        props,
        languages: 'es|en',
        sitefilter: 'eswiki|enwiki',
      }),
    )
    for (const [id, entity] of Object.entries(answer?.entities ?? {})) {
      if (entity && /** @type {any} */ (entity).missing === undefined) entities.set(id, entity)
    }
  }
  return entities
}

/**
 * A property's statements, the preferred ones first and without the deprecated ones.
 * @param {any} entity @param {string} property
 */
function statements(entity, property) {
  const all = (entity?.claims?.[property] ?? []).filter((/** @type {any} */ s) => s.rank !== 'deprecated')
  const preferred = all.filter((/** @type {any} */ s) => s.rank === 'preferred')
  return [...preferred, ...all.filter((/** @type {any} */ s) => s.rank !== 'preferred')]
}

/** The items a property points to ("Q123"), in order @param {any} entity @param {string} property */
function itemValues(entity, property) {
  return statements(entity, property)
    .map((/** @type {any} */ s) => s.mainsnak?.datavalue?.value?.id)
    .filter((/** @type {any} */ id) => typeof id === 'string')
}

/** The items a game's statements point to, to ask for their names @param {any} entity */
export function referencedItems(entity) {
  return [P.genre, P.developer, P.publisher].flatMap((p) => itemValues(entity, p))
}

/**
 * A label in the language asked for, or the other one, and which one it was.
 * @param {any} entity @param {Lang} lang @param {'labels' | 'descriptions'} [kind]
 * @returns {{ value: string, lang: Lang }}
 */
function labelIn(entity, lang, kind = 'labels') {
  const mine = entity?.[kind]?.[lang]?.value
  if (mine) return { value: mine, lang }
  return { value: entity?.[kind]?.[other(lang)]?.value ?? '', lang: other(lang) }
}

/** @param {any} entity @param {Lang} lang @param {'labels' | 'descriptions'} [kind] */
function label(entity, lang, kind = 'labels') {
  return labelIn(entity, lang, kind).value
}

/** @param {Lang} lang @returns {Lang} */
function other(lang) {
  return lang === 'es' ? 'en' : 'es'
}

/**
 * The earliest release date, in ES-DE's format: "20060420T000000". With only
 * the month or the year, the first day is used ("2006" -> "20060101T000000").
 * @param {any} entity
 */
export function releaseDate(entity) {
  /** @type {string[]} */
  const dates = []
  for (const s of statements(entity, P.date)) {
    const value = s.mainsnak?.datavalue?.value
    const match = /^\+?(\d{4})-(\d{2})-(\d{2})/.exec(value?.time ?? '')
    if (!match || (value.precision ?? 0) < 9) continue
    const month = value.precision >= 10 && match[2] !== '00' ? match[2] : '01'
    const day = value.precision >= 11 && match[3] !== '00' ? match[3] : '01'
    dates.push(`${match[1]}${month}${day}T000000`)
  }
  return dates.sort()[0] ?? ''
}

/** Wikidata's badges for a link to a redirect (not the game's own article) */
const REDIRECT_BADGES = new Set(['Q70893996', 'Q70894304'])

/** Words Wikidata puts around a genre's name, by language */
const GENRE_NOISE = {
  es: [/^(videojuegos?|juegos?) (de|para) /i, /^videojuegos? /i],
  en: [/ (video )?games?$/i, /^video game /i],
}
/** A genre that's about how it's played (its English name), not a theme */
const GAME_GENRE =
  /\b(shooter|platform|platformer|role-playing|rpg|racing|fighting|fighter|puzzle|sports?|adventure|action|strategy|simulation|simulator|stealth|horror|rhythm|music|metroidvania|hack and slash|beat 'em up|shoot 'em up|roguelike|roguelite|sandbox|survival|party|tactical|tower defense|visual novel)\b/i

/** Genres with a usual short name */
const GENRE_SHORT = /** @type {Array<[RegExp, string]>} */ ([
  [/^(rol|role[- ]playing|rpg)$/i, 'RPG'],
  [/^(rol de acción|action role[- ]playing)$/i, 'Action RPG'],
])

/**
 * A genre's name as ES-DE shows it: "videojuego de plataformas" -> "Plataformas",
 * "platform game" -> "Platform", "role-playing video game" -> "RPG".
 * @param {string} name @param {Lang} lang
 */
export function cleanGenre(name, lang) {
  let text = name.trim()
  for (const noise of GENRE_NOISE[lang] ?? []) text = text.replace(noise, '')
  for (const [pattern, short] of GENRE_SHORT) if (pattern.test(text)) return short
  text = text.trim()
  return text ? text[0].toLocaleUpperCase(lang) + text.slice(1) : ''
}

/**
 * A search result turned into what Relix shows and saves.
 * @param {any} entity
 * @param {Map<string, any>} labels  the items the game points to (genres, companies, modes)
 * @param {Lang} lang
 * @param {boolean} onPlatform
 * @returns {InfoCandidate}
 */
export function candidateFrom(entity, labels, lang, onPlatform) {
  /** @param {string} property @param {number} max */
  const names = (property, max) =>
    [...new Set(itemValues(entity, property).map((id) => label(labels.get(id), lang)).filter(Boolean))].slice(0, max)
  // Each genre is cleaned with the rules of the language its name came in. Wikidata
  // mixes in themes ("cyberpunk", "crossover fiction"): after the first, only game genres
  const genres = [
    ...new Set(
      itemValues(entity, P.genre)
        .filter((id, i) => i === 0 || GAME_GENRE.test(label(labels.get(id), 'en')))
        .map((id) => labelIn(labels.get(id), lang))
        .filter((l) => l.value)
        .map((l) => cleanGenre(l.value, l.lang))
        .filter(Boolean),
    ),
  ]
  const releasedate = releaseDate(entity)
  // A link to a redirect isn't the game's own article (Emerald -> "Ruby and Sapphire")
  const articles = /** @type {Lang[]} */ ([lang, other(lang)])
    .map((l) => ({ l, link: entity?.sitelinks?.[`${l}wiki`] }))
    .filter(({ link }) => link?.title && !(link.badges ?? []).some((/** @type {string} */ b) => REDIRECT_BADGES.has(b)))
    .map(({ l, link }) => ({ lang: l, title: String(link.title) }))
  /** @type {GameInfo} */
  const info = {}
  if (releasedate) info.releasedate = releasedate
  const developer = names(P.developer, 2).join(', ')
  if (developer) info.developer = developer
  const publisher = names(P.publisher, 2).join(', ')
  if (publisher) info.publisher = publisher
  if (genres.length > 0) info.genre = genres.slice(0, 2).join(' / ')
  return {
    id: entity.id,
    title: label(entity, lang),
    summary: label(entity, lang, 'descriptions'),
    year: releasedate ? Number(releasedate.slice(0, 4)) : null,
    info,
    article: articles[0] ?? null,
    articles,
    names: [
      ...Object.values(entity?.labels ?? {}).map((/** @type {any} */ l) => l.value),
      ...Object.values(entity?.aliases ?? {}).flatMap((/** @type {any} */ list) => list.map((a) => a.value)),
    ],
    onPlatform,
    isGame: itemValues(entity, P.instanceOf).includes(VIDEO_GAME),
  }
}

/**
 * The candidate that's surely the game: on its console and with exactly its name
 * (or one of its other names). If its series has the same name too, the game
 * wins. null if there isn't exactly one: then you pick.
 * @param {string} name
 * @param {InfoCandidate[]} candidates
 */
export function pickMatch(name, candidates) {
  const key = titleKey(name)
  if (!key) return null
  const same = candidates.filter((c) => c.onPlatform && c.names.some((n) => titleKey(n) === key))
  if (same.length === 1) return same[0]
  const games = same.filter((c) => c.isGame)
  return games.length === 1 ? games[0] : null
}

// ── The console's list ──────────────────────────────────────────────────

/**
 * @typedef {Object} ConsoleIndex
 * @property {import('./coverMatch.js').CoverIndex} names  every name and alias, to compare
 * @property {Map<string, string[]>} items                 name -> its items ("Q123")
 */

/**
 * Every name (and other name) of a console's games, in Spanish and English, in a
 * single query to Wikidata's query service.
 * @param {string} platformItem  the console's item ("Q10680")
 * @param {GetJson} getJson
 * @returns {Promise<ConsoleIndex>}
 */
export async function consoleIndex(platformItem, getJson) {
  if (!/^Q\d+$/.test(platformItem)) throw new Error(`not an item: ${platformItem}`)
  const query =
    `SELECT ?item ?name WHERE { ?item wdt:${P.platform} wd:${platformItem} . ` +
    '{ ?item rdfs:label ?name } UNION { ?item skos:altLabel ?name } ' +
    'FILTER(LANG(?name) = "en" || LANG(?name) = "es") }'
  const answer = await getJson(`${WIKIDATA_SPARQL}?${new URLSearchParams({ format: 'json', query })}`)
  /** @type {Map<string, string[]>} */
  const items = new Map()
  for (const row of answer?.results?.bindings ?? []) {
    const id = /Q\d+$/.exec(row?.item?.value ?? '')?.[0]
    const name = String(row?.name?.value ?? '').trim()
    if (!id || !name) continue
    const list = items.get(name)
    if (!list) items.set(name, [id])
    else if (!list.includes(id)) list.push(id)
  }
  return { names: buildCoverIndex([...items.keys()]), items }
}

/**
 * The items on a console's list that may be a game: the ones with exactly its
 * name, and the ones with a similar name (to pick from).
 * @param {string} name
 * @param {ConsoleIndex} index
 * @param {{ limit?: number }} [options]
 * @returns {{ exact: string[], similar: string[] }}
 */
export function indexCandidates(name, index, { limit = 5 } = {}) {
  const idsOf = (/** @type {string[]} */ names) => [...new Set(names.flatMap((n) => index.items.get(n) ?? []))]
  const exact = idsOf(index.names.byTitle.get(titleKey(name)) ?? [])
  const similar = idsOf(
    coverCandidates(name, index.names, { limit }).flatMap((c) => index.names.byTitle.get(titleKey(c.name)) ?? []),
  ).filter((id) => !exact.includes(id))
  return { exact, similar: similar.slice(0, Math.max(0, limit - exact.length)) }
}

/**
 * Items turned into candidates: their statements, and the names of what they point to.
 * @param {string[]} ids
 * @param {{ lang: Lang, getJson: GetJson, onPlatform?: boolean }} options
 * @returns {Promise<Map<string, InfoCandidate>>}
 */
export async function describeItems(ids, { lang, getJson, onPlatform = true }) {
  const entities = await fetchEntities(ids, getJson)
  const labels = await fetchEntities([...entities.values()].flatMap(referencedItems), getJson, { props: 'labels' })
  return new Map([...entities.entries()].map(([id, e]) => [id, candidateFrom(e, labels, lang, onPlatform)]))
}

/** The sure match first @param {InfoCandidate[]} candidates @param {InfoCandidate | null} match */
function sureFirst(candidates, match) {
  return match ? [match, ...candidates.filter((c) => c !== match)] : candidates
}

/**
 * One game's candidates (Y › Find info…): from its console's list and, if
 * nothing there looks like it, from Wikidata's search.
 * @param {{ name: string }} game
 * @param {{ index: ConsoleIndex | null, platformItem?: string, lang: Lang, getJson: GetJson }} options
 * @returns {Promise<{ candidates: InfoCandidate[], match: InfoCandidate | null }>}
 */
export async function findCandidates(game, { index, platformItem, lang, getJson }) {
  const fromIndex = index ? indexCandidates(game.name, index) : { exact: [], similar: [] }
  let ids = [...fromIndex.exact, ...fromIndex.similar]
  let onPlatform = true
  if (ids.length === 0) ({ ids, onPlatform } = await searchGame(game.name, platformItem, getJson))
  const described = await describeItems(ids, { lang, getJson, onPlatform })
  const candidates = ids.map((id) => described.get(id)).filter((c) => c !== undefined)
  const match = pickMatch(game.name, candidates)
  return { candidates: sureFirst(candidates, match), match }
}

/**
 * Many games of one console (Options › Library › Game info): the ones with a
 * sure match on its list, the ones that only have similar names (you pick) and
 * the ones that aren't on it.
 * @param {Array<{ id: string, name: string }>} games
 * @param {{ index: ConsoleIndex, lang: Lang, getJson: GetJson }} options
 * @returns {Promise<{ sure: Map<string, InfoCandidate>, unsure: string[], notFound: string[] }>}
 */
export async function findSureMatches(games, { index, lang, getJson }) {
  const found = games.map((game) => ({ game, ...indexCandidates(game.name, index, { limit: 1 }) }))
  const described = await describeItems(
    found.flatMap((f) => f.exact),
    { lang, getJson },
  )
  /** @type {Map<string, InfoCandidate>} */
  const sure = new Map()
  /** @type {string[]} */
  const unsure = []
  /** @type {string[]} */
  const notFound = []
  for (const { game, exact, similar } of found) {
    const candidates = exact.map((id) => described.get(id)).filter((c) => c !== undefined)
    const match = pickMatch(game.name, candidates)
    if (match) sure.set(game.id, match)
    else if (exact.length > 0 || similar.length > 0) unsure.push(game.id)
    else notFound.push(game.id)
  }
  return { sure, unsure, notFound }
}

// ── 4. The description ──────────────────────────────────────────────────

/**
 * A Wikipedia introduction ready for the gamelist: without the empty
 * parentheses the plain text leaves, not too long, and with its credit.
 * @param {string} extract  the article's introduction, in plain text
 * @param {{ lang: Lang, title: string }} article
 */
export function descriptionFrom(extract, article) {
  const text = extract
    .replace(/\r/g, '')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    // "(ファイナルファンタジーVII, Fainaru Fantajī Sebun?)": the name in Japanese
    .replace(/\s*\([^()]*[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af][^()]*\)/g, '')
    .replace(/\s*\(\s*[,;]?\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!text) return ''

  // Whole paragraphs while they fit; a very long first one is cut at a sentence
  const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean)
  let kept = paragraphs[0]
  for (const p of paragraphs.slice(1)) {
    if (kept.length + p.length + 2 > MAX_DESCRIPTION) break
    kept += `\n\n${p}`
  }
  if (kept.length > MAX_DESCRIPTION * 1.25) {
    const cut = kept.slice(0, MAX_DESCRIPTION)
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'))
    kept = end > MAX_DESCRIPTION / 2 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`
  }
  const credit =
    article.lang === 'es'
      ? `Fuente: Wikipedia, «${article.title}» (CC BY-SA 4.0).`
      : `Source: Wikipedia, "${article.title}" (CC BY-SA 4.0).`
  return `${kept}\n\n${credit}`
}

/**
 * The candidates with their description: from the article in Relix's language or,
 * if it has none (or it's a redirect to another article), from the other one.
 * One request per language for up to 20 articles.
 * @param {InfoCandidate[]} candidates
 * @param {GetJson} getJson
 * @returns {Promise<InfoCandidate[]>}  new objects; the ones without a description stay the same
 */
export async function withDescriptions(candidates, getJson) {
  /** @type {Map<string, string>} "es:Ōkami" -> text */
  const texts = new Map()
  for (const lang of /** @type {Lang[]} */ (['es', 'en'])) {
    const titles = [
      ...new Set(candidates.flatMap((c) => (c.articles ?? (c.article ? [c.article] : [])).filter((a) => a.lang === lang).map((a) => a.title))),
    ]
    for (const group of chunks(titles, 20)) {
      const answer = await getJson(
        apiUrl(wikipediaApi(lang), {
          action: 'query',
          prop: 'extracts',
          exintro: '1',
          explaintext: '1',
          exlimit: '20',
          redirects: '1',
          titles: group.join('|'),
        }),
      )
      const redirected = new Set((answer?.query?.redirects ?? []).map((/** @type {any} */ r) => r.from))
      const pages = new Map((answer?.query?.pages ?? []).map((/** @type {any} */ p) => [p.title, p]))
      for (const title of group) {
        const normalized = finalTitle({ normalized: answer?.query?.normalized }, title)
        if (redirected.has(normalized) || redirected.has(title)) continue
        const extract = pages.get(normalized)?.extract
        if (typeof extract === 'string' && extract.trim()) texts.set(`${lang}:${title}`, extract)
      }
    }
  }
  return candidates.map((c) => {
    for (const article of c.articles ?? (c.article ? [c.article] : [])) {
      const extract = texts.get(`${article.lang}:${article.title}`)
      const desc = extract ? descriptionFrom(extract, article) : ''
      if (desc) return { ...c, article, info: { desc, ...c.info } }
    }
    return c
  })
}

// ── 5. ES-DE's gamelist ─────────────────────────────────────────────────

/** @param {string} text */
function escapeXml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** @param {string} text */
function unescapeXml(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** "./Sub/Game.chd" or ".\Sub\Game.chd" -> "sub/game.chd", to compare */
function pathKey(/** @type {string} */ path) {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase()
}

const EMPTY_GAMELIST = '<?xml version="1.0"?>\n<gameList>\n</gameList>\n'

/**
 * @typedef {{ path: string, name: string, info: GameInfo }} InfoEntry
 *   path: relative to the console's folder, with "/"; name: for a new entry
 */

/**
 * Writes games' information in a gamelist.xml, as text, so the rest of the file
 * stays exactly as it was. A field that already has something is never replaced;
 * a game without an entry gets a new one with its name.
 * @param {string | null} xml  the current gamelist (null: there's none yet)
 * @param {InfoEntry[]} entries
 * @returns {{ xml: string, changed: number }}  changed: how many games got something
 */
export function mergeGameInfo(xml, entries) {
  let text = xml && xml.trim() ? xml : EMPTY_GAMELIST
  const closing = text.lastIndexOf('</gameList>')
  if (closing < 0) throw new Error('gamelist.xml has no </gameList>')

  const pending = new Map(entries.map((e) => [pathKey(e.path), e]))
  let changed = 0

  // The games that already have an entry: only what's missing or empty is added
  text = text.replace(/<game(\s[^>]*)?>([\s\S]*?)<\/game>/g, (block, attributes = '', inner) => {
    const path = /<path>([^<]*)<\/path>/.exec(inner)?.[1]
    const entry = path === undefined ? undefined : pending.get(pathKey(unescapeXml(path).trim()))
    if (!entry) return block
    pending.delete(pathKey(entry.path))

    const indent = /\n([ \t]*)<path>/.exec(inner)?.[1] ?? '\t\t'
    let body = inner
    /** @type {string[]} */
    const added = []
    for (const field of INFO_FIELDS) {
      const value = entry.info[field]?.trim()
      if (!value) continue
      const existing = new RegExp(`<${field}(\\s[^>]*)?(/>|>([\\s\\S]*?)</${field}>)`).exec(body)
      if (existing && (existing[3] ?? '').trim()) continue
      if (existing) body = body.replace(existing[0], () => `<${field}>${escapeXml(value)}</${field}>`)
      else added.push(`\n${indent}<${field}>${escapeXml(value)}</${field}>`)
    }
    if (body === inner && added.length === 0) return block
    changed++
    const content = body.replace(/\s*$/, '')
    const trailing = body.slice(content.length)
    return `<game${attributes}>${content}${added.join('')}${trailing}</game>`
  })

  // The ones without an entry: a new one before </gameList>
  const gameIndent = /\n([ \t]*)<game[\s>]/.exec(text)?.[1] ?? '\t'
  const fieldIndent = /\n([ \t]*)<path>/.exec(text)?.[1] ?? `${gameIndent}\t`
  const blocks = [...pending.values()]
    .map((entry) => {
      const fields = INFO_FIELDS.filter((f) => entry.info[f]?.trim()).map(
        (f) => `${fieldIndent}<${f}>${escapeXml(/** @type {string} */ (entry.info[f]).trim())}</${f}>\n`,
      )
      if (fields.length === 0) return ''
      changed++
      return (
        `${gameIndent}<game>\n` +
        `${fieldIndent}<path>./${escapeXml(entry.path)}</path>\n` +
        `${fieldIndent}<name>${escapeXml(entry.name)}</name>\n` +
        fields.join('') +
        `${gameIndent}</game>\n`
      )
    })
    .join('')
  if (blocks) {
    const end = text.lastIndexOf('</gameList>')
    const before = text.slice(0, end)
    text = `${before}${before.endsWith('\n') ? '' : '\n'}${blocks}${text.slice(end)}`
  }
  return { xml: text, changed }
}

/**
 * What a game is missing, in ES-DE's fields (the ones Relix can fill).
 * @param {{ description: string, year: number | null, developer: string, publisher: string, genre: string }} game
 * @returns {Array<(typeof INFO_FIELDS)[number]>}
 */
export function missingInfo(game) {
  /** @type {Array<(typeof INFO_FIELDS)[number]>} */
  const missing = []
  if (!game.description) missing.push('desc')
  if (!game.year) missing.push('releasedate')
  if (!game.developer) missing.push('developer')
  if (!game.publisher) missing.push('publisher')
  if (!game.genre) missing.push('genre')
  return missing
}
