import { describe, expect, it } from 'vitest'
import ps2Xml from '../src/mock/gamelists/ps2/gamelist.xml?raw'
import { parseGamelist } from '../src/lib/core/esde.js'
import { getPlatform } from '../src/lib/core/platforms.js'
import { cleanTitle, gamesFromFiles, mergeWithGamelist } from '../src/lib/core/scan.js'

const names = (/** @type {any[]} */ games) => games.map((g) => g.name)

describe('cleanTitle', () => {
  it('quita región, versión y marcas de dump', () => {
    expect(cleanTitle('Crash Bandicoot (USA) (Rev 1) [!]')).toBe('Crash Bandicoot')
  })
  it('mueve el artículo al principio y usa ":" para el subtítulo', () => {
    expect(cleanTitle('Legend of Zelda, The - The Wind Waker (USA)')).toBe('The Legend of Zelda: The Wind Waker')
    expect(cleanTitle('Burnout 3 - Takedown (USA)')).toBe('Burnout 3: Takedown')
  })
  it('cambia guiones bajos por espacios', () => {
    expect(cleanTitle('Shadow_of_the_Colossus')).toBe('Shadow of the Colossus')
  })
  it('si solo hay etiquetas, deja el nombre original', () => {
    expect(cleanTitle('(Homebrew)')).toBe('(Homebrew)')
  })
})

describe('gamesFromFiles', () => {
  it('lista solo los formatos de la consola', () => {
    const games = gamesFromFiles(
      ['Okami (USA).chd', 'Okami (USA).sav', 'notas.txt', 'Burnout 3 (USA).ISO', 'Ratchet (USA).cso'],
      getPlatform('ps2'),
    )
    expect(names(games)).toEqual(['Burnout 3', 'Okami', 'Ratchet'])
    expect(games[1]).toMatchObject({ id: 'ps2/Okami (USA).chd', path: 'Okami (USA).chd', system: 'ps2' })
  })

  it('PS1: el .cue aparece y su .bin no', () => {
    const games = gamesFromFiles(['Crash Bandicoot (USA).cue', 'Crash Bandicoot (USA).bin'], getPlatform('psx'))
    expect(games.map((g) => g.path)).toEqual(['Crash Bandicoot (USA).cue'])
  })

  it('varios discos con .m3u: solo el .m3u', () => {
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

  it('varios discos sin .m3u: solo el disco 1', () => {
    const games = gamesFromFiles(
      ['Metal Gear Solid (USA) (Disc 1).chd', 'Metal Gear Solid (USA) (Disc 2).chd'],
      getPlatform('psx'),
    )
    expect(games.map((g) => [g.name, g.path])).toEqual([['Metal Gear Solid', 'Metal Gear Solid (USA) (Disc 1).chd']])
  })

  it('Wii U en carpetas: toma el nombre de la carpeta e ignora otros .rpx', () => {
    const games = gamesFromFiles(
      ['Bayonetta 2 [AQUE01]/code/Bayonetta2.rpx', 'suelto.rpx', 'Pikmin 3 (USA).wua'],
      getPlatform('wiiu'),
    )
    expect(names(games)).toEqual(['Bayonetta 2', 'Pikmin 3'])
  })

  it('si dos juegos se llaman igual, agrega la región', () => {
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

  it('usa los datos de ES-DE cuando el archivo existe y el nombre del archivo cuando no', () => {
    const scanned = gamesFromFiles(['okami (usa).chd', 'Juego Nuevo (USA).iso'], getPlatform('ps2'))
    const games = mergeWithGamelist(listed, scanned)
    expect(names(games)).toEqual(['Juego Nuevo', 'Ōkami'])
    const okami = games.find((g) => g.name === 'Ōkami')
    expect(okami).toMatchObject({ year: 2006, favorite: true, path: 'okami (usa).chd', id: 'ps2/okami (usa).chd' })
  })

  it('no muestra los ocultos ni las entradas sin archivo', () => {
    const scanned = gamesFromFiles(['Oculto (USA).chd', 'Persona 4 (USA).chd'], getPlatform('ps2'))
    expect(names(mergeWithGamelist(listed, scanned))).toEqual(['Persona 4'])
  })
})
