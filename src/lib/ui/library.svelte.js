/**
 * The library's shared state (Svelte 5 runes).
 *
 * The library is built from two sources:
 *   - what's in roms\<console>\ (the scan), which is SAVED to open
 *     instantly next time, and updated from Options console by console;
 *   - ES-DE's gamelists (optional), which are read on every start because
 *     they're few files.
 *
 * The covers are in ES-DE/downloaded_media/<console>/covers/, with the
 * game's name. The shell says which ones there are; that way the interface only
 * asks for the ones that exist and knows how many are missing. The same with the
 * backgrounds (fan art, screenshots), the logos and the videos, which are read after opening.
 */
import { coverUrls, listCovers, listMedia, loadLibrary, mediaFileUrl, scanRoms } from '../core/bridge.js'
import { coverKey } from '../core/coverMatch.js'
import { mediaUrl, parseGamelist, romAbsolutePath } from '../core/esde.js'
import { indexMedia, pickMedia } from '../core/media.js'
import { getPlatform, PLATFORMS } from '../core/platforms.js'
import { movedPath } from '../core/rename.js'
import { gamesFromFiles, mergeWithGamelist } from '../core/scan.js'
import { closeSession } from '../core/userData.js'
import { load, onReplaced, save } from './storage.js'

/**
 * @typedef {import('../core/esde.js').Game & {
 *   cover?: string, thumb?: string, background?: string, backgroundKind?: string, logo?: string, video?: string
 * }} LibraryGame
 *   cover: the original cover (detail panel); thumb: the thumbnail (grid);
 *   background: fan art or screenshot (panel and screensaver); backgroundKind: which folder it came from
 *   (fanart, screenshots, titlescreens); logo: ES-DE's; video: the preview
 */
/** @typedef {{ folder: string, files: string[], scannedAt: number }} SavedScan */
/** @typedef {{ driveId: string, systems: Record<string, SavedScan> }} ScanCache */
/** @typedef {{ id: string, added: number, removed: number, total: number }} ScanChange */

const MAX_RECENT = 10
const SCANS_KEY = 'scans'

class Library {
  /** @type {'loading'|'ready'|'error'} */
  status = $state('loading')
  error = $state('')
  romRoot = $state('')
  /** Each console's last scan: the "saved list" */
  /** @type {Record<string, SavedScan>} */
  scans = $state({})
  /** Consoles being scanned right now */
  /** @type {string[]} */
  scanning = $state([])
  /** The first scan's progress, for the loading screen */
  /** @type {{ name: string, current: number, total: number } | null} */
  progress = $state(null)
  /** @type {Record<string, LibraryGame[]>} */
  bySystem = $state({})
  /** Favorites set or unset from Relix (they override ES-DE's value) */
  /** @type {Record<string, boolean>} */
  favoriteOverrides = $state(load('favorites', {}))
  /** @type {string[]} */
  recentIds = $state(load('recent', []))
  /** The covers on the USB drive, by console: ["Okami (USA).png", ...] */
  /** @type {Record<string, string[]>} */
  coverFiles = $state({})
  /** Backgrounds, logos and videos on the USB drive, by console and type (see core/media.js) */
  /** @type {Record<string, import('../core/media.js').MediaFiles>} */
  mediaFiles = $state({})
  /** Games hidden from the game menu (BIOS files, demos, duplicates...) */
  /** @type {string[]} */
  hiddenIds = $state(load('hidden', []))
  /** When each game was last played (to sort by recent) */
  /** @type {Record<string, number>} */
  lastPlayed = $state(load('lastPlayed', {}))
  /** Each game's time played and sessions */
  /** @type {Record<string, import('../core/userData.js').PlayStats>} */
  playtime = $state(load('playtime', {}))

  /** What's shown: everything but the hidden ones */
  /** @type {Record<string, LibraryGame[]>} */
  visibleBySystem = $derived.by(() => {
    const hidden = new Set(this.hiddenIds)
    return Object.fromEntries(
      Object.entries(this.bySystem).map(([id, games]) => [id, games.filter((g) => !hidden.has(g.id))]),
    )
  })

  all = $derived(Object.values(this.visibleBySystem).flat())

  /** @type {Map<string, LibraryGame>} */
  byId = $derived(new Map(this.all.map((g) => [g.id, g])))

  /** By lowercase id (ES-DE's collections are case-insensitive) */
  /** @type {Map<string, LibraryGame>} */
  byKey = $derived(new Map(this.all.map((g) => [g.id.toLowerCase(), g])))

  /** Lowercase folder -> console: "ps1" -> "psx" (to read collections) */
  /** @type {Map<string, string>} */
  folderToSystem = $derived.by(() => {
    const map = new Map()
    for (const p of PLATFORMS) {
      for (const folder of p.folders) map.set(folder.toLowerCase(), p.id)
      const scanned = this.scans[p.id]?.folder
      if (scanned) map.set(scanned.toLowerCase(), p.id)
    }
    return map
  })

  favorites = $derived(this.all.filter((g) => this.isFavorite(g)))

  recent = $derived(this.recentIds.map((id) => this.byId.get(id)).filter((g) => g !== undefined))

  // Startup data that doesn't change when scanning again
  /** @type {Record<string, import('../core/esde.js').Game[]>} */
  #listed = {}
  /** @type {string|null} */
  #mediaBase = null
  /** @type {string|null} */
  #thumbBase = null
  /** The shell sends the list of covers (an older version doesn't) */
  #knowsCovers = false
  #driveId = ''
  /** Covers replaced from Relix: the URL changes so the old saved one doesn't show */
  /** @type {Record<string, number>} */
  #coverRevisions = load('coverRevisions', {})

  constructor() {
    // Your data arrived from the USB drive: they're read again
    onReplaced(() => {
      this.favoriteOverrides = load('favorites', {})
      this.recentIds = load('recent', [])
      this.hiddenIds = load('hidden', [])
      this.lastPlayed = load('lastPlayed', {})
      this.playtime = load('playtime', {})
    })
  }

  async load() {
    this.status = 'loading'
    this.progress = null
    try {
      const raw = await loadLibrary()
      this.romRoot = raw.romRoot
      this.#mediaBase = raw.mediaBase
      this.#thumbBase = raw.thumbBase ?? null
      this.#knowsCovers = raw.covers !== undefined
      this.coverFiles = raw.covers ?? {}
      this.#driveId = raw.driveId
      this.#listed = Object.fromEntries(
        PLATFORMS.map((p) => {
          const xml = raw.gamelists[p.id]
          return [p.id, xml ? parseGamelist(xml, p.id, { includeHidden: true }) : []]
        }),
      )

      // The saved list is only valid for the same drive
      const cache = /** @type {ScanCache|null} */ (load(SCANS_KEY, null))
      this.scans = cache && cache.driveId === raw.driveId ? cache.systems : {}

      // The first time or a new drive: the consoles without a list are scanned,
      // one at a time to show the progress on the loading screen
      const missing = PLATFORMS.filter((p) => !this.scans[p.id])
      for (const [i, p] of missing.entries()) {
        this.progress = { name: p.shortName, current: i + 1, total: missing.length }
        await this.#scan([p.id])
      }
      this.progress = null

      this.#rebuild()
      this.status = 'ready'
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)
      this.status = 'error'
    }
  }

  /**
   * Demo in the browser: reads the test gamelists again, which come with their
   * descriptions in the active language (with your USB drive, the gamelists are ES-DE's
   * and don't change with the language).
   */
  async reloadDemoGamelists() {
    const raw = await loadLibrary()
    this.#listed = Object.fromEntries(
      PLATFORMS.map((p) => {
        const xml = raw.gamelists[p.id]
        return [p.id, xml ? parseGamelist(xml, p.id, { includeHidden: true }) : []]
      }),
    )
    this.#rebuild()
  }

  /**
   * Scans consoles again and counts what changed in each.
   * @param {string[]} systemIds
   * @returns {Promise<ScanChange[]>}
   */
  async rescan(systemIds) {
    const before = new Map(systemIds.map((id) => [id, new Set(this.gamesFor(id).map((g) => g.id))]))
    this.scanning = systemIds
    try {
      await this.#scan(systemIds)
      this.#rebuild()
    } finally {
      this.scanning = []
    }
    return systemIds.map((id) => {
      const old = before.get(id) ?? new Set()
      const now = new Set(this.gamesFor(id).map((g) => g.id))
      return {
        id,
        added: [...now].filter((g) => !old.has(g)).length,
        removed: [...old].filter((g) => !now.has(g)).length,
        total: now.size,
      }
    })
  }

  /** @param {string[]} systemIds */
  async #scan(systemIds) {
    const roms = await scanRoms(systemIds)
    const scannedAt = Date.now()
    const next = { ...this.scans }
    for (const id of systemIds) {
      const found = roms[id]
      if (found) next[id] = { folder: found.folder, files: found.files, scannedAt }
    }
    this.scans = next
    save(SCANS_KEY, { driveId: this.#driveId, systems: next })
  }

  /** Builds each console's games from the saved scan, ES-DE and the covers */
  #rebuild() {
    /** @type {Record<string, LibraryGame[]>} */
    const bySystem = {}
    for (const p of PLATFORMS) {
      const listed = this.#listed[p.id] ?? []
      const scan = this.scans[p.id]
      const games = scan
        ? mergeWithGamelist(listed, gamesFromFiles(scan.files, p))
        : listed.filter((g) => !g.hidden)
      // "okami (usa)" -> "Okami (USA).png"
      const covers = new Map((this.coverFiles[p.id] ?? []).map((f) => [f.replace(/\.[^./]+$/, '').toLowerCase(), f]))
      const media = indexMedia(this.mediaFiles[p.id])
      bySystem[p.id] = games.map((g) => ({ ...g, ...this.#coverFor(g, covers), ...this.#mediaFor(g, media) }))
    }
    this.bySystem = bySystem
  }

  /**
   * @param {import('../core/esde.js').Game} game
   * @param {Map<string, string>} covers  its console's covers by lowercase key
   */
  #coverFor(game, covers) {
    if (!this.#knowsCovers) {
      // An older shell: the cover is asked for without knowing if it exists (the shell tries extensions)
      const cover = this.#mediaBase ? mediaUrl(this.#mediaBase, game, 'covers') : undefined
      return { cover, thumb: cover }
    }
    const key = coverKey(game).toLowerCase()
    const file = covers.get(key)
    if (!file) return { cover: undefined, thumb: undefined }

    const urls = coverUrls(game.system, file, { mediaBase: this.#mediaBase, thumbBase: this.#thumbBase })
    const revision = this.#coverRevisions[`${game.system}/${key}`]
    const suffix = revision ? `?v=${revision}` : ''
    return { cover: urls.cover && urls.cover + suffix, thumb: urls.thumb && urls.thumb + suffix }
  }

  /**
   * A game's background, logo and video (undefined if it has none).
   * @param {import('../core/esde.js').Game} game
   * @param {import('../core/media.js').MediaIndex} index
   */
  #mediaFor(game, index) {
    const { background, logo, video } = pickMedia(coverKey(game), index)
    /** @param {import('../core/media.js').MediaPick | null} pick */
    const url = (pick) => (pick ? mediaFileUrl(game.system, pick.type, pick.file, this.#mediaBase) || undefined : undefined)
    const backgroundUrl = url(background)
    return {
      background: backgroundUrl,
      backgroundKind: backgroundUrl ? background?.type : undefined,
      logo: url(logo),
      video: url(video),
    }
  }

  /**
   * Reads which backgrounds, logos and videos are on the USB drive. It goes after opening,
   * so it doesn't slow down the start; an older shell can't do it and stays without them.
   * @param {string[]} [systemIds]
   */
  async loadMedia(systemIds = PLATFORMS.map((p) => p.id)) {
    try {
      const files = await listMedia(systemIds)
      this.mediaFiles = { ...this.mediaFiles, ...files }
      this.#rebuild()
    } catch {
      // no backgrounds or videos: the panel shows the cover, as before
    }
  }

  /**
   * Reads again which covers there are (after downloading).
   * @param {string[]} systemIds
   * @param {string[]} [changedKeys]  covers just replaced (each game's coverKey)
   */
  async refreshCovers(systemIds, changedKeys = []) {
    if (changedKeys.length > 0) {
      const now = Date.now()
      for (const id of systemIds) {
        for (const key of changedKeys) this.#coverRevisions[`${id}/${key.toLowerCase()}`] = now
      }
      save('coverRevisions', this.#coverRevisions)
    }
    const files = await listCovers(systemIds)
    this.coverFiles = { ...this.coverFiles, ...files }
    this.#knowsCovers = true
    this.#rebuild()
  }

  /**
   * A console's gamelist.xml was just written (Y › Find info…): its games are
   * read again from that text, without asking the USB drive.
   * @param {string} systemId
   * @param {string} xml
   */
  applyGamelist(systemId, xml) {
    this.#listed[systemId] = parseGamelist(xml, systemId, { includeHidden: true })
    this.#rebuild()
  }

  /**
   * A game was renamed on the USB drive (see ui/renamer.svelte.js): the saved
   * scan and ES-DE's entries move to the new names without scanning again, and
   * the covers and images are read again.
   * @param {string} systemId
   * @param {import('../core/rename.js').RenamePlan} plan
   */
  async applyRename(systemId, plan) {
    const folder = plan.kind === 'folder'
    const scan = this.scans[systemId]
    if (scan) {
      const files = scan.files.map((f) => movedPath(f, plan.files.map((r) => ({ ...r, folder }))) ?? f)
      this.scans = { ...this.scans, [systemId]: { ...scan, files } }
      save(SCANS_KEY, { driveId: this.#driveId, systems: this.scans })
    }
    this.#listed[systemId] = (this.#listed[systemId] ?? []).map((g) => {
      const path = movedPath(g.path, plan.gamelist)
      return path ? { ...g, path, id: `${systemId}/${path}` } : g
    })
    try {
      await this.refreshCovers([systemId])
    } catch {
      this.#rebuild()
    }
    await this.loadMedia([systemId])
  }

  /**
   * How many of a console's games have a cover.
   * @param {string} systemId
   */
  coverCount(systemId) {
    const games = this.gamesFor(systemId)
    return { withCover: games.filter((g) => g.cover).length, total: games.length }
  }

  /** @param {string} systemId  a console id or 'favorites' */
  gamesFor(systemId) {
    return systemId === 'favorites' ? this.favorites : (this.visibleBySystem[systemId] ?? [])
  }

  /** @param {LibraryGame} game */
  hide(game) {
    if (this.hiddenIds.includes(game.id)) return
    this.hiddenIds = [...this.hiddenIds, game.id]
    save('hidden', this.hiddenIds)
  }

  /** Shows all the hidden games again */
  unhideAll() {
    this.hiddenIds = []
    save('hidden', this.hiddenIds)
  }

  /** Hidden games that still exist on the USB drive */
  hiddenCount() {
    const hidden = new Set(this.hiddenIds)
    return Object.values(this.bySystem).flat().filter((g) => hidden.has(g.id)).length
  }

  /** @param {string} systemId  the console's real folder inside roms ("ps1", "psx"...) */
  folderOf(systemId) {
    return this.scans[systemId]?.folder ?? getPlatform(systemId)?.folders[0] ?? systemId
  }

  /** @param {LibraryGame} game */
  isFavorite(game) {
    return this.favoriteOverrides[game.id] ?? game.favorite
  }

  /** @param {LibraryGame} game */
  toggleFavorite(game) {
    this.favoriteOverrides = { ...this.favoriteOverrides, [game.id]: !this.isFavorite(game) }
    save('favorites', this.favoriteOverrides)
  }

  /** @param {LibraryGame} game */
  markPlayed(game) {
    this.#markPlayed(game.id, Date.now())
  }

  /** @param {string} id @param {number} at */
  #markPlayed(id, at) {
    this.recentIds = [id, ...this.recentIds.filter((other) => other !== id)].slice(0, MAX_RECENT)
    save('recent', this.recentIds)
    this.lastPlayed = { ...this.lastPlayed, [id]: at }
    save('lastPlayed', this.lastPlayed)
  }

  /**
   * Starts counting a session. It stays saved: if the Xbox closes Relix
   * while you play, it's closed anyway the next time it opens.
   * @param {LibraryGame} game
   */
  startSession(game) {
    save('session', { id: game.id, startedAt: Date.now() })
  }

  /**
   * You're back in Relix: closes the session in progress and adds its time
   * (the ones under 1 minute or over 12 hours don't count).
   * @param {boolean} [count]  false = drop it (the emulator didn't open)
   * @returns {{ id: string, seconds: number, elapsed: number } | null}
   *   seconds: what was added; elapsed: how long since it was launched.
   *   null if there was no session.
   */
  endSession(count = true) {
    /** @type {import('../core/userData.js').Session|null} */
    const session = load('session', null)
    if (!session) return null
    save('session', null)
    const now = Date.now()
    const elapsed = Math.round((now - session.startedAt) / 1000)
    if (!count) return { id: session.id, seconds: 0, elapsed }

    const { playtime, seconds } = closeSession(this.playtime, session, now)
    if (seconds > 0) {
      this.playtime = playtime
      save('playtime', playtime)
      // In case Relix closed before noting it as recent
      if ((this.lastPlayed[session.id] ?? 0) < session.startedAt) this.#markPlayed(session.id, session.startedAt)
    }
    return { id: session.id, seconds, elapsed }
  }

  /** @param {string} systemId  the folder where Relix looks for that console's games */
  romFolderPath(systemId) {
    return `${this.romRoot}\\${this.folderOf(systemId)}`
  }

  /** @param {LibraryGame} game */
  romPath(game) {
    return romAbsolutePath(this.romRoot, game, this.scans[game.system]?.folder)
  }
}

export const library = new Library()
