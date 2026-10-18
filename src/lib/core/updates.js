/**
 * Aviso de versión nueva: Relix le pregunta a GitHub cuál es el último release
 * y lo compara con la versión que corre. Aquí está la parte pura (comparar
 * versiones y armar el aviso); la consulta está en ui/updates.svelte.js.
 */
import { t } from '../i18n/i18n.svelte.js'

/** El último release publicado (sin borradores ni versiones de prueba) */
export const RELEASES_API = 'https://api.github.com/repos/Snyker-fair/relix/releases/latest'
/** Dónde se descarga: la página del último release */
export const RELEASES_URL = 'https://github.com/Snyker-fair/relix/releases/latest'
/** Cómo se escribe corto en pantalla */
export const RELEASES_LABEL = 'github.com/Snyker-fair/relix/releases'

/** Se consulta como mucho una vez al día (GitHub limita las consultas sin cuenta) */
export const CHECK_EVERY_MS = 24 * 60 * 60 * 1000

/**
 * "v1.2.3" -> { numbers: [1, 2, 3], pre: '' }; "1.0.0-beta.2" -> pre "beta.2".
 * null si no es una versión.
 * @param {string} text
 */
export function parseVersion(text) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(text).trim())
  if (!match) return null
  return { numbers: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] ?? '' }
}

/**
 * Negativo si a es anterior a b, positivo si es posterior, 0 si son la misma.
 * Una versión de prueba (1.0.0-beta) va antes que la final (1.0.0).
 * Lo que no es una versión cuenta como la más vieja.
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
 * ¿Hay una versión más nueva que la que corre?
 * @param {string | null | undefined} latest   la del último release ("v1.0.1")
 * @param {string} current                     la de Relix ("1.0.0")
 */
export function isNewer(latest, current) {
  return Boolean(latest) && parseVersion(current) !== null && compareVersions(String(latest), current) > 0
}

/**
 * Lo que importa de la respuesta de GitHub. null si no sirve (sin etiqueta, borrador…).
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
 * La fila de Opciones › Revisión cuando hay una versión nueva (null si no la hay).
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
