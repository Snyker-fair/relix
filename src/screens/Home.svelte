<script>
  import { mode } from '../lib/core/bridge.js'
  import { getPlatform } from '../lib/core/platforms.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import Clock from '../lib/ui/Clock.svelte'
  import CoverArt from '../lib/ui/CoverArt.svelte'
  import { plural } from '../lib/ui/format.js'
  import HintBar from '../lib/ui/HintBar.svelte'
  import { pushHandler } from '../lib/ui/input.js'
  import { collections } from '../lib/ui/collections.svelte.js'
  import { library } from '../lib/ui/library.svelte.js'
  import Logo from '../lib/ui/Logo.svelte'
  import { shelf } from '../lib/ui/shelf.svelte.js'
  import { sound } from '../lib/ui/sound.js'

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
   * }}
   */
  let { focusedId, boot, onOpen, onLaunch, onFocusChange, onOptions, onSearch, onMenu } = $props()

  const OPTIONS = { id: 'options', name: 'Opciones', shortName: 'Opciones' }

  /** @type {'channels'|'recent'} */
  let zone = $state('channels')
  let recentIndex = $state(0)

  // Canales visibles y, al final, el ícono de Opciones
  const ids = $derived([...shelf.channels.map((c) => c.id), 'options'])
  const index = $derived.by(() => {
    const found = focusedId ? ids.indexOf(focusedId) : -1
    if (found >= 0) return found
    // Por defecto, la primera consola (no Favoritos ni Colecciones)
    const firstConsole = shelf.channels.findIndex((c) => c.id !== 'favorites' && c.id !== 'collections')
    return firstConsole >= 0 ? firstConsole : 0
  })
  const onOptionsTile = $derived(ids[index] === 'options')
  const channel = $derived(onOptionsTile ? OPTIONS : shelf.channels[index])
  const games = $derived(onOptionsTile ? [] : shelf.gamesFor(channel.id))
  const optionsFocused = $derived(zone === 'channels' && onOptionsTile)
  const emptyLibrary = $derived(library.all.length === 0)
  const recent = $derived(library.recent.slice(0, 4))
  // Con Favoritos, Colecciones y las cinco consolas la fila se aprieta un poco
  // (1600 px útiles: canales de 184 px y Opciones de 156 px)
  const shelfGap = $derived(
    Math.max(18, Math.min(52, Math.floor((1600 - shelf.channels.length * 184 - 156) / shelf.channels.length))),
  )

  // Tres portadas en abanico para el canal enfocado: favoritos primero
  const fan = $derived(
    [...games].sort((a, b) => Number(library.isFavorite(b)) - Number(library.isFavorite(a))).slice(0, 3),
  )

  const meta = $derived.by(() => {
    if (onOptionsTile) {
      const consoles = shelf.channels.filter((c) => c.id !== 'favorites' && c.id !== 'collections').length
      return [plural(library.all.length, 'juego', 'juegos'), plural(consoles, 'consola', 'consolas'), 'Escaneo y preferencias']
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
    return [channel.maker, String(channel.year), plural(games.length, 'juego', 'juegos'), channel.emulatorName]
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

<header class="top">
  <Logo size={64} {boot} />
  {#if mode === 'browser'}
    <p class="kbd-help">
      Sin control: flechas, Enter elige, Esc vuelve, X favorito, Y menú del juego, Q/E cambian de
      consola, Z/C saltan de letra, V busca, M abre Opciones. También sirve el mouse.
    </p>
  {/if}
  <Clock />
</header>

<section class="hero" aria-live="polite">
  {#key channel.id}
    <div class="hero-text">
      {#if emptyLibrary && onOptionsTile}
        <h1>Aún no hay juegos</h1>
        <p class="first-steps">
          Copia tus juegos a <code>{library.romRoot}\&lt;consola&gt;</code> en el USB, por ejemplo
          <code>{library.romFolderPath('ps2')}</code>, y escanéalos desde Opciones.
        </p>
      {:else}
        <h1>{channel.name}</h1>
        <ul class="chips">
          {#each meta as item (item)}
            <li>{item}</li>
          {/each}
        </ul>
      {/if}
    </div>
    <div class="fan" class:hidden={onOptionsTile}>
      {#each fan as game, i (game.id)}
        <div class="fan-card" style:--i={i - (fan.length - 1) / 2}>
          <CoverArt {game} platform={getPlatform(game.system)} width={210} thumb />
        </div>
      {:else}
        <p class="empty">Todavía no hay juegos aquí.</p>
      {/each}
    </div>
  {/key}
</section>

<section class="shelf" class:dimmed={zone !== 'channels'} style:gap="{shelfGap}px">
  <div class="tray"></div>
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
        <ChannelIcon id={ch.id} color={ch.ink} size={86} />
      </span>
      <span class="label">{ch.shortName}</span>
    </button>
  {/each}
  <button
    class="channel options"
    class:focused={optionsFocused}
    class:boot
    style:--tint="#8FA3BF"
    style:--delay="{shelf.channels.length * 70}ms"
    onmouseenter={() => ((zone = 'channels'), focusChannel(ids.length - 1))}
    onclick={() => (sound.select(), onOptions())}
  >
    <span class="tile round focus-ring" class:focused={optionsFocused}>
      <ChannelIcon id="options" color="#23304A" size={78} />
    </span>
    <span class="label">Opciones</span>
  </button>
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
          <CoverArt {game} {platform} width={64} showTitle={false} thumb />
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
    ? [
        { button: 'a', label: 'Abrir' },
        { button: 'view', label: 'Buscar' },
        { button: 'start', label: 'Opciones' },
      ]
    : [
        { button: 'a', label: 'Jugar' },
        { button: 'y', label: 'Menú' },
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

  /* ── Fila de canales ───────────────────── */
  .shelf {
    position: absolute;
    left: 112px;
    right: 112px;
    top: 520px;
    display: flex;
    /* de izquierda a derecha: con pocas consolas no quedan separadas a los extremos */
    gap: 52px;
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
    width: 184px;
    height: 184px;
    border-radius: 56px;
    box-shadow: inset 0 -10px 0 rgb(0 0 0 / 0.1);
  }
  /* Opciones: redondo y blanco, para que se lea como herramienta y no como consola */
  .tile.round {
    width: 156px;
    height: 156px;
    margin: 14px 0;
    border-radius: 50%;
    background: var(--cloud);
    box-shadow: inset 0 -8px 0 rgb(35 48 74 / 0.08);
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
    top: 862px;
    right: 700px;
  }
  .recent h2 {
    margin: 0 0 30px;
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
