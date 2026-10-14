/**
 * Sonidos de la interfaz, sintetizados con Web Audio (sin archivos de audio).
 * Suaves y cortos: un "tic" al mover, un "pop" al elegir.
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
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

/**
 * @param {Array<[number, number]>} notes  [frecuencia Hz, inicio en s]
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
    // pequeño "salto" de tono hacia arriba: suena más a burbuja
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
