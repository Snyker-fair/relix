<script>
  /**
   * Pantallas de carga y de error del inicio.
   * El error siempre ofrece una salida: A vuelve a intentar.
   */
  import HintBar from '../lib/ui/HintBar.svelte'
  import { pushHandler } from '../lib/ui/input.js'
  import { library } from '../lib/ui/library.svelte.js'
  import Logo from '../lib/ui/Logo.svelte'
  import { sound } from '../lib/ui/sound.js'
  import { t } from '../lib/i18n/i18n.svelte.js'

  $effect(() =>
    pushHandler((action) => {
      if (library.status === 'error' && action === 'a') {
        sound.select()
        library.load()
      }
    }),
  )
</script>

<div class="status">
  <Logo size={72} />

  {#if library.status === 'loading'}
    <h1>{t('Desempolvando tus reliquias…')}</h1>
    {#if library.progress}
      <p>
        {t('Escaneando {console} ({n} de {total})', {
          console: library.progress.name,
          n: library.progress.current,
          total: library.progress.total,
        })}
      </p>
      <div class="bar" aria-hidden="true">
        <span style:width="{(library.progress.current / library.progress.total) * 100}%"></span>
      </div>
    {/if}
  {:else}
    <h1>{t('No pude leer tu biblioteca')}</h1>
    <p class="error">{library.error}</p>
    <ol>
      <li>{t('Conecta el disco USB a la Xbox.')}</li>
      <li>{t('Revisa que tenga la carpeta')} <code>roms</code> {t('en la raíz.')}</li>
      <li>{t('Presiona')} <strong>A</strong> {t('para volver a intentar.')}</li>
    </ol>
  {/if}
</div>

{#if library.status === 'error'}
  <HintBar hints={[{ button: 'a', label: t('Reintentar') }]} />
{/if}

<style>
  .status {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    text-align: center;
  }
  h1 {
    margin: 48px 0 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 64px;
    line-height: 1.05;
    letter-spacing: -0.02em;
  }
  p {
    margin: 18px 0 0;
    font-size: 30px;
    font-weight: 600;
    color: var(--ink-soft);
  }
  p.error {
    max-width: 1100px;
    color: var(--ink);
  }
  .bar {
    width: 520px;
    height: 16px;
    margin-top: 28px;
    border-radius: 999px;
    background: var(--cloud);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--pop);
    transition: width 300ms ease;
  }
  ol {
    margin: 36px 0 0;
    padding: 28px 44px 28px 72px;
    border-radius: 36px;
    background: var(--cloud);
    text-align: left;
    font-size: 28px;
    line-height: 1.7;
  }
  code {
    font-family: var(--font-body);
    font-weight: 700;
    padding: 2px 12px;
    border-radius: 12px;
    background: var(--sky);
  }
</style>
