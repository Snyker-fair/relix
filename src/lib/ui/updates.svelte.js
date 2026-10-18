/**
 * The new-version notice. When Relix opens (and when checking again in Options ›
 * Checkup) it asks GitHub for the latest release, once a day at most.
 * The last answer stays saved, so the notice shows even if the Xbox
 * opens without internet. The browser demo doesn't ask.
 */
import { mode } from '../core/bridge.js'
import { CHECK_EVERY_MS, isNewer, readRelease, RELEASES_API } from '../core/updates.js'
import { VERSION } from '../core/version.js'
import { load, save } from './storage.js'

const KEY = 'updateCheck'
const NOTIFIED_KEY = 'updateNotified'

class Updates {
  /** The latest release GitHub answered with */
  /** @type {{ version: string, url: string, publishedAt: string } | null} */
  latest = $state(load(KEY, null)?.latest ?? null)
  /** When it was last asked (ms) */
  checkedAt = $state(load(KEY, null)?.at ?? 0)
  checking = $state(false)
  /** Is there a version newer than the one running? */
  available = $derived(this.latest !== null && isNewer(this.latest.version, VERSION))

  /**
   * Asks GitHub, unless it was done less than a day ago.
   * It never fails: without internet or an answer, what was already known stays.
   * @param {{ force?: boolean }} [options]  force: even if it was asked today
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
      // 404: there are no releases yet. It counts as asked.
      const latest = response.ok ? readRelease(await response.json()) : null
      if (response.ok || response.status === 404) {
        this.latest = latest
        this.checkedAt = Date.now()
        save(KEY, { at: this.checkedAt, latest })
      }
    } catch {
      // no internet: it tries again next time
    } finally {
      clearTimeout(timer)
      this.checking = false
    }
  }

  /**
   * The new version that hasn't been announced yet (null if there's none or it already was).
   * Reading it marks it: the notice shows once per version.
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
