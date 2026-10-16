import { PLATFORMS } from '../core/platforms.js'

/** Canal especial que junta los favoritos de todas las consolas */
export const FAVORITES = {
  id: 'favorites',
  name: 'Favoritos',
  shortName: 'Favoritos',
  color: '#FF4F87',
  ink: '#4A0A20',
}

/**
 * Canal que agrupa las colecciones del jugador. En la biblioteca, cada
 * colección es una pestaña con id "collection:<Nombre>".
 */
export const COLLECTIONS = {
  id: 'collections',
  name: 'Colecciones',
  shortName: 'Colecciones',
  color: '#5BBF6A',
  ink: '#0E3A16',
}

export const COLLECTION_PREFIX = 'collection:'

/** Orden de los canales en la pantalla de inicio */
export const CHANNELS = [FAVORITES, COLLECTIONS, ...PLATFORMS]

/**
 * Pestaña de una colección: usa el color del canal Colecciones.
 * @param {string} name
 */
export function collectionChannel(name) {
  return { ...COLLECTIONS, id: `${COLLECTION_PREFIX}${name}`, name, shortName: name }
}

/** @param {string} id */
export function isCollectionId(id) {
  return id.startsWith(COLLECTION_PREFIX)
}
