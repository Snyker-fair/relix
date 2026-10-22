import { describe, expect, it } from 'vitest'
import { afterScanText, emptyAfterScan } from '../src/lib/core/afterScan.js'

const result = (/** @type {Partial<import('../src/lib/core/afterScan.js').AfterScanResult>} */ r) => ({ ...emptyAfterScan(), ...r })

describe('after a scan, covers and info', () => {
  it('says what came', () => {
    expect(afterScanText(result({ covers: 3, info: 2 }))).toBe('Listo: 3 portadas y 2 descripciones.')
    expect(afterScanText(result({ covers: 1 }))).toBe('Listo: 1 portada.')
  })

  it("and what's left to pick by hand, and where", () => {
    expect(afterScanText(result({ covers: 4, coversToChoose: 1, infoToChoose: 2 }))).toBe(
      'Listo: 4 portadas. Por elegir a mano: 1 portada en Portadas y 2 juegos en Información de los juegos.',
    )
    expect(afterScanText(result({ infoToChoose: 1 }))).toBe('Por elegir a mano: 1 juego en Información de los juegos.')
  })

  it('without internet, that the games are there and the rest waits', () => {
    expect(afterScanText(result({ offline: true }))).toMatch(/^Sin conexión a internet/)
  })

  it('with nothing to say, nothing', () => {
    expect(afterScanText(emptyAfterScan())).toBeNull()
  })
})
