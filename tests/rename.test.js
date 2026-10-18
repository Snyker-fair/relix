import { describe, expect, it } from 'vitest'
import { buildCoverIndex, fromLibretroName, nameCandidates } from '../src/lib/core/coverMatch.js'
import { checkName, planRename, renameInCollection, renameInUserData, renameTarget } from '../src/lib/core/rename.js'

describe('what a rename changes', () => {
  it('a file: the file, its images, its gamelist entry and its saves', () => {
    const { plan } = planRename({ path: 'kingdom_hearts_2.iso' }, 'Kingdom Hearts II (USA)', ['kingdom_hearts_2.iso'])
    expect(plan).toEqual({
      kind: 'file',
      newPath: 'Kingdom Hearts II (USA).iso',
      files: [{ from: 'kingdom_hearts_2.iso', to: 'Kingdom Hearts II (USA).iso' }],
      media: [{ from: 'kingdom_hearts_2', to: 'Kingdom Hearts II (USA)', folder: false }],
      gamelist: [{ from: 'kingdom_hearts_2.iso', to: 'Kingdom Hearts II (USA).iso', folder: false }],
      saves: [{ from: 'kingdom_hearts_2', to: 'Kingdom Hearts II (USA)' }],
    })
  })

  it('keeps the subfolder and the extension as they are', () => {
    const { plan } = planRename({ path: 'RPG/ff9.CHD' }, 'Final Fantasy IX (USA)', ['RPG/ff9.CHD'])
    expect(plan?.newPath).toBe('RPG/Final Fantasy IX (USA).CHD')
    expect(plan?.media).toEqual([{ from: 'RPG/ff9', to: 'RPG/Final Fantasy IX (USA)', folder: false }])
  })

  it('a game in a folder (Xbox 360, Wii U): the folder is renamed', () => {
    const xbox = planRename({ path: 'halo3/default.xex' }, 'Halo 3 (USA)', ['halo3/default.xex', 'halo3/media/a.bin'])
    expect(xbox.plan).toMatchObject({
      kind: 'folder',
      newPath: 'Halo 3 (USA)/default.xex',
      files: [{ from: 'halo3', to: 'Halo 3 (USA)' }],
      media: [{ from: 'halo3', to: 'Halo 3 (USA)', folder: true }],
      saves: [],
    })
    const wiiu = planRename({ path: 'Zelda [ABC]/code/zelda.rpx' }, 'The Legend of Zelda (USA)', [])
    expect(wiiu.plan?.newPath).toBe('The Legend of Zelda (USA)/code/zelda.rpx')
    expect(renameTarget({ path: 'Zelda [ABC]/code/zelda.rpx' })).toMatchObject({ kind: 'folder', name: 'Zelda [ABC]' })
  })

  it('disc 1 without an .m3u: every disc moves, with its own number', () => {
    const files = ['ff7 (Disc 1).chd', 'ff7 (Disc 2).chd', 'ff7 (Disc 3).chd', 'other (Disc 1).chd']
    const { plan } = planRename({ path: 'ff7 (Disc 1).chd' }, 'Final Fantasy VII (USA) (Disc 1)', files)
    expect(plan?.newPath).toBe('Final Fantasy VII (USA) (Disc 1).chd')
    expect(plan?.files.map((r) => r.to)).toEqual([
      'Final Fantasy VII (USA) (Disc 1).chd',
      'Final Fantasy VII (USA) (Disc 2).chd',
      'Final Fantasy VII (USA) (Disc 3).chd',
    ])
    // a name without a disc tag gets one for each disc
    const plain = planRename({ path: 'ff7 (Disc 1).chd' }, 'Final Fantasy VII (USA)', files)
    expect(plain.plan?.files[1].to).toBe('Final Fantasy VII (USA) (Disc 2).chd')
  })

  it('a .cue moves without its .bin, and an .m3u without its discs (they point to them by name)', () => {
    const cue = planRename({ path: 'ff7 (Disc 1).cue' }, 'FF7 (Disc 1)', ['ff7 (Disc 1).cue', 'ff7 (Disc 1).bin', 'ff7 (Disc 2).cue'])
    expect(cue.plan?.files.map((r) => r.from)).toEqual(['ff7 (Disc 1).cue', 'ff7 (Disc 2).cue'])
    const m3u = planRename({ path: 'ff7.m3u' }, 'Final Fantasy VII (USA)', ['ff7.m3u', 'ff7 (Disc 1).chd'])
    expect(m3u.plan?.files).toEqual([{ from: 'ff7.m3u', to: 'Final Fantasy VII (USA).m3u' }])
  })

  it("doesn't take another file's name; a case-only change is fine", () => {
    const files = ['okami.chd', 'Okami (USA).chd']
    expect(planRename({ path: 'okami.chd' }, 'Okami (USA)', files).error).toBe('exists')
    expect(planRename({ path: 'okami.chd' }, 'OKAMI', files).plan?.newPath).toBe('OKAMI.chd')
    expect(planRename({ path: 'halo/default.xex' }, 'Halo 3', ['halo/default.xex', 'Halo 3/default.xex']).error).toBe('exists')
  })

  it('names Windows rejects', () => {
    expect(checkName('  ')).toBe('empty')
    expect(checkName('Halo: Reach')).toBe('chars')
    expect(checkName('a/b')).toBe('chars')
    expect(checkName('CON')).toBe('reserved')
    expect(checkName('Okami.')).toBe('dot')
    expect(checkName('x'.repeat(121))).toBe('long')
    expect(checkName('Ratchet & Clank (USA) (Rev 1)')).toBeNull()
    expect(planRename({ path: 'okami.chd' }, 'okami', ['okami.chd']).error).toBe('same')
  })
})

describe('Relix data that moves with the game', () => {
  it('only the keys with the old id change', () => {
    const values = {
      favorites: { 'ps2/okami.chd': true, 'ps2/other.chd': false },
      playtime: { 'ps2/okami.chd': { seconds: 600, plays: 2 } },
      lastPlayed: { 'ps2/other.chd': 5 },
      recent: ['ps2/other.chd', 'ps2/okami.chd'],
      hidden: [],
      session: { id: 'ps2/okami.chd', startedAt: 9 },
      coverChoices: { ps2: ['ps2/okami.chd'], psx: ['psx/a.chd'] },
      gameEmulators: { 'ps2/okami.chd': 'xbsx2' },
      settings: { theme: 'dark' },
    }
    expect(renameInUserData(values, 'ps2/okami.chd', 'ps2/Okami (USA).chd')).toEqual({
      favorites: { 'ps2/other.chd': false, 'ps2/Okami (USA).chd': true },
      playtime: { 'ps2/Okami (USA).chd': { seconds: 600, plays: 2 } },
      recent: ['ps2/other.chd', 'ps2/Okami (USA).chd'],
      session: { id: 'ps2/Okami (USA).chd', startedAt: 9 },
      coverChoices: { ps2: ['ps2/Okami (USA).chd'], psx: ['psx/a.chd'] },
      gameEmulators: { 'ps2/Okami (USA).chd': 'xbsx2' },
    })
  })

  it('collections keep the line in its place', () => {
    const folders = new Map([['ps2', 'ps2']])
    const lines = ['%ROMPATH%/ps2/first.chd', '%ROMPATH%/ps2/okami.chd', 'E:/other/drive.iso']
    expect(renameInCollection(lines, { system: 'ps2', path: 'okami.chd' }, 'Okami (USA).chd', 'ps2', folders)).toEqual([
      '%ROMPATH%/ps2/first.chd',
      '%ROMPATH%/ps2/Okami (USA).chd',
      'E:/other/drive.iso',
    ])
    expect(renameInCollection(lines, { system: 'ps2', path: 'gt4.iso' }, 'x.iso', 'ps2', folders)).toBeNull()
  })
})

describe('standard names to choose from', () => {
  const index = buildCoverIndex([
    'Kingdom Hearts II (USA)',
    'Kingdom Hearts II (Europe) (En,Fr,De,Es,It)',
    'Kingdom Hearts (USA)',
    'Final Fantasy VII (USA) (Disc 1)',
    'Final Fantasy VII (USA) (Disc 2)',
    'Final Fantasy VII (Europe) (Disc 1)',
    'Ratchet _ Clank (USA)',
  ])

  it('every version of the closest title, the safe match first', () => {
    const names = nameCandidates('kingdom_hearts_2', index).map((c) => c.name)
    expect(names.slice(0, 2)).toEqual(['Kingdom Hearts II (USA)', 'Kingdom Hearts II (Europe) (En,Fr,De,Es,It)'])
    expect(nameCandidates('kingdom hearts 2 (Europe)', index)[0].name).toBe('Kingdom Hearts II (Europe) (En,Fr,De,Es,It)')
  })

  it('a disc file gets its own disc; an .m3u gets the name without a disc', () => {
    expect(nameCandidates('final_fantasy_7 (Disc 2)', index).map((c) => c.name)).toEqual(['Final Fantasy VII (USA) (Disc 2)'])
    expect(nameCandidates('final fantasy 7', index).map((c) => c.name)).toEqual([
      'Final Fantasy VII (USA)',
      'Final Fantasy VII (Europe)',
    ])
  })

  it('"&" comes back from libretro\'s "_"', () => {
    expect(fromLibretroName('Ratchet _ Clank (USA)')).toBe('Ratchet & Clank (USA)')
    expect(nameCandidates('ratchet and clank', index)[0].name).toBe('Ratchet & Clank (USA)')
  })
})

describe('paths after a rename', async () => {
  const { movedPath } = await import('../src/lib/core/rename.js')
  it('the renamed files, and everything inside a renamed folder', () => {
    const file = [{ from: 'ff7 (Disc 1).chd', to: 'FF7 (Disc 1).chd' }]
    expect(movedPath('ff7 (disc 1).chd', file)).toBe('FF7 (Disc 1).chd')
    expect(movedPath('other.chd', file)).toBeNull()
    const folder = [{ from: 'halo3', to: 'Halo 3 (USA)', folder: true }]
    expect(movedPath('halo3/default.xex', folder)).toBe('Halo 3 (USA)/default.xex')
    expect(movedPath('halo3x/default.xex', folder)).toBeNull()
  })
})
