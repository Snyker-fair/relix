import { describe, expect, it } from 'vitest'
import { ISSUES_URL, REPORT_URL_MAX, reportUrl } from '../src/lib/core/report.js'

const about = ['Relix 1.5.0 · Xbox · App', 'Revisión: Nintendo 3DS: falta RetroArch 3DS']
const log = Array.from({ length: 40 }, (_, i) => `2026-10-27 05:51:${String(i).padStart(2, '0')}  LANZAR    Juego ${i} (PS2) con XBSX2`)

/** The form's fields, from the address @param {string} url */
const fields = (url) => Object.fromEntries(new URL(url).searchParams)

describe('report a problem', () => {
  it("opens the form in the person's language, with the version", () => {
    expect(reportUrl({ version: '1.5.0', language: 'es', about, log: [] }).startsWith(`${ISSUES_URL}?`)).toBe(true)
    expect(fields(reportUrl({ version: '1.5.0', language: 'es', about, log: [] }))).toMatchObject({ template: 'bug_es.yml', version: '1.5.0' })
    expect(fields(reportUrl({ version: '1.5.0', language: 'en', about, log: [] })).template).toBe('bug.yml')
  })

  it('Relix and the Xbox always; from the log, the newest lines that fit', () => {
    const url = reportUrl({ version: '1.5.0', language: 'es', about, log })
    expect(url.length).toBeLessThanOrEqual(REPORT_URL_MAX)
    const text = fields(url).log
    expect(text.startsWith(about.join('\n'))).toBe(true)
    expect(text).toContain('log.txt:')
    // one space between the log's columns
    expect(text.endsWith(log[39].replace(/\s{2,}/g, ' '))).toBe(true)
    expect(text).not.toContain(log[0])
  })

  it('a long line is cut, and without a log only Relix and the Xbox go', () => {
    const long = `2026-10-27 05:51:00  ERROR     ${'x'.repeat(300)}`
    const text = fields(reportUrl({ version: '1.5.0', language: 'es', about, log: [long] })).log
    expect(text.split('\n').at(-1)).toHaveLength(110)
    expect(fields(reportUrl({ version: '1.5.0', language: 'es', about, log: [] })).log).toBe(about.join('\n'))
  })
})
