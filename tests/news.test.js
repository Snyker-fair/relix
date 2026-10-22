import { describe, expect, it, vi } from 'vitest'
import { NEWS, parseVersion } from '../src/lib/core/updates.js'

vi.mock('../src/lib/core/version.js', () => ({ VERSION: '1.3.0', BUILD_DATE: '' }))

const { updates } = await import('../src/lib/ui/updates.svelte.js')

describe("what's new in a version", () => {
  it('each entry is a real version', () => {
    for (const [version, lines] of Object.entries(NEWS)) {
      expect(parseVersion(version)).not.toBeNull()
      expect(lines.length).toBeGreaterThan(0)
    }
  })

  it('said once, and not before there are games', () => {
    localStorage.clear()
    expect(updates.takeNews(false)).toBeNull()
    expect(updates.takeNews(true)).toBe(NEWS['1.3.0'])
    expect(updates.takeNews(true)).toBeNull()
  })
})
