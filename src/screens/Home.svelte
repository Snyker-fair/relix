<script>
  import { mode } from '../lib/core/bridge.js'
  import { getPlatform } from '../lib/core/platforms.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import { CHANNELS } from '../lib/ui/channels.js'
  import Clock from '../lib/ui/Clock.svelte'
  import CoverArt from '../lib/ui/CoverArt.svelte'
  import HintBar from '../lib/ui/HintBar.svelte'
  import { pushHandler } from '../lib/ui/input.js'
  import { library } from '../lib/ui/library.svelte.js'
  import { sound } from '../lib/ui/sound.js'

  /**
   * @type {{
   *   channelIndex: number,
   *   boot: boolean,
   *   onOpen: (systemId: string) => void,
   *   onLaunch: (game: any) => void,
   *   onChannelChange: (index: number) => void,
   * }}
   */
  let { channelIndex, boot, onOpen, onLaunch, onChannelChange } = $props()

  /** @type {'channels'|'recent'} */
  let zone = $state('channels')
  let recentIndex = $state(0)

  const channel = $derived(CHANNELS[channelIndex])
  const games = $derived(library.gamesFor(channel.id))
  const recent = $derived(library.recent.slice(0, 4))

  // Tres portadas en abanico para el canal enfocado: favoritos primero
  const fan = $derived(
    [...games].sort((a, b) => Number(library.isFavorite(b)) - Number(library.isFavorite(a))).slice(0, 3),
  )

  const meta = $derived.by(() => {
    if (channel.id === 'favorites') {
      const systems = new Set(games.map((g) => g.system)).size
      return [plural(games.length, 'juego', 'juegos'), plural(systems, 'consola', 'consolas')]
    }
    return [channel.maker, String(channel.year), plural(games.length, 'juego', 'juegos'), channel.emulatorName]
  })

  function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many}`
  }

  /** @param {number} i */
  function focusChannel(i) {
    if (i === channelIndex) return
    onChannelChange(i)
    sound.move()
  }

  $effect(() =>
    pushHandler((action) => {
      if (zone === 'channels') {
        if (action === 'left' && channelIndex > 0) focusChannel(channelIndex - 1)
        else if (action === 'right' && channelIndex < CHANNELS.length - 1) focusChannel(channelIndex + 1)
        else if (action === 'down' && recent.length > 0) {
          zone = 'recent'
          recentIndex = Math.min(recentIndex, recent.length - 1)
          sound.move()
        } else if (action === 'a') {
          sound.select()
          onOpen(channel.id)
        }
      } else {
        if (action === 'left' && recentIndex > 0) (recentIndex--, sound.move())
        else if (action === 'right' && recentIndex < recent.length - 1) (recentIndex++, sound.move())
        else if (action === 'up' || action === 'b') ((zone = 'channels'), sound.move())
        else if (action === 'a') onLaunch(recent[recentIndex])
      }
    }),
  )
</script>

<header class="top">
  <div class="brand" class:boot>
    <span class="bubble" aria-hidden="true"></span>
    <span class="wordmark">Repisa</span>
  </div>
  {#if mode === 'browser'}
    <p class="kbd-help">
      Sin control: flechas para moverte, Enter para elegir, Esc para volver, X favorito, Q y E
      cambian de consola. También puedes usar el mouse.
    </p>
  {/if}
  <Clock />
</header>

<section class="hero" aria-live="polite">
  {#key channel.id}
    <div class="hero-text">
      <h1>{channel.name}</h1>
      <ul class="chips">
        {#each meta as item (item)}
          <li>{item}</li>
        {/each}
      </ul>
    </div>
    <div class="fan">
      {#each fan as game, i (game.id)}
        <div class="fan-card" style:--i={i - (fan.length - 1) / 2}>
          <CoverArt {game} platform={getPlatform(game.system)} width={210} />
        </div>
      {:else}
        <p class="empty">Todavía no hay juegos aquí.</p>
      {/each}
    </div>
  {/key}
</section>

<section class="shelf" class:dimmed={zone !== 'channels'}>
  <div class="tray"></div>
  {#each CHANNELS as ch, i (ch.id)}
    {@const focused = zone === 'channels' && i === channelIndex}
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
        <ChannelIcon id={ch.id} color={ch.ink} size={92} />
      </span>
      <span class="label">{ch.shortName}</span>
    </button>
  {/each}
</section>

{#if recent.length > 0}
  <section class="recent">
    <h2>Seguir jugando</h2>
    <div class="recent-row">
      {#each recent as game, i (game.id)}
        {@const platform = getPlatform(game.system)}
        <button
          class="recent-item focus-ring"
          class:focused={zone === 'recent' && i === recentIndex}
          style:--tint={platform.color}
          onmouseenter={() => ((zone = 'recent'), (recentIndex = i))}
          onclick={() => onLaunch(game)}
        >
          <CoverArt {game} {platform} width={64} showTitle={false} />
          <span class="recent-text">
            <strong>{game.name}</strong>
            <span>{platform.shortName}</span>
          </span>
        </button>
      {/each}
    </div>
  </section>
{/if}

<HintBar
  hints={zone === 'channels'
    ? [{ button: 'a', label: 'Abrir' }]
    : [
        { button: 'a', label: 'Jugar' },
        { button: 'b', label: 'Volver' },
      ]}
/>

<style>
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
    max-width: 640px;
    margin: 0;
    padding: 12px 24px;
    border-radius: 24px;
    background: rgb(255 255 255 / 0.7);
    font-size: 20px;
    line-height: 1.4;
    color: var(--ink-soft);
    text-align: center;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .bubble {
    position: relative;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--pop);
    box-shadow: inset -6px -8px 0 rgb(0 0 0 / 0.12);
  }
  .bubble::after {
    content: '';
    position: absolute;
    top: 12px;
    left: 13px;
    width: 14px;
    height: 10px;
    border-radius: 50%;
    background: rgb(255 255 255 / 0.85);
    transform: rotate(-30deg);
  }
  .wordmark {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 48px;
    letter-spacing: -0.02em;
    padding-top: 6px;
  }
  .brand.boot .bubble {
    animation: pop-in 600ms var(--spring) both;
  }

  /* ── Héroe ─────────────────────────────── */
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
  .chips li:first-child {
    color: var(--ink);
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
    box-shadow: 0 18px 30px -16px rgb(35 48 74 / 0.45);
    border-radius: 22px;
    animation: deal 380ms var(--spring) both;
    animation-delay: calc((var(--i) + 1) * 50ms);
  }
  .fan-card:nth-child(2) {
    z-index: 1;
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

  /* ── Repisa de canales ─────────────────── */
  .shelf {
    position: absolute;
    left: 112px;
    right: 112px;
    top: 520px;
    display: flex;
    justify-content: space-between;
    padding: 30px 48px 0;
    transition: opacity 200ms ease;
  }
  .shelf.dimmed {
    opacity: 0.6;
  }
  .tray {
    position: absolute;
    inset: 110px 0 -18px;
    border-radius: 56px;
    background: rgb(255 255 255 / 0.65);
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
  /* el botón ya se escala; el tile solo aporta el aro */
  .tile.focus-ring.focused {
    transform: none;
    box-shadow:
      inset 0 -10px 0 rgb(0 0 0 / 0.1),
      0 0 0 7px var(--cloud),
      0 0 0 15px var(--pop),
      0 30px 40px -12px color-mix(in oklab, var(--tint) 75%, transparent);
  }
  .tile {
    display: grid;
    place-items: center;
    width: 200px;
    height: 200px;
    border-radius: 60px;
    box-shadow: inset 0 -10px 0 rgb(0 0 0 / 0.1);
  }
  .label {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 30px;
    padding-bottom: 6px;
  }
  .channel.boot {
    animation: rise 520ms var(--spring) both;
    animation-delay: calc(250ms + var(--delay));
  }

  /* ── Seguir jugando ────────────────────── */
  .recent {
    position: absolute;
    left: 112px;
    top: 878px;
    right: 700px;
  }
  .recent h2 {
    margin: 0 0 14px;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 28px;
    color: var(--ink-soft);
  }
  .recent-row {
    display: flex;
    gap: 22px;
  }
  .recent-item {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 340px;
    padding: 10px 20px 10px 10px;
    border-radius: 28px;
    background: var(--cloud);
    text-align: left;
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
  }

  @keyframes pop-in {
    from {
      transform: scale(0);
    }
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
