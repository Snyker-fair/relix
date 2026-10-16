/**
 * Qué canales se muestran en el inicio y en las pestañas de la biblioteca, y
 * qué juegos tiene cada uno.
 *
 * Por defecto solo los que tienen algo: las consolas con juegos, Favoritos
 * cuando hay al menos uno y Colecciones cuando hay alguna. En Opciones se
 * pueden mostrar también los vacíos.
 */
import { CHANNELS, COLLECTION_PREFIX, COLLECTIONS, collectionChannel, isCollectionId } from './channels.js'
import { collections } from './collections.svelte.js'
import { library } from './library.svelte.js'
import { settings } from './settings.svelte.js'

class Shelf {
  channels = $derived(CHANNELS.filter((ch) => settings.showEmptyConsoles || this.gamesFor(ch.id).length > 0))

  /** Consolas que quedaron ocultas por no tener juegos */
  hiddenCount = $derived(CHANNELS.length - this.channels.length)

  /**
   * Pestañas de la biblioteca: dentro de una colección, las colecciones;
   * si no, los canales del inicio (sin el canal Colecciones).
   * @param {string} id  canal abierto
   */
  tabsFor(id) {
    if (isCollectionId(id)) return collections.visible.map((c) => collectionChannel(c.name))
    return this.channels.filter((ch) => ch.id !== COLLECTIONS.id)
  }

  /**
   * Datos del canal (nombre y colores), también para una colección.
   * @param {string} id
   */
  channelFor(id) {
    if (isCollectionId(id)) return collectionChannel(id.slice(COLLECTION_PREFIX.length))
    return CHANNELS.find((c) => c.id === id) ?? CHANNELS[0]
  }

  /**
   * Juegos de un canal: consola, Favoritos, una colección o todas las colecciones.
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
