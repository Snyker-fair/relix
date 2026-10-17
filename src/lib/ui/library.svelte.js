/**
 * Estado compartido de la biblioteca (runes de Svelte 5).
 *
 * La biblioteca se arma con dos fuentes:
 *   - lo que hay en roms\<consola>\ (el escaneo), que se GUARDA para abrir al
 *     instante la próxima vez, y se actualiza desde Opciones consola por consola;
 *   - los gamelists de ES-DE (opcionales), que se leen en cada inicio porque
 *     son pocos archivos.
 *
 * Las portadas están en ES-DE/downloaded_media/<consola>/covers/, con el
 * nombre del juego. El shell dice cuáles hay; así la interfaz solo pide las
 * que existen y sabe cuántas faltan. Lo mismo con los fondos (fanart,
 * capturas), los logos y los videos, que se leen después de abrir.
 */
import { coverUrls, listCovers, listMedia, loadLibrary, mediaFileUrl, scanRoms } from '../core/bridge.js'
import { coverKey } from '../core/coverMatch.js'
import { mediaUrl, parseGamelist, romAbsolutePath } from '../core/esde.js'
import { indexMedia, pickMedia } from '../core/media.js'
import { getPlatform, PLATFORMS } from '../core/platforms.js'
import { gamesFromFiles, mergeWithGamelist } from '../core/scan.js'
import { closeSession } from '../core/userData.js'
import { load, onReplaced, save } from './storage.js'

/**
 * @typedef {import('../core/esde.js').Game & {
 *   cover?: string, thumb?: string, background?: string, backgroundKind?: string, logo?: string, video?: string
 * }} LibraryGame
 *   cover: portada original (panel de detalle); thumb: miniatura (grilla);
 *   background: fanart o captura (panel y protector); backgroundKind: de qué carpeta salió
 *   (fanart, screenshots, titlescreens); logo: el de ES-DE; video: vista previa
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
  /** Portadas que hay en el USB, por consola: ["Okami (USA).png", ...] */
  /** @type {Record<string, string[]>} */
  coverFiles = $state({})
  /** Fondos, logos y videos en el USB, por consola y tipo (ver core/media.js) */
  /** @type {Record<string, import('../core/media.js').MediaFiles>} */
  mediaFiles = $state({})
  /** Juegos ocultos desde el menú del juego (BIOS, demos, duplicados...) */
  /** @type {string[]} */
  hiddenIds = $state(load('hidden', []))
  /** Cuándo se jugó cada juego por última vez (para ordenar por recientes) */
  /** @type {Record<string, number>} */
  lastPlayed = $state(load('lastPlayed', {}))
  /** Tiempo jugado y partidas de cada juego */
  /** @type {Record<string, import('../core/userData.js').PlayStats>} */
  playtime = $state(load('playtime', {}))

  /** Lo que se muestra: todo menos los ocultos */
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

  /** Por id en minúsculas (las colecciones de ES-DE no distinguen mayúsculas) */
  /** @type {Map<string, LibraryGame>} */
  byKey = $derived(new Map(this.all.map((g) => [g.id.toLowerCase(), g])))

  /** Carpeta en minúsculas -> consola: "ps1" -> "psx" (para leer colecciones) */
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

  // Datos del inicio que no cambian al re-escanear
  /** @type {Record<string, import('../core/esde.js').Game[]>} */
  #listed = {}
  /** @type {string|null} */
  #mediaBase = null
  /** @type {string|null} */
  #thumbBase = null
  /** El shell manda la lista de portadas (si es una versión anterior, no) */
  #knowsCovers = false
  #driveId = ''
  /** Portadas reemplazadas desde Relix: cambia la URL para no ver la anterior guardada */
  /** @type {Record<string, number>} */
  #coverRevisions = load('coverRevisions', {})

  constructor() {
    // Llegaron tus datos del USB: se vuelven a leer
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

  /** Arma los juegos de cada consola con el escaneo guardado, ES-DE y las portadas */
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
   * @param {Map<string, string>} covers  portadas de su consola por clave en minúsculas
   */
  #coverFor(game, covers) {
    if (!this.#knowsCovers) {
      // Shell anterior: se pide la portada sin saber si existe (el shell prueba extensiones)
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
   * Fondo, logo y video de un juego (undefined si no tiene).
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
   * Lee qué fondos, logos y videos hay en el USB. Va después de abrir, para no
   * demorar el inicio; un shell anterior no lo sabe hacer y queda sin ellos.
   * @param {string[]} [systemIds]
   */
  async loadMedia(systemIds = PLATFORMS.map((p) => p.id)) {
    try {
      const files = await listMedia(systemIds)
      this.mediaFiles = { ...this.mediaFiles, ...files }
      this.#rebuild()
    } catch {
      // sin fondos ni videos: el panel muestra la portada, como antes
    }
  }

  /**
   * Vuelve a leer qué portadas hay (después de descargar).
   * @param {string[]} systemIds
   * @param {string[]} [changedKeys]  portadas recién reemplazadas (coverKey de cada juego)
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
   * Cuántos juegos de una consola tienen portada.
   * @param {string} systemId
   */
  coverCount(systemId) {
    const games = this.gamesFor(systemId)
    return { withCover: games.filter((g) => g.cover).length, total: games.length }
  }

  /** @param {string} systemId  id de consola o 'favorites' */
  gamesFor(systemId) {
    return systemId === 'favorites' ? this.favorites : (this.visibleBySystem[systemId] ?? [])
  }

  /** @param {LibraryGame} game */
  hide(game) {
    if (this.hiddenIds.includes(game.id)) return
    this.hiddenIds = [...this.hiddenIds, game.id]
    save('hidden', this.hiddenIds)
  }

  /** Vuelve a mostrar todos los juegos ocultos */
  unhideAll() {
    this.hiddenIds = []
    save('hidden', this.hiddenIds)
  }

  /** Ocultos que siguen existiendo en el USB */
  hiddenCount() {
    const hidden = new Set(this.hiddenIds)
    return Object.values(this.bySystem).flat().filter((g) => hidden.has(g.id)).length
  }

  /** @param {string} systemId  carpeta real de la consola dentro de roms ("ps1", "psx"...) */
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
   * Empieza a contar una partida. Queda guardada: si la Xbox cierra Relix
   * mientras juegas, se cierra igual la próxima vez que abra.
   * @param {LibraryGame} game
   */
  startSession(game) {
    save('session', { id: game.id, startedAt: Date.now() })
  }

  /**
   * Volviste a Relix: cierra la partida en curso y suma su tiempo
   * (las de menos de 1 minuto o más de 12 horas no cuentan).
   * @param {boolean} [count]  false = descartarla (el emulador no abrió)
   * @returns {{ id: string, seconds: number, elapsed: number } | null}
   *   seconds: lo que se sumó; elapsed: cuánto pasó desde que se lanzó.
   *   null si no había partida.
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
      // Por si Relix se cerró antes de anotarla como reciente
      if ((this.lastPlayed[session.id] ?? 0) < session.startedAt) this.#markPlayed(session.id, session.startedAt)
    }
    return { id: session.id, seconds, elapsed }
  }

  /** @param {string} systemId  carpeta donde Relix busca los juegos de esa consola */
  romFolderPath(systemId) {
    return `${this.romRoot}\\${this.folderOf(systemId)}`
  }

  /** @param {LibraryGame} game */
  romPath(game) {
    return romAbsolutePath(this.romRoot, game, this.scans[game.system]?.folder)
  }
}

export const library = new Library()
