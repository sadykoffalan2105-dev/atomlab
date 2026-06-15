import ruPositions from './ruElementGridPositions.json'
import {
  ELEMENT_FIRST_COL,
  ELEMENT_LAST_COL,
  F_ROW_GRID_COLUMN,
  group8HeaderSpan,
  groupGridColumn,
  groupHeaderSpan,
  triadGridColumn,
} from './ruPeriodicLayout'

export type RuGridPos = {
  z: number
  y: number
  g?: number
  s?: 'a' | 'b'
  t?: 1 | 2
  f?: number
}

const byZ = new Map<number, RuGridPos>(
  (ruPositions as RuGridPos[]).map((p) => [p.z, p]),
)

export function getRuGridPos(z: number): RuGridPos | undefined {
  return byZ.get(z)
}

export const RU_GRID_POSITIONS: readonly RuGridPos[] = ruPositions as RuGridPos[]

/** Строка CSS-grid (1-based): 2 заголовка + 11 рядов + зазор + 2 f-ряда. */
export function ruMainGridRow(y: number): number {
  return y + 2
}

/** Пустая строка-разделитель между основным блоком и лантаноидами. */
export const F_BLOCK_GAP_ROW = 14

export function ruFBlockGridRow(y: number): number {
  return y === 12 ? 15 : 16
}

/** Строка легенды. */
export const LEGEND_GRID_ROW = 17

/** Центральная панель (период 1, пустое пространство между H и He). */
export const CENTER_PANEL_COL_START = groupGridColumn(2) + 1 // col 4
export const CENTER_PANEL_COL_END = groupGridColumn(8) // col 10 (exclusive)
export const CENTER_PANEL_ROW = ruMainGridRow(1)

/** Пустая зона триады (периоды 1–3, колонки Co/Ni). */
export const TRIAD_VOID_COL_START = triadGridColumn(1)
export const TRIAD_VOID_COL_END = triadGridColumn(2) + 1
export const TRIAD_VOID_ROW_START = ruMainGridRow(1)
export const TRIAD_VOID_ROW_END = ruMainGridRow(3) + 1

function isInCenterPanel(col: number, row: number): boolean {
  return col >= CENTER_PANEL_COL_START && col < CENTER_PANEL_COL_END && row === CENTER_PANEL_ROW
}

function isInTriadVoid(col: number, row: number): boolean {
  return (
    col >= TRIAD_VOID_COL_START &&
    col < TRIAD_VOID_COL_END &&
    row >= TRIAD_VOID_ROW_START &&
    row < TRIAD_VOID_ROW_END
  )
}

/** Пустые ячейки основного блока (без f-рядов), кроме декоративных панелей. */
export function ruMainVoidCells(): Array<{ col: number; row: number }> {
  const occupied = new Set<string>()
  for (const p of RU_GRID_POSITIONS) {
    if (p.f != null) continue
    const col = ruElementGridColumn(p)
    const row = ruMainGridRow(p.y)
    if (col != null) occupied.add(`${col},${row}`)
  }

  const voids: Array<{ col: number; row: number }> = []
  for (let y = 1; y <= 11; y++) {
    const row = ruMainGridRow(y)
    for (let col = ELEMENT_FIRST_COL; col <= ELEMENT_LAST_COL; col++) {
      if (isInCenterPanel(col, row) || isInTriadVoid(col, row)) continue
      const key = `${col},${row}`
      if (!occupied.has(key)) voids.push({ col, row })
    }
  }
  return voids
}

export function ruElementGridColumn(pos: RuGridPos): number | null {
  if (pos.f != null) return null
  if (pos.t != null) return triadGridColumn(pos.t as 1 | 2)
  if (pos.g != null) return groupGridColumn(pos.g)
  return null
}

export {
  ELEMENT_FIRST_COL,
  ELEMENT_LAST_COL,
  F_ROW_GRID_COLUMN,
  group8HeaderSpan,
  groupGridColumn,
  groupHeaderSpan,
  triadGridColumn,
}

/** Период для подписи слева (1–7, 6* и 7*). */
export function ruPeriodLabelForRow(y: number): string {
  if (y === 1) return '1'
  if (y === 2) return '2'
  if (y === 3) return '3'
  if (y === 4) return '4'
  if (y === 6) return '5'
  if (y === 8) return '6*'
  if (y === 10) return '7*'
  return ''
}

/** Показывать метку периода только на первой строке двойного ряда. */
export function ruPeriodLabelRowSpan(y: number): number | undefined {
  if (y === 4 || y === 6 || y === 8 || y === 10) return 2
  return undefined
}
