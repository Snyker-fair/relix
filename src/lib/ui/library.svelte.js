/**
 * Estado compartido de la biblioteca (runes de Svelte 5).
 */
import { loadLibrary } from '../core/bridge.js'
import { mediaUrl, parseGamelist, romAbsolutePath } from '../core/esde.js'
import { PLATFORMS } from '../core/platforms.js'
import { load, save } from './storage.js'

/** @typedef {import('../core/esde.js').Game & { cover?: string }} LibraryGame */

const MAX_RECENT = 10

class Library {
  /** @type {'loading'|'ready'|'error'} */
  status = $state('loading')
  error = $state('')
  romRoot = $state('')
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

  async load() {
    this.status = 'loading'
    try {
      const raw = await loadLibrary()
      /** @type {Record<string, LibraryGame[]>} */
      const bySystem = {}
      for (const p of PLATFORMS) {
        const xml = raw.gamelists[p.id]
        bySystem[p.id] = xml
          ? parseGamelist(xml, p.id).map((g) => ({
              ...g,
              cover: raw.mediaBase ? mediaUrl(raw.mediaBase, g, 'covers') : undefined,
            }))
          : []
      }
      this.romRoot = raw.romRoot
      this.bySystem = bySystem
      this.status = 'ready'
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)
      this.status = 'error'
    }
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

  /** @param {LibraryGame} game */
  romPath(game) {
    return romAbsolutePath(this.romRoot, game)
  }
}

export const library = new Library()
