/**
 * Preferencias del jugador, guardadas en el almacenamiento de la app.
 */
import { REGION_PREFERENCES } from '../core/coverMatch.js'
import { SORT_NAMES } from '../core/sorting.js'
import { sound } from './sound.js'
import { load, onReplaced, save } from './storage.js'

const KEY = 'settings'

/** @typedef {import('../core/coverMatch.js').RegionPreference} RegionPreference */
const REGIONS = /** @type {RegionPreference[]} */ (Object.keys(REGION_PREFERENCES))
/** @typedef {import('../core/sorting.js').SortOrder} SortOrder */
const SORTS = /** @type {SortOrder[]} */ (Object.keys(SORT_NAMES))

class Settings {
  /** Mostrar en el inicio las consolas sin juegos */
  showEmptyConsoles = $state(false)
  /** Sonidos de la interfaz */
  sounds = $state(true)
  /** Región de las portadas cuando el archivo no dice la suya */
  /** @type {RegionPreference} */
  coverRegion = $state('usa')
  /** Orden de la biblioteca (se cambia desde el menú del juego) */
  /** @type {SortOrder} */
  sortOrder = $state('az')

  constructor() {
    this.#restore()
    onReplaced(() => this.#restore())
  }

  #restore() {
    const saved = load(KEY, {})
    this.showEmptyConsoles = saved.showEmptyConsoles ?? false
    this.sounds = saved.sounds ?? true
    this.coverRegion = REGIONS.includes(saved.coverRegion) ? saved.coverRegion : 'usa'
    this.sortOrder = SORTS.includes(saved.sortOrder) ? saved.sortOrder : 'az'
    sound.setMuted(!this.sounds)
  }

  toggleEmptyConsoles() {
    this.showEmptyConsoles = !this.showEmptyConsoles
    this.#save()
  }

  toggleSounds() {
    this.sounds = !this.sounds
    sound.setMuted(!this.sounds)
    this.#save()
  }

  /** EE. UU. -> Europa -> Japón -> EE. UU. */
  cycleCoverRegion() {
    this.coverRegion = REGIONS[(REGIONS.indexOf(this.coverRegion) + 1) % REGIONS.length]
    this.#save()
  }

  /**
   * Pasa al orden siguiente entre los disponibles (Año solo si hay años).
   * @param {SortOrder[]} available
   */
  cycleSortOrder(available = SORTS) {
    const options = SORTS.filter((s) => available.includes(s))
    this.sortOrder = options[(options.indexOf(this.sortOrder) + 1) % options.length] ?? 'az'
    this.#save()
  }

  #save() {
    save(KEY, {
      showEmptyConsoles: this.showEmptyConsoles,
      sounds: this.sounds,
      coverRegion: this.coverRegion,
      sortOrder: this.sortOrder,
    })
  }
}

export const settings = new Settings()
