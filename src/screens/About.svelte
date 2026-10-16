<script>
  /**
   * Opciones › Acerca de: qué emulador abre cada consola, dónde guarda Relix
   * las cosas en el USB, un resumen de la biblioteca y los créditos.
   * Es solo para leer: no hay nada que enfocar.
   */
  import { PLATFORMS } from '../lib/core/platforms.js'
  import ChannelIcon from '../lib/ui/ChannelIcon.svelte'
  import { collections } from '../lib/ui/collections.svelte.js'
  import { library } from '../lib/ui/library.svelte.js'

  /** "E:\roms" -> "E:" */
  const drive = $derived(library.romRoot.replace(/[\\/]+roms[\\/]*$/i, '') || 'E:')

  const paths = $derived([
    { label: 'Juegos', path: `${library.romRoot}\\<consola>` },
    { label: 'Portadas', path: `${drive}\\ES-DE\\downloaded_media` },
    { label: 'Colecciones', path: `${drive}\\ES-DE\\collections` },
    { label: 'Caché (se puede borrar)', path: `${drive}\\relix\\cache` },
  ])

  const stats = $derived.by(() => {
    const covers = PLATFORMS.reduce((n, p) => n + library.coverCount(p.id).withCover, 0)
    const consoles = PLATFORMS.filter((p) => library.gamesFor(p.id).length > 0).length
    return [
      { value: library.all.length, label: library.all.length === 1 ? 'juego' : 'juegos' },
      { value: consoles, label: consoles === 1 ? 'consola' : 'consolas' },
      { value: covers, label: 'con portada' },
      { value: library.favorites.length, label: library.favorites.length === 1 ? 'favorito' : 'favoritos' },
      { value: collections.visible.length, label: collections.visible.length === 1 ? 'colección' : 'colecciones' },
      { value: library.hiddenCount(), label: library.hiddenCount() === 1 ? 'oculto' : 'ocultos' },
    ]
  })

  /** @param {import('../lib/core/platforms.js').Platform} p */
  function launchDetail(p) {
    if (!p.launcher) return 'Sin lanzador todavía'
    if (p.launcher.kind === 'retroarch') return `${p.launcher.protocol}: · ${p.launcher.core}`
    return `${p.launcher.protocol}: · ${p.launcher.exe}`
  }
</script>

<section class="about" aria-label="Acerca de Relix">
  <div class="column">
    <article class="card">
      <h3>Emuladores</h3>
      <ul class="list">
        {#each PLATFORMS as p (p.id)}
          <li class="emu">
            <span class="badge" style:background={p.color}>
              <ChannelIcon id={p.id} color={p.ink} size={32} />
            </span>
            <span class="text">
              <strong>{p.name}</strong>
              <span>{p.emulatorName}</span>
            </span>
            <code class:muted={!p.launcher}>{launchDetail(p)}</code>
          </li>
        {/each}
      </ul>
    </article>

    <article class="card">
      <h3>Tu biblioteca</h3>
      <ul class="stats">
        {#each stats as s (s.label)}
          <li><strong>{s.value}</strong><span>{s.label}</span></li>
        {/each}
      </ul>
    </article>
  </div>

  <div class="column">
    <article class="card">
      <h3>En tu USB</h3>
      <ul class="list">
        {#each paths as item (item.label)}
          <li class="path">
            <span class="label">{item.label}</span>
            <code>{item.path}</code>
          </li>
        {/each}
      </ul>
    </article>

    <article class="card">
      <h3>Créditos</h3>
      <ul class="credits">
        <li><strong>Portadas:</strong> libretro-thumbnails</li>
        <li><strong>Formato:</strong> compatible con ES-DE</li>
        <li><strong>Letras:</strong> Baloo 2 y Nunito (SIL OFL)</li>
        <li><strong>Hecho con:</strong> Svelte, C# y WebView2</li>
      </ul>
    </article>
  </div>
</section>

<style>
  .about {
    position: absolute;
    left: 776px;
    right: 112px;
    top: 170px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  /* todo cabe entre el encabezado y la barra de pistas (170 a 960 px) */
  .column {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
  }
  .card {
    padding: 22px 28px 26px;
    border-radius: 34px;
    background: var(--cloud);
  }
  h3 {
    margin: 0 0 14px;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 30px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .emu {
    display: grid;
    grid-template-columns: 52px 1fr;
    grid-template-rows: auto auto;
    column-gap: 16px;
    align-items: center;
  }
  .badge {
    grid-row: span 2;
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 16px;
  }
  .text {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
  }
  .text strong {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 23px;
    white-space: nowrap;
  }
  .text span {
    font-size: 19px;
    color: var(--ink-soft);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  code {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 18px;
    color: var(--ink-soft);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  code.muted {
    font-style: italic;
  }
  .path {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 16px;
    border-radius: 18px;
    background: var(--sky);
  }
  .path .label {
    font-weight: 700;
    font-size: 19px;
    color: var(--ink-soft);
  }
  .path code {
    font-size: 22px;
    color: var(--ink);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .stats li {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 6px;
    border-radius: 18px;
    background: var(--sky);
  }
  .stats strong {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 32px;
    line-height: 1.1;
  }
  .stats span {
    font-weight: 700;
    font-size: 18px;
    color: var(--ink-soft);
  }
  .credits {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 20px;
    line-height: 1.4;
    color: var(--ink-soft);
  }
  .credits strong {
    color: var(--ink);
  }
</style>
