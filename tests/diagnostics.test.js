import { describe, expect, it } from 'vitest'
import { logLine, logTime, MAX_LINE, parseLogLine, shortDuration } from '../src/lib/core/diagnostics.js'

const at = new Date(2026, 9, 17, 6, 40, 12)

describe('diagnostic log', () => {
  it('a line with the date, an aligned kind and the text', () => {
    expect(logTime(at)).toBe('2026-10-17 06:40:12')
    expect(logLine('launch', 'Ōkami (PS2) con XBSX2', at)).toBe('2026-10-17 06:40:12  LANZAR    Ōkami (PS2) con XBSX2')
    expect(logLine('quickExit', 'RE3 a los 4 s', at)).toBe('2026-10-17 06:40:12  NO ABRIÓ  RE3 a los 4 s')
  })

  it('without line breaks and with a maximum length', () => {
    expect(logLine('error', 'uno\ndos\r\ntres', at)).toBe('2026-10-17 06:40:12  ERROR     uno dos tres')
    const long = logLine('launch', 'x'.repeat(2000), at)
    expect(long.length).toBe(MAX_LINE + 1)
    expect(long.endsWith('…')).toBe(true)
  })

  it('reads back, including the ones the shell writes', () => {
    expect(parseLogLine(logLine('quickExit', 'RE3 a los 4 s', at))).toEqual({
      time: '2026-10-17 06:40:12',
      kind: 'NO ABRIÓ',
      text: 'RE3 a los 4 s',
    })
    // MainPage.LogLine: "ERROR".PadRight(9)
    expect(parseLogLine('2026-10-17 06:41:00  ERROR     La interfaz se cerró sola').kind).toBe('ERROR')
    expect(parseLogLine('texto suelto')).toEqual({ time: '', kind: '', text: 'texto suelto' })
  })

  it('short durations', () => {
    expect(shortDuration(4)).toBe('4 s')
    expect(shortDuration(45 * 60)).toBe('45 min')
    expect(shortDuration(72 * 60)).toBe('1 h 12 min')
    expect(shortDuration(2 * 3600)).toBe('2 h')
  })
})
