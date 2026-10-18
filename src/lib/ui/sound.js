/**
 * Interface sounds, synthesized with Web Audio (no audio files).
 * Soft and short: a "tick" when moving, a "pop" when choosing.
 */

/** @type {AudioContext|null} */
let ctx = null
let muted = false

function audio() {
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
    warnIfBlocked()
  }
  return ctx
}

let warned = false
/** Leaves a hint in the console (edge://inspect) if the browser blocks the audio. */
function warnIfBlocked() {
  if (warned) return
  setTimeout(() => {
    if (ctx?.state === 'suspended' && !warned) {
      warned = true
      console.warn(
        '[Relix] Audio is blocked by the autoplay policy. On the Xbox, ' +
          'the shell must pass --autoplay-policy=no-user-gesture-required to the WebView2.',
      )
    }
  }, 1000)
}

/**
 * @param {Array<[number, number]>} notes  [frequency Hz, start in s]
 * @param {{ type?: OscillatorType, length?: number, volume?: number }} [opts]
 */
function play(notes, { type = 'sine', length = 0.09, volume = 0.08 } = {}) {
  if (muted) return
  const ac = audio()
  if (!ac) return
  const t0 = ac.currentTime
  for (const [freq, start] of notes) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0 + start)
    // a small upward "jump" in pitch: it sounds more like a bubble
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, t0 + start + length * 0.6)
    gain.gain.setValueAtTime(0.0001, t0 + start)
    gain.gain.exponentialRampToValueAtTime(volume, t0 + start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + length)
    osc.connect(gain).connect(ac.destination)
    osc.start(t0 + start)
    osc.stop(t0 + start + length + 0.02)
  }
}

export const sound = {
  move: () => play([[740, 0]], { length: 0.05, volume: 0.04 }),
  select: () => play([[620, 0], [930, 0.06]], { length: 0.1 }),
  back: () => play([[700, 0], [470, 0.05]], { length: 0.08, volume: 0.06 }),
  favorite: () => play([[880, 0], [1100, 0.05], [1320, 0.1]], { length: 0.08, volume: 0.05 }),
  error: () => play([[220, 0], [196, 0.09]], { type: 'triangle', length: 0.12, volume: 0.07 }),
  /** @param {boolean} value */
  setMuted(value) {
    muted = value
  },
}
