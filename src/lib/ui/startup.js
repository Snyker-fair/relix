/**
 * What Relix logs and says when it opens: the summary line for the log, and the
 * notices after the checkup.
 */
import { mode } from '../core/bridge.js'
import { monthText } from '../core/monthly.js'
import { systemNotice } from '../core/notices.js'
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
 * welcome tour, which already shows the checkup): what's left to fix, once per
 * session; how last month went, the first time in a new one; what's new in this
 * version, once; and a new version, once per version.
 */
export function showStartNotices() {
  /** @type {string[]} */
  const notices = []
  const system = warnedSystem ? null : systemNotice(systemStatus.summary.errors, systemStatus.appType)
  if (system) {
    warnedSystem = true
    notices.push(system)
  }
  // The first time in a new month: how the last one went
  const lastMonth = library.takeLastMonth()
  if (lastMonth) notices.push(monthText(lastMonth, (id) => library.byId.get(id)?.name ?? id, formatPlaytime))
  for (const line of updates.takeNews(library.all.length > 0) ?? []) notices.push(t(line, { version: VERSION }))
  const version = updates.takeNotice()
  if (version) notices.push(t('Relix {version} ya está disponible: ≡ › Revisión', { version }))
  toasts.queue(notices)
}
