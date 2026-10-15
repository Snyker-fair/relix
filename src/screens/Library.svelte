<script>
  import { getPlatform } from '../lib/core/platforms.js'
  import { CHANNELS } from '../lib/ui/channels.js'
  import { shelf } from '../lib/ui/shelf.svelte.js'
  import Clock from '../lib/ui/Clock.svelte'
  import CoverArt from '../lib/ui/CoverArt.svelte'
  import HintBar from '../lib/ui/HintBar.svelte'
  import PadButton from '../lib/ui/PadButton.svelte'
  import Logo from '../lib/ui/Logo.svelte'
  import { dispatch, pushHandler } from '../lib/ui/input.js'
  import { library } from '../lib/ui/library.svelte.js'
  import { sound } from '../lib/ui/sound.js'

  /**
   * @type {{
   *   systemId: string,
   *   onBack: () => void,
   *   onSwitch: (systemId: string) => void,
   *   onLaunch: (game: any) => void,
   *   onOptions: () => void,
   * }}
   */
  let { systemId, onBack, onSwitch, onLaunch, onOptions } = $props()

  const COLUMNS = 5
  const COVER_W = 184
  const ROW_H = 258 + 34 // alto de portada + separación

  let index = $state(0)

  // Pestañas: solo los canales visibles (los vacíos se ocultan, salvo que se pida verlos)
  const channelIndex = $derived(shelf.channels.findIndex((c) => c.id === systemId))
  const channel = $derived(CHANNELS.find((c) => c.id === systemId) ?? CHANNELS[0])
  const games = $derived(library.gamesFor(systemId))
  const game = $derived(games[Math.min(index, games.length - 1)])
  const platform = $derived(game ? getPlatform(game.system) : null)
  const favorite = $derived(game ? library.isFavorite(game) : false)
  // Letra del juego enfocado, sin tildes; números y símbolos van en "#"
  const letter = $derived.by(() => {
    const first = (game?.sortName ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase()
    return /[A-Z]/.test(first) ? first : '#'
  })

  // Desplazamiento de la grilla: mantiene visible la fila enfocada
  const row = $derived(Math.floor(index / COLUMNS))
  let scrollRow = $state(0)
  $effect(() => {
    if (row < scrollRow) scrollRow = row
    else if (row > scrollRow + 1) scrollRow = row - 1
  })

  // Al cambiar de consola, volver al primer juego
  $effect(() => {
    systemId
    index = 0
    scrollRow = 0
  })

  const chips = $derived.by(() => {
    if (!game) return []
    return [
      game.year && String(game.year),
      game.developer,
      game.genre,
      game.players && (game.players === '1' ? '1 jugador' : `${game.players} jugadores`),
    ].filter(Boolean)
  })

  /** @param {number} next */
  function move(next) {
    if (next < 0 || next >= games.length || next === index) return
    index = next
    sound.move()
  }

  /** ['chd', 'iso', 'cso'] -> ".chd, .iso o .cso" */
  function formatList(/** @type {string[]} */ extensions) {
    const list = extensions.map((e) => `.${e}`)
    return list.length > 1 ? `${list.slice(0, -1).join(', ')} o ${list.at(-1)}` : list[0]
  }

  /** @param {number} delta */
  function switchChannel(delta) {
    const next = channelIndex + delta
    if (next < 0 || next >= shelf.channels.length) return
    sound.move()
    onSwitch(shelf.channels[next].id)
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
      else if (action === 'b') (sound.back(), onBack())
      else if (action === 'x' && game) (library.toggleFavorite(game), sound.favorite())
      else if (action === 'a' && game) onLaunch(game)
      else if (action === 'start') (sound.select(), onOptions())
    }),
  )
</script>

<header class="top">
  <button class="back" onclick={() => dispatch('b')}>
    <PadButton name="b" size={30} />
    <Logo size={34} />
  </button>

  <nav class="tabs" aria-label="Consolas">
    <button class="bumper" onclick={() => dispatch('lb')} aria-label="Consola anterior">
      <PadButton name="lb" size={30} />
    </button>
    {#each shelf.channels as ch (ch.id)}
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
    <button class="bumper" onclick={() => dispatch('rb')} aria-label="Consola siguiente">
      <PadButton name="rb" size={30} />
    </button>
  </nav>

  <Clock />
</header>

{#if games.length === 0}
  <section class="empty">
    <h1>{channel.id === 'favorites' ? 'Aún no tienes favoritos' : `No hay juegos de ${channel.name}`}</h1>
    {#if channel.id === 'favorites'}
      <p>En cualquier consola, pon el foco en un juego y presiona <PadButton name="x" size={30} /> para guardarlo aquí.</p>
    {:else}
      <p>
        Copia tus juegos a <code>{library.romFolderPath(channel.id)}</code> y vuelve a abrir Relix.
        Formatos: {formatList(channel.extensions)}.
      </p>
      <p class="hint">
        Para portadas y descripciones, agrega la carpeta <code>ES-DE</code> en la raíz del mismo disco.
      </p>
    {/if}
  </section>
{:else}
  <section class="detail" style:--tint={platform.color}>
    {#key game.id}
      <div class="detail-cover">
        <CoverArt {game} {platform} width={250} showTitle={false} />
        {#if favorite}<span class="heart" aria-label="Favorito">♥</span>{/if}
      </div>
      <h1 class:long={game.name.length > 24}>{game.name}</h1>
      <ul class="chips">
        {#each chips as chip (chip)}<li>{chip}</li>{/each}
      </ul>
      {#if platform.launcher}
        {#if game.description}
          <p class="desc">{game.description}</p>
        {:else}
          <!-- Sin datos de ES-DE: el nombre del archivo dice qué versión es -->
          <p class="file">{game.path.split('/').pop()}</p>
        {/if}
        <p class="via">Se abre con {platform.emulatorName}</p>
      {:else}
        <p class="note">{platform.launcherNote}</p>
      {/if}
    {/key}
  </section>

  <section class="grid-window">
    <div class="grid" style:transform="translateY({-scrollRow * ROW_H}px)">
      {#each games as g, i (g.id)}
        {@const p = getPlatform(g.system)}
        <button
          class="cell focus-ring"
          class:focused={i === index}
          style:--tint={p.color}
          onmouseenter={() => move(i)}
          onclick={() => (i === index ? onLaunch(g) : move(i))}
        >
          <CoverArt game={g} platform={p} width={COVER_W} />
          {#if library.isFavorite(g)}<span class="mini-heart" aria-label="Favorito">♥</span>{/if}
        </button>
      {/each}
    </div>
  </section>
{/if}

{#if games.length > 0}
  <div class="position" aria-live="polite">
    <span class="letter">{letter}</span>
    <span>Juego {Math.min(index, games.length - 1) + 1} de {games.length}</span>
  </div>
{/if}

<HintBar
  hints={games.length > 0
    ? [
        { button: 'a', label: platform?.launcher ? 'Jugar' : 'No disponible' },
        { button: 'x', label: favorite ? 'Quitar de favoritos' : 'Favorito' },
        { button: 'b', label: 'Volver' },
      ]
    : [{ button: 'b', label: 'Volver' }]}
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
    background: rgb(255 255 255 / 0.65);
  }
  .bumper {
    padding: 0 8px;
  }
  .tab {
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

  /* ── Panel del juego enfocado ─────────── */
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
    box-shadow: 0 30px 60px -40px rgb(35 48 74 / 0.5);
  }
  .detail-cover {
    position: relative;
    flex: none;
    width: 250px;
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
    background: color-mix(in oklab, var(--tint) 18%, white);
    font-weight: 700;
    font-size: 21px;
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
  /* ── Posición en la lista ─────────────── */
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
  .note {
    margin: 20px 0 0;
    padding: 16px 20px;
    border-radius: 22px;
    background: var(--sun);
    font-weight: 700;
    font-size: 23px;
    line-height: 1.35;
  }

  /* ── Grilla ───────────────────────────── */
  .grid-window {
    position: absolute;
    left: 776px;
    right: 112px;
    top: 134px;
    height: 836px;
    overflow: hidden;
    /* espacio extra para que el aro y el salto del foco no se corten */
    padding: 42px 20px 0;
    margin: 0 -20px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(5, 184px);
    gap: 34px 28px;
    transition: transform 320ms var(--spring);
  }
  .cell {
    position: relative;
    border-radius: 22px;
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

  /* ── Vacío ────────────────────────────── */
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
