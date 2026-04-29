/** Отображение относительной атомной массы как в ячейках ПСХЭ. */
export function massDisplay(m: number): string {
  if (m < 10) return m.toFixed(5)
  if (m < 100) return m.toFixed(4)
  return m.toFixed(3)
}
