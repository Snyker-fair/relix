import { describe, expect, it } from 'vitest'
import { addNewGames, cleanNewGames, isNewGame, NEW_DAYS } from '../src/lib/core/newGames.js'
import { renameInUserData } from '../src/lib/core/rename.js'
import { isMultiplayer, togetherGames } from '../src/lib/core/together.js'
import { parseUserData, serializeUserData } from '../src/lib/core/userData.js'

const day = 24 * 3_600_000

describe('playing together', () => {
  it('a game counts if its data says 2 or more players', () => {
    expect(isMultiplayer({ players: '1-4' })).toBe(true)
    expect(isMultiplayer({ players: '2' })).toBe(true)
    expect(isMultiplayer({ players: '1' })).toBe(false)
    expect(isMultiplayer({ players: '' })).toBe(false)
    expect(isMultiplayer({})).toBe(false)
  })

  it('the likeliest first: played recently, then favorites, most played and by name', () => {
    const games = [
      { id: 'a', name: 'Bomberman', players: '1-4' },
      { id: 'b', name: 'Mario Kart', players: '1-4' },
      { id: 'c', name: 'Tekken 3', players: '1-2' },
      { id: 'd', name: 'Zelda', players: '1' },
      { id: 'e', name: 'Crash Team Racing', players: '1-4' },
      { id: 'f', name: 'Aero Fighters', players: '1-2' },
    ]
    const picked = togetherGames(games, {
      lastPlayed: { c: 50, a: 10 },
      playtime: { e: { seconds: 900 } },
      isFavorite: (g) => g.id === 'b',
    })
    expect(picked.map((g) => g.id)).toEqual(['c', 'a', 'b'])
    expect(
      togetherGames(games, { lastPlayed: {}, playtime: { e: { seconds: 900 } }, isFavorite: () => false, limit: 10 }).map((g) => g.id),
    ).toEqual(['e', 'f', 'a', 'b', 'c'])
  })
})

describe('the "New" mark', () => {
  const now = Date.parse('2026-10-22T12:00:00Z')

  it('lasts until you play it or for 14 days', () => {
    const marked = addNewGames({}, ['ps2/Okami.chd'], now)
    expect(isNewGame(marked, 'ps2/Okami.chd', {}, now + 13 * day)).toBe(true)
    expect(isNewGame(marked, 'ps2/Okami.chd', {}, now + NEW_DAYS * day)).toBe(false)
    expect(isNewGame(marked, 'ps2/Okami.chd', { 'ps2/Okami.chd': now + day }, now + 2 * day)).toBe(false)
    // played before it was marked again (it left the USB drive and came back): it's new
    expect(isNewGame(marked, 'ps2/Okami.chd', { 'ps2/Okami.chd': now - day }, now)).toBe(true)
    expect(isNewGame(marked, 'ps2/Other.chd', {}, now)).toBe(false)
  })

  it('a game already marked keeps its date', () => {
    const first = addNewGames({}, ['a'], now)
    expect(addNewGames(first, ['a', 'b'], now + day)).toEqual({ a: now, b: now + day })
  })

  it('travels in data.json and follows a renamed game', () => {
    const text = serializeUserData({ newGames: { 'ps2/kh2.iso': now } }, now)
    expect(parseUserData(text)?.values.newGames).toEqual({ 'ps2/kh2.iso': now })
    expect(renameInUserData({ newGames: { 'ps2/kh2.iso': now } }, 'ps2/kh2.iso', 'ps2/Kingdom Hearts II (USA).iso').newGames).toEqual({
      'ps2/Kingdom Hearts II (USA).iso': now,
    })
  })

  it('only the ones that still count are kept', () => {
    const stored = { a: now - day, b: now - 20 * day, c: now - day, gone: now - day, bad: 'x', zero: 0 }
    expect(cleanNewGames(stored, { now, lastPlayed: { c: now }, exists: (id) => id !== 'gone' })).toEqual({ a: now - day })
    expect(cleanNewGames(null, { now })).toEqual({})
    expect(cleanNewGames([1], { now })).toEqual({})
  })
})
