/** Балл за задачу: максимум 5, −1 за каждую подсказку учителя. */

export function computeTaskScore(
  correct: boolean,
  hintsUsed: number,
): { score: number; total: number } {
  const total = 5
  if (!correct) return { score: 0, total }
  const penalty = Math.min(Math.max(0, hintsUsed), 4)
  return { score: total - penalty, total }
}
