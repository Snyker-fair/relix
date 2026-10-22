<script>
  import { mode } from '../lib/core/bridge.js'
  import { getPlatform } from '../lib/core/platforms.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import Clock from '../lib/ui/Clock.svelte'
  import CoverArt from '../lib/ui/CoverArt.svelte'
  import { formatPlaytime, plural } from '../lib/ui/format.js'
  import { t } from '../lib/i18n/i18n.svelte.js'
  import HintBar from '../lib/ui/HintBar.svelte'
  import { pushHandler } from '../lib/ui/input.js'
  import { collections } from '../lib/ui/collections.svelte.js'
  import { emulators } from '../lib/ui/emulators.svelte.js'
  import { library } from '../lib/ui/library.svelte.js'
  import Logo from '../lib/ui/Logo.svelte'
  import { shelf } from '../lib/ui/shelf.svelte.js'
  import { sound } from '../lib/ui/sound.js'
  import { systemStatus } from '../lib/ui/systemStatus.svelte.js'

  /**
   * @type {{
   *   focusedId: string | null,
   *   boot: boolean,
   *   onOpen: (systemId: string) => void,
   *   onLaunch: (game: any) => void,
   *   onFocusChange: (id: string) => void,
   *   onOptions: () => void,
   *   onSearch: () => void,
   *   onMenu: (game: any) => void,
   *   onSurprise: () => void,
   * }}
   *   onSurprise: "Surprise me", among every console (the die; the left stick only works inside a console)
   */
  let { focusedId, boot, onOpen, onLaunch, onFocusChange, onOptions, onSearch, onMenu, onSurprise } = $props()

  const OPTIONS = $derived({ id: 'options', name: t('Opciones'), shortName: t('Opciones') })
  const SURPRISE = $derived({ id: 'surprise', name: t('Sorpréndeme'), shortName: t('Sorpréndeme') })

  /** @type {'channels'|'recent'} */
  let zone = $state('channels')
  let recentIndex = $state(0)

  // The visible channels and, at the end, the die ("Surprise me") and the Options icon
  const ids = $derived([...shelf.channels.map((c) => c.id), 'surprise', 'options'])
  const index = $derived.by(() => {
    const found = focusedId ? ids.indexOf(focusedId) : -1
    if (found >= 0) return found
    // By default, the first console (not Favorites or Collections)
    const firstConsole = shelf.channels.findIndex((c) => c.id !== 'favorites' && c.id !== 'collections')
    return firstConsole >= 0 ? firstConsole : 0
  })
  const onOptionsTile = $derived(ids[index] === 'options')
  const onSurpriseTile = $derived(ids[index] === 'surprise')
  /** One of the two round tools at the end (not a channel with games) */
  const onTool = $derived(onOptionsTile || onSurpriseTile)
  const channel = $derived(onOptionsTile ? OPTIONS : onSurpriseTile ? SURPRISE : shelf.channels[index])
  const games = $derived(onTool ? [] : shelf.gamesFor(channel.id))
  const optionsFocused = $derived(zone === 'channels' && onOptionsTile)
  const surpriseFocused = $derived(zone === 'channels' && onSurpriseTile)
  /** The games you've never opened, for the die's chips */
  const unplayed = $derived(library.all.filter((g) => !library.playtime[g.id] && !library.lastPlayed[g.id]).length)
  const emptyLibrary = $derived(library.all.length === 0)
  // Three games: that way "Continue playing" never reaches the hint bar
  const recent = $derived(library.recent.slice(0, 3))

  // The row of channels. If they all fit (up to about seven), the icons shrink
  // a little to spread across the width. With more, they stay at 168 px and the row
  // slides to show the focused one, like the Wii U or Switch menu.
  // The focused channel grows 10 % and adds a 15 px ring: with 48 px
  // gaps there are at least 20 px free up to the neighbor. The die and Options measure 0.85.
  const SHELF_WIDTH = 1600 // the usable width inside the tray
  const SHELF_GAP = 48
  const SHELF_PAD = 48 // the tray's margin on each side
  const VIEW_WIDTH = 1696 // the tray: from 112 to 1808 px
  const fitTile = $derived(
    Math.floor((SHELF_WIDTH - (shelf.channels.length + 1) * SHELF_GAP) / (shelf.channels.length + 1.7)),
  )
  const sliding = $derived(fitTile < 150)
  const tileSize = $derived(sliding ? 168 : Math.min(184, fitTile))
  const trackWidth = $derived(SHELF_PAD * 2 + shelf.channels.length * (tileSize + SHELF_GAP) + tileSize * 0.85 * 2 + SHELF_GAP)
  // The row shifts to leave the focused channel in the center (without going past the ends)
  const shelfOffset = $derived.by(() => {
    if (!sliding) return 0
    const channels = shelf.channels.length
    const width = index < channels ? tileSize : tileSize * 0.85
    // past the channels, the tools are smaller
    const before = Math.min(index, channels) * (tileSize + SHELF_GAP) + Math.max(0, index - channels) * (tileSize * 0.85 + SHELF_GAP)
    const center = SHELF_PAD + before + width / 2
    return Math.round(Math.max(0, Math.min(center - VIEW_WIDTH / 2, trackWidth - VIEW_WIDTH)))
  })

  // Three covers fanned out for the focused channel: favorites first
  const fan = $derived(
    [...games].sort((a, b) => Number(library.isFavorite(b)) - Number(library.isFavorite(a))).slice(0, 3),
  )

  const meta = $derived.by(() => {
    if (onSurpriseTile) {
      return [
        t('Un juego al azar entre tus {games}', { games: plural(library.all.length, 'juego', 'juegos') }),
        ...(unplayed > 0 ? [t('{n} sin abrir todavía', { n: unplayed })] : []),
      ]
    }
    if (onOptionsTile) {
      const consoles = shelf.channels.filter((c) => c.id !== 'favorites' && c.id !== 'collections').length
      const { errors } = systemStatus.summary
      return [
        plural(library.all.length, 'juego', 'juegos'),
        plural(consoles, 'consola', 'consolas'),
        errors > 0
          ? t('{things} por arreglar en Revisión', { things: plural(errors, 'cosa', 'cosas') })
          : t('Escaneo, emuladores y revisión'),
      ]
    }
    if (channel.id === 'favorites') {
      const systems = new Set(games.map((g) => g.system)).size
      return [plural(games.length, 'juego', 'juegos'), plural(systems, 'consola', 'consolas')]
    }
    if (channel.id === 'collections') {
      const count = collections.visible.length
      return [
        plural(count, 'colección', 'colecciones'),
        plural(games.length, 'juego', 'juegos'),
        ...collections.visible.slice(0, 2).map((c) => c.name),
      ]
    }
    return [
      channel.maker,
      String(channel.year),
      plural(games.length, 'juego', 'juegos'),
      emulators.forPlatform(channel)?.name ?? t('Sin emulador todavía'),
    ]
  })

  /** @param {number} i */
  function focusChannel(i) {
    if (i === index || i < 0 || i >= ids.length) return
    onFocusChange(ids[i])
    sound.move()
  }

  $effect(() =>
    pushHandler((action) => {
      if (zone === 'channels') {
        if (action === 'left') focusChannel(index - 1)
        else if (action === 'right') focusChannel(index + 1)
        else if (action === 'down' && recent.length > 0) {
          zone = 'recent'
          recentIndex = Math.min(recentIndex, recent.length - 1)
          sound.move()
        } else if (action === 'a') {
          sound.select()
          if (onOptionsTile) onOptions()
          else if (onSurpriseTile) onSurprise()
          else onOpen(channel.id)
        } else if (action === 'start') {
          sound.select()
          onOptions()
        } else if (action === 'view') {
          sound.select()
          onSearch()
        }
      } else {
        if (action === 'left' && recentIndex > 0) (recentIndex--, sound.move())
        else if (action === 'right' && recentIndex < recent.length - 1) (recentIndex++, sound.move())
        else if (action === 'up' || action === 'b') ((zone = 'channels'), sound.move())
        else if (action === 'a') onLaunch(recent[recentIndex])
        else if (action === 'y') (sound.select(), onMenu(recent[recentIndex]))
        else if (action === 'view') (sound.select(), onSearch())
        else if (action === 'start') (sound.select(), onOptions())
      }
    }),
  )
</script>

<!-- The focused channel's color, soft from the top left: only a color, so it costs next to nothing -->
<div class="tint" aria-hidden="true" style:--c={onOptionsTile ? 'var(--ink-soft)' : onSurpriseTile ? 'var(--pop)' : channel.color}></div>

<header class="top">
  <Logo size={64} {boot} />
  {#if mode === 'browser'}
    <p class="kbd-help">
      {t(
        'Sin control: flechas, Enter elige, Esc vuelve, X favorito, Y menú del juego, F ficha, R sorpréndeme, Q/E cambian de consola, Z/C saltan de letra, V busca, M abre Opciones. También sirve el mouse.',
      )}
    </p>
  {/if}
  <Clock />
</header>

<section class="hero" aria-live="polite">
  {#key channel.id}
    <div class="hero-text">
      {#if emptyLibrary && onOptionsTile}
        <h1 class="long">{t('Aún no hay juegos')}</h1>
        <p class="first-steps">
          {t('Copia tus juegos a')} <code>{library.romRoot}\{t('<consola>')}</code>
          {t('en el USB, por ejemplo')}
          <code>{library.romFolderPath('ps2')}</code>{t(', y escanéalos desde Opciones.')}
        </p>
      {:else}
        <h1 class:long={channel.name.length > 14}>{channel.name}</h1>
        <ul class="chips">
          {#each meta as item (item)}
            <li>{item}</li>
          {/each}
        </ul>
      {/if}
    </div>
    <div class="fan" class:hidden={onOptionsTile}>
      {#if onSurpriseTile}
        <!-- three cards face down: which one will it be? -->
        {#each [0, 1, 2] as i (i)}
          <div class="fan-card mystery" style:--i={i - 1}><span>?</span></div>
        {/each}
      {/if}
      {#each fan as game, i (game.id)}
        <div class="fan-card" style:--i={i - (fan.length - 1) / 2}>
          <CoverArt {game} platform={getPlatform(game.system)} width={210} thumb />
        </div>
      {:else}
        {#if !onSurpriseTile}<p class="empty">{t('Todavía no hay juegos aquí.')}</p>{/if}
      {/each}
    </div>
  {/key}
</section>

<section class="shelf" class:dimmed={zone !== 'channels'} class:sliding style:--tile="{tileSize}px">
  <div class="tray"></div>
  <div class="track" style:gap="{SHELF_GAP}px" style:transform="translateX({-shelfOffset}px)">
  {#each shelf.channels as ch, i (ch.id)}
    {@const focused = zone === 'channels' && i === index}
    <button
      class="channel"
      class:focused
      class:boot
      style:--tint={ch.color}
      style:--delay="{i * 70}ms"
      onmouseenter={() => ((zone = 'channels'), focusChannel(i))}
      onclick={() => (sound.select(), onOpen(ch.id))}
    >
      <span class="tile focus-ring" class:focused style:background={ch.color}>
        <ChannelIcon id={ch.id} color={ch.ink} size={Math.round(tileSize * 0.47)} />
      </span>
      <span class="label">{ch.shortName}</span>
    </button>
  {/each}
  <button
    class="channel tool"
    class:focused={surpriseFocused}
    class:boot
    style:--tint="var(--pop)"
    style:--delay="{shelf.channels.length * 70}ms"
    onmouseenter={() => ((zone = 'channels'), focusChannel(ids.length - 2))}
    onclick={() => (sound.select(), onSurprise())}
  >
    <span class="tile round dice focus-ring" class:focused={surpriseFocused}>
      <ChannelIcon id="dice" color="currentColor" size={Math.round(tileSize * 0.46)} />
    </span>
    <span class="label">{t('Sorpréndeme')}</span>
  </button>
  <button
    class="channel tool"
    class:focused={optionsFocused}
    class:boot
    style:--tint="#8FA3BF"
    style:--delay="{(shelf.channels.length + 1) * 70}ms"
    onmouseenter={() => ((zone = 'channels'), focusChannel(ids.length - 1))}
    onclick={() => (sound.select(), onOptions())}
  >
    <span class="tile round focus-ring" class:focused={optionsFocused}>
      <ChannelIcon id="options" color="currentColor" size={Math.round(tileSize * 0.42)} />
    </span>
    {#if systemStatus.summary.errors > 0}
      <!-- something to fix: it shows in Options › Checkup -->
      <span class="alert" aria-label={plural(systemStatus.summary.errors, 'cosa por arreglar', 'cosas por arreglar')}>
        {systemStatus.summary.errors}
      </span>
    {/if}
    <span class="label">{t('Opciones')}</span>
  </button>
  </div>
</section>

{#if recent.length > 0}
  <section class="recent">
    <h2>{t('Seguir jugando')}</h2>
    <div class="recent-row">
      {#each recent as game, i (game.id)}
        {@const platform = getPlatform(game.system)}
        {@const played = library.playtime[game.id]}
        <button
          class="recent-item focus-ring"
          class:focused={zone === 'recent' && i === recentIndex}
          style:--tint={platform.color}
          onmouseenter={() => ((zone = 'recent'), (recentIndex = i))}
          onclick={() => onLaunch(game)}
        >
          <CoverArt {game} {platform} width={56} showTitle={false} thumb />
          <span class="recent-text">
            <strong>{game.name}</strong>
            <span
              >{played
                ? `${platform.shortName} · ${t('Jugado {time}', { time: formatPlaytime(played.seconds) })}`
                : platform.shortName}</span
            >
          </span>
        </button>
      {/each}
    </div>
  </section>
{/if}

<HintBar
  hints={zone === 'channels'
    ? [
        { button: 'a', label: t('Abrir') },
        { button: 'view', label: t('Buscar') },
        { button: 'start', label: t('Opciones') },
      ]
    : [
        { button: 'a', label: t('Jugar') },
        { button: 'y', label: t('Menú') },
        { button: 'b', label: t('Volver') },
      ]}
/>

<style>
  .tint {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-color: color-mix(in oklab, var(--c) 24%, transparent);
    mask-image: radial-gradient(120% 95% at 22% 8%, #000 0%, rgb(0 0 0 / 0.5) 45%, transparent 78%);
    transition: background-color 600ms ease;
  }
  :global(:root[data-theme='dark']) .tint {
    background-color: color-mix(in oklab, var(--c) 18%, transparent);
  }
  @media (prefers-reduced-motion: reduce) {
    .tint {
      transition: none;
    }
  }
  .top {
    position: absolute;
    top: 56px;
    left: 112px;
    right: 112px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .kbd-help {
    max-width: 880px;
    margin: 0;
    padding: 12px 24px;
    border-radius: 24px;
    background: rgb(var(--glass) / 0.7);
    font-size: 20px;
    line-height: 1.4;
    color: var(--ink-soft);
    text-align: center;
  }
  /* ── Hero ──────────────────────────────── */
  .hero {
    position: absolute;
    top: 170px;
    left: 112px;
    right: 112px;
    height: 360px;
  }
  .hero-text {
    position: absolute;
    left: 0;
    top: 60px;
    max-width: 1000px;
    animation: slide-in 320ms var(--spring) both;
  }
  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 124px;
    line-height: 0.95;
    letter-spacing: -0.03em;
    white-space: nowrap;
  }
  /* "PlayStation Portable", "Game Boy Advance": on one line, without touching the fan */
  h1.long {
    font-size: 88px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    list-style: none;
    margin: 28px 0 0;
    padding: 0;
  }
  .chips li {
    background: var(--cloud);
    border-radius: 999px;
    padding: 8px 22px 10px;
    font-weight: 700;
    font-size: 26px;
    color: var(--ink-soft);
  }
  .first-steps {
    max-width: 980px;
    margin: 28px 0 0;
    font-size: 30px;
    line-height: 1.55;
    color: var(--ink-soft);
  }
  .first-steps code {
    font-family: var(--font-body);
    font-weight: 700;
    color: var(--ink);
    background: var(--cloud);
    padding: 2px 12px;
    border-radius: 12px;
  }
  .chips li:first-child {
    color: var(--ink);
  }
  .fan.hidden {
    display: none;
  }
  .fan {
    position: absolute;
    right: 200px;
    top: 0;
    width: 420px;
    height: 330px;
  }
  .fan-card {
    position: absolute;
    left: 50%;
    top: 30px;
    transform: translateX(calc(-50% + var(--i) * 165px)) rotate(calc(var(--i) * 8deg));
    transform-origin: 50% 120%;
    box-shadow: 0 18px 30px -16px rgb(var(--shadow) / 0.45);
    border-radius: 22px;
    animation: deal 380ms var(--spring) both;
    animation-delay: calc((var(--i) + 1) * 50ms);
  }
  .fan-card:nth-child(2) {
    z-index: 1;
  }
  /* the die's cards: face down, with the cover's size */
  .fan-card.mystery {
    display: grid;
    place-items: center;
    width: 210px;
    height: 296px;
    background: linear-gradient(160deg, color-mix(in oklab, var(--pop) 70%, white), var(--pop));
    color: var(--on-color);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 120px;
    line-height: 1;
  }
  .fan-card.mystery span {
    padding-top: 12px;
  }
  .empty {
    position: absolute;
    right: 0;
    top: 130px;
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    color: var(--ink-soft);
  }

  /* ── Row of channels ───────────────────── */
  .shelf {
    position: absolute;
    left: 112px;
    right: 112px;
    top: 520px;
    padding-top: 30px;
    transition: opacity 200ms ease;
  }
  /* from left to right: with few consoles they don't end up apart at the ends */
  .track {
    position: relative;
    display: flex;
    padding: 0 48px;
    transition: transform 320ms var(--spring);
  }
  /* when sliding, the channels are cut at the tray's edges (that
     says there are more); above and below there's room for the ring and the shadow */
  .shelf.sliding {
    clip-path: inset(-80px 0 -120px 0);
  }
  .shelf.sliding .channel {
    width: var(--tile);
    flex: none;
  }
  .shelf.sliding .channel.tool {
    width: calc(var(--tile) * 0.85);
  }
  .shelf.dimmed {
    opacity: 0.6;
  }
  .tray {
    position: absolute;
    inset: 110px 0 -18px;
    border-radius: 56px;
    background: rgb(var(--glass) / 0.65);
  }
  .channel {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    border-radius: 60px;
    padding: 0;
  }
  .channel {
    transition: transform 260ms var(--spring);
  }
  .channel.focused {
    transform: translateY(-14px) scale(1.1);
  }
  /* the button already scales; the tile only adds the ring */
  .tile.focus-ring.focused {
    transform: none;
    box-shadow:
      inset 0 -10px 0 rgb(0 0 0 / 0.1),
      0 0 0 7px var(--ring-gap),
      0 0 0 15px var(--pop),
      0 30px 40px -12px color-mix(in oklab, var(--tint) 75%, transparent);
  }
  .tile {
    display: grid;
    place-items: center;
    width: var(--tile);
    height: var(--tile);
    border-radius: calc(var(--tile) * 0.3);
    box-shadow: inset 0 -10px 0 rgb(0 0 0 / 0.1);
  }
  /* things to fix (Options › Checkup), on the icon's edge */
  .alert {
    position: absolute;
    top: calc(var(--tile) * 0.03);
    right: calc(var(--tile) * -0.04);
    display: grid;
    place-items: center;
    min-width: 46px;
    height: 46px;
    padding: 3px 10px 0;
    border-radius: 999px;
    border: 4px solid var(--cloud);
    background: var(--pop);
    color: var(--on-color);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 24px;
    line-height: 1;
  }
  /* the die and Options: round, so they read as tools and not as consoles */
  .tile.round {
    width: calc(var(--tile) * 0.85);
    height: calc(var(--tile) * 0.85);
    margin: calc(var(--tile) * 0.075) 0;
    border-radius: 50%;
    background: var(--cloud);
    box-shadow: inset 0 -8px 0 rgb(var(--shadow) / 0.08);
  }
  .tile.round.dice {
    background: var(--pop);
    color: var(--on-color);
    box-shadow: inset 0 -8px 0 rgb(0 0 0 / 0.12);
  }
  .label {
    font-family: var(--font-display);
    font-weight: 700;
    /* it shrinks along with the icons when there are many channels */
    font-size: min(30px, calc(var(--tile) * 0.163));
    white-space: nowrap;
    padding-bottom: 6px;
  }
  .channel.boot {
    animation: rise 520ms var(--spring) both;
    animation-delay: calc(250ms + var(--delay));
  }

  /* ── Continue playing ──────────────────── */
  .recent {
    position: absolute;
    left: 112px;
    top: 830px;
    right: 600px;
  }
  .recent h2 {
    margin: 0 0 32px;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 28px;
    color: var(--ink-soft);
  }
  /* the focused one's ring (11 px + 2.5 %) leaves 20 px free up to the neighbor */
  .recent-row {
    display: flex;
    gap: 40px;
  }
  .recent-item {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 330px;
    padding: 8px 20px 8px 8px;
    border-radius: 28px;
    background: var(--cloud);
    text-align: left;
  }
  /* at the very bottom there's no room to rise: it only grows a little and gets the ring */
  .recent-item.focus-ring.focused {
    transform: scale(1.04);
  }
  .recent-item :global(.cover) {
    border-radius: 16px;
  }

  .recent-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .recent-text strong {
    font-weight: 700;
    font-size: 24px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .recent-text span {
    font-size: 20px;
    color: var(--ink-soft);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(60px);
    }
  }
  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateX(-24px);
    }
  }
  @keyframes deal {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(40px) rotate(0deg);
    }
  }
</style>
