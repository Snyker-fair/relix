import { describe, expect, it } from 'vitest'
import { placeFor, returnTo } from '../src/lib/core/place.js'

describe('where you were when a game opened', () => {
  it('a library, or the home screen with its focused channel', () => {
    expect(placeFor({ name: 'library', systemId: 'ps2' }, 'ps2')).toEqual({ view: 'library', channel: 'ps2' })
    expect(placeFor({ name: 'library', systemId: 'collection:With friends' }, 'collections')).toEqual({
      view: 'library',
      channel: 'collection:With friends',
    })
    expect(placeFor({ name: 'home' }, 'psx')).toEqual({ view: 'home', channel: 'psx' })
    // from the search, home: there was no library open
    expect(placeFor({ name: 'search' }, null)).toEqual({ view: 'home', channel: null })
  })
})

describe('coming back after Relix was closed', () => {
  const okami = { id: 'ps2/Okami (USA).chd', system: 'ps2' }

  it('the same library, with the game focused', () => {
    expect(returnTo({ view: 'library', channel: 'favorites' }, okami, () => true)).toEqual({
      view: 'library',
      channel: 'favorites',
      gameId: okami.id,
    })
  })

  it("its console's library if that one no longer shows it", () => {
    const shows = (/** @type {string} */ channel) => channel === 'ps2'
    expect(returnTo({ view: 'library', channel: 'collection:With friends' }, okami, shows)).toEqual({
      view: 'library',
      channel: 'ps2',
      gameId: okami.id,
    })
    expect(returnTo({ view: 'library', channel: 'favorites' }, okami, () => false)).toEqual({ view: 'home', channel: 'ps2' })
  })

  it('the home screen on its channel', () => {
    expect(returnTo({ view: 'home', channel: 'psx' }, okami, () => true)).toEqual({ view: 'home', channel: 'psx' })
  })

  it('nothing if the game is gone or the place is odd (it comes from the USB drive)', () => {
    expect(returnTo({ view: 'library', channel: 'ps2' }, undefined, () => true)).toBeNull()
    expect(returnTo(undefined, okami, () => true)).toBeNull()
    expect(returnTo('ps2', okami, () => true)).toBeNull()
    expect(returnTo({ view: 'settings' }, okami, () => true)).toBeNull()
    expect(returnTo({ view: 'library', channel: 42 }, okami, (c) => c === 'ps2')).toEqual({
      view: 'library',
      channel: 'ps2',
      gameId: okami.id,
    })
  })
})
