/**
 * After a scan (Options › Library), the rest in one go: the covers and screenshots
 * the scanned consoles are missing, then the descriptions of their games that have
 * none (core/afterScan.js says why and what it says). It doesn't ask: scanning is
 * the only step. Without internet only the scan is done, and it says so.
 */
import { emptyAfterScan } from '../core/afterScan.js'
import { getPlatform } from '../core/platforms.js'
import { t } from '../i18n/i18n.svelte.js'
import { covers } from './covers.svelte.js'
import { diagnostics } from './diagnostics.svelte.js'
import { gameInfo } from './gameInfo.svelte.js'
import { library } from './library.svelte.js'

class AfterScan {
  /** It's working (Options doesn't start another scan meanwhile) */
  working = $state(false)

  /**
   * @param {string[]} systemIds  the consoles just scanned
   * @returns {Promise<import('../core/afterScan.js').AfterScanResult | null>}  null if it didn't run
   */
  async complete(systemIds) {
    const ids = systemIds.filter((id) => library.gamesFor(id).length > 0)
    if (ids.length === 0 || this.working) return null
    this.working = true
    const result = emptyAfterScan()
    try {
      // Covers and screenshots, console by console (they show on its row in Options)
      for (const id of ids) {
        if (covers.busy !== null || !covers.needsSearch(id)) continue
        try {
          const found = await covers.find(id)
          result.covers += found.saved
          result.coversToChoose += found.toChoose
        } catch (e) {
          // No connection to libretro: Wikipedia won't answer either
          result.offline = true
          diagnostics.log(
            'covers',
            t('{console}: no se pudieron buscar las portadas después de escanear ({error})', {
              console: getPlatform(id)?.shortName ?? id,
              error: e instanceof Error ? e.message : String(e),
            }),
          )
          break
        }
      }
      if (result.offline) return result

      // Descriptions: only the sure matches are saved; the rest stay to pick
      const info = await gameInfo.findFor(ids)
      if (info) {
        result.info += info.saved
        result.infoToChoose += info.unsure
        // every console failed (no connection) and nothing new came: the same notice
        if (info.failed.length > 0 && info.saved === 0 && result.covers === 0) result.offline = true
      }
      return result
    } finally {
      this.working = false
    }
  }
}

export const afterScan = new AfterScan()
