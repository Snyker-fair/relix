import { describe, expect, it, vi } from 'vitest'
import { serializeUserData } from '../src/lib/core/userData.js'

/** What the shell answers to loadUserData */
const shell = vi.hoisted(() => ({ file: /** @type {any} */ (null) }))

vi.mock('../src/lib/core/bridge.js', () => ({
  loadUserData: async () => shell.file,
  saveUserData: async () => {},
}))

const { userData } = await import('../src/lib/ui/userData.svelte.js')

let savedAt = Date.parse('2026-10-18T12:00:00Z')

/** @param {string} source  the file the shell read the data from */
async function startFrom(source) {
  savedAt += 60_000
  shell.file = { driveId: 'E:\\|RELIX', text: serializeUserData({ favorites: ['psx/Tekken 3 (USA).chd'] }, savedAt), source }
  return userData.start()
}

describe('where your data came from', () => {
  it('data.json is the main file: nothing to report', async () => {
    expect(await startFrom('data.json')).toBe('usb')
    expect(userData.recoveredFrom).toBe('')
  })

  it("datos.json is the main file's name on drives used with 1.0.0", async () => {
    expect(await startFrom('datos.json')).toBe('usb')
    expect(userData.recoveredFrom).toBe('')
  })

  it('a copy or a backup is reported', async () => {
    await startFrom('data.previous.json')
    expect(userData.recoveredFrom).toBe('data.previous.json')

    await startFrom('backups\\data-2026-10-17.json')
    expect(userData.recoveredFrom).toBe('backups\\data-2026-10-17.json')

    await startFrom('respaldos\\datos-2026-10-16.json')
    expect(userData.recoveredFrom).toBe('respaldos\\datos-2026-10-16.json')
  })
})
