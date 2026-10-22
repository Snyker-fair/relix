/**
 * The player's preferences, saved in the app's storage.
 */
import { cleanConsoleOrder, isDefaultOrder } from '../core/consoleOrder.js'
import { REGION_PREFERENCES } from '../core/coverMatch.js'
import { PLATFORMS } from '../core/platforms.js'
import { LANGUAGES } from '../core/language.js'
import { SORT_NAMES } from '../core/sorting.js'
import { THEMES } from '../core/theme.js'
import { i18n } from '../i18n/i18n.svelte.js'
import { sound } from './sound.js'
import { load, onReplaced, save } from './storage.js'

const KEY = 'settings'

/** Minutes without touching the controller before the screensaver (0 = never) */
export const SCREENSAVER_CHOICES = [3, 5, 10, 0]

/** @typedef {import('../core/coverMatch.js').RegionPreference} RegionPreference */
const REGIONS = /** @type {RegionPreference[]} */ (Object.keys(REGION_PREFERENCES))
/** @typedef {import('../core/sorting.js').SortOrder} SortOrder */
const SORTS = /** @type {SortOrder[]} */ (Object.keys(SORT_NAMES))

class Settings {
  /** Show the consoles without games on the home screen */
  showEmptyConsoles = $state(false)
  /** Interface sounds */
  sounds = $state(true)
  /** The covers' region when the file doesn't say its own */
  /** @type {RegionPreference} */
  coverRegion = $state('usa')
  /** The library's order (changed from the game menu) */
  /** @type {SortOrder} */
  sortOrder = $state('az')
  /** Light, Dark or Automatic (dark at night) */
  /** @type {import('../core/theme.js').ThemeChoice} */
  theme = $state('light')
  /**
   * Automatic (the Xbox's), Español or English. i18n keeps it, which doesn't
   * depend on anything else, so any module can translate.
   */
  get language() {
    return i18n.choice
  }
  /** The welcome tour is already done (or skipped) */
  onboarded = $state(false)
  /** Minutes for the screensaver (0 = never) */
  screensaverMinutes = $state(5)
  /** The consoles' order, as chosen in Options › Consoles (empty: Relix's; core/consoleOrder.js) */
  /** @type {string[]} */
  consoleOrder = $state([])

  constructor() {
    this.#restore()
    onReplaced(() => this.#restore())
  }

  #restore() {
    const saved = /** @type {Record<string, any>} */ (load(KEY, {}))
    this.showEmptyConsoles = saved.showEmptyConsoles ?? false
    this.sounds = saved.sounds ?? true
    this.coverRegion = REGIONS.includes(saved.coverRegion) ? saved.coverRegion : 'usa'
    this.sortOrder = SORTS.includes(saved.sortOrder) ? saved.sortOrder : 'az'
    this.onboarded = saved.onboarded === true
    this.theme = THEMES.includes(saved.theme) ? saved.theme : 'light'
    i18n.choice = LANGUAGES.includes(saved.language) ? saved.language : 'auto'
    this.screensaverMinutes = SCREENSAVER_CHOICES.includes(saved.screensaverMinutes) ? saved.screensaverMinutes : 5
    this.consoleOrder = cleanConsoleOrder(saved.consoleOrder, PLATFORMS.map((p) => p.id))
    sound.setMuted(!this.sounds)
  }

  /**
   * Saves the consoles' order. Relix's own isn't saved, so new consoles keep their place.
   * @param {string[]} ids  every console, in the chosen order
   */
  setConsoleOrder(ids) {
    const relix = PLATFORMS.map((p) => p.id)
    this.consoleOrder = isDefaultOrder(ids, relix) ? [] : cleanConsoleOrder(ids, relix)
    this.#save()
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

  /** USA -> Europe -> Japan -> USA */
  cycleCoverRegion() {
    this.coverRegion = REGIONS[(REGIONS.indexOf(this.coverRegion) + 1) % REGIONS.length]
    this.#save()
  }

  /**
   * Moves to the next order among the available ones (Year only if there are years).
   * @param {SortOrder[]} available
   */
  cycleSortOrder(available = SORTS) {
    const options = SORTS.filter((s) => available.includes(s))
    this.sortOrder = options[(options.indexOf(this.sortOrder) + 1) % options.length] ?? 'az'
    this.#save()
  }

  /** 3 -> 5 -> 10 -> never -> 3 */
  cycleScreensaver() {
    const i = SCREENSAVER_CHOICES.indexOf(this.screensaverMinutes)
    this.screensaverMinutes = SCREENSAVER_CHOICES[(i + 1) % SCREENSAVER_CHOICES.length]
    this.#save()
  }

  /** Light -> Dark -> Automatic -> Light */
  cycleTheme() {
    this.theme = THEMES[(THEMES.indexOf(this.theme) + 1) % THEMES.length]
    this.#save()
  }

  /** Automatic -> Español -> English -> Automatic */
  cycleLanguage() {
    i18n.choice = LANGUAGES[(LANGUAGES.indexOf(i18n.choice) + 1) % LANGUAGES.length]
    this.#save()
  }

  /**
   * The other language, the one not shown (Getting started: Y switches between Spanish and English).
   */
  switchLanguage() {
    i18n.choice = i18n.current === 'es' ? 'en' : 'es'
    this.#save()
  }

  /** Finished or skipped the welcome tour */
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
      theme: this.theme,
      language: i18n.choice,
      screensaverMinutes: this.screensaverMinutes,
      consoleOrder: this.consoleOrder,
    })
  }
}

export const settings = new Settings()
