/**
 * Options › each section (Library, Consoles, Checkup, Covers, Preferences) is a
 * component that draws its rows and knows what they do. Options.svelte holds
 * the tabs, the left panel, the focus and the list that slides, and asks the
 * section on screen for this (its component exports these functions):
 *
 * @typedef {import('../../lib/ui/input.js').Action} Action
 * @typedef {{ button: Action, also?: Action, label: string }} Hint
 *
 * @typedef {Object} Section
 * @property {() => string[]} rows  its rows' ids, in order
 * @property {() => void} activate  A on the focused row
 * @property {(common: Hint[]) => Hint[]} hints  the button bar: its buttons and the common ones (LB/RB, B)
 * @property {(action: Action) => boolean} [handle]  its own buttons, before the common ones; true if it used it
 *
 * The props each one gets: `index` (the focused row, bindable), `onMove(i)` (the
 * mouse over a row) and what it opens (onToast, onGuide…).
 */
export {}
