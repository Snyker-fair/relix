import { PLATFORMS } from '../core/platforms.js'

/** Canal especial que junta los favoritos de todas las consolas */
export const FAVORITES = {
  id: 'favorites',
  name: 'Favoritos',
  shortName: 'Favoritos',
  color: '#FF4F87',
  ink: '#4A0A20',
}

/** Orden de los canales en la pantalla de inicio */
export const CHANNELS = [FAVORITES, ...PLATFORMS]
