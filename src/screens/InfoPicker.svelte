<script>
  /**
   * A game's information from Wikipedia: its description, year, genre, developer
   * and publisher, written in ES-DE's gamelist.xml (nothing already there is
   * replaced). From its menu (Y › Find info…) for one game, or from Options ›
   * Library › Game info: first every console is gone through and the sure
   * matches are saved, then this shows the games where it wasn't sure.
   * A saves the focused one, X leaves the game without information (only in the
   * list) and LB/RB move to the previous or next game.
   */
  import { untrack } from 'svelte'
  import { INFO_FIELD_NAMES, missingInfo } from '../lib/core/gameInfo.js'
  import { getPlatform } from '../lib/core/platforms.js'
  import { listJoin, plural, t, tn } from '../lib/i18n/i18n.svelte.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import Clock from '../lib/ui/Clock.svelte'
  import CoverArt from '../lib/ui/CoverArt.svelte'
  import { gameInfo } from '../lib/ui/gameInfo.svelte.js'
  import HintBar from '../lib/ui/HintBar.svelte'
  import { dispatch, pushHandler } from '../lib/ui/input.js'
  import { library } from '../lib/ui/library.svelte.js'
  import Logo from '../lib/ui/Logo.svelte'
  import PadButton from '../lib/ui/PadButton.svelte'
  import { sound } from '../lib/ui/sound.js'

  /**
   * gameId: a single game (from the Y menu)
   * @type {{ onBack: () => void, onToast: (message: string) => void, gameId?: string }}
   */
  let { onBack, onToast, gameId } = $props()

  /** @typedef {import('../lib/core/gameInfo.js').InfoCandidate} InfoCandidate */

  let gameIndex = $state(0)
  let focus = $state(0)
  /** null while they're being looked for */
  /** @type {InfoCandidate[] | null} */
  let candidates = $state(null)
  /** @type {InfoCandidate | null} */
  let sure = $state(null)
  let loadError = $state('')
  let saving = $state(false)

  const single = $derived(gameId !== undefined)
  const pending = $derived(
    single ? [library.byId.get(/** @type {string} */ (gameId))].filter((g) => g !== undefined) : gameInfo.pending,
  )
  const game = $derived(pending[Math.min(gameIndex, pending.length - 1)])
  const currentId = $derived(game?.id)
  const platform = $derived(game ? getPlatform(game.system) : null)
  const missing = $derived(game ? missingInfo(game) : [])
  const focused = $derived(candidates?.[focus] ?? null)
  const searching = $derived(!single && gameInfo.finding !== null)

  // The list in Options goes through the consoles every time (you may have added games)
  if (!untrack(() => single)) {
    gameInfo.findAll().then((result) => {
      if (!result) return
      if (result.saved > 0) sound.favorite()
      onToast(
        result.failed.length > 0 && result.saved === 0 && result.unsure === 0
          ? t('No pude conectar con Wikipedia. Revisa la conexión a internet de la consola.')
          : t('Guardé la información de {saved}. Quedan {unsure} por elegir.', {
              saved: plural(result.saved, 'juego', 'juegos'),
              unsure: result.unsure,
            }),
      )
    })
  }

  // When the game changes, look for it (by id: the library changes when
  // something is saved, and that's no reason to search again)
  $effect(() => {
    if (!currentId) return
    const current = untrack(() => game)
    if (!current) return
    candidates = null
    sure = null
    loadError = ''
    focus = 0
    let cancelled = false
    gameInfo
      .candidatesFor(current)
      .then((found) => {
        if (cancelled) return
        candidates = found.candidates
        sure = found.match
      })
      .catch((e) => {
        if (cancelled) return
        candidates = []
        loadError = e instanceof Error ? e.message : t('No pude conectar con Wikipedia. Revisa la conexión a internet de la consola.')
      })
    return () => (cancelled = true)
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
    if (saving || next < 0 || next >= pending.length) return
    gameIndex = next
    sound.move()
  }

  async function choose() {
    const candidate = focused
    if (!game || !candidate || saving) return
    const current = game
    saving = true
    sound.select()
    try {
      const added = await gameInfo.save(current, candidate)
      sound.favorite()
      onToast(
        added
          ? t('Información guardada: {game}', { game: candidate.title || current.name })
          : t('{game} ya tenía todo lo que trae Wikipedia', { game: current.name }),
      )
      if (single) onBack()
      // Otherwise, the game leaves the list: the next one stays in the same position
    } catch (e) {
      sound.error()
      onToast(e instanceof Error ? e.message : t('No se pudo guardar.'))
    } finally {
      saving = false
    }
  }

  function skip() {
    if (single || !game || saving) return
    gameInfo.skip(game)
    sound.back()
    onToast(t('{game} queda sin información', { game: game.name }))
  }

  /** The focused candidate's data, as chips */
  const facts = $derived.by(() => {
    if (!focused) return []
    const info = focused.info
    return [
      focused.year ? String(focused.year) : '',
      info.genre ?? '',
      info.developer ?? '',
    ].filter(Boolean)
  })

  /** @type {Array<{ button: import('../lib/ui/input.js').Action, label: string }>} */
  const hints = $derived.by(() => {
    if (!game || searching) return [{ button: 'b', label: t('Volver') }]
    /** @type {Array<{ button: import('../lib/ui/input.js').Action, label: string }>} */
    const list = []
    if (candidates && candidates.length > 0) list.push({ button: 'a', label: t('Guardar') })
    if (!single) list.push({ button: 'x', label: t('Dejar sin información') })
    if (pending.length > 1) list.push({ button: 'rb', label: t('Otro juego') })
    list.push({ button: 'b', label: t('Volver') })
    return list
  })

  $effect(() =>
    pushHandler((action) => {
      if (action === 'up') move(focus - 1)
      else if (action === 'down') move(focus + 1)
      else if (action === 'lb') switchGame(-1)
      else if (action === 'rb') switchGame(1)
      else if (action === 'a') choose()
      else if (action === 'x') skip()
      else if (action === 'b' && !saving) (sound.back(), onBack())
    }),
  )
</script>

<header class="top">
  <button class="back" onclick={() => dispatch('b')}>
    <PadButton name="b" size={30} />
    <Logo size={34} />
  </button>

  <div class="title-pill">
    {#if pending.length > 1 && !searching}
      <button class="bumper" onclick={() => dispatch('lb')} aria-label={t('Juego anterior')}>
        <PadButton name="lb" size={30} />
      </button>
    {/if}
    <span class="pill-text">
      {single ? t('Información del juego') : t('Información de los juegos')}
      {#if !single && !searching && pending.length > 0}
        <span class="counter">{t('{n} de {total}', { n: Math.min(gameIndex, pending.length - 1) + 1, total: pending.length })}</span>
      {/if}
    </span>
    {#if pending.length > 1 && !searching}
      <button class="bumper" onclick={() => dispatch('rb')} aria-label={t('Juego siguiente')}>
        <PadButton name="rb" size={30} />
      </button>
    {/if}
  </div>

  <Clock />
</header>

{#if searching}
  <section class="done">
    <span class="done-icon"><span class="spinner big" aria-hidden="true"></span></span>
    <h1>{t('Buscando información…')}</h1>
    <p>
      {gameInfo.finding?.console
        ? t('Comparo tus juegos con Wikidata: {console} ({n} de {total} consolas).', {
            console: gameInfo.finding.console,
            n: (gameInfo.finding?.done ?? 0) + 1,
            total: gameInfo.finding?.total ?? 0,
          })
        : t('Comparo tus juegos con Wikidata.')}
    </p>
    <p class="small">{t('Lo que encuentre seguro se guarda solo; después eliges los demás.')}</p>
  </section>
{:else if !game || !platform}
  {@const result = gameInfo.result}
  <section class="done">
    <span class="done-icon"><ChannelIcon id="info" color="currentColor" size={110} /></span>
    <h1>{t('¡Listo!')}</h1>
    {#if single}
      <p>{t('Ese juego ya no está en la biblioteca.')}</p>
    {:else if result}
      <p>
        {result.saved > 0
          ? t('Guardé la información de {saved} en sus gamelist.xml.', { saved: plural(result.saved, 'juego', 'juegos') })
          : t('No había información nueva que guardar.')}
      </p>
      {#if result.notFound > 0}
        <p class="small">
          {tn(
            result.notFound,
            '{n} juego no está en Wikidata con ese nombre: búscalo con Y › Buscar información…',
            '{n} juegos no están en Wikidata con ese nombre: búscalos uno por uno con Y › Buscar información…',
          )}
        </p>
      {/if}
      {#if result.failed.length > 0}
        <p class="small failed">
          {t('No pude buscar en {consoles}: revisa la conexión a internet y vuelve a entrar.', {
            consoles: listJoin(gameInfo.consoleNames(result.failed)),
          })}
        </p>
      {/if}
    {/if}
  </section>
{:else}
  <section class="detail" style:--tint={platform.color}>
    {#key game.id}
      <div class="detail-cover">
        <CoverArt {game} {platform} width={180} height={240} real />
      </div>
      <h1 class:long={game.name.length > 24}>{game.name}</h1>
      <ul class="chips">
        <li>{platform.shortName}</li>
      </ul>
      <p class="label">{t('Le falta')}</p>
      <ul class="missing">
        {#each missing as field (field)}<li>{t(INFO_FIELD_NAMES[field])}</li>{/each}
      </ul>
      <p class="label">{t('Archivo')}</p>
      <p class="file">{game.path.split('/').pop()}</p>
      <p class="ask">
        {#if sure}
          {t('Encontré este juego en Wikipedia. Solo se agrega lo que le falta: no se reemplaza nada.')}
        {:else if single}
          {t('Elige cuál es. Solo se agrega lo que le falta: no se reemplaza nada.')}
        {:else}
          {t('No estuve seguro de cuál es este juego. ¿Es alguno de estos?')}
        {/if}
      </p>
    {/key}
  </section>

  <section class="choices" aria-label={t('Resultados de Wikipedia')}>
    {#if candidates === null}
      {#each { length: 4 } as _, i (i)}
        <div class="row skeleton"><span class="line"></span><span class="line short"></span></div>
      {/each}
      <p class="wait">{t('Buscando en Wikipedia…')}</p>
    {:else if candidates.length === 0}
      <div class="nothing">
        <h2>{loadError ? t('No pude buscar') : t('No encontré este juego')}</h2>
        <p>
          {loadError || t('Puede ser un juego casero, un hack o una traducción, o tener otro nombre en Wikipedia.')}
        </p>
      </div>
    {:else}
      {#each candidates as c, i (c.id)}
        <button
          class="row focus-ring"
          class:focused={i === focus}
          style:--tint={platform.color}
          onmouseenter={() => move(i)}
          onclick={() => (i === focus ? choose() : move(i))}
        >
          <span class="title">{c.title || c.id}</span>
          <span class="meta">
            {#if c.id === sure?.id}<span class="sure">{t('Coincide')}</span>{/if}
            {c.summary || (c.year ?? '')}
          </span>
          {#if saving && i === focus}<span class="spinner" aria-hidden="true"></span>{/if}
        </button>
      {/each}
    {/if}
  </section>

  {#if focused}
    <section class="preview" aria-label={focused.title}>
      <h2>{focused.title || focused.id}</h2>
      {#if facts.length > 0}
        <ul class="facts">
          {#each facts as fact (fact)}<li>{fact}</li>{/each}
        </ul>
      {/if}
      {#if focused.info.desc}
        <p class="desc">{focused.info.desc}</p>
      {:else}
        <p class="desc empty">{t('Sin artículo en Wikipedia: solo los datos de Wikidata (año, género…).')}</p>
      {/if}
    </section>
  {/if}
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

  /* ── Game ────────────────────────────── */
  .detail {
    position: absolute;
    left: 112px;
    top: 170px;
    width: 560px;
    height: 790px;
    padding: 36px 40px 34px;
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
    border-radius: 24px;
  }
  .detail h1 {
    margin: 22px 0 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 46px;
    line-height: 1;
    letter-spacing: -0.02em;
    text-wrap: balance;
  }
  .detail h1.long {
    font-size: 38px;
  }
  .chips,
  .missing,
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    list-style: none;
    margin: 14px 0 0;
    padding: 0;
  }
  .chips li,
  .missing li,
  .facts li {
    padding: 4px 16px 6px;
    border-radius: 999px;
    background: color-mix(in oklab, var(--tint, var(--pop)) 18%, var(--cloud));
    font-weight: 700;
    font-size: 20px;
  }
  .missing {
    margin-top: 8px;
  }
  .missing li {
    background: var(--sky);
    font-weight: 600;
  }
  .label {
    margin: 18px 0 0;
    font-weight: 700;
    font-size: 19px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .file {
    margin: 6px 0 0;
    padding: 10px 16px;
    border-radius: 16px;
    background: var(--sky);
    font-size: 21px;
    line-height: 1.3;
    color: var(--ink-soft);
    overflow-wrap: anywhere;
  }
  .ask {
    margin: auto 0 0;
    padding-top: 14px;
    font-size: 23px;
    line-height: 1.4;
    color: var(--ink-soft);
  }

  /* ── Results ─────────────────────────── */
  .choices {
    position: absolute;
    left: 712px;
    top: 170px;
    width: 470px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .row {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 18px 26px 20px;
    border-radius: 28px;
    background: var(--cloud);
    text-align: left;
  }
  .row .title {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 26px;
    line-height: 1.15;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .row .meta {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 20px;
    color: var(--ink-soft);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sure {
    flex: none;
    padding: 2px 12px 4px;
    border-radius: 999px;
    background: var(--pop);
    color: var(--on-color);
    font-weight: 700;
    font-size: 17px;
  }
  .row .spinner {
    position: absolute;
    right: 22px;
    top: 50%;
    margin-top: -13px;
  }
  .skeleton {
    height: 96px;
    justify-content: center;
    gap: 12px;
  }
  .skeleton .line {
    width: 70%;
    height: 22px;
    border-radius: 999px;
    background: var(--sky);
    animation: pulse 900ms ease-in-out infinite alternate;
  }
  .skeleton .line.short {
    width: 40%;
    height: 16px;
  }
  .wait {
    margin: 8px 10px 0;
    font-size: 22px;
    color: var(--ink-soft);
  }
  .nothing {
    padding: 36px 40px;
    border-radius: 36px;
    background: var(--cloud);
  }
  .nothing h2 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 36px;
  }
  .nothing p {
    margin: 12px 0 0;
    font-size: 23px;
    line-height: 1.45;
    color: var(--ink-soft);
  }

  .preview {
    position: absolute;
    left: 1214px;
    right: 112px;
    top: 170px;
    height: 790px;
    padding: 34px 38px;
    display: flex;
    flex-direction: column;
    border-radius: 48px;
    background: var(--cloud);
    box-shadow: 0 30px 60px -40px rgb(var(--shadow) / 0.5);
  }
  .preview h2 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 34px;
    line-height: 1.1;
  }
  .facts li {
    font-size: 18px;
  }
  .desc {
    margin: 18px 0 0;
    font-size: 20px;
    line-height: 1.5;
    white-space: pre-line;
    display: -webkit-box;
    -webkit-line-clamp: 15;
    line-clamp: 15;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .desc.empty {
    color: var(--ink-soft);
  }
  .spinner {
    display: inline-block;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 5px solid var(--pop-soft);
    border-top-color: var(--pop);
    animation: spin 700ms linear infinite;
  }
  .spinner.big {
    width: 84px;
    height: 84px;
    border-width: 12px;
  }

  /* ── Finished ────────────────────────── */
  .done {
    position: absolute;
    left: 112px;
    top: 260px;
    max-width: 1200px;
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
  .done p.small {
    font-size: 25px;
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
