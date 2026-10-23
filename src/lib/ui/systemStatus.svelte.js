/**
 * The state of the system checkup (Options › Checkup and the first run).
 * The shell measures; core/systemCheck.js builds the checks with what Relix
 * already knows (games, installed emulators, your data's backup).
 */
import { systemCheck } from '../core/bridge.js'
import { PLATFORMS } from '../core/platforms.js'
import { appTypeOf, buildChecks, CHECK_FOLDERS, summarize } from '../core/systemCheck.js'
import { updateCheck } from '../core/updates.js'
import { VERSION } from '../core/version.js'
import { updates } from './updates.svelte.js'
import { plural, t } from '../i18n/i18n.svelte.js'
import { diagnostics } from './diagnostics.svelte.js'
import { emulators } from './emulators.svelte.js'
import { library } from './library.svelte.js'
import { userData } from './userData.svelte.js'

/** Relix being of the Game type was already reported when it opened */

class SystemStatus {
  /** What the shell measured last (null: not yet, or the shell is older) */
  /** @type {import('../core/systemCheck.js').ShellCheck | null} */
  shell = $state(null)
  running = $state(false)
  /** The shell didn't answer last time (or is from before step 6) */
  failed = $state(false)
  /** When the last checkup finished (ms) */
  checkedAt = $state(0)

  /** Each console with its games and its emulator */
  consoles = $derived(
    PLATFORMS.map((platform) => {
      const emulator = emulators.forPlatform(platform)
      return {
        platform,
        games: library.gamesFor(platform.id),
        emulator,
        installed: emulator ? emulators.isInstalled(emulator) : null,
      }
    }),
  )

  // The new version of Relix (if there is one) goes first; it doesn't count as a problem
  checks = $derived([
    ...[updateCheck(updates.latest, VERSION)].filter((c) => c !== null),
    ...buildChecks({
      shell: this.shell,
      romRoot: library.romRoot,
      consoles: this.consoles,
      knownFolders: PLATFORMS.flatMap((p) => p.folders),
      dataStatus: userData.status,
      shellFailed: this.failed,
    }),
  ])

  summary = $derived(summarize(this.checks))

  /** Relix's type in Dev Home: 'app', 'game' or null (not on an Xbox, or an older shell) */
  appType = $derived(appTypeOf(this.shell))

  /**
   * Measures everything again (also which emulators are installed and whether there's a
   * new version of Relix).
   * @param {{ forceUpdate?: boolean }} [options]  forceUpdate: ask GitHub even if it was already done today
   */
  async run({ forceUpdate = false } = {}) {
    if (this.running) return
    this.running = true
    try {
      const [shell] = await Promise.all([
        systemCheck(CHECK_FOLDERS),
        emulators.check(),
        updates.check({ force: forceUpdate }),
      ])
      this.shell = shell
      this.failed = false
    } catch {
      // No answer from the shell: the checks that don't need it stay, plus one that says so
      this.shell = null
      this.failed = true
    } finally {
      this.running = false
      this.checkedAt = Date.now()
    }
    this.#log()
  }

  /** What was logged last time: it's only logged again if it changes */
  #logged = ''

  /** "1 to fix, 1 warning: Nintendo 3DS: RetroArch 3DS is missing · PS1 BIOS: missing scph5502.bin" */
  #log() {
    const { errors, warnings } = this.summary
    const problems = this.checks.filter((c) => c.state === 'error' || c.state === 'warn').map((c) => c.title)
    const text =
      errors + warnings === 0
        ? t('Todo en orden')
        : t('{errors} por arreglar, {warnings}: {problems}', {
            errors,
            warnings: plural(warnings, 'aviso', 'avisos'),
            problems: problems.join(' · '),
          })
    if (text === this.#logged) return
    this.#logged = text
    diagnostics.log('check', text)
  }
}

export const systemStatus = new SystemStatus()
