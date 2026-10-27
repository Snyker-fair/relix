<script>
  // Options: the sections (LB/RB), each one in src/screens/options/. This screen
  // holds the tabs, the left panel, which row has the focus and the list that
  // slides; the section on screen draws its rows and says what they do.
  import { untrack } from 'svelte'
  import { t } from '../lib/i18n/i18n.svelte.js'
  import Clock from '../lib/ui/Clock.svelte'
  import { plural } from '../lib/ui/format.js'
  import HintBar from '../lib/ui/HintBar.svelte'
  import { dispatch, pushHandler } from '../lib/ui/input.js'
  import Logo from '../lib/ui/Logo.svelte'
  import PadButton from '../lib/ui/PadButton.svelte'
  import { sound } from '../lib/ui/sound.js'
  import { systemStatus } from '../lib/ui/systemStatus.svelte.js'
  import About from './About.svelte'
  import LogViewer from './LogViewer.svelte'
  import ReportProblem from './ReportProblem.svelte'
  import CheckSection from './options/CheckSection.svelte'
  import ConsolesSection from './options/ConsolesSection.svelte'
  import CoversSection from './options/CoversSection.svelte'
  import Intro from './options/Intro.svelte'
  import LibrarySection from './options/LibrarySection.svelte'
  import PreferencesSection from './options/PreferencesSection.svelte'
  import './options/rows.css'

  /** @typedef {import('./options/section.js').Section} Section @typedef {import('./options/section.js').Hint} Hint */

  /**
   * @type {{
   *   onBack: () => void,
   *   onToast: (message: string) => void,
   *   onPickCovers: () => void,
   *   onRenameFiles: () => void,
   *   onGameInfo: () => void,
   *   onGuide: (systemId: string, from: { section: string, row: string }) => void,
   *   onWelcome: () => void,
   *   initialSection?: string,
   *   initialRow?: string,
   * }}
   *   initialRow: the row with the focus on opening (e.g. the console of the guide you're coming back from).
   *   In Checkup the console is enough: "psx" focuses its first check ("emu:psx").
   */
  let {
    onBack,
    onToast,
    onPickCovers,
    onRenameFiles,
    onGameInfo,
    onGuide,
    onWelcome,
    initialSection = 'library',
    initialRow,
  } = $props()

  // Sections: they change with LB/RB, just like the consoles in the library
  const SECTIONS = $derived([
    { id: 'library', name: t('Biblioteca') },
    { id: 'consoles', name: t('Consolas') },
    { id: 'check', name: t('Revisión') },
    { id: 'covers', name: t('Portadas') },
    { id: 'preferences', name: t('Preferencias') },
    { id: 'about', name: t('Acerca de') },
  ])
  /** Each list's name and its rows' size: Library, Consoles and Covers are long, Checkup's grow with their text */
  const LISTS = $derived(
    /** @type {Record<string, { label: string, kind: string }>} */ ({
      library: { label: t('Escanear consolas'), kind: 'compact' },
      consoles: { label: t('Emulador de cada consola'), kind: 'compact' },
      check: { label: t('Revisión del sistema'), kind: 'review' },
      covers: { label: t('Portadas'), kind: 'compact' },
      preferences: { label: t('Preferencias'), kind: '' },
    }),
  )

  // It only matters on opening (e.g. back to Covers from "Pick by hand")
  // svelte-ignore state_referenced_locally
  let section = $state(initialSection)
  let index = $state(0)
  /** The section on screen (none in About: it's read-only) */
  let current = $state(/** @type {Section | undefined} */ (undefined))
  const ROWS = $derived(section === 'about' ? [] : (current?.rows() ?? []))
  /** On top of Checkup: the diagnostic log, or the QR to report a problem */
  let showLog = $state(false)
  let showReport = $state(false)

  // The row to focus on opening, once its section has its rows: exact or, in
  // Checkup, that console's first check
  let pendingRow = untrack(() => initialRow)
  $effect(() => {
    const rows = ROWS
    if (!pendingRow || rows.length === 0) return
    const row = pendingRow
    pendingRow = undefined
    const exact = rows.indexOf(row)
    untrack(() => (index = Math.max(0, exact >= 0 ? exact : rows.findIndex((id) => id.endsWith(`:${row}`)))))
  })

  // A list that slides: just enough scroll for the focused row to stay
  // fully in view, with a margin for its ring
  let rowsScroll = $state(0)
  /** @type {HTMLElement | undefined} */
  let rowsEl = $state()
  $effect(() => {
    const el = /** @type {HTMLElement | undefined} */ (rowsEl?.children[index])
    const view = rowsEl?.parentElement?.clientHeight ?? 0
    if (!rowsEl || !el || !view) return
    const MARGIN = 28
    const top = el.offsetTop
    const bottom = top + el.offsetHeight
    const max = Math.max(0, rowsEl.scrollHeight - view)
    untrack(() => {
      let next = rowsScroll
      if (top - next < MARGIN) next = top - MARGIN
      else if (bottom - next > view - MARGIN) next = bottom - view + MARGIN
      rowsScroll = Math.max(0, Math.min(next, max))
    })
  })

  /** @type {Hint[]} */
  const COMMON = $derived([
    { button: 'lb', also: 'rb', label: t('Secciones') },
    { button: 'b', label: t('Volver') },
  ])
  const hints = $derived(section === 'about' || !current ? COMMON : current.hints(COMMON))

  /** @param {string} id */
  function openSection(id) {
    if (id === section) return
    section = id
    index = 0
    rowsScroll = 0
    sound.move()
  }

  /** @param {number} delta */
  function switchSection(delta) {
    const next = SECTIONS.findIndex((s) => s.id === section) + delta
    if (next >= 0 && next < SECTIONS.length) openSection(SECTIONS[next].id)
  }

  /** @param {number} next */
  function move(next) {
    if (next < 0 || next >= ROWS.length || next === index) return
    index = next
    sound.move()
  }

  $effect(() =>
    pushHandler((action) => {
      if (current?.handle?.(action)) return
      if (action === 'up') move(index - 1)
      else if (action === 'down') move(index + 1)
      else if (action === 'lb') switchSection(-1)
      else if (action === 'rb') switchSection(1)
      else if (action === 'a') current?.activate()
      else if (action === 'b' || action === 'start') (sound.back(), onBack())
    }),
  )
</script>

<header class="top">
  <button class="back" onclick={() => dispatch('b')}>
    <PadButton name="b" size={30} />
    <Logo size={34} />
  </button>

  <nav class="tabs" aria-label={t('Secciones')}>
    <button class="bumper" onclick={() => dispatch('lb')} aria-label={t('Sección anterior')}>
      <PadButton name="lb" size={30} />
    </button>
    {#each SECTIONS as s (s.id)}
      <button class="tab" class:active={s.id === section} onclick={() => openSection(s.id)}>
        {s.name}
        {#if s.id === 'check' && systemStatus.summary.errors > 0}
          <!-- the same count as the Options tile on the home screen: what's left to fix -->
          <span class="tab-alert" aria-label={plural(systemStatus.summary.errors, 'cosa por arreglar', 'cosas por arreglar')}>
            {systemStatus.summary.errors}
          </span>
        {/if}
      </button>
    {/each}
    <button class="bumper" onclick={() => dispatch('rb')} aria-label={t('Sección siguiente')}>
      <PadButton name="rb" size={30} />
    </button>
  </nav>

  <Clock />
</header>

<Intro {section} />

{#if section === 'about'}
  <About />
{:else}
  <!-- With twelve consoles the rows don't fit: the list slides to show the focused one -->
  <div class="rows-window">
    <section
      class="rows {LISTS[section].kind}"
      aria-label={LISTS[section].label}
      bind:this={rowsEl}
      style:transform="translateY({-rowsScroll}px)"
    >
      {#if section === 'library'}
        <LibrarySection bind:this={current} {index} onMove={move} {onToast} {onRenameFiles} {onGameInfo} />
      {:else if section === 'consoles'}
        <ConsolesSection bind:this={current} bind:index onMove={move} {onToast} {onGuide} />
      {:else if section === 'check'}
        <CheckSection
          bind:this={current}
          bind:index
          onMove={move}
          {onToast}
          {onGuide}
          {onWelcome}
          onLog={() => (showLog = true)}
          onReport={() => (showReport = true)}
        />
      {:else if section === 'covers'}
        <CoversSection bind:this={current} {index} onMove={move} {onToast} {onPickCovers} />
      {:else}
        <PreferencesSection bind:this={current} {index} onMove={move} />
      {/if}
    </section>
  </div>
{/if}

<HintBar {hints} />

{#if showLog}
  <LogViewer onClose={() => (showLog = false)} />
{/if}
{#if showReport}
  <ReportProblem onClose={() => (showReport = false)} />
{/if}

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
  .tabs {
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
  .tab {
    position: relative;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 26px;
    padding: 8px 24px 6px;
    border-radius: 999px;
    color: var(--ink-soft);
    transition:
      background 160ms ease,
      color 160ms ease;
  }
  .tab-alert {
    position: absolute;
    top: -14px;
    right: -10px;
    display: grid;
    place-items: center;
    min-width: 34px;
    height: 34px;
    padding: 3px 8px 0;
    border-radius: 999px;
    border: 3px solid var(--cloud);
    background: var(--pop);
    color: var(--on-color);
    font-weight: 800;
    font-size: 19px;
    line-height: 1;
  }
  .tab.active {
    background: var(--ink);
    color: var(--cloud);
  }
  .back {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 22px 8px 10px;
    border-radius: 999px;
    background: var(--cloud);
  }
</style>
