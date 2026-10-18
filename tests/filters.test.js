import { describe, expect, it } from 'vitest'
import { applyFilter, filterLabel, filterOptions, genresOf, maxPlayers, sameFilter } from '../src/lib/core/filters.js'

const games = [
  { id: 'a', genre: 'Plataformas', players: '1' },
  { id: 'b', genre: 'Acción / Plataformas', players: '1-2' },
  { id: 'c', genre: 'Lucha, Arcade', players: '1 - 2' },
  { id: 'd', genre: 'lucha', players: '' },
  { id: 'e', genre: '', players: '1-4' },
  { id: 'f' },
]

describe('library filters', () => {
  it('splits compound genres', () => {
    expect(genresOf('Acción / Plataformas')).toEqual(['Acción', 'Plataformas'])
    expect(genresOf('Lucha, Arcade')).toEqual(['Lucha', 'Arcade'])
    expect(genresOf('Shoot\'em up - Vertical')).toEqual(["Shoot'em up", 'Vertical'])
    expect(genresOf(undefined)).toEqual([])
  })

  it('reads how many play', () => {
    expect(maxPlayers('1-2')).toBe(2)
    expect(maxPlayers('1 - 4')).toBe(4)
    expect(maxPlayers('2')).toBe(2)
    expect(maxPlayers('')).toBe(0)
    expect(maxPlayers(undefined)).toBe(0)
  })

  it('offers the genres from most to fewest games and the 2-or-more ones', () => {
    const { genres, multiplayer } = filterOptions(games)
    expect(genres).toEqual([
      { name: 'Lucha', count: 2 },
      { name: 'Plataformas', count: 2 },
      { name: 'Acción', count: 1 },
      { name: 'Arcade', count: 1 },
    ])
    expect(multiplayer).toBe(3)
  })

  it('filters by genre (ignoring case and accents) or by players', () => {
    expect(applyFilter(games, { kind: 'genre', value: 'Plataformas' }).map((g) => g.id)).toEqual(['a', 'b'])
    expect(applyFilter(games, { kind: 'genre', value: 'accion' }).map((g) => g.id)).toEqual(['b'])
    expect(applyFilter(games, { kind: 'players' }).map((g) => g.id)).toEqual(['b', 'c', 'e'])
    expect(applyFilter(games, null)).toBe(games)
  })

  it('name and comparison', () => {
    expect(filterLabel({ kind: 'players' })).toBe('2 o más jugadores')
    expect(filterLabel({ kind: 'genre', value: 'Lucha' })).toBe('Lucha')
    expect(sameFilter({ kind: 'genre', value: 'Acción' }, { kind: 'genre', value: 'accion' })).toBe(true)
    expect(sameFilter(null, undefined)).toBe(true)
    expect(sameFilter({ kind: 'players' }, null)).toBe(false)
  })
})
