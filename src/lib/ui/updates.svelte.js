/**
 * Aviso de versión nueva. Al abrir (y al revisar de nuevo en Opciones ›
 * Revisión) pregunta a GitHub por el último release, como mucho una vez al día.
 * Lo último que respondió queda guardado, así el aviso aparece aunque la Xbox
 * abra sin internet. En la demo del navegador no consulta.
 */
import { mode } from '../core/bridge.js'
import { CHECK_EVERY_MS, isNewer, readRelease, RELEASES_API } from '../core/updates.js'
import { VERSION } from '../core/version.js'
import { load, save } from './storage.js'

const KEY = 'updateCheck'
const NOTIFIED_KEY = 'updateNotified'

class Updates {
  /** El último release que respondió GitHub */
  /** @type {{ version: string, url: string, publishedAt: string } | null} */
  latest = $state(load(KEY, null)?.latest ?? null)
  /** Cuándo se consultó por última vez (ms) */
  checkedAt = $state(load(KEY, null)?.at ?? 0)
  checking = $state(false)
  /** ¿Hay una versión más nueva que la que corre? */
  available = $derived(this.latest !== null && isNewer(this.latest.version, VERSION))

  /**
   * Pregunta a GitHub, salvo que se haya hecho hace menos de un día.
   * Nunca falla: sin internet o sin respuesta, queda lo que ya se sabía.
   * @param {{ force?: boolean }} [options]  force: aunque se haya consultado hoy
   */
  async check({ force = false } = {}) {
    if (mode !== 'xbox' || this.checking) return
    if (!force && Date.now() - this.checkedAt < CHECK_EVERY_MS) return
    this.checking = true
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch(RELEASES_API, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal,
      })
      // 404: todavía no hay releases. Se cuenta como consultado.
      const latest = response.ok ? readRelease(await response.json()) : null
      if (response.ok || response.status === 404) {
        this.latest = latest
        this.checkedAt = Date.now()
        save(KEY, { at: this.checkedAt, latest })
      }
    } catch {
      // sin internet: se vuelve a intentar la próxima vez
    } finally {
      clearTimeout(timer)
      this.checking = false
    }
  }

  /**
   * La versión nueva de la que todavía no se avisó (null si no hay o ya se avisó).
   * Al leerla queda marcada: el aviso sale una vez por versión.
   */
  takeNotice() {
    if (!this.available || !this.latest) return null
    const version = this.latest.version
    if (load(NOTIFIED_KEY, '') === version) return null
    save(NOTIFIED_KEY, version)
    return version
  }
}

export const updates = new Updates()
