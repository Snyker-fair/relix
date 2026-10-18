import { describe, expect, it } from 'vitest'
import { getEmulator, getPlatform } from '../src/lib/core/platforms.js'
import { ps1BiosRegion, quickExitMessage } from '../src/lib/core/quickExit.js'

const platform = (/** @type {string} */ id) => /** @type {import('../src/lib/core/platforms.js').Platform} */ (getPlatform(id))
const emulator = (/** @type {string} */ id, /** @type {string} */ emu) =>
  /** @type {import('../src/lib/core/platforms.js').Emulator} */ (getEmulator(platform(id), emu))

describe('a game that closed on opening', () => {
  it("the file's region tells which PS1 BIOS is missing", () => {
    expect(ps1BiosRegion('Resident Evil 3 - Nemesis (Europe) (En,Fr,De,Es,It).chd')).toBe('europe')
    expect(ps1BiosRegion('Resident Evil 3 - Nemesis (Spain).chd')).toBe('europe')
    expect(ps1BiosRegion('Crash Bandicoot (USA).chd')).toBe('usa')
    expect(ps1BiosRegion('Biohazard 3 (Japan).chd')).toBe('japan')
    expect(ps1BiosRegion('Tetris (World).chd')).toBeNull()
    expect(ps1BiosRegion('Juego sin etiquetas.chd')).toBeNull()
  })

  it('PS1 names the exact BIOS file and where it goes depending on the emulator', () => {
    const game = { name: 'Resident Evil 3', path: 'Resident Evil 3 - Nemesis (Europe) (En,Fr,De,Es,It).chd' }
    expect(quickExitMessage(game, platform('psx'), emulator('psx', 'swanstation'))).toBe(
      'Resident Evil 3 se cerró enseguida. Revisa que scph5502.bin (BIOS de PS1 europea) esté en la carpeta system de RetroArch, o que el archivo no esté dañado.',
    )
    expect(quickExitMessage(game, platform('psx'), emulator('psx', 'duckstation'))).toContain(
      'en la carpeta bios de DuckStation',
    )
    expect(
      quickExitMessage({ name: 'Tetris', path: 'Sub/Tetris.chd' }, platform('psx'), emulator('psx', 'swanstation')),
    ).toContain('scph5500, scph5501 o scph5502.bin')
  })

  it('other consoles: what fits their emulator', () => {
    const game = { name: 'Okami', path: 'Okami (USA).chd' }
    expect(quickExitMessage(game, platform('ps2'), emulator('ps2', 'xbsx2'))).toContain('BIOS de PS2')
    // A RetroArch core: names the .dll and suggests another emulator
    const n64 = quickExitMessage({ name: 'Mario 64', path: 'Super Mario 64 (USA).z64' }, platform('n64'), emulator('n64', 'mupen64plus'))
    expect(n64).toContain('el núcleo mupen64plus_next_libretro.dll')
    expect(n64).toContain('Y › Abrir con…')
    // A standalone without alternatives: doesn't suggest switching
    expect(quickExitMessage(game, platform('ps2'), emulator('ps2', 'xbsx2'))).not.toContain('Abrir con')
    expect(quickExitMessage(game, platform('xbox360'), emulator('xbox360', 'xenia-canary'))).toContain(
      'Xenia Canary esté instalado',
    )
  })
})
