/**
 * Measures Relix's memory on the Xbox and logs it (core/memory.js says what and why).
 * Asking the shell costs next to nothing: every 20 seconds while Relix is on screen,
.
 */
import { memoryUsage } from '../core/bridge.js'
import { isNewPeak, memoryText } from '../core/memory.js'
import { diagnostics } from './diagnostics.svelte.js'

const EVERY_MS = 20_000
/** Before a game opens it waits for the shell this long at most */
const BEFORE_GAME_MS = 800
/** How long after asking WebView2 to let go it's measured again */
const FREED_AFTER_MS = 5000

class Memory {
  /** The highest one logged */
  #peak = 0
  /** What's on screen, in a few words ("PS2 library") */
  #where = () => ''
  /** @type {ReturnType<typeof setInterval> | undefined} */
  #timer
  #off = false

  /**
   * Starts measuring. In the demo (and with an older shell) there's no answer and it stops.
   * @param {() => string} where
   */
  start(where) {
    if (this.#timer || this.#off) return
    this.#where = where
    this.#timer = setInterval(() => {
      if (!document.hidden) this.#sample()
    }, EVERY_MS)
    memoryUsage().then((memory) => {
      if (!memory) return this.#stop()
      this.#peak = memory.usage
      diagnostics.log('memory', memoryText('start', memory, { where: this.#where() }))
    })
  }

  /**
   * Right before a game opens (then the Xbox leaves Relix with 128 MB).
   * @param {string} game
   */
  async beforeGame(game) {
    if (this.#off || !this.#timer) return
    const memory = await Promise.race([memoryUsage(), new Promise((resolve) => setTimeout(resolve, BEFORE_GAME_MS, null))])
    if (memory) diagnostics.log('memory', memoryText('game', memory, { game }))
  }

  /**
   * The Xbox says Relix's memory is high and the shell asked WebView2 to keep the
   * minimum: it's logged, and again a moment later, to see how much came back.
   */
  async nearLimit() {
    if (this.#off) return
    const before = await memoryUsage()
    if (!before) return
    diagnostics.log('memory', memoryText('high', before, { where: this.#where() }))
    setTimeout(async () => {
      const after = await memoryUsage()
      if (!after) return
      diagnostics.log('memory', memoryText('freed', after))
      // From here, the peaks count again from what's left
      this.#peak = after.usage
    }, FREED_AFTER_MS)
  }

  async #sample() {
    const memory = await memoryUsage()
    if (!memory || !isNewPeak(this.#peak, memory.usage)) return
    this.#peak = memory.usage
    diagnostics.log('memory', memoryText('peak', memory, { where: this.#where() }))
  }

  #stop() {
    this.#off = true
    clearInterval(this.#timer)
  }
}

export const memory = new Memory()
