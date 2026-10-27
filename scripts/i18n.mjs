/**
 * Checks the translations: finds in src/ every text that goes through t(), tn()
 * or plural() and says which ones have no English version in src/lib/i18n/en.js.
 *
 *   node scripts/i18n.mjs            untranslated texts (ready to copy into en.js) and
 *                                    entries in en.js the code no longer has; it fails
 *                                    (exit 1) if there's any, so CI stops
 *   node scripts/i18n.mjs --unused   only the entries the code no longer has
 *
 * tests/i18n.test.js uses the same functions.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// With node: next to this file. Inside vitest (jsdom) the URL isn't file:, and
// the tests run from the project's root.
const IS_FILE = import.meta.url.startsWith('file:')
const ROOT = IS_FILE ? join(dirname(fileURLToPath(import.meta.url)), '..') : process.cwd()

/** Every .js and .svelte in src/ (except the test data) */
export function sourceFiles(dir = join(ROOT, 'src')) {
  /** @type {string[]} */
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'mock' && entry.name !== 'i18n') out.push(...sourceFiles(path))
    } else if (/\.(js|svelte)$/.test(entry.name)) out.push(path)
  }
  return out
}

/** Reads a JS literal that starts at `at` ('…', "…" or `…`). null if it isn't a single one. */
function readString(src, at) {
  const quote = src[at]
  if (!`'"\``.includes(quote)) return null
  let i = at + 1
  while (i < src.length && src[i] !== quote) {
    if (src[i] === '\\') i++
    else if (quote === '`' && src[i] === '$' && src[i + 1] === '{') return { dynamic: true, end: i }
    i++
  }
  const literal = src.slice(at, i + 1)
  // eslint-disable-next-line no-new-func
  return { value: Function(`return ${literal}`)(), end: i + 1 }
}

/** Splits the arguments of a call that opens at `at` (right after "("). */
function readArgs(src, at) {
  /** @type {Array<{ start: number, text: string }>} */
  const args = []
  let depth = 0
  let start = at
  for (let i = at; i < src.length; i++) {
    const c = src[i]
    if (`'"\``.includes(c)) {
      // skips the whole literal (templates with ${} are handled separately)
      let j = i + 1
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') j++
        else if (c === '`' && src[j] === '$' && src[j + 1] === '{') {
          let d = 1
          j += 2
          while (j < src.length && d > 0) {
            if (src[j] === '{') d++
            else if (src[j] === '}') d--
            j++
          }
          continue
        }
        j++
      }
      i = j
    } else if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) {
      if (depth === 0) {
        args.push({ start, text: src.slice(start, i) })
        return args
      }
      depth--
    } else if (c === ',' && depth === 0) {
      args.push({ start, text: src.slice(start, i) })
      start = i + 1
    }
  }
  return args
}

/**
 * The texts of t('…'), tn(n, '…', '…') and plural(n, '…', '…') in a file.
 * @returns {{ keys: Array<{ key: string, line: number }>, problems: string[] }}
 */
export function extractFromSource(src, name = '') {
  const keys = []
  const problems = []
  const lineOf = (at) => src.slice(0, at).split('\n').length
  for (const match of src.matchAll(/(?<![\w.$])(t|tn|plural)\(/g)) {
    const open = (match.index ?? 0) + match[0].length
    const args = readArgs(src, open)
    const which = match[1] === 't' ? [0] : [1, 2]
    for (const index of which) {
      const arg = args[index]
      if (!arg) continue
      const trimmed = arg.text.trim()
      if (!trimmed || !`'"\``.includes(trimmed[0])) continue // a variable: checked at runtime
      const at = arg.start + arg.text.indexOf(trimmed[0])
      const read = readString(src, at)
      if (!read) continue
      if (read.dynamic) {
        problems.push(`${name}:${lineOf(at)} uses \${} inside ${match[1]}(): pass the values as {name}`)
        continue
      }
      if (src.slice(read.end, arg.start + arg.text.length).trim() !== '') {
        problems.push(`${name}:${lineOf(at)} builds the text of ${match[1]}() with +: write it whole`)
        continue
      }
      keys.push({ key: read.value, line: lineOf(at) })
    }
  }
  return { keys, problems }
}

/** Every text in src/, with where it appears */
export function collectKeys() {
  /** @type {Map<string, string[]>} */
  const keys = new Map()
  const problems = []
  for (const file of sourceFiles()) {
    const name = relative(ROOT, file)
    const found = extractFromSource(readFileSync(file, 'utf8'), name)
    problems.push(...found.problems)
    for (const { key, line } of found.keys) {
      if (!keys.has(key)) keys.set(key, [])
      keys.get(key)?.push(`${name}:${line}`)
    }
  }
  return { keys, problems }
}

/** Every .js and .svelte in src/ but en.js, together: the demo and the i18n code included */
export function allSourceText(dir = join(ROOT, 'src')) {
  /** @type {string[]} */
  const texts = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) texts.push(allSourceText(path))
    else if (/\.(js|svelte)$/.test(entry.name) && !(entry.name === 'en.js' && dir.endsWith('i18n'))) {
      texts.push(readFileSync(path, 'utf8'))
    }
  }
  return texts.join('\n')
}

/** A text written as a JS literal, with each kind of quote @param {string} text */
function literals(text) {
  const escape = (/** @type {string} */ quote) => text.replace(/\\/g, '\\\\').replaceAll(quote, `\\${quote}`)
  return [`'${escape("'")}'`, `"${escape('"')}"`, `\`${escape('`')}\``]
}

/**
 * The entries in en.js that nothing in src/ writes anymore. A text counts as used
 * if it's written anywhere as a literal, not only inside t(): many go through t()
 * later, from a table (the regions, the log's kinds, the news).
 * @param {Record<string, string>} en
 * @param {string} [source]  allSourceText()
 */
export function unusedKeys(en, source = allSourceText()) {
  return Object.keys(en).filter((key) => !literals(key).some((literal) => source.includes(literal)))
}

/** The {name}s of a text, sorted */
export const placeholders = (/** @type {string} */ text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

if (IS_FILE && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { default: EN } = await import('../src/lib/i18n/en.js')
  const { keys, problems } = collectKeys()
  for (const p of problems) console.log('PROBLEM', p)
  const unused = unusedKeys(EN)
  if (process.argv.includes('--unused')) {
    for (const key of unused) console.log(JSON.stringify(key))
  } else {
    let n = 0
    for (const [key, where] of keys) {
      if (key in EN) continue
      n++
      console.log(`  // ${where[0]}\n  ${JSON.stringify(key)}: '',`)
    }
    console.log(`// ${n} untranslated out of ${keys.size}`)
    if (unused.length > 0) {
      console.log(`// ${unused.length} in en.js that the code no longer has (delete them):`)
      for (const key of unused) console.log(`  ${JSON.stringify(key)}`)
    }
    if (n > 0 || unused.length > 0 || problems.length > 0) process.exitCode = 1
  }
}
