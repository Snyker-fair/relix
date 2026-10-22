import { describe, expect, it } from 'vitest'
import { indexSaves, saveName, savesFor } from '../src/lib/core/saves.js'

const day = 24 * 3_600_000
const file = (/** @type {string} */ path, /** @type {number} */ modified) => ({ path, size: 1024, modified })

describe("RetroArch's saves", () => {
  it('tells a save, a quick save and its picture apart', () => {
    expect(saveName('Crash Bandicoot (USA).srm')).toEqual({ stem: 'Crash Bandicoot (USA)', kind: 'save' })
    expect(saveName('Crash Bandicoot (USA).state')).toEqual({ stem: 'Crash Bandicoot (USA)', kind: 'state' })
    expect(saveName('Crash Bandicoot (USA).state12')).toEqual({ stem: 'Crash Bandicoot (USA)', kind: 'state' })
    expect(saveName('Crash Bandicoot (USA).state.auto')).toEqual({ stem: 'Crash Bandicoot (USA)', kind: 'state' })
    expect(saveName('Crash Bandicoot (USA).state3.png')).toEqual({ stem: 'Crash Bandicoot (USA)', kind: 'picture' })
    expect(saveName('Super Mario 64 (USA).eep')).toEqual({ stem: 'Super Mario 64 (USA)', kind: 'save' })
    // a dot in the name stays in the name
    expect(saveName('Dr. Mario 64 (USA).srm')?.stem).toBe('Dr. Mario 64 (USA)')
    expect(saveName('retroarch.cfg')).toBeNull()
    expect(saveName('.srm')).toBeNull()
  })

  it("a game's saves: the newest save, how many quick saves and the newest one's picture", () => {
    const now = Date.parse('2026-10-22T12:00:00Z')
    const index = indexSaves([
      file('saves/Crash Bandicoot (USA).srm', now - 3 * day),
      file('saves/SwanStation/Crash Bandicoot (USA).srm', now - 4 * day),
      file('states/SwanStation/Crash Bandicoot (USA).state1', now - 5 * day),
      file('states/SwanStation/Crash Bandicoot (USA).state1.png', now - 5 * day),
      file('states/SwanStation/Crash Bandicoot (USA).state2', now - 2 * 3_600_000),
      file('states/SwanStation/Crash Bandicoot (USA).state2.png', now - 2 * 3_600_000),
      file('saves/Spyro the Dragon (USA).srm', now - day),
      file('saves/retroarch.cfg', now),
    ])
    expect(savesFor({ path: 'Crash Bandicoot (USA).chd' }, index)).toEqual({
      save: now - 3 * day,
      states: 2,
      lastState: now - 2 * 3_600_000,
      picture: { path: 'states/SwanStation/Crash Bandicoot (USA).state2.png', size: 1024, modified: now - 2 * 3_600_000 },
    })
    // only its own save: no quick saves, no picture
    expect(savesFor({ path: 'Spyro the Dragon (USA).chd' }, index)).toEqual({ save: now - day, states: 0, lastState: null, picture: null })
    expect(savesFor({ path: 'Tekken 3 (USA).chd' }, index)).toBeNull()
  })

  it('a game with several discs is saved under its .m3u, and letter case doesn’t matter', () => {
    const index = indexSaves([file('saves/final fantasy vii (usa).srm', 10)])
    expect(savesFor({ path: 'Final Fantasy VII (USA)/Final Fantasy VII (USA).m3u' }, index)?.save).toBe(10)
  })

  it('only pictures (the quick saves were deleted): nothing to show', () => {
    const index = indexSaves([file('states/Game.state1.png', 10)])
    expect(savesFor({ path: 'Game.sfc' }, index)).toBeNull()
  })
})
