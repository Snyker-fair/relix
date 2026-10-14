/**
 * Guardado local de preferencias del jugador (favoritos agregados en Relix,
 * últimos jugados). En la Xbox, el localStorage de WebView2 vive en los datos
 * de la app; en el navegador puede no estar disponible, así que todo va en
 * try/catch y la app funciona igual sin él.
 */

const PREFIX = 'relix:'

/** @template T @param {string} key @param {T} fallback @returns {T} */
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

/** @param {string} key @param {unknown} value */
export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // sin almacenamiento: seguimos solo en memoria
  }
}
