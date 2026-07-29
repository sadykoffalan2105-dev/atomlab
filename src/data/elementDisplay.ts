/** Отображение относительной атомной массы как в ячейках ПСХЭ. */
export function massDisplay(m: number): string {
  // Школьный формат: короче, чтобы номер и масса читались в ячейке
  if (m < 10) return m.toFixed(4)
  if (m < 100) return m.toFixed(3)
  return m.toFixed(2)
}
