import { afterEach, describe, expect, it, vi } from 'vitest'
import { playtimeNotice, systemNotice } from '../src/lib/core/notices.js'
import { PLAYTIME_MS, START_NOTICE_MS, toasts } from '../src/lib/ui/toasts.svelte.js'

describe('what Relix says by itself', () => {
  it('what is left to fix, by name when Relix is a Game', () => {
    expect(systemNotice(0, 'game')).toBeNull()
    expect(systemNotice(2, 'app')).toBe('Relix encontró 2 cosas por arreglar: ≡ › Revisión')
    expect(systemNotice(1, 'game')).toBe(
      'Relix está como Game: cámbialo a App en Dev Home para volver al instante (≡ › Revisión)',
    )
    expect(systemNotice(3, 'game')).toBe('Relix encontró 3 cosas por arreglar, y está como Game: ≡ › Revisión')
    expect(systemNotice(1, null)).toBe('Relix encontró 1 cosa por arreglar: ≡ › Revisión')
  })

  it('the time played, with the total once there is more than this time', () => {
    const time = (/** @type {number} */ s) => `${s / 60} min`
    expect(playtimeNotice('Ōkami', 600, 600, time)).toBe('Ōkami: 10 min jugados')
    expect(playtimeNotice('Ōkami', 600, 1800, time)).toBe('Ōkami: 10 min jugados · 30 min en total')
  })
})

describe('the notices at the top', () => {
  afterEach(() => vi.useRealTimers())

  it('one after another, after the one on screen', () => {
    vi.useFakeTimers()
    toasts.show('Ōkami: 10 min jugados', PLAYTIME_MS)
    toasts.queue(['uno', 'dos'])
    expect(toasts.message).toBe('Ōkami: 10 min jugados')
    vi.advanceTimersByTime(PLAYTIME_MS + 100)
    expect(toasts.message).toBe('uno')
    vi.advanceTimersByTime(START_NOTICE_MS + 500)
    expect(toasts.message).toBe('dos')
    vi.advanceTimersByTime(START_NOTICE_MS)
    expect(toasts.message).toBe('')
  })
})
