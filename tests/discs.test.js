import { describe, expect, it } from 'vitest'
import { discCount, discListName, discListText, discSwapHint } from '../src/lib/core/discs.js'
import { mergeWithGamelist } from '../src/lib/core/scan.js'

describe('games on several discs', () => {
  it("the list is named like disc 1, so the emulator keeps that game's saves", () => {
    expect(discListName('RPG/Final Fantasy VII (USA) (Disc 1).chd')).toBe('Final Fantasy VII (USA) (Disc 1)')
  })

  it('one disc per line, with its full path', () => {
    expect(discListText(['E:\\roms\\psx\\FF7 (Disc 1).chd', 'E:\\roms\\psx\\FF7 (Disc 2).chd'])).toBe(
      'E:\\roms\\psx\\FF7 (Disc 1).chd\r\nE:\\roms\\psx\\FF7 (Disc 2).chd\r\n',
    )
  })

  it('counts the discs only when there are several', () => {
    expect(discCount({ discs: ['a', 'b', 'c'] })).toBe(3)
    expect(discCount({ discs: ['a'] })).toBe(0)
    expect(discCount({})).toBe(0)
  })

  it('says where to change discs: RetroArch or the emulator', () => {
    expect(discSwapHint(3, { launcher: { kind: 'retroarch' } })).toBe(
      'Tiene 3 discos: cuando pida otro, cámbialo en el menú de RetroArch › Disc Control.',
    )
    expect(discSwapHint(2, { launcher: { kind: 'standalone' } })).toMatch(/menú del emulador/)
  })

  it("ES-DE's data doesn't lose the discs", () => {
    const scanned = [{ id: 'psx/FF7 (Disc 1).chd', path: 'FF7 (Disc 1).chd', name: 'FF7', discs: ['FF7 (Disc 1).chd', 'FF7 (Disc 2).chd'] }]
    const listed = [{ id: 'psx/FF7 (Disc 1).chd', path: 'FF7 (Disc 1).chd', name: 'Final Fantasy VII', hidden: false }]
    const [game] = mergeWithGamelist(/** @type {any} */ (listed), /** @type {any} */ (scanned))
    expect(game).toMatchObject({ name: 'Final Fantasy VII', discs: ['FF7 (Disc 1).chd', 'FF7 (Disc 2).chd'] })
  })
})
