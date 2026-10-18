import { describe, expect, it } from 'vitest'
import { fileKey, hasBackground, indexMedia, pickMedia } from '../src/lib/core/media.js'

describe("each game's images and videos", () => {
  const index = indexMedia({
    screenshots: ['Okami (USA).png', 'Crash Bandicoot (USA).png', 'FF7 (USA)/FF7 (USA).png'],
    fanart: ['Okami (USA).jpg'],
    titlescreens: ['Tekken 3 (USA).png'],
    marquees: ['Okami (USA).png'],
    videos: ['Okami (USA).mp4', 'FF7 (USA)/FF7 (USA).mp4'],
  })

  it('the background prefers fan art, then a screenshot and then the title screen', () => {
    expect(pickMedia('Okami (USA)', index).background).toEqual({ type: 'fanart', file: 'Okami (USA).jpg' })
    expect(pickMedia('Crash Bandicoot (USA)', index).background).toEqual({ type: 'screenshots', file: 'Crash Bandicoot (USA).png' })
    expect(pickMedia('Tekken 3 (USA)', index).background).toEqual({ type: 'titlescreens', file: 'Tekken 3 (USA).png' })
  })

  it('logo and video by the same name, case-insensitive and with folders', () => {
    const okami = pickMedia('OKAMI (usa)', index)
    expect(okami.logo?.file).toBe('Okami (USA).png')
    expect(okami.video?.file).toBe('Okami (USA).mp4')
    expect(pickMedia('FF7 (USA)/FF7 (USA)', index).video?.file).toBe('FF7 (USA)/FF7 (USA).mp4')
  })

  it('a game with nothing', () => {
    expect(pickMedia('Spyro (USA)', index)).toEqual({ background: null, logo: null, video: null })
    expect(hasBackground('Spyro (USA)', index)).toBe(false)
    expect(hasBackground('Tekken 3 (USA)', index)).toBe(true)
    expect(pickMedia('Okami (USA)', indexMedia(undefined)).background).toBeNull()
  })

  it("a file's key", () => {
    expect(fileKey('FF7 (USA)/FF7 (USA).png')).toBe('ff7 (usa)/ff7 (usa)')
    expect(fileKey('Dr. Mario (USA).png')).toBe('dr. mario (usa)')
  })
})
