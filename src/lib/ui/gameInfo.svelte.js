/**
 * Game information (Y › Find info…, and Options › Library › Game info) from
 * Wikidata and Wikipedia (core/gameInfo.js), written in ES-DE's gamelist.xml.
 *
 *   candidatesFor(game)   the items that may be the game, with their description
 *   save(game, candidate) writes what the game is missing; nothing is replaced
 *   findAll()             console by console, the games without a description:
 *                         the sure matches are saved, the rest stay to pick (pending)
 *   findFor(systemIds)    the same, only in those consoles (after a scan)
 *
 * The requests go one at a time and slowly (politeGetJson): Wikimedia turns away
 * a program that asks fast.
 */
import { readGamelist, writeGamelist } from '../core/bridge.js'
import {
  API_USER_AGENT,
  consoleIndex,
  findCandidates,
  findSureMatches,
  mergeGameInfo,
  missingInfo,
  platformItems,
  politeGetJson,
  withDescriptions,
} from '../core/gameInfo.js'
import { getPlatform, PLATFORMS } from '../core/platforms.js'
import { i18n, t } from '../i18n/i18n.svelte.js'
import { diagnostics } from './diagnostics.svelte.js'
import { library } from './library.svelte.js'
import { load, onReplaced, save } from './storage.js'

/**
 * @typedef {import('./library.svelte.js').LibraryGame} LibraryGame
 * @typedef {import('../core/gameInfo.js').InfoCandidate} InfoCandidate
 * @typedef {{ saved: number, unsure: number, notFound: number, failed: string[], at: number }} FindResult
 */

/** A big console's list can take a while */
const TIMEOUT_MS = 25000
/** The consoles' Wikidata items barely change: they're asked for once a month */
const ITEMS_KEY = 'wikidataItems'
const ITEMS_EVERY_MS = 30 * 24 * 60 * 60 * 1000
/** How many candidates are shown for a game */
const MAX_CANDIDATES = 6

/** @param {string} url */
async function timedFetch(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { headers: { 'Api-User-Agent': API_USER_AGENT }, signal: controller.signal })
  } catch {
    throw new Error(t('No pude conectar con Wikipedia. Revisa la conexión a internet de la consola.'))
  } finally {
    clearTimeout(timer)
  }
}

const getJson = politeGetJson({ fetch: timedFetch })

/** @returns {'es' | 'en'} */
const lang = () => (i18n.current === 'en' ? 'en' : 'es')

class GameInfo {
  /** Games you chose to leave without information: they leave the list */
  /** @type {string[]} */
  skipped = $state(load('infoSkipped', []))
  /** The games that only have similar names, from the last search (ids); null until it runs */
  /** @type {string[] | null} */
  pendingIds = $state(null)
  /** The search through the consoles is running: which one, how many are done */
  /** @type {{ console: string, done: number, total: number } | null} */
  finding = $state(null)
  /** What the last search did */
  /** @type {FindResult | null} */
  result = $state(null)

  /** The list to pick from: still there, still without a description, not left as they are */
  pending = $derived(
    (this.pendingIds ?? [])
      .map((id) => library.byId.get(id))
      .filter((g) => g !== undefined && !g.description && !this.skipped.includes(g.id)),
  )

  /** Games with nothing yet, for Options */
  withoutDescription = $derived(library.all.filter((g) => !g.description).length)

  /** @type {Promise<Record<string, string>> | null} */
  #items = null
  /** @type {Map<string, Promise<import('../core/gameInfo.js').ConsoleIndex>>} */
  #indexes = new Map()

  constructor() {
    onReplaced(() => {
      this.skipped = load('infoSkipped', [])
    })
  }

  /** Whether a game is missing something Wikipedia could give @param {LibraryGame} game */
  canFill(game) {
    return missingInfo(game).length > 0
  }

  /** Each console's Wikidata item, saved for a month */
  #platformItems() {
    if (!this.#items) {
      const saved = /** @type {{ at: number, items: Record<string, string> } | null} */ (load(ITEMS_KEY, null))
      const fresh = saved && Date.now() - saved.at < ITEMS_EVERY_MS && PLATFORMS.every((p) => saved.items[p.id])
      this.#items = fresh
        ? Promise.resolve(saved.items)
        : platformItems(PLATFORMS, getJson).then((items) => {
            save(ITEMS_KEY, { at: Date.now(), items })
            return items
          })
      this.#items.catch(() => (this.#items = null))
    }
    return this.#items
  }

  /** A console's list of names (once per session) @param {string} systemId */
  async #index(systemId) {
    let index = this.#indexes.get(systemId)
    if (!index) {
      const item = (await this.#platformItems())[systemId]
      if (!item) throw new Error(t('Wikidata no tiene la consola {console}.', { console: systemId }))
      index = consoleIndex(item, getJson)
      index.catch(() => this.#indexes.delete(systemId))
      this.#indexes.set(systemId, index)
    }
    return index
  }

  /**
   * The items that may be the game, the sure one first, with their description.
   * @param {LibraryGame} game
   * @returns {Promise<{ candidates: InfoCandidate[], match: InfoCandidate | null }>}
   */
  async candidatesFor(game) {
    const items = await this.#platformItems()
    const index = await this.#index(game.system).catch(() => null)
    const { candidates, match } = await findCandidates(game, {
      index,
      platformItem: items[game.system],
      lang: lang(),
      getJson,
    })
    const described = await withDescriptions(candidates.slice(0, MAX_CANDIDATES), getJson)
    return { candidates: described, match: match ? (described.find((c) => c.id === match.id) ?? null) : null }
  }

  /**
   * Writes in the gamelist what the game is missing from what the candidate has.
   * @param {LibraryGame} game
   * @param {InfoCandidate} candidate
   * @returns {Promise<boolean>}  false if there was nothing to add
   */
  async save(game, candidate) {
    const added = await this.#write(game.system, [{ path: game.path, name: game.name, info: candidate.info }])
    if (this.pendingIds) this.pendingIds = this.pendingIds.filter((id) => id !== game.id)
    return added > 0
  }

  /**
   * Reads the gamelist as it is on the USB drive right now, adds to it and saves it.
   * @param {string} systemId
   * @param {import('../core/gameInfo.js').InfoEntry[]} entries
   * @returns {Promise<number>}  how many games got something
   */
  async #write(systemId, entries) {
    if (entries.length === 0) return 0
    const current = await readGamelist(systemId)
    const { xml, changed } = mergeGameInfo(current, entries)
    if (changed === 0) return 0
    await writeGamelist(systemId, xml)
    library.applyGamelist(systemId, xml)
    return changed
  }

  /** Leaves a game without information: it leaves the list @param {LibraryGame} game */
  skip(game) {
    if (this.skipped.includes(game.id)) return
    this.skipped = [...this.skipped, game.id]
    save('infoSkipped', this.skipped)
  }

  /**
   * Console by console, the games without a description: the sure matches are
   * written in each gamelist (once per console) and the rest stay to pick.
   * @returns {Promise<FindResult | null>}  null if it was already running
   */
  findAll() {
    return this.findFor(PLATFORMS.map((p) => p.id))
  }

  /**
   * Like findAll, only in those consoles (after scanning them). What it isn't sure
   * of is added to the list to pick, next to what was already there.
   * @param {string[]} systemIds
   * @returns {Promise<FindResult | null>}  null if it was already running
   */
  async findFor(systemIds) {
    if (this.finding) return null
    /** @param {LibraryGame} g */
    const wanted = (g) => !g.description && !this.skipped.includes(g.id)
    const consoles = PLATFORMS.filter((p) => systemIds.includes(p.id) && library.gamesFor(p.id).some(wanted))
    const every = consoles.length === PLATFORMS.filter((p) => library.gamesFor(p.id).some(wanted)).length
    this.finding = { console: '', done: 0, total: consoles.length }
    /** @type {FindResult} */
    const result = { saved: 0, unsure: 0, notFound: 0, failed: [], at: Date.now() }
    /** @type {string[]} */
    const unsure = []
    try {
      for (const platform of consoles) {
        this.finding = { ...this.finding, console: platform.shortName }
        try {
          const games = library.gamesFor(platform.id).filter(wanted)
          const index = await this.#index(platform.id)
          const found = await findSureMatches(games, { index, lang: lang(), getJson })
          const described = new Map((await withDescriptions([...found.sure.values()], getJson)).map((c) => [c.id, c]))
          const entries = games.flatMap((g) => {
            const match = described.get(found.sure.get(g.id)?.id ?? '')
            return match ? [{ path: g.path, name: g.name, info: match.info }] : []
          })
          result.saved += await this.#write(platform.id, entries)
          unsure.push(...found.unsure)
          result.unsure += found.unsure.length
          result.notFound += found.notFound.length
        } catch (e) {
          result.failed.push(platform.id)
          diagnostics.log(
            'info',
            t('{console}: no se pudo buscar la información ({error})', {
              console: platform.shortName,
              error: e instanceof Error ? e.message : String(e),
            }),
          )
        }
        this.finding = { ...this.finding, done: this.finding.done + 1 }
      }
      // A search of every console replaces the list; one of a few consoles adds to it
      const searched = new Set(consoles.map((p) => p.id))
      const kept = every ? [] : (this.pendingIds ?? []).filter((id) => !searched.has(library.byId.get(id)?.system ?? ''))
      this.pendingIds = [...kept, ...unsure]
      this.result = result
      diagnostics.log(
        'info',
        t('Información de los juegos: {saved} guardados, {unsure} por elegir, {notFound} sin encontrar', {
          saved: result.saved,
          unsure: result.unsure,
          notFound: result.notFound,
        }),
      )
      return result
    } finally {
      this.finding = null
    }
  }

  /** The consoles that couldn't be searched, by name @param {string[]} ids */
  consoleNames(ids) {
    return ids.map((id) => getPlatform(id)?.shortName ?? id)
  }
}

export const gameInfo = new GameInfo()
