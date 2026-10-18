/**
 * Applies the theme chosen in Preferences: sets data-theme on <html> (app.css
 * changes the colors) and tells the shell which background to use the next time it
 * opens. In Automatic it checks the time every minute.
 *
 * index.html does the same before painting, so there's no flash.
 */
import { setShellBackground } from '../core/bridge.js'
import { effectiveTheme, SHELL_BACKGROUND } from '../core/theme.js'
import { settings } from './settings.svelte.js'

class Theme {
  /** So Automatic knows the time */
  now = $state(Date.now())
  /** 'light' or 'dark': the one shown now */
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
