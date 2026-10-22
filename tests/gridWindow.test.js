import { describe, expect, it } from 'vitest'
import { gridWindow, jumpsTooFar } from '../src/lib/core/gridWindow.js'

const layout = { columns: 5, rows: 3 }

describe('the games a grid draws', () => {
  it('at the top: the visible rows and two more below', () => {
    expect(gridWindow(1000, 0, layout)).toEqual({ start: 0, end: 25, firstRow: 0 })
  })

  it('in the middle: two rows above and two below the visible ones', () => {
    // rows 8 to 14: 35 games out of 1,000, whatever the size of the console
    expect(gridWindow(1000, 10, layout)).toEqual({ start: 40, end: 75, firstRow: 8 })
  })

  it('at the end: it stops at the last game', () => {
    // 1,000 games are 200 rows; the last one visible on top is 199
    expect(gridWindow(1000, 199, layout)).toEqual({ start: 985, end: 1000, firstRow: 197 })
    expect(gridWindow(12, 1, layout)).toEqual({ start: 0, end: 12, firstRow: 0 })
  })

  it('a short console is drawn whole, and an empty one draws nothing', () => {
    expect(gridWindow(7, 0, layout)).toEqual({ start: 0, end: 7, firstRow: 0 })
    expect(gridWindow(0, 0, layout)).toEqual({ start: 0, end: 0, firstRow: 0 })
  })

  it('never draws more than the visible rows and the buffer', () => {
    for (const row of [0, 3, 50, 120, 199]) {
      const { start, end } = gridWindow(1000, row, layout)
      expect(end - start).toBeLessThanOrEqual(35)
    }
  })

  it('a jump by letter goes straight there; a row at a time slides', () => {
    expect(jumpsTooFar(4, 5)).toBe(false)
    expect(jumpsTooFar(5, 3)).toBe(false)
    expect(jumpsTooFar(4, 20)).toBe(true)
    expect(jumpsTooFar(20, 0)).toBe(true)
  })
})
