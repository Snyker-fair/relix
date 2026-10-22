import { describe, expect, it } from 'vitest'
import { isNewPeak, memoryText, PEAK_STEP } from '../src/lib/core/memory.js'

const MB = 1024 ** 2
const GB = 1024 ** 3
const sample = (/** @type {number} */ usage) => ({ xbox: true, expectedLimit: 1 * GB, limit: 0.5 * GB, usage })

describe('memory in the log', () => {
  it('only a peak clearly above the last one is logged', () => {
    expect(isNewPeak(0, 300 * MB)).toBe(true)
    expect(isNewPeak(300 * MB, 310 * MB)).toBe(false)
    expect(isNewPeak(300 * MB, 300 * MB + PEAK_STEP)).toBe(true)
    expect(isNewPeak(300 * MB, 0)).toBe(false)
  })

  it('says how much, of how much, where and whether a video was playing', () => {
    expect(memoryText('start', sample(310 * MB), { where: 'inicio' })).toBe('Al abrir Relix: 310 MB de 1,0 GB · inicio')
    expect(memoryText('peak', sample(412 * MB), { where: 'biblioteca de PS2', video: true })).toBe(
      'Máximo: 412 MB de 1,0 GB · biblioteca de PS2 · con video',
    )
    expect(memoryText('game', sample(398 * MB), { game: 'Okami (PS2)' })).toBe('Al abrir Okami (PS2): 398 MB de 1,0 GB')
  })

  it('near the limit, and how much is left after letting go', () => {
    expect(memoryText('high', sample(870 * MB), { where: 'biblioteca de PS1' })).toBe(
      'Memoria alta, liberando: 870 MB de 1,0 GB · biblioteca de PS1',
    )
    expect(memoryText('freed', sample(520 * MB))).toBe('Tras liberar: 520 MB de 1,0 GB')
  })

  it('without the expected limit, the current one', () => {
    expect(memoryText('peak', { xbox: true, expectedLimit: 0, limit: 512 * MB, usage: 200 * MB })).toBe('Máximo: 200 MB de 512 MB')
  })
})
