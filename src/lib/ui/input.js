/**
 * Unified input: Xbox controller (Gamepad API) + keyboard.
 *
 * Everything becomes simple actions:
 *   up down left right   a b x y   lb rb   lt rt   start view
 *
 * Screens register a handler with `pushHandler`; only the one on top
 * of the stack receives actions (that way an overlay "covers" the screen below).
 */

/** @typedef {'up'|'down'|'left'|'right'|'a'|'b'|'x'|'y'|'lb'|'rb'|'lt'|'rt'|'start'|'view'|'rs'|'ls'} Action */

/** @type {Array<(action: Action) => void>} */
const handlers = []

/** @param {(action: Action) => void} fn  @returns {() => void} to remove it */
export function pushHandler(fn) {
  handlers.push(fn)
  return () => {
    const i = handlers.lastIndexOf(fn)
    if (i >= 0) handlers.splice(i, 1)
  }
}

/** The last time the controller, the keyboard or the mouse was touched (for the screensaver) */
let lastInput = Date.now()

/** Counts as activity (also when coming back from an emulator) */
export function markActivity() {
  lastInput = Date.now()
}

/** How long nobody has touched anything, in ms */
export function idleFor() {
  return Date.now() - lastInput
}

/** @param {Action} action */
export function dispatch(action) {
  lastInput = Date.now()
  handlers.at(-1)?.(action)
}

// ── Keyboard ─────────────────────────────────────────────────────────────
/** @type {Record<string, Action>} */
const KEYS = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'a',
  ' ': 'a',
  Escape: 'b',
  Backspace: 'b',
  x: 'x',
  y: 'y',
  q: 'lb',
  e: 'rb',
  m: 'start', // Menu button: opens Options
  o: 'start',
  z: 'lt', // triggers: previous / next letter
  c: 'rt',
  v: 'view', // View button: search
  f: 'rs', // right stick (click): the game sheet
  r: 'ls', // left stick (click): surprise me
  '/': 'view',
  PageUp: 'lb',
  PageDown: 'rb',
}

// ── Controller ───────────────────────────────────────────────────────────
// "Standard Gamepad" indices (the Xbox controller matches this mapping)
/** @type {Array<[number, Action]>} */
const BUTTONS = [
  [0, 'a'],
  [1, 'b'],
  [2, 'x'],
  [3, 'y'],
  [4, 'lb'],
  [5, 'rb'],
  [6, 'lt'],
  [7, 'rt'],
  [8, 'view'],
  [9, 'start'],
  [10, 'ls'],
  [11, 'rs'],
  [12, 'up'],
  [13, 'down'],
  [14, 'left'],
  [15, 'right'],
]
/** Actions that repeat while held (moving and jumping by letter) */
const REPEATING = new Set(['up', 'down', 'left', 'right', 'lt', 'rt'])
const STICK_DEADZONE = 0.5
const REPEAT_DELAY = 380 // ms before repeating starts while holding
const REPEAT_RATE = 110 // ms between repeats

/** @type {Map<Action, number>} action -> the moment of the next repeat */
const held = new Map()

function readPad() {
  const pads = navigator.getGamepads?.() ?? []
  /** @type {Set<Action>} */
  const now = new Set()
  for (const pad of pads) {
    if (!pad) continue
    for (const [i, action] of BUTTONS) if (pad.buttons[i]?.pressed) now.add(action)
    const [x = 0, y = 0] = pad.axes
    if (x < -STICK_DEADZONE) now.add('left')
    if (x > STICK_DEADZONE) now.add('right')
    if (y < -STICK_DEADZONE) now.add('up')
    if (y > STICK_DEADZONE) now.add('down')
  }
  return now
}

/** @param {number} t */
function poll(t) {
  const now = readPad()
  for (const action of now) {
    const next = held.get(action)
    if (next === undefined) {
      held.set(action, t + REPEAT_DELAY)
      dispatch(action)
    } else if (REPEATING.has(action) && t >= next) {
      held.set(action, t + REPEAT_RATE)
      dispatch(action)
    }
  }
  for (const action of held.keys()) if (!now.has(action)) held.delete(action)
  requestAnimationFrame(poll)
}

let started = false

/**
 * Turns on the browser's input sources.
 * On the Xbox both stay off: the shell reads the controller in C# and calls
 * `dispatch` for each button (see App.svelte), so nothing arrives twice.
 * @param {{ keyboard?: boolean, gamepad?: boolean }} [sources]
 */
export function startInput({ keyboard = true, gamepad = true } = {}) {
  if (started) return
  started = true
  if (keyboard) {
    // In the browser, moving the mouse also wakes it up (it does nothing else)
    window.addEventListener('pointermove', markActivity, { passive: true })
    window.addEventListener('keydown', (e) => {
      const action = KEYS[e.key] ?? KEYS[e.key.toLowerCase()]
      if (!action) return
      e.preventDefault()
      dispatch(action)
    })
  }
  if (gamepad) requestAnimationFrame(poll)
}
