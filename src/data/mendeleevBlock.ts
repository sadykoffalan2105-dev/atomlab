import type { ElementViewModel } from '../types/chemistry'

/** Категория блока для раскраски ячеек ПСХЭ (по позиции в сетке). He — как s-элемент (колонка 18, период 1). La/Ac в группе 3 основной сетки — f-раскраска. */
export function mendeleevBlock(el: ElementViewModel): 's' | 'p' | 'd' | 'f' {
  if (el.z === 2) return 's'
  if (el.z === 57 || el.z === 89) return 'f'
  if (el.gridY === 9 || el.gridY === 10) return 'f'
  if (el.gridX >= 3 && el.gridX <= 12 && el.gridY >= 4 && el.gridY <= 7) return 'd'
  if (el.gridX <= 2) return 's'
  return 'p'
}
