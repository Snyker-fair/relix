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
// Nombres reales de libretro-thumbnails (un recorte por consola)
import names from '../src/mock/libretro-names.json'

const ps2 = buildCoverIndex(names.ps2)
const psx = buildCoverIndex(names.psx)
const gc = buildCoverIndex(names.gc)

describe('titleKey', () => {
  it('ignora región, mayúsculas, guiones bajos, artículos y números romanos', () => {
    expect(titleKey('Kingdom Hearts II (USA)')).toBe('kingdom hearts 2')
    expect(titleKey('kingdom_hearts_2')).toBe('kingdom hearts 2')
    expect(titleKey('Legend of Zelda, The - The Wind Waker (USA)')).toBe('legend of zelda wind waker')
    expect(titleKey('The Legend of Zelda: The Wind Waker')).toBe('legend of zelda wind waker')
  })

  it('trata "&" como "and" y quita apóstrofes y tildes', () => {
    expect(titleKey('Ratchet & Clank')).toBe(titleKey('Ratchet and Clank'))
    expect(titleKey("Bug's Life, A (USA)")).toBe('bugs life')
    expect(titleKey('Pokémon Colosseum')).toBe('pokemon colosseum')
  })
})

describe('libretroSafeName', () => {
  it('reemplaza los caracteres que libretro no usa en archivos', () => {
    expect(libretroSafeName('Ratchet & Clank (USA)')).toBe('Ratchet _ Clank (USA)')
    expect(libretroSafeName('Ocarina of Time / Master Quest')).toBe('Ocarina of Time _ Master Quest')
  })
})

describe('matchCover', () => {
  it('encuentra el nombre exacto (archivos con nombre estándar)', () => {
    expect(matchCover('Kingdom Hearts (USA)', ps2)).toEqual({ name: 'Kingdom Hearts (USA)', how: 'exact' })
    expect(matchCover('resident evil 4 (usa) (disc 1)', gc)).toEqual({
      name: 'Resident Evil 4 (USA) (Disc 1)',
      how: 'exact',
    })
  })

  it('encuentra por título con nombres simplificados', () => {
    expect(matchCover('kingdom_hearts_2', ps2)).toEqual({ name: 'Kingdom Hearts II (USA)', how: 'title' })
    expect(matchCover('The Legend of Zelda - The Wind Waker', gc)?.name).toBe(
      'Legend of Zelda, The - The Wind Waker (USA)',
    )
  })

  it('usa la región preferida cuando el archivo no dice la suya', () => {
    expect(matchCover('Kingdom Hearts', ps2)?.name).toBe('Kingdom Hearts (USA)')
    expect(matchCover('Kingdom Hearts', ps2, { region: 'europe' })?.name).toBe('Kingdom Hearts (Spain)')
    expect(matchCover('Kingdom Hearts', ps2, { region: 'japan' })?.name).toBe('Kingdom Hearts (Japan)')
  })

  it('respeta la región del archivo antes que la preferida', () => {
    expect(matchCover('kingdom hearts (Germany)', ps2)?.name).toBe('Kingdom Hearts (Germany)')
  })

  it('evita betas, demos y discos 2+', () => {
    const gt4 = matchCover('Gran Turismo 4', ps2)?.name ?? ''
    expect(gt4).toMatch(/^Gran Turismo 4 \(USA/)
    expect(gt4).not.toMatch(/Beta|Taikenban/)
    expect(matchCover('Final Fantasy VII', psx)?.name).not.toMatch(/Disc [23]/)
  })

  it('prueba con el nombre de ES-DE si el archivo tiene un nombre raro', () => {
    expect(matchCover('kh2', ps2)).toBeNull()
    expect(matchCover('kh2', ps2, { altTitle: 'Kingdom Hearts II' })?.name).toBe('Kingdom Hearts II (USA)')
  })

  it('no inventa: un apodo sin coincidencia segura devuelve null', () => {
    expect(matchCover('Persona 4 (USA)', ps2)).toBeNull()
    expect(matchCover('GT4', ps2)).toBeNull()
  })
})

describe('coverCandidates', () => {
  it('ofrece el título correcto primero para apodos y nombres cortos', () => {
    expect(coverCandidates('Persona 4 (USA)', ps2)[0]).toEqual({
      name: 'Shin Megami Tensei - Persona 4 (USA)',
      title: 'Shin Megami Tensei - Persona 4',
      region: 'EE. UU.',
    })
  })

  it('tolera una letra de diferencia (Okami / Ookami)', () => {
    expect(coverCandidates('Okami (USA)', ps2)[0].name).toBe('Ookami (USA)')
  })

  it('no propone juegos que solo comparten un número', () => {
    const titles = coverCandidates('Persona 4', ps2).map((c) => c.title)
    expect(titles.some((t) => t.startsWith('Gran Turismo'))).toBe(false)
  })

  it('devuelve una versión por título y respeta el límite', () => {
    const list = coverCandidates('Kingdom Hearts', ps2, { limit: 3 })
    expect(list).toHaveLength(3)
    expect(new Set(list.map((c) => c.title)).size).toBe(3)
  })

  it('queda vacío si no hay nada parecido', () => {
    expect(coverCandidates('GT4', ps2)).toEqual([])
  })
})

describe('coverQuery y coverKey', () => {
  it('usa el archivo, o la carpeta en Wii U', () => {
    expect(coverQuery({ path: 'Okami (USA).chd' })).toBe('Okami (USA)')
    expect(coverQuery({ path: 'Xenoblade Chronicles X (USA)/code/game.rpx' })).toBe('Xenoblade Chronicles X (USA)')
  })

  it('guarda la portada con la ruta del juego sin extensión, como ES-DE', () => {
    expect(coverKey({ path: 'Okami (USA).chd' })).toBe('Okami (USA)')
    expect(coverKey({ path: 'Final Fantasy VII (USA)/Final Fantasy VII (USA).m3u' })).toBe(
      'Final Fantasy VII (USA)/Final Fantasy VII (USA)',
    )
  })
})

describe('regionLabel y remoteCoverUrl', () => {
  it('traduce la región', () => {
    expect(regionLabel('Ookami (Europe) (En,Fr,De)')).toBe('Europa')
    expect(regionLabel('Kingdom Hearts (USA)')).toBe('EE. UU.')
    expect(regionLabel('Juego sin región')).toBe('')
  })

  it('arma la URL del servidor de libretro', () => {
    expect(remoteCoverUrl('Sony - PlayStation 2', 'Ratchet _ Clank (USA) (En,Fr,De,Es,It)')).toBe(
      'https://thumbnails.libretro.com/Sony%20-%20PlayStation%202/Named_Boxarts/Ratchet%20_%20Clank%20(USA)%20(En%2CFr%2CDe%2CEs%2CIt).png',
    )
  })
})
