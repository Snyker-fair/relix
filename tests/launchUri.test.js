import { describe, expect, it } from 'vitest'
import { buildLaunchUri, escapeDataString } from '../src/lib/core/launchUri.js'
import { getPlatform } from '../src/lib/core/platforms.js'

/** Lanzador del emulador recomendado de una consola (null si no tiene) */
const launcherOf = (/** @type {string} */ id) => getPlatform(id)?.emulators[0]?.launcher ?? null

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
    expect(buildLaunchUri(launcherOf('ps2'), rom)).toBe(
      'xbsx2:?cmd=xbsx2.exe "E%3A%5Croms%5Cps2%5COkami%20%28USA%29.chd"&launchOnExit=relix:',
    )
  })

  it('arma la URI de RetroArch con su núcleo', () => {
    const uri = buildLaunchUri(launcherOf('psx'), 'E:\\roms\\psx\\Crash.chd')
    expect(uri).toBe(
      'retroarch:?cmd=retroarch -L cores\\swanstation_libretro.dll "E%3A%5Croms%5Cpsx%5CCrash.chd"&launchOnExit=relix:',
    )
  })

  it('usa el protocolo de retorno que se le pase', () => {
    expect(buildLaunchUri(launcherOf('psp'), 'E:\\x.iso', 'otraapp')).toMatch(
      /&launchOnExit=otraapp:$/,
    )
  })

  it('falla con un mensaje claro si la consola no tiene lanzador', () => {
    expect(() => buildLaunchUri(launcherOf('wiiu'), rom)).toThrow(/emulador configurado/)
  })

  it('falla si falta la ruta', () => {
    expect(() => buildLaunchUri(launcherOf('ps2'), '')).toThrow(/ruta/)
  })

  it('los standalone nuevos usan el mismo formato que RetroPass', () => {
    const emu = (/** @type {string} */ system, /** @type {string} */ id) =>
      getPlatform(system)?.emulators.find((e) => e.id === id)?.launcher ?? null
    expect(buildLaunchUri(emu('psx', 'duckstation'), 'E:\\roms\\psx\\RE3.chd')).toBe(
      'duckstation:?cmd=duckstation.exe "E%3A%5Croms%5Cpsx%5CRE3.chd"&launchOnExit=relix:',
    )
    expect(buildLaunchUri(emu('xbox360', 'xenia-canary'), 'E:\\roms\\xbox360\\Halo 3\\default.xex')).toBe(
      'xeniacanary:?cmd=xeniacanary.exe "E%3A%5Croms%5Cxbox360%5CHalo%203%5Cdefault.xex"&launchOnExit=relix:',
    )
    expect(buildLaunchUri(emu('n3ds', 'panda3ds'), 'E:\\roms\\n3ds\\Zelda.3ds')).toMatch(/^panda:\?cmd=Alber\.exe "/)
    expect(buildLaunchUri(emu('dreamcast', 'flycast-ra'), 'E:\\roms\\dreamcast\\SC.chd')).toMatch(
      /^retroarch:\?cmd=retroarch -L cores\\flycast_libretro\.dll "/,
    )
  })

  it('cada consola nueva tiene carpeta, formatos, portadas y emulador', () => {
    for (const id of ['snes', 'n64', 'gba', 'n3ds', 'megadrive', 'dreamcast', 'xbox360']) {
      const p = getPlatform(id)
      expect(p?.folders[0]).toBe(id)
      expect(p?.extensions.length).toBeGreaterThan(0)
      expect(p?.libretro).toMatch(/ - /)
      expect(p?.emulators.length).toBeGreaterThan(0)
    }
  })
})
