/**
 * Renaming games' files (Y › Rename file…, and Options › Library › File names).
 *
 *   suggestionsFor(game)  standard names from libretro (the same list as the covers),
 *                         each with its cover so you can tell the right one
 *   prepare(game, name)   the plan (core/rename.js) and what the shell would move;
 *                         nothing changes yet
 *   rename(game, plan)    does it: the shell renames on the USB drive and only if that
 *                         worked, Relix moves its own data, the collections and the library
 *   findReview()          the games whose file doesn't have a standard name, for the list
 *                         in Options (it needs libretro's lists: internet, once a month)
 */
import { renameGame } from '../core/bridge.js'
import { coverQuery, matchCover, nameCandidates, remoteCoverUrl } from '../core/coverMatch.js'
import { getPlatform, PLATFORMS } from '../core/platforms.js'
import { planRename, RENAME_ERRORS, RENAME_STEPS, renameInUserData, renameTarget } from '../core/rename.js'
import { t } from '../i18n/i18n.svelte.js'
import { collections } from './collections.svelte.js'
import { covers } from './covers.svelte.js'
import { diagnostics } from './diagnostics.svelte.js'
import { emulators } from './emulators.svelte.js'
import { library } from './library.svelte.js'
import { settings } from './settings.svelte.js'
import { changeSynced, load, onReplaced, readSynced, save } from './storage.js'

/**
 * @typedef {import('./library.svelte.js').LibraryGame} LibraryGame
 * @typedef {import('../core/rename.js').RenamePlan} RenamePlan
 * @typedef {import('../core/bridge.js').RenameResult} RenameResult
 * @typedef {import('../core/coverMatch.js').CoverCandidate & { libretro: string, url: string }} NameSuggestion
 * @typedef {{ plan: RenamePlan, preview: RenameResult, collections: number, retroarch: boolean }} PreparedRename
 *   collections: how many of your collections have the game; retroarch: it opens with RetroArch
 */

class Renamer {
  /** Games you chose to keep with their name: they leave the Options list */
  /** @type {string[]} */
  skipped = $state(load('renameSkipped', []))
  /** The games without a standard name (ids); null until it's looked up */
  /** @type {string[] | null} */
  review = $state(null)
  /** The lookup is running: how many consoles are done out of how many */
  /** @type {{ done: number, total: number } | null} */
  reviewing = $state(null)
  /** Consoles whose list couldn't be read (without internet, say) */
  /** @type {string[]} */
  reviewFailed = $state([])

  /** The list for Options: still there, not kept as they were */
  pending = $derived(
    (this.review ?? [])
      .map((id) => library.byId.get(id))
      .filter((g) => g !== undefined && !this.skipped.includes(g.id)),
  )

  constructor() {
    // Your data arrived from the USB drive: it's read again
    onReplaced(() => {
      this.skipped = load('renameSkipped', [])
    })
  }

  /**
   * Standard names for a game, the most likely first.
   * @param {LibraryGame} game
   * @returns {Promise<NameSuggestion[]>}
   */
  async suggestionsFor(game) {
    const platform = getPlatform(game.system)
    if (!platform) return []
    const index = await covers.index(platform)
    const current = coverQuery(game)
    return nameCandidates(current, index, { region: settings.coverRegion, altTitle: game.name, limit: 8 })
      .filter((c) => c.name !== current)
      .map((c) => ({ ...c, url: remoteCoverUrl(platform.libretro, c.libretro) }))
  }

  /**
   * What's wrong with a name for a game's file, in words; null if it can be used.
   * It doesn't ask the shell (that's prepare()): it's for checking while typing.
   * The name it already has isn't an error here: the keyboard starts with it.
   * @param {LibraryGame} game
   * @param {string} name
   */
  check(game, name) {
    const result = planRename(game, name, library.scans[game.system]?.files ?? [game.path])
    return result.error && result.error !== 'same' ? t(RENAME_ERRORS[result.error]) : null
  }

  /**
   * The plan for a new name and what would move with it. Nothing changes yet.
   * @param {LibraryGame} game
   * @param {string} name
   * @returns {Promise<PreparedRename>}  it throws with the reason if the name can't be used
   */
  async prepare(game, name) {
    const files = library.scans[game.system]?.files ?? [game.path]
    const result = planRename(game, name, files)
    if (result.error) throw new Error(t(RENAME_ERRORS[result.error]))
    const preview = await renameGame(game.system, library.folderOf(game.system), result.plan, { preview: true })
    return {
      plan: result.plan,
      preview,
      collections: collections.namesFor(game).length,
      retroarch: emulators.forGame(game)?.launcher.kind === 'retroarch',
    }
  }

  /**
   * Renames the game. The shell goes first: if the game can't be renamed on the
   * USB drive, it throws and nothing changes. After that, Relix's own data moves.
   * @param {LibraryGame} game  as it is now
   * @param {RenamePlan} plan
   * @returns {Promise<RenameResult & { id: string }>}  id: the game's new id
   */
  async rename(game, plan) {
    const result = await renameGame(game.system, library.folderOf(game.system), plan)
    const id = `${game.system}/${plan.newPath}`
    const consoleName = getPlatform(game.system)?.shortName ?? game.system
    const from = renameTarget(game).name
    const to = renameTarget({ path: plan.newPath }).name
    diagnostics.log('rename', t('{console}: {from} → {to}', { console: consoleName, from, to }))
    /** @param {string} step @param {string} error */
    const logFailed = (step, error) =>
      diagnostics.log(
        'error',
        t('Al renombrar {game} no se pudo mover {what}: {error}', {
          game: to,
          what: t(RENAME_STEPS[/** @type {keyof typeof RENAME_STEPS} */ (step)] ?? step),
          error,
        }),
      )
    for (const error of result.errors ?? []) {
      const at = error.indexOf(': ')
      logFailed(at > 0 ? error.slice(0, at) : '', at > 0 ? error.slice(at + 2) : error)
    }
    let failed = result.failed
    try {
      await collections.renameGame(game, plan.newPath)
    } catch (e) {
      failed++
      logFailed('collections', e instanceof Error ? e.message : String(e))
    }
    changeSynced(renameInUserData(readSynced(), game.id, id))
    await library.applyRename(game.system, plan)
    // It has the name you chose now: it leaves the Options list
    if (this.review) this.review = this.review.filter((other) => other !== game.id)
    return { ...result, failed, id }
  }

  /**
   * Keeps a game with the name it has: it leaves the Options list.
   * @param {LibraryGame} game
   */
  skip(game) {
    if (this.skipped.includes(game.id)) return
    this.skipped = [...this.skipped, game.id]
    save('renameSkipped', this.skipped)
  }

  /** Looks for the games whose file doesn't have a standard name, console by console. */
  async findReview() {
    if (this.reviewing) return
    const platforms = PLATFORMS.filter((p) => library.gamesFor(p.id).length > 0)
    this.reviewing = { done: 0, total: platforms.length }
    this.reviewFailed = []
    /** @type {string[]} */
    const ids = []
    try {
      for (const platform of platforms) {
        try {
          const index = await covers.index(platform)
          for (const game of library.gamesFor(platform.id)) {
            const query = coverQuery(game)
            if (matchCover(query, index)?.how === 'exact') continue
            const options = { region: settings.coverRegion, altTitle: game.name, limit: 1 }
            if (nameCandidates(query, index, options).length > 0) ids.push(game.id)
          }
        } catch {
          this.reviewFailed = [...this.reviewFailed, platform.id]
        }
        this.reviewing = { done: this.reviewing.done + 1, total: platforms.length }
      }
      this.review = ids
    } finally {
      this.reviewing = null
    }
  }
}

export const renamer = new Renamer()
