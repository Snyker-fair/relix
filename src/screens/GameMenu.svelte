<script>
  /**
   * Menú del juego (botón Y): un panel que entra por la derecha con lo que
   * se puede hacer con el juego enfocado. En la biblioteca suma "Ordenar" y,
   * si los juegos traen datos de ES-DE, "Filtrar".
   */
  import { filterLabel, filterOptions, sameFilter } from '../lib/core/filters.js'
  import { getPlatform } from '../lib/core/platforms.js'
  import { SORT_NAMES } from '../lib/core/sorting.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import { collections } from '../lib/ui/collections.svelte.js'
  import CoverArt from '../lib/ui/CoverArt.svelte'
  import { emulators } from '../lib/ui/emulators.svelte.js'
  import { activeFilters } from '../lib/ui/filters.svelte.js'
  import { plural } from '../lib/ui/format.js'
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
   *   onToast: (message: string) => void,
   * }}
   *   sortOptions: órdenes que tienen sentido en esa lista (sin él, no se muestra "Ordenar")
   *   filterChannel: canal de la biblioteca abierta (sin él, no se muestra "Filtrar")
   */
  let { game, sortOptions, filterChannel, onClose, onLaunch, onChangeCover, onToast } = $props()

  /** @typedef {{ id: string, icon: string, label: string, value?: string, checked?: boolean, disabled?: boolean, tag?: string }} Item */

  /** 'main', la lista de colecciones o la de emuladores */
  let view = $state('main')
  let index = $state(0)
  let naming = $state(false)
  let busy = $state(false)

  const platform = $derived(getPlatform(game.system))
  const favorite = $derived(library.isFavorite(game))
  const inCollections = $derived(collections.namesFor(game))

  // Filtros: los géneros y "2 o más jugadores" de los juegos de ese canal
  const filterGames = $derived(filterChannel ? shelf.gamesFor(filterChannel) : [])
  const filters = $derived(filterOptions(filterGames))
  const canFilter = $derived(filterChannel !== undefined && (filters.genres.length > 0 || filters.multiplayer > 0))
  const currentFilter = $derived(filterChannel ? (activeFilters.get(filterChannel) ?? null) : null)

  const emulator = $derived(emulators.forGame(game))
  const consoleEmulator = $derived(emulators.forPlatform(platform))

  /** "No instalado" si la Xbox dice que no lo tiene @param {import('../lib/core/platforms.js').Emulator} e */
  const installTag = (e) => (emulators.isInstalled(e) === false ? 'No instalado' : undefined)

  /** @type {Item[]} */
  const mainItems = $derived([
    { id: 'play', icon: 'play', label: 'Jugar', disabled: !emulator },
    // Solo si la consola tiene más de un emulador para elegir
    ...(platform && platform.emulators.length > 1
      ? [{ id: 'emulator', icon: 'swap', label: 'Abrir con…', value: shortName(emulator?.name ?? '') }]
      : []),
    { id: 'favorite', icon: 'favorites', label: favorite ? 'Quitar de favoritos' : 'Agregar a favoritos' },
    {
      id: 'collections',
      icon: 'collections',
      label: 'Colecciones',
      value: inCollections.length === 0 ? 'Ninguna' : inCollections.length === 1 ? inCollections[0] : `En ${inCollections.length}`,
    },
    { id: 'cover', icon: 'cover', label: 'Cambiar portada' },
    { id: 'hide', icon: 'hide', label: 'Ocultar juego' },
    ...(sortOptions
      ? [{ id: 'sort', icon: 'sort', label: 'Ordenar biblioteca', value: SORT_NAMES[settings.sortOrder] }]
      : []),
    ...(canFilter
      ? [{ id: 'filter', icon: 'filter', label: 'Filtrar', value: currentFilter ? filterLabel(currentFilter) : 'Todos' }]
      : []),
  ])

  /** Todos, 2 o más jugadores y cada género, con cuántos juegos */
  /** @type {Item[]} */
  const filterItems = $derived([
    { id: 'f:all', icon: 'collections', label: 'Todos los juegos', tag: `${filterGames.length}`, checked: !currentFilter },
    ...(filters.multiplayer > 0
      ? [{ id: 'f:players', icon: 'gamepad', label: '2 o más jugadores', tag: `${filters.multiplayer}`, checked: currentFilter?.kind === 'players' }]
      : []),
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
    { id: 'new', icon: 'plus', label: 'Nueva colección…' },
    ...collections.list.map((c) => ({
      id: `c:${c.name}`,
      icon: 'collections',
      label: c.name,
      checked: inCollections.includes(c.name),
    })),
  ])

  /** Emuladores para este juego: "Como la consola" y cada uno de la lista */
  /** @type {Item[]} */
  const emulatorItems = $derived([
    {
      id: 'e:',
      icon: platform?.id ?? 'play',
      label: 'Como la consola',
      tag: consoleEmulator ? `Ahora: ${consoleEmulator.name}` : undefined,
      checked: !emulators.hasOwn(game),
    },
    ...(platform?.emulators ?? []).map((e) => ({
      id: `e:${e.id}`,
      icon: 'play',
      label: e.name,
      tag: installTag(e) ?? e.note,
      checked: emulators.hasOwn(game) && emulator?.id === e.id,
    })),
  ])

  const items = $derived(
    view === 'main' ? mainItems : view === 'collections' ? collectionItems : view === 'filters' ? filterItems : emulatorItems,
  )

  /**
   * Nombre corto para la fila, que es angosta: "RetroArch · SwanStation" -> "SwanStation".
   * Si la consola tiene el mismo emulador suelto y como núcleo (PPSSPP, Dolphin,
   * Flycast), el núcleo queda como "PPSSPP (RetroArch)".
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
  // Con muchas colecciones la lista se desplaza para mostrar la enfocada
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
    // El juego se guarda antes: al cerrar el menú, `game` deja de existir
    const current = game
    if (!item || busy) return
    if (item.disabled) {
      sound.error()
      onToast(platform?.noEmulatorNote ?? 'Este juego todavía no se puede abrir.')
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
          ? `${current.name} se abrirá con ${item.label}`
          : `${current.name} vuelve a abrirse como su consola (${shortName(consoleEmulator?.name ?? '')})`,
      )
      show('main')
    } else if (item.id === 'cover') {
      sound.select()
      onClose()
      onChangeCover(current)
    } else if (item.id === 'hide') {
      library.hide(current)
      sound.back()
      onToast(`${current.name} quedó oculto. Lo recuperas en Opciones › Biblioteca.`)
      onClose()
    } else if (item.id === 'sort') {
      settings.cycleSortOrder(sortOptions)
      sound.select()
    } else if (item.id === 'filter') {
      sound.select()
      show('filters')
    } else if (item.id.startsWith('f:') && filterChannel) {
      /** @type {import('../lib/core/filters.js').GameFilter | null} */
      const chosen =
        item.id === 'f:all' ? null : item.id === 'f:players' ? { kind: 'players' } : { kind: 'genre', value: item.id.slice(4) }
      if (chosen) activeFilters.set(filterChannel, chosen)
      else activeFilters.delete(filterChannel)
      sound.favorite()
      onToast(
        chosen
          ? `Mostrando: ${filterLabel(chosen)} (${plural(Number(item.tag), 'juego', 'juegos')})`
          : 'Mostrando todos los juegos',
      )
      onClose()
    } else if (item.id === 'new') {
      sound.select()
      naming = true
    } else if (item.id.startsWith('c:')) {
      await run(async () => {
        const name = item.id.slice(2)
        const added = await collections.toggle(current, name)
        onToast(added ? `Agregado a ${name}` : `Quitado de ${name}`)
      })
    }
  }

  /** Guarda en el USB mostrando que está ocupado; si falla, avisa */
  async function run(/** @type {() => Promise<void>} */ task) {
    busy = true
    try {
      await task()
      sound.favorite()
    } catch (e) {
      sound.error()
      onToast(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      busy = false
    }
  }

  /** @param {string} name */
  async function createCollection(name) {
    naming = false
    await run(async () => {
      const saved = await collections.create(name, game)
      onToast(`Agregado a la colección ${saved}`)
    })
  }

  $effect(() => {
    if (naming) return // el teclado tiene el control
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

<aside class="sheet" aria-label="Menú del juego">
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
    <h3>Colecciones</h3>
  {:else if view === 'emulators'}
    <h3>Abrir con</h3>
  {:else if view === 'filters'}
    <h3>Filtrar</h3>
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
            <span class="check" class:on={item.checked} aria-label={item.checked ? 'En la colección' : 'Fuera'}>
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
    <p class="note">Crea tu primera colección: se guarda en el USB y ES-DE también la ve.</p>
  {/if}
</aside>

{#if !naming}
  <div class="hints-layer">
    <HintBar
      hints={[
        { button: 'a', label: 'Elegir' },
        { button: 'b', label: view === 'main' ? 'Cerrar' : 'Volver' },
      ]}
    />
  </div>
{/if}

{#if naming}
  <TextPrompt
    title="Nueva colección"
    placeholder="Por ejemplo: Con amigos"
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
  /* emuladores: nombres largos ("RetroArch · Mupen64Plus-Next") y su estado debajo */
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
  /* filtros: cuántos juegos, al lado del nombre */
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
