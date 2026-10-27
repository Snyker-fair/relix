/**
 * In the demo, the "USB drive" is the browser: what Relix would write on it
 * (covers, gamelists, collections, data.json, the log…) is kept in localStorage,
 * under these keys. Without storage the demo still works, and forgets on reload.
 */
export const DEMO_KEYS = {
  covers: 'relix:demo-covers',
  media: 'relix:demo-media',
  gamelists: 'relix:demo-gamelists',
  collections: 'relix:demo-collections',
  renames: 'relix:demo-renames',
  userData: 'relix:demo-userdata',
  log: 'relix:demo-log',
}

/**
 * What's saved under a key, or the fallback. It could be anything (an older demo,
 * edited by hand), so the caller checks its shape.
 * @param {string} key
 * @param {unknown} fallback
 * @returns {any}
 */
export function readDemo(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

/** @param {string} key @param {unknown} value */
export function writeDemo(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // no storage: forgotten on reload
  }
}
