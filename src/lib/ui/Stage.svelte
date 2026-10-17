<script>
  /**
   * Escenario fijo de 1920×1080 escalado para llenar la pantalla.
   * Se diseña una sola vez en "píxeles de TV" y se ve igual en la Xbox,
   * en un monitor o en el teléfono.
   */
  let { children } = $props()

  let scale = $state(1)

  function fit() {
    scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
  }

  $effect(() => {
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  })
</script>

<div class="viewport">
  <div class="stage" style:transform="translate(-50%, -50%) scale({scale})">
    {@render children()}
  </div>
</div>

<style>
  .viewport {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: var(--sky);
  }
  .stage {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 1920px;
    height: 1080px;
    transform-origin: center;
    overflow: hidden;
    /* Trama de puntos tipo papel de cuaderno de dibujo */
    background-color: var(--sky);
    background-image:
      radial-gradient(circle at 12% -10%, var(--glow), transparent 42%),
      radial-gradient(circle, var(--sky-deep) 2.5px, transparent 3px);
    background-size:
      100% 100%,
      36px 36px;
  }
</style>
