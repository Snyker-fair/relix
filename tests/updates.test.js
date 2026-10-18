import { describe, expect, it } from 'vitest'
import { compareVersions, isNewer, parseVersion, readRelease, updateCheck } from '../src/lib/core/updates.js'

describe('versión nueva', () => {
  it('lee versiones con o sin v y con sufijo de prueba', () => {
    expect(parseVersion('v1.2.3')).toEqual({ numbers: [1, 2, 3], pre: '' })
    expect(parseVersion('1.0.0-beta.2')).toEqual({ numbers: [1, 0, 0], pre: 'beta.2' })
    expect(parseVersion('dev')).toBeNull()
    expect(parseVersion('1.0')).toBeNull()
  })

  it('compara por número, y la de prueba va antes que la final', () => {
    expect(compareVersions('1.0.1', '1.0.0')).toBeGreaterThan(0)
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0)
    expect(compareVersions('v2.0.0', '2.0.0')).toBe(0)
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBeLessThan(0)
    expect(compareVersions('1.0.0-beta.10', '1.0.0-beta.2')).toBeGreaterThan(0)
  })

  it('avisa solo si la del release es posterior (y nunca en una compilación sin versión)', () => {
    expect(isNewer('v1.0.1', '1.0.0')).toBe(true)
    expect(isNewer('v1.0.0', '1.0.0')).toBe(false)
    expect(isNewer('v0.9.0', '1.0.0')).toBe(false)
    expect(isNewer('v1.0.0', 'dev')).toBe(false)
    expect(isNewer(null, '1.0.0')).toBe(false)
  })

  it('de la respuesta de GitHub toma la versión y la página; ignora borradores y pruebas', () => {
    expect(readRelease({ tag_name: 'v1.0.1', html_url: 'https://github.com/x', published_at: '2026-11-01T00:00:00Z' })).toEqual({
      version: '1.0.1',
      url: 'https://github.com/x',
      publishedAt: '2026-11-01T00:00:00Z',
    })
    expect(readRelease({ tag_name: 'v1.0.1', draft: true })).toBeNull()
    expect(readRelease({ tag_name: 'v1.1.0-beta.1', prerelease: true })).toBeNull()
    expect(readRelease({ tag_name: 'nightly' })).toBeNull()
    expect(readRelease(null)).toBeNull()
  })

  it('la fila de Revisión aparece solo con una versión posterior', () => {
    const row = updateCheck({ version: '1.0.1' }, '1.0.0')
    expect(row?.id).toBe('update')
    expect(row?.state).toBe('update')
    expect(row?.title).toBe('Relix 1.0.1 está disponible')
    expect(row?.detail).toContain('github.com/Snyker-fair/relix/releases')
    expect(updateCheck({ version: '1.0.0' }, '1.0.0')).toBeNull()
    expect(updateCheck(null, '1.0.0')).toBeNull()
  })
})
