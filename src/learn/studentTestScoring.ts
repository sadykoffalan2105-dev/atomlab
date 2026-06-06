export type StudentTestLength = 5 | 10

/** Сколько верных ответов → итоговый балл (макс. = total). */
export function computeStudentTestScore(correctCount: number, total: StudentTestLength): number {
  const correct = Math.max(0, Math.min(total, correctCount))
  if (total === 5) return correct
  if (correct === 0) return 0
  // 10 вопросов: одна ошибка прощается, далее −1 за каждую
  return Math.min(10, correct + 1)
}

export function studentTestGradeLabel(score: number, total: StudentTestLength): string {
  const ratio = score / total
  if (ratio >= 0.9) return 'excellent'
  if (ratio >= 0.7) return 'good'
  if (ratio >= 0.5) return 'fair'
  return 'retry'
}
