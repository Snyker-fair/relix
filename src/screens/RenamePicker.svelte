<script>
  /**
   * Giving a game's file its standard name (the Redump / No-Intro names that
   * libretro uses too), from its menu (Y › Rename file…) or, from Options ›
   * Library › File names, for every game whose file doesn't have one.
   * A uses the focused name, Y types one, X keeps the name as it is (only in
   * the list) and LB/RB move to the previous or next game. Before renaming,
   * a window says what moves with it.
   */
  import { untrack } from 'svelte'
  import { getPlatform, PLATFORMS } from '../lib/core/platforms.js'
  import { MAX_NAME_LENGTH, renameTarget } from '../lib/core/rename.js'
  import { listJoin, plural, t } from '../lib/i18n/i18n.svelte.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import Clock from '../lib/ui/Clock.svelte'
  import CoverArt from '../lib/ui/CoverArt.svelte'
  import HintBar from '../lib/ui/HintBar.svelte'
  import { dispatch, pushHandler } from '../lib/ui/input.js'
  import { library } from '../lib/ui/library.svelte.js'
  import Logo from '../lib/ui/Logo.svelte'
  import PadButton from '../lib/ui/PadButton.svelte'
  import { renamer } from '../lib/ui/renamer.svelte.js'
  import { sound } from '../lib/ui/sound.js'
  import TextPrompt from '../lib/ui/TextPrompt.svelte'

  /**
   * gameId: rename a single game (from the Y menu), whatever its name is
   * @type {{ onBack: () => void, onToast: (message: string) => void, gameId?: string }}
   */
  let { onBack, onToast, gameId } = $props()

  /** @typedef {import('../lib/ui/renamer.svelte.js').PreparedRename & { name: string }} Confirming */

  const COLUMNS = 3
  /** Each suggestion's cover space (the whole box fits, with its console's shape) */
  const BOX_W = 230
  const BOX_H = 210

  /** The game from its menu: its id changes when it's renamed */
  let singleId = $state(untrack(() => gameId))
  let gameIndex = $state(0)
  let focus = $state(0)
  /** null while they're being looked for */
  let suggestions = $state(/** @type {import('../lib/ui/renamer.svelte.js').NameSuggestion[] | null} */ (null))
  let loadError = $state('')
  /** The keyboard is open */
  let typing = $state(false)
  /** The window before renaming */
  /** @type {Confirming | null} */
  let confirming = $state(null)
  /** 'prepare' while asking the USB drive what would move, 'rename' while renaming */
  let busy = $state('')
  /** Images that didn't load */
  /** @type {string[]} */
  let broken = $state([])

  const single = $derived(gameId !== undefined)
  const pending = $derived(
    single ? [library.byId.get(/** @type {string} */ (singleId))].filter((g) => g !== undefined) : renamer.pending,
  )
  const game = $derived(pending[Math.min(gameIndex, pending.length - 1)])
  const currentId = $derived(game?.id)
  const platform = $derived(game ? getPlatform(game.system) : null)
  const target = $derived(game ? renameTarget(game) : null)
  const folder = $derived(target?.kind === 'folder')
  /** The suggestions and, last, "Type the name…" */
  const cards = $derived(suggestions === null ? 0 : suggestions.length + 1)
  const onTypeCard = $derived(suggestions !== null && focus === suggestions.length)
  const searching = $derived(!single && renamer.reviewing !== null)
  /** Not one console's list could be read (without internet) */
  const allFailed = $derived(
    renamer.reviewFailed.length > 0 &&
      renamer.reviewFailed.length >= PLATFORMS.filter((p) => library.gamesFor(p.id).length > 0).length,
  )

  /** How a name looks on the USB drive: with its extension, or as a folder */
  function shown(/** @type {string} */ name) {
    return target?.kind === 'file' ? `${name}${target.extension}` : name
  }

  // The list in Options is looked up again every time (you may have added games)
  if (!untrack(() => single)) renamer.findReview()

  // When the game changes, look for its names (by id: the library changes
  // when one is renamed, and that's no reason to search again)
  $effect(() => {
    if (!currentId) return
    const current = untrack(() => game)
    if (!current) return
    suggestions = null
    loadError = ''
    focus = 0
    let cancelled = false
    renamer
      .suggestionsFor(current)
      .then((list) => !cancelled && (suggestions = list))
      .catch((e) => {
        if (cancelled) return
        suggestions = []
        loadError = e instanceof Error ? e.message : t('No se pudieron cargar los nombres.')
      })
    return () => (cancelled = true)
  })

  /** The size of a suggestion's box, according to its console's shape */
  const box = $derived.by(() => {
    const aspect = platform?.coverAspect ?? 0.71
    return BOX_W / BOX_H > aspect
      ? { w: Math.round(BOX_H * aspect), h: BOX_H }
      : { w: BOX_W, h: Math.round(BOX_W / aspect) }
  })

  /** @type {HTMLElement | undefined} */
  let grid = $state()
  // A third row scrolls: the focused card stays in view
  $effect(() => {
    focus
    grid?.querySelector('.card.focused')?.scrollIntoView({ block: 'nearest' })
  })

  /** @param {number} next */
  function move(next) {
    if (next < 0 || next >= cards || next === focus) return
    focus = next
    sound.move()
  }

  /** @param {number} delta */
  function switchGame(delta) {
    const next = Math.min(gameIndex, pending.length - 1) + delta
    if (busy || next < 0 || next >= pending.length) return
    gameIndex = next
    sound.move()
  }

  function choose() {
    if (!suggestions || busy) return
    const suggestion = suggestions[focus]
    if (suggestion) prepare(suggestion.name)
    else type()
  }

  function type() {
    if (!game || busy) return
    sound.select()
    typing = true
  }

  /** What would move with the new name: the window to confirm @param {string} name */
  async function prepare(name) {
    if (!game || busy) return
    const current = game
    busy = 'prepare'
    sound.select()
    try {
      confirming = { ...(await renamer.prepare(current, name)), name: name.trim() }
    } catch (e) {
      sound.error()
      onToast(e instanceof Error ? e.message : t('No se pudo renombrar.'))
    } finally {
      busy = ''
    }
  }

  async function rename() {
    if (!game || !confirming || busy) return
    const current = game
    const { plan, name } = confirming
    busy = 'rename'
    try {
      const result = await renamer.rename(current, plan)
      sound.favorite()
      onToast(
        result.failed > 0
          ? t('Renombrado: {name}. Algo no se pudo mover: mira el registro en Opciones › Revisión.', { name: shown(name) })
          : t('Renombrado: {name}', { name: shown(name) }),
      )
      confirming = null
      if (single) {
        singleId = result.id
        onBack()
      }
      // Otherwise, the game leaves the list: the next one stays in the same position
    } catch (e) {
      sound.error()
      onToast(e instanceof Error ? e.message : t('No se pudo renombrar.'))
    } finally {
      busy = ''
    }
  }

  function keep() {
    if (single || !game || busy) return
    renamer.skip(game)
    sound.back()
    onToast(t('{game} queda con el nombre que tiene', { game: game.name }))
  }

  /** What moves with the name, for the window */
  const moving = $derived.by(() => {
    if (!confirming) return []
    const { preview, collections } = confirming
    const list = [t('Lo tuyo en Relix: tiempo de juego, favoritos y portada')]
    if (preview.media > 0) list.push(plural(preview.media, 'imagen de ES-DE', 'imágenes de ES-DE'))
    if (preview.gamelist > 0) list.push(t('Su ficha en gamelist.xml'))
    if (preview.saves > 0) list.push(plural(preview.saves, 'partida de RetroArch', 'partidas de RetroArch'))
    if (collections > 0) list.push(plural(collections, 'colección', 'colecciones'))
    return list
  })

  /** @type {Array<{ button: import('../lib/ui/input.js').Action, label: string }>} */
  const hints = $derived.by(() => {
    if (!game) return [{ button: 'b', label: t('Volver') }]
    /** @type {Array<{ button: import('../lib/ui/input.js').Action, label: string }>} */
    const list = []
    if (suggestions !== null) list.push({ button: 'a', label: onTypeCard ? t('Escribir') : t('Usar este') })
    list.push({ button: 'y', label: t('Escribir el nombre') })
    if (!single) list.push({ button: 'x', label: t('Dejar como está') })
    if (pending.length > 1) list.push({ button: 'rb', label: t('Otro juego') })
    list.push({ button: 'b', label: t('Volver') })
    return list
  })

  $effect(() => {
    if (typing || confirming) return // the keyboard or the window has the controller
    return pushHandler((action) => {
      const col = focus % COLUMNS
      if (action === 'left' && col > 0) move(focus - 1)
      else if (action === 'right' && col < COLUMNS - 1) move(focus + 1)
      else if (action === 'up') move(focus - COLUMNS)
      else if (action === 'down') move(Math.min(focus + COLUMNS, cards - 1))
      else if (action === 'lb') switchGame(-1)
      else if (action === 'rb') switchGame(1)
      else if (action === 'a') choose()
      else if (action === 'y') type()
      else if (action === 'x') keep()
      else if (action === 'b' && !busy) (sound.back(), onBack())
    })
  })

  $effect(() => {
    if (!confirming) return
    return pushHandler((action) => {
      if (action === 'a') rename()
      else if (action === 'b' && !busy) (sound.back(), (confirming = null))
    })
  })
</script>

<header class="top">
  <button class="back" onclick={() => dispatch('b')}>
    <PadButton name="b" size={30} />
    <Logo size={34} />
  </button>

  <div class="title-pill">
    {#if pending.length > 1}
      <button class="bumper" onclick={() => dispatch('lb')} aria-label={t('Juego anterior')}>
        <PadButton name="lb" size={30} />
      </button>
    {/if}
    <span class="pill-text">
      {single ? t('Renombrar archivo') : t('Nombres de archivo')}
      {#if !single && pending.length > 0}
        <span class="counter">{t('{n} de {total}', { n: Math.min(gameIndex, pending.length - 1) + 1, total: pending.length })}</span>
      {/if}
    </span>
    {#if pending.length > 1}
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
    <h1>{t('Revisando nombres…')}</h1>
    <p>
      {t('Comparo cada archivo con los nombres estándar de libretro: {n} de {total} consolas.', {
        n: renamer.reviewing?.done ?? 0,
        total: renamer.reviewing?.total ?? 0,
      })}
    </p>
  </section>
{:else if !game || !platform || !target}
  <section class="done">
    <span class="done-icon"><ChannelIcon id="rename" color="currentColor" size={110} /></span>
    <h1>{!single && allFailed ? t('No pude revisar') : t('¡Listo!')}</h1>
    {#if single || !allFailed}
      <p>
        {single
          ? t('Ese juego ya no está en la biblioteca.')
          : t('No quedan archivos por renombrar: los demás ya tienen su nombre estándar o no aparecen en las listas de libretro.')}
      </p>
    {/if}
    {#if !single && renamer.reviewFailed.length > 0}
      <p class="failed">
        {t('No pude leer las listas de {consoles}: revisa la conexión a internet y vuelve a entrar.', {
          consoles: listJoin(renamer.reviewFailed.map((id) => getPlatform(id)?.shortName ?? id)),
        })}
      </p>
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
        {#if folder}<li>{t('Juego en carpeta')}</li>{/if}
      </ul>
      <p class="label">{folder ? t('Carpeta') : t('Archivo')}</p>
      <p class="file">{shown(target.name)}</p>
      <p class="label">{t('Nuevo nombre')}</p>
      <p class="file new" class:empty={!suggestions?.[focus]}>
        {suggestions?.[focus] ? shown(suggestions[focus].name) : t('El que escribas')}
      </p>
      <p class="ask">
        {#if single}
          {t('Elige su nombre estándar o presiona')} <PadButton name="y" size={28} /> {t('para escribirlo.')}
        {:else}
          {t('Este archivo no tiene su nombre estándar. ¿Es alguno de estos?')}
        {/if}
      </p>
    {/key}
  </section>

  <section
    class="choices"
    aria-label={t('Nombres estándar')}
    style:--box-w="{box.w}px"
    style:--box-h="{box.h}px"
    bind:this={grid}
  >
    {#if suggestions === null}
      {#each { length: 6 } as _, i (i)}
        <div class="card skeleton" style:--tint={platform.color}>
          <span class="image"></span>
          <span class="line"></span>
        </div>
      {/each}
    {:else}
      {#if suggestions.length === 0}
        <div class="nothing">
          <h2>{loadError ? t('No pude cargar los nombres') : t('No encontré su nombre estándar')}</h2>
          <p>
            {loadError ||
              t('Puede ser un juego casero, un hack o una traducción. Si sabes cómo se llama, escríbelo.')}
          </p>
        </div>
      {/if}
      {#each suggestions as s, i (s.name)}
        <button
          class="card focus-ring"
          class:focused={i === focus}
          style:--tint={platform.color}
          onmouseenter={() => move(i)}
          onclick={() => (i === focus ? choose() : move(i))}
        >
          <span class="image">
            {#if broken.includes(s.url)}
              <span class="no-image">{t('Sin vista previa')}</span>
            {:else}
              <img src={s.url} alt={s.title} decoding="async" onerror={() => (broken = [...broken, s.url])} />
            {/if}
            {#if s.region}<span class="region">{s.region}</span>{/if}
            {#if busy === 'prepare' && i === focus}
              <span class="saving"><span class="spinner" aria-hidden="true"></span></span>
            {/if}
          </span>
          <span class="name">{s.name}</span>
        </button>
      {/each}
      <button
        class="card type focus-ring"
        class:focused={onTypeCard}
        style:--tint={platform.color}
        onmouseenter={() => move(suggestions?.length ?? 0)}
        onclick={() => (onTypeCard ? type() : move(suggestions?.length ?? 0))}
      >
        <span class="image">
          <span class="type-icon"><ChannelIcon id="rename" color="currentColor" size={84} /></span>
        </span>
        <span class="name">{t('Escribir el nombre…')}</span>
      </button>
    {/if}
  </section>
{/if}

{#if confirming && target}
  {@const files = confirming.plan.files.length}
  <div class="backdrop">
    <section class="confirm" aria-label={folder ? t('¿Renombrar la carpeta?') : t('¿Renombrar el archivo?')}>
      <h2>{folder ? t('¿Renombrar la carpeta?') : t('¿Renombrar el archivo?')}</h2>
      <p class="label">{t('Ahora')}</p>
      <p class="file">{shown(target.name)}</p>
      <p class="label">{t('Queda')}</p>
      <p class="file new">{shown(confirming.name)}</p>
      {#if files > 1}
        <p class="note">{t('Y sus {n} discos, cada uno con su número.', { n: files })}</p>
      {/if}
      <p class="label">{t('Se mueve con el nombre')}</p>
      <ul class="moving">
        {#each moving as line (line)}<li>{line}</li>{/each}
      </ul>
      {#if confirming.retroarch && !confirming.preview.savesFolder}
        <p class="warn">
          {t('Las partidas de RetroArch no están en el USB, así que no puedo moverlas: si tienes alguna de este juego, RetroArch no la encontrará con el nombre nuevo.')}
        </p>
      {/if}
      {#if busy === 'rename'}
        <p class="working"><span class="spinner" aria-hidden="true"></span> {t('Renombrando…')}</p>
      {/if}
    </section>

    <HintBar
      surface
      hints={[
        { button: 'a', label: t('Renombrar') },
        { button: 'b', label: t('Cancelar') },
      ]}
    />
  </div>
{/if}

{#if typing && game}
  {@const current = game}
  <TextPrompt
    file
    title={folder ? t('Nombre de la carpeta') : t('Nombre del archivo')}
    placeholder={t('Por ejemplo: Kingdom Hearts II (USA)')}
    initial={suggestions?.[focus]?.name ?? target?.name ?? ''}
    maxLength={MAX_NAME_LENGTH}
    check={(value) => renamer.check(current, value)}
    onSubmit={(value) => {
      typing = false
      prepare(value)
    }}
    onCancel={() => (typing = false)}
  />
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
    width: 600px;
    height: 790px;
    padding: 36px 44px 34px;
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
  .chips {
    display: flex;
    gap: 8px;
    list-style: none;
    margin: 14px 0 0;
    padding: 0;
  }
  .chips li {
    padding: 4px 16px 6px;
    border-radius: 999px;
    background: color-mix(in oklab, var(--tint) 18%, var(--cloud));
    font-weight: 700;
    font-size: 20px;
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
  .file.new {
    background: color-mix(in oklab, var(--pop) 14%, var(--cloud));
    color: var(--ink);
    font-weight: 700;
  }
  .file.new.empty {
    font-weight: 400;
    color: var(--ink-soft);
  }
  .ask {
    margin: auto 0 0;
    padding-top: 14px;
    font-size: 23px;
    line-height: 1.4;
    color: var(--ink-soft);
  }

  /* ── Names ───────────────────────────── */
  /* the room for the focus ring is padding: the grid scrolls without cutting it,
     and a third row fades out at the bottom */
  .choices {
    position: absolute;
    left: 752px;
    right: 88px;
    top: 134px;
    bottom: 140px;
    padding: 36px 24px 34px;
    mask-image: linear-gradient(to bottom, #000 calc(100% - 30px), transparent);
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 48px 40px;
    align-content: start;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px 16px 18px;
    border-radius: 34px;
    background: var(--cloud);
    scroll-margin: 36px 24px 34px;
  }
  .image {
    position: relative;
    display: grid;
    place-items: end center;
    width: 100%;
    height: 210px;
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
    display: grid;
    place-items: center;
    border-radius: 18px;
    background: color-mix(in oklab, var(--cloud) 70%, transparent);
  }
  .name {
    width: 100%;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 20px;
    line-height: 1.15;
    text-align: center;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 3.45em;
  }
  .type .image {
    place-items: center;
  }
  .type-icon {
    display: grid;
    place-items: center;
    width: 150px;
    height: 150px;
    border-radius: 50%;
    background: var(--sky);
    color: var(--ink);
  }
  .type.focused .type-icon {
    background: var(--pop);
    color: var(--on-color);
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
    padding: 40px 48px;
    border-radius: 40px;
    background: var(--cloud);
  }
  .nothing h2 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 40px;
  }
  .nothing p {
    margin: 14px 0 0;
    font-size: 25px;
    line-height: 1.45;
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

  /* ── Confirm ─────────────────────────── */
  .backdrop {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgb(var(--shadow) / 0.45);
    z-index: 12;
    animation: fade 160ms ease both;
  }
  .confirm {
    width: 900px;
    padding: 44px 52px 48px;
    border-radius: 48px;
    background: var(--cloud);
    box-shadow: 0 40px 80px -40px rgb(var(--shadow) / 0.7);
    animation: pop 260ms var(--spring) both;
  }
  .confirm h2 {
    margin: 0 0 6px;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 44px;
  }
  .confirm .file {
    font-size: 24px;
  }
  .note {
    margin: 12px 0 0;
    font-size: 22px;
    color: var(--ink-soft);
  }
  .moving {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
  }
  .moving li {
    padding: 6px 16px 8px;
    border-radius: 999px;
    background: var(--sky);
    font-weight: 700;
    font-size: 20px;
  }
  .warn {
    margin: 22px 0 0;
    padding: 14px 20px;
    border-radius: 20px;
    background: color-mix(in oklab, var(--sun) 35%, var(--cloud));
    font-size: 21px;
    line-height: 1.4;
  }
  .working {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 22px 0 0;
    font-weight: 700;
    font-size: 22px;
  }

  /* ── Finished ────────────────────────── */
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
  .done p.failed {
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
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @keyframes pop {
    from {
      transform: scale(0.92);
    }
  }
</style>
