/**
 * The new-version notice: Relix asks GitHub which release is the latest
 * and compares it with the version that's running. Here is the pure part
 * (comparing versions and building the notice); the request is in ui/updates.svelte.js.
 */
import { t } from '../i18n/i18n.svelte.js'

/** The latest published release (without drafts or prereleases) */
export const RELEASES_API = 'https://api.github.com/repos/Snyker-fair/relix/releases/latest'
/** Where it's downloaded from: the latest release's page */
export const RELEASES_URL = 'https://github.com/Snyker-fair/relix/releases/latest'
/** How it's written short on screen */
export const RELEASES_LABEL = 'github.com/Snyker-fair/relix/releases'

/** It's checked once a day at most (GitHub limits requests without an account) */
export const CHECK_EVERY_MS = 24 * 60 * 60 * 1000

/**
 * What's new in a version that's worth saying when it opens: once, after the
 * update (or the first time, with games), one notice per line. In Spanish,
 * translated with t(). Also the shortcuts the screen doesn't show, so they're
 * discovered without crowding the button bar.
 */
export const NEWS = /** @type {Record<string, string[]>} */ ({
  '1.3.0': [
    'Nuevo en la {version}: dentro de una consola, clic en el stick derecho para ver la ficha de un juego y en el izquierdo para que Relix te sorprenda',
    'Truco: dentro de una consola, LT y RT saltan de letra en letra',
  ],
  '1.4.0': [
    'Nuevo en la {version}: al escanear una consola también llegan sus portadas y su información, y los juegos de varios discos ya se pueden cambiar de disco',
    'Truco: en ≡ › Consolas, X te deja ordenar tus consolas',
    'Los videos de ES-DE ya no se reproducen: así Relix va más fluido',
  ],
})

/**
 * "v1.2.3" -> { numbers: [1, 2, 3], pre: '' }; "1.0.0-beta.2" -> pre "beta.2".
 * null if it isn't a version.
 * @param {string} text
 */
export function parseVersion(text) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(text).trim())
  if (!match) return null
  return { numbers: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] ?? '' }
}

/**
 * Negative if a is before b, positive if it's after, 0 if they're the same.
 * A prerelease (1.0.0-beta) goes before the final one (1.0.0).
 * Whatever isn't a version counts as the oldest.
 * @param {string} a @param {string} b
 */
export function compareVersions(a, b) {
  const va = parseVersion(a)
  const vb = parseVersion(b)
  if (!va || !vb) return (va ? 1 : 0) - (vb ? 1 : 0)
  for (let i = 0; i < 3; i++) {
    if (va.numbers[i] !== vb.numbers[i]) return va.numbers[i] - vb.numbers[i]
  }
  if (va.pre === vb.pre) return 0
  if (!va.pre) return 1
  if (!vb.pre) return -1
  return va.pre.localeCompare(vb.pre, 'en', { numeric: true })
}

/**
 * Is there a version newer than the one running?
 * @param {string | null | undefined} latest   the latest release's ("v1.0.1")
 * @param {string} current                     Relix's ("1.0.0")
 */
export function isNewer(latest, current) {
  return Boolean(latest) && parseVersion(current) !== null && compareVersions(String(latest), current) > 0
}

/**
 * What matters in GitHub's answer. null if it's no use (no tag, a draft…).
 * @param {any} release  /repos/{owner}/{repo}/releases/latest
 * @returns {{ version: string, url: string, publishedAt: string } | null}
 */
export function readRelease(release) {
  if (!release || release.draft || release.prerelease) return null
  const parsed = parseVersion(release.tag_name ?? '')
  if (!parsed) return null
  return {
    version: parsed.numbers.join('.') + (parsed.pre ? `-${parsed.pre}` : ''),
    url: typeof release.html_url === 'string' ? release.html_url : RELEASES_URL,
    publishedAt: typeof release.published_at === 'string' ? release.published_at : '',
  }
}

/**
 * The Options › Checkup row when there's a new version (null if there isn't).
 * @param {{ version: string } | null} latest
 * @param {string} current
 * @returns {import('./systemCheck.js').Check | null}
 */
export function updateCheck(latest, current) {
  if (!latest || !isNewer(latest.version, current)) return null
  return {
    id: 'update',
    state: 'update',
    title: t('Relix {version} está disponible', { version: latest.version }),
    detail: t('Tienes la {current}. Bájala en el PC desde {url} e instálala con el Device Portal: tus datos quedan en el USB.', {
      current,
      url: RELEASES_LABEL,
    }),
  }
}
