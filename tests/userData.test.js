import { describe, expect, it } from 'vitest'
import {
  chooseSource,
  closeSession,
  MAX_SESSION_SECONDS,
  mostPlayed,
  parseUserData,
  serializeUserData,
  totalSeconds,
} from '../src/lib/core/userData.js'
import { formatPlaytime } from '../src/lib/ui/format.js'

const MIN = 60_000
const HOUR = 60 * MIN

describe('data.json', () => {
  it('round trip with a readable date', () => {
    const at = Date.UTC(2026, 9, 16, 5, 0, 0)
    const text = serializeUserData({ favorites: { 'ps2/Okami.chd': true }, hidden: ['psx/BIOS.bin'], session: null }, at)
    expect(text).toContain('"savedAt": "2026-10-16T05:00:00.000Z"')
    expect(text).toContain('"app": "relix"')
    const back = parseUserData(text)
    expect(back?.savedAt).toBe(at)
    expect(back?.values).toEqual({ favorites: { 'ps2/Okami.chd': true }, hidden: ['psx/BIOS.bin'], session: null })
  })

  it("rejects files that aren't Relix's or are damaged", () => {
    expect(parseUserData('')).toBeNull()
    expect(parseUserData('{"favorites": {}')).toBeNull()
    expect(parseUserData('{"app": "otra"}')).toBeNull()
    expect(parseUserData('[1, 2]')).toBeNull()
  })

  it("a damaged key doesn't drag down the others", () => {
    const data = parseUserData(JSON.stringify({
      app: 'relix',
      savedAt: 'no es fecha',
      hidden: 'debería ser lista',
      favorites: { 'gc/F-Zero GX.rvz': true },
      session: { id: 'x' },
      playtime: { 'a': { seconds: 120, plays: 2 }, 'b': { seconds: -5 }, 'c': { seconds: '90' } },
    }))
    expect(data?.savedAt).toBe(0)
    expect(data?.values.hidden).toBeUndefined()
    expect(data?.values.session).toBeUndefined()
    expect(data?.values.favorites).toEqual({ 'gc/F-Zero GX.rvz': true })
    expect(data?.values.playtime).toEqual({ a: { seconds: 120, plays: 2 }, c: { seconds: 90, plays: 1 } })
  })
})

describe('which copy rules at startup', () => {
  const drive = 'E:\\|RELIX (E:)'
  it('the USB drive as Relix left it: the newest rules', () => {
    expect(chooseSource({ savedAt: 100 }, { savedAt: 100, synced: 100, drive }, drive)).toBe('usb')
    // changes in the app that didn't make it to the USB drive
    expect(chooseSource({ savedAt: 100 }, { savedAt: 200, synced: 100, drive }, drive)).toBe('local')
  })
  it('the USB drive changed outside (another Xbox or a backup copied over it): the USB drive rules', () => {
    expect(chooseSource({ savedAt: 300 }, { savedAt: 200, synced: 100, drive }, drive)).toBe('usb')
    expect(chooseSource({ savedAt: 50 }, { savedAt: 200, synced: 100, drive }, drive)).toBe('usb')
  })
  it("a freshly installed app takes the USB drive's", () => {
    expect(chooseSource({ savedAt: 100 }, { savedAt: 0, synced: 0, drive: '' }, drive)).toBe('usb')
  })
  it("the first time with backups: the app's data is copied to the USB drive", () => {
    expect(chooseSource(null, { savedAt: 300, synced: 0, drive: '' }, drive)).toBe('local')
  })
  it('another USB drive: its own rules, or it starts from scratch if it has none', () => {
    expect(chooseSource({ savedAt: 1 }, { savedAt: 999, synced: 1, drive: 'F:\\|OTRO' }, drive)).toBe('usb')
    expect(chooseSource(null, { savedAt: 999, synced: 0, drive: 'F:\\|OTRO' }, drive)).toBe('fresh')
  })
})

describe('playtime', () => {
  const start = Date.UTC(2026, 9, 16, 20, 0, 0)
  const session = { id: 'ps2/Okami.chd', startedAt: start }

  it('adds the time and one more session', () => {
    const first = closeSession({}, session, start + 45 * MIN)
    expect(first.seconds).toBe(2700)
    const second = closeSession(first.playtime, session, start + 2 * HOUR)
    expect(second.playtime['ps2/Okami.chd']).toEqual({ seconds: 2700 + 7200, plays: 2 })
  })

  it("doesn't count sessions under 1 minute or over 12 hours", () => {
    expect(closeSession({}, session, start + 30_000).seconds).toBe(0)
    expect(closeSession({}, session, start + (MAX_SESSION_SECONDS + 1) * 1000).seconds).toBe(0)
    expect(closeSession({}, null, start).seconds).toBe(0)
  })

  it('most played and total, only of the games still there', () => {
    const playtime = { a: { seconds: 100, plays: 1 }, b: { seconds: 900, plays: 3 }, c: { seconds: 500, plays: 2 }, d: { seconds: 50, plays: 1 } }
    expect(mostPlayed(playtime).map((g) => g.id)).toEqual(['b', 'c', 'a'])
    expect(mostPlayed(playtime, (id) => id !== 'b', 2).map((g) => g.id)).toEqual(['c', 'a'])
    expect(totalSeconds(playtime)).toBe(1550)
    expect(totalSeconds(playtime, (id) => id === 'a')).toBe(100)
  })

  it('is shown in words', () => {
    expect(formatPlaytime(30)).toBe('menos de 1 min')
    expect(formatPlaytime(45 * 60)).toBe('45 min')
    expect(formatPlaytime(3 * 3600)).toBe('3 h')
    expect(formatPlaytime(3 * 3600 + 20 * 60)).toBe('3 h 20 min')
    expect(formatPlaytime(12 * 3600 + 30 * 60)).toBe('12 h')
  })
})
