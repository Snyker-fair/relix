import { describe, expect, it } from 'vitest'
import { cleanConsoleOrder, isDefaultOrder, moveConsole, orderConsoles } from '../src/lib/core/consoleOrder.js'

const platforms = ['psx', 'ps2', 'psp', 'snes', 'n64'].map((id) => ({ id }))
const ids = (/** @type {{ id: string }[]} */ list) => list.map((p) => p.id)

describe('the order of the consoles', () => {
  it("without a chosen order, Relix's", () => {
    expect(ids(orderConsoles(platforms, []))).toEqual(['psx', 'ps2', 'psp', 'snes', 'n64'])
  })

  it('the chosen order, and the consoles it doesn\'t name at the end (a new one, say)', () => {
    expect(ids(orderConsoles(platforms, ['n64', 'psx', 'ps2', 'snes']))).toEqual(['n64', 'psx', 'ps2', 'snes', 'psp'])
  })

  it('moves one a place, and at the ends it stays', () => {
    const all = ['psx', 'ps2', 'psp']
    expect(moveConsole(all, 'ps2', -1)).toEqual(['ps2', 'psx', 'psp'])
    expect(moveConsole(all, 'ps2', 1)).toEqual(['psx', 'psp', 'ps2'])
    expect(moveConsole(all, 'psx', -1)).toBe(all)
    expect(moveConsole(all, 'psp', 1)).toBe(all)
    expect(moveConsole(all, 'gc', 1)).toBe(all)
  })

  it('what was saved is cleaned: known ids, once each', () => {
    const known = ['psx', 'ps2', 'psp']
    expect(cleanConsoleOrder(['ps2', 'psx', 'ps2', 'dos', 7, null], known)).toEqual(['ps2', 'psx'])
    expect(cleanConsoleOrder('psx', known)).toEqual([])
    expect(cleanConsoleOrder(undefined, known)).toEqual([])
  })

  it("knows when it's back to Relix's order", () => {
    expect(isDefaultOrder(['psx', 'ps2'], ['psx', 'ps2'])).toBe(true)
    expect(isDefaultOrder(['ps2', 'psx'], ['psx', 'ps2'])).toBe(false)
  })
})
