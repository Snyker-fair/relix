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

  it('lee los juegos y omite los ocultos', () => {
    expect(games).toHaveLength(9)
    expect(games.some((g) => g.name === 'Herramienta oculta')).toBe(false)
  })

  it('ordena alfabéticamente', () => {
    const names = games.map((g) => g.sortName)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')))
  })

  it('normaliza la ruta, el año y los favoritos', () => {
    const ff7 = games.find((g) => g.name === 'Final Fantasy VII')
    expect(ff7.path).toBe('Final Fantasy VII (USA)/Final Fantasy VII (USA).m3u')
    expect(ff7.id).toBe('psx/Final Fantasy VII (USA)/Final Fantasy VII (USA).m3u')
    expect(ff7.year).toBe(1997)
    expect(ff7.favorite).toBe(true)
    expect(ff7.developer).toBe('Square')
  })

  it('usa el nombre de archivo si el juego no tiene <name>', () => {
    const [g] = parseGamelist('<gameList><game><path>./Sin Nombre (USA).chd</path></game></gameList>', 'psx')
    expect(g.name).toBe('Sin Nombre (USA)')
  })

  it('rechaza XML roto con un mensaje que nombra el sistema', () => {
    expect(() => parseGamelist('<gameList><game>', 'ps2')).toThrow(/ps2/)
  })
})

describe('rutas', () => {
  const game = parseGamelist(psxXml, 'psx').find((g) => g.name === 'Final Fantasy VII')

  it('arma la ruta absoluta en la consola', () => {
    expect(romAbsolutePath('E:\\roms\\', game)).toBe(
      'E:\\roms\\psx\\Final Fantasy VII (USA)\\Final Fantasy VII (USA).m3u',
    )
  })

  it('propone las rutas de portada de ES-DE respetando subcarpetas', () => {
    expect(mediaCandidates('E:\\ES-DE\\downloaded_media', game, 'covers')[0]).toBe(
      'E:\\ES-DE\\downloaded_media\\psx\\covers\\Final Fantasy VII (USA)\\Final Fantasy VII (USA).png',
    )
  })

  it('arma la URL de portada que sirve el shell, sin extensión y escapada', () => {
    expect(mediaUrl('https://relix.example/media/', game, 'covers')).toBe(
      'https://relix.example/media/psx/covers/Final%20Fantasy%20VII%20(USA)/Final%20Fantasy%20VII%20(USA)',
    )
  })

  it('escapa caracteres que romperían la URL', () => {
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
