<script>
  /**
   * The screensaver: after a few minutes without touching the controller
   * (Options › Preferences), your games one after another, with a slow pan.
   *
   *   - fan art: full screen
   *   - a screenshot or title screen: framed, over a blurred copy of itself
   *     (they're usually small and would look blurry full screen)
   *   - without backgrounds: the covers; without covers, it only dims
   *
   *   A  play the one on screen        any other button  back
   */
  import { untrack } from 'svelte'
  import { fade } from 'svelte/transition'
  import { getPlatform } from '../lib/core/platforms.js'
  import { t } from '../lib/i18n/i18n.svelte.js'
  import { usableMedia } from '../lib/ui/activity.svelte.js'
  import Clock from '../lib/ui/Clock.svelte'
  import CoverArt from '../lib/ui/CoverArt.svelte'
  import { pushHandler } from '../lib/ui/input.js'
  import { library } from '../lib/ui/library.svelte.js'
  import Logo from '../lib/ui/Logo.svelte'
  import PadButton from '../lib/ui/PadButton.svelte'

  /** @type {{ onPlay: (game: any) => void, onClose: () => void }} */
  let { onPlay, onClose } = $props()

  /** How long each game stays on screen */
  const SLIDE_MS = 9000

  /** @template T @param {T[]} list */
  function shuffle(list) {
    const copy = [...list]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }

  // It's put together once, when it appears
  const pool = untrack(() => {
    const withBackground = library.all.filter((g) => usableMedia(g.background))
    if (withBackground.length > 0) return { mode: 'background', games: shuffle(withBackground) }
    const withCover = library.all.filter((g) => g.cover)
    return { mode: withCover.length > 0 ? 'cover' : 'dim', games: shuffle(withCover) }
  })

  let index = $state(0)
  const game = $derived(pool.games.length > 0 ? pool.games[index % pool.games.length] : null)
  const platform = $derived(game ? getPlatform(game.system) : null)
  const logo = $derived(usableMedia(game?.logo))
  const full = $derived(game?.backgroundKind === 'fanart')

  $effect(() => {
    if (pool.games.length < 2) return
    const timer = setInterval(() => index++, SLIDE_MS)
    return () => clearInterval(timer)
  })

  // The next image is requested in advance, so it comes in without jumps
  $effect(() => {
    const next = pool.games[(index + 1) % Math.max(1, pool.games.length)]
    const src = next && (pool.mode === 'background' ? next.background : next.cover)
    if (src) new Image().src = src
  })

  $effect(() =>
    pushHandler((action) => {
      if (action === 'a' && game) onPlay(game)
      else onClose()
    }),
  )
</script>

<div class="saver" role="presentation" onclick={onClose} transition:fade={{ duration: 500 }}>
  {#if game && platform && pool.mode !== 'dim'}
    {#key index}
      <!-- The new one comes in under the previous one, which fades on top: a
           clean crossfade, without going through black -->
      <div class="slide" out:fade={{ duration: 1400 }}>
        {#if pool.mode === 'background'}
          {#if full}
            <img class="pan" class:alt={index % 2 === 1} src={game.background} alt="" />
          {:else}
            <img class="wash" src={game.background} alt="" />
            <div class="frame">
              <img class="pan" class:alt={index % 2 === 1} src={game.background} alt="" />
            </div>
          {/if}
        {:else}
          <img class="wash" src={game.cover} alt="" />
          <div class="box">
            <CoverArt {game} {platform} width={500} height={660} showTitle={false} real />
          </div>
        {/if}
        <div class="shade" class:full></div>
        <div class="caption">
          {#if logo}
            <img class="logo" src={logo} alt={game.name} />
          {:else}
            <h1 class:long={game.name.length > 22}>{game.name}</h1>
          {/if}
          <p>
            <span class="chip" style:background={platform.color} style:color={platform.ink}>{platform.name}</span>
            {#if game.year}<span class="year">{game.year}</span>{/if}
          </p>
        </div>
      </div>
    {/key}
  {:else}
    <div class="dim"><Logo size={70} /></div>
  {/if}

  <div class="clock"><Clock /></div>
  <div class="hints">
    {#if game}<span><PadButton name="a" size={34} /> {t('Jugar')}</span>{/if}
    <span class="soft">{t('Cualquier botón para volver')}</span>
  </div>
</div>

<style>
  .saver {
    position: absolute;
    inset: 0;
    z-index: 40;
    overflow: hidden;
    background: #10151f;
    color: #ffffff; /* always dark: it doesn't follow the theme */
    cursor: none;
  }
  .slide {
    position: absolute;
    inset: 0;
  }
  /* slow pan (Ken Burns effect); the odd ones go the other way */
  .pan {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    animation: pan 12s linear both;
  }
  .pan.alt {
    animation-name: pan-alt;
  }
  @keyframes pan {
    from {
      transform: scale(1.04) translate(-1.2%, -0.8%);
    }
    to {
      transform: scale(1.14) translate(1.2%, 0.8%);
    }
  }
  @keyframes pan-alt {
    from {
      transform: scale(1.14) translate(1.2%, -0.6%);
    }
    to {
      transform: scale(1.04) translate(-1.2%, 0.6%);
    }
  }
  /* the same image, small, enlarged and heavily blurred: as the background */
  .wash {
    position: absolute;
    left: -30px;
    top: -30px;
    width: 500px;
    height: 290px;
    object-fit: cover;
    transform: scale(4);
    transform-origin: 0 0;
    filter: blur(8px) saturate(1.3) brightness(0.7);
  }
  .frame {
    position: absolute;
    right: 112px;
    top: 170px; /* below the clock */
    width: 1040px;
    height: 780px;
    overflow: hidden;
    border-radius: 44px;
    box-shadow:
      0 0 0 8px rgb(255 255 255 / 0.9),
      0 40px 80px -30px rgb(0 0 0 / 0.7);
  }
  .box {
    position: absolute;
    right: 200px;
    top: 50%;
    translate: 0 -50%;
    animation: float 9s ease-in-out both;
  }
  .box :global(.cover) {
    border-radius: 40px;
    box-shadow: 0 50px 90px -30px rgb(0 0 0 / 0.75);
  }
  @keyframes float {
    from {
      transform: translateY(12px) scale(0.98);
    }
    to {
      transform: translateY(-12px) scale(1.02);
    }
  }
  .shade {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgb(10 14 22 / 0.75) 0%, rgb(10 14 22 / 0.2) 45%, transparent 70%);
  }
  .shade.full {
    background:
      linear-gradient(0deg, rgb(10 14 22 / 0.8) 0%, transparent 45%),
      linear-gradient(90deg, rgb(10 14 22 / 0.5) 0%, transparent 50%);
  }
  .caption {
    position: absolute;
    left: 112px;
    bottom: 150px;
    max-width: 560px;
  }
  .caption h1 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 76px;
    line-height: 1;
    letter-spacing: -0.02em;
    text-wrap: balance;
    text-shadow: 0 6px 24px rgb(0 0 0 / 0.5);
  }
  .caption h1.long {
    font-size: 60px;
  }
  .logo {
    display: block;
    max-width: 540px;
    max-height: 220px;
    object-fit: contain;
    object-position: left bottom;
    filter: drop-shadow(0 6px 18px rgb(0 0 0 / 0.55));
  }
  .caption p {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 24px 0 0;
  }
  .chip {
    padding: 6px 20px 8px;
    border-radius: 999px;
    font-weight: 800;
    font-size: 24px;
  }
  .year {
    font-weight: 700;
    font-size: 26px;
    opacity: 0.85;
  }
  .clock {
    position: absolute;
    top: 56px;
    right: 112px;
    text-shadow: 0 2px 12px rgb(0 0 0 / 0.5);
  }
  .clock :global(.date) {
    color: rgb(255 255 255 / 0.8);
  }
  .hints {
    position: absolute;
    left: 112px;
    bottom: 60px;
    display: flex;
    align-items: center;
    gap: 36px;
    font-weight: 700;
    font-size: 26px;
  }
  .hints span {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .hints .soft {
    opacity: 0.7;
  }
  .dim {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    opacity: 0.5;
  }
  .dim :global(.word) {
    color: #ffffff; /* always dark: it doesn't follow the theme */
  }
</style>
