/**
 * Keeps your data backed up on the USB drive (E:\relix\data.json).
 *
 *   At startup  the USB drive is read BEFORE the interface opens, and the newest
 *               copy rules (see chooseSource in core/userData.js).
 *   On a change (a favorite, a session...) it's saved 2 seconds
 *               later, gathering several changes in a row into a single write.
 *   On launch   of a game it's saved right away: the Xbox could close Relix
 *               while you play and the session in progress wouldn't be lost.
 *
 * If there's no USB drive at startup, the app's data is used and it's checked
 * again when the drive shows up (resync). When data arrives from the drive, each
 * state reads it again by itself (storage.onReplaced).
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
   * off      no USB drive (the data stays in the app)
   * saved    up to date on the USB drive
   * pending  there are changes to save
   * error    the USB drive can't be written to
   * @type {'off'|'saved'|'pending'|'error'}
   */
  status = $state('off')
  /** The last time it was saved to the USB drive (ms) */
  savedAt = $state(0)
  /** Which file the data came from at startup, if it wasn't the main one (e.g. a backup) */
  recoveredFrom = $state('')
  error = $state('')

  #drive = ''
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #timer
  /** Writes in a queue: never two at once on the same file */
  #queue = Promise.resolve()

  constructor() {
    watchSynced(() => this.#schedule())
  }

  /**
   * Reads the USB drive and leaves the copy that rules in the app. It's called before
   * mounting the interface; it never fails (without a USB drive, it carries on with the app's data).
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
      // replaceSynced tells each state; if it's the same as before, nothing visible changes
      replaceSynced(usb.values, usb.savedAt, file.driveId)
      this.recoveredFrom = file.source && !MAIN_FILES.includes(file.source) ? file.source : ''
      this.savedAt = usb.savedAt
      this.status = 'saved'
      // If it came from a copy (data.json was damaged), data.json is written again
      if (this.recoveredFrom) this.#schedule(0)
    } else if (source === 'fresh') {
      // Another USB drive without data: this one starts from scratch, with your preferences
      replaceSynced({ settings: readSynced().settings }, Date.now(), file.driveId)
      markSynced(0)
      this.#schedule(0)
    } else {
      // The app's data is newer (or the USB drive has no data yet): it's copied to the drive
      setLocalDrive(file.driveId)
      this.#schedule(0)
    }
    return source
  }

  /** The USB drive showed up after startup (Retry): it's checked again. */
  async resync() {
    if (this.status === 'off') await this.start()
  }

  /** Saves what's pending right now (before launching a game). */
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
