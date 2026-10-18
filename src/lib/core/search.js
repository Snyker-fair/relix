/**
 * Searching games by name, made for typing with the controller:
 * each word typed has to be the start of some word in the title.
 * "kin he" finds "Kingdom Hearts"; "ff 7" doesn't, but "final fan"
 * does. Without accents or uppercase, and Roman numerals count as digits
 * ("kingdom hearts 2" finds "Kingdom Hearts II").
 */

const ROMAN = /** @type {Record<string, string>} */ ({
  ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10',
  xi: '11', xii: '12', xiii: '13',
})

/**
 * Comparable text: lowercase, without accents or symbols.
 * "Ōkami: Édition & More" -> "okami edition and more"
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

/** A word and, if it's a Roman numeral, its digits too */
function variants(/** @type {string} */ word) {
  const number = ROMAN[word]
  return number ? [word, number] : [word]
}

/**
 * @template {{ name: string, sortName?: string }} T
 * @param {T[]} games
 * @param {string} query  what the player typed
 * @param {{ limit?: number }} [options]
 * @returns {T[]}  the ones that match, the closest first
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
    // First the ones that start like what was typed, then the ones that start with the first word
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
