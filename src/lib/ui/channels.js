import { PLATFORMS } from '../core/platforms.js'
import { t } from '../i18n/i18n.svelte.js'

/**
 * A tab on the home screen and in the library: a console (its Platform, with
 * everything else it has), Favorites, Collections or one collection.
 * @typedef {{ id: string, name: string, shortName: string, color: string, ink: string }} Channel
 */

/** A special channel that gathers the favorites from every console */
export const FAVORITES = {
  id: 'favorites',
  // Getters: the name follows the active language
  get name() {
    return t('Favoritos')
  },
  get shortName() {
    return t('Favoritos')
  },
  color: '#FF4F87',
  ink: '#4A0A20',
}

/**
 * The channel that groups the player's collections. In the library, each
 * collection is a tab with the id "collection:<Name>".
 */
export const COLLECTIONS = {
  id: 'collections',
  get name() {
    return t('Colecciones')
  },
  get shortName() {
    return t('Colecciones')
  },
  color: '#5BBF6A',
  ink: '#0E3A16',
}

export const COLLECTION_PREFIX = 'collection:'

/** The order of the channels on the home screen @type {Channel[]} */
export const CHANNELS = [FAVORITES, COLLECTIONS, ...PLATFORMS]

/**
 * A collection's tab: it uses the Collections channel's color.
 * @param {string} name
 * @returns {Channel}
 */
export function collectionChannel(name) {
  return { ...COLLECTIONS, id: `${COLLECTION_PREFIX}${name}`, name, shortName: name }
}

/** @param {string} id */
export function isCollectionId(id) {
  return id.startsWith(COLLECTION_PREFIX)
}
