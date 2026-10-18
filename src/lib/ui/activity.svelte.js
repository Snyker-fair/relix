/**
 * Screen state that several pieces share:
 *   - whether the screensaver is on or a game is opening (the preview videos
 *     stop: there's no point in them still playing underneath)
 *   - the images and videos from the USB drive that didn't load (they aren't
 *     asked for again and the panel shows the cover instead)
 */
import { SvelteSet } from 'svelte/reactivity'

class Activity {
  screensaver = $state(false)
  launching = $state(false)

  /** Nothing should move or make a sound */
  get quiet() {
    return this.screensaver || this.launching
  }
}

export const activity = new Activity()

/** URLs of images or videos that failed */
export const brokenMedia = new SvelteSet()

/**
 * The URL if it can be used: it exists and didn't fail before.
 * @param {string | undefined} url
 */
export function usableMedia(url) {
  return url && !brokenMedia.has(url) ? url : undefined
}
