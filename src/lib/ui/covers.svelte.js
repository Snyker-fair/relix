/**
 * Búsqueda de portadas en libretro (Opciones › Portadas).
 *
 *   find(consola)   baja las portadas seguras de los juegos que no tienen
 *                   y anota los que necesitan que el jugador elija
 *   pending         esos juegos, para la pantalla "Elegir portada"
 *   choose / skip   elegir una candidata o dejar la portada de color
 *
 * Nunca se usa internet sin que el jugador lo pida.
 */
import { coverIndex, deleteCover, downloadCovers } from '../core/bridge.js'
import {
  buildCoverIndex,
  coverCandidates,
  coverKey,
  coverQuery,
  matchCover,
  remoteCoverUrl,
} from '../core/coverMatch.js'
import { getPlatform, PLATFORMS } from '../core/platforms.js'
import { library } from './library.svelte.js'
import { settings } from './settings.svelte.js'
import { load, save } from './storage.js'

/**
 * @typedef {{ saved: number, failed: number, toChoose: number, notFound: number, at: number }} CoverResult
 * @typedef {{ system: string, phase: 'list'|'download', done: number, total: number }} CoverProgress
 * @typedef {import('../core/coverMatch.js').CoverCandidate & { url: string }} PickerCandidate
 */

class Covers {
  /** Consola que se está buscando ahora (de a una) */
  /** @type {string|null} */
  busy = $state(null)
  /** @type {CoverProgress|null} */
  progress = $state(null)
  /** Juegos que esperan que el jugador elija su portada, por consola */
  /** @type {Record<string, string[]>} */
  choices = $state(load('coverChoices', {}))
  /** Juegos que el jugador prefirió dejar con la portada de color */
  /** @type {string[]} */
  skipped = $state(load('coverSkipped', []))
  /** Último resultado de cada consola */
  /** @type {Record<string, CoverResult>} */
  results = $state(load('coverResults', {}))

  /** Juegos por elegir: siguen sin portada y no se dejaron de color */
  pending = $derived(
    PLATFORMS.flatMap((p) =>
      (this.choices[p.id] ?? [])
        .map((id) => library.byId.get(id))
        .filter((g) => g !== undefined && !g.cover && !this.skipped.includes(g.id)),
    ),
  )

  /** @type {Map<string, Promise<import('../core/coverMatch.js').CoverIndex>>} */
  #indexes = new Map()

  /**
   * Lista de portadas de una consola (se pide una vez por sesión).
   * @param {import('../core/platforms.js').Platform} platform
   */
  #index(platform) {
    let index = this.#indexes.get(platform.id)
    if (!index) {
      index = coverIndex(platform).then(buildCoverIndex)
      index.catch(() => this.#indexes.delete(platform.id)) // si falló, se reintenta la próxima vez
      this.#indexes.set(platform.id, index)
    }
    return index
  }

  /**
   * Busca y baja las portadas que faltan en una consola.
   * @param {string} systemId
   * @returns {Promise<CoverResult>}
   */
  async find(systemId) {
    const platform = getPlatform(systemId)
    if (!platform) throw new Error(`Consola desconocida: ${systemId}`)
    const missing = library.gamesFor(systemId).filter((g) => !g.cover)

    this.busy = systemId
    this.progress = { system: systemId, phase: 'list', done: 0, total: missing.length }
    try {
      /** @type {Array<{ key: string, remote: string }>} */
      const downloads = []
      /** @type {string[]} */
      const toChoose = []
      let notFound = 0

      if (missing.length > 0) {
        const index = await this.#index(platform)
        const region = settings.coverRegion
        for (const game of missing) {
          const query = coverQuery(game)
          const match = matchCover(query, index, { region, altTitle: game.name })
          if (match) downloads.push({ key: coverKey(game), remote: match.name })
          else if (coverCandidates(query, index, { region, altTitle: game.name, limit: 1 }).length > 0) toChoose.push(game.id)
          else notFound++
        }
      }

      let saved = 0
      let failed = 0
      if (downloads.length > 0) {
        this.progress = { system: systemId, phase: 'download', done: 0, total: downloads.length }
        const result = await downloadCovers(platform, downloads, (done, total) => {
          this.progress = { system: systemId, phase: 'download', done, total }
        })
        saved = result.saved.length
        failed = result.failed.length
        await library.refreshCovers([systemId], result.saved)
      }

      this.choices = { ...this.choices, [systemId]: toChoose }
      save('coverChoices', this.choices)
      /** @type {CoverResult} */
      const result = { saved, failed, toChoose: toChoose.length, notFound, at: Date.now() }
      this.results = { ...this.results, [systemId]: result }
      save('coverResults', this.results)
      return result
    } finally {
      this.busy = null
      this.progress = null
    }
  }

  /**
   * Portadas parecidas para elegir a mano, con su URL para verlas.
   * @param {import('./library.svelte.js').LibraryGame} game
   * @returns {Promise<PickerCandidate[]>}
   */
  async candidatesFor(game) {
    const platform = getPlatform(game.system)
    if (!platform) return []
    const index = await this.#index(platform)
    return coverCandidates(coverQuery(game), index, {
      region: settings.coverRegion,
      altTitle: game.name,
      limit: 6,
    }).map((c) => ({ ...c, url: remoteCoverUrl(platform.libretro, c.name) }))
  }

  /**
   * Baja la portada elegida para un juego.
   * @param {import('./library.svelte.js').LibraryGame} game
   * @param {string} remoteName  nombre en libretro
   */
  async choose(game, remoteName) {
    const platform = getPlatform(game.system)
    if (!platform) return
    const key = coverKey(game)
    const result = await downloadCovers(platform, [{ key, remote: remoteName }])
    if (result.failed.length > 0) throw new Error(result.failed[0].error || 'No se pudo descargar la portada.')
    await library.refreshCovers([game.system], [key])
  }

  /**
   * Quita la portada descargada de un juego y no la vuelve a buscar.
   * @param {import('./library.svelte.js').LibraryGame} game
   */
  async useColor(game) {
    const key = coverKey(game)
    if (game.cover) {
      await deleteCover(game.system, key)
      await library.refreshCovers([game.system], [key])
    }
    this.skip(game)
  }

  /**
   * El jugador prefiere la portada de color para este juego.
   * @param {import('./library.svelte.js').LibraryGame} game
   */
  skip(game) {
    if (this.skipped.includes(game.id)) return
    this.skipped = [...this.skipped, game.id]
    save('coverSkipped', this.skipped)
  }
}

export const covers = new Covers()
