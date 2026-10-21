import { describe, expect, it } from 'vitest'
import { pickSurprise, surpriseWeight, WEIGHTS } from '../src/lib/core/surprise.js'

const games = ['never', 'barely', 'lots'].map((id) => ({ id }))
const playtime = { barely: { seconds: 600 }, lots: { seconds: 20 * 3600 } }
const lastPlayed = { barely: 1, lots: 2 }

/** A fixed "random" between 0 and 1 */
const at = (/** @type {number} */ r) => () => r

describe('surprise me', () => {
  it('the ones you never played weigh the most', () => {
    expect(surpriseWeight(undefined, undefined)).toBe(WEIGHTS.never)
    expect(surpriseWeight({ seconds: 600 }, 1)).toBe(WEIGHTS.barely)
    // opened but never counted (it closed in under a minute): barely played
    expect(surpriseWeight(undefined, 1)).toBe(WEIGHTS.barely)
    expect(surpriseWeight({ seconds: 20 * 3600 }, 2)).toBe(WEIGHTS.played)
  })

  it('picks by weight: 6 of 9 for the unplayed one, 2 for the barely played, 1 for the rest', () => {
    const pick = (/** @type {number} */ r) => pickSurprise(games, { playtime, lastPlayed, random: at(r) })?.id
    expect(pick(0)).toBe('never')
    expect(pick(5.9 / 9)).toBe('never')
    expect(pick(6.1 / 9)).toBe('barely')
    expect(pick(7.9 / 9)).toBe('barely')
    expect(pick(8.5 / 9)).toBe('lots')
    expect(pick(0.999999)).toBe('lots')
  })

  it("doesn't repeat in a round, and starts over when all were shown", () => {
    expect(pickSurprise(games, { playtime, lastPlayed, shown: ['never'], random: at(0) })?.id).toBe('barely')
    expect(pickSurprise(games, { playtime, lastPlayed, shown: ['never', 'barely'], random: at(0) })?.id).toBe('lots')
    expect(pickSurprise(games, { playtime, lastPlayed, shown: ['never', 'barely', 'lots'], random: at(0) })?.id).toBe('never')
  })

  it('nothing to pick from', () => {
    expect(pickSurprise([], { playtime, lastPlayed })).toBeNull()
  })

  it('over many picks, the unplayed come up about two thirds of the time', () => {
    let seed = 7
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const counts = { never: 0, barely: 0, lots: 0 }
    for (let i = 0; i < 9000; i++) counts[/** @type {keyof typeof counts} */ (pickSurprise(games, { playtime, lastPlayed, random })?.id)]++
    expect(counts.never / 9000).toBeCloseTo(6 / 9, 1)
    expect(counts.lots / 9000).toBeCloseTo(1 / 9, 1)
  })
})
