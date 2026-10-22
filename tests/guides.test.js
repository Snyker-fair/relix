import { describe, expect, it } from 'vitest'
import { EMULATOR_GUIDES, guideSteps, richText } from '../src/lib/core/guides.js'
import { getEmulator, getPlatform, PLATFORMS } from '../src/lib/core/platforms.js'

const platform = (/** @type {string} */ id) => /** @type {import('../src/lib/core/platforms.js').Platform} */ (getPlatform(id))

describe("each console's guide", () => {
  it('every emulator has a guide', () => {
    const missing = PLATFORMS.flatMap((p) => p.emulators.map((e) => e.id)).filter((id) => !EMULATOR_GUIDES[id])
    expect(missing).toEqual([])
  })

  it('PS1 with SwanStation: RetroArch Full, the BIOS by region and the USB folder', () => {
    const psx = platform('psx')
    const steps = guideSteps(psx, getEmulator(psx, 'swanstation'), { folder: 'E:\\roms\\ps1', installed: true, games: 0 })
    expect(steps.map((s) => s.id)).toEqual(['install', 'files', 'games', 'play'])
    expect(steps[0].title).toBe('Instala RetroArch')
    expect(steps[0].lines[0]).toContain('RetroArch Full (Series S/X)')
    expect(steps[0].done).toBe(true)
    expect(steps[1].lines.join(' ')).toContain('scph5502.bin')
    expect(steps[1].lines.join(' ')).toContain('System/BIOS')
    expect(steps[2].lines[0]).toContain('E:\\roms\\ps1')
    expect(steps[2].done).toBe(false)
  })

  it('a console with nothing extra says so', () => {
    const snes = platform('snes')
    const steps = guideSteps(snes, getEmulator(snes, 'snes9x'), { folder: 'E:\\roms\\snes', installed: null, games: 4 })
    expect(steps[1].lines).toEqual(['No necesita nada más: ni BIOS ni ajustes.'])
    expect(steps[1].done).toBe(true)
    expect(steps[2].done).toBe(true)
  })

  it("Wii U explains Cemu even though Relix can't open it", () => {
    const steps = guideSteps(platform('wiiu'), null, { folder: 'E:\\roms\\wiiu', installed: null, games: 2 })
    expect(steps[0].title).toBe('Instala Cemu')
    expect(steps[1].lines.join(' ')).toContain('keys.txt')
    expect(steps[3].lines[0]).toContain('Dev Home')
  })

  it('bold text and paths are split to draw them', () => {
    expect(richText('Copia en `E:\\roms\\ps1` y abre **≡ › Biblioteca**.')).toEqual([
      { text: 'Copia en ', kind: 'plain' },
      { text: 'E:\\roms\\ps1', kind: 'code' },
      { text: ' y abre ', kind: 'plain' },
      { text: '≡ › Biblioteca', kind: 'bold' },
      { text: '.', kind: 'plain' },
    ])
  })
})
