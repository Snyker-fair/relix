<script>
  /** Ícono de un botón del control de Xbox (A, B, X, Y, LB, RB, LT, RT, Menú, Vista). */
  let { name, size = 34 } = $props()
  const COLORS = { a: 'var(--btn-a)', b: 'var(--btn-b)', x: 'var(--btn-x)', y: 'var(--btn-y)' }
  const isBumper = $derived(name === 'lb' || name === 'rb')
  const isTrigger = $derived(name === 'lt' || name === 'rt')
  const isMenu = $derived(name === 'start')
  const isView = $derived(name === 'view')
  const LABELS = { start: 'Botón Menú', view: 'Botón Vista' }
</script>

<span
  class="pad"
  class:bumper={isBumper}
  class:trigger={isTrigger}
  style:--c={COLORS[name] ?? 'var(--ink)'}
  style:--s="{size}px"
  aria-label={LABELS[name] ?? `Botón ${name.toUpperCase()}`}
>
  {#if isMenu}
    <!-- el botón Menú del control tiene tres rayas -->
    <svg viewBox="0 0 20 20" width={size * 0.5} height={size * 0.5} aria-hidden="true">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="white" stroke-width="2.6" stroke-linecap="round" />
    </svg>
  {:else if isView}
    <!-- el botón Vista: dos ventanas superpuestas -->
    <svg viewBox="0 0 20 20" width={size * 0.55} height={size * 0.55} aria-hidden="true">
      <rect x="2.5" y="6.5" width="10" height="10" rx="2" fill="none" stroke="white" stroke-width="2.2" />
      <path d="M7 4.5V4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 18 4v8a1.5 1.5 0 0 1-1.5 1.5H15" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" />
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
    color: white;
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
  /* gatillo: redondeado arriba, como el LT/RT del control */
  .trigger {
    width: calc(var(--s) * 1.3);
    border-radius: calc(var(--s) * 0.55) calc(var(--s) * 0.55) calc(var(--s) * 0.22) calc(var(--s) * 0.22);
    font-size: calc(var(--s) * 0.42);
  }
</style>
