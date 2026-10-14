<script>
  /** Ícono de un botón del control de Xbox (A, B, X, Y, LB, RB). */
  let { name, size = 34 } = $props()
  const COLORS = { a: 'var(--btn-a)', b: 'var(--btn-b)', x: 'var(--btn-x)', y: 'var(--btn-y)' }
  const isBumper = $derived(name === 'lb' || name === 'rb')
</script>

<span
  class="pad"
  class:bumper={isBumper}
  style:--c={COLORS[name] ?? 'var(--ink)'}
  style:--s="{size}px"
  aria-label="Botón {name.toUpperCase()}"
>
  {name.toUpperCase()}
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
  .bumper {
    width: calc(var(--s) * 1.6);
    border-radius: calc(var(--s) * 0.35);
    font-size: calc(var(--s) * 0.42);
  }
</style>
