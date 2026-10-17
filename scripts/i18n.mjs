/**
 * Revisa las traducciones: busca en src/ cada texto que pasa por t(), tn() o
 * plural() y dice cuáles no tienen su versión en inglés en src/lib/i18n/en.js.
 *
 *   node scripts/i18n.mjs            textos sin traducir (listos para copiar a en.js)
 *   node scripts/i18n.mjs --unused   entradas de en.js que ya no usa ningún t() literal
 *
 * tests/i18n.test.js usa las mismas funciones.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// Con node: junto a este archivo. Dentro de vitest (jsdom) la URL no es file:, y
// los tests corren desde la raíz del proyecto.
const IS_FILE = import.meta.url.startsWith('file:')
const ROOT = IS_FILE ? join(dirname(fileURLToPath(import.meta.url)), '..') : process.cwd()

/** Todos los .js y .svelte de src/ (menos los datos de prueba) */
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

/** Lee un literal de JS que empieza en `at` ('…', "…" o `…`). null si no es uno solo. */
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

/** Separa los argumentos de una llamada que abre en `at` (justo después de "("). */
function readArgs(src, at) {
  /** @type {Array<{ start: number, text: string }>} */
  const args = []
  let depth = 0
  let start = at
  for (let i = at; i < src.length; i++) {
    const c = src[i]
    if (`'"\``.includes(c)) {
      // salta el literal entero (las plantillas con ${} se tratan aparte)
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
 * Los textos de t('…'), tn(n, '…', '…') y plural(n, '…', '…') de un archivo.
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
      if (!trimmed || !`'"\``.includes(trimmed[0])) continue // variable: se revisa al correr
      const at = arg.start + arg.text.indexOf(trimmed[0])
      const read = readString(src, at)
      if (!read) continue
      if (read.dynamic) {
        problems.push(`${name}:${lineOf(at)} usa \${} dentro de ${match[1]}(): pasa los valores como {nombre}`)
        continue
      }
      if (src.slice(read.end, arg.start + arg.text.length).trim() !== '') {
        problems.push(`${name}:${lineOf(at)} arma el texto de ${match[1]}() con +: escríbelo entero`)
        continue
      }
      keys.push({ key: read.value, line: lineOf(at) })
    }
  }
  return { keys, problems }
}

/** Todos los textos de src/, con dónde aparecen */
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

/** Los {nombre} de un texto, ordenados */
export const placeholders = (/** @type {string} */ text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

if (IS_FILE && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { default: EN } = await import('../src/lib/i18n/en.js')
  const { keys, problems } = collectKeys()
  for (const p of problems) console.log('PROBLEMA', p)
  if (process.argv.includes('--unused')) {
    for (const key of Object.keys(EN)) if (!keys.has(key)) console.log(JSON.stringify(key))
  } else {
    let n = 0
    for (const [key, where] of keys) {
      if (key in EN) continue
      n++
      console.log(`  // ${where[0]}\n  ${JSON.stringify(key)}: '',`)
    }
    console.log(`// ${n} sin traducir de ${keys.size}`)
  }
}
