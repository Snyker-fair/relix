/**
 * Registro de diagnóstico: una línea de texto por evento, para leer en el PC
 * (E:\relix\registro.txt) o en la TV (Opciones › Revisión › Registro).
 *
 *   2026-10-17 06:40:12  LANZAR    Ōkami (PS2) con XBSX2 · xbsx2:?cmd=…
 *
 * El shell escribe la misma forma cuando anota algo por su cuenta
 * (LogLine en MainPage.xaml.cs). Cada línea queda en el idioma que tenía
 * Relix al anotarla (el tipo también: LANZAR o LAUNCH).
 */
import { t } from '../i18n/i18n.svelte.js'

/** Tipos de evento (cada uno ocupa 9 columnas, así el texto queda alineado; en inglés también) */
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
}

/** Líneas más largas se cortan (las URIs con rutas largas pueden pasar los 400) */
export const MAX_LINE = 600

const pad = (/** @type {number} */ n) => String(n).padStart(2, '0')

/** "2026-10-17 06:40:12" en hora local @param {Date} date */
export function logTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * Una línea del registro.
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
 * Separa una línea en sus partes, para mostrarla en la TV.
 * Una línea que no tiene la forma esperada queda entera como texto.
 * @param {string} line
 * @returns {{ time: string, kind: string, text: string }}
 */
export function parseLogLine(line) {
  // Columnas fijas: fecha (19), dos espacios, tipo (9), un espacio, texto
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
