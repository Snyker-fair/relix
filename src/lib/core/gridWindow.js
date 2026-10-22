/**
 * Which games of a grid are drawn. Each cover in the grid costs about 1 MB once
 * it's on screen (a 368 px thumbnail, decoded), and Relix has about 1 GB as an
 * App: a console with 1,000 games drawn whole would use it all up. So only the
 * rows you see are drawn, plus a couple above and below so scrolling never shows
 * gaps; the rest exist only as data.
 */

/** Rows drawn beyond the visible ones, on each side */
export const GRID_BUFFER_ROWS = 2

/**
 * @param {number} count  how many games the grid has
 * @param {number} scrollRow  the first visible row
 * @param {{ columns: number, rows: number, buffer?: number }} layout  rows: how many fit on screen
 * @returns {{ start: number, end: number, firstRow: number }}  the games from start to end (not included), from firstRow on
 */
export function gridWindow(count, scrollRow, { columns, rows, buffer = GRID_BUFFER_ROWS }) {
  const totalRows = Math.ceil(count / columns)
  const firstRow = Math.max(0, Math.min(scrollRow - buffer, totalRows - 1))
  const lastRow = Math.min(totalRows, Math.max(0, scrollRow) + rows + buffer)
  return { start: firstRow * columns, end: Math.min(count, lastRow * columns), firstRow }
}

/**
 * Whether moving the grid from one row to another goes too far to slide: the rows
 * in between aren't drawn, so the slide would show them empty. A jump by letter
 * (LT / RT) goes straight there.
 * @param {number} from @param {number} to
 */
export function jumpsTooFar(from, to, buffer = GRID_BUFFER_ROWS) {
  return Math.abs(to - from) > buffer
}
