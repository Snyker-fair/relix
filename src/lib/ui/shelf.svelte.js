/**
 * Qué canales se muestran en el inicio y en las pestañas de la biblioteca.
 *
 * Por defecto solo los que tienen algo: las consolas con juegos y Favoritos
 * cuando hay al menos uno. En Opciones se pueden mostrar también los vacíos.
 */
import { CHANNELS } from './channels.js'
import { library } from './library.svelte.js'
import { settings } from './settings.svelte.js'

class Shelf {
  channels = $derived(
    CHANNELS.filter((ch) => settings.showEmptyConsoles || library.gamesFor(ch.id).length > 0),
  )

  /** Consolas que quedaron ocultas por no tener juegos */
  hiddenCount = $derived(CHANNELS.length - this.channels.length)
}

export const shelf = new Shelf()
