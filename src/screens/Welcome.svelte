<script>
  /**
   * Primer uso: un recorrido corto por lo que Relix necesita. Cinco pantallas
   * (hola, tu USB, emuladores, portadas, botones). Se muestra una vez y se
   * puede ver de nuevo desde Opciones › Revisión.
   *
   *   A  siguiente / la opción enfocada    B  pantalla anterior    ≡  saltar
   *   ↑ ↓  elegir (consolas en Emuladores, "Buscar ahora" en Portadas)
   */
  import { untrack } from 'svelte'
  import { DEVSTORE_LABEL, DEVSTORE_URL } from '../lib/core/guides.js'
  import { getPlatform, PLATFORMS } from '../lib/core/platforms.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import Clock from '../lib/ui/Clock.svelte'
  import { covers } from '../lib/ui/covers.svelte.js'
  import { coverSummary, plural } from '../lib/ui/format.js'
  import HintBar from '../lib/ui/HintBar.svelte'
  import { dispatch, pushHandler } from '../lib/ui/input.js'
  import { library } from '../lib/ui/library.svelte.js'
  import Logo from '../lib/ui/Logo.svelte'
  import PadButton from '../lib/ui/PadButton.svelte'
  import QrCode from '../lib/ui/QrCode.svelte'
  import { sound } from '../lib/ui/sound.js'
  import { systemStatus } from '../lib/ui/systemStatus.svelte.js'

  /**
   * @type {{
   *   initialStep?: number,
   *   initialRow?: string,
   *   onGuide: (systemId: string, from: { step: number, row: string }) => void,
   *   onDone: () => void,
   *   onToast: (message: string) => void,
   * }}
   *   initialRow: al volver de una guía, la consola que tenía el foco
   */
  let { initialStep = 0, initialRow, onGuide, onDone, onToast } = $props()

  const STEPS = ['hello', 'usb', 'emulators', 'covers', 'buttons']
  // svelte-ignore state_referenced_locally
  let step = $state(Math.min(Math.max(0, initialStep), STEPS.length - 1))
  const stepId = $derived(STEPS[step])

  // Si todavía no se revisó el sistema (o la revisión es vieja), se revisa ahora
  $effect(() => {
    untrack(() => {
      if (!systemStatus.running && Date.now() - systemStatus.checkedAt > 20_000) systemStatus.run()
    })
  })

  const STATE_ORDER = { error: 0, warn: 1, info: 2, ok: 3 }
  const MARKS = { ok: '✓', warn: '!', error: '✗', info: 'i' }
  const checkById = $derived(new Map(systemStatus.checks.map((c) => [c.id, c])))

  // ── Tu USB ──
  const usbChecks = $derived(systemStatus.checks.filter((c) => ['usb', 'write', 'space', 'folders'].includes(c.id)))
  const withGames = $derived(PLATFORMS.filter((p) => library.gamesFor(p.id).length > 0))
  const exampleFolders = ['psx', 'ps2', 'gc']

  // ── Emuladores: las consolas con juegos, primero las que tienen algo pendiente ──
  const MAX_CONSOLES = 5
  const consoleRows = $derived(
    systemStatus.consoles
      .filter((c) => c.games.length > 0)
      .map(({ platform, emulator, games }) => {
        const emu = checkById.get(`emu:${platform.id}`)
        const bios = checkById.get(`bios:${platform.id}`)
        const worst = Math.min(STATE_ORDER[emu?.state ?? 'info'], STATE_ORDER[bios?.state ?? 'ok'])
        return { platform, emulator, games: games.length, emu, bios, worst }
      })
      .sort((a, b) => a.worst - b.worst),
  )
  const shownConsoles = $derived(consoleRows.slice(0, MAX_CONSOLES))

  // ── Portadas ──
  const coverTotals = $derived(
    PLATFORMS.reduce(
      (sum, p) => {
        const count = library.coverCount(p.id)
        return { withCover: sum.withCover + count.withCover, total: sum.total + count.total }
      },
      { withCover: 0, total: 0 },
    ),
  )
  const missingCovers = $derived(coverTotals.total - coverTotals.withCover)
  /** Faltan portadas o capturas para el fondo */
  const needsSearch = $derived(PLATFORMS.some((p) => covers.needsSearch(p.id)))
  /** Lo que dejó la búsqueda de esta pantalla */
  let coverDone = $state('')
  const searching = $derived(covers.all !== null)

  // Lo que se puede enfocar en cada pantalla; el botón principal va al final
  const items = $derived(
    stepId === 'emulators'
      ? [...shownConsoles.map((c) => c.platform.id), 'next']
      : stepId === 'covers' && needsSearch && !coverDone && !searching
        ? ['search', 'next']
        : ['next'],
  )
  /** Al llegar a una pantalla el foco va al botón principal (salvo "Buscar ahora") */
  function defaultIndex(/** @type {string | undefined} */ row) {
    if (row) {
      const i = items.indexOf(row)
      if (i >= 0) return i
    }
    return items[0] === 'search' ? 0 : items.length - 1
  }
  let index = $state(defaultIndex(untrack(() => initialRow)))
  const focusedItem = $derived(items[Math.min(index, items.length - 1)])

  // Si la lista cambia (la revisión termina, la búsqueda acaba), el foco no se pierde
  $effect.pre(() => {
    const length = items.length
    untrack(() => {
      if (index >= length) index = length - 1
    })
  })

  /** @param {number} next */
  function goTo(next) {
    if (next < 0 || next >= STEPS.length) return
    step = next
    index = defaultIndex(undefined)
    sound.move()
  }

  function finish() {
    sound.favorite()
    onDone()
  }

  async function searchCovers() {
    if (searching) return
    sound.select()
    // La búsqueda sigue aunque pases a la pantalla siguiente; el foco pasa a "Siguiente"
    try {
      const result = await covers.findAll()
      coverDone = coverSummary('Listo', result)
      if (stepId !== 'covers') onToast(coverDone)
    } catch (e) {
      sound.error()
      onToast(e instanceof Error ? e.message : 'No se pudieron buscar las portadas.')
    }
  }

  function activate() {
    const item = focusedItem
    if (item === 'next') {
      if (step === STEPS.length - 1) finish()
      else (sound.select(), goTo(step + 1))
    } else if (item === 'search') {
      searchCovers()
    } else if (getPlatform(item)) {
      sound.select()
      onGuide(item, { step, row: item })
    }
  }

  /** @param {number} next */
  function move(next) {
    if (next < 0 || next >= items.length || next === index) return
    index = next
    sound.move()
  }

  $effect(() =>
    pushHandler((action) => {
      if (action === 'up') move(index - 1)
      else if (action === 'down') move(index + 1)
      else if (action === 'a') activate()
      else if (action === 'b') step > 0 ? (sound.back(), goTo(step - 1)) : sound.error()
      else if (action === 'start') finish()
    }),
  )

  const primaryLabel = $derived(step === 0 ? 'Empezar' : step === STEPS.length - 1 ? '¡A jugar!' : 'Siguiente')
  const hintA = $derived(
    focusedItem === 'next' ? primaryLabel : focusedItem === 'search' ? 'Buscar portadas' : 'Ver guía',
  )

  const BUTTONS = [
    { button: 'a', label: 'Jugar o elegir', detail: 'Abre la consola, el juego o la opción enfocada' },
    { button: 'b', label: 'Volver', detail: 'A la pantalla anterior' },
    { button: 'y', label: 'Menú del juego', detail: 'Abrir con…, portada, filtrar, ocultar' },
    { button: 'x', label: 'Favorito', detail: 'Marca el juego con una estrella' },
    { button: 'lb', also: 'rb', label: 'Otra consola', detail: 'La anterior o la siguiente' },
    { button: 'view', label: 'Buscar', detail: 'En todas las consolas a la vez' },
    { button: 'start', label: 'Opciones', detail: 'Escanear, emuladores, revisión' },
    { button: 'lt', also: 'rt', label: 'Saltar de letra', detail: 'En listas largas' },
  ]
</script>

<header class="top">
  <span class="brand">
    <Logo size={34} />
    <span>Primeros pasos</span>
  </span>

  <ol class="dots" aria-label="Paso {step + 1} de {STEPS.length}">
    {#each STEPS as id, i (id)}
      <li class:done={i < step} class:current={i === step}></li>
    {/each}
  </ol>

  <Clock />
</header>

{#key stepId}
  <section class="intro">
    {#if stepId === 'hello'}
      <span class="hello-logo"><Logo size={92} /></span>
      <h1>¡Hola!</h1>
      <p>
        Relix es la repisa de tus juegos en la Xbox: lee tu USB, abre cada juego con su emulador y
        lleva la cuenta de cuánto juegas.
      </p>
      <p class="small">
        Son cuatro pasos cortos. Puedes saltarlos con <PadButton name="start" size={26} /> y verlos de
        nuevo en <strong>Opciones › Revisión</strong>.
      </p>
    {:else if stepId === 'usb'}
      <span class="intro-icon"><ChannelIcon id="usb" color="#23304A" size={76} /></span>
      <h1>Tu USB</h1>
      <p>
        Relix lee tus juegos de la carpeta <strong>roms</strong> del USB, una carpeta por consola,
        igual que ES-DE.
      </p>
      <pre class="tree"><strong>{library.romRoot}</strong>
{#each exampleFolders as id (id)}├ <b>{library.folderOf(id)}</b>   {getPlatform(id)?.shortName}
{/each}└ …</pre>
    {:else if stepId === 'emulators'}
      <span class="intro-icon"><ChannelIcon id="play" color="#23304A" size={70} /></span>
      <h1>Emuladores</h1>
      <p>
        Cada consola se abre con su emulador. Si algo falta, elige la consola y abre su guía con
        <PadButton name="a" size={26} />: explica qué instalar y dónde va cada archivo.
      </p>
      <div class="qr">
        <QrCode text={DEVSTORE_URL} size={130} />
        <p>
          Los emuladores se bajan en el PC desde
          <strong>{DEVSTORE_LABEL}</strong>
        </p>
      </div>
    {:else if stepId === 'covers'}
      <span class="intro-icon"><ChannelIcon id="cover" color="#23304A" size={76} /></span>
      <h1>Portadas</h1>
      <p>
        Relix baja las portadas de libretro, las mismas de RetroArch, y una captura de cada juego
        para el fondo de su ficha. Todo queda en tu USB junto a lo de ES-DE.
      </p>
      <p class="small">
        Si duda de cuál es la de un juego, te deja elegirla en <strong>Opciones › Portadas</strong>.
      </p>
    {:else}
      <span class="intro-icon"><ChannelIcon id="gamepad" color="#23304A" size={80} /></span>
      <h1>Los botones</h1>
      <p>Lo justo para moverte. La barra de abajo siempre dice qué hace cada botón en esa pantalla.</p>
      <p class="small">¿Usas teclado? Flechas, Enter, Esc, X, Y, Q/E, V y M.</p>
    {/if}
  </section>

  <section class="content">
    {#if stepId === 'hello'}
      <ol class="cards">
        {#each [
          { icon: 'usb', title: 'Tu USB', text: 'Dónde van los juegos y si Relix puede guardar en él' },
          { icon: 'play', title: 'Emuladores', text: 'Qué necesita cada consola, con su guía paso a paso' },
          { icon: 'cover', title: 'Portadas', text: 'Bajarlas todas de una vez' },
          { icon: 'gamepad', title: 'Botones', text: 'Lo justo para moverte por Relix' },
        ] as card, i (card.icon)}
          <li class="card">
            <span class="num">{i + 1}</span>
            <span class="card-icon"><ChannelIcon id={card.icon} color="#23304A" size={44} /></span>
            <span class="text">
              <strong>{card.title}</strong>
              <span>{card.text}</span>
            </span>
          </li>
        {/each}
      </ol>
    {:else if stepId === 'usb'}
      <ul class="list compact">
        {#if usbChecks.length <= 1 && systemStatus.running}
          <li class="line">
            <span class="mark info"><span class="spinner" aria-hidden="true"></span></span>
            <span class="text"><strong>Revisando el USB…</strong></span>
          </li>
        {/if}
        {#each usbChecks as check (check.id)}
          <li class="line">
            <span class="mark {check.state}" aria-hidden="true">{MARKS[check.state]}</span>
            <span class="text">
              <strong>{check.title}</strong>
              <span>{check.detail}</span>
            </span>
          </li>
        {/each}
      </ul>
      {#if withGames.length > 0}
        <h2>Consolas con juegos</h2>
        <ul class="consoles">
          {#each withGames as p (p.id)}
            <li style:background={p.color} style:color={p.ink}>
              <ChannelIcon id={p.id} color={p.ink} size={30} />
              {p.shortName}
              <small>{library.gamesFor(p.id).length}</small>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">
          Copia tus juegos en el PC, por ejemplo en <code>{library.romFolderPath('ps2')}</code>, y
          escanéalos en <strong>Opciones › Biblioteca</strong>.
        </p>
      {/if}
    {:else if stepId === 'emulators'}
      {#if shownConsoles.length === 0}
        <p class="empty">
          Cuando copies juegos, aquí verás qué necesita cada consola. Mientras, todas las guías están
          en <strong>Opciones › Consolas</strong> con <PadButton name="y" size={26} />.
        </p>
      {:else}
        <div class="list" role="list">
          {#each shownConsoles as row, i (row.platform.id)}
            {@const focused = i === index}
            {@const p = row.platform}
            <button
              class="line console focus-ring"
              class:focused
              role="listitem"
              style:--tint={p.color}
              onmouseenter={() => move(i)}
              onclick={() => (i === index ? activate() : move(i))}
            >
              <span class="badge" style:background={p.color}>
                <ChannelIcon id={p.id} color={p.ink} size={40} />
              </span>
              <span class="text">
                <strong>{p.name}</strong>
                <span>{plural(row.games, 'juego', 'juegos')} · {row.emulator?.name ?? 'Cemu, desde Dev Home'}</span>
              </span>
              <span class="chips">
                {#if row.emu}
                  <span class="chip {row.emu.state}">
                    {row.emu.state === 'ok'
                      ? 'Instalado'
                      : row.emu.state === 'error'
                        ? 'Sin instalar'
                        : p.emulators.length
                          ? 'Se revisa en la Xbox'
                          : 'Dev Home'}
                  </span>
                {/if}
                {#if row.bios}
                  <span class="chip {row.bios.state}">
                    {row.bios.state === 'ok' ? 'BIOS lista' : row.bios.state === 'warn' ? 'Falta BIOS' : 'BIOS: no la veo'}
                  </span>
                {/if}
                {#if focused}<span class="go"><PadButton name="a" size={28} /> Guía</span>{/if}
              </span>
            </button>
          {/each}
        </div>
        {#if consoleRows.length > MAX_CONSOLES}
          <p class="more">
            Y {plural(consoleRows.length - MAX_CONSOLES, 'consola más', 'consolas más')}: las ves todas en
            <strong>Opciones › Revisión</strong>.
          </p>
        {/if}
      {/if}
    {:else if stepId === 'covers'}
      {@const ratio = coverTotals.total > 0 ? coverTotals.withCover / coverTotals.total : 0}
      <div class="cover-card">
        <strong class="big">{coverTotals.withCover} de {coverTotals.total}</strong>
        <span>juegos con portada</span>
        <i class="meter" aria-hidden="true"><i style:width="{ratio * 100}%"></i></i>
        <p class="status">
          {#if searching}
            <span class="spinner" aria-hidden="true"></span>
            {#if covers.progress}
              {getPlatform(covers.progress.system)?.shortName}:
              {covers.progress.phase === 'download'
                ? `bajando ${covers.progress.done} de ${covers.progress.total}`
                : covers.progress.phase === 'shots'
                  ? `capturas ${covers.progress.done} de ${covers.progress.total}`
                  : 'buscando…'}
            {:else}
              Buscando…
            {/if}
            <small>Puedes seguir: la búsqueda continúa.</small>
          {:else if coverDone}
            {coverDone}
          {:else if coverTotals.total === 0}
            Cuando tengas juegos, las portadas se buscan en <strong>Opciones › Portadas</strong>.
          {:else if missingCovers === 0 && !needsSearch}
            ¡Ya están todas!
          {:else if missingCovers === 0}
            Tienes todas las portadas. A algunos juegos les falta la captura del fondo.
          {:else}
            Faltan {missingCovers}. Bajarlas toma unos minutos.
          {/if}
        </p>
        {#if checkById.get('internet')?.state === 'warn'}
          <p class="warn-note">Relix no llega al servidor de portadas: revisa la red de la Xbox.</p>
        {/if}
      </div>
      {#if items.includes('search')}
        <button
          class="secondary focus-ring"
          class:focused={focusedItem === 'search'}
          onmouseenter={() => move(0)}
          onclick={() => (index === 0 ? activate() : move(0))}
        >
          <ChannelIcon id="download" color="#23304A" size={40} />
          Buscar ahora
        </button>
      {/if}
    {:else}
      <ul class="buttons">
        {#each BUTTONS as b (b.button)}
          <li>
            <span class="pads">
              <PadButton name={b.button} size={44} />
              {#if b.also}<PadButton name={b.also} size={44} />{/if}
            </span>
            <span class="text">
              <strong>{b.label}</strong>
              <span>{b.detail}</span>
            </span>
          </li>
        {/each}
      </ul>
    {/if}

    <button
      class="primary focus-ring"
      class:focused={focusedItem === 'next'}
      style:--tint="var(--pop)"
      onmouseenter={() => move(items.length - 1)}
      onclick={() => (focusedItem === 'next' ? activate() : move(items.length - 1))}
    >
      <PadButton name="a" size={34} />
      {primaryLabel}
    </button>
  </section>
{/key}

<HintBar
  hints={[
    { button: 'a', label: hintA },
    ...(step > 0 ? [{ button: /** @type {const} */ ('b'), label: 'Atrás' }] : []),
    ...(step < STEPS.length - 1 ? [{ button: /** @type {const} */ ('start'), label: 'Saltar' }] : []),
  ]}
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
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 26px 8px 14px;
    border-radius: 999px;
    background: var(--cloud);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 26px;
  }
  .brand > span:last-child {
    padding-left: 16px;
    border-left: 3px solid var(--sky);
  }
  .dots {
    display: flex;
    gap: 12px;
    list-style: none;
    margin: 0;
    padding: 14px 18px;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.65);
  }
  .dots li {
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--sky-deep);
    transition:
      width 260ms var(--spring),
      background 200ms ease;
  }
  .dots li.done {
    background: var(--ink-soft);
  }
  .dots li.current {
    width: 54px;
    background: var(--pop);
  }

  /* ── Panel izquierdo ─────────────────── */
  .intro {
    position: absolute;
    left: 112px;
    top: 170px;
    width: 600px;
    height: 790px;
    padding: 44px;
    display: flex;
    flex-direction: column;
    border-radius: 48px;
    background: var(--cloud);
    box-shadow: 0 30px 60px -40px rgb(35 48 74 / 0.5);
    animation: rise 360ms var(--spring) both;
  }
  .intro-icon {
    display: grid;
    place-items: center;
    width: 140px;
    height: 140px;
    border-radius: 50%;
    background: var(--sky);
  }
  .hello-logo {
    display: flex;
    align-items: center;
    height: 140px;
  }
  h1 {
    margin: 30px 0 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 72px;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .intro p {
    margin: 18px 0 0;
    font-size: 26px;
    line-height: 1.45;
    color: var(--ink-soft);
  }
  .intro p strong {
    color: var(--ink);
  }
  .intro p.small {
    font-size: 22px;
  }
  .intro :global(.pad) {
    vertical-align: -4px;
    margin: 0 2px;
  }
  .tree {
    margin: 26px 0 0;
    padding: 20px 26px;
    border-radius: 26px;
    background: var(--sky);
    font-family: var(--font-body);
    font-size: 23px;
    line-height: 1.55;
    color: var(--ink-soft);
    white-space: pre;
  }
  .tree strong,
  .tree b {
    color: var(--ink);
  }
  .qr {
    margin-top: auto;
    display: flex;
    align-items: center;
    gap: 20px;
    padding-top: 20px;
    border-top: 3px dashed var(--sky);
  }
  .qr :global(svg) {
    flex: none;
    border-radius: 14px;
  }
  .intro .qr p {
    margin: 0;
    font-size: 20px;
  }
  .qr strong {
    display: block;
    font-size: 22px;
  }

  /* ── Contenido a la derecha ──────────── */
  /* De 170 a 960 px, como el panel; el botón principal queda abajo a la derecha */
  .content {
    position: absolute;
    left: 776px;
    right: 124px;
    top: 170px;
    height: 790px;
    display: flex;
    flex-direction: column;
    animation: rise 360ms 60ms var(--spring) both;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(24px);
    }
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }
  .text strong {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 30px;
    line-height: 1.1;
  }
  .text span {
    font-size: 21px;
    line-height: 1.35;
    color: var(--ink-soft);
  }

  .cards {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 24px;
  }
  .card {
    display: flex;
    align-items: center;
    gap: 22px;
    height: 120px;
    padding: 0 30px 0 22px;
    border-radius: 34px;
    background: var(--cloud);
  }
  .num {
    display: grid;
    place-items: center;
    flex: none;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--pop);
    color: var(--cloud);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 26px;
    padding-top: 3px;
  }
  .card-icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 76px;
    height: 76px;
    border-radius: 24px;
    background: var(--sky);
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 22px;
    width: 100%;
    min-height: 96px;
    padding: 14px 28px 14px 16px;
    border-radius: 32px;
    background: var(--cloud);
    text-align: left;
  }
  /* Tu USB: solo para leer, más juntas para que quepan las doce consolas abajo */
  .list.compact {
    gap: 14px;
  }
  .list.compact .line {
    min-height: 82px;
    padding-block: 10px;
  }
  .list.compact .mark {
    width: 54px;
    height: 54px;
    border-radius: 18px;
    font-size: 30px;
  }
  .list.compact .text strong {
    font-size: 27px;
  }
  /* las consolas en Emuladores: el aro necesita aire entre filas */
  .list:has(.console) {
    gap: 30px;
  }
  .line.console.focus-ring.focused {
    transform: none;
  }
  .mark {
    display: grid;
    place-items: center;
    flex: none;
    width: 60px;
    height: 60px;
    border-radius: 20px;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 34px;
    padding-top: 3px;
  }
  .mark.ok {
    background: #d9f2dc;
    color: #1d5a27;
  }
  .mark.warn {
    background: var(--sun);
  }
  .mark.error {
    background: var(--pop);
    color: var(--cloud);
  }
  .mark.info {
    background: var(--sky);
    color: var(--ink-soft);
    font-family: Georgia, serif;
    font-style: italic;
  }
  .badge {
    display: grid;
    place-items: center;
    flex: none;
    width: 64px;
    height: 64px;
    border-radius: 20px;
  }
  .chips {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: none;
  }
  .chip {
    padding: 4px 16px 6px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 20px;
    background: var(--sky);
    color: var(--ink-soft);
  }
  .chip.ok {
    background: #d9f2dc;
    color: #1d5a27;
  }
  .chip.warn {
    background: var(--sun);
    color: var(--ink);
  }
  .chip.error {
    background: var(--pop-soft);
    color: var(--ink);
  }
  .go {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: 10px;
    font-weight: 700;
    font-size: 24px;
  }

  h2 {
    margin: 36px 0 16px;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 30px;
  }
  .consoles {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .consoles li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 20px 8px 12px;
    border-radius: 999px;
    font-weight: 800;
    font-size: 22px;
  }
  .consoles small {
    padding: 0 10px;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.4);
    font-size: 19px;
  }
  .empty,
  .more {
    margin: 26px 0 0;
    font-size: 24px;
    line-height: 1.45;
    color: var(--ink-soft);
  }
  .empty {
    padding: 28px 32px;
    border-radius: 32px;
    background: var(--cloud);
  }
  .empty strong,
  .more strong,
  .empty code {
    color: var(--ink);
  }
  .empty code {
    font-family: var(--font-body);
    font-weight: 700;
  }
  .empty :global(.pad) {
    vertical-align: -5px;
  }

  .cover-card {
    display: flex;
    flex-direction: column;
    padding: 40px 44px;
    border-radius: 40px;
    background: var(--cloud);
  }
  .big {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 84px;
    line-height: 1;
  }
  .cover-card > span {
    font-size: 26px;
    font-weight: 700;
    color: var(--ink-soft);
  }
  .meter {
    display: block;
    height: 18px;
    margin-top: 26px;
    border-radius: 999px;
    background: var(--sky);
    overflow: hidden;
  }
  .meter i {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: var(--pop);
    transition: width 400ms ease;
  }
  .status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    min-height: 70px;
    margin: 22px 0 0;
    font-size: 24px;
    font-weight: 700;
  }
  .status small {
    flex-basis: 100%;
    font-size: 20px;
    font-weight: 600;
    color: var(--ink-soft);
  }
  .warn-note {
    margin: 12px 0 0;
    padding: 10px 20px;
    border-radius: 20px;
    background: var(--sun);
    font-size: 21px;
    font-weight: 700;
  }
  .secondary {
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 52px;
    padding: 16px 34px 16px 22px;
    border-radius: 999px;
    background: var(--cloud);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 30px;
  }

  .buttons {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }
  .buttons li {
    display: flex;
    align-items: center;
    gap: 18px;
    height: 128px;
    padding: 0 24px;
    border-radius: 30px;
    background: var(--cloud);
  }
  .pads {
    display: flex;
    gap: 6px;
    flex: none;
    width: 150px;
  }
  .buttons .text strong {
    font-size: 27px;
  }
  .buttons .text span {
    font-size: 19px;
  }

  .primary {
    align-self: flex-end;
    margin-top: auto;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 40px 16px 20px;
    border-radius: 999px;
    background: var(--pop);
    color: var(--cloud);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 34px;
    box-shadow: inset 0 -6px 0 rgb(0 0 0 / 0.12);
  }
  .primary.focus-ring.focused {
    box-shadow:
      inset 0 -6px 0 rgb(0 0 0 / 0.12),
      0 0 0 5px var(--cloud),
      0 0 0 11px var(--pop),
      0 28px 40px -14px color-mix(in oklab, var(--pop) 70%, transparent);
  }
  .primary :global(.pad) {
    background: var(--cloud);
    color: var(--btn-a);
  }
  .spinner {
    display: inline-block;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 5px solid var(--pop-soft);
    border-top-color: var(--pop);
    animation: spin 700ms linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
