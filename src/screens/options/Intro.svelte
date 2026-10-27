<script>
  // Options' left panel: what the section on screen is for, and its numbers
  import { mode } from '../../lib/core/bridge.js'
  import { REGION_NAMES } from '../../lib/core/coverMatch.js'
  import { PLATFORMS } from '../../lib/core/platforms.js'
  import { BUILD_DATE, VERSION } from '../../lib/core/version.js'
  import { t } from '../../lib/i18n/i18n.svelte.js'
  import ChannelIcon from '../../lib/ui/ChannelIcon.svelte'
  import { emulators } from '../../lib/ui/emulators.svelte.js'
  import { formatDate, plural } from '../../lib/ui/format.js'
  import { library } from '../../lib/ui/library.svelte.js'
  import PadButton from '../../lib/ui/PadButton.svelte'
  import { settings } from '../../lib/ui/settings.svelte.js'
  import { systemStatus } from '../../lib/ui/systemStatus.svelte.js'
  import { updates } from '../../lib/ui/updates.svelte.js'

  /** @type {{ section: string }} */
  let { section } = $props()

  const totalGames = $derived(PLATFORMS.reduce((n, p) => n + library.gamesFor(p.id).length, 0))
  /** How many different emulator apps the Xbox has (RetroArch counts once) */
  const installedApps = $derived(
    new Set(
      PLATFORMS.flatMap((p) => p.emulators)
        .filter((e) => emulators.isInstalled(e) === true)
        .map((e) => e.launcher.protocol),
    ).size,
  )
  const coverTotals = $derived(
    PLATFORMS.reduce(
      (sum, p) => {
        const count = library.coverCount(p.id)
        return { withCover: sum.withCover + count.withCover, total: sum.total + count.total }
      },
      { withCover: 0, total: 0 },
    ),
  )
  /** "2026-10-16" -> "16 oct 2026" in Spanish ("Oct 16, 2026" in English) */
  const buildDate = $derived(
    BUILD_DATE ? formatDate(new Date(`${BUILD_DATE}T12:00:00`), { day: 'numeric', month: 'short', year: 'numeric' }) : '',
  )
</script>

<section class="intro">
  <span class="intro-icon"><ChannelIcon id="options" color="currentColor" size={84} /></span>
  <h1>{t('Opciones')}</h1>
  {#if section === 'library'}
    <h2>{t('Biblioteca')}</h2>
    <p>
      {t(
        'Relix guarda la lista de juegos de cada consola para abrir al instante. Escanea una consola cuando agregues o quites juegos de su carpeta: también busca sus portadas y su información.',
      )}
    </p>
    <ul class="chips">
      <li>{plural(totalGames, 'juego', 'juegos')}</li>
      <li>{library.romRoot}</li>
    </ul>
  {:else if section === 'consoles'}
    <h2>{t('Consolas')}</h2>
    <p>
      {t('Con qué emulador se abre cada consola. Para un juego puntual, en la biblioteca usa')}
      <strong>{t('Y › Abrir con…')}</strong>
    </p>
    <ul class="chips">
      <li>{plural(PLATFORMS.length, 'consola', 'consolas')}</li>
      {#if emulators.installed}
        <li>{plural(installedApps, 'emulador instalado', 'emuladores instalados')}</li>
      {/if}
    </ul>
  {:else if section === 'check'}
    {@const { errors, warnings } = systemStatus.summary}
    <h2>{t('Revisión')}</h2>
    <p>
      {t('Relix revisa tu USB, los emuladores y las BIOS. Si algo falta,')} <PadButton name="a" size={26} />
      {t('abre la guía que explica cómo dejarlo listo.')}
    </p>
    <ul class="chips">
      {#if systemStatus.running && !systemStatus.checkedAt}
        <li>{t('Revisando…')}</li>
      {:else if errors + warnings === 0}
        <li class="ok">{t('Todo en orden')}</li>
      {:else}
        {#if errors > 0}<li class="error">{plural(errors, 'cosa por arreglar', 'cosas por arreglar')}</li>{/if}
        {#if warnings > 0}<li class="warn">{plural(warnings, 'aviso', 'avisos')}</li>{/if}
      {/if}
    </ul>
    <p class="note">
      {t(
        'Relix solo ve el USB: si pusiste una BIOS dentro del emulador con el Device Portal, aquí sale como aviso aunque funcione.',
      )}
    </p>
  {:else if section === 'covers'}
    <h2>{t('Portadas')}</h2>
    <p>
      {t(
        'Relix las busca en libretro, las mismas de RetroArch, y las guarda en el USB junto a las de ES-DE. Si no está seguro de cuál es, te deja elegir. También baja una captura de cada juego para el fondo de su ficha.',
      )}
    </p>
    <ul class="chips">
      <li>{t('{n} de {total} con portada', { n: coverTotals.withCover, total: coverTotals.total })}</li>
      <li>{t('Región: {region}', { region: t(REGION_NAMES[settings.coverRegion]) })}</li>
    </ul>
  {:else if section === 'about'}
    <h2>{t('Acerca de')}</h2>
    <p>
      {t('Tus reliquias, listas para jugar: un lanzador para tus emuladores en la Xbox que lee tu USB como lo deja ES-DE.')}
    </p>
    <ul class="chips">
      <li>{t('Versión {version}', { version: VERSION })}</li>
      {#if updates.available && updates.latest}
        <li class="new">{t('Hay una versión nueva: {version}', { version: updates.latest.version })}</li>
      {/if}
      <!-- With a new version, its notice takes the date's place (otherwise the credits don't fit) -->
      {#if buildDate && !updates.available}<li>{t('Compilada el {date}', { date: buildDate })}</li>{/if}
      <li>{mode === 'xbox' ? t('Xbox · Modo Desarrollador') : t('Demo en el navegador')}</li>
    </ul>
    <div class="credits">
      <strong>© 2026 snyker-fair</strong>
      <!-- The notice the GPL asks for in an interactive program: author, license, no warranty and where to read it -->
      <p class="legal">
        {t('Licencia GPL-3.0 o posterior, sin garantía: compártelo y modifícalo bajo sus términos (ver LICENSE).')}
      </p>
      <p>{t('Portadas de libretro · formato de ES-DE · letras SIL OFL')}</p>
    </div>
  {:else}
    <h2>{t('Preferencias')}</h2>
    <p>
      {t(
        'El idioma, el tema claro u oscuro, qué se ve en el inicio, cómo suena Relix, qué portadas prefieres y cuándo aparece el protector de pantalla. Los cambios se guardan solos.',
      )}
    </p>
  {/if}
</section>

<style>
  .intro {
    position: absolute;
    left: 112px;
    top: 170px;
    width: 600px;
    height: 790px;
    padding: 44px;
    border-radius: 48px;
    background: var(--cloud);
    box-shadow: 0 30px 60px -40px rgb(var(--shadow) / 0.5);
  }
  .intro-icon {
    display: grid;
    place-items: center;
    width: 140px;
    height: 140px;
    border-radius: 50%;
    background: var(--sky);
  }
  h1 {
    margin: 30px 0 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 72px;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  h2 {
    margin: 28px 0 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 36px;
    line-height: 1.1;
  }
  .intro p {
    margin: 12px 0 0;
    font-size: 25px;
    line-height: 1.45;
    color: var(--ink-soft);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    list-style: none;
    margin: 26px 0 0;
    padding: 0;
  }
  .chips li {
    padding: 6px 18px 8px;
    border-radius: 999px;
    background: var(--sky);
    font-weight: 700;
    font-size: 22px;
  }
  .chips li.ok {
    background: var(--ok-bg);
    color: var(--ok-ink);
  }
  .chips li.error {
    background: var(--pop);
    color: var(--on-color);
  }
  .chips li.warn {
    background: var(--sun);
  }
  .chips li.new {
    background: var(--btn-x);
    color: #ffffff;
  }
  .intro p :global(.pad) {
    vertical-align: -4px;
    margin: 0 2px;
  }
  /* a footnote on the Checkup panel */
  .intro p.note {
    margin-top: 26px;
    padding-top: 18px;
    border-top: 3px dashed var(--sky);
    font-size: 20px;
    line-height: 1.4;
  }
  /* credits, at the foot of the About panel */
  .credits {
    margin-top: 18px;
    padding-top: 14px;
    border-top: 3px dashed var(--sky);
  }
  .credits strong {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 24px;
  }
  .intro .credits p {
    margin: 4px 0 0;
    font-size: 19px;
    line-height: 1.4;
  }
  .intro .credits p.legal {
    color: var(--ink);
  }
</style>
