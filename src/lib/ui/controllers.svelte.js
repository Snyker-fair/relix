/**
 * How many controllers are connected (core/together.js says what Relix does with
 * two or more). On the Xbox the shell says so each time it changes; in the browser,
 * the Gamepad API (and ?controllers=2 in the address, to try it without them).
 */
import { TOGETHER_CONTROLLERS } from '../core/together.js'

class Controllers {
  count = $state(1)
  /** Two or more: games to play together */
  together = $derived(this.count >= TOGETHER_CONTROLLERS)

  /** @param {number} count */
  set(count) {
    if (Number.isFinite(count) && count >= 0) this.count = count
  }

  /** In the browser: the connected controllers, or the address's ?controllers= */
  watchBrowser() {
    const forced = Number(new URLSearchParams(globalThis.location?.search ?? '').get('controllers'))
    if (forced > 0) return this.set(forced)
    const count = () => this.set(Math.max(1, (navigator.getGamepads?.() ?? []).filter(Boolean).length))
    window.addEventListener('gamepadconnected', count)
    window.addEventListener('gamepaddisconnected', count)
  }
}

export const controllers = new Controllers()
