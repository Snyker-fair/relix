/**
 * Entrada unificada: control de Xbox (Gamepad API) + teclado.
 *
 * Todo se traduce a acciones simples:
 *   up down left right   a b x y   lb rb   lt rt   start view
 *
 * Las pantallas registran un manejador con `pushHandler`; solo el de arriba
 * de la pila recibe acciones (así un overlay "tapa" a la pantalla de abajo).
 */

/** @typedef {'up'|'down'|'left'|'right'|'a'|'b'|'x'|'y'|'lb'|'rb'|'lt'|'rt'|'start'|'view'} Action */

/** @type {Array<(action: Action) => void>} */
const handlers = []

/** @param {(action: Action) => void} fn  @returns {() => void} para quitarlo */
export function pushHandler(fn) {
  handlers.push(fn)
  return () => {
    const i = handlers.lastIndexOf(fn)
    if (i >= 0) handlers.splice(i, 1)
  }
}

/** La última vez que se tocó el control, el teclado o el mouse (para el protector) */
let lastInput = Date.now()

/** Cuenta como actividad (también al volver de un emulador) */
export function markActivity() {
  lastInput = Date.now()
}

/** Cuánto hace que nadie toca nada, en ms */
export function idleFor() {
  return Date.now() - lastInput
}

/** @param {Action} action */
export function dispatch(action) {
  lastInput = Date.now()
  handlers.at(-1)?.(action)
}

// ── Teclado ──────────────────────────────────────────────────────────────
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
  m: 'start', // botón Menú: abre Opciones
  o: 'start',
  z: 'lt', // gatillos: letra anterior / siguiente
  c: 'rt',
  v: 'view', // botón Vista: buscar
  '/': 'view',
  PageUp: 'lb',
  PageDown: 'rb',
}

// ── Control ──────────────────────────────────────────────────────────────
// Índices del "Standard Gamepad" (el control de Xbox calza con este mapeo)
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
  [12, 'up'],
  [13, 'down'],
  [14, 'left'],
  [15, 'right'],
]
/** Acciones que se repiten al mantenerlas (moverse y saltar de letra) */
const REPEATING = new Set(['up', 'down', 'left', 'right', 'lt', 'rt'])
const STICK_DEADZONE = 0.5
const REPEAT_DELAY = 380 // ms antes de empezar a repetir al mantener
const REPEAT_RATE = 110 // ms entre repeticiones

/** @type {Map<Action, number>} acción -> momento de la próxima repetición */
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
 * Activa las fuentes de entrada del navegador.
 * En la Xbox ambas van apagadas: el shell lee el control en C# y llama a
 * `dispatch` por cada botón (ver App.svelte), así nunca llega dos veces.
 * @param {{ keyboard?: boolean, gamepad?: boolean }} [sources]
 */
export function startInput({ keyboard = true, gamepad = true } = {}) {
  if (started) return
  started = true
  if (keyboard) {
    // En el navegador, mover el mouse también despierta (no hace nada más)
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
