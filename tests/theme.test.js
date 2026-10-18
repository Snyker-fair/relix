import { describe, expect, it } from 'vitest'
import { effectiveTheme, isNight, THEMES } from '../src/lib/core/theme.js'

const at = (/** @type {number} */ hour, minute = 0) => new Date(2026, 9, 17, hour, minute)

describe('theme', () => {
  it("Light and Dark don't depend on the time", () => {
    expect(effectiveTheme('light', at(23))).toBe('light')
    expect(effectiveTheme('dark', at(12))).toBe('dark')
  })

  it('Automatic: dark from 20:00 to 7:00', () => {
    expect(effectiveTheme('auto', at(19, 59))).toBe('light')
    expect(effectiveTheme('auto', at(20))).toBe('dark')
    expect(effectiveTheme('auto', at(3))).toBe('dark')
    expect(effectiveTheme('auto', at(6, 59))).toBe('dark')
    expect(effectiveTheme('auto', at(7))).toBe('light')
    expect(isNight(at(0))).toBe(true)
  })

  it('an unknown value stays Light', () => {
    expect(effectiveTheme('sepia', at(22))).toBe('light')
    expect(THEMES).toEqual(['light', 'dark', 'auto'])
  })
})
