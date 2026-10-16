import { describe, expect, it } from 'vitest'
import { ps1BiosRegion, quickExitMessage } from '../src/lib/core/quickExit.js'

const psx = { id: 'psx', emulatorName: 'RetroArch · SwanStation' }

describe('juego que se cerró al abrir', () => {
  it('la región del archivo dice qué BIOS de PS1 falta', () => {
    expect(ps1BiosRegion('Resident Evil 3 - Nemesis (Europe) (En,Fr,De,Es,It).chd')).toBe('europe')
    expect(ps1BiosRegion('Resident Evil 3 - Nemesis (Spain).chd')).toBe('europe')
    expect(ps1BiosRegion('Crash Bandicoot (USA).chd')).toBe('usa')
    expect(ps1BiosRegion('Biohazard 3 (Japan).chd')).toBe('japan')
    expect(ps1BiosRegion('Tetris (World).chd')).toBeNull()
    expect(ps1BiosRegion('Juego sin etiquetas.chd')).toBeNull()
  })

  it('PS1 nombra el archivo exacto de la BIOS', () => {
    const game = { name: 'Resident Evil 3', path: 'Resident Evil 3 - Nemesis (Europe) (En,Fr,De,Es,It).chd' }
    expect(quickExitMessage(game, psx)).toBe(
      'Resident Evil 3 se cerró enseguida. Revisa que scph5502.bin (BIOS de PS1 europea) esté en la carpeta system de RetroArch, o que el archivo no esté dañado.',
    )
    expect(quickExitMessage({ name: 'Tetris', path: 'Sub/Tetris.chd' }, psx)).toContain('scph5500, scph5501 o scph5502.bin')
  })

  it('otras consolas: lo que corresponde a su emulador', () => {
    const game = { name: 'Okami', path: 'Okami (USA).chd' }
    expect(quickExitMessage(game, { id: 'ps2', emulatorName: 'XBSX2' })).toContain('BIOS de PS2')
    expect(quickExitMessage(game, { id: 'psp', emulatorName: 'PPSSPP' })).toContain('PPSSPP esté instalado')
  })
})
