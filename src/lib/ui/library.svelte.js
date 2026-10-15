/**
 * Estado compartido de la biblioteca (runes de Svelte 5).
 *
 * La biblioteca se arma con dos fuentes:
 *   - lo que hay en roms\<consola>\ (el escaneo), que se GUARDA para abrir al
 *     instante la próxima vez, y se actualiza desde Opciones consola por consola;
 *   - los gamelists de ES-DE (opcionales), que se leen en cada inicio porque
 *     son pocos archivos.
 */
import { loadLibrary, scanRoms } from '../core/bridge.js'
import { mediaUrl, parseGamelist, romAbsolutePath } from '../core/esde.js'
import { getPlatform, PLATFORMS } from '../core/platforms.js'
import { gamesFromFiles, mergeWithGamelist } from '../core/scan.js'
import { load, save } from './storage.js'

/** @typedef {import('../core/esde.js').Game & { cover?: string }} LibraryGame */
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
  /** Último escaneo de cada consola: la "lista guardada" */
  /** @type {Record<string, SavedScan>} */
  scans = $state({})
  /** Consolas que se están escaneando en este momento */
  /** @type {string[]} */
  scanning = $state([])
  /** Avance del primer escaneo, para la pantalla de carga */
  /** @type {{ name: string, current: number, total: number } | null} */
  progress = $state(null)
  /** @type {Record<string, LibraryGame[]>} */
  bySystem = $state({})
  /** Favoritos marcados o desmarcados desde Relix (pisan el valor de ES-DE) */
  /** @type {Record<string, boolean>} */
  favoriteOverrides = $state(load('favorites', {}))
  /** @type {string[]} */
  recentIds = $state(load('recent', []))

  all = $derived(Object.values(this.bySystem).flat())

  favorites = $derived(this.all.filter((g) => this.isFavorite(g)))

  recent = $derived(
    this.recentIds.map((id) => this.all.find((g) => g.id === id)).filter((g) => g !== undefined),
  )

  // Datos del inicio que no cambian al re-escanear
  /** @type {Record<string, import('../core/esde.js').Game[]>} */
  #listed = {}
  /** @type {string|null} */
  #mediaBase = null
  #driveId = ''

  async load() {
    this.status = 'loading'
    this.progress = null
    try {
      const raw = await loadLibrary()
      this.romRoot = raw.romRoot
      this.#mediaBase = raw.mediaBase
      this.#driveId = raw.driveId
      this.#listed = Object.fromEntries(
        PLATFORMS.map((p) => {
          const xml = raw.gamelists[p.id]
          return [p.id, xml ? parseGamelist(xml, p.id, { includeHidden: true }) : []]
        }),
      )

      // La lista guardada solo vale para el mismo disco
      const cache = /** @type {ScanCache|null} */ (load(SCANS_KEY, null))
      this.scans = cache && cache.driveId === raw.driveId ? cache.systems : {}

      // Primera vez o disco nuevo: se escanean las consolas que no tienen lista,
      // de a una para mostrar el avance en la pantalla de carga
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
   * Vuelve a escanear consolas y cuenta qué cambió en cada una.
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

  /** Arma los juegos de cada consola con el escaneo guardado y ES-DE */
  #rebuild() {
    /** @type {Record<string, LibraryGame[]>} */
    const bySystem = {}
    for (const p of PLATFORMS) {
      const listed = this.#listed[p.id] ?? []
      const scan = this.scans[p.id]
      const games = scan
        ? mergeWithGamelist(listed, gamesFromFiles(scan.files, p))
        : listed.filter((g) => !g.hidden)
      bySystem[p.id] = games.map((g) => ({
        ...g,
        cover: this.#mediaBase ? mediaUrl(this.#mediaBase, g, 'covers') : undefined,
      }))
    }
    this.bySystem = bySystem
  }

  /** @param {string} systemId  id de consola o 'favorites' */
  gamesFor(systemId) {
    return systemId === 'favorites' ? this.favorites : (this.bySystem[systemId] ?? [])
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
    this.recentIds = [game.id, ...this.recentIds.filter((id) => id !== game.id)].slice(0, MAX_RECENT)
    save('recent', this.recentIds)
  }

  /** @param {string} systemId  carpeta donde Relix busca los juegos de esa consola */
  romFolderPath(systemId) {
    const folder = this.scans[systemId]?.folder ?? getPlatform(systemId)?.folders[0] ?? systemId
    return `${this.romRoot}\\${folder}`
  }

  /** @param {LibraryGame} game */
  romPath(game) {
    return romAbsolutePath(this.romRoot, game, this.scans[game.system]?.folder)
  }
}

export const library = new Library()
