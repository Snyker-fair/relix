/**
 * Applies the language: sets lang on <html> (correct screen readers and
 * hyphenation) and tells the shell, which writes its error messages in the
 * same language.
 */
import { setShellLanguage } from '../core/bridge.js'
import { i18n } from '../i18n/i18n.svelte.js'

let started = false

export function startLanguage() {
  if (started) return
  started = true
  // Right away, without waiting for the effect: that way the shell knows before the first request
  document.documentElement.lang = i18n.current
  setShellLanguage(i18n.current)
  $effect.root(() => {
    $effect(() => {
      const language = i18n.current
      document.documentElement.lang = language
      setShellLanguage(language)
    })
  })
}
