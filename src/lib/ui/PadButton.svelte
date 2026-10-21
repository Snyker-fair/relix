<script>
  /** The icon of an Xbox controller button (A, B, X, Y, LB, RB, LT, RT, Menu, View, the right stick, the d-pad). */
  import { t } from '../i18n/i18n.svelte.js'

  let { name, size = 34 } = $props()
  const COLORS = { a: 'var(--btn-a)', b: 'var(--btn-b)', x: 'var(--btn-x)', y: 'var(--btn-y)' }
  const isBumper = $derived(name === 'lb' || name === 'rb')
  const isTrigger = $derived(name === 'lt' || name === 'rt')
  const isMenu = $derived(name === 'start')
  const isView = $derived(name === 'view')
  const isStick = $derived(name === 'rs')
  /** The d-pad: an arrow, rotated to where it points */
  const ARROWS = { up: 0, right: 90, down: 180, left: 270 }
  const arrow = $derived(/** @type {Record<string, number>} */ (ARROWS)[name])
  const label = $derived(
    name === 'start'
      ? t('Botón Menú')
      : name === 'view'
        ? t('Botón Vista')
        : isStick
          ? t('Stick derecho')
          : arrow !== undefined
            ? t('Cruceta')
            : t('Botón {name}', { name: name.toUpperCase() }),
  )
</script>

<span
  class="pad"
  class:bumper={isBumper}
  class:trigger={isTrigger}
  style:--c={COLORS[name] ?? 'var(--ink)'}
  style:--t={COLORS[name] ? '#ffffff' : 'var(--cloud)'}
  style:--s="{size}px"
  aria-label={label}
>
  {#if isMenu}
    <!-- the controller's Menu button has three lines -->
    <svg viewBox="0 0 20 20" width={size * 0.5} height={size * 0.5} aria-hidden="true">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
    </svg>
  {:else if isView}
    <!-- the View button: two overlapping windows -->
    <svg viewBox="0 0 20 20" width={size * 0.55} height={size * 0.55} aria-hidden="true">
      <rect x="2.5" y="6.5" width="10" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2.2" />
      <path d="M7 4.5V4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 18 4v8a1.5 1.5 0 0 1-1.5 1.5H15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
    </svg>
  {:else if isStick}
    <!-- the right stick, pressed: its round cap with an R -->
    <svg viewBox="0 0 20 20" width={size * 0.78} height={size * 0.78} aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.8" />
      <text x="10" y="14" text-anchor="middle" font-size="10.5" font-weight="800" fill="currentColor">R</text>
    </svg>
  {:else if arrow !== undefined}
    <svg viewBox="0 0 20 20" width={size * 0.5} height={size * 0.5} aria-hidden="true" style:rotate="{arrow}deg">
      <path d="M10 3.5 17 14H3Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
    </svg>
  {:else}
    {name.toUpperCase()}
  {/if}
</span>

<style>
  .pad {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: var(--s);
    height: var(--s);
    border-radius: 50%;
    background: var(--c);
    /* white on A, B, X and Y; on the neutral ones (ink), the surface color */
    color: var(--t);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: calc(var(--s) * 0.55);
    line-height: 1;
    padding-top: 0.12em;
  }
  .pad:has(svg) {
    padding-top: 0;
  }
  .bumper {
    width: calc(var(--s) * 1.6);
    border-radius: calc(var(--s) * 0.35);
    font-size: calc(var(--s) * 0.42);
  }
  /* trigger: rounded on top, like the controller's LT/RT */
  .trigger {
    width: calc(var(--s) * 1.3);
    border-radius: calc(var(--s) * 0.55) calc(var(--s) * 0.55) calc(var(--s) * 0.22) calc(var(--s) * 0.22);
    font-size: calc(var(--s) * 0.42);
  }
</style>
