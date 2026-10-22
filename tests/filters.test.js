import { describe, expect, it } from 'vitest'
import { applyFilter, filterLabel, filterOptions, genresOf, sameFilter } from '../src/lib/core/filters.js'

const games = [
  { id: 'a', genre: 'Plataformas' },
  { id: 'b', genre: 'Acción / Plataformas' },
  { id: 'c', genre: 'Lucha, Arcade' },
  { id: 'd', genre: 'lucha' },
  { id: 'e', genre: '' },
  { id: 'f' },
]

describe('library filters', () => {
  it('splits compound genres', () => {
    expect(genresOf('Acción / Plataformas')).toEqual(['Acción', 'Plataformas'])
    expect(genresOf('Lucha, Arcade')).toEqual(['Lucha', 'Arcade'])
    expect(genresOf('Shoot\'em up - Vertical')).toEqual(["Shoot'em up", 'Vertical'])
    expect(genresOf(undefined)).toEqual([])
  })

  it('offers the genres from most to fewest games, and nothing by players', () => {
    const options = filterOptions(games)
    const { genres } = options
    expect(genres).toEqual([
      { name: 'Lucha', count: 2 },
      { name: 'Plataformas', count: 2 },
      { name: 'Acción', count: 1 },
      { name: 'Arcade', count: 1 },
    ])
    // the number of players is often wrong (fighting games that say 1): no filter for it
    expect(Object.keys(options)).toEqual(['genres'])
  })

  it('filters by genre (ignoring case and accents)', () => {
    expect(applyFilter(games, { kind: 'genre', value: 'Plataformas' }).map((g) => g.id)).toEqual(['a', 'b'])
    expect(applyFilter(games, { kind: 'genre', value: 'accion' }).map((g) => g.id)).toEqual(['b'])
    expect(applyFilter(games, null)).toBe(games)
  })

  it('name and comparison', () => {
    expect(filterLabel({ kind: 'genre', value: 'Lucha' })).toBe('Lucha')
    expect(sameFilter({ kind: 'genre', value: 'Acción' }, { kind: 'genre', value: 'accion' })).toBe(true)
    expect(sameFilter(null, undefined)).toBe(true)
    expect(sameFilter({ kind: 'genre', value: 'Lucha' }, null)).toBe(false)
  })
})
