/**
 * The diagnostic log: one line of text per event, to read on the PC
 * (E:\relix\log.txt) or on the TV (Options › Checkup › Log).
 *
 *   2026-10-17 06:40:12  LAUNCH    Ōkami (PS2) with XBSX2 · xbsx2:?cmd=…
 *
 * The shell writes the same format when it logs something on its own
 * (LogLine in MainPage.xaml.cs). Each line stays in the language Relix had
 * when it was logged (the kind too: LANZAR or LAUNCH).
 */
import { t } from '../i18n/i18n.svelte.js'

/** Event kinds (each takes 9 columns, so the text lines up; in English too) */
export const LOG_KINDS = {
  start: 'INICIO',
  launch: 'LANZAR',
  back: 'VOLVIÓ',
  quickExit: 'NO ABRIÓ',
  error: 'ERROR',
  check: 'REVISIÓN',
  data: 'DATOS',
  covers: 'PORTADAS',
  usb: 'USB',
  rename: 'RENOMBRAR',
  info: 'FICHAS',
  memory: 'MEMORIA',
}

/** Longer lines are cut (URIs with long paths can go past 400) */
export const MAX_LINE = 600

const pad = (/** @type {number} */ n) => String(n).padStart(2, '0')

/** "2026-10-17 06:40:12" in local time @param {Date} date */
export function logTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * A line of the log.
 * @param {keyof typeof LOG_KINDS} kind
 * @param {string} text
 * @param {Date} [date]
 */
export function logLine(kind, text, date = new Date()) {
  const clean = String(text).replace(/[\r\n]+/g, ' ').trim()
  const line = `${logTime(date)}  ${t(LOG_KINDS[kind]).padEnd(9)} ${clean}`
  return line.length > MAX_LINE ? `${line.slice(0, MAX_LINE)}…` : line
}

/**
 * Splits a line into its parts, to show it on the TV.
 * A line without the expected shape stays whole as text.
 * @param {string} line
 * @returns {{ time: string, kind: string, text: string }}
 */
export function parseLogLine(line) {
  // Fixed columns: date (19), two spaces, kind (9), one space, text
  const time = line.slice(0, 19)
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(time) || line.slice(19, 21) !== '  ') {
    return { time: '', kind: '', text: line }
  }
  return { time, kind: line.slice(21, 30).trim(), text: line.slice(31) }
}

/** "4 s", "45 min", "1 h 12 min" @param {number} seconds */
export function shortDuration(seconds) {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s} s`
  const minutes = Math.round(s / 60)
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} h ${m} min` : `${h} h`
}
