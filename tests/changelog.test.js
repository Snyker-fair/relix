import { describe, expect, it } from 'vitest'
import { dateChangelog, isoDay } from '../scripts/changelog-date.mjs'

const CHANGELOG = `# Changelog

## [1.5.0] - unreleased

- **Back to it?:** a game you gave hours to.

## [1.4.0] - 2026-10-23

- **"New" games.**
`

describe('the CHANGELOG date when releasing', () => {
  it("writes the day in the version's heading, and nothing else", () => {
    const { text } = dateChangelog(CHANGELOG, '1.5.0', '2026-11-02')
    expect(text).toBe(CHANGELOG.replace('## [1.5.0] - unreleased', '## [1.5.0] - 2026-11-02'))
  })

  it('a section already dated stays as it is (the release is being redone)', () => {
    expect(dateChangelog(CHANGELOG, '1.4.0', '2026-11-02').text).toBe(CHANGELOG)
  })

  it('also with Windows line breaks', () => {
    const crlf = CHANGELOG.replace(/\n/g, '\r\n')
    expect(dateChangelog(crlf, '1.5.0', '2026-11-02').text).toBe(crlf.replace('unreleased', '2026-11-02'))
  })

  it('without a section, or with an empty one, it says why', () => {
    expect(dateChangelog(CHANGELOG, '1.6.0', '2026-11-02').error).toMatch('## [1.6.0] - unreleased')
    const empty = CHANGELOG.replace('- **Back to it?:** a game you gave hours to.\n', '')
    expect(dateChangelog(empty, '1.5.0', '2026-11-02').error).toMatch('empty')
    // 1.5.10 isn't 1.5.1
    expect(dateChangelog(CHANGELOG.replace('[1.5.0]', '[1.5.10]'), '1.5.1', '2026-11-02').error).toBeDefined()
  })

  it('the local day', () => {
    expect(isoDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})
