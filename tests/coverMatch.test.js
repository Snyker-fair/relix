import { describe, expect, it } from 'vitest'
import {
  buildCoverIndex,
  coverCandidates,
  coverKey,
  coverQuery,
  libretroSafeName,
  matchCover,
  regionLabel,
  remoteCoverUrl,
  titleKey,
} from '../src/lib/core/coverMatch.js'
// Real names from libretro-thumbnails (a sample per console)
import names from '../src/mock/libretro-names.json'

const ps2 = buildCoverIndex(names.ps2)
const psx = buildCoverIndex(names.psx)
const gc = buildCoverIndex(names.gc)

describe('titleKey', () => {
  it('ignores region, case, underscores, articles and Roman numerals', () => {
    expect(titleKey('Kingdom Hearts II (USA)')).toBe('kingdom hearts 2')
    expect(titleKey('kingdom_hearts_2')).toBe('kingdom hearts 2')
    expect(titleKey('Legend of Zelda, The - The Wind Waker (USA)')).toBe('legend of zelda wind waker')
    expect(titleKey('The Legend of Zelda: The Wind Waker')).toBe('legend of zelda wind waker')
  })

  it('treats "&" as "and" and removes apostrophes and accents', () => {
    expect(titleKey('Ratchet & Clank')).toBe(titleKey('Ratchet and Clank'))
    expect(titleKey("Bug's Life, A (USA)")).toBe('bugs life')
    expect(titleKey('Pokémon Colosseum')).toBe('pokemon colosseum')
  })
})

describe('libretroSafeName', () => {
  it("replaces the characters libretro doesn't use in files", () => {
    expect(libretroSafeName('Ratchet & Clank (USA)')).toBe('Ratchet _ Clank (USA)')
    expect(libretroSafeName('Ocarina of Time / Master Quest')).toBe('Ocarina of Time _ Master Quest')
  })
})

describe('matchCover', () => {
  it('finds the exact name (files with the standard name)', () => {
    expect(matchCover('Kingdom Hearts (USA)', ps2)).toEqual({ name: 'Kingdom Hearts (USA)', how: 'exact' })
    expect(matchCover('resident evil 4 (usa) (disc 1)', gc)).toEqual({
      name: 'Resident Evil 4 (USA) (Disc 1)',
      how: 'exact',
    })
  })

  it('finds by title with simplified names', () => {
    expect(matchCover('kingdom_hearts_2', ps2)).toEqual({ name: 'Kingdom Hearts II (USA)', how: 'title' })
    expect(matchCover('The Legend of Zelda - The Wind Waker', gc)?.name).toBe(
      'Legend of Zelda, The - The Wind Waker (USA)',
    )
  })

  it("uses the preferred region when the file doesn't name its own", () => {
    expect(matchCover('Kingdom Hearts', ps2)?.name).toBe('Kingdom Hearts (USA)')
    expect(matchCover('Kingdom Hearts', ps2, { region: 'europe' })?.name).toBe('Kingdom Hearts (Spain)')
    expect(matchCover('Kingdom Hearts', ps2, { region: 'japan' })?.name).toBe('Kingdom Hearts (Japan)')
  })

  it("respects the file's region over the preferred one", () => {
    expect(matchCover('kingdom hearts (Germany)', ps2)?.name).toBe('Kingdom Hearts (Germany)')
  })

  it('avoids betas, demos and discs 2+', () => {
    const gt4 = matchCover('Gran Turismo 4', ps2)?.name ?? ''
    expect(gt4).toMatch(/^Gran Turismo 4 \(USA/)
    expect(gt4).not.toMatch(/Beta|Taikenban/)
    expect(matchCover('Final Fantasy VII', psx)?.name).not.toMatch(/Disc [23]/)
  })

  it("tries ES-DE's name if the file has an odd name", () => {
    expect(matchCover('kh2', ps2)).toBeNull()
    expect(matchCover('kh2', ps2, { altTitle: 'Kingdom Hearts II' })?.name).toBe('Kingdom Hearts II (USA)')
  })

  it("doesn't make things up: a nickname without a safe match returns null", () => {
    expect(matchCover('Persona 4 (USA)', ps2)).toBeNull()
    expect(matchCover('GT4', ps2)).toBeNull()
  })
})

describe('coverCandidates', () => {
  it('offers the right title first for nicknames and short names', () => {
    expect(coverCandidates('Persona 4 (USA)', ps2)[0]).toEqual({
      name: 'Shin Megami Tensei - Persona 4 (USA)',
      title: 'Shin Megami Tensei - Persona 4',
      region: 'EE. UU.',
    })
  })

  it('tolerates a one-letter difference (Okami / Ookami)', () => {
    expect(coverCandidates('Okami (USA)', ps2)[0].name).toBe('Ookami (USA)')
  })

  it("doesn't suggest games that only share a number", () => {
    const titles = coverCandidates('Persona 4', ps2).map((c) => c.title)
    expect(titles.some((t) => t.startsWith('Gran Turismo'))).toBe(false)
  })

  it('returns one version per title and respects the limit', () => {
    const list = coverCandidates('Kingdom Hearts', ps2, { limit: 3 })
    expect(list).toHaveLength(3)
    expect(new Set(list.map((c) => c.title)).size).toBe(3)
  })

  it("stays empty if there's nothing similar", () => {
    expect(coverCandidates('GT4', ps2)).toEqual([])
  })
})

describe('coverQuery and coverKey', () => {
  it('uses the file, or the folder on Wii U', () => {
    expect(coverQuery({ path: 'Okami (USA).chd' })).toBe('Okami (USA)')
    expect(coverQuery({ path: 'Xenoblade Chronicles X (USA)/code/game.rpx' })).toBe('Xenoblade Chronicles X (USA)')
  })

  it("saves the cover with the game's path without its extension, like ES-DE", () => {
    expect(coverKey({ path: 'Okami (USA).chd' })).toBe('Okami (USA)')
    expect(coverKey({ path: 'Final Fantasy VII (USA)/Final Fantasy VII (USA).m3u' })).toBe(
      'Final Fantasy VII (USA)/Final Fantasy VII (USA)',
    )
  })
})

describe('regionLabel y remoteCoverUrl', () => {
  it('translates the region', () => {
    expect(regionLabel('Ookami (Europe) (En,Fr,De)')).toBe('Europa')
    expect(regionLabel('Kingdom Hearts (USA)')).toBe('EE. UU.')
    expect(regionLabel('Juego sin región')).toBe('')
  })

  it('builds the libretro server URL', () => {
    expect(remoteCoverUrl('Sony - PlayStation 2', 'Ratchet _ Clank (USA) (En,Fr,De,Es,It)')).toBe(
      'https://thumbnails.libretro.com/Sony%20-%20PlayStation%202/Named_Boxarts/Ratchet%20_%20Clank%20(USA)%20(En%2CFr%2CDe%2CEs%2CIt).png',
    )
  })
})
