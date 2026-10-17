<script>
  /**
   * Elegir portada a mano: para los juegos cuyo nombre no permitió encontrar
   * una portada segura (apodos como "GT4", nombres cortos como "Persona 4"),
   * o para cambiar la de un juego desde su menú (Y).
   * Muestra las candidatas más parecidas de libretro; A guarda la elegida,
   * X deja la portada de color y LB/RB pasan al juego anterior o siguiente.
   */
  import { untrack } from 'svelte'
  import { getPlatform } from '../lib/core/platforms.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import Clock from '../lib/ui/Clock.svelte'
  import CoverArt from '../lib/ui/CoverArt.svelte'
  import { covers } from '../lib/ui/covers.svelte.js'
  import HintBar from '../lib/ui/HintBar.svelte'
  import { dispatch, pushHandler } from '../lib/ui/input.js'
  import { library } from '../lib/ui/library.svelte.js'
  import Logo from '../lib/ui/Logo.svelte'
  import PadButton from '../lib/ui/PadButton.svelte'
  import { sound } from '../lib/ui/sound.js'

  /**
   * gameId: cambiar la portada de un solo juego (desde el menú Y), aunque ya tenga
   * @type {{ onBack: () => void, onToast: (message: string) => void, gameId?: string }}
   */
  let { onBack, onToast, gameId } = $props()

  const COLUMNS = 3
  /** Espacio de cada candidata (la caja entra entera, con la forma de su consola) */
  const BOX_W = 240
  const BOX_H = 260

  let gameIndex = $state(0)
  let focus = $state(0)
  /** null mientras se buscan las candidatas */
  /** @type {import('../lib/ui/covers.svelte.js').PickerCandidate[] | null} */
  let candidates = $state(null)
  let loadError = $state('')
  /** Candidata que se está guardando (-1 = ninguna) */
  let saving = $state(-1)
  /** Imágenes que no cargaron */
  /** @type {string[]} */
  let broken = $state([])

  const single = $derived(gameId !== undefined)
  const pending = $derived(
    single ? [library.byId.get(/** @type {string} */ (gameId))].filter((g) => g !== undefined) : covers.pending,
  )
  const game = $derived(pending[Math.min(gameIndex, pending.length - 1)])
  const currentId = $derived(game?.id)
  const platform = $derived(game ? getPlatform(game.system) : null)
  const fileName = $derived(game?.path.split('/').pop() ?? '')

  // Al cambiar de juego, buscar sus candidatas (por id: la biblioteca se
  // rearma al guardar portadas y no hay que buscar de nuevo por eso)
  $effect(() => {
    if (!currentId) return
    const current = untrack(() => game)
    if (!current) return
    candidates = null
    loadError = ''
    focus = 0
    let cancelled = false
    covers
      .candidatesFor(current)
      .then((list) => !cancelled && (candidates = list))
      .catch((e) => {
        if (cancelled) return
        candidates = []
        loadError = e instanceof Error ? e.message : 'No se pudieron cargar las portadas.'
      })
    return () => (cancelled = true)
  })

  /** Tamaño de la caja de una candidata, según la forma de su consola */
  const box = $derived.by(() => {
    const aspect = platform?.coverAspect ?? 0.71
    return BOX_W / BOX_H > aspect
      ? { w: Math.round(BOX_H * aspect), h: BOX_H }
      : { w: BOX_W, h: Math.round(BOX_W / aspect) }
  })

  /** @param {number} next */
  function move(next) {
    if (!candidates || next < 0 || next >= candidates.length || next === focus) return
    focus = next
    sound.move()
  }

  /** @param {number} delta */
  function switchGame(delta) {
    const next = Math.min(gameIndex, pending.length - 1) + delta
    if (saving >= 0 || next < 0 || next >= pending.length) return
    gameIndex = next
    sound.move()
  }

  async function choose() {
    const candidate = candidates?.[focus]
    if (!game || !candidate || saving >= 0) return
    const current = game
    saving = focus
    sound.select()
    try {
      await covers.choose(current, candidate.name)
      sound.favorite()
      onToast(`Portada guardada: ${current.name}`)
      if (single) onBack()
      // Si no, el juego sale de la lista: el que sigue queda en la misma posición
    } catch (e) {
      sound.error()
      onToast(e instanceof Error ? e.message : 'No se pudo guardar la portada.')
    } finally {
      saving = -1
    }
  }

  async function skip() {
    if (!game || saving >= 0) return
    const current = game // al saltarlo sale de la lista
    try {
      await covers.useColor(current)
      sound.back()
      onToast(`${current.name} queda con su portada de color`)
      if (single) onBack()
    } catch (e) {
      sound.error()
      onToast(e instanceof Error ? e.message : 'No se pudo quitar la portada.')
    }
  }

  /** @type {Array<{ button: import('../lib/ui/input.js').Action, label: string }>} */
  const hints = $derived.by(() => {
    if (!game) return [{ button: 'b', label: 'Volver' }]
    /** @type {Array<{ button: import('../lib/ui/input.js').Action, label: string }>} */
    const list = []
    if (candidates && candidates.length > 0) list.push({ button: 'a', label: 'Usar esta' })
    list.push({ button: 'x', label: 'Dejar la de color' })
    if (pending.length > 1) list.push({ button: 'rb', label: 'Otro juego' })
    list.push({ button: 'b', label: 'Volver' })
    return list
  })

  $effect(() =>
    pushHandler((action) => {
      const col = focus % COLUMNS
      if (action === 'left' && col > 0) move(focus - 1)
      else if (action === 'right' && col < COLUMNS - 1) move(focus + 1)
      else if (action === 'up') move(focus - COLUMNS)
      else if (action === 'down') move(Math.min(focus + COLUMNS, (candidates?.length ?? 1) - 1))
      else if (action === 'lb') switchGame(-1)
      else if (action === 'rb') switchGame(1)
      else if (action === 'a') choose()
      else if (action === 'x') skip()
      else if (action === 'b' && saving < 0) (sound.back(), onBack())
    }),
  )
</script>

<header class="top">
  <button class="back" onclick={() => dispatch('b')}>
    <PadButton name="b" size={30} />
    <Logo size={34} />
  </button>

  <div class="title-pill">
    {#if pending.length > 1}
      <button class="bumper" onclick={() => dispatch('lb')} aria-label="Juego anterior">
        <PadButton name="lb" size={30} />
      </button>
    {/if}
    <span class="pill-text">
      {single ? 'Cambiar portada' : 'Elegir portada'}
      {#if pending.length > 1 || (!single && pending.length > 0)}
        <span class="counter">{Math.min(gameIndex, pending.length - 1) + 1} de {pending.length}</span>
      {/if}
    </span>
    {#if pending.length > 1}
      <button class="bumper" onclick={() => dispatch('rb')} aria-label="Juego siguiente">
        <PadButton name="rb" size={30} />
      </button>
    {/if}
  </div>

  <Clock />
</header>

{#if !game || !platform}
  <section class="done">
    <span class="done-icon"><ChannelIcon id="pick" color="currentColor" size={110} /></span>
    <h1>¡Listo!</h1>
    <p>No quedan portadas por elegir. Cuando agregues juegos, búscalas de nuevo desde Opciones.</p>
  </section>
{:else}
  <section class="detail" style:--tint={platform.color}>
    {#key game.id}
      <div class="detail-cover">
        <CoverArt {game} {platform} width={250} height={330} real />
      </div>
      <h1 class:long={game.name.length > 24}>{game.name}</h1>
      <ul class="chips">
        <li>{platform.shortName}</li>
      </ul>
      <p class="file">{fileName}</p>
      <p class="ask">
        {#if single}
          Elige la portada correcta, o presiona <PadButton name="x" size={28} /> para usar la de color.
        {:else}
          No encontré una portada segura para este archivo. ¿Es alguna de estas?
        {/if}
      </p>
    {/key}
  </section>

  <section class="choices" aria-label="Portadas parecidas" style:--box-w="{box.w}px" style:--box-h="{box.h}px">
    {#if candidates === null}
      {#each { length: 6 } as _, i (i)}
        <div class="card skeleton" style:--tint={platform.color}>
          <span class="image"></span>
          <span class="line"></span>
        </div>
      {/each}
    {:else if candidates.length === 0}
      <div class="nothing">
        <h2>{loadError ? 'No pude cargar las portadas' : 'No encontré portadas parecidas'}</h2>
        <p>{loadError || 'Presiona X para dejarle la portada de color, o cambia el nombre del archivo y vuelve a escanear.'}</p>
      </div>
    {:else}
      {#each candidates as c, i (c.name)}
        <button
          class="card focus-ring"
          class:focused={i === focus}
          style:--tint={platform.color}
          onmouseenter={() => move(i)}
          onclick={() => (i === focus ? choose() : move(i))}
        >
          <span class="image">
            {#if broken.includes(c.url)}
              <span class="no-image">Sin vista previa</span>
            {:else}
              <img
                src={c.url}
                alt={c.title}
                decoding="async"
                onerror={() => (broken = [...broken, c.url])}
              />
            {/if}
            {#if c.region}<span class="region">{c.region}</span>{/if}
            {#if saving === i}
              <span class="saving"><span class="spinner" aria-hidden="true"></span> Guardando…</span>
            {/if}
          </span>
          <span class="name">{c.title}</span>
        </button>
      {/each}
    {/if}
  </section>
{/if}

<HintBar {hints} />

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
    gap: 10px;
    padding: 8px;
    border-radius: 999px;
    background: rgb(var(--glass) / 0.65);
  }
  .bumper {
    padding: 0 8px;
  }
  .pill-text {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 8px 24px 6px;
    border-radius: 999px;
    background: var(--ink);
    color: var(--cloud);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 26px;
  }
  .counter {
    padding: 2px 12px 0;
    border-radius: 999px;
    background: color-mix(in oklab, var(--cloud) 18%, transparent);
    font-size: 22px;
  }

  /* ── Juego ───────────────────────────── */
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
    align-self: flex-start;
  }
  .detail-cover :global(.cover) {
    border-radius: 28px;
  }
  .detail h1 {
    margin: 28px 0 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 52px;
    line-height: 1;
    letter-spacing: -0.02em;
    text-wrap: balance;
  }
  .detail h1.long {
    font-size: 42px;
  }
  .chips {
    display: flex;
    gap: 8px;
    list-style: none;
    margin: 16px 0 0;
    padding: 0;
  }
  .chips li {
    padding: 4px 16px 6px;
    border-radius: 999px;
    background: color-mix(in oklab, var(--tint) 18%, var(--cloud));
    font-weight: 700;
    font-size: 21px;
  }
  .file {
    margin: 16px 0 0;
    padding: 10px 16px;
    border-radius: 16px;
    background: var(--sky);
    font-size: 21px;
    color: var(--ink-soft);
    overflow-wrap: anywhere;
  }
  .ask {
    margin: auto 0 0;
    font-size: 24px;
    line-height: 1.4;
    color: var(--ink-soft);
  }

  /* ── Candidatas ──────────────────────── */
  .choices {
    position: absolute;
    left: 776px;
    right: 112px;
    top: 170px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 48px 40px;
    align-content: start;
  }
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px 16px 18px;
    border-radius: 34px;
    background: var(--cloud);
  }
  .image {
    position: relative;
    display: grid;
    place-items: end center;
    width: 100%;
    height: 260px;
  }
  .image img,
  .no-image {
    width: var(--box-w);
    height: var(--box-h);
    border-radius: 18px;
    object-fit: cover;
    background: color-mix(in oklab, var(--tint) 25%, var(--cloud));
  }
  .no-image {
    display: grid;
    place-items: center;
    font-weight: 700;
    font-size: 20px;
    color: var(--ink-soft);
  }
  .region {
    position: absolute;
    left: 6px;
    bottom: 8px;
    padding: 3px 12px 5px;
    border-radius: 999px;
    background: var(--ink);
    color: var(--cloud);
    font-weight: 700;
    font-size: 18px;
  }
  .saving {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    border-radius: 18px;
    background: color-mix(in oklab, var(--cloud) 82%, transparent);
    font-weight: 700;
    font-size: 22px;
  }
  .name {
    width: 100%;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 22px;
    line-height: 1.15;
    text-align: center;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 2.3em;
  }
  .skeleton .image {
    border-radius: 18px;
    background: color-mix(in oklab, var(--tint) 18%, var(--cloud));
    animation: pulse 900ms ease-in-out infinite alternate;
  }
  .skeleton .line {
    width: 70%;
    height: 22px;
    margin: 6px 0 14px;
    border-radius: 999px;
    background: var(--sky);
  }
  .nothing {
    grid-column: 1 / -1;
    padding: 48px;
    border-radius: 40px;
    background: var(--cloud);
  }
  .nothing h2 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 44px;
  }
  .nothing p {
    margin: 16px 0 0;
    font-size: 26px;
    line-height: 1.45;
    color: var(--ink-soft);
  }
  .spinner {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 5px solid var(--pop-soft);
    border-top-color: var(--pop);
    animation: spin 700ms linear infinite;
  }

  /* ── Terminado ───────────────────────── */
  .done {
    position: absolute;
    left: 112px;
    top: 260px;
    max-width: 1100px;
  }
  .done-icon {
    display: grid;
    place-items: center;
    width: 180px;
    height: 180px;
    border-radius: 50%;
    background: var(--sun);
  }
  .done h1 {
    margin: 36px 0 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 84px;
    line-height: 1;
  }
  .done p {
    margin: 22px 0 0;
    font-size: 30px;
    line-height: 1.5;
    color: var(--ink-soft);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes pulse {
    to {
      opacity: 0.55;
    }
  }
</style>
