import { describe, expect, it } from 'vitest'
import { COMEBACK_IDLE_DAYS, comebackGames, comebackOfTheDay, isComeback } from '../src/lib/core/comeback.js'
import { monthKey, monthName, monthSummary, monthText, previousMonth } from '../src/lib/core/monthly.js'
import { SAVER_WEIGHTS, saverOrder, saverWeight } from '../src/lib/core/saverOrder.js'

const DAY = 24 * 60 * 60 * 1000
const H = 3600
const now = new Date(2026, 10, 3, 20, 0).getTime() // 3 Nov 2026
const games = ['okami', 'fzero', 'tekken', 'crash', 'spyro'].map((id) => ({ id }))
const data = {
  now,
  playtime: { okami: { seconds: 12 * H }, fzero: { seconds: 3 * H }, tekken: { seconds: 1 * H }, crash: { seconds: 5 * H } },
  lastPlayed: { okami: now - 70 * DAY, fzero: now - 40 * DAY, tekken: now - 90 * DAY, crash: now - 2 * DAY },
}

describe('want to pick it back up?', () => {
  it('2 h or more, and a month without playing it', () => {
    expect(isComeback('okami', data)).toBe(true)
    expect(isComeback('fzero', data)).toBe(true)
    expect(isComeback('tekken', data)).toBe(false) // only 1 h
    expect(isComeback('crash', data)).toBe(false) // played 2 days ago
    expect(isComeback('spyro', data)).toBe(false) // never played
    expect(isComeback('okami', { ...data, now: data.lastPlayed.okami + (COMEBACK_IDLE_DAYS - 1) * DAY })).toBe(false)
  })

  it('the most played first, and the ones taken out of Continue playing stay out', () => {
    expect(comebackGames(games, data).map((g) => g.id)).toEqual(['okami', 'fzero'])
    expect(comebackGames(games, { ...data, skip: ['okami'] }).map((g) => g.id)).toEqual(['fzero'])
  })

  it('a different one each day, among the five most played', () => {
    const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    const week = Array.from({ length: 5 }, (_, i) => comebackOfTheDay(list, now + i * DAY))
    expect(new Set(week).size).toBe(5)
    expect(week.every((id) => ['a', 'b', 'c', 'd', 'e'].includes(/** @type {string} */ (id)))).toBe(true)
    // the same all day
    expect(comebackOfTheDay(list, now)).toBe(comebackOfTheDay(list, now - 19 * H * 1000))
    expect(comebackOfTheDay([], now)).toBeNull()
  })
})

describe('your month', () => {
  const days = {
    '2026-09-28': { okami: 2 * H },
    '2026-10-02': { okami: 4 * H, fzero: 1 * H },
    '2026-10-15': { okami: 2 * H, splatoon: 1800 },
    '2026-11-01': { crash: H },
  }
  const playtime = { okami: { seconds: 40 * H }, fzero: { seconds: H }, splatoon: { seconds: 1800 }, crash: { seconds: H } }

  it('how much, which game the most, and the new ones', () => {
    const october = monthSummary(days, '2026-10', { playtime })
    expect(october.seconds).toBe(7.5 * H)
    expect(october.top.map((g) => g.id)).toEqual(['okami', 'fzero', 'splatoon'])
    // F-Zero and Splatoon: all their time is in October. Okami was played before
    expect(october.fresh).toBe(2)
  })

  it('a game played before the days were kept (before 1.3.0) is not new', () => {
    const summary = monthSummary({ '2026-10-02': { okami: H } }, '2026-10', { playtime: { okami: { seconds: 40 * H } } })
    expect(summary.fresh).toBe(0)
  })

  it('only the games still on the USB drive', () => {
    expect(monthSummary(days, '2026-10', { playtime, keep: (id) => id !== 'okami' }).top.map((g) => g.id)).toEqual(['fzero', 'splatoon'])
  })

  it('months: the key, the one before, the name', () => {
    expect(monthKey(now)).toBe('2026-11')
    expect(previousMonth('2026-11')).toBe('2026-10')
    expect(previousMonth('2027-01')).toBe('2026-12')
    expect(monthName('2026-10')).toBe('octubre')
    expect(monthName('2026-10', { capital: true })).toBe('Octubre')
  })

  it('the notice', () => {
    const names = /** @type {Record<string, string>} */ ({ okami: 'Ōkami', fzero: 'F-Zero GX' })
    const time = (/** @type {number} */ s) => `${Math.round(s / 360) / 10} h`
    expect(monthText(monthSummary(days, '2026-10', { playtime }), (id) => names[id] ?? id, time)).toBe(
      'En octubre jugaste 7.5 h: sobre todo Ōkami (6 h), y probaste 2 juegos nuevos.',
    )
    const one = monthSummary({ '2026-09-28': { okami: 2 * H } }, '2026-09', { playtime })
    expect(monthText(one, (id) => names[id] ?? id, time)).toBe('En septiembre jugaste 2 h, todo a Ōkami.')
  })
})

describe('the screensaver, with your games', () => {
  it('weighs more what you play and what waits to be picked back up', () => {
    expect(saverWeight('crash', data)).toBe(SAVER_WEIGHTS.recent)
    expect(saverWeight('okami', data)).toBe(SAVER_WEIGHTS.comeback)
    expect(saverWeight('tekken', data)).toBe(SAVER_WEIGHTS.played)
    expect(saverWeight('spyro', data)).toBe(SAVER_WEIGHTS.never)
  })

  it('every game once, and the heavy ones tend to come first', () => {
    let seed = 11
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const firsts = { crash: 0, spyro: 0 }
    for (let i = 0; i < 2000; i++) {
      const order = saverOrder(games, data, random)
      expect(new Set(order.map((g) => g.id)).size).toBe(games.length)
      if (order[0].id === 'crash') firsts.crash++
      if (order[0].id === 'spyro') firsts.spyro++
    }
    expect(firsts.crash).toBeGreaterThan(firsts.spyro * 2)
  })
})
