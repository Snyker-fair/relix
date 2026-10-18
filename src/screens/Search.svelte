<script module>
  /** The last search: if you go to another screen and come back, it's still there */
  let lastQuery = ''
</script>

<script>
  /**
   * Search across every console, with the on-screen keyboard.
   * The keyboard on the left; on the right the results, which change with
   * each letter. From the keyboard's right edge you move to the results.
   */
  import { getPlatform } from '../lib/core/platforms.js'
  import { searchGames } from '../lib/core/search.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import Clock from '../lib/ui/Clock.svelte'
  import CoverArt, { TILE_ASPECT } from '../lib/ui/CoverArt.svelte'
  import { plural } from '../lib/ui/format.js'
  import { t } from '../lib/i18n/i18n.svelte.js'
  import HintBar from '../lib/ui/HintBar.svelte'
  import { dispatch, pushHandler } from '../lib/ui/input.js'
  import Keyboard from '../lib/ui/Keyboard.svelte'
  import { library } from '../lib/ui/library.svelte.js'
  import Logo from '../lib/ui/Logo.svelte'
  import PadButton from '../lib/ui/PadButton.svelte'
  import { sound } from '../lib/ui/sound.js'

  /**
   * @type {{
   *   onBack: () => void,
   *   onLaunch: (game: any) => void,
   *   onMenu: (game: any) => void,
   * }}
   */
  let { onBack, onLaunch, onMenu } = $props()

  const COLUMNS = 5
  const COVER_W = 178
  const ROW_H = Math.round(COVER_W / TILE_ASPECT) + 36 + 44 // cover + name + gap

  let query = $state(lastQuery)
  /** 'keys' (keyboard) or 'results' */
  let zone = $state('keys')
  let index = $state(0)
  let scrollRow = $state(0)
  /** @type {Keyboard | undefined} */
  let keyboard = $state()

  $effect(() => {
    lastQuery = query
  })

  const searching = $derived(query.trim().length > 0)
  const results = $derived(searching ? searchGames(library.all, query, { limit: 60 }) : library.recent)

  // If the results change, the focus can't stay outside the list
  $effect(() => {
    if (index >= results.length) index = Math.max(0, results.length - 1)
    if (results.length === 0 && zone === 'results') zone = 'keys'
  })

  const row = $derived(Math.floor(index / COLUMNS))
  $effect(() => {
    if (row < scrollRow) scrollRow = row
    else if (row > scrollRow + 1) scrollRow = row - 1
  })

  /** @param {number} next */
  function move(next) {
    if (next < 0 || next >= results.length || next === index) return
    index = next
    sound.move()
  }

  /** @param {import('../lib/ui/input.js').Action} action */
  function onResults(action) {
    const col = index % COLUMNS
    if (action === 'left') {
      if (col > 0) return move(index - 1)
      zone = 'keys'
      keyboard?.enterFromRight()
      sound.move()
    } else if (action === 'right' && col < COLUMNS - 1) move(index + 1)
    else if (action === 'up') move(index - COLUMNS)
    else if (action === 'down') move(Math.min(index + COLUMNS, results.length - 1))
    else if (action === 'a') onLaunch(results[index])
    else if (action === 'y') (sound.select(), onMenu(results[index]))
    else if (action === 'x') keyboard?.handle('x')
  }

  $effect(() =>
    pushHandler((action) => {
      if (action === 'b' || action === 'view') return (sound.back(), onBack())
      if (zone === 'results') return onResults(action)
      const used = keyboard?.handle(action)
      if (!used && action === 'right' && results.length > 0) {
        zone = 'results'
        index = Math.min(scrollRow * COLUMNS, results.length - 1)
        sound.move()
      }
    }),
  )
</script>

<header class="top">
  <button class="back" onclick={() => dispatch('b')}>
    <PadButton name="b" size={30} />
    <Logo size={34} />
  </button>
  <div class="title-pill">
    <ChannelIcon id="search" color="currentColor" size={30} />
    {t('Buscar')}
  </div>
  <Clock />
</header>

<section class="panel">
  <p class="field" class:empty={!query}>
    <span class="lens"><ChannelIcon id="search" color="currentColor" size={30} /></span>
    {#if !query}<span class="caret" aria-hidden="true"></span>{/if}
    <span class="text">{query || t('Escribe un nombre')}</span>
    {#if query}<span class="caret" aria-hidden="true"></span>{/if}
  </p>
  <Keyboard bind:this={keyboard} bind:value={query} active={zone === 'keys'} />
  <p class="scope">{t('Busca en tus {games}, en todas las consolas.', { games: plural(library.all.length, 'juego', 'juegos') })}</p>
</section>

<section class="results">
  <h2>
    {#if searching}
      {results.length === 0 ? t('Nada con «{query}»', { query: query.trim() }) : plural(results.length, 'resultado', 'resultados')}
    {:else}
      {results.length > 0 ? t('Jugados hace poco') : t('Escribe para buscar')}
    {/if}
  </h2>

  {#if results.length === 0}
    <p class="no-results">
      {searching
        ? t('Prueba con el comienzo de una palabra: "kin" encuentra Kingdom Hearts.')
        : t('Con el teclado de la izquierda. Los resultados aparecen mientras escribes.')}
    </p>
  {:else}
    <div class="grid-window">
      <div class="grid" style:transform="translateY({-scrollRow * ROW_H}px)">
        {#each results as game, i (game.id)}
          {@const platform = getPlatform(game.system)}
          <button
            class="cell"
            class:focused={zone === 'results' && i === index}
            style:--tint={platform?.color}
            onmouseenter={() => ((zone = 'results'), (index = i))}
            onclick={() => (zone === 'results' && i === index ? onLaunch(game) : ((zone = 'results'), (index = i)))}
          >
            <span class="cover focus-ring" class:focused={zone === 'results' && i === index}>
              <CoverArt {game} {platform} width={COVER_W} thumb />
              <span class="badge" style:background={platform?.color} style:color={platform?.ink}>
                {platform?.shortName}
              </span>
            </span>
            <span class="name">{game.name}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</section>

<HintBar
  hints={zone === 'keys'
    ? [
        { button: 'a', label: t('Escribir') },
        { button: 'x', label: t('Borrar') },
        { button: 'y', label: t('Espacio') },
        { button: 'b', label: t('Volver') },
      ]
    : [
        { button: 'a', label: t('Jugar') },
        { button: 'y', label: t('Menú') },
        { button: 'x', label: t('Borrar') },
        { button: 'b', label: t('Volver') },
      ]}
/>

<style>
  .top {
    position: absolute;
    top: 56px;
    left: 112px;
    right: 112px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .back {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 22px 8px 10px;
    border-radius: 999px;
    background: var(--cloud);
  }
  .title-pill {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 28px 8px 20px;
    border-radius: 999px;
    background: var(--ink);
    color: var(--cloud);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 28px;
  }

  /* ── Keyboard ────────────────────────── */
  .panel {
    position: absolute;
    left: 112px;
    top: 170px;
    width: 600px;
    height: 790px;
    padding: 36px;
    border-radius: 48px;
    background: var(--cloud);
    box-shadow: 0 30px 60px -40px rgb(var(--shadow) / 0.5);
  }
  /* the field is white with a border: it doesn't get mixed up with the light blue keys */
  .field {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 76px;
    margin: 0 0 38px;
    padding: 0 22px 0 18px;
    border-radius: 24px;
    border: 4px solid var(--sky-deep);
    background: var(--cloud);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 34px;
    white-space: nowrap;
    overflow: hidden;
  }
  .field .text {
    overflow: hidden;
    text-overflow: ellipsis;
    padding-top: 4px;
  }
  .field.empty {
    color: var(--ink-soft);
    font-size: 28px;
  }
  .lens {
    display: grid;
    place-items: center;
    flex: none;
    margin-right: 8px;
    color: var(--ink-soft);
  }
  .caret {
    flex: none;
    width: 4px;
    height: 40px;
    margin: 0 4px;
    border-radius: 2px;
    background: var(--pop);
    animation: blink 1s steps(2, start) infinite;
  }
  .scope {
    margin: 30px 0 0;
    font-size: 22px;
    color: var(--ink-soft);
  }

  /* ── Results ─────────────────────────── */
  .results {
    position: absolute;
    left: 776px;
    right: 112px;
    top: 160px;
    bottom: 120px;
  }
  h2 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 38px;
    line-height: 1.1;
  }
  /* "Nothing with…" under the results title. Careful: don't call it .empty, that's
     the empty field's class and it took away the space above the keyboard */
  .no-results {
    margin: 14px 0 0;
    max-width: 820px;
    font-size: 26px;
    line-height: 1.45;
    color: var(--ink-soft);
  }
  /* the focused result's ring doesn't touch the title: 44 px free above */
  .grid-window {
    position: absolute;
    top: 48px;
    left: -20px;
    right: -20px;
    bottom: 0;
    padding: 44px 20px 0;
    overflow: hidden;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(5, 178px);
    gap: 44px 35px;
    transition: transform 320ms var(--spring);
  }
  .cell {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 178px;
    text-align: left;
  }
  .cover {
    position: relative;
    border-radius: 22px;
  }
  .badge {
    position: absolute;
    right: 8px;
    top: 8px;
    padding: 2px 12px 4px;
    border-radius: 999px;
    font-weight: 800;
    font-size: 17px;
  }
  .name {
    font-weight: 700;
    font-size: 20px;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--ink-soft);
  }
  .cell.focused .name {
    color: var(--ink);
  }
  @keyframes blink {
    to {
      visibility: hidden;
    }
  }
</style>
