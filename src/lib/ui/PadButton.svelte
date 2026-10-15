<script>
  /** Ícono de un botón del control de Xbox (A, B, X, Y, LB, RB, Menú). */
  let { name, size = 34 } = $props()
  const COLORS = { a: 'var(--btn-a)', b: 'var(--btn-b)', x: 'var(--btn-x)', y: 'var(--btn-y)' }
  const isBumper = $derived(name === 'lb' || name === 'rb')
  const isMenu = $derived(name === 'start')
</script>

<span
  class="pad"
  class:bumper={isBumper}
  style:--c={COLORS[name] ?? 'var(--ink)'}
  style:--s="{size}px"
  aria-label={isMenu ? 'Botón Menú' : `Botón ${name.toUpperCase()}`}
>
  {#if isMenu}
    <!-- el botón Menú del control tiene tres rayas -->
    <svg viewBox="0 0 20 20" width={size * 0.5} height={size * 0.5} aria-hidden="true">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="white" stroke-width="2.6" stroke-linecap="round" />
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
</style>
