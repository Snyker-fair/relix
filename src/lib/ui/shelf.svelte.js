/**
 * Which channels show on the home screen and in the library's tabs, and
 * which games each one has.
 *
 * By default only the ones with something: the consoles with games, Favorites
 * when there's at least one and Collections when there's any. In Options the
 * empty ones can be shown too. The consoles go in the order chosen in Options ›
 * Consoles (core/consoleOrder.js).
 */
import { orderConsoles } from '../core/consoleOrder.js'
import { PLATFORMS } from '../core/platforms.js'
import { CHANNELS, COLLECTION_PREFIX, COLLECTIONS, collectionChannel, FAVORITES, isCollectionId } from './channels.js'
import { collections } from './collections.svelte.js'
import { library } from './library.svelte.js'
import { settings } from './settings.svelte.js'

class Shelf {
  /** Every console, in the chosen order */
  consoles = $derived(orderConsoles(PLATFORMS, settings.consoleOrder))

  channels = $derived(
    [FAVORITES, COLLECTIONS, ...this.consoles].filter((ch) => settings.showEmptyConsoles || this.gamesFor(ch.id).length > 0),
  )

  /** Consoles that ended up hidden for having no games */
  hiddenCount = $derived(CHANNELS.length - this.channels.length)

  /**
   * The library's tabs: inside a collection, the collections;
   * otherwise, the home screen's channels (without the Collections channel).
   * @param {string} id  the open channel
   */
  tabsFor(id) {
    if (isCollectionId(id)) return collections.visible.map((c) => collectionChannel(c.name))
    return this.channels.filter((ch) => ch.id !== COLLECTIONS.id)
  }

  /**
   * The channel's data (name and colors), also for a collection.
   * @param {string} id
   */
  channelFor(id) {
    if (isCollectionId(id)) return collectionChannel(id.slice(COLLECTION_PREFIX.length))
    return CHANNELS.find((c) => c.id === id) ?? CHANNELS[0]
  }

  /**
   * A channel's games: a console, Favorites, a collection or every collection.
   * @param {string} id
   */
  gamesFor(id) {
    if (isCollectionId(id)) return collections.gamesIn(id.slice(COLLECTION_PREFIX.length))
    if (id === COLLECTIONS.id) {
      const seen = new Map()
      for (const c of collections.visible) for (const g of collections.gamesIn(c.name)) seen.set(g.id, g)
      return [...seen.values()]
    }
    return library.gamesFor(id)
  }
}

export const shelf = new Shelf()
