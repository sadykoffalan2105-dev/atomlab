/**
 * Визуальные ряды тела таблицы: периоды 1–7, ряд лантаноидов, ряд актиноидов
 * (без отдельных строк только под подписи «Лантаниды» / «Актиниды»).
 */
export const PERIOD_TABLE_VISUAL_ROWS = 9

/** dataY из позиции в JSON → визуальный ряд (1-based). */
export function visualGridRowFromDataY(dataY: number): number {
  if (dataY <= 7) return dataY
  if (dataY === 9) return 8
  if (dataY === 10) return 9
  return 7
}

/** Подпись слева: 6* и 7* — у основных рядов периода; у f-вынесения — пусто. */
export function periodLabelForVisualRow(visualRow: number): string {
  if (visualRow <= 5) return String(visualRow)
  if (visualRow === 6) return '6*'
  if (visualRow === 7) return '7*'
  if (visualRow === 8 || visualRow === 9) return ''
  return String(visualRow)
}
