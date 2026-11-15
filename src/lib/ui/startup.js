/**
 * What Relix logs and says when it opens: the summary line for the log, and the
 * notices after the checkup.
 */
import { mode } from '../core/bridge.js'
import { monthText } from '../core/monthly.js'
import { startNoticesFor, systemNotice } from '../core/notices.js'
import { NEWS } from '../core/updates.js'
import { VERSION } from '../core/version.js'
import { t } from '../i18n/i18n.svelte.js'
import { formatPlaytime, plural } from './format.js'
import { library } from './library.svelte.js'
import { systemStatus } from './systemStatus.svelte.js'
import { theme } from './theme.svelte.js'
import { toasts } from './toasts.svelte.js'
import { updates } from './updates.svelte.js'

/** "Relix 1.0.0 · Xbox · E:\roms · 57 games on 12 consoles · light theme · Spanish" */
export function startSummary() {
  const consoles = new Set(library.all.map((g) => g.system)).size
  return [
    `Relix ${VERSION}`,
    mode === 'xbox' ? 'Xbox' : t('navegador'),
    library.romRoot,
    t('{games} en {consoles}', {
      games: plural(library.all.length, 'juego', 'juegos'),
      consoles: plural(consoles, 'consola', 'consolas'),
    }),
    theme.current === 'dark' ? t('tema oscuro') : t('tema claro'),
    t('español'),
  ].join(' · ')
}

let warnedSystem = false

/**
 * After the checkup, one notice after another (App.svelte doesn't call it during the
 * welcome tour, which already shows the checkup), two at most: what's left to fix,
 * once per session; how last month went, the first time in a new one; what's new
 * in this version, once; and a new version, once per version. What doesn't fit
 * waits for the next time Relix opens.
 */
export function showStartNotices() {
  const system = warnedSystem ? null : systemNotice(systemStatus.summary.errors, systemStatus.appType)
  toasts.queue(
    startNoticesFor([
      {
        size: system ? 1 : 0,
        take: () => {
          warnedSystem = true
          return system ? [system] : []
        },
      },
      {
        size: 1,
        take: () => {
          const lastMonth = library.takeLastMonth()
          return lastMonth ? [monthText(lastMonth, (id) => library.byId.get(id)?.name ?? id, formatPlaytime)] : []
        },
      },
      {
        size: NEWS[VERSION]?.length ?? 0,
        take: () => (updates.takeNews(library.all.length > 0) ?? []).map((line) => t(line, { version: VERSION })),
      },
      {
        size: 1,
        take: () => {
          const version = updates.takeNotice()
          return version ? [t('Relix {version} ya está disponible: ≡ › Revisión', { version })] : []
        },
      },
    ]),
  )
}
