/**
 * Registro de diagnóstico (E:\relix\registro.txt): qué pasó y cuándo, para
 * entender un "no abre" sin estar frente a la consola. Las líneas se juntan
 * un momento y se mandan al shell de a varias; antes de abrir un juego, en el acto.
 *
 * Se anotan: el inicio, cada lanzamiento con su URI, la vuelta (y los juegos
 * que se cerraron al abrir), los errores del shell y de la interfaz, la
 * revisión del sistema, los problemas al guardar tus datos y las portadas que
 * no se pudieron bajar.
 */
import { appendLog, onShellError, ShellError } from '../core/bridge.js'
import { logLine } from '../core/diagnostics.js'

/** Pedidos cuyos errores se anotan en otro lado (o son el registro mismo) */
const NOT_LOGGED = new Set(['launch', 'appendLog', 'readLog'])
/** El mismo error dentro de este tiempo no se repite */
const REPEAT_MS = 60_000

class Diagnostics {
  /** Cuándo se anotó lo último en esta sesión (para la fila de Revisión) */
  lastAt = $state(0)

  /** @type {string[]} */
  #queue = []
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #timer
  /** @type {Map<string, number>} texto -> cuándo se anotó */
  #recent = new Map()
  #started = false

  /**
   * @param {keyof typeof import('../core/diagnostics.js').LOG_KINDS} kind
   * @param {string} text
   */
  log(kind, text) {
    this.#queue.push(logLine(kind, text))
    this.lastAt = Date.now()
    clearTimeout(this.#timer)
    this.#timer = setTimeout(() => this.flush(), 1500)
  }

  /** Un error; si se repite igual dentro de un minuto, no se vuelve a anotar @param {string} text */
  error(text) {
    const now = Date.now()
    const last = this.#recent.get(text)
    if (last !== undefined && now - last < REPEAT_MS) return
    this.#recent.set(text, now)
    this.log('error', text)
  }

  /** Manda lo pendiente ya (antes de abrir un juego, o si la Xbox esconde Relix) */
  flush() {
    clearTimeout(this.#timer)
    const lines = this.#queue.splice(0)
    if (lines.length > 0) appendLog(lines)
  }

  /** Empieza a escuchar los errores del shell y de la interfaz */
  start() {
    if (this.#started) return
    this.#started = true
    onShellError((type, error) => {
      if (NOT_LOGGED.has(type)) return
      this.error(`Shell (${type}): ${error.message} [${error.code}]`)
    })
    window.addEventListener('error', (e) => {
      const where = e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : ''
      this.error(`Interfaz: ${e.message}${where}`)
    })
    window.addEventListener('unhandledrejection', (e) => {
      if (e.reason instanceof ShellError) return // ya anotado al llegar del shell
      this.error(`Interfaz: ${e.reason instanceof Error ? e.reason.message : String(e.reason)}`)
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush()
    })
  }
}

export const diagnostics = new Diagnostics()
