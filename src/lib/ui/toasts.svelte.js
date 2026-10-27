/**
 * The notice at the top of the screen (App.svelte draws it): one at a time, and
 * each one replaces the one before.
 */

/** How long the time played stays on screen after a game */
export const PLAYTIME_MS = 6000
/** How long each notice stays when Relix opens */
export const START_NOTICE_MS = 8000
const DEFAULT_MS = 3500

class Toasts {
  /** What's on screen ('' = nothing) */
  message = $state('')
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #timer

  /** (Arrow functions: they can be passed as they are, onToast={toasts.show}) */
  /** @param {string} message @param {number} [duration] ms */
  show = (message, duration = DEFAULT_MS) => {
    this.message = message
    clearTimeout(this.#timer)
    this.#timer = setTimeout(() => (this.message = ''), duration)
  }

  /**
   * Several, one after another. If another notice is on screen (the time played,
   * e.g.), these go after it.
   * @param {string[]} messages
   * @param {number} [duration] ms each
   */
  queue = (messages, duration = START_NOTICE_MS) => {
    const first = this.message ? PLAYTIME_MS + 100 : 0
    messages.forEach((message, i) => setTimeout(() => this.show(message, duration), first + i * (duration + 500)))
  }
}

export const toasts = new Toasts()
