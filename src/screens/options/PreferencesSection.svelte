<script>
  // Options › Preferences: A changes each one, and it's saved by itself
  import { REGION_NAMES } from '../../lib/core/coverMatch.js'
  import { LANGUAGE_NAMES } from '../../lib/core/language.js'
  import { NIGHT, THEME_NAMES } from '../../lib/core/theme.js'
  import { i18n, t } from '../../lib/i18n/i18n.svelte.js'
  import ChannelIcon from '../../lib/ui/ChannelIcon.svelte'
  import { formatHour, plural } from '../../lib/ui/format.js'
  import PadButton from '../../lib/ui/PadButton.svelte'
  import { settings } from '../../lib/ui/settings.svelte.js'
  import { shelf } from '../../lib/ui/shelf.svelte.js'
  import { sound } from '../../lib/ui/sound.js'
  import { theme } from '../../lib/ui/theme.svelte.js'

  /** @typedef {import('./section.js').Hint} Hint */

  /** @type {{ index: number, onMove: (i: number) => void }} */
  let { index, onMove } = $props()

  const ROWS = ['language', 'theme', 'empty', 'sounds', 'region', 'screensaver']
  /** @type {Record<string, string>} */
  const ICONS = { language: 'language', theme: 'theme', empty: 'eye', sounds: 'sound', region: 'globe', screensaver: 'moon' }

  export function rows() {
    return ROWS
  }

  /** @param {Hint[]} common */
  export function hints(common) {
    return [{ button: /** @type {const} */ ('a'), label: t('Cambiar') }, ...common]
  }

  export function activate() {
    const id = ROWS[index]
    if (id === 'empty') settings.toggleEmptyConsoles()
    else if (id === 'sounds') settings.toggleSounds()
    else if (id === 'region') settings.cycleCoverRegion()
    else if (id === 'screensaver') settings.cycleScreensaver()
    else if (id === 'theme') settings.cycleTheme()
    else if (id === 'language') settings.cycleLanguage()
    sound.select() // with the sounds just turned off, this one doesn't play
  }

  /** Whether its value shows as "on" (pink) @param {string} id */
  function isOn(id) {
    if (id === 'empty') return settings.showEmptyConsoles
    if (id === 'sounds') return settings.sounds
    if (id === 'screensaver') return settings.screensaverMinutes > 0
    if (id === 'theme') return settings.theme !== 'light'
    return id !== 'language'
  }
</script>

{#each ROWS as id, i (id)}
  {@const focused = i === index}
  {@const on = isOn(id)}
  <button
    class="row focus-ring"
    class:focused
    style:--tint="#8FA3BF"
    onmouseenter={() => onMove(i)}
    onclick={() => (i === index ? activate() : onMove(i))}
  >
    <span class="badge neutral">
      <ChannelIcon id={ICONS[id]} color="currentColor" size={52} />
    </span>
    <span class="text">
      {#if id === 'language'}
        <!-- In both languages at once, so whoever can't read the one shown finds it -->
        <strong>{t('Idioma · Language')}</strong>
        <span>
          {settings.language === 'auto'
            ? t('Automático usa el de la Xbox · ahora {language}', { language: LANGUAGE_NAMES[i18n.current] })
            : t('Automático, español o inglés')}
        </span>
      {:else if id === 'theme'}
        <strong>{t('Tema')}</strong>
        <span>
          {settings.theme === 'auto'
            ? t('Oscuro de {from} a {to} · ahora {now}', {
                from: formatHour(NIGHT.from),
                to: formatHour(NIGHT.to),
                now: theme.current === 'dark' ? t('oscuro') : t('claro'),
              })
            : t('Claro, oscuro o automático según la hora')}
        </span>
      {:else if id === 'empty'}
        <strong>{t('Consolas sin juegos')}</strong>
        <span>
          {on
            ? t('Se muestran en el inicio aunque estén vacías')
            : shelf.hiddenCount > 0
              ? t('Ocultas en el inicio (ahora {channels})', {
                  channels: plural(shelf.hiddenCount, 'canal oculto', 'canales ocultos'),
                })
              : t('Ocultas en el inicio')}
        </span>
      {:else if id === 'sounds'}
        <strong>{t('Sonidos de la interfaz')}</strong>
        <span>{t('El tic al moverte y el pop al elegir')}</span>
      {:else if id === 'screensaver'}
        <strong>{t('Protector de pantalla')}</strong>
        <span>{t('Tus juegos, uno tras otro, cuando dejas el control quieto')}</span>
      {:else}
        <strong>{t('Región de las portadas')}</strong>
        <span>{t('Para los juegos cuyo archivo no dice la región')}</span>
      {/if}
    </span>
    <span class="state">
      {#if focused}<PadButton name="a" size={30} />{/if}
      <span class="value" class:on>
        {#if id === 'language'}
          {settings.language === 'auto' ? t('Automático') : LANGUAGE_NAMES[settings.language]}
        {:else if id === 'theme'}
          {t(THEME_NAMES[settings.theme])}
        {:else if id === 'empty'}
          {on ? t('Visibles') : t('Ocultas')}
        {:else if id === 'sounds'}
          {on ? t('Activados') : t('Desactivados')}
        {:else if id === 'screensaver'}
          {settings.screensaverMinutes > 0 ? t('A los {n} min', { n: settings.screensaverMinutes }) : t('Nunca')}
        {:else}
          {t(REGION_NAMES[settings.coverRegion])}
        {/if}
      </span>
    </span>
  </button>
{/each}
