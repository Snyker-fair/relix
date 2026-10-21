import { describe, expect, it } from 'vitest'
import { addSession, cleanPlayDays, dayKey, KEEP_DAYS, renameInPlayDays, startOfWeek, weeklyTotals } from '../src/lib/core/playDays.js'
import { parseUserData, serializeUserData } from '../src/lib/core/userData.js'
import { renameInUserData } from '../src/lib/core/rename.js'

/** A local time: the days are the player's, wherever the Xbox is */
const at = (/** @type {number[]} */ ...parts) => new Date(parts[0], parts[1] - 1, parts[2], parts[3] ?? 12, parts[4] ?? 0).getTime()
const okami = 'ps2/Okami (USA).chd'
const crash = 'psx/Crash Bandicoot (USA).chd'

describe('time played per day', () => {
  it('adds a session to its day', () => {
    const days = addSession({}, okami, at(2026, 10, 21, 20, 0), at(2026, 10, 21, 20, 25))
    expect(days).toEqual({ '2026-10-21': { [okami]: 1500 } })
    const more = addSession(days, okami, at(2026, 10, 21, 22, 0), at(2026, 10, 21, 22, 10))
    expect(more['2026-10-21'][okami]).toBe(2100)
    // the one it got is left as it was
    expect(days['2026-10-21'][okami]).toBe(1500)
  })

  it('past midnight, each day gets its part', () => {
    const days = addSession({}, okami, at(2026, 10, 21, 23, 30), at(2026, 10, 22, 0, 45))
    expect(days).toEqual({ '2026-10-21': { [okami]: 1800 }, '2026-10-22': { [okami]: 2700 } })
  })

  it('keeps only the last 26 weeks', () => {
    const old = { '2026-01-02': { [crash]: 600 }, [dayKey(at(2026, 10, 1))]: { [crash]: 300 } }
    const days = addSession(old, okami, at(2026, 10, 21, 20), at(2026, 10, 21, 21))
    expect(Object.keys(days).sort()).toEqual(['2026-10-01', '2026-10-21'])
    expect(KEEP_DAYS).toBe(182)
  })

  it('weeks go from Monday to Sunday, the oldest first', () => {
    // Wednesday 21 October 2026: the week started on Monday the 19th
    expect(startOfWeek(at(2026, 10, 21))).toBe(new Date(2026, 9, 19).getTime())
    expect(startOfWeek(at(2026, 10, 19, 0, 0))).toBe(new Date(2026, 9, 19).getTime())
    expect(startOfWeek(at(2026, 10, 25, 23, 59))).toBe(new Date(2026, 9, 19).getTime())

    const days = {
      '2026-10-20': { [okami]: 3600, [crash]: 600 },
      '2026-10-18': { [okami]: 1200 }, // Sunday: the week before
      '2026-08-01': { [okami]: 9000 }, // too far back for 8 weeks
    }
    const weeks = weeklyTotals(days, { now: at(2026, 10, 21), weeks: 8 })
    expect(weeks).toHaveLength(8)
    expect(weeks[7]).toEqual({ start: new Date(2026, 9, 19).getTime(), seconds: 4200 })
    expect(weeks[6]).toEqual({ start: new Date(2026, 9, 12).getTime(), seconds: 1200 })
    expect(weeks[0].start).toBe(new Date(2026, 7, 31).getTime())
    expect(weeks.slice(0, 6).every((w) => w.seconds === 0)).toBe(true)
  })

  it("one game's weeks, and only the games still in the library", () => {
    const days = { '2026-10-20': { [okami]: 3600, [crash]: 600 } }
    const now = at(2026, 10, 21)
    expect(weeklyTotals(days, { now, weeks: 2, id: crash }).map((w) => w.seconds)).toEqual([0, 600])
    expect(weeklyTotals(days, { now, weeks: 2, keep: (id) => id !== okami }).map((w) => w.seconds)).toEqual([0, 600])
  })

  it('what comes from the USB drive is cleaned', () => {
    expect(cleanPlayDays({ '2026-10-20': { [okami]: '61.4', [crash]: -5 }, 'ayer': { [okami]: 10 }, '2026-10-19': [] })).toEqual({
      '2026-10-20': { [okami]: 61 },
    })
    expect(cleanPlayDays(null)).toEqual({})
    expect(cleanPlayDays([1, 2])).toEqual({})
  })

  it('travels in data.json with the rest of your data', () => {
    const text = serializeUserData({ playDays: { '2026-10-20': { [okami]: 600 } } }, at(2026, 10, 21))
    expect(parseUserData(text)?.values.playDays).toEqual({ '2026-10-20': { [okami]: 600 } })
    const damaged = text.replace('"playDays": {', '"playDays": { "x": 1, "2026-10-19": { "a": 0 },')
    expect(parseUserData(damaged)?.values.playDays).toEqual({ '2026-10-20': { [okami]: 600 } })
  })

  it('a renamed game keeps its days', () => {
    const renamed = 'ps2/Okami (USA) (Rev 1).chd'
    const days = { '2026-10-20': { [okami]: 600, [crash]: 60 }, '2026-10-21': { [crash]: 30 } }
    expect(renameInPlayDays(days, okami, renamed)).toEqual({
      '2026-10-20': { [crash]: 60, [renamed]: 600 },
      '2026-10-21': { [crash]: 30 },
    })
    expect(renameInPlayDays(days, 'ps2/Otro.chd', renamed)).toBeNull()
    expect(renameInUserData({ playDays: days }, okami, renamed).playDays['2026-10-20'][renamed]).toBe(600)
    expect(renameInUserData({ playDays: days }, 'ps2/Otro.chd', renamed)).toEqual({})
  })
})
