<script>
  import { untrack } from 'svelte'
  import { fade } from 'svelte/transition'
  import { applyFilter, filterLabel } from '../lib/core/filters.js'
  import { getPlatform } from '../lib/core/platforms.js'
  import { gridWindow, jumpsTooFar } from '../lib/core/gridWindow.js'
  import { discCount } from '../lib/core/discs.js'
  import { jumpIndex, sectionOf, SORT_NAMES, sortGames } from '../lib/core/sorting.js'
  import { brokenMedia, usableMedia } from '../lib/ui/activity.svelte.js'
  import { activeFilters } from '../lib/ui/filters.svelte.js'
  import { isCollectionId } from '../lib/ui/channels.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import { emulators } from '../lib/ui/emulators.svelte.js'
  import { formatPlaytime, plural, timeAgo } from '../lib/ui/format.js'
  import { i18n, listJoin, t } from '../lib/i18n/i18n.svelte.js'
  import { shelf } from '../lib/ui/shelf.svelte.js'
  import Clock from '../lib/ui/Clock.svelte'
  import CoverArt, { TILE_ASPECT } from '../lib/ui/CoverArt.svelte'
  import HintBar from '../lib/ui/HintBar.svelte'
  import PadButton from '../lib/ui/PadButton.svelte'
  import Logo from '../lib/ui/Logo.svelte'
  import { dispatch, pushHandler } from '../lib/ui/input.js'
  import { library } from '../lib/ui/library.svelte.js'
  import { settings } from '../lib/ui/settings.svelte.js'
  import { sound } from '../lib/ui/sound.js'

  /**
   * @type {{
   *   systemId: string,
   *   onBack: () => void,
   *   onSwitch: (systemId: string) => void,
   *   onLaunch: (game: any) => void,
   *   onOptions: () => void,
   *   onMenu: (game: any, sortOptions: import('../lib/core/sorting.js').SortOrder[], filterChannel: string) => void,
   *   onSearch: () => void,
   *   onGuide: (systemId: string) => void,
   *   onSheet: (game: any) => void,
   *   onSurprise: (games: any[], focusedGameId?: string) => void,
   *   focusGameId?: string,
   * }}
   *   focusGameId: the game focused on opening (you're back from it and the Xbox had closed Relix)
   */
  let { systemId, onBack, onSwitch, onLaunch, onOptions, onMenu, onSearch, onGuide, onSheet, onSurprise, focusGameId } = $props()

  /** A console without games: Y opens its guide (doesn't apply to Favorites or Collections) */
  const guideable = $derived(Boolean(getPlatform(systemId)))

  const COLUMNS = 5
  const COVER_W = 178
  const ROW_GAP = 44
  const ROW_H = Math.round(COVER_W / TILE_ASPECT) + ROW_GAP // cover height + gap
  /** Rows that fit in the grid's window (the third one, partly) */
  const VISIBLE_ROWS = 3

  let index = $state(0)

  // Tabs: the visible channels or, inside a collection, the collections
  const tabs = $derived(shelf.tabsFor(systemId))

  // Tabs that slide: the active one stays in the center, without going past the ends
  /** @type {HTMLElement | undefined} */
  let tabWindow = $state()
  /** @type {HTMLElement | undefined} */
  let tabStrip = $state()
  let tabOffset = $state(0)
  let tabsOverflow = $state(false)
  $effect(() => {
    systemId
    tabs
    const active = /** @type {HTMLElement | null | undefined} */ (tabStrip?.querySelector('.tab.active'))
    if (!tabWindow || !tabStrip || !active) return
    const view = tabWindow.clientWidth
    const full = tabStrip.scrollWidth
    tabsOverflow = full > view + 1
    const center = active.offsetLeft + active.offsetWidth / 2
    tabOffset = tabsOverflow ? Math.round(Math.max(0, Math.min(center - view / 2, full - view))) : 0
  })
  const channelIndex = $derived(tabs.findIndex((c) => c.id === systemId))
  const channel = $derived(shelf.channelFor(systemId))
  const inCollection = $derived(isCollectionId(systemId))

  // Order: "Most played" only if you've played some; "Year", if any game has a year (from ES-DE)
  const unsorted = $derived(shelf.gamesFor(systemId))
  const sortOptions = $derived(
    /** @type {import('../lib/core/sorting.js').SortOrder[]} */ ([
      'az',
      'recent',
      ...(unsorted.some((g) => library.playtime[g.id]) ? ['played'] : []),
      ...(unsorted.some((g) => g.year) ? ['year'] : []),
    ]),
  )
  const order = $derived(sortOptions.includes(settings.sortOrder) ? settings.sortOrder : 'az')
  // This channel's filter (Y › Filter). If it no longer leaves any game, it's ignored
  const filter = $derived(activeFilters.get(systemId) ?? null)
  const filtered = $derived.by(() => {
    const list = applyFilter(unsorted, filter)
    return list.length > 0 ? list : unsorted
  })
  const filterOn = $derived(Boolean(filter) && filtered !== unsorted)
  const games = $derived(sortGames(filtered, order, library.lastPlayed, library.playtime))

  const game = $derived(games[Math.min(index, games.length - 1)])
  const platform = $derived(game ? getPlatform(game.system) : null)
  const favorite = $derived(game ? library.isFavorite(game) : false)
  /** What the focused game opens with (null: the console has no emulator yet) */
  const emulator = $derived(game ? emulators.forGame(game) : null)
  /** The focused game's time played (if you've played it) */
  const played = $derived(game ? library.playtime[game.id] : undefined)

  // A panel with an image: fan art or a screenshot on top and the logo over it.
  // Without one, the big box stays, as always. No videos: they cost more memory
  // and smoothness than Relix can spare
  const background = $derived(usableMedia(game?.background))
  const logo = $derived(usableMedia(game?.logo))
  const framed = $derived(Boolean(background))

  // The screen's background: the game's image, heavily blurred. It waits a
  // moment before changing, so it doesn't flicker when going through the grid fast
  let ambient = $state('')
  $effect(() => {
    const next = background ?? usableMedia(game?.thumb) ?? ''
    if (next === untrack(() => ambient)) return
    const timer = setTimeout(() => (ambient = next), 280)
    return () => clearTimeout(timer)
  })
  // The focused game's section: the letter in A–Z, the year in "Year"
  const section = $derived(game ? (sectionOf(game, order) ?? '•') : '')

  // The description takes the lines left in the panel: 3 (2 under an image), or fewer if
  // the name, the data and the time played take more room (Wikipedia's are long)
  /** @type {HTMLElement | undefined} */
  let detailEl = $state()
  $effect(() => {
    game?.id
    chips.length
    played
    framed
    i18n.current
    const panel = detailEl
    const desc = /** @type {HTMLElement | null | undefined} */ (panel?.querySelector('.desc'))
    const last = /** @type {HTMLElement | null | undefined} */ (panel?.lastElementChild)
    if (!panel || !desc || !last) return
    const bottom = panel.clientHeight - parseFloat(getComputedStyle(panel).paddingBottom)
    for (let lines = framed ? 2 : 3; lines >= 1; lines--) {
      desc.style.setProperty('-webkit-line-clamp', String(lines))
      desc.style.setProperty('line-clamp', String(lines))
      if (last.offsetTop + last.offsetHeight <= bottom + 1) break
    }
  })

  // If the list changes (another order, a hidden game...), the focus stays on the same game
  let focusedGameId = ''
  $effect(() => {
    focusedGameId = game?.id ?? ''
  })
  $effect(() => {
    const list = games
    untrack(() => {
      const i = list.findIndex((g) => g.id === focusedGameId)
      if (i >= 0) index = i
      else if (index >= list.length) index = Math.max(0, list.length - 1)
    })
  })

  // The grid's scroll: keeps the focused row visible
  const row = $derived(Math.floor(index / COLUMNS))
  let scrollRow = $state(0)
  /** The last move went too far to slide (a jump by letter): it goes straight there */
  let farJump = $state(false)
  $effect(() => {
    const next = row < scrollRow ? row : row > scrollRow + 1 ? row - 1 : scrollRow
    if (next === scrollRow) return
    farJump = jumpsTooFar(scrollRow, next)
    scrollRow = next
  })
  // Only the visible rows and a couple more are drawn (core/gridWindow.js): the
  // memory stays the same with 20 games or with 1,000
  const drawn = $derived(gridWindow(games.length, scrollRow, { columns: COLUMNS, rows: VISIBLE_ROWS }))

  // When the console changes, back to the first game (on opening, the one you were coming back from)
  let pendingFocus = untrack(() => focusGameId ?? '')
  $effect(() => {
    systemId
    untrack(() => {
      const wanted = pendingFocus ? games.findIndex((g) => g.id === pendingFocus) : -1
      pendingFocus = ''
      index = Math.max(0, wanted)
      // another console: its grid shows up in place, without sliding from the old one's row
      farJump = true
      scrollRow = 0
      focusedGameId = wanted >= 0 ? games[wanted].id : ''
    })
  })

  // The big letter when jumping with LT / RT
  let bubble = $state('')
  /** Changes on every jump so the animation starts again */
  let bubbleId = $state(0)
  /** @type {ReturnType<typeof setTimeout>} */
  let bubbleTimer

  /** @param {1|-1} direction */
  function jump(direction) {
    const next = jumpIndex(games, index, direction, order)
    if (next === index) return sound.error()
    index = next
    sound.move()
    bubble = sectionOf(games[next], order) ?? `${next + 1}`
    bubbleId++
    clearTimeout(bubbleTimer)
    bubbleTimer = setTimeout(() => (bubble = ''), 650)
  }

  const chips = $derived.by(() => {
    if (!game) return []
    return [
      game.year && String(game.year),
      game.developer,
      game.genre,
      discCount(game) > 0 && plural(discCount(game), 'disco', 'discos'),
    ].filter(Boolean)
  })

  /** @param {number} next */
  function move(next) {
    if (next < 0 || next >= games.length || next === index) return
    index = next
    sound.move()
  }

  /** ['chd', 'iso', 'cso'] -> ".chd, .iso o .cso" (".chd, .iso, or .cso") */
  function formatList(/** @type {string[]} */ extensions) {
    return listJoin(
      extensions.map((e) => `.${e}`),
      'disjunction',
    )
  }

  /** @param {number} delta */
  function switchChannel(delta) {
    const next = channelIndex + delta
    if (next < 0 || next >= tabs.length) return
    sound.move()
    onSwitch(tabs[next].id)
  }

  $effect(() =>
    pushHandler((action) => {
      const col = index % COLUMNS
      if (action === 'left' && col > 0) move(index - 1)
      else if (action === 'right' && col < COLUMNS - 1) move(index + 1)
      else if (action === 'up') move(index - COLUMNS)
      else if (action === 'down') move(Math.min(index + COLUMNS, games.length - 1))
      else if (action === 'lb') switchChannel(-1)
      else if (action === 'rb') switchChannel(1)
      else if (action === 'lt' && game) jump(-1)
      else if (action === 'rt' && game) jump(1)
      else if (action === 'b') (sound.back(), onBack())
      else if (action === 'x' && game) (library.toggleFavorite(game), sound.favorite())
      else if (action === 'y' && game) (sound.select(), onMenu(game, sortOptions, systemId))
      else if (action === 'y' && guideable) (sound.select(), onGuide(systemId))
      else if (action === 'a' && game) onLaunch(game)
      else if (action === 'rs' && game) (sound.select(), onSheet(game))
      else if (action === 'ls' && game) (sound.select(), onSurprise(games, game.id))
      else if (action === 'view') (sound.select(), onSearch())
      else if (action === 'start') (sound.select(), onOptions())
    }),
  )
</script>

<div class="ambient" aria-hidden="true">
  {#key ambient}
    {#if ambient}<img src={ambient} alt="" transition:fade={{ duration: 500 }} />{/if}
  {/key}
</div>

<header class="top">
  <button class="back" onclick={() => dispatch('b')}>
    <PadButton name="b" size={30} />
    <Logo size={34} />
  </button>

  <nav class="tabs" aria-label={inCollection ? t('Colecciones') : t('Consolas')}>
    <button class="bumper" onclick={() => dispatch('lb')} aria-label={t('Anterior')}>
      <PadButton name="lb" size={30} />
    </button>
    <!-- With many consoles, the tabs slide to show the active one -->
    <div class="tab-window" class:sliding={tabsOverflow} bind:this={tabWindow}>
      <div class="tab-strip" bind:this={tabStrip} style:transform="translateX({-tabOffset}px)">
        {#each tabs as ch (ch.id)}
          <button
            class="tab"
            class:active={ch.id === systemId}
            style:--c={ch.color}
            style:--ink-c={ch.ink}
            onclick={() => ch.id !== systemId && (sound.move(), onSwitch(ch.id))}
          >
            {ch.shortName}
          </button>
        {/each}
      </div>
    </div>
    <button class="bumper" onclick={() => dispatch('rb')} aria-label={t('Siguiente')}>
      <PadButton name="rb" size={30} />
    </button>
  </nav>

  <Clock />
</header>

{#if games.length === 0}
  <section class="empty">
    <h1>
      {channel.id === 'favorites'
        ? t('Aún no tienes favoritos')
        : inCollection
          ? t('Esta colección quedó vacía')
          : t('No hay juegos de {console}', { console: channel.name })}
    </h1>
    {#if channel.id === 'favorites'}
      <p>
        {t('En cualquier consola, pon el foco en un juego y presiona')} <PadButton name="x" size={30} />
        {t('para guardarlo aquí.')}
      </p>
    {:else if inCollection}
      <p>{t('Agrega juegos desde el menú del juego:')} <PadButton name="y" size={30} /> › {t('Colecciones')}.</p>
    {:else}
      <p>
        {t('Copia tus juegos a')} <code>{library.romFolderPath(channel.id)}</code>
        {t('y escanéala en')}
        <strong>{t('≡ › Biblioteca')}</strong>.
        {t('Formatos: {formats}.', { formats: formatList(channel.extensions) })}
      </p>
      <p class="hint">
        {t('¿Primera vez con {console}?', { console: channel.shortName })} <PadButton name="y" size={28} />
        {t('abre la guía: qué emulador instalar, qué archivos pide y dónde van tus juegos.')}
      </p>
    {/if}
  </section>
{:else}
  <section class="detail" style:--tint={platform.color} bind:this={detailEl}>
    {#key game.id}
      {#if framed}
        <div class="media">
          <img class="shot" src={background} alt="" onerror={() => background && brokenMedia.add(background)} />
          {#if logo}
            <span class="logo-shade"></span>
            <img class="logo" src={logo} alt="" onerror={() => brokenMedia.add(logo)} />
          {/if}
          {#if favorite}<span class="heart" aria-label={t('Favorito')}>♥</span>{/if}
        </div>
        <div class="headline">
          <div class="mini-cover">
            <CoverArt {game} {platform} width={118} height={150} showTitle={false} real thumb />
          </div>
          <h1 class:long={game.name.length > 24}>{game.name}</h1>
        </div>
      {:else}
        <div class="detail-cover">
          <!-- Here, yes, the whole box with its real shape -->
          <CoverArt {game} {platform} width={250} height={350} showTitle={false} real />
          {#if favorite}<span class="heart" aria-label={t('Favorito')}>♥</span>{/if}
        </div>
        <h1 class:long={game.name.length > 24}>{game.name}</h1>
      {/if}
      <ul class="chips">
        {#each chips as chip (chip)}<li>{chip}</li>{/each}
      </ul>
      {#if played}
        <p class="played">
          <ChannelIcon id="time" size={26} />
          <strong>{formatPlaytime(played.seconds)}</strong>
          <span>· {plural(played.plays, 'partida', 'partidas')}</span>
          {#if library.lastPlayed[game.id]}<span>· {timeAgo(library.lastPlayed[game.id])}</span>{/if}
        </p>
      {/if}
      {#if emulator}
        {#if game.description}
          <p class="desc" class:short={framed}>{game.description}</p>
        {:else}
          <!-- Without ES-DE data: the file name says which version it is -->
          <p class="file">{game.path.split('/').pop()}</p>
        {/if}
        <p class="via">
          {t('Se abre con {emulator}', { emulator: emulator.name })}{#if emulators.hasOwn(game)}<span class="own"
              >{t('solo este juego')}</span
            >{/if}
          {#if emulators.isInstalled(emulator) === false}<span class="missing">{t('no instalado')}</span>{/if}
        </p>
      {:else}
        <p class="note">{platform.noEmulatorNote ? t(platform.noEmulatorNote) : ''}</p>
      {/if}
    {/key}
  </section>

  <section class="grid-window">
    <div
      class="grid"
      class:instant={farJump}
      style:transform="translateY({-scrollRow * ROW_H}px)"
      style:padding-top="{drawn.firstRow * ROW_H}px"
    >
      {#each games.slice(drawn.start, drawn.end) as g, k (g.id)}
        {@const i = drawn.start + k}
        {@const p = getPlatform(g.system)}
        <button
          class="cell focus-ring"
          class:focused={i === index}
          style:--tint={p.color}
          onmouseenter={() => move(i)}
          onclick={() => (i === index ? onLaunch(g) : move(i))}
        >
          <CoverArt game={g} platform={p} width={COVER_W} thumb />
          {#if library.isFavorite(g)}<span class="mini-heart" aria-label={t('Favorito')}>♥</span>{/if}
          {#if library.isNew(g)}<span class="new-tag">{t('Nuevo')}</span>{/if}
        </button>
      {/each}
    </div>
  </section>
{/if}

{#if games.length > 0}
  <div class="position" aria-live="polite">
    <span class="letter" class:wide={section.length > 1}>{section}</span>
    <span>{t('Juego {n} de {total}', { n: Math.min(index, games.length - 1) + 1, total: games.length })}</span>
    <span class="order">{t(SORT_NAMES[order])}</span>
    {#if filterOn && filter}<span class="order filter">{filterLabel(filter)}</span>{/if}
  </div>
{/if}

{#if bubble}
  {#key bubbleId}
    <div class="bubble" aria-hidden="true">{bubble}</div>
  {/key}
{/if}

<HintBar
  hints={games.length > 0
    ? [
        { button: 'a', label: emulator ? t('Jugar') : t('No disponible') },
        { button: 'y', label: t('Menú') },
        { button: 'rs', label: t('Ficha') },
        { button: 'x', label: t('Favorito') },
        { button: 'view', label: t('Buscar') },
        { button: 'b', label: t('Volver') },
      ]
    : [
        ...(guideable ? [{ button: 'y', label: t('Ver guía') }] : []),
        { button: 'view', label: t('Buscar') },
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
    gap: 32px;
  }
  .back {
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 30px;
    padding: 8px 22px 8px 10px;
    border-radius: 999px;
    background: var(--cloud);
  }
  .tabs {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border-radius: 999px;
    background: rgb(var(--glass) / 0.65);
  }
  .bumper {
    padding: 0 8px;
  }
  /* the window fits between the logo and the clock; if the tabs don't fit, they
     slide and fade at the edges (that way it shows there are more) */
  .tab-window {
    max-width: 1040px;
    overflow: hidden;
    border-radius: 999px;
  }
  .tab-window.sliding {
    mask-image: linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent);
  }
  .tab-strip {
    display: flex;
    gap: 10px;
    transition: transform 260ms var(--spring);
  }
  .tab {
    flex: none;
    white-space: nowrap;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 26px;
    padding: 8px 22px 6px;
    border-radius: 999px;
    color: var(--ink-soft);
    transition:
      background 160ms ease,
      color 160ms ease;
  }
  .tab.active {
    background: var(--c);
    color: var(--ink-c);
  }

  /* ── Blurred background ──────────────── */
  /* The image is drawn small and enlarged 4 times: the blur costs much
     less than doing it full screen and looks just as smooth */
  .ambient {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .ambient img {
    position: absolute;
    left: -24px;
    top: -24px;
    width: 492px;
    height: 282px;
    object-fit: cover;
    transform: scale(4);
    transform-origin: 0 0;
    filter: blur(9px) saturate(1.25);
    opacity: 0.4;
  }
  /* a light blue veil: stronger at the bottom, where the hints and the position go */
  .ambient::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      color-mix(in oklab, var(--sky) 30%, transparent) 0%,
      color-mix(in oklab, var(--sky) 45%, transparent) 55%,
      color-mix(in oklab, var(--sky) 85%, transparent) 100%
    );
  }

  /* ── The focused game's panel ────────── */
  .detail {
    position: absolute;
    left: 112px;
    top: 170px;
    width: 600px;
    height: 790px;
    padding: 40px 44px 36px;
    display: flex;
    flex-direction: column;
    border-radius: 48px;
    background: var(--cloud);
    box-shadow: 0 30px 60px -40px rgb(var(--shadow) / 0.5);
  }
  .detail-cover {
    position: relative;
    flex: none;
    align-self: flex-start;
    animation: bob 300ms var(--spring) both;
  }
  .detail-cover :global(.cover) {
    border-radius: 28px;
    box-shadow: 0 22px 34px -18px color-mix(in oklab, var(--tint) 80%, black);
  }
  .heart {
    position: absolute;
    right: -18px;
    top: -18px;
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--pop);
    color: white;
    font-size: 30px;
    box-shadow: 0 0 0 6px var(--cloud);
  }
  .detail h1 {
    margin: 30px 0 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 54px;
    line-height: 1;
    letter-spacing: -0.02em;
    text-wrap: balance;
  }
  .detail h1.long {
    font-size: 44px;
  }

  /* ── Panel with an image ─────────────── */
  .media {
    position: relative;
    flex: none;
    height: 288px;
    margin: 0 -4px;
    border-radius: 30px;
    overflow: hidden;
    background: color-mix(in oklab, var(--tint) 30%, var(--sky));
    box-shadow: 0 22px 34px -22px color-mix(in oklab, var(--tint) 80%, black);
    animation: bob 300ms var(--spring) both;
  }
  .media .shot {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .logo-shade {
    position: absolute;
    inset: 40% 0 0;
    background: linear-gradient(transparent, rgb(20 26 40 / 0.55));
  }
  .media .logo {
    position: absolute;
    right: 22px;
    bottom: 18px;
    max-width: 290px;
    max-height: 104px;
    object-fit: contain;
    object-position: right bottom;
    filter: drop-shadow(0 4px 10px rgb(0 0 0 / 0.45));
  }
  .media .heart {
    right: 16px;
    top: 16px;
    box-shadow: none;
  }
  /* the small box rises over the image, with a white border; the name always
     starts below the image (a long one grows downward, never over it) */
  .headline {
    display: flex;
    align-items: flex-end;
    gap: 22px;
    padding-left: 18px;
    position: relative;
  }
  .mini-cover {
    flex: none;
    margin-top: -64px;
    border-radius: 20px;
    box-shadow:
      0 0 0 6px var(--cloud),
      0 18px 26px -16px color-mix(in oklab, var(--tint) 80%, black);
  }
  .mini-cover :global(.cover) {
    border-radius: 18px;
  }
  .headline h1 {
    margin: 12px 0 0;
    padding-bottom: 2px;
    font-size: 42px;
    line-height: 1.02;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .headline h1.long {
    font-size: 36px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    list-style: none;
    margin: 18px 0 0;
    padding: 0;
  }
  .chips li {
    padding: 4px 16px 6px;
    border-radius: 999px;
    background: color-mix(in oklab, var(--tint) 18%, var(--cloud));
    font-weight: 700;
    font-size: 21px;
  }
  .played {
    display: flex;
    align-items: center;
    gap: 8px;
    align-self: flex-start;
    margin: 14px 0 0;
    padding: 6px 16px 6px 12px;
    border-radius: 999px;
    background: var(--sky);
    font-size: 21px;
    color: var(--ink-soft);
    white-space: nowrap;
  }
  .played strong {
    color: var(--ink);
    font-size: 22px;
  }
  .played :global(svg) {
    color: var(--ink);
  }
  .desc {
    flex: none;
    margin: 20px 0 0;
    font-size: 25px;
    line-height: 1.4;
    color: var(--ink-soft);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  /* with an image on top there's less room: two lines */
  .desc.short {
    margin-top: 16px;
    font-size: 23px;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  /* ── Position in the list ────────────── */
  .position {
    position: absolute;
    left: 112px;
    bottom: 60px;
    display: flex;
    align-items: center;
    gap: 14px;
    font-weight: 700;
    font-size: 26px;
    color: var(--ink-soft);
  }
  .letter {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: var(--ink);
    color: var(--cloud);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 26px;
    padding-top: 3px;
  }
  .letter.wide {
    width: auto;
    padding: 3px 14px 0;
    font-size: 22px;
  }
  .order {
    padding: 4px 14px 6px;
    border-radius: 999px;
    background: var(--cloud);
    font-size: 21px;
  }
  .order.filter {
    background: var(--ink);
    color: var(--cloud);
  }
  /* the big letter when jumping with LT / RT */
  .bubble {
    position: absolute;
    left: 1290px;
    top: 470px;
    translate: -50% -50%;
    display: grid;
    place-items: center;
    min-width: 200px;
    height: 200px;
    padding: 12px 40px 0;
    border-radius: 60px;
    background: color-mix(in oklab, var(--ink) 90%, transparent);
    color: var(--cloud);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 120px;
    line-height: 1;
    z-index: 5;
    pointer-events: none;
    animation: bubble 650ms ease both;
  }
  @keyframes bubble {
    0% {
      opacity: 0;
      transform: scale(0.8);
    }
    15%,
    75% {
      opacity: 1;
      transform: scale(1);
    }
    100% {
      opacity: 0;
    }
  }
  .file {
    margin: 20px 0 0;
    padding: 10px 16px;
    border-radius: 16px;
    background: var(--sky);
    font-size: 21px;
    color: var(--ink-soft);
    overflow-wrap: anywhere;
  }
  .via {
    margin: auto 0 0;
    padding-top: 16px;
    font-weight: 700;
    font-size: 21px;
    color: var(--ink-soft);
  }
  .via .own,
  .via .missing {
    margin-left: 10px;
    padding: 2px 12px 4px;
    border-radius: 999px;
    font-size: 18px;
    white-space: nowrap;
  }
  .via .own {
    background: var(--sky);
    color: var(--ink);
  }
  .via .missing {
    background: var(--pop);
    color: var(--on-color);
  }
  .note {
    margin: 20px 0 0;
    padding: 16px 20px;
    border-radius: 22px;
    background: var(--sun);
    font-weight: 700;
    font-size: 23px;
    line-height: 1.35;
  }

  /* ── Grid ─────────────────────────────── */
  .grid-window {
    position: absolute;
    left: 776px;
    right: 112px;
    top: 134px;
    height: 836px;
    overflow: hidden;
    /* extra room so the focus ring and jump aren't cut off */
    padding: 42px 20px 0;
    margin: 0 -20px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(5, 178px);
    gap: 44px 35px; /* rows, columns: see the spacing rule in app.css */
    transition: transform 320ms var(--spring);
  }
  .grid.instant {
    transition: none;
  }
  .cell {
    position: relative;
    border-radius: 22px;
  }
  /* a game the last scan brought: until you play it or for 14 days (core/newGames.js) */
  .new-tag {
    position: absolute;
    left: 10px;
    top: 10px;
    padding: 4px 12px 5px;
    border-radius: 999px;
    background: var(--pop);
    color: var(--on-color);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 17px;
    line-height: 1;
    box-shadow: 0 4px 10px -4px rgb(0 0 0 / 0.35);
  }
  .mini-heart {
    position: absolute;
    right: 10px;
    top: 10px;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--cloud);
    color: var(--pop);
    font-size: 20px;
  }

  /* ── Empty ───────────────────────────── */
  .empty {
    position: absolute;
    left: 112px;
    top: 330px;
    max-width: 1100px;
  }
  .empty h1 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 80px;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .empty p {
    margin: 28px 0 0;
    font-size: 30px;
    line-height: 1.5;
    color: var(--ink-soft);
  }
  .empty p.hint {
    margin-top: 18px;
    font-size: 25px;
  }
  .empty code {
    font-family: var(--font-body);
    font-weight: 700;
    color: var(--ink);
    background: var(--cloud);
    padding: 2px 12px;
    border-radius: 12px;
  }

  @keyframes bob {
    from {
      transform: scale(0.92);
    }
  }
</style>
