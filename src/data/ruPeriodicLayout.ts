/** Сетка краткой формы: 2 боковых + 8 групп + 2 колонки триады (Co, Ni). */



export const PERIODIC_SIDEBAR_COLS = 2

export const PERIODIC_GROUP_COUNT = 8

export const PERIODIC_TRIAD_COLS = 2

/** Колонки основного блока (8 групп + триада). */
export const PERIODIC_MAIN_ELEMENT_COLS = PERIODIC_GROUP_COUNT + PERIODIC_TRIAD_COLS

/** @deprecated — то же, что PERIODIC_MAIN_ELEMENT_COLS */
export const PERIODIC_ELEMENT_COLS = PERIODIC_MAIN_ELEMENT_COLS

/** Колонок элементов в CSS-grid (= основной блок). */
export const PERIODIC_GRID_ELEMENT_COLS = PERIODIC_MAIN_ELEMENT_COLS

export const PERIODIC_TOTAL_COLS = PERIODIC_SIDEBAR_COLS + PERIODIC_GRID_ELEMENT_COLS

export const ELEMENT_FIRST_COL = PERIODIC_SIDEBAR_COLS + 1

/** Последняя колонка основного блока (триада). */
export const ELEMENT_LAST_COL = PERIODIC_SIDEBAR_COLS + PERIODIC_MAIN_ELEMENT_COLS

/** Последняя колонка сетки. */
export const GRID_LAST_COL = PERIODIC_TOTAL_COLS

/** f-ряд на вложенной сетке внутри колонок элементов. */
export const F_ROW_GRID_COLUMN = `${ELEMENT_FIRST_COL} / ${GRID_LAST_COL + 1}`



/** grid-column для группы g (1…8) — одна колонка на группу. */

export function groupGridColumn(g: number): number {

  return PERIODIC_SIDEBAR_COLS + g

}



export function groupHeaderColumn(g: number): number {

  return groupGridColumn(g)

}



/** Заголовок группы VIII + триада (3 колонки). */

export function group8HeaderSpan(): string {

  return `${groupGridColumn(8)} / ${triadGridColumn(2) + 1}`

}



/** @deprecated */

export function groupHeaderSpan(g: number): string {

  return String(groupGridColumn(g))

}



/** @deprecated */

export function subgroupGridColumn(g: number, _s: 'a' | 'b'): number {

  return groupGridColumn(g)

}



export function groupHeaderGridColumn(g: number): string {

  return String(groupGridColumn(g))

}



/** Колонка Co / Ni (t = 1 или 2). */

export function triadGridColumn(slot: 1 | 2): number {

  return PERIODIC_SIDEBAR_COLS + PERIODIC_GROUP_COUNT + slot

}



export function elementGridPlacement(el: { gridX: number }): string {

  return String(groupGridColumn(el.gridX))

}