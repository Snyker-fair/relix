/**
 * Solo se ve la barra de pistas de lo que está más arriba (una ventana sobre
 * la pantalla), igual que solo lo de más arriba recibe el control.
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
