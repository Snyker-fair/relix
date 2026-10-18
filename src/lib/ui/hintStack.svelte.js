/**
 * Only the hint bar of whatever is on top shows (a window over the
 * screen), just as only what's on top receives the controller.
 */
class HintStack {
  /** @type {symbol[]} */
  ids = $state([])

  /** @param {symbol} id */
  push(id) {
    this.ids = [...this.ids, id]
    return () => {
      this.ids = this.ids.filter((x) => x !== id)
    }
  }

  /** @param {symbol} id */
  isTop(id) {
    return this.ids.at(-1) === id
  }
}

export const hintStack = new HintStack()
