/**
 * Measures Relix's memory on the Xbox and logs it (core/memory.js says what and why).
 * Asking the shell costs next to nothing: every 20 seconds while Relix is on screen,
 * and a moment after a preview video starts.
 */
import { memoryUsage } from '../core/bridge.js'
import { isNewPeak, memoryText } from '../core/memory.js'
import { diagnostics } from './diagnostics.svelte.js'

const EVERY_MS = 20_000
/** A video's memory shows up once it's playing for a moment */
const AFTER_VIDEO_MS = 4000
/** Before a game opens it waits for the shell this long at most */
const BEFORE_GAME_MS = 800

class Memory {
  /** Preview videos playing right now */
  videos = $state(0)
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

  /** A preview video started playing: it's measured a moment later */
  videoStarted() {
    this.videos++
    if (!this.#off) setTimeout(() => this.#sample(), AFTER_VIDEO_MS)
  }

  videoStopped() {
    this.videos = Math.max(0, this.videos - 1)
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

  async #sample() {
    const memory = await memoryUsage()
    if (!memory || !isNewPeak(this.#peak, memory.usage)) return
    this.#peak = memory.usage
    diagnostics.log('memory', memoryText('peak', memory, { where: this.#where(), video: this.videos > 0 }))
  }

  #stop() {
    this.#off = true
    clearInterval(this.#timer)
  }
}

export const memory = new Memory()
