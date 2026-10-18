/**
 * Looking for covers on libretro (Options › Covers).
 *
 *   find(console)   downloads the safe covers of the games that have none
 *                   and notes the ones that need the player to choose; also,
 *                   for games without a background it downloads a screenshot (Named_Snaps)
 *                   for the game panel and the screensaver
 *   pending         those games, for the "Pick a cover" screen
 *   choose / skip   pick a candidate or keep the color cover
 *
 * The internet is never used without the player asking.
 */
import { coverIndex, deleteCover, downloadCovers } from '../core/bridge.js'
import {
  buildCoverIndex,
  coverCandidates,
  coverKey,
  coverQuery,
  matchCover,
  remoteCoverUrl,
} from '../core/coverMatch.js'
import { getPlatform, PLATFORMS } from '../core/platforms.js'
import { diagnostics } from './diagnostics.svelte.js'
import { t } from '../i18n/i18n.svelte.js'
import { library } from './library.svelte.js'
import { settings } from './settings.svelte.js'
import { load, onReplaced, save } from './storage.js'

/**
 * @typedef {{ saved: number, failed: number, toChoose: number, notFound: number, shots?: number, at: number }} CoverResult
 * @typedef {{ system: string, phase: 'list'|'download'|'shots', done: number, total: number }} CoverProgress
 * @typedef {import('../core/coverMatch.js').CoverCandidate & { url: string }} PickerCandidate
 */

class Covers {
  /** The console being searched now (one at a time) */
  /** @type {string|null} */
  busy = $state(null)
  /** @type {CoverProgress|null} */
  progress = $state(null)
  /** "Search all" in progress: how many consoles are done out of how many */
  /** @type {{ done: number, total: number } | null} */
  all = $state(null)
  /** Games waiting for the player to pick their cover, by console */
  /** @type {Record<string, string[]>} */
  choices = $state(load('coverChoices', {}))
  /** Games the player chose to keep with the color cover */
  /** @type {string[]} */
  skipped = $state(load('coverSkipped', []))
  /** Each console's last result */
  /** @type {Record<string, CoverResult>} */
  results = $state(load('coverResults', {}))

  /** Games to pick: still without a cover and not kept in color */
  pending = $derived(
    PLATFORMS.flatMap((p) =>
      (this.choices[p.id] ?? [])
        .map((id) => library.byId.get(id))
        .filter((g) => g !== undefined && !g.cover && !this.skipped.includes(g.id)),
    ),
  )

  /** @type {Map<string, Promise<import('../core/coverMatch.js').CoverIndex>>} */
  #indexes = new Map()
  /** Games whose screenshot isn't on libretro: not asked for again this session */
  /** @type {Set<string>} */
  #noShot = new Set()

  constructor() {
    // Your data arrived from the USB drive: they're read again
    onReplaced(() => {
      this.choices = load('coverChoices', {})
      this.skipped = load('coverSkipped', [])
      this.results = load('coverResults', {})
    })
  }

  /**
   * A console's list of covers (asked for once per session).
   * @param {import('../core/platforms.js').Platform} platform
   */
  #index(platform) {
    let index = this.#indexes.get(platform.id)
    if (!index) {
      index = coverIndex(platform).then(buildCoverIndex)
      index.catch(() => this.#indexes.delete(platform.id)) // if it failed, it's retried next time
      this.#indexes.set(platform.id, index)
    }
    return index
  }

  /**
   * Finds and downloads a console's missing covers.
   * @param {string} systemId
   * @returns {Promise<CoverResult>}
   */
  async find(systemId) {
    const platform = getPlatform(systemId)
    if (!platform) throw new Error(t('Consola desconocida: {id}', { id: systemId }))
    const missing = library.gamesFor(systemId).filter((g) => !g.cover)
    const withoutBackground = this.#withoutBackground(systemId)

    this.busy = systemId
    this.progress = { system: systemId, phase: 'list', done: 0, total: missing.length }
    try {
      /** @type {Array<{ key: string, remote: string }>} */
      const downloads = []
      /** @type {string[]} */
      const toChoose = []
      let notFound = 0

      /** @type {Array<{ key: string, remote: string, id: string }>} */
      const shots = []
      if (missing.length > 0 || withoutBackground.length > 0) {
        const index = await this.#index(platform)
        const region = settings.coverRegion
        for (const game of missing) {
          const query = coverQuery(game)
          const match = matchCover(query, index, { region, altTitle: game.name })
          if (match) downloads.push({ key: coverKey(game), remote: match.name })
          else if (coverCandidates(query, index, { region, altTitle: game.name, limit: 1 }).length > 0) toChoose.push(game.id)
          else notFound++
        }
        // The screenshot has the same name as the cover on libretro
        for (const game of withoutBackground) {
          const match = matchCover(coverQuery(game), index, { region, altTitle: game.name })
          if (match) shots.push({ key: coverKey(game), remote: match.name, id: game.id })
        }
      }

      let saved = 0
      let failed = 0
      if (downloads.length > 0) {
        this.progress = { system: systemId, phase: 'download', done: 0, total: downloads.length }
        const result = await downloadCovers(platform, downloads, (done, total) => {
          this.progress = { system: systemId, phase: 'download', done, total }
        })
        saved = result.saved.length
        failed = result.failed.length
        await library.refreshCovers([systemId], result.saved)
      }

      // Screenshots: if libretro doesn't have a game's, it isn't an error (it isn't counted)
      let shotsSaved = 0
      if (shots.length > 0) {
        this.progress = { system: systemId, phase: 'shots', done: 0, total: shots.length }
        try {
          const result = await downloadCovers(
            platform,
            shots.map(({ key, remote }) => ({ key, remote })),
            (done, total) => (this.progress = { system: systemId, phase: 'shots', done, total }),
            'screenshots',
          )
          shotsSaved = result.saved.length
          const failedKeys = new Set(result.failed.map((f) => f.key))
          for (const shot of shots) if (failedKeys.has(shot.key)) this.#noShot.add(shot.id)
          if (shotsSaved > 0) await library.loadMedia([systemId])
        } catch {
          // An older shell (it doesn't download screenshots): only the covers are left
          for (const shot of shots) this.#noShot.add(shot.id)
        }
      }

      this.choices = { ...this.choices, [systemId]: toChoose }
      save('coverChoices', this.choices)
      /** @type {CoverResult} */
      const result = { saved, failed, toChoose: toChoose.length, notFound, shots: shotsSaved, at: Date.now() }
      this.results = { ...this.results, [systemId]: result }
      save('coverResults', this.results)
      if (result.failed > 0) {
        diagnostics.log(
          'covers',
          t('{console}: {n} no se pudieron bajar (de {total})', {
            console: platform.shortName,
            n: result.failed,
            total: result.failed + result.saved,
          }),
        )
      }
      return result
    } finally {
      this.busy = null
      this.progress = null
    }
  }

  /**
   * Games without a background (no fan art, screenshot or title screen) that
   * are still worth looking for a screenshot for.
   * @param {string} systemId
   */
  #withoutBackground(systemId) {
    return library.gamesFor(systemId).filter((g) => !g.background && !this.#noShot.has(g.id))
  }

  /**
   * Is there anything to look for on this console? (missing covers or screenshots)
   * @param {string} systemId
   */
  needsSearch(systemId) {
    const count = library.coverCount(systemId)
    return count.withCover < count.total || this.#withoutBackground(systemId).length > 0
  }

  /**
   * Searches every console that's missing covers, one after another
   * (Options › Covers and the first run).
   */
  async findAll() {
    const ids = PLATFORMS.map((p) => p.id).filter((id) => this.needsSearch(id))
    const total = { saved: 0, failed: 0, toChoose: 0, notFound: 0, shots: 0 }
    if (this.busy !== null || this.all !== null) return total
    this.all = { done: 0, total: ids.length }
    try {
      for (const [i, id] of ids.entries()) {
        const result = await this.find(id)
        total.saved += result.saved
        total.failed += result.failed
        total.toChoose += result.toChoose
        total.notFound += result.notFound
        total.shots += result.shots ?? 0
        this.all = { done: i + 1, total: ids.length }
      }
    } finally {
      this.all = null
    }
    return total
  }

  /**
   * Similar covers to pick by hand, with their URL to see them.
   * @param {import('./library.svelte.js').LibraryGame} game
   * @returns {Promise<PickerCandidate[]>}
   */
  async candidatesFor(game) {
    const platform = getPlatform(game.system)
    if (!platform) return []
    const index = await this.#index(platform)
    return coverCandidates(coverQuery(game), index, {
      region: settings.coverRegion,
      altTitle: game.name,
      limit: 6,
    }).map((c) => ({ ...c, url: remoteCoverUrl(platform.libretro, c.name) }))
  }

  /**
   * Downloads the cover chosen for a game.
   * @param {import('./library.svelte.js').LibraryGame} game
   * @param {string} remoteName  the name on libretro
   */
  async choose(game, remoteName) {
    const platform = getPlatform(game.system)
    if (!platform) return
    const key = coverKey(game)
    const result = await downloadCovers(platform, [{ key, remote: remoteName }])
    if (result.failed.length > 0) throw new Error(result.failed[0].error || t('No se pudo descargar la portada.'))
    await library.refreshCovers([game.system], [key])
  }

  /**
   * Removes a game's downloaded cover and doesn't look for it again.
   * @param {import('./library.svelte.js').LibraryGame} game
   */
  async useColor(game) {
    const key = coverKey(game)
    if (game.cover) {
      await deleteCover(game.system, key)
      await library.refreshCovers([game.system], [key])
    }
    this.skip(game)
  }

  /**
   * The player prefers the color cover for this game.
   * @param {import('./library.svelte.js').LibraryGame} game
   */
  skip(game) {
    if (this.skipped.includes(game.id)) return
    this.skipped = [...this.skipped, game.id]
    save('coverSkipped', this.skipped)
  }
}

export const covers = new Covers()
