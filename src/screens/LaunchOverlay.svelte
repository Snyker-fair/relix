<script>
  import { mode } from '../lib/core/bridge.js'
  import { getPlatform } from '../lib/core/platforms.js'
  import { t } from '../lib/i18n/i18n.svelte.js'
  import CoverArt from '../lib/ui/CoverArt.svelte'
  import HintBar from '../lib/ui/HintBar.svelte'
  import { pushHandler } from '../lib/ui/input.js'
  import { sound } from '../lib/ui/sound.js'

  /** @type {{ game: any, uri: string, emulatorName: string, onClose: () => void }} */
  let { game, uri, emulatorName, onClose } = $props()

  const platform = $derived(getPlatform(game.system))

  $effect(() =>
    pushHandler((action) => {
      if (action === 'b' || action === 'a') {
        sound.back()
        onClose()
      }
    }),
  )
  // En la Xbox, Relix queda en segundo plano mientras corre el emulador y la
  // consola la vuelve a abrir con launchOnExit=relix:. El shell avisa con el
  // evento 'resumed' y App.svelte cierra este overlay.
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-label={t('Abriendo {game}', { game: game.name })}>
  <div class="card" style:--tint={platform.color}>
    <div class="cover">
      <CoverArt {game} {platform} width={260} />
    </div>
    <div class="text">
      <p class="kicker">{t('Abriendo {emulator}', { emulator: emulatorName })}</p>
      <h1>{game.name}</h1>

      {#if mode === 'browser'}
        <p class="explain">
          {t(
            'Esto es una vista previa en el navegador. En la Xbox, Relix abriría esta dirección y la consola volvería aquí al cerrar el emulador:',
          )}
        </p>
        <code>{uri}</code>
      {:else}
        <p class="explain">{t('Al cerrar el emulador vuelves aquí.')}</p>
      {/if}
    </div>
  </div>
  <HintBar hints={[{ button: 'b', label: t('Volver') }]} />
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgb(var(--sky-rgb) / 0.72);
    backdrop-filter: blur(14px);
    animation: fade 180ms ease both;
    z-index: 10;
  }
  .card {
    display: flex;
    gap: 56px;
    align-items: center;
    width: 1360px;
    padding: 56px 64px;
    border-radius: 64px;
    background: var(--cloud);
    box-shadow:
      0 0 0 10px color-mix(in oklab, var(--tint) 35%, var(--cloud)),
      0 50px 90px -50px rgb(var(--shadow) / 0.6);
    animation: pop 420ms var(--spring) both;
  }
  .cover {
    transform: rotate(-5deg);
    animation: wiggle 900ms ease-in-out 400ms infinite alternate;
  }
  .cover :global(.cover) {
    border-radius: 28px;
  }
  .text {
    min-width: 0;
  }
  .kicker {
    margin: 0;
    font-weight: 700;
    font-size: 28px;
    color: var(--ink-soft);
  }
  h1 {
    margin: 6px 0 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 72px;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .explain {
    margin: 28px 0 14px;
    font-size: 25px;
    line-height: 1.45;
    color: var(--ink-soft);
  }
  code {
    display: block;
    padding: 18px 22px;
    border-radius: 20px;
    background: var(--sky);
    font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
    font-size: 21px;
    line-height: 1.45;
    word-break: break-all;
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @keyframes pop {
    from {
      transform: scale(0.85);
      opacity: 0;
    }
  }
  @keyframes wiggle {
    to {
      transform: rotate(4deg) translateY(-8px);
    }
  }
</style>
