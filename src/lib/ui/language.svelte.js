/**
 * Aplica el idioma: pone lang en <html> (lectores de pantalla y guiones
 * correctos) y le avisa al shell, que escribe sus mensajes de error en el
 * mismo idioma.
 */
import { setShellLanguage } from '../core/bridge.js'
import { i18n } from '../i18n/i18n.svelte.js'

let started = false

export function startLanguage() {
  if (started) return
  started = true
  // Ya, sin esperar al efecto: así el shell lo sabe antes del primer pedido
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
