/**
 * Estado de la revisión del sistema (Opciones › Revisión y el primer uso).
 * El shell mide; core/systemCheck.js arma los chequeos con lo que Relix ya
 * sabe (juegos, emuladores instalados, respaldo de tus datos).
 */
import { systemCheck } from '../core/bridge.js'
import { PLATFORMS } from '../core/platforms.js'
import { buildChecks, CHECK_FOLDERS, summarize } from '../core/systemCheck.js'
import { diagnostics } from './diagnostics.svelte.js'
import { emulators } from './emulators.svelte.js'
import { library } from './library.svelte.js'
import { userData } from './userData.svelte.js'

class SystemStatus {
  /** Lo último que midió el shell (null: todavía no, o el shell es anterior) */
  /** @type {import('../core/systemCheck.js').ShellCheck | null} */
  shell = $state(null)
  running = $state(false)
  /** El shell no respondió la última vez (o es anterior al paso 6) */
  failed = $state(false)
  /** Cuándo terminó la última revisión (ms) */
  checkedAt = $state(0)

  /** Cada consola con sus juegos y su emulador */
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

  checks = $derived(
    buildChecks({
      shell: this.shell,
      romRoot: library.romRoot,
      consoles: this.consoles,
      knownFolders: PLATFORMS.flatMap((p) => p.folders),
      dataStatus: userData.status,
      shellFailed: this.failed,
    }),
  )

  summary = $derived(summarize(this.checks))

  /** Vuelve a medir todo (también qué emuladores hay instalados) */
  async run() {
    if (this.running) return
    this.running = true
    try {
      const [shell] = await Promise.all([systemCheck(CHECK_FOLDERS), emulators.check()])
      this.shell = shell
      this.failed = false
    } catch {
      // Sin respuesta del shell: quedan los chequeos que no lo necesitan, y uno que lo dice
      this.shell = null
      this.failed = true
    } finally {
      this.running = false
      this.checkedAt = Date.now()
    }
    this.#log()
  }

  /** Lo que se anotó la última vez: solo se vuelve a anotar si cambia */
  #logged = ''

  /** "1 por arreglar, 1 aviso: Nintendo 3DS: falta RetroArch 3DS · BIOS de PS1: falta scph5502.bin" */
  #log() {
    const { errors, warnings } = this.summary
    const problems = this.checks.filter((c) => c.state === 'error' || c.state === 'warn').map((c) => c.title)
    const text =
      errors + warnings === 0
        ? 'Todo en orden'
        : `${errors} por arreglar, ${warnings} ${warnings === 1 ? 'aviso' : 'avisos'}: ${problems.join(' · ')}`
    if (text === this.#logged) return
    this.#logged = text
    diagnostics.log('check', text)
  }
}

export const systemStatus = new SystemStatus()
