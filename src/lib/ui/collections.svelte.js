/**
 * The player's collections, saved on the USB drive in ES-DE's format
 * (ES-DE/collections/custom-<Name>.cfg). They're put together from the game menu.
 *
 * A collection shows in Relix as long as it has at least one game Relix
 * recognizes; the lines from other consoles are kept when saving.
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
  /** Every collection on the USB drive, in alphabetical order */
  /** @type {Collection[]} */
  list = $state([])

  /** The games of each collection that Relix recognizes (without hidden ones), A–Z */
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

  /** The ones shown: with at least one game */
  visible = $derived(this.list.filter((c) => (this.games[c.name]?.length ?? 0) > 0))

  /** Reads the collections from the USB drive. If it fails, Relix carries on without collections. */
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
   * The names of the collections a game is in.
   * @param {LibraryGame} game
   */
  namesFor(game) {
    return this.list.filter((c) => this.gamesIn(c.name).some((g) => g.id === game.id)).map((c) => c.name)
  }

  /**
   * Adds a game to a collection or removes it.
   * @param {LibraryGame} game
   * @param {string} name
   * @returns {Promise<boolean>}  true if it ended up inside
   */
  async toggle(game, name) {
    const collection = this.list.find((c) => c.name === name)
    if (!collection) return false
    const include = !this.namesFor(game).includes(name)
    await this.#save(collection, this.#withGame(collection.lines, game, include))
    return include
  }

  /**
   * Creates a collection with a game (or adds it, if one with that name already exists).
   * @param {string} rawName
   * @param {LibraryGame} game
   * @returns {Promise<string>}  the final name
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
