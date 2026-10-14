import { describe, expect, it } from 'vitest'
import { buildLaunchUri, escapeDataString } from '../src/lib/core/launchUri.js'
import { getPlatform } from '../src/lib/core/platforms.js'

describe('escapeDataString', () => {
  it('escapa como Uri.EscapeDataString de .NET', () => {
    expect(escapeDataString('E:\\roms\\ps2\\Okami (USA).chd')).toBe(
      'E%3A%5Croms%5Cps2%5COkami%20%28USA%29.chd',
    )
  })
  it("escapa ! ' * que encodeURIComponent deja pasar", () => {
    expect(escapeDataString("It's!*")).toBe('It%27s%21%2A')
  })
  it('deja intactos - _ . ~', () => {
    expect(escapeDataString('a-b_c.d~e')).toBe('a-b_c.d~e')
  })
})

describe('buildLaunchUri', () => {
  const rom = 'E:\\roms\\ps2\\Okami (USA).chd'

  it('arma la URI de un emulador standalone (XBSX2)', () => {
    expect(buildLaunchUri(getPlatform('ps2').launcher, rom)).toBe(
      'xbsx2:?cmd=xbsx2.exe "E%3A%5Croms%5Cps2%5COkami%20%28USA%29.chd"&launchOnExit=relix:',
    )
  })

  it('arma la URI de RetroArch con su núcleo', () => {
    const uri = buildLaunchUri(getPlatform('psx').launcher, 'E:\\roms\\psx\\Crash.chd')
    expect(uri).toBe(
      'retroarch:?cmd=retroarch -L cores\\swanstation_libretro.dll "E%3A%5Croms%5Cpsx%5CCrash.chd"&launchOnExit=relix:',
    )
  })

  it('usa el protocolo de retorno que se le pase', () => {
    expect(buildLaunchUri(getPlatform('psp').launcher, 'E:\\x.iso', 'otraapp')).toMatch(
      /&launchOnExit=otraapp:$/,
    )
  })

  it('falla con un mensaje claro si la consola no tiene lanzador', () => {
    expect(() => buildLaunchUri(getPlatform('wiiu').launcher, rom)).toThrow(/emulador configurado/)
  })

  it('falla si falta la ruta', () => {
    expect(() => buildLaunchUri(getPlatform('ps2').launcher, '')).toThrow(/ruta/)
  })
})
