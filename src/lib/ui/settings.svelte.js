/**
 * Preferencias del jugador, guardadas en el almacenamiento de la app.
 */
import { REGION_PREFERENCES } from '../core/coverMatch.js'
import { SORT_NAMES } from '../core/sorting.js'
import { sound } from './sound.js'
import { load, onReplaced, save } from './storage.js'

const KEY = 'settings'

/** Minutos sin tocar el control antes del protector de pantalla (0 = nunca) */
export const SCREENSAVER_CHOICES = [3, 5, 10, 0]

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
  /** Ya pasó (o saltó) el recorrido de bienvenida */
  onboarded = $state(false)
  /** Los videos de vista previa suenan (por defecto, sin sonido) */
  videoSound = $state(false)
  /** Minutos para el protector de pantalla (0 = nunca) */
  screensaverMinutes = $state(5)

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
    this.onboarded = saved.onboarded === true
    this.videoSound = saved.videoSound === true
    this.screensaverMinutes = SCREENSAVER_CHOICES.includes(saved.screensaverMinutes) ? saved.screensaverMinutes : 5
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

  toggleVideoSound() {
    this.videoSound = !this.videoSound
    this.#save()
  }

  /** 3 -> 5 -> 10 -> nunca -> 3 */
  cycleScreensaver() {
    const i = SCREENSAVER_CHOICES.indexOf(this.screensaverMinutes)
    this.screensaverMinutes = SCREENSAVER_CHOICES[(i + 1) % SCREENSAVER_CHOICES.length]
    this.#save()
  }

  /** Terminó o saltó el recorrido de bienvenida */
  markOnboarded() {
    if (this.onboarded) return
    this.onboarded = true
    this.#save()
  }

  #save() {
    save(KEY, {
      showEmptyConsoles: this.showEmptyConsoles,
      sounds: this.sounds,
      coverRegion: this.coverRegion,
      sortOrder: this.sortOrder,
      onboarded: this.onboarded,
      videoSound: this.videoSound,
      screensaverMinutes: this.screensaverMinutes,
    })
  }
}

export const settings = new Settings()
