/**
 * Мост между интерфейсом страницы, доской и камерой (без лишних перерисовок React):
 * страница/доска вызывают функции, которые регистрирует камера.
 */
export interface LabSceneBridge {
  /** Камера в режиме «Доска» на узком экране: доску можно листать по ширине. */
  boardPanEnabled: boolean
  /** Сдвиг вида по доске на dx CSS-пикселей (перетаскивание пальцем). */
  panBoard: ((dxPx: number) => void) | null
  /** Листание доски кнопками: −1 — левее, +1 — правее. */
  shiftBoard: ((dir: -1 | 1) => void) | null
  /** Двойной клик/тап по предмету — камера плавно приближается к точке (дистанция в метрах). */
  zoomTo: ((point: { x: number; y: number; z: number }, dist?: number) => void) | null
}

export function createLabSceneBridge(): LabSceneBridge {
  return { boardPanEnabled: false, panBoard: null, shiftBoard: null, zoomTo: null }
}
