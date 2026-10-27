/**
 * The CHANGELOG when a version is released. `npm version` runs it by itself
 * (scripts in package.json):
 *
 *   preversion  node scripts/changelog-date.mjs --check
 *               the new version needs its section in CHANGELOG.md
 *               (`## [1.5.0] - unreleased`) with something in it; otherwise npm
 *               stops before changing anything.
 *   version     node scripts/changelog-date.mjs
 *               writes today's date in that section's heading
 *               (`## [1.5.0] - 2026-11-02`) and adds the file to the version's commit.
 *
 * By hand: node scripts/changelog-date.mjs 1.5.0 [--check]
 * tests/changelog.test.js uses the same function.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** What a section says while its version isn't out yet */
export const UNRELEASED = 'unreleased'

/** "2026-11-02", the local day @param {Date} date */
export function isoDay(date) {
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * The CHANGELOG with the version's date, or why it can't be released.
 * @param {string} text  CHANGELOG.md
 * @param {string} version  "1.5.0"
 * @param {string} day  "2026-11-02"
 * @returns {{ text: string, error?: undefined } | { error: string, text?: undefined }}
 */
export function dateChangelog(text, version, day) {
  const escaped = version.replace(/[.]/g, '\\.')
  const heading = new RegExp(`^## \\[${escaped}\\] - ([^\\r\\n]*)`, 'm')
  const found = heading.exec(text)
  if (!found) {
    return { error: `CHANGELOG.md has no section for ${version}: add "## [${version}] - ${UNRELEASED}" with its changes.` }
  }
  const rest = text.slice(found.index + found[0].length)
  const next = rest.search(/^## \[/m)
  const body = (next >= 0 ? rest.slice(0, next) : rest).trim()
  if (!body) return { error: `The ${version} section in CHANGELOG.md is empty: those lines become the release notes.` }
  const when = found[1].trim()
  // Already dated (the release is being redone): it stays as it is
  if (when !== UNRELEASED) return { text }
  return { text: text.slice(0, found.index) + `## [${version}] - ${day}` + rest }
}

function main() {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const version = args.find((a) => /^\d+\.\d+\.\d+$/.test(a)) ?? process.env.npm_new_version
  if (!version) {
    console.error('Which version? node scripts/changelog-date.mjs 1.5.0 (npm version passes it by itself)')
    process.exit(1)
  }
  const file = fileURLToPath(new URL('../CHANGELOG.md', import.meta.url))
  const before = readFileSync(file, 'utf8')
  const result = dateChangelog(before, version, isoDay(new Date()))
  if (result.error !== undefined) {
    console.error(result.error)
    process.exit(1)
  }
  if (check) return
  if (result.text !== before) {
    writeFileSync(file, result.text)
    console.log(`CHANGELOG.md: ${version} - ${isoDay(new Date())}`)
  }
  execFileSync('git', ['add', file], { stdio: 'inherit' })
}

/** Run with node (not imported by the tests; inside vitest the URL isn't file:) */
function isCli() {
  if (!import.meta.url.startsWith('file:') || !process.argv[1]) return false
  const self = fileURLToPath(import.meta.url)
  const run = resolve(process.argv[1])
  return process.platform === 'win32' ? self.toLowerCase() === run.toLowerCase() : self === run
}

if (isCli()) main()
