/**
 * Búsqueda de juegos por nombre, pensada para escribir con el control:
 * cada palabra escrita tiene que ser el comienzo de alguna palabra del
 * título. "kin he" encuentra "Kingdom Hearts"; "ff 7" no, pero "final fan"
 * sí. Sin tildes ni mayúsculas, y los números romanos valen como cifras
 * ("kingdom hearts 2" encuentra "Kingdom Hearts II").
 */

const ROMAN = /** @type {Record<string, string>} */ ({
  ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10',
  xi: '11', xii: '12', xiii: '13',
})

/**
 * Texto comparable: minúsculas, sin tildes ni signos.
 * "Ōkami: Edición & Más" -> "okami edicion and mas"
 * @param {string} text
 */
export function searchKey(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Una palabra y, si es un número romano, también su cifra */
function variants(/** @type {string} */ word) {
  const number = ROMAN[word]
  return number ? [word, number] : [word]
}

/**
 * @template {{ name: string, sortName?: string }} T
 * @param {T[]} games
 * @param {string} query  lo que escribió el jugador
 * @param {{ limit?: number }} [options]
 * @returns {T[]}  los que calzan, los más parecidos primero
 */
export function searchGames(games, query, { limit = 60 } = {}) {
  const words = searchKey(query).split(' ').filter(Boolean)
  if (words.length === 0) return []
  const phrase = words.join(' ')

  /** @type {Array<{ game: T, score: number }>} */
  const found = []
  for (const game of games) {
    const key = searchKey(game.name)
    const titleWords = key.split(' ').flatMap(variants)
    const matches = words.every((w) => variants(w).some((v) => titleWords.some((t) => t.startsWith(v))))
    if (!matches) continue
    // Primero los que empiezan como lo escrito, luego los que empiezan con la primera palabra
    const score = key.startsWith(phrase) ? 0 : titleWords[0]?.startsWith(words[0]) ? 1 : 2
    found.push({ game, score })
  }

  return found
    .sort(
      (a, b) =>
        a.score - b.score ||
        (a.game.sortName ?? a.game.name).localeCompare(b.game.sortName ?? b.game.name, 'es', { sensitivity: 'base' }),
    )
    .slice(0, limit)
    .map((f) => f.game)
}
