/**
 * "Report a problem" (Options › Checkup): a QR code that opens GitHub's form for
 * a problem on the phone, already filled in with what helps find the cause: the
 * version, the Xbox, what Checkup found and the last lines of the log. The person
 * sees all of it before sending, and can change it or delete it.
 *
 * The form is .github/ISSUE_TEMPLATE/bug.yml (bug_es.yml in Spanish): GitHub fills
 * each field from the address, by its id (version, log).
 */

export const ISSUES_URL = 'https://github.com/Snyker-fair/relix/issues/new'
/** Longer than this, the QR gets too dense to read from the sofa */
export const REPORT_URL_MAX = 900
/** Each line of the log, at most (the rest of a long line says little) */
const LINE_MAX = 110

/**
 * The form's address. The lines about Relix always go; from the log, the newest
 * that fit.
 * @param {Object} input
 * @param {string} input.version  "1.5.0"
 * @param {string} input.language  'es' opens the form in Spanish
 * @param {string[]} input.about  Relix and the Xbox, a line each
 * @param {string[]} input.log  the log's last lines, the oldest first
 * @param {number} [input.max]  the longest address
 */
export function reportUrl({ version, language, about, log, max = REPORT_URL_MAX }) {
  const template = language === 'es' ? 'bug_es.yml' : 'bug.yml'
  // The log's columns are lined up with spaces: one is enough here, and more lines fit
  const lines = log
    .map((line) => line.replace(/\s{2,}/g, ' '))
    .map((line) => (line.length > LINE_MAX ? `${line.slice(0, LINE_MAX - 1)}…` : line))
  /** @param {string[]} shown */
  const build = (shown) => {
    const text = shown.length > 0 ? [...about, '', 'log.txt:', ...shown].join('\n') : about.join('\n')
    return `${ISSUES_URL}?${new URLSearchParams({ template, version, log: text })}`
  }
  // The newest lines first: one more while the address still fits
  let count = 0
  while (count < lines.length && build(lines.slice(lines.length - count - 1)).length <= max) count++
  return build(lines.slice(lines.length - count))
}
