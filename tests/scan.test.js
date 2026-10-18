import { describe, expect, it } from 'vitest'
import ps2Xml from '../src/mock/gamelists/ps2/gamelist.xml?raw'
import { parseGamelist } from '../src/lib/core/esde.js'
import { getPlatform } from '../src/lib/core/platforms.js'
import { cleanTitle, gamesFromFiles, mergeWithGamelist } from '../src/lib/core/scan.js'

const names = (/** @type {any[]} */ games) => games.map((g) => g.name)

describe('cleanTitle', () => {
  it('removes region, version and dump marks', () => {
    expect(cleanTitle('Crash Bandicoot (USA) (Rev 1) [!]')).toBe('Crash Bandicoot')
  })
  it('moves the article to the front and uses ":" for the subtitle', () => {
    expect(cleanTitle('Legend of Zelda, The - The Wind Waker (USA)')).toBe('The Legend of Zelda: The Wind Waker')
    expect(cleanTitle('Burnout 3 - Takedown (USA)')).toBe('Burnout 3: Takedown')
  })
  it('changes underscores to spaces', () => {
    expect(cleanTitle('Shadow_of_the_Colossus')).toBe('Shadow of the Colossus')
  })
  it('if there are only tags, it keeps the original name', () => {
    expect(cleanTitle('(Homebrew)')).toBe('(Homebrew)')
  })
})

describe('gamesFromFiles', () => {
  it("lists only the console's formats", () => {
    const games = gamesFromFiles(
      ['Okami (USA).chd', 'Okami (USA).sav', 'notas.txt', 'Burnout 3 (USA).ISO', 'Ratchet (USA).cso'],
      getPlatform('ps2'),
    )
    expect(names(games)).toEqual(['Burnout 3', 'Okami', 'Ratchet'])
    expect(games[1]).toMatchObject({ id: 'ps2/Okami (USA).chd', path: 'Okami (USA).chd', system: 'ps2' })
  })

  it("PS1: the .cue shows up and its .bin doesn't", () => {
    const games = gamesFromFiles(['Crash Bandicoot (USA).cue', 'Crash Bandicoot (USA).bin'], getPlatform('psx'))
    expect(games.map((g) => g.path)).toEqual(['Crash Bandicoot (USA).cue'])
  })

  it('several discs with .m3u: only the .m3u', () => {
    const games = gamesFromFiles(
      [
        'Final Fantasy VII (USA)/Final Fantasy VII (USA).m3u',
        'Final Fantasy VII (USA)/Final Fantasy VII (USA) (Disc 1).chd',
        'Final Fantasy VII (USA)/Final Fantasy VII (USA) (Disc 2).chd',
        'Final Fantasy VII (USA)/Final Fantasy VII (USA) (Disc 3).chd',
      ],
      getPlatform('psx'),
    )
    expect(games).toHaveLength(1)
    expect(games[0]).toMatchObject({ name: 'Final Fantasy VII', path: 'Final Fantasy VII (USA)/Final Fantasy VII (USA).m3u' })
  })

  it('several discs without .m3u: only disc 1', () => {
    const games = gamesFromFiles(
      ['Metal Gear Solid (USA) (Disc 1).chd', 'Metal Gear Solid (USA) (Disc 2).chd'],
      getPlatform('psx'),
    )
    expect(games.map((g) => [g.name, g.path])).toEqual([['Metal Gear Solid', 'Metal Gear Solid (USA) (Disc 1).chd']])
  })

  it("Wii U in folders: takes the folder's name and ignores other .rpx files", () => {
    const games = gamesFromFiles(
      ['Bayonetta 2 [AQUE01]/code/Bayonetta2.rpx', 'suelto.rpx', 'Pikmin 3 (USA).wua'],
      getPlatform('wiiu'),
    )
    expect(names(games)).toEqual(['Bayonetta 2', 'Pikmin 3'])
  })

  it('if two games have the same name, it adds the region', () => {
    const games = gamesFromFiles(['Kingdom Hearts (USA).iso', 'Kingdom Hearts (Europe).iso'], getPlatform('ps2'))
    expect(names(games)).toEqual(['Kingdom Hearts (Europe)', 'Kingdom Hearts (USA)'])
  })
})

describe('mergeWithGamelist', () => {
  const listed = parseGamelist(
    ps2Xml.replace('</gameList>', '<game><path>./Oculto (USA).chd</path><name>Oculto</name><hidden>true</hidden></game></gameList>'),
    'ps2',
    { includeHidden: true },
  )

  it("uses ES-DE's data when the file exists and the file's name when it doesn't", () => {
    const scanned = gamesFromFiles(['okami (usa).chd', 'Juego Nuevo (USA).iso'], getPlatform('ps2'))
    const games = mergeWithGamelist(listed, scanned)
    expect(names(games)).toEqual(['Juego Nuevo', 'Ōkami'])
    const okami = games.find((g) => g.name === 'Ōkami')
    expect(okami).toMatchObject({ year: 2006, favorite: true, path: 'okami (usa).chd', id: 'ps2/okami (usa).chd' })
  })

  it("doesn't show the hidden ones or the entries without a file", () => {
    const scanned = gamesFromFiles(['Oculto (USA).chd', 'Persona 4 (USA).chd'], getPlatform('ps2'))
    expect(names(mergeWithGamelist(listed, scanned))).toEqual(['Persona 4'])
  })
})

describe('new consoles', () => {
  it('Xbox 360 and Dreamcast in folders: the name comes from the folder', async () => {
    const { getPlatform } = await import('../src/lib/core/platforms.js')
    const x360 = gamesFromFiles(['Halo 3 (USA)/default.xex', 'Forza Motorsport 4 (USA).iso'], getPlatform('xbox360'))
    expect(x360.map((g) => g.name)).toEqual(['Forza Motorsport 4', 'Halo 3'])
    const dc = gamesFromFiles(['Shenmue (USA)/disc.gdi', 'Shenmue (USA)/track01.bin', 'Jet Grind Radio (USA).cdi'], getPlatform('dreamcast'))
    expect(dc.map((g) => g.name)).toEqual(['Jet Grind Radio', 'Shenmue'])
  })

  it('cartridges in zip files', async () => {
    const { getPlatform } = await import('../src/lib/core/platforms.js')
    const snes = gamesFromFiles(['Super Metroid (Japan, USA) (En,Ja).sfc', 'Chrono Trigger (USA).zip', 'notas.txt'], getPlatform('snes'))
    expect(snes.map((g) => g.name)).toEqual(['Chrono Trigger', 'Super Metroid'])
  })
})
