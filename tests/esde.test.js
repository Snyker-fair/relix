import { describe, expect, it } from 'vitest'
import psxXml from '../src/mock/gamelists/psx/gamelist.xml?raw'
import {
  fileStem,
  mediaCandidates,
  mediaUrl,
  parseGamelist,
  parseYear,
  romAbsolutePath,
} from '../src/lib/core/esde.js'

describe('parseGamelist', () => {
  const games = parseGamelist(psxXml, 'psx')

  it('reads the games and skips the hidden ones', () => {
    expect(games).toHaveLength(9)
    expect(games.some((g) => g.name === 'Herramienta oculta')).toBe(false)
  })

  it('sorts alphabetically', () => {
    const names = games.map((g) => g.sortName)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')))
  })

  it('normalizes the path, the year and the favorites', () => {
    const ff7 = games.find((g) => g.name === 'Final Fantasy VII')
    expect(ff7.path).toBe('Final Fantasy VII (USA)/Final Fantasy VII (USA).m3u')
    expect(ff7.id).toBe('psx/Final Fantasy VII (USA)/Final Fantasy VII (USA).m3u')
    expect(ff7.year).toBe(1997)
    expect(ff7.favorite).toBe(true)
    expect(ff7.developer).toBe('Square')
  })

  it('uses the file name if the game has no <name>', () => {
    const [g] = parseGamelist('<gameList><game><path>./Sin Nombre (USA).chd</path></game></gameList>', 'psx')
    expect(g.name).toBe('Sin Nombre (USA)')
  })

  it('rejects broken XML with a message that names the system', () => {
    expect(() => parseGamelist('<gameList><game>', 'ps2')).toThrow(/ps2/)
  })
})

describe('paths', () => {
  const game = parseGamelist(psxXml, 'psx').find((g) => g.name === 'Final Fantasy VII')

  it('builds the absolute path on the console', () => {
    expect(romAbsolutePath('E:\\roms\\', game)).toBe(
      'E:\\roms\\psx\\Final Fantasy VII (USA)\\Final Fantasy VII (USA).m3u',
    )
  })

  it("suggests ES-DE's cover paths, keeping subfolders", () => {
    expect(mediaCandidates('E:\\ES-DE\\downloaded_media', game, 'covers')[0]).toBe(
      'E:\\ES-DE\\downloaded_media\\psx\\covers\\Final Fantasy VII (USA)\\Final Fantasy VII (USA).png',
    )
  })

  it('builds the cover URL the shell serves, without an extension and escaped', () => {
    expect(mediaUrl('https://relix.example/media/', game, 'covers')).toBe(
      'https://relix.example/media/psx/covers/Final%20Fantasy%20VII%20(USA)/Final%20Fantasy%20VII%20(USA)',
    )
  })

  it('escapes characters that would break the URL', () => {
    const [g] = parseGamelist('<gameList><game><path>./Ratchet &amp; Clank #1?.chd</path></game></gameList>', 'ps2')
    expect(mediaUrl('https://relix.example/media', g, 'covers')).toBe(
      'https://relix.example/media/ps2/covers/Ratchet%20%26%20Clank%20%231%3F',
    )
  })

  it('helpers', () => {
    expect(fileStem('./a/b/Okami (USA).chd')).toBe('Okami (USA)')
    expect(parseYear('20060919T000000')).toBe(2006)
    expect(parseYear('')).toBeNull()
  })
})
