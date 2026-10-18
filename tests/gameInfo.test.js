import { describe, expect, it } from 'vitest'
import { parseGamelist } from '../src/lib/core/esde.js'
import {
  cleanGenre,
  consoleIndex,
  descriptionFrom,
  findCandidates,
  findSureMatches,
  indexCandidates,
  mergeGameInfo,
  missingInfo,
  pickMatch,
  platformItems,
  politeGetJson,
  releaseDate,
  searchGame,
  searchText,
  withDescriptions,
} from '../src/lib/core/gameInfo.js'

/** A statement pointing to an item */
const item = (/** @type {string} */ id, rank = 'normal') => ({ rank, mainsnak: { datavalue: { value: { id } } } })
/** A date statement */
const date = (/** @type {string} */ time, precision = 11, rank = 'normal') => ({
  rank,
  mainsnak: { datavalue: { value: { time, precision } } },
})
/** A number statement */
const quantity = (/** @type {number} */ n) => ({ rank: 'normal', mainsnak: { datavalue: { value: { amount: `+${n}` } } } })
const labels = (/** @type {string} */ es, /** @type {string} */ en) => ({
  ...(es ? { es: { language: 'es', value: es } } : {}),
  ...(en ? { en: { language: 'en', value: en } } : {}),
})

const OKAMI = {
  id: 'Q1',
  labels: labels('Ōkami', 'Ōkami'),
  descriptions: labels('videojuego de 2006', '2006 video game'),
  aliases: { en: [{ language: 'en', value: 'Okami' }] },
  claims: {
    P31: [item('Q7889')],
    P400: [item('PS2')],
    P577: [date('+2006-09-19T00:00:00Z'), date('+2006-04-20T00:00:00Z'), date('+2001-01-01T00:00:00Z', 11, 'deprecated')],
    P136: [item('G_ACTION'), item('G_PLATFORM')],
    P178: [item('CLOVER')],
    P123: [item('CAPCOM')],
    P404: [item('SINGLE')],
  },
  sitelinks: { eswiki: { site: 'eswiki', title: 'Ōkami' }, enwiki: { site: 'enwiki', title: 'Ōkami' } },
}
const OKAMI_SERIES = {
  id: 'Q2',
  labels: labels('Ōkami', 'Ōkami'),
  descriptions: labels('serie de videojuegos', 'video game series'),
  claims: { P31: [item('SERIES')], P400: [item('PS2')] },
  sitelinks: {},
}
const KATAMARI = {
  id: 'Q3',
  labels: labels('', 'Katamari Damacy'),
  descriptions: labels('', '2004 video game'),
  claims: { P31: [item('Q7889')], P400: [item('PS2')], P577: [date('+2004-00-00T00:00:00Z', 9)], P1873: [quantity(2)] },
  sitelinks: { enwiki: { site: 'enwiki', title: 'Katamari Damacy' } },
}
const REFERENCED = {
  G_ACTION: { id: 'G_ACTION', labels: labels('videojuego de acción-aventura', 'action-adventure game') },
  G_PLATFORM: { id: 'G_PLATFORM', labels: labels('', 'platform game') },
  CLOVER: { id: 'CLOVER', labels: labels('Clover Studio', 'Clover Studio') },
  CAPCOM: { id: 'CAPCOM', labels: labels('Capcom', 'Capcom') },
  SINGLE: { id: 'SINGLE', labels: labels('videojuego para un jugador', 'single-player video game') },
}

/** The PS2's list, as the query service answers: each name and alias, with its item */
const PS2_NAMES = [
  ['Q1', 'Ōkami'],
  ['Q1', 'Okami'],
  ['Q2', 'Ōkami'],
  ['Q3', 'Katamari Damacy'],
  ['Q4', 'Kingdom Hearts II'],
  ['Q4', 'Kingdom Hearts II'], // in Spanish too
]

/**
 * Wikidata and Wikipedia's answers, by what's asked.
 * @param {{ search?: Record<string, string[]>, extracts?: Record<string, string> }} [data]
 */
function fakeApi({ search = {}, extracts = {} } = {}) {
  /** @type {URL[]} */
  const asked = []
  /** @param {string} raw */
  const getJson = async (raw) => {
    const url = new URL(raw)
    asked.push(url)
    const q = url.searchParams
    if (url.hostname === 'query.wikidata.org') {
      expect(q.get('query')).toContain('wdt:P400 wd:Q10680')
      return {
        results: {
          bindings: PS2_NAMES.map(([id, name]) => ({
            item: { type: 'uri', value: `http://www.wikidata.org/entity/${id}` },
            name: { type: 'literal', value: name, 'xml:lang': 'en' },
          })),
        },
      }
    }
    expect(q.get('origin')).toBe('*')
    if (q.get('action') === 'wbgetentities') {
      const all = { ...REFERENCED, Q1: OKAMI, Q2: OKAMI_SERIES, Q3: KATAMARI }
      const ids = /** @type {string} */ (q.get('ids')).split('|')
      return { entities: Object.fromEntries(ids.map((id) => [id, all[/** @type {keyof typeof all} */ (id)] ?? { id, missing: true }])) }
    }
    if (q.get('list') === 'search') {
      return { query: { search: (search[/** @type {string} */ (q.get('srsearch'))] ?? []).map((title) => ({ ns: 0, title })) } }
    }
    if (q.get('prop') === 'pageprops') {
      return {
        query: {
          normalized: [{ from: 'playStation 2', to: 'PlayStation 2' }],
          redirects: [{ from: 'Nintendo GameCube', to: 'GameCube' }],
          pages: [
            { title: 'PlayStation 2', pageprops: { wikibase_item: 'PS2' } },
            { title: 'GameCube', pageprops: { wikibase_item: 'GC' } },
            { title: 'Nowhere', missing: true },
          ],
        },
      }
    }
    if (q.get('prop') === 'extracts') {
      const lang = url.hostname.split('.')[0]
      const titles = /** @type {string} */ (q.get('titles')).split('|')
      // In Spanish "Okami" is a redirect to "Ōkami"
      const redirect = (/** @type {string} */ t) => (lang === 'es' && t === 'Okami' ? 'Ōkami' : t)
      return {
        query: {
          redirects: lang === 'es' ? [{ from: 'Okami', to: 'Ōkami' }] : [],
          pages: titles.map(redirect).map((title) => ({ title, extract: extracts[`${lang}:${title}`] })),
        },
      }
    }
    throw new Error(`unexpected request ${raw}`)
  }
  return { getJson, asked }
}

describe("each console's Wikidata item", () => {
  it('comes from its English Wikipedia article, following renames', async () => {
    const { getJson } = fakeApi()
    const platforms = [
      { id: 'ps2', wikipedia: 'playStation 2' },
      { id: 'gc', wikipedia: 'Nintendo GameCube' },
      { id: 'x', wikipedia: 'Nowhere' },
    ]
    expect(await platformItems(platforms, getJson)).toEqual({ ps2: 'PS2', gc: 'GC' })
  })
})

describe('finding the game', () => {
  it("searches the name without the search engine's own syntax", () => {
    expect(searchText('Castlevania: Symphony of the Night (USA) [!]')).toBe('Castlevania Symphony of the Night')
    expect(searchText('Spider-Man -2 "Enter"')).toBe('Spider-Man 2 Enter')
  })

  it("among the console's games first; otherwise among all, never as a sure match", async () => {
    const { getJson, asked } = fakeApi({
      search: {
        'Okami haswbstatement:P400=PS2': ['Q1'],
        'Ico haswbstatement:P31=Q7889': ['Q9'],
      },
    })
    expect(await searchGame('Okami', 'PS2', getJson)).toEqual({ ids: ['Q1'], onPlatform: true })
    expect(await searchGame('Ico', 'PS2', getJson)).toEqual({ ids: ['Q9'], onPlatform: false })
    expect(asked.map((u) => u.searchParams.get('srsearch'))).toEqual([
      'Okami haswbstatement:P400=PS2',
      'Ico haswbstatement:P400=PS2',
      'Ico haswbstatement:P31=Q7889',
    ])
  })

  it('reads the date, genres, companies and players of the sure match', async () => {
    const { getJson } = fakeApi({ search: { 'Okami haswbstatement:P400=PS2': ['Q2', 'Q1'] } })
    const { match, candidates } = await findCandidates({ name: 'Okami' }, { index: null, platformItem: 'PS2', lang: 'es', getJson })
    // the game, not its series with the same name, and first in the list
    expect(match?.id).toBe('Q1')
    expect(candidates.map((c) => c.id)).toEqual(['Q1', 'Q2'])
    expect(match).toMatchObject({
      title: 'Ōkami',
      summary: 'videojuego de 2006',
      year: 2006,
      article: { lang: 'es', title: 'Ōkami' },
      info: {
        releasedate: '20060420T000000', // the earliest, without the deprecated one
        developer: 'Clover Studio',
        publisher: 'Capcom',
        genre: 'Acción-aventura / Platform', // each with its own language's rules
        players: '1',
      },
    })
  })

  it('in English, and a year-only date and a number of players', async () => {
    const { getJson } = fakeApi({ search: { 'Katamari Damacy haswbstatement:P400=PS2': ['Q3'] } })
    const { match } = await findCandidates({ name: 'Katamari Damacy' }, { index: null, platformItem: 'PS2', lang: 'es', getJson })
    expect(match).toMatchObject({
      title: 'Katamari Damacy', // no Spanish name: the English one
      year: 2004,
      article: { lang: 'en', title: 'Katamari Damacy' },
      info: { releasedate: '20040101T000000', players: '1-2' },
    })
  })
})

describe("the console's list (many games at once)", () => {
  it('comes in one query, with every name and alias', async () => {
    const { getJson, asked } = fakeApi()
    const index = await consoleIndex('Q10680', getJson)
    expect(asked).toHaveLength(1)
    expect(index.items.get('Ōkami')).toEqual(['Q1', 'Q2'])
    expect(indexCandidates('Okami', index)).toEqual({ exact: ['Q1', 'Q2'], similar: [] })
    // a letter off is only similar: you pick
    expect(indexCandidates('Ookami', index).exact).toEqual([])
    expect(indexCandidates('Ookami', index).similar).toContain('Q1')
    await expect(consoleIndex('Q1 } DROP', getJson)).rejects.toThrow()
  })

  it('sure matches, the ones to pick and the ones that are not there; no searches', async () => {
    const { getJson, asked } = fakeApi()
    const index = await consoleIndex('Q10680', getJson)
    const games = [
      { id: 'okami', name: 'Okami' },
      { id: 'kh2', name: 'Kingdom Hearts 2' },
      { id: 'ookami', name: 'Ookami' },
      { id: 'homebrew', name: 'My Homebrew' },
    ]
    const { sure, unsure, notFound } = await findSureMatches(games, { index, lang: 'en', getJson })
    expect(sure.get('okami')?.id).toBe('Q1')
    expect(unsure).toEqual(['kh2', 'ookami']) // Q4 isn't in the recorded items: nothing sure
    expect(notFound).toEqual(['homebrew'])
    expect(asked.some((u) => u.searchParams.get('list') === 'search')).toBe(false)
  })

  it('one game uses its list first and searches only if nothing there looks like it', async () => {
    const { getJson, asked } = fakeApi({ search: { 'Ico haswbstatement:P400=PS2': ['Q3'] } })
    const index = await consoleIndex('Q10680', getJson)
    const okami = await findCandidates({ name: 'Ookami' }, { index, platformItem: 'PS2', lang: 'en', getJson })
    expect(okami.match).toBeNull()
    expect(okami.candidates.map((c) => c.id)).toContain('Q1')
    expect(asked.some((u) => u.searchParams.get('list') === 'search')).toBe(false)
    const ico = await findCandidates({ name: 'Ico' }, { index, platformItem: 'PS2', lang: 'en', getJson })
    expect(ico.candidates.map((c) => c.id)).toEqual(['Q3'])
  })
})

describe('a sure match', () => {
  /** @param {Partial<import('../src/lib/core/gameInfo.js').InfoCandidate>} c */
  const candidate = (c) => /** @type {any} */ ({ onPlatform: true, isGame: true, names: [], ...c })

  it('has exactly the name (or one of its other names) and is on the console', () => {
    const okami = candidate({ id: 'a', names: ['Ōkami', 'Okami'] })
    expect(pickMatch('Okami', [okami])).toBe(okami)
    expect(pickMatch('Kingdom Hearts 2', [candidate({ names: ['Kingdom Hearts II'] })])).not.toBeNull()
    expect(pickMatch('Okami HD', [okami])).toBeNull()
    expect(pickMatch('Okami', [{ ...okami, onPlatform: false }])).toBeNull()
  })

  it("two games with the same name: you pick", () => {
    const a = candidate({ id: 'a', names: ['Crash Bandicoot'] })
    const b = candidate({ id: 'b', names: ['Crash Bandicoot'] })
    expect(pickMatch('Crash Bandicoot', [a, b])).toBeNull()
    expect(pickMatch('Crash Bandicoot', [a, { ...b, isGame: false }])).toBe(a)
  })
})

describe('what gets saved', () => {
  it("genres as ES-DE shows them", () => {
    expect(cleanGenre('videojuego de plataformas', 'es')).toBe('Plataformas')
    expect(cleanGenre('videojuego de rol', 'es')).toBe('RPG')
    expect(cleanGenre('role-playing video game', 'en')).toBe('RPG')
    expect(cleanGenre('action role-playing game', 'en')).toBe('Action RPG')
    expect(cleanGenre('first-person shooter', 'en')).toBe('First-person shooter')
    expect(cleanGenre('survival horror', 'es')).toBe('Survival horror')
  })

  it('the earliest date with the precision it has', () => {
    expect(releaseDate({ claims: { P577: [date('+1997-03-00T00:00:00Z', 10)] } })).toBe('19970301T000000')
    expect(releaseDate({ claims: { P577: [date('+1997-00-00T00:00:00Z', 8)] } })).toBe('') // a decade: no
    expect(releaseDate({ claims: {} })).toBe('')
  })

  it("Wikipedia's introduction, cleaned, not too long and with its credit", () => {
    const article = { lang: /** @type {const} */ ('es'), title: 'Final Fantasy VII' }
    expect(
      descriptionFrom('Final Fantasy VII (ファイナルファンタジーVII, Fainaru Fantajī Sebun?) es un videojuego ( ) de rol.', article),
    ).toBe('Final Fantasy VII es un videojuego de rol.\n\nFuente: Wikipedia, «Final Fantasy VII» (CC BY-SA 4.0).')

    const long = Array.from({ length: 6 }, (_, i) => `Párrafo ${i}. ${'palabra '.repeat(60).trim()}.`).join('\n\n')
    const cut = descriptionFrom(long, { lang: 'en', title: 'X' })
    expect(cut.length).toBeLessThan(1300)
    expect(cut).toMatch(/^Párrafo 0\./)
    expect(cut.endsWith('Source: Wikipedia, "X" (CC BY-SA 4.0).')).toBe(true)
    expect(descriptionFrom('  ', article)).toBe('')
  })

  it("the description comes from the article in Relix's language, or the other one", async () => {
    const { getJson, asked } = fakeApi({
      extracts: { 'es:Ōkami': 'Ōkami es un videojuego.', 'en:Ico': 'Ico is a game.', 'en:Okami': 'Okami is a game.' },
    })
    const [okami, ico, none] = await withDescriptions(
      /** @type {any[]} */ ([
        // "Okami" in Spanish redirects to another article: the English one is used
        { id: 'a', info: { year: 1 }, articles: [{ lang: 'es', title: 'Okami' }, { lang: 'en', title: 'Okami' }] },
        { id: 'b', info: {}, articles: [{ lang: 'en', title: 'Ico' }] },
        { id: 'c', info: {}, articles: [] },
      ]),
      getJson,
    )
    expect(okami.info.desc).toBe('Okami is a game.\n\nSource: Wikipedia, "Okami" (CC BY-SA 4.0).')
    expect(okami.article).toEqual({ lang: 'en', title: 'Okami' })
    expect(ico.info.desc).toMatch(/^Ico is a game\./)
    expect(none.info.desc).toBeUndefined()
    expect(asked.map((u) => u.hostname)).toEqual(['es.wikipedia.org', 'en.wikipedia.org'])
  })

  it("an article Wikidata marks as a link to a redirect isn't used", async () => {
    const { getJson } = fakeApi({ search: { 'Okami haswbstatement:P400=PS2': ['Q1'] } })
    const saved = OKAMI.sitelinks.eswiki
    OKAMI.sitelinks.eswiki = { ...saved, badges: ['Q70893996'] }
    try {
      const { match } = await findCandidates({ name: 'Okami' }, { index: null, platformItem: 'PS2', lang: 'es', getJson })
      expect(match?.articles).toEqual([{ lang: 'en', title: 'Ōkami' }])
    } finally {
      OKAMI.sitelinks.eswiki = saved
    }
  })

  it('what a game is missing', () => {
    const game = { description: '', year: 2006, developer: '', publisher: 'Capcom', genre: '', players: '1' }
    expect(missingInfo(game)).toEqual(['desc', 'developer', 'genre'])
  })
})

describe("writing in ES-DE's gamelist", () => {
  const GAMELIST = `<?xml version="1.0"?>
<gameList>
	<game>
		<path>./Okami (USA).chd</path>
		<name>Okami</name>
		<desc />
		<genre>Aventura</genre>
		<favorite>true</favorite>
	</game>
	<folder>
		<path>./RPG</path>
	</folder>
</gameList>
`

  it('fills only what is missing or empty, and leaves the rest exactly as it was', () => {
    const { xml, changed } = mergeGameInfo(GAMELIST, [
      { path: 'Okami (USA).chd', name: 'Okami', info: { desc: 'A & B <3 $& $1', genre: 'Action', releasedate: '20060420T000000' } },
    ])
    expect(changed).toBe(1)
    expect(xml).toBe(`<?xml version="1.0"?>
<gameList>
	<game>
		<path>./Okami (USA).chd</path>
		<name>Okami</name>
		<desc>A &amp; B &lt;3 $&amp; $1</desc>
		<genre>Aventura</genre>
		<favorite>true</favorite>
		<releasedate>20060420T000000</releasedate>
	</game>
	<folder>
		<path>./RPG</path>
	</folder>
</gameList>
`)
    const [game] = parseGamelist(xml, 'ps2')
    expect(game).toMatchObject({ description: 'A & B <3 $& $1', genre: 'Aventura', year: 2006, favorite: true })
  })

  it('a game without an entry gets one, with its name; nothing to add changes nothing', () => {
    const { xml, changed } = mergeGameInfo(GAMELIST, [
      { path: 'Sub/Ico & Co (USA).chd', name: 'Ico & Co', info: { desc: 'Two\n\nparagraphs', players: '1' } },
      { path: 'Empty.chd', name: 'Empty', info: {} },
    ])
    expect(changed).toBe(1)
    expect(xml).toContain(`	</folder>
	<game>
		<path>./Sub/Ico &amp; Co (USA).chd</path>
		<name>Ico &amp; Co</name>
		<desc>Two

paragraphs</desc>
		<players>1</players>
	</game>
</gameList>
`)
    const games = parseGamelist(xml, 'ps2')
    expect(games.map((g) => g.path)).toEqual(['Sub/Ico & Co (USA).chd', 'Okami (USA).chd'])

    const same = mergeGameInfo(GAMELIST, [{ path: './okami (usa).chd', name: 'Okami', info: { genre: 'Other' } }])
    expect(same).toEqual({ xml: GAMELIST, changed: 0 })
  })

  it('without a gamelist yet, it starts one; a broken one is left alone', () => {
    const { xml } = mergeGameInfo(null, [{ path: 'Okami.chd', name: 'Okami', info: { genre: 'Action' } }])
    expect(parseGamelist(xml, 'ps2')[0]).toMatchObject({ path: 'Okami.chd', name: 'Okami', genre: 'Action' })
    expect(() => mergeGameInfo('<gameList><game>', [])).toThrow()
  })
})

describe('asking Wikimedia politely', () => {
  /** @param {Array<{ status: number, retryAfter?: string, json?: any }>} answers */
  function fakeNet(answers) {
    let clock = 0
    /** @type {number[]} */
    const at = []
    /** @type {number[]} */
    const slept = []
    const getJson = politeGetJson({
      minInterval: 700,
      now: () => clock,
      sleep: async (ms) => {
        slept.push(ms)
        clock += ms
      },
      fetch: async () => {
        at.push(clock)
        const a = /** @type {any} */ (answers.shift())
        return {
          ok: a.status === 200,
          status: a.status,
          headers: { get: (/** @type {string} */ name) => (name === 'Retry-After' ? (a.retryAfter ?? null) : null) },
          json: async () => a.json ?? {},
        }
      },
    })
    return { getJson, at, slept }
  }

  it('one request at a time, with a pause between them', async () => {
    const { getJson, at } = fakeNet([{ status: 200 }, { status: 200 }, { status: 200 }])
    await Promise.all([getJson('a'), getJson('b'), getJson('c')])
    expect(at).toEqual([0, 700, 1400])
  })

  it('after a 429 it waits what the server says and tries again', async () => {
    const { getJson, slept } = fakeNet([{ status: 429, retryAfter: '5' }, { status: 503 }, { status: 200, json: { ok: 1 } }])
    await expect(getJson('a')).resolves.toEqual({ ok: 1 })
    expect(slept).toContain(5000)
    expect(slept).toContain(4000) // without Retry-After: 2 s, 4 s, 8 s...
  })

  it("the API's errors and other statuses fail", async () => {
    const { getJson } = fakeNet([{ status: 200, json: { error: { code: 'x', info: 'Bad title' } } }, { status: 404 }])
    await expect(getJson('a')).rejects.toThrow('Bad title')
    await expect(getJson('b')).rejects.toThrow('HTTP 404')
  })
})
