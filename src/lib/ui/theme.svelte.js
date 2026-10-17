/**
 * Aplica el tema elegido en Preferencias: pone data-theme en <html> (app.css
 * cambia los colores) y le avisa al shell qué fondo usar la próxima vez que
 * abra. En Automático revisa la hora cada minuto.
 *
 * index.html hace lo mismo antes de pintar, para que no haya destello.
 */
import { setShellBackground } from '../core/bridge.js'
import { effectiveTheme, SHELL_BACKGROUND } from '../core/theme.js'
import { settings } from './settings.svelte.js'

class Theme {
  /** Para que Automático se entere de la hora */
  now = $state(Date.now())
  /** 'light' o 'dark': el que se ve ahora */
  current = $derived(effectiveTheme(settings.theme, new Date(this.now)))

  #started = false

  start() {
    if (this.#started) return
    this.#started = true
    $effect.root(() => {
      $effect(() => {
        const theme = this.current
        document.documentElement.dataset.theme = theme
        setShellBackground(SHELL_BACKGROUND[theme])
      })
      $effect(() => {
        if (settings.theme !== 'auto') return
        this.now = Date.now()
        const timer = setInterval(() => (this.now = Date.now()), 60_000)
        return () => clearInterval(timer)
      })
    })
  }
}

export const theme = new Theme()
