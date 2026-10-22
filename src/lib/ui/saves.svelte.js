/**
 * RetroArch's saves on the USB drive, for the game sheet (core/saves.js). The list is
 * read the first time a sheet opens and again when you come back from a game (you
 * may have saved); until a sheet is opened, nothing is read.
 */
import { listSaves } from '../core/bridge.js'
import { indexSaves, savesFor } from '../core/saves.js'

class Saves {
  /** The saves by game; null until it's read */
  /** @type {Map<string, import('../core/saves.js').SaveEntry[]> | null} */
  index = $state(null)
  /** RetroArch's saves or states folder is on the USB drive */
  found = $state(false)
  #base = ''
  /** @type {Promise<void> | null} */
  #reading = null

  /** Reads the list, once (it doesn't fail: without an answer, the sheet doesn't show saves) */
  load() {
    this.#reading ??= listSaves()
      .then((list) => {
        this.found = list.found
        this.#base = list.base
        this.index = indexSaves(list.files)
      })
      .catch(() => {
        this.#reading = null
      })
    return this.#reading
  }

  /** Back from a game: if the list was already read, it's read again */
  refresh() {
    if (!this.#reading) return
    this.#reading = null
    this.load()
  }

  /** @param {{ path: string }} game */
  forGame(game) {
    return this.index ? savesFor(game, this.index) : null
  }

  /**
   * The address of a save's picture ('' in the demo). The date goes in the address:
   * when you save again, the new one is shown.
   * @param {import('../core/saves.js').SaveFile} picture
   */
  pictureUrl(picture) {
    if (!this.#base) return ''
    return `${this.#base}/${picture.path.split('/').map(encodeURIComponent).join('/')}?v=${picture.modified}`
  }
}

export const saves = new Saves()
