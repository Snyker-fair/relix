/**
 * Filtro activo de cada canal (Y › Filtrar). Dura lo que dura la sesión:
 * al abrir Relix de nuevo, cada consola muestra todos sus juegos.
 */
import { SvelteMap } from 'svelte/reactivity'

/** @type {SvelteMap<string, import('../core/filters.js').GameFilter>} canal -> filtro */
export const activeFilters = new SvelteMap()
