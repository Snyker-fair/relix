import { describe, expect, it } from 'vitest'
import { plural, scanSummary, timeAgo } from '../src/lib/ui/format.js'

describe('timeAgo', () => {
  const now = Date.UTC(2026, 9, 15, 12, 0)
  it.each([
    [now - 20_000, 'hace un momento'],
    [now - 5 * 60_000, 'hace 5 min'],
    [now - 3 * 3_600_000, 'hace 3 h'],
    [now - 30 * 3_600_000, 'ayer'],
    [now - 4 * 86_400_000, 'hace 4 días'],
  ])('%s -> %s', (ts, text) => {
    expect(timeAgo(ts, now)).toBe(text)
  })
})

describe('scanSummary', () => {
  it('sin cambios', () => {
    expect(scanSummary('PS2', { added: 0, removed: 0, total: 12 })).toBe('PS2: sin cambios (12 juegos)')
  })
  it('nuevos y quitados', () => {
    expect(scanSummary('PS2', { added: 3, removed: 1, total: 14 })).toBe('PS2: 3 juegos nuevos y 1 quitado (14 en total)')
  })
  it('solo uno nuevo', () => {
    expect(scanSummary('PSP', { added: 1, removed: 0, total: 1 })).toBe('PSP: 1 juego nuevo (1 en total)')
  })
  it('solo quitados', () => {
    expect(scanSummary('PS1', { added: 0, removed: 2, total: 5 })).toBe('PS1: 2 juegos quitados (5 en total)')
  })
  it('plural', () => {
    expect(plural(1, 'consola', 'consolas')).toBe('1 consola')
  })
})
