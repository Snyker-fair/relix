/**
 * Colecciones del jugador, guardadas en el USB con el formato de ES-DE
 * (ES-DE/collections/custom-<Nombre>.cfg). Se arman desde el menú del juego.
 *
 * Una colección se ve en Relix mientras tenga al menos un juego que Relix
 * reconozca; las líneas de otras consolas se conservan al guardar.
 */
import { listCollections, saveCollection } from '../core/bridge.js'
import { t } from '../i18n/i18n.svelte.js'
import {
  cleanCollectionName,
  collectionFileName,
  collectionGameKeys,
  collectionNameFromFile,
  parseCollection,
  serializeCollection,
  setInCollection,
} from '../core/collections.js'
import { bySortName } from '../core/esde.js'
import { library } from './library.svelte.js'

/** @typedef {{ name: string, file: string, lines: string[] }} Collection */
/** @typedef {import('./library.svelte.js').LibraryGame} LibraryGame */

class Collections {
  /** Todas las colecciones del USB, en orden alfabético */
  /** @type {Collection[]} */
  list = $state([])

  /** Juegos de cada colección que Relix reconoce (sin ocultos), en A–Z */
  /** @type {Record<string, LibraryGame[]>} */
  games = $derived.by(() => {
    /** @type {Record<string, LibraryGame[]>} */
    const result = {}
    for (const c of this.list) {
      const keys = collectionGameKeys(c.lines, library.folderToSystem, library.romRoot)
      result[c.name] = [...keys]
        .map((k) => library.byKey.get(k))
        .filter((g) => g !== undefined)
        .sort(bySortName)
    }
    return result
  })

  /** Las que se muestran: con al menos un juego */
  visible = $derived(this.list.filter((c) => (this.games[c.name]?.length ?? 0) > 0))

  /** Lee las colecciones del USB. Si falla, Relix sigue sin colecciones. */
  async load() {
    try {
      const files = await listCollections()
      this.list = files
        .map((f) => ({ name: collectionNameFromFile(f.file) ?? '', file: f.file, lines: parseCollection(f.text) }))
        .filter((c) => c.name)
        .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
    } catch {
      this.list = []
    }
  }

  /** @param {string} name */
  gamesIn(name) {
    return this.games[name] ?? []
  }

  /**
   * Nombres de las colecciones en que está un juego.
   * @param {LibraryGame} game
   */
  namesFor(game) {
    return this.list.filter((c) => this.gamesIn(c.name).some((g) => g.id === game.id)).map((c) => c.name)
  }

  /**
   * Agrega o quita un juego de una colección.
   * @param {LibraryGame} game
   * @param {string} name
   * @returns {Promise<boolean>}  true si quedó adentro
   */
  async toggle(game, name) {
    const collection = this.list.find((c) => c.name === name)
    if (!collection) return false
    const include = !this.namesFor(game).includes(name)
    await this.#save(collection, this.#withGame(collection.lines, game, include))
    return include
  }

  /**
   * Crea una colección con un juego (o lo agrega, si ya existe con ese nombre).
   * @param {string} rawName
   * @param {LibraryGame} game
   * @returns {Promise<string>}  el nombre final
   */
  async create(rawName, game) {
    const name = cleanCollectionName(rawName)
    if (!name) throw new Error(t('Escribe un nombre para la colección.'))
    const existing = this.list.find((c) => c.name.toLowerCase() === name.toLowerCase())
    const collection = existing ?? { name, file: collectionFileName(name), lines: [] }
    await this.#save(collection, this.#withGame(collection.lines, game, true))
    return collection.name
  }

  /** @param {string[]} lines @param {LibraryGame} game @param {boolean} include */
  #withGame(lines, game, include) {
    return setInCollection(
      lines,
      game,
      library.folderOf(game.system),
      include,
      library.folderToSystem,
      library.romRoot,
    )
  }

  /** @param {Collection} collection @param {string[]} lines */
  async #save(collection, lines) {
    await saveCollection(collection.file, serializeCollection(lines))
    const others = this.list.filter((c) => c.file !== collection.file)
    this.list = (lines.length > 0 ? [...others, { ...collection, lines }] : others).sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
    )
  }
}

export const collections = new Collections()
