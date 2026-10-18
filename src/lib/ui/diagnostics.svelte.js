/**
 * The diagnostic log (E:\relix\log.txt): what happened and when, to
 * understand a "won't open" without being in front of the console. The lines
 * are gathered for a moment and sent to the shell a few at a time; right away before a game opens.
 *
 * What's logged: the start, each launch with its URI, the return (and the games
 * that closed on opening), the shell's and the interface's errors, the
 * system checkup, problems saving your data and the covers that
 * couldn't be downloaded.
 */
import { appendLog, onShellError, ShellError } from '../core/bridge.js'
import { logLine } from '../core/diagnostics.js'

/** Requests whose errors are logged elsewhere (or are the log itself) */
const NOT_LOGGED = new Set(['launch', 'appendLog', 'readLog'])
/** The same error within this time isn't repeated */
const REPEAT_MS = 60_000

class Diagnostics {
  /** When the last thing was logged this session (for the Checkup row) */
  lastAt = $state(0)

  /** @type {string[]} */
  #queue = []
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #timer
  /** @type {Map<string, number>} text -> when it was logged */
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

  /** An error; if it repeats the same within a minute, it isn't logged again @param {string} text */
  error(text) {
    const now = Date.now()
    const last = this.#recent.get(text)
    if (last !== undefined && now - last < REPEAT_MS) return
    this.#recent.set(text, now)
    this.log('error', text)
  }

  /** Sends what's pending right now (before a game opens, or if the Xbox hides Relix) */
  flush() {
    clearTimeout(this.#timer)
    const lines = this.#queue.splice(0)
    if (lines.length > 0) appendLog(lines)
  }

  /** Starts listening to the shell's and the interface's errors */
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
      if (e.reason instanceof ShellError) return // already logged when it came from the shell
      this.error(`Interfaz: ${e.reason instanceof Error ? e.reason.message : String(e.reason)}`)
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush()
    })
  }
}

export const diagnostics = new Diagnostics()
