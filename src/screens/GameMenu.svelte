<script>
  /**
   * The game menu (Y button): a panel that slides in from the right with what
   * can be done with the focused game. In the library it adds "Sort" and,
   * if the games have ES-DE data, "Filter".
   */
  import { filterLabel, filterOptions, sameFilter } from '../lib/core/filters.js'
  import { getPlatform } from '../lib/core/platforms.js'
  import { SORT_NAMES } from '../lib/core/sorting.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import { collections } from '../lib/ui/collections.svelte.js'
  import CoverArt from '../lib/ui/CoverArt.svelte'
  import { emulators } from '../lib/ui/emulators.svelte.js'
  import { gameInfo } from '../lib/ui/gameInfo.svelte.js'
  import { activeFilters } from '../lib/ui/filters.svelte.js'
  import { plural } from '../lib/ui/format.js'
  import { t } from '../lib/i18n/i18n.svelte.js'
  import HintBar from '../lib/ui/HintBar.svelte'
  import { pushHandler } from '../lib/ui/input.js'
  import { library } from '../lib/ui/library.svelte.js'
  import { settings } from '../lib/ui/settings.svelte.js'
  import { shelf } from '../lib/ui/shelf.svelte.js'
  import { sound } from '../lib/ui/sound.js'
  import TextPrompt from '../lib/ui/TextPrompt.svelte'

  /**
   * @type {{
   *   game: import('../lib/ui/library.svelte.js').LibraryGame,
   *   sortOptions?: import('../lib/core/sorting.js').SortOrder[],
   *   filterChannel?: string,
   *   onClose: () => void,
   *   onLaunch: (game: any) => void,
   *   onChangeCover: (game: any) => void,
   *   onRename: (game: any) => void,
   *   onFindInfo: (game: any) => void,
   *   onSheet?: (game: any) => void,
   *   onToast: (message: string) => void,
   * }}
   *   onSheet: opens the game's sheet (without it, "Game sheet" isn't shown: you're on it)
   *   sortOptions: the orders that make sense in that list (without it, "Sort" isn't shown)
   *   filterChannel: the open library channel (without it, "Filter" isn't shown)
   */
  let { game, sortOptions, filterChannel, onClose, onLaunch, onChangeCover, onRename, onFindInfo, onSheet, onToast } = $props()

  /** @typedef {{ id: string, icon: string, label: string, value?: string, checked?: boolean, disabled?: boolean, tag?: string }} Item */

  /** 'main', the list of collections or the list of emulators */
  let view = $state('main')
  let index = $state(0)
  let naming = $state(false)
  let busy = $state(false)

  const platform = $derived(getPlatform(game.system))
  const favorite = $derived(library.isFavorite(game))
  const inCollections = $derived(collections.namesFor(game))

  // Filters: the genres of that channel's games
  const filterGames = $derived(filterChannel ? shelf.gamesFor(filterChannel) : [])
  const filters = $derived(filterOptions(filterGames))
  const canFilter = $derived(filterChannel !== undefined && filters.genres.length > 0)
  const currentFilter = $derived(filterChannel ? (activeFilters.get(filterChannel) ?? null) : null)

  const emulator = $derived(emulators.forGame(game))
  const consoleEmulator = $derived(emulators.forPlatform(platform))

  /** "Not installed" if the Xbox says it doesn't have it @param {import('../lib/core/platforms.js').Emulator} e */
  const installTag = (e) => (emulators.isInstalled(e) === false ? t('No instalado') : undefined)

  /** @type {Item[]} */
  const mainItems = $derived([
    { id: 'play', icon: 'play', label: t('Jugar'), disabled: !emulator },
    ...(onSheet ? [{ id: 'sheet', icon: 'sheet', label: t('Ver ficha') }] : []),
    // Only if the console has more than one emulator to choose from
    ...(platform && platform.emulators.length > 1
      ? [{ id: 'emulator', icon: 'swap', label: t('Abrir con…'), value: shortName(emulator?.name ?? '') }]
      : []),
    { id: 'favorite', icon: 'favorites', label: favorite ? t('Quitar de favoritos') : t('Agregar a favoritos') },
    {
      id: 'collections',
      icon: 'collections',
      label: t('Colecciones'),
      value:
        inCollections.length === 0
          ? t('Ninguna')
          : inCollections.length === 1
            ? inCollections[0]
            : t('En {n}', { n: inCollections.length }),
    },
    { id: 'cover', icon: 'cover', label: t('Cambiar portada') },
    { id: 'rename', icon: 'rename', label: t('Renombrar archivo…') },
    // Only if it's missing something Wikipedia could give
    ...(gameInfo.canFill(game) ? [{ id: 'info', icon: 'info', label: t('Buscar información…') }] : []),
    { id: 'hide', icon: 'hide', label: t('Ocultar juego') },
    ...(sortOptions
      ? [{ id: 'sort', icon: 'sort', label: t('Ordenar biblioteca'), value: t(SORT_NAMES[settings.sortOrder]) }]
      : []),
    ...(canFilter
      ? [{ id: 'filter', icon: 'filter', label: t('Filtrar'), value: currentFilter ? filterLabel(currentFilter) : t('Todos') }]
      : []),
  ])

  /** All and each genre, with how many games */
  /** @type {Item[]} */
  const filterItems = $derived([
    { id: 'f:all', icon: 'collections', label: t('Todos los juegos'), tag: `${filterGames.length}`, checked: !currentFilter },
    ...filters.genres.map((g) => ({
      id: `f:g:${g.name}`,
      icon: 'filter',
      label: g.name,
      tag: `${g.count}`,
      checked: sameFilter(currentFilter, { kind: 'genre', value: g.name }),
    })),
  ])

  /** @type {Item[]} */
  const collectionItems = $derived([
    { id: 'new', icon: 'plus', label: t('Nueva colección…') },
    ...collections.list.map((c) => ({
      id: `c:${c.name}`,
      icon: 'collections',
      label: c.name,
      checked: inCollections.includes(c.name),
    })),
  ])

  /** Emulators for this game: "Same as the console" and each one on the list */
  /** @type {Item[]} */
  const emulatorItems = $derived([
    {
      id: 'e:',
      icon: platform?.id ?? 'play',
      label: t('Como la consola'),
      tag: consoleEmulator ? t('Ahora: {emulator}', { emulator: consoleEmulator.name }) : undefined,
      checked: !emulators.hasOwn(game),
    },
    ...(platform?.emulators ?? []).map((e) => ({
      id: `e:${e.id}`,
      icon: 'play',
      label: e.name,
      tag: installTag(e) ?? (e.note ? t(e.note) : undefined),
      checked: emulators.hasOwn(game) && emulator?.id === e.id,
    })),
  ])

  const items = $derived(
    view === 'main' ? mainItems : view === 'collections' ? collectionItems : view === 'filters' ? filterItems : emulatorItems,
  )

  /**
   * A short name for the row, which is narrow: "RetroArch · SwanStation" -> "SwanStation".
   * If the console has the same emulator standalone and as a core (PPSSPP, Dolphin,
   * Flycast), the core becomes "PPSSPP (RetroArch)".
   * @param {string} name
   */
  function shortName(name) {
    const short = name.replace(/^RetroArch · /, '')
    if (short === name) return name
    const twin = platform?.emulators.some((e) => e.name === short)
    return twin ? `${short} (RetroArch)` : short
  }

  /** @type {HTMLElement | undefined} */
  let list = $state()
  // With many collections the list scrolls to show the focused one
  $effect(() => {
    index
    list?.querySelector('.item.focused')?.scrollIntoView({ block: 'nearest' })
  })

  /** @param {number} next */
  function move(next) {
    if (next < 0 || next >= items.length || next === index) return
    index = next
    sound.move()
  }

  /** @param {string} next */
  function show(next) {
    view = next
    index = 0
  }

  async function activate() {
    const item = items[index]
    // The game is kept first: when the menu closes, `game` stops existing
    const current = game
    if (!item || busy) return
    if (item.disabled) {
      sound.error()
      onToast(platform?.noEmulatorNote ? t(platform.noEmulatorNote) : t('Este juego todavía no se puede abrir.'))
      return
    }

    if (item.id === 'play') {
      onClose()
      onLaunch(current)
    } else if (item.id === 'favorite') {
      library.toggleFavorite(current)
      sound.favorite()
    } else if (item.id === 'collections') {
      sound.select()
      show('collections')
    } else if (item.id === 'emulator') {
      sound.select()
      show('emulators')
    } else if (item.id.startsWith('e:')) {
      const chosen = item.id.slice(2) || null
      emulators.setGame(current, chosen)
      sound.favorite()
      onToast(
        chosen
          ? t('{game} se abrirá con {emulator}', { game: current.name, emulator: item.label })
          : t('{game} vuelve a abrirse como su consola ({emulator})', {
              game: current.name,
              emulator: shortName(consoleEmulator?.name ?? ''),
            }),
      )
      show('main')
    } else if (item.id === 'cover') {
      sound.select()
      onClose()
      onChangeCover(current)
    } else if (item.id === 'rename') {
      sound.select()
      onClose()
      onRename(current)
    } else if (item.id === 'info') {
      sound.select()
      onClose()
      onFindInfo(current)
    } else if (item.id === 'sheet' && onSheet) {
      sound.select()
      onSheet(current)
    } else if (item.id === 'hide') {
      library.hide(current)
      sound.back()
      onToast(t('{game} quedó oculto. Lo recuperas en Opciones › Biblioteca.', { game: current.name }))
      onClose()
    } else if (item.id === 'sort') {
      settings.cycleSortOrder(sortOptions)
      sound.select()
    } else if (item.id === 'filter') {
      sound.select()
      show('filters')
    } else if (item.id.startsWith('f:') && filterChannel) {
      /** @type {import('../lib/core/filters.js').GameFilter | null} */
      const chosen = item.id === 'f:all' ? null : { kind: 'genre', value: item.id.slice(4) }
      if (chosen) activeFilters.set(filterChannel, chosen)
      else activeFilters.delete(filterChannel)
      sound.favorite()
      onToast(
        chosen
          ? t('Mostrando: {filter} ({games})', { filter: filterLabel(chosen), games: plural(Number(item.tag), 'juego', 'juegos') })
          : t('Mostrando todos los juegos'),
      )
      onClose()
    } else if (item.id === 'new') {
      sound.select()
      naming = true
    } else if (item.id.startsWith('c:')) {
      await run(async () => {
        const name = item.id.slice(2)
        const added = await collections.toggle(current, name)
        onToast(added ? t('Agregado a {collection}', { collection: name }) : t('Quitado de {collection}', { collection: name }))
      })
    }
  }

  /** Saves to the USB drive showing it's busy; if it fails, it says so */
  async function run(/** @type {() => Promise<void>} */ task) {
    busy = true
    try {
      await task()
      sound.favorite()
    } catch (e) {
      sound.error()
      onToast(e instanceof Error ? e.message : t('No se pudo guardar.'))
    } finally {
      busy = false
    }
  }

  /** @param {string} name */
  async function createCollection(name) {
    naming = false
    await run(async () => {
      const saved = await collections.create(name, game)
      onToast(t('Agregado a la colección {collection}', { collection: saved }))
    })
  }

  $effect(() => {
    if (naming) return // the keyboard has the controller
    return pushHandler((action) => {
      if (action === 'up') move(index - 1)
      else if (action === 'down') move(index + 1)
      else if (action === 'a') activate()
      else if (action === 'b') {
        sound.back()
        if (view === 'main') onClose()
        else show('main')
      } else if (action === 'y') (sound.back(), onClose())
    })
  })
</script>

<div class="backdrop" role="presentation" onclick={() => !naming && onClose()}></div>

<aside class="sheet" aria-label={t('Menú del juego')}>
  <header class="game">
    {#if platform}
      <CoverArt {game} {platform} width={112} height={150} showTitle={false} real thumb />
    {/if}
    <div class="game-text">
      <strong class:long={game.name.length > 26}>{game.name}</strong>
      <span class="chip" style:background={platform?.color} style:color={platform?.ink}>{platform?.shortName}</span>
    </div>
  </header>

  {#if view === 'collections'}
    <h3>{t('Colecciones')}</h3>
  {:else if view === 'emulators'}
    <h3>{t('Abrir con')}</h3>
  {:else if view === 'filters'}
    <h3>{t('Filtrar')}</h3>
  {/if}

  <ul class="items" bind:this={list}>
    {#each items as item, i (item.id)}
      <li>
        <button
          class="item"
          class:focused={i === index}
          class:disabled={item.disabled}
          onmouseenter={() => move(i)}
          onclick={() => (i === index ? activate() : move(i))}
        >
          <span class="icon"><ChannelIcon id={item.icon} color="currentColor" size={40} /></span>
          <span class="label" class:small={view === 'emulators'} class:count={view === 'filters'}>
            {item.label}
            {#if item.tag}<small>{item.tag}</small>{/if}
          </span>
          {#if item.checked !== undefined}
            <span class="check" class:on={item.checked} aria-label={item.checked ? t('Elegido') : t('Sin elegir')}>
              {item.checked ? '✓' : ''}
            </span>
          {:else if item.value}
            <span class="value">{item.value}</span>
          {/if}
          {#if busy && i === index}<span class="spinner" aria-hidden="true"></span>{/if}
        </button>
      </li>
    {/each}
  </ul>

  {#if view === 'collections' && collections.list.length === 0}
    <p class="note">{t('Crea tu primera colección: se guarda en el USB y ES-DE también la ve.')}</p>
  {/if}
</aside>

{#if !naming}
  <div class="hints-layer">
    <HintBar
      hints={[
        { button: 'a', label: t('Elegir') },
        { button: 'b', label: view === 'main' ? t('Cerrar') : t('Volver') },
      ]}
    />
  </div>
{/if}

{#if naming}
  <TextPrompt
    title={t('Nueva colección')}
    placeholder={t('Por ejemplo: Con amigos')}
    onSubmit={createCollection}
    onCancel={() => (naming = false)}
  />
{/if}

<style>
  .backdrop {
    position: absolute;
    inset: 0;
    background: rgb(var(--shadow) / 0.4);
    z-index: 10;
    animation: fade 180ms ease both;
  }
  .sheet {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 700px;
    padding: 70px 112px 140px 56px;
    display: flex;
    flex-direction: column;
    background: var(--cloud);
    border-radius: 56px 0 0 56px;
    box-shadow: -30px 0 70px -40px rgb(var(--shadow) / 0.6);
    z-index: 11;
    animation: slide 260ms var(--spring) both;
  }
  .game {
    display: flex;
    align-items: center;
    gap: 26px;
    padding-bottom: 28px;
    border-bottom: 3px solid var(--sky);
  }
  .game :global(.cover) {
    border-radius: 18px;
  }
  .game-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    min-width: 0;
  }
  .game-text strong {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 36px;
    line-height: 1.05;
  }
  .game-text strong.long {
    font-size: 30px;
  }
  .chip {
    padding: 4px 16px 6px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 20px;
  }
  h3 {
    margin: 24px 0 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 30px;
  }
  .items {
    list-style: none;
    margin: 18px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    scrollbar-width: none;
    padding: 4px 0 4px 10px;
    margin-left: -10px;
  }
  .item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 20px;
    height: 78px;
    padding: 0 24px 0 16px;
    border-radius: 26px;
    text-align: left;
    color: var(--ink);
    transition:
      background 140ms ease,
      color 140ms ease,
      transform 160ms var(--spring);
  }
  .item.focused {
    background: var(--ink);
    color: var(--cloud);
    transform: translateX(-8px);
  }
  .item.disabled {
    opacity: 0.5;
  }
  .icon {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: var(--sky);
    color: var(--ink);
    flex: none;
  }
  .item.focused .icon {
    background: var(--pop);
    color: var(--on-color);
  }
  .label {
    flex: 1;
    min-width: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 28px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* emulators: long names ("RetroArch · Mupen64Plus-Next") and their state below */
  .label.small {
    font-size: 24px;
    line-height: 1.15;
  }
  .label small {
    display: block;
    font-family: var(--font-body);
    font-size: 18px;
    opacity: 0.7;
  }
  /* filters: how many games, next to the name */
  .label.count small {
    display: inline;
    margin-left: 10px;
    font-size: 21px;
    font-weight: 700;
  }
  .value {
    max-width: 210px;
    font-weight: 700;
    font-size: 21px;
    opacity: 0.75;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .check {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 12px;
    border: 3px solid currentColor;
    font-weight: 800;
    font-size: 24px;
    opacity: 0.5;
  }
  .check.on {
    background: var(--pop);
    border-color: var(--pop);
    color: var(--on-color);
    opacity: 1;
  }
  .note {
    margin: 18px 8px 0;
    font-size: 22px;
    line-height: 1.4;
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
  .hints-layer {
    position: absolute;
    inset: 0;
    z-index: 11;
    pointer-events: none;
  }
  .hints-layer :global(.hints) {
    pointer-events: auto;
  }
  @keyframes slide {
    from {
      transform: translateX(100%);
    }
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
