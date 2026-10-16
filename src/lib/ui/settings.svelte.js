/**
 * Preferencias del jugador, guardadas en el almacenamiento de la app.
 */
import { REGION_PREFERENCES } from '../core/coverMatch.js'
import { sound } from './sound.js'
import { load, save } from './storage.js'

const KEY = 'settings'

/** @typedef {import('../core/coverMatch.js').RegionPreference} RegionPreference */
const REGIONS = /** @type {RegionPreference[]} */ (Object.keys(REGION_PREFERENCES))

class Settings {
  /** Mostrar en el inicio las consolas sin juegos */
  showEmptyConsoles = $state(false)
  /** Sonidos de la interfaz */
  sounds = $state(true)
  /** Región de las portadas cuando el archivo no dice la suya */
  /** @type {RegionPreference} */
  coverRegion = $state('usa')

  constructor() {
    const saved = load(KEY, {})
    this.showEmptyConsoles = saved.showEmptyConsoles ?? false
    this.sounds = saved.sounds ?? true
    this.coverRegion = REGIONS.includes(saved.coverRegion) ? saved.coverRegion : 'usa'
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

  #save() {
    save(KEY, {
      showEmptyConsoles: this.showEmptyConsoles,
      sounds: this.sounds,
      coverRegion: this.coverRegion,
    })
  }
}

export const settings = new Settings()
