/**
 * Which emulator each game opens with:
 *
 *   1. the one you chose for that game (Y › Open with…)
 *   2. otherwise, its console's (Options › Consoles)
 *   3. otherwise, the first one on the list that you have installed
 *   4. if it's not known what's installed, the recommended one (the first)
 *
 * What you chose travels in your data on the USB drive. The shell asks the Xbox
 * what's installed (the same check as the "isn't installed" notice).
 */
import { emulatorStatus } from '../core/bridge.js'
import { getEmulator, getPlatform, PLATFORMS } from '../core/platforms.js'
import { load, onReplaced, save } from './storage.js'

/** @typedef {import('../core/platforms.js').Emulator} Emulator */
/** @typedef {import('../core/platforms.js').Platform} Platform */

/** Every protocol, without repeats (retroarch only once) */
export const PROTOCOLS = [...new Set(PLATFORMS.flatMap((p) => p.emulators.map((e) => e.launcher.protocol)))]

class Emulators {
  /** Chosen per console: console id -> emulator id */
  /** @type {Record<string, string>} */
  byConsole = $state(load('emulators', {}))
  /** Chosen for a single game: game id -> emulator id */
  /** @type {Record<string, string>} */
  byGame = $state(load('gameEmulators', {}))
  /** Protocols installed on the Xbox. null = unknown (browser or an older shell) */
  /** @type {Record<string, boolean> | null} */
  installed = $state(null)

  constructor() {
    // Your data arrived from the USB drive: they're read again
    onReplaced(() => {
      this.byConsole = load('emulators', {})
      this.byGame = load('gameEmulators', {})
    })
  }

  /**
   * true installed, false it isn't, null unknown.
   * @param {Emulator} emulator
   */
  isInstalled(emulator) {
    return this.installed ? (this.installed[emulator.launcher.protocol] ?? null) : null
  }

  /**
   * A console's emulator (null if the console has none).
   * @param {Platform | null} platform
   */
  forPlatform(platform) {
    if (!platform || platform.emulators.length === 0) return null
    const chosen = getEmulator(platform, this.byConsole[platform.id] ?? '')
    if (chosen) return chosen
    return platform.emulators.find((e) => this.isInstalled(e) === true) ?? platform.emulators[0]
  }

  /**
   * The emulator a game opens with.
   * @param {{ id: string, system: string }} game
   */
  forGame(game) {
    const platform = getPlatform(game.system)
    if (!platform) return null
    return getEmulator(platform, this.byGame[game.id] ?? '') ?? this.forPlatform(platform)
  }

  /** Does the game have its own emulator, different from its console's? @param {{ id: string, system: string }} game */
  hasOwn(game) {
    const platform = getPlatform(game.system)
    return Boolean(platform && getEmulator(platform, this.byGame[game.id] ?? ''))
  }

  /**
   * Moves to the console's next emulator. Returns the new one.
   * @param {Platform} platform
   */
  cyclePlatform(platform) {
    const list = platform.emulators
    if (list.length < 2) return this.forPlatform(platform)
    const current = this.forPlatform(platform)
    const next = list[(list.findIndex((e) => e.id === current?.id) + 1) % list.length]
    this.byConsole = { ...this.byConsole, [platform.id]: next.id }
    save('emulators', this.byConsole)
    return next
  }

  /**
   * The emulator for a single game; null = back to its console's.
   * @param {{ id: string }} game
   * @param {string | null} emulatorId
   */
  setGame(game, emulatorId) {
    const next = { ...this.byGame }
    if (emulatorId) next[game.id] = emulatorId
    else delete next[game.id]
    this.byGame = next
    save('gameEmulators', next)
  }

  /** Asks the Xbox which emulators it has. Without a shell (or if it fails), it stays "unknown". */
  async check() {
    try {
      this.installed = await emulatorStatus(PROTOCOLS)
    } catch {
      this.installed = null
    }
  }
}

export const emulators = new Emulators()
