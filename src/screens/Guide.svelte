<script>
  /**
   * Guía de una consola: cómo instalar su emulador, qué archivos pide, dónde
   * van los juegos y cómo probar. Arriba a la izquierda, lo que Relix ya sabe
   * (emulador instalado, juegos encontrados); abajo, un QR a DevStore para
   * abrirlo en el celular.
   *
   *   ↑ ↓  recorrer los pasos    LB / RB  otra consola    B  volver
   */
  import { untrack } from 'svelte'
  import { DEVSTORE_LABEL, DEVSTORE_URL, guideSteps, richText } from '../lib/core/guides.js'
  import { getPlatform, PLATFORMS } from '../lib/core/platforms.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import Clock from '../lib/ui/Clock.svelte'
  import { emulators } from '../lib/ui/emulators.svelte.js'
  import { plural } from '../lib/ui/format.js'
  import HintBar from '../lib/ui/HintBar.svelte'
  import { dispatch, pushHandler } from '../lib/ui/input.js'
  import { library } from '../lib/ui/library.svelte.js'
  import Logo from '../lib/ui/Logo.svelte'
  import PadButton from '../lib/ui/PadButton.svelte'
  import QrCode from '../lib/ui/QrCode.svelte'
  import { sound } from '../lib/ui/sound.js'

  /** @type {{ systemId: string, onBack: (systemId: string) => void }} */
  let { systemId, onBack } = $props()

  // Se puede pasar a otra consola con LB / RB sin salir de la guía
  // svelte-ignore state_referenced_locally
  let currentId = $state(systemId)
  let index = $state(0)

  const platform = $derived(/** @type {import('../lib/core/platforms.js').Platform} */ (getPlatform(currentId)))
  const emulator = $derived(emulators.forPlatform(platform))
  const others = $derived(platform.emulators.filter((e) => e.id !== emulator?.id))
  const installed = $derived(emulator ? emulators.isInstalled(emulator) : null)
  const games = $derived(library.gamesFor(currentId).length)
  const folder = $derived(library.romFolderPath(currentId))
  const steps = $derived(guideSteps(platform, emulator, { folder, installed, games }))

  // Al entrar se vuelve a preguntar qué hay instalado (quizás lo acabas de instalar)
  $effect(() => {
    untrack(() => emulators.check())
  })

  // Pasos que se deslizan: el enfocado queda entero a la vista
  let scroll = $state(0)
  /** @type {HTMLElement | undefined} */
  let list = $state()
  $effect(() => {
    const el = /** @type {HTMLElement | undefined} */ (list?.children[index])
    const view = list?.parentElement?.clientHeight ?? 0
    if (!list || !el || !view) return
    const MARGIN = 28
    const top = el.offsetTop
    const bottom = top + el.offsetHeight
    const max = Math.max(0, list.scrollHeight - view)
    untrack(() => {
      let next = scroll
      if (top - next < MARGIN) next = top - MARGIN
      else if (bottom - next > view - MARGIN) next = bottom - view + MARGIN
      // Un paso más alto que la ventana: se muestra desde su título
      if (el.offsetHeight > view - 2 * MARGIN) next = top - MARGIN
      scroll = Math.max(0, Math.min(next, max))
    })
  })

  /** @param {number} delta */
  function switchConsole(delta) {
    const i = PLATFORMS.findIndex((p) => p.id === currentId) + delta
    if (i < 0 || i >= PLATFORMS.length) return sound.error()
    currentId = PLATFORMS[i].id
    index = 0
    scroll = 0
    sound.move()
  }

  /** @param {number} next */
  function move(next) {
    if (next < 0 || next >= steps.length || next === index) return
    index = next
    sound.move()
  }

  $effect(() =>
    pushHandler((action) => {
      if (action === 'up') move(index - 1)
      else if (action === 'down') move(index + 1)
      else if (action === 'lb') switchConsole(-1)
      else if (action === 'rb') switchConsole(1)
      else if (action === 'b' || action === 'y') (sound.back(), onBack(currentId))
    }),
  )

  /** Estado de un paso: listo, falta o (null) no se puede saber desde Relix */
  /** @param {boolean | null | undefined} done */
  const stateOf = (done) => (done === true ? 'ok' : done === false ? 'missing' : 'info')
</script>

<header class="top">
  <button class="back" onclick={() => dispatch('b')}>
    <PadButton name="b" size={30} />
    <Logo size={34} />
  </button>

  <nav class="switcher" aria-label="Consola">
    <button class="bumper" onclick={() => dispatch('lb')} aria-label="Consola anterior">
      <PadButton name="lb" size={30} />
    </button>
    <span class="title" style:--c={platform.color} style:--ink-c={platform.ink}>
      <span class="dot"><ChannelIcon id={platform.id} color={platform.ink} size={30} /></span>
      Guía de {platform.shortName}
    </span>
    <button class="bumper" onclick={() => dispatch('rb')} aria-label="Consola siguiente">
      <PadButton name="rb" size={30} />
    </button>
  </nav>

  <Clock />
</header>

{#key currentId}
  <section class="intro" style:--tint={platform.color}>
    <span class="badge" style:background={platform.color}>
      <ChannelIcon id={platform.id} color={platform.ink} size={72} />
    </span>
    <h1 class:long={platform.name.length > 13}>{platform.name}</h1>
    {#if emulator}
      <p class="with">Con <strong>{emulator.name}</strong></p>
      {#if others.length > 0}
        <p class="others">
          También: {others.map((e) => e.name).join(' · ')}. Se cambia en <strong>≡ › Consolas</strong>.
        </p>
      {/if}
    {:else}
      <p class="with">Con <strong>Cemu</strong>, desde Dev Home</p>
    {/if}

    <ul class="checks">
      <li class={emulator ? stateOf(installed) : 'info'}>
        <span class="mark" aria-hidden="true">{emulator && installed === true ? '✓' : emulator && installed === false ? '✗' : '?'}</span>
        {#if !emulator}
          Relix aún no puede abrirlo
        {:else if installed === true}
          Emulador instalado
        {:else if installed === false}
          Emulador sin instalar
        {:else}
          Se revisa en la Xbox
        {/if}
      </li>
      <li class={games > 0 ? 'ok' : 'missing'}>
        <span class="mark" aria-hidden="true">{games > 0 ? '✓' : '✗'}</span>
        {games > 0 ? `${plural(games, 'juego', 'juegos')} en el USB` : 'Aún no hay juegos'}
      </li>
    </ul>

    <div class="qr">
      <QrCode text={DEVSTORE_URL} size={150} />
      <p>
        Descárgalo en el PC desde
        <strong>{DEVSTORE_LABEL}</strong>
        <span>Escanea para abrirlo en el celular</span>
      </p>
    </div>
  </section>

  <div class="steps-window">
    <ol class="steps" bind:this={list} style:transform="translateY({-scroll}px)">
      {#each steps as step, i (step.id)}
        {@const state = stateOf(step.done)}
        <li class="step focus-ring" class:focused={i === index}>
          <span class="num {state}">{state === 'ok' ? '✓' : i + 1}</span>
          <div class="body">
            <h2>
              {step.title}
              {#if state === 'ok'}<span class="chip ok">Listo</span>{:else if state === 'missing'}<span class="chip missing">Falta</span>{/if}
            </h2>
            <ul>
              {#each step.lines.filter(Boolean) as line, j (j)}
                <li>
                  {#each richText(line) as part, k (k)}
                    {#if part.kind === 'bold'}<strong>{part.text}</strong>{:else if part.kind === 'code'}<code>{part.text}</code>{:else}{part.text}{/if}
                  {/each}
                </li>
              {/each}
            </ul>
          </div>
        </li>
      {/each}
    </ol>
  </div>
{/key}

<HintBar
  hints={[
    { button: 'lb', also: 'rb', label: 'Otra consola' },
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
    align-items: center;
    justify-content: space-between;
    gap: 32px;
  }
  .back {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 22px 10px 12px;
    border-radius: 999px;
    background: var(--cloud);
  }
  .switcher {
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
  .title {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 26px 6px 8px;
    border-radius: 999px;
    background: var(--c);
    color: var(--ink-c);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 26px;
    white-space: nowrap;
  }
  .dot {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgb(255 255 255 / 0.35);
  }

  /* ── Panel de la consola ──────────────── */
  .intro {
    position: absolute;
    left: 112px;
    top: 170px;
    width: 600px;
    height: 790px;
    padding: 40px 44px;
    display: flex;
    flex-direction: column;
    border-radius: 48px;
    background: var(--cloud);
    box-shadow: 0 30px 60px -40px rgb(var(--shadow) / 0.5);
  }
  .badge {
    display: grid;
    place-items: center;
    width: 120px;
    height: 120px;
    border-radius: 36px;
    box-shadow: inset 0 -8px 0 rgb(0 0 0 / 0.1);
  }
  h1 {
    margin: 26px 0 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 60px;
    line-height: 1;
    letter-spacing: -0.02em;
    white-space: nowrap;
  }
  h1.long {
    font-size: 46px;
  }
  .with {
    margin: 14px 0 0;
    font-size: 24px;
    color: var(--ink-soft);
  }
  .with strong,
  .others strong {
    color: var(--ink);
  }
  .others {
    margin: 6px 0 0;
    font-size: 19px;
    line-height: 1.4;
    color: var(--ink-soft);
  }
  .checks {
    list-style: none;
    margin: 22px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .checks li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 18px 8px 8px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 21px;
  }
  .checks .mark {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--cloud);
    font-weight: 800;
  }
  .checks .ok {
    background: var(--ok-bg);
    color: var(--ok-ink);
  }
  .checks .missing {
    background: var(--pop-soft);
    color: var(--ink);
  }
  .checks .info {
    background: var(--sky);
    color: var(--ink-soft);
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
  .qr p {
    margin: 0;
    font-size: 19px;
    line-height: 1.4;
    color: var(--ink-soft);
  }
  .qr strong {
    display: block;
    font-size: 22px;
    color: var(--ink);
  }
  .qr span {
    display: block;
    margin-top: 6px;
    font-size: 17px;
  }

  /* ── Pasos ───────────────────────────── */
  /* La ventana va de 142 a 970 px, como las filas de Opciones */
  .steps-window {
    position: absolute;
    left: 760px;
    right: 108px;
    top: 142px;
    bottom: 110px;
    overflow: hidden;
    mask-image: linear-gradient(transparent, #000 12px, #000 calc(100% - 12px), transparent);
  }
  .steps {
    position: relative;
    list-style: none;
    margin: 0;
    padding: 28px 16px;
    display: flex;
    flex-direction: column;
    gap: 30px;
    transition: transform 260ms var(--spring);
  }
  .step {
    display: flex;
    gap: 22px;
    padding: 26px 30px 28px 22px;
    border-radius: 34px;
    background: var(--cloud);
  }
  /* los pasos son anchos: no se mueven ni crecen, solo el aro */
  .step.focus-ring.focused {
    transform: none;
  }
  .num {
    flex: none;
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 18px;
    background: var(--sky);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 28px;
    padding-top: 2px;
  }
  .num.ok {
    background: var(--ok-bg);
    color: var(--ok-ink);
  }
  .num.missing {
    background: var(--pop);
    color: var(--on-color);
  }
  .body {
    min-width: 0;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 8px 0 12px;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 32px;
  }
  .chip {
    padding: 2px 14px 4px;
    border-radius: 999px;
    font-family: var(--font-body);
    font-size: 18px;
    font-weight: 700;
  }
  .chip.ok {
    background: var(--ok-bg);
    color: var(--ok-ink);
  }
  .chip.missing {
    background: var(--pop-soft);
    color: var(--ink);
  }
  .body ul {
    margin: 0;
    padding: 0 0 0 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 22px;
    line-height: 1.45;
    color: var(--ink-soft);
  }
  .body strong {
    color: var(--ink);
  }
  .body code {
    font-family: var(--font-body);
    font-weight: 700;
    color: var(--ink);
    background: var(--sky);
    padding: 1px 10px;
    border-radius: 10px;
    overflow-wrap: anywhere;
  }
</style>
