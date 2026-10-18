/**
 * Mantiene tus datos respaldados en el USB (E:\relix\datos.json).
 *
 *   Al iniciar  se lee el USB ANTES de abrir la interfaz, y manda la copia
 *               más nueva (ver chooseSource en core/userData.js).
 *   Al cambiar  algo (un favorito, una partida...) se guarda 2 segundos
 *               después, juntando varios cambios seguidos en una sola escritura.
 *   Al lanzar   un juego se guarda en el acto: la Xbox podría cerrar Relix
 *               mientras juegas y la partida en curso no se perdería.
 *
 * Si no hay USB al iniciar, se trabaja con lo de la app y se vuelve a
 * revisar cuando aparece el USB (resync). Cuando llegan datos del USB, cada
 * estado los vuelve a leer solo (storage.onReplaced).
 */
import { loadUserData, saveUserData } from '../core/bridge.js'
import { chooseSource, parseUserData, serializeUserData } from '../core/userData.js'
import { localMeta, markSynced, readSynced, replaceSynced, setLocalDrive, watchSynced } from './storage.js'

const SAVE_DELAY = 2000

/**
 * Your data's main file. datos.json is its name on drives used with 1.0.0: the
 * shell renames it, and if it can't yet (a read-only drive), it still reads it.
 */
const MAIN_FILES = ['data.json', 'datos.json']

class UserDataSync {
  /**
   * off      sin USB (los datos quedan en la app)
   * saved    al día en el USB
   * pending  hay cambios por guardar
   * error    el USB no deja escribir
   * @type {'off'|'saved'|'pending'|'error'}
   */
  status = $state('off')
  /** Última vez que se guardó en el USB (ms) */
  savedAt = $state(0)
  /** De qué archivo salieron los datos al iniciar, si no fue datos.json (p. ej. un respaldo) */
  recoveredFrom = $state('')
  error = $state('')

  #drive = ''
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #timer
  /** Escrituras en fila: nunca dos a la vez sobre el mismo archivo */
  #queue = Promise.resolve()

  constructor() {
    watchSynced(() => this.#schedule())
  }

  /**
   * Lee el USB y deja en la app la copia que manda. Se llama antes de montar
   * la interfaz; nunca falla (sin USB, sigue con lo de la app).
   * @returns {Promise<'usb'|'local'|'fresh'|'off'>}
   */
  async start() {
    let file
    try {
      file = await loadUserData()
    } catch {
      this.status = 'off'
      return 'off'
    }

    this.#drive = file.driveId
    const usb = parseUserData(file.text)
    const local = localMeta()
    const source = chooseSource(usb, local, file.driveId)

    if (source === 'usb' && usb) {
      // replaceSynced avisa a cada estado; si es lo mismo que ya había, no cambia nada visible
      replaceSynced(usb.values, usb.savedAt, file.driveId)
      this.recoveredFrom = file.source && !MAIN_FILES.includes(file.source) ? file.source : ''
      this.savedAt = usb.savedAt
      this.status = 'saved'
      // Si salió de una copia (datos.json estaba dañado), se reescribe datos.json
      if (this.recoveredFrom) this.#schedule(0)
    } else if (source === 'fresh') {
      // Otro USB sin datos: este parte de cero, con tus preferencias
      replaceSynced({ settings: readSynced().settings }, Date.now(), file.driveId)
      markSynced(0)
      this.#schedule(0)
    } else {
      // Lo de la app es más nuevo (o el USB aún no tiene datos): se copia al USB
      setLocalDrive(file.driveId)
      this.#schedule(0)
    }
    return source
  }

  /** El USB apareció después de iniciar (Reintentar): se vuelve a revisar. */
  async resync() {
    if (this.status === 'off') await this.start()
  }

  /** Guarda ya mismo lo pendiente (antes de lanzar un juego). */
  async flush() {
    clearTimeout(this.#timer)
    this.#timer = undefined
    if (this.status === 'off') return
    const run = this.#queue.then(() => this.#write())
    this.#queue = run.catch(() => {})
    await run
  }

  /** @param {number} [delay] */
  #schedule(delay = SAVE_DELAY) {
    if (this.status === 'off' && !this.#drive) return
    this.status = 'pending'
    clearTimeout(this.#timer)
    this.#timer = setTimeout(() => this.flush(), delay)
  }

  async #write() {
    const savedAt = localMeta().savedAt || Date.now()
    try {
      await saveUserData(serializeUserData(readSynced(), savedAt))
      markSynced(savedAt)
      this.savedAt = Date.now()
      this.error = ''
      if (!this.#timer) this.status = 'saved'
    } catch (e) {
      this.status = 'error'
      this.error = e instanceof Error ? e.message : String(e)
    }
  }
}

export const userData = new UserDataSync()
