/**
 * Preferencias del jugador, guardadas en el almacenamiento de la app.
 */
import { sound } from './sound.js'
import { load, save } from './storage.js'

const KEY = 'settings'

class Settings {
  /** Mostrar en el inicio las consolas sin juegos */
  showEmptyConsoles = $state(false)
  /** Sonidos de la interfaz */
  sounds = $state(true)

  constructor() {
    const saved = load(KEY, {})
    this.showEmptyConsoles = saved.showEmptyConsoles ?? false
    this.sounds = saved.sounds ?? true
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

  #save() {
    save(KEY, { showEmptyConsoles: this.showEmptyConsoles, sounds: this.sounds })
  }
}

export const settings = new Settings()
