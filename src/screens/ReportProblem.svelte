<script>
  /**
   * Options › Checkup › Report a problem: a QR that opens GitHub's form on the
   * phone, already filled in (core/report.js). Next to it, what goes in it, so
   * nothing is sent that the person hasn't seen.
   *
   *   B  back
   */
  import { untrack } from 'svelte'
  import { readLog } from '../lib/core/bridge.js'
  import { reportUrl } from '../lib/core/report.js'
  import { formatBytes } from '../lib/core/systemCheck.js'
  import { VERSION } from '../lib/core/version.js'
  import { i18n, t } from '../lib/i18n/i18n.svelte.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import { diagnostics } from '../lib/ui/diagnostics.svelte.js'
  import HintBar from '../lib/ui/HintBar.svelte'
  import { pushHandler } from '../lib/ui/input.js'
  import QrCode from '../lib/ui/QrCode.svelte'
  import { sound } from '../lib/ui/sound.js'
  import { startSummary } from '../lib/ui/startup.js'
  import { systemStatus } from '../lib/ui/systemStatus.svelte.js'

  /** @type {{ onClose: () => void }} */
  let { onClose } = $props()

  /** Lines of the log asked for: the address keeps the newest that fit */
  const LOG_LINES = 30

  /** Relix and the Xbox, a line each */
  const about = $derived.by(() => {
    const lines = [startSummary()]
    const memory = systemStatus.shell?.memory
    const type = systemStatus.appType
    if (memory?.xbox && type) {
      lines.push(
        t('Tipo {type} · memoria: {usage} de {limit}', {
          type: type === 'game' ? 'Game' : 'App',
          usage: formatBytes(memory.usage),
          limit: formatBytes(memory.expectedLimit),
        }),
      )
    }
    const problems = systemStatus.checks.filter((c) => c.state === 'error' || c.state === 'warn').map((c) => c.title)
    lines.push(problems.length > 0 ? t('Revisión: {problems}', { problems: problems.join(' · ') }) : t('Revisión: todo en orden'))
    return lines
  })

  /** null while it's read */
  let log = $state(/** @type {string[] | null} */ (null))
  // What's pending is written first, so the lines include the latest
  $effect(() => {
    untrack(() => {
      diagnostics.flush()
      setTimeout(async () => {
        try {
          log = await readLog(LOG_LINES)
        } catch {
          log = []
        }
      }, 400)
    })
  })

  const url = $derived(log === null ? null : reportUrl({ version: VERSION, language: i18n.current, about, log }))
  /** What the form gets, as it's sent */
  const sent = $derived(url ? (new URL(url).searchParams.get('log') ?? '') : '')

  $effect(() =>
    pushHandler((action) => {
      if (action === 'b' || action === 'start') (sound.back(), onClose())
    }),
  )
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<section class="panel" aria-label={t('Reportar un problema')}>
  <header>
    <span class="badge"><ChannelIcon id="report" color="currentColor" size={52} /></span>
    <div class="title">
      <h2>{t('Reportar un problema')}</h2>
      <p>{t('Escanéalo con el celular: se abre el formulario de Relix en GitHub, ya con estos datos.')}</p>
    </div>
  </header>

  <div class="body">
    <div class="qr">
      {#if url}
        <QrCode text={url} size={440} ecc="L" />
      {:else}
        <span class="spinner" aria-hidden="true"></span>
      {/if}
    </div>
    <div class="side">
      <h3>{t('Lo que lleva')}</h3>
      <pre>{sent || t('Leyendo el registro…')}</pre>
      <p class="note">
        {t(
          'Lo ves antes de enviarlo y puedes cambiarlo: trae los nombres de tus juegos y las rutas de tu USB. Cuenta qué pasó y, si puedes, agrega una foto de la pantalla.',
        )}
      </p>
      <p class="where">
        {t('Necesitas una cuenta de GitHub (gratis). Sin QR:')} <code>github.com/Snyker-fair/relix/issues</code>
      </p>
    </div>
  </div>
</section>

<div class="hints-layer">
  <HintBar surface hints={[{ button: 'b', label: t('Volver') }]} />
</div>

<style>
  .backdrop {
    position: absolute;
    inset: 0;
    background: rgb(var(--shadow) / 0.45);
    z-index: 10;
    animation: fade 180ms ease both;
  }
  .panel {
    position: absolute;
    left: 112px;
    right: 112px;
    top: 80px;
    bottom: 140px;
    display: flex;
    flex-direction: column;
    padding: 36px 44px 32px;
    border-radius: 48px;
    background: var(--cloud);
    box-shadow: 0 40px 80px -40px rgb(var(--shadow) / 0.7);
    z-index: 11;
    animation: rise 260ms var(--spring) both;
  }
  header {
    display: flex;
    align-items: center;
    gap: 24px;
    padding-bottom: 22px;
    border-bottom: 3px dashed var(--sky);
  }
  .badge {
    display: grid;
    place-items: center;
    flex: none;
    width: 84px;
    height: 84px;
    border-radius: 26px;
    background: var(--sky);
  }
  h2 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 40px;
    line-height: 1.1;
  }
  .title p {
    margin: 4px 0 0;
    font-size: 22px;
    color: var(--ink-soft);
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 44px;
    margin-top: 28px;
  }
  /* White around the code: cameras read it well even with a bright TV */
  .qr {
    display: grid;
    place-items: center;
    flex: none;
    width: 476px;
    height: 476px;
    border-radius: 32px;
    background: #ffffff;
  }
  .side {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  h3 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 28px;
  }
  pre {
    flex: 1;
    min-height: 0;
    margin: 12px 0 0;
    padding: 18px 22px;
    border-radius: 24px;
    background: var(--sky);
    font-family: var(--font-body);
    font-size: 18px;
    line-height: 1.45;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    overflow: hidden;
  }
  .note,
  .where {
    margin: 16px 0 0;
    font-size: 21px;
    line-height: 1.4;
    color: var(--ink-soft);
  }
  .where {
    margin-top: 8px;
  }
  code {
    font-family: var(--font-body);
    font-weight: 700;
    color: var(--ink);
  }
  .spinner {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 7px solid var(--pop-soft);
    border-top-color: var(--pop);
    animation: spin 700ms linear infinite;
  }
  .hints-layer {
    position: absolute;
    inset: 0;
    z-index: 11;
    pointer-events: none;
  }
  .hints-layer :global(.hints) {
    pointer-events: auto;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @keyframes rise {
    from {
      transform: translateY(40px);
      opacity: 0;
    }
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
