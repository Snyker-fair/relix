/**
 * Your month in Relix, from the time played day by day (core/playDays.js): how
 * much you played, which game the most and how many you tried for the first
 * time. The first time Relix opens in a new month it says how the last one went,
 * and Options › About shows this month and the last one.
 */
import { i18n, plural, t } from '../i18n/i18n.svelte.js'

/** @typedef {import('./playDays.js').PlayDays} PlayDays */

/**
 * @typedef {Object} MonthSummary
 * @property {string} month   "2026-10"
 * @property {number} seconds  played that month
 * @property {Array<{ id: string, seconds: number }>} top  the games, the most played first
 * @property {number} fresh  games played for the first time that month
 */

const pad = (/** @type {number} */ n) => String(n).padStart(2, '0')

/** "2026-10", the local month @param {Date | number} date */
export function monthKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** "2026-10" -> "2026-09"; "2027-01" -> "2026-12" @param {string} month */
export function previousMonth(month) {
  const [year, number] = month.split('-').map(Number)
  return number === 1 ? `${year - 1}-12` : `${year}-${pad(number - 1)}`
}

/**
 * How a month went.
 * @param {PlayDays} days
 * @param {string} month  "2026-10"
 * @param {{ playtime: Record<string, { seconds: number }>, keep?: (id: string) => boolean }} options
 *   playtime: every game's total, to tell the ones played for the first time (everything
 *   they have is in that month); keep: only the games still on the USB drive
 * @returns {MonthSummary}
 */
export function monthSummary(days, month, { playtime, keep = () => true }) {
  /** @type {Map<string, number>} */
  const inMonth = new Map()
  /** Every game's seconds in the days kept, to compare with its total */
  /** @type {Map<string, number>} */
  const kept = new Map()
  /** The games played before this month (in the days kept) */
  const before = new Set()
  for (const [day, games] of Object.entries(days)) {
    for (const [id, seconds] of Object.entries(games)) {
      if (!keep(id)) continue
      kept.set(id, (kept.get(id) ?? 0) + seconds)
      if (day.startsWith(`${month}-`)) inMonth.set(id, (inMonth.get(id) ?? 0) + seconds)
      else if (day < month) before.add(id)
    }
  }
  const top = [...inMonth].map(([id, seconds]) => ({ id, seconds })).sort((a, b) => b.seconds - a.seconds)
  // New that month: nothing before it, and its total isn't bigger than what the days have
  // (a game played before 1.3.0, when the days weren't kept yet, isn't new)
  const fresh = top.filter(({ id }) => !before.has(id) && (playtime[id]?.seconds ?? 0) <= (kept.get(id) ?? 0) + 60).length
  return { month, seconds: top.reduce((n, g) => n + g.seconds, 0), top, fresh }
}

/**
 * The month's name: "octubre" ("October"); capital: "Octubre".
 * @param {string} month  "2026-10"
 * @param {{ capital?: boolean }} [options]
 */
export function monthName(month, { capital = false } = {}) {
  const [year, number] = month.split('-').map(Number)
  const name = new Intl.DateTimeFormat(i18n.dateLocale, { month: 'long' }).format(new Date(year, number - 1, 1))
  return capital ? name.charAt(0).toLocaleUpperCase(i18n.dateLocale) + name.slice(1) : name
}

/**
 * The notice: "In October you played 14 h, mostly Okami (6 h), and tried 3 new games".
 * @param {MonthSummary} summary
 * @param {(id: string) => string} nameOf
 * @param {(seconds: number) => string} time  formatPlaytime
 */
export function monthText(summary, nameOf, time) {
  const [first] = summary.top
  const values = {
    month: monthName(summary.month),
    time: time(summary.seconds),
    game: first ? nameOf(first.id) : '',
    gameTime: first ? time(first.seconds) : '',
  }
  if (summary.top.length === 1) return t('En {month} jugaste {time}, todo a {game}.', values)
  return summary.fresh > 0
    ? t('En {month} jugaste {time}: sobre todo {game} ({gameTime}), y probaste {fresh}.', {
        ...values,
        fresh: plural(summary.fresh, 'juego nuevo', 'juegos nuevos'),
      })
    : t('En {month} jugaste {time}: sobre todo {game} ({gameTime}).', values)
}
