/**
 * Estado de la pantalla que comparten varias piezas:
 *   - si está el protector de pantalla o se está abriendo un juego (los videos
 *     de vista previa se detienen: no tiene sentido que sigan sonando debajo)
 *   - las imágenes y videos del USB que no cargaron (no se vuelven a pedir y
 *     el panel muestra la portada en su lugar)
 */
import { SvelteSet } from 'svelte/reactivity'

class Activity {
  screensaver = $state(false)
  launching = $state(false)

  /** Nada debería moverse ni sonar */
  get quiet() {
    return this.screensaver || this.launching
  }
}

export const activity = new Activity()

/** URLs de imágenes o videos que fallaron */
export const brokenMedia = new SvelteSet()

/**
 * La URL si se puede usar: existe y no falló antes.
 * @param {string | undefined} url
 */
export function usableMedia(url) {
  return url && !brokenMedia.has(url) ? url : undefined
}
