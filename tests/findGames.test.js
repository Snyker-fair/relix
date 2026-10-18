import { describe, expect, it } from 'vitest'
import {
  cleanCollectionName,
  collectionFileName,
  collectionGameKeys,
  collectionNameFromFile,
  parseCollection,
  resolveLine,
  serializeCollection,
  setInCollection,
} from '../src/lib/core/collections.js'
import { searchGames, searchKey } from '../src/lib/core/search.js'
import { jumpIndex, letterOf, sectionOf, sortGames } from '../src/lib/core/sorting.js'

/** @param {string} name @param {Partial<import('../src/lib/core/esde.js').Game>} [extra] */
function game(name, extra = {}) {
  return {
    id: `ps2/${name}.chd`,
    system: 'ps2',
    path: `${name}.chd`,
    name,
    sortName: name,
    description: '',
    year: null,
    developer: '',
    publisher: '',
    genre: '',
    players: '',
    rating: null,
    favorite: false,
    hidden: false,
    playCount: 0,
    ...extra,
  }
}

describe('searchGames', () => {
  const games = [
    game('Kingdom Hearts'),
    game('Kingdom Hearts II'),
    game('Ōkami'),
    game('Ratchet & Clank'),
    game('Final Fantasy X'),
    game('Burnout 3: Takedown'),
    game('Dark Cloud'),
  ]
  const names = (/** @type {string} */ q) => searchGames(games, q).map((g) => g.name)

  it('normalizes accents, symbols and case', () => {
    expect(searchKey('Ōkami: Edición & Más')).toBe('okami edicion and mas')
  })

  it('each typed word is the start of a word in the title', () => {
    expect(names('kin he')).toEqual(['Kingdom Hearts', 'Kingdom Hearts II'])
    expect(names('okami')).toEqual(['Ōkami'])
    expect(names('takedown')).toEqual(['Burnout 3: Takedown'])
    expect(names('ingdom')).toEqual([])
  })

  it('Roman numerals count as digits and vice versa', () => {
    expect(names('kingdom hearts 2')).toEqual(['Kingdom Hearts II'])
    expect(names('final fantasy 10')).toEqual(['Final Fantasy X'])
  })

  it('"&" and "and" are the same', () => {
    expect(names('ratchet and')).toEqual(['Ratchet & Clank'])
  })

  it('first the ones that start like what was typed', () => {
    expect(names('cl')).toEqual(['Dark Cloud', 'Ratchet & Clank']) // ninguno empieza con "cl": A–Z
    expect(searchGames([game('Dark Cloud'), game('Cloud Strife')], 'cloud').map((g) => g.name)).toEqual([
      'Cloud Strife',
      'Dark Cloud',
    ])
  })

  it('without text it returns nothing', () => {
    expect(names('  ')).toEqual([])
  })
})

describe('order and jumps', () => {
  const list = sortGames(
    [
      game('Burnout 3', { year: 2004 }),
      game('Ape Escape 2', { year: 2002 }),
      game('Amplitude', { year: 2003 }),
      game('Bully', { year: 2006 }),
      game('Okami', { year: 2006 }),
      game('007 Nightfire', { year: 2002 }),
      game('Crash Twinsanity'),
    ],
    'az',
  )

  it('index letter: without accents and "#" for digits', () => {
    expect(letterOf('Ōkami')).toBe('O')
    expect(letterOf('007 Nightfire')).toBe('#')
  })

  it('A–Z, by year and recent', () => {
    expect(list.map((g) => g.name)).toEqual([
      '007 Nightfire', 'Amplitude', 'Ape Escape 2', 'Bully', 'Burnout 3', 'Crash Twinsanity', 'Okami',
    ])
    expect(sortGames(list, 'year').map((g) => g.year)).toEqual([2002, 2002, 2003, 2004, 2006, 2006, null])
    const played = { [list[6].id]: 200, [list[3].id]: 100 }
    expect(sortGames(list, 'recent', played).map((g) => g.name).slice(0, 3)).toEqual(['Okami', 'Bully', '007 Nightfire'])
  })

  it('most played: most time first, the never played at the end, A–Z', () => {
    const time = { [list[4].id]: { seconds: 600 }, [list[1].id]: { seconds: 9000 } }
    expect(sortGames(list, 'played', {}, time).map((g) => g.name).slice(0, 4)).toEqual([
      'Amplitude', 'Burnout 3', '007 Nightfire', 'Ape Escape 2',
    ])
    expect(sectionOf(list[0], 'played')).toBeNull()
  })

  it('RT jumps to the next letter; LT to the start of the current one or to the previous one', () => {
    // 0 "#", 1-2 "A", 3-4 "B", 5 "C", 6 "O"
    expect(jumpIndex(list, 0, 1, 'az')).toBe(1)
    expect(jumpIndex(list, 1, 1, 'az')).toBe(3)
    expect(jumpIndex(list, 4, -1, 'az')).toBe(3)
    expect(jumpIndex(list, 3, -1, 'az')).toBe(1)
    expect(jumpIndex(list, 6, 1, 'az')).toBe(6)
    expect(jumpIndex(list, 0, -1, 'az')).toBe(0)
  })

  it('by year it jumps year by year; in recent, a page at a time', () => {
    const byYear = sortGames(list, 'year')
    expect(sectionOf(byYear[0], 'year')).toBe('2002')
    expect(jumpIndex(byYear, 0, 1, 'year')).toBe(2)
    expect(jumpIndex(byYear, 5, 1, 'year')).toBe(6)
    expect(sectionOf(byYear[6], 'year')).toBe('Sin año')
    expect(jumpIndex(list, 0, 1, 'recent', 4)).toBe(4)
    expect(jumpIndex(list, 5, 1, 'recent', 4)).toBe(6)
  })
})

describe('ES-DE collections', () => {
  const folders = new Map([
    ['psx', 'psx'],
    ['ps1', 'psx'],
    ['ps2', 'ps2'],
  ])

  it('builds and reads file names', () => {
    expect(cleanCollectionName('  Con   amigos: 2 jugadores?  ')).toBe('Con amigos 2 jugadores')
    expect(collectionFileName('Pendientes')).toBe('custom-Pendientes.cfg')
    expect(collectionNameFromFile('custom-Con amigos.cfg')).toBe('Con amigos')
    expect(collectionNameFromFile('favorites.cfg')).toBeNull()
  })

  it('reads the lines without empty or repeated ones', () => {
    expect(parseCollection('%ROMPATH%/ps2/A.chd\r\n\n%ROMPATH%/ps2/a.chd\n%ROMPATH%/snes/B.sfc\n')).toEqual([
      '%ROMPATH%/ps2/A.chd',
      '%ROMPATH%/snes/B.sfc',
    ])
  })

  it('recognizes the console by its real folder, also with backslashes or a full path', () => {
    expect(resolveLine('%ROMPATH%/ps1/FF7 (USA)/FF7 (USA).m3u', folders)).toEqual({
      system: 'psx',
      path: 'FF7 (USA)/FF7 (USA).m3u',
    })
    expect(resolveLine('%ROMPATH%\\ps2\\Okami.chd', folders)).toEqual({ system: 'ps2', path: 'Okami.chd' })
    expect(resolveLine('E:\\roms\\ps2\\Okami.chd', folders, 'E:\\roms')).toEqual({ system: 'ps2', path: 'Okami.chd' })
    expect(resolveLine('%ROMPATH%/snes/Mario.sfc', folders)).toBeNull()
  })

  it('adds and removes games keeping the lines of other consoles', () => {
    const lines = ['%ROMPATH%/snes/Mario.sfc', '%ROMPATH%/ps2/Okami.chd']
    const okami = { system: 'ps2', path: 'Okami.chd' }
    const kh = { system: 'ps2', path: 'Kingdom Hearts.chd' }
    const added = setInCollection(lines, kh, 'ps2', true, folders)
    expect(added).toEqual([...lines, '%ROMPATH%/ps2/Kingdom Hearts.chd'])
    expect(setInCollection(added, okami, 'ps2', false, folders)).toEqual([
      '%ROMPATH%/snes/Mario.sfc',
      '%ROMPATH%/ps2/Kingdom Hearts.chd',
    ])
    expect(collectionGameKeys(added, folders)).toEqual(new Set(['ps2/okami.chd', 'ps2/kingdom hearts.chd']))
    expect(serializeCollection(['a', 'b'])).toBe('a\nb\n')
  })
})
