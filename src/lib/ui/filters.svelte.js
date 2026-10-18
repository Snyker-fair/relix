/**
 * Each channel's active filter (Y › Filter). It lasts for the session:
 * when Relix opens again, each console shows all its games.
 */
import { SvelteMap } from 'svelte/reactivity'

/** @type {SvelteMap<string, import('../core/filters.js').GameFilter>} channel -> filter */
export const activeFilters = new SvelteMap()
