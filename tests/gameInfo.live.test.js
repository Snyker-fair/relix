/**
 * Against the real Wikidata and Wikipedia: only with RELIX_LIVE=1 (it needs internet).
 * It writes what it found to live-results.txt.
 */
import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  consoleIndex,
  findCandidates,
  findSureMatches,
  platformItems,
  politeGetJson,
  withDescriptions,
} from '../src/lib/core/gameInfo.js'
import { PLATFORMS } from '../src/lib/core/platforms.js'

const GAMES = {
  psx: ['Castlevania: Symphony of the Night', 'Final Fantasy VII', 'Crash Bandicoot', 'Metal Gear Solid', 'Spyro the Dragon', 'Silent Hill'],
  ps2: ['Okami', 'Ookami', 'Shadow of the Colossus', 'Kingdom Hearts 2', 'Ratchet & Clank', 'Gran Turismo 4', 'Persona 4', 'Final Fantasy X'],
  psp: ['Patapon', 'God of War: Chains of Olympus'],
  snes: ['Super Metroid', 'Chrono Trigger', 'The Legend of Zelda: A Link to the Past'],
  n64: ['Super Mario 64', 'The Legend of Zelda: Ocarina of Time'],
  gba: ['Metroid Fusion', 'Pokemon Emerald'],
  gc: ['The Legend of Zelda: The Wind Waker', 'Metroid Prime', 'Super Smash Bros. Melee', 'Resident Evil 4'],
  wiiu: ['Splatoon', 'Xenoblade Chronicles X'],
  n3ds: ['The Legend of Zelda: A Link Between Worlds'],
  megadrive: ['Sonic the Hedgehog 2'],
  dreamcast: ['Shenmue', 'Jet Set Radio'],
  xbox360: ['Halo 3', 'Red Dead Redemption'],
}

/** @type {string[]} */
const lines = []
/** @type {Record<string, number>} */
const statuses = {}
const getJson = politeGetJson({
  minInterval: 500,
  fetch: async (url) => {
    const host = new URL(url).hostname
    // Node's own User-Agent is turned away; a browser sends its own, and Api-User-Agent says who it is
    const agent = 'Relix/1.1 (https://github.com/Snyker-fair/relix) CI check'
    const response = await fetch(url, { headers: { 'User-Agent': agent, 'Api-User-Agent': agent } })
    const key = `${host} ${response.status}`
    statuses[key] = (statuses[key] ?? 0) + 1
    if (response.status === 429) lines.push(`429 ${host} Retry-After=${response.headers.get('Retry-After')}`)
    return response
  },
})

describe.runIf(process.env.RELIX_LIVE)('live Wikidata and Wikipedia', () => {
  it('lists each console, then finds the games', { timeout: 900_000 }, async () => {
    const started = Date.now()
    try {
      const items = await platformItems(PLATFORMS, getJson)
      lines.push(`platforms: ${JSON.stringify(items)}`)
      for (const [system, names] of Object.entries(GAMES)) {
        const t0 = Date.now()
        const index = await consoleIndex(items[system], getJson)
        lines.push(`${system}: ${index.items.size} names in ${Date.now() - t0} ms`)
        const games = names.map((name, i) => ({ id: `${system}/${i}`, name }))
        const t1 = Date.now()
        const { sure, unsure, notFound } = await findSureMatches(games, { index, lang: 'es', getJson })
        const described = await withDescriptions([...sure.values()], getJson)
        lines.push(`  batch in ${Date.now() - t1} ms`)
        for (const game of games) {
          const match = described.find((c) => c.id === sure.get(game.id)?.id)
          if (match) {
            lines.push(`  sure "${game.name}" -> ${match.id} "${match.title}" ${match.info.genre ?? ''} | ${match.info.players ?? ''} | desc ${match.info.desc?.length ?? 0}: ${match.info.desc?.slice(0, 60)}`)
          } else {
            const { candidates } = await findCandidates(game, { index, platformItem: items[system], lang: 'es', getJson })
            lines.push(`  ${unsure.includes(game.id) ? 'unsure' : notFound.includes(game.id) ? 'not found' : '?'} "${game.name}" -> ${candidates.map((c) => `${c.id} "${c.title}" ${c.year ?? ''}`).join(' | ') || 'none'}`)
          }
        }
      }
    } finally {
      lines.push(`requests: ${JSON.stringify(statuses)} in ${Math.round((Date.now() - started) / 1000)} s`)
      writeFileSync('live-results.txt', `${lines.join('\n')}\n`)
    }
    expect(lines.some((l) => l.startsWith('  sure'))).toBe(true)
  })
})
