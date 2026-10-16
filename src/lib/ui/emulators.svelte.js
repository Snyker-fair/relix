/**
 * Con qué emulador se abre cada juego:
 *
 *   1. el que elegiste para ese juego (Y › Abrir con…)
 *   2. si no, el de su consola (Opciones › Consolas)
 *   3. si no, el primero de la lista que tengas instalado
 *   4. si no se sabe qué hay instalado, el recomendado (el primero)
 *
 * Lo elegido viaja en tus datos del USB. Qué hay instalado lo pregunta el
 * shell a la Xbox (la misma revisión del aviso "no está instalado").
 */
import { emulatorStatus } from '../core/bridge.js'
import { getEmulator, getPlatform, PLATFORMS } from '../core/platforms.js'
import { load, onReplaced, save } from './storage.js'

/** @typedef {import('../core/platforms.js').Emulator} Emulator */
/** @typedef {import('../core/platforms.js').Platform} Platform */

/** Todos los protocolos, sin repetir (retroarch una sola vez) */
export const PROTOCOLS = [...new Set(PLATFORMS.flatMap((p) => p.emulators.map((e) => e.launcher.protocol)))]

class Emulators {
  /** Elegido por consola: id de consola -> id de emulador */
  /** @type {Record<string, string>} */
  byConsole = $state(load('emulators', {}))
  /** Elegido para un juego puntual: id de juego -> id de emulador */
  /** @type {Record<string, string>} */
  byGame = $state(load('gameEmulators', {}))
  /** Protocolos instalados en la Xbox. null = no se sabe (navegador o shell anterior) */
  /** @type {Record<string, boolean> | null} */
  installed = $state(null)

  constructor() {
    // Llegaron tus datos del USB: se vuelven a leer
    onReplaced(() => {
      this.byConsole = load('emulators', {})
      this.byGame = load('gameEmulators', {})
    })
  }

  /**
   * true instalado, false no está, null no se sabe.
   * @param {Emulator} emulator
   */
  isInstalled(emulator) {
    return this.installed ? (this.installed[emulator.launcher.protocol] ?? null) : null
  }

  /**
   * Emulador de una consola (null si la consola no tiene ninguno).
   * @param {Platform | null} platform
   */
  forPlatform(platform) {
    if (!platform || platform.emulators.length === 0) return null
    const chosen = getEmulator(platform, this.byConsole[platform.id] ?? '')
    if (chosen) return chosen
    return platform.emulators.find((e) => this.isInstalled(e) === true) ?? platform.emulators[0]
  }

  /**
   * Emulador con que se abre un juego.
   * @param {{ id: string, system: string }} game
   */
  forGame(game) {
    const platform = getPlatform(game.system)
    if (!platform) return null
    return getEmulator(platform, this.byGame[game.id] ?? '') ?? this.forPlatform(platform)
  }

  /** ¿El juego tiene un emulador propio, distinto al de su consola? @param {{ id: string, system: string }} game */
  hasOwn(game) {
    const platform = getPlatform(game.system)
    return Boolean(platform && getEmulator(platform, this.byGame[game.id] ?? ''))
  }

  /**
   * Pasa al emulador siguiente de la consola. Devuelve el nuevo.
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
   * Emulador para un juego puntual; null = volver al de su consola.
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

  /** Pregunta a la Xbox qué emuladores tiene. Sin shell (o si falla), queda en "no se sabe". */
  async check() {
    try {
      this.installed = await emulatorStatus(PROTOCOLS)
    } catch {
      this.installed = null
    }
  }
}

export const emulators = new Emulators()
