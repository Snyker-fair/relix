import { describe, expect, it } from 'vitest'
import { coverSummary, plural, scanSummary, timeAgo } from '../src/lib/ui/format.js'

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

describe('coverSummary', () => {
  const none = { saved: 0, failed: 0, toChoose: 0, notFound: 0 }
  it('nada que buscar', () => {
    expect(coverSummary('PS2', none)).toBe('PS2: ya tenías todas las portadas')
  })
  it('junta solo lo que pasó', () => {
    expect(coverSummary('PS2', { ...none, saved: 7, toChoose: 2 })).toBe('PS2: 7 portadas nuevas · 2 para elegir a mano')
    expect(coverSummary('PSP', { saved: 1, failed: 1, toChoose: 0, notFound: 3 })).toBe(
      'PSP: 1 portada nueva · 3 sin resultados · 1 no se pudo bajar',
    )
  })
})
