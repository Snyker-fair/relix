<script>
  /**
   * A game's full sheet (Y › Game sheet, or clicking the right stick in the
   * library): the whole description, every piece of data ES-DE or Wikipedia
   * left, the time you've played it and its last weeks.
   * Only images: no video plays here (Relix has about 1 GB as an App).
   *
   *   ↑ ↓  scroll the description     A  play       X  favorite
   *   Y    the game menu              B (or the right stick)  back
   *
   * Opened by "Surprise me", it says so at the top and the left stick picks another.
   */
  import { untrack } from 'svelte'
  import { getPlatform } from '../lib/core/platforms.js'
  import { weeklyTotals } from '../lib/core/playDays.js'
  import { brokenMedia, usableMedia } from '../lib/ui/activity.svelte.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import Clock from '../lib/ui/Clock.svelte'
  import CoverArt from '../lib/ui/CoverArt.svelte'
  import { emulators } from '../lib/ui/emulators.svelte.js'
  import { formatPlaytime, plural, timeAgo } from '../lib/ui/format.js'
  import { gameInfo } from '../lib/ui/gameInfo.svelte.js'
  import HintBar from '../lib/ui/HintBar.svelte'
  import { dispatch, pushHandler } from '../lib/ui/input.js'
  import { library } from '../lib/ui/library.svelte.js'
  import Logo from '../lib/ui/Logo.svelte'
  import PadButton from '../lib/ui/PadButton.svelte'
  import { sound } from '../lib/ui/sound.js'
  import WeekBars from '../lib/ui/WeekBars.svelte'
  import { i18n, t } from '../lib/i18n/i18n.svelte.js'

  /**
   * @type {{
   *   gameId: string,
   *   onBack: () => void,
   *   onLaunch: (game: any) => void,
   *   onMenu: (game: any) => void,
   *   onAnother?: () => void,
   * }}
   *   onAnother: it's a surprise (core/surprise.js); picks another one
   */
  let { gameId, onBack, onLaunch, onMenu, onAnother } = $props()

  const game = $derived(library.byId.get(gameId))
  // Hidden from its menu, or renamed to another id: back where it was opened from
  $effect(() => {
    if (!game) untrack(onBack)
  })

  const platform = $derived(game ? getPlatform(game.system) : null)
  const emulator = $derived(game ? emulators.forGame(game) : null)
  const favorite = $derived(game ? library.isFavorite(game) : false)
  const played = $derived(game ? library.playtime[game.id] : undefined)
  const lastPlayed = $derived(game ? library.lastPlayed[game.id] : undefined)
  const weeks = $derived(game ? weeklyTotals(library.playDays, { now: Date.now(), weeks: 8, id: game.id }) : [])
  const thisWeek = $derived(weeks.at(-1)?.seconds ?? 0)
  const hasWeeks = $derived(weeks.some((w) => w.seconds > 0))

  /** ES-DE's rating (0 to 1) out of 5: "4,5" in Spanish, "4.5" in English */
  const stars = $derived(new Intl.NumberFormat(i18n.dateLocale, { maximumFractionDigits: 1 }))

  /** Every piece of data the game has, in order; the empty ones don't show */
  const facts = $derived.by(() => {
    if (!game) return []
    return [
      { label: t('Año'), value: game.year ? String(game.year) : '' },
      { label: t('Género'), value: game.genre },
      { label: t('Desarrolladora'), value: game.developer },
      { label: t('Distribuidora'), value: game.publisher },
      {
        label: t('Jugadores'),
        value: game.players ? (game.players === '1' ? t('1 jugador') : t('{n} jugadores', { n: game.players })) : '',
      },
      {
        label: t('Calificación'),
        value: game.rating ? t('{n} de 5', { n: stars.format(game.rating * 5) }) : '',
      },
      { label: t('Se abre con'), value: emulator?.name ?? '' },
      { label: t('Archivo'), value: game.path.split('/').pop() ?? '' },
    ].filter((f) => f.value)
  })

  // The screen's background: the game's image, blurred like in the library
  const ambient = $derived(usableMedia(game?.background) ?? usableMedia(game?.thumb) ?? '')
  const logo = $derived(usableMedia(game?.logo))

  // The description scrolls with ↑ ↓ when it doesn't fit
  /** @type {HTMLElement | undefined} */
  let descEl = $state()
  let scroll = $state(0)
  let maxScroll = $state(0)
  $effect(() => {
    game?.description
    if (!descEl) return
    const el = descEl
    const measure = () => (maxScroll = Math.max(0, el.scrollHeight - el.clientHeight))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  })
  $effect(() => {
    if (descEl) descEl.scrollTop = scroll
  })
  const STEP = 130

  /** @param {1 | -1} direction */
  function scrollBy(direction) {
    const next = Math.max(0, Math.min(maxScroll, scroll + direction * STEP))
    if (next === scroll) return
    scroll = next
    sound.move()
  }

  $effect(() =>
    pushHandler((action) => {
      if (!game) return
      if (action === 'down') scrollBy(1)
      else if (action === 'up') scrollBy(-1)
      else if (action === 'a') emulator ? onLaunch(game) : sound.error()
      else if (action === 'x') (library.toggleFavorite(game), sound.favorite())
      else if (action === 'y') (sound.select(), onMenu(game))
      else if (action === 'b' || action === 'rs') (sound.back(), onBack())
      else if (action === 'ls' && onAnother) (sound.select(), onAnother())
    }),
  )
</script>

{#if game && platform}
  <div class="ambient" aria-hidden="true">
    {#if ambient}<img src={ambient} alt="" />{/if}
  </div>

  <header class="top">
    <button class="back" onclick={() => dispatch('b')}>
      <PadButton name="b" size={30} />
      <Logo size={34} />
    </button>
    <span class="pills">
      {#if onAnother}
        <span class="surprise"><ChannelIcon id="dice" color="currentColor" size={30} />{t('Sorpréndeme')}</span>
      {/if}
      <span class="console" style:background={platform.color} style:color={platform.ink}>
        <ChannelIcon id={platform.id} color="currentColor" size={30} />
        {platform.shortName}
      </span>
    </span>
    <Clock />
  </header>

  <aside class="side" style:--tint={platform.color}>
    <div class="cover">
      <CoverArt {game} {platform} width={280} height={392} showTitle={false} real />
      {#if favorite}<span class="heart" aria-label={t('Favorito')}>♥</span>{/if}
    </div>

    <section class="time" aria-label={t('Tiempo jugado')}>
      <h2>{t('Tiempo jugado')}</h2>
      {#if played}
        <p class="total">
          <strong>{formatPlaytime(played.seconds)}</strong>
          <span>{plural(played.plays, 'partida', 'partidas')}{lastPlayed ? ` · ${timeAgo(lastPlayed)}` : ''}</span>
        </p>
      {:else}
        <p class="total"><span>{t('Todavía no lo juegas.')}</span></p>
      {/if}
      {#if hasWeeks}
        <WeekBars {weeks} label={t('Tiempo jugado por semana')} />
        <p class="note">
          {thisWeek > 0 ? t('Esta semana: {time}', { time: formatPlaytime(thisWeek) }) : t('Esta semana no lo has jugado.')}
        </p>
      {:else if played}
        <p class="note">{t('Las semanas se cuentan desde la 1.3.0: aparecen cuando vuelvas a jugarlo.')}</p>
      {/if}
    </section>
  </aside>

  <main class="main" style:--tint={platform.color}>
    {#if logo}
      <img class="logo" src={logo} alt={game.name} onerror={() => brokenMedia.add(logo)} />
    {/if}
    <h1 class:long={game.name.length > 30} class:hidden={Boolean(logo)}>{game.name}</h1>

    {#if facts.length > 0}
      <dl class="facts">
        {#each facts as fact (fact.label)}
          <div>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        {/each}
      </dl>
    {/if}

    <div class="desc-box" class:more={scroll < maxScroll} class:scrolled={scroll > 0}>
      {#if game.description}
        <p class="desc" bind:this={descEl}>{game.description}</p>
      {:else}
        <p class="desc empty">
          {t('Este juego no tiene descripción.')}
          {#if gameInfo.canFill(game)}
            {t('Búscala en Wikipedia desde el menú:')} <PadButton name="y" size={28} /> › {t('Buscar información…')}
          {/if}
        </p>
      {/if}
    </div>
  </main>

  <HintBar
    hints={[
      { button: 'a', label: emulator ? t('Jugar') : t('No disponible') },
      { button: 'y', label: t('Menú') },
      { button: 'x', label: favorite ? t('Quitar favorito') : t('Favorito') },
      ...(onAnother ? [{ button: /** @type {const} */ ('ls'), label: t('Otro') }] : []),
      ...(maxScroll > 0 ? [{ button: /** @type {const} */ ('down'), also: /** @type {const} */ ('up'), label: t('Desplazar') }] : []),
      { button: 'b', label: t('Volver') },
    ]}
  />
{/if}

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
    padding: 8px 22px 8px 10px;
    border-radius: 999px;
    background: var(--cloud);
  }
  .pills {
    display: flex;
    gap: 12px;
  }
  .console,
  .surprise {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 26px 8px 18px;
    border-radius: 999px;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 26px;
  }
  .surprise {
    background: var(--pop);
    color: var(--on-color);
  }

  /* ── Blurred background (as in the library: small and enlarged, so the blur is cheap) ── */
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

  /* ── Left: the box and the time played ── */
  .side {
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
  .cover {
    position: relative;
    align-self: center;
    animation: bob 300ms var(--spring) both;
  }
  .cover :global(.cover) {
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
  .time {
    margin-top: auto;
  }
  .time h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    color: var(--ink-soft);
  }
  .total {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin: 4px 0 18px;
    font-size: 22px;
    color: var(--ink-soft);
  }
  .total strong {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 48px;
    color: var(--ink);
  }
  .note {
    margin: 12px 0 0;
    font-size: 20px;
    color: var(--ink-soft);
  }

  /* ── Right: the name, the data and the description ── */
  .main {
    position: absolute;
    left: 776px;
    right: 112px;
    top: 170px;
    bottom: 120px;
    display: flex;
    flex-direction: column;
  }
  .logo {
    align-self: flex-start;
    max-width: 640px;
    max-height: 150px;
    object-fit: contain;
    object-position: left center;
    filter: drop-shadow(0 6px 14px rgb(0 0 0 / 0.25));
  }
  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 68px;
    line-height: 1;
    letter-spacing: -0.02em;
    text-wrap: balance;
  }
  h1.long {
    font-size: 54px;
  }
  /* with the game's logo, the name is still there for screen readers */
  h1.hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .facts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    margin: 30px 0 0;
  }
  .facts div {
    min-width: 0;
    padding: 12px 18px 14px;
    border-radius: 20px;
    background: rgb(var(--glass) / 0.75);
  }
  .facts dt {
    font-size: 18px;
    color: var(--ink-soft);
  }
  .facts dd {
    margin: 2px 0 0;
    font-weight: 700;
    font-size: 23px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .desc-box {
    position: relative;
    flex: 1;
    min-height: 0;
    margin-top: 22px;
    padding: 28px 34px;
    border-radius: 32px;
    background: var(--cloud);
    box-shadow: 0 30px 60px -44px rgb(var(--shadow) / 0.5);
    display: flex;
  }
  /* there's more below (or above): it fades at that edge */
  .desc-box::before,
  .desc-box::after {
    content: '';
    position: absolute;
    left: 34px;
    right: 34px;
    height: 56px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 200ms ease;
  }
  .desc-box::before {
    top: 28px;
    background: linear-gradient(var(--cloud), transparent);
  }
  .desc-box::after {
    bottom: 28px;
    background: linear-gradient(transparent, var(--cloud));
  }
  .desc-box.scrolled::before,
  .desc-box.more::after {
    opacity: 1;
  }
  .desc {
    flex: 1;
    margin: 0;
    overflow: hidden;
    font-size: 26px;
    line-height: 1.5;
    white-space: pre-line;
    scroll-behavior: smooth;
  }
  .desc.empty {
    color: var(--ink-soft);
  }
  @media (prefers-reduced-motion: reduce) {
    .desc {
      scroll-behavior: auto;
    }
  }
</style>
