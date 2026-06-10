export type ExamGradeVerdict = 'correct' | 'partial' | 'incorrect'

export type ExamGradeResult = {
  verdict: ExamGradeVerdict
  /** 0–2 балла за вопрос */
  score: number
  maxScore: 2
  feedback: string
}

const MAX_SCORE = 2 as const

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9+\-\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function rubricHits(answer: string, rubric: readonly string[]): number {
  const norm = normalize(answer)
  if (!norm) return 0
  let hits = 0
  for (const point of rubric) {
    const key = normalize(point)
    if (key.length < 2) continue
    if (norm.includes(key)) hits++
  }
  return hits
}

function verdictFromRatio(ratio: number): ExamGradeVerdict {
  if (ratio >= 0.75) return 'correct'
  if (ratio >= 0.35) return 'partial'
  return 'incorrect'
}

function scoreFromRatio(ratio: number): number {
  if (ratio >= 0.75) return 2
  if (ratio >= 0.35) return 1
  return 0
}

function localFeedback(verdict: ExamGradeVerdict, hits: number, total: number): string {
  if (verdict === 'correct') {
    return 'Ответ полный. Вы назвали основные ключевые моменты.'
  }
  if (verdict === 'partial') {
    return `Есть верные мысли (${hits} из ${total} ключевых пунктов). Дополните ответ.`
  }
  return 'Ответ неполный. Повторите тему и попробуйте назвать главные понятия.'
}

/** Локальная оценка по рубрике (работает без ИИ). */
export function gradeExamAnswerLocal(
  studentAnswer: string,
  rubric: readonly string[],
): ExamGradeResult {
  const total = Math.max(1, rubric.length)
  const hits = rubricHits(studentAnswer, rubric)
  const ratio = hits / total
  const verdict = verdictFromRatio(ratio)
  return {
    verdict,
    score: scoreFromRatio(ratio),
    maxScore: MAX_SCORE,
    feedback: localFeedback(verdict, hits, total),
  }
}

function parseAiGrade(raw: string): ExamGradeResult | null {
  const text = raw.trim()
  const verdictMatch = text.match(/VERDICT:\s*(correct|partial|incorrect)/i)
  const scoreMatch = text.match(/SCORE:\s*([012])/i)
  const feedbackMatch = text.match(/FEEDBACK:\s*(.+)/is)

  if (!verdictMatch || !scoreMatch) return null

  const verdict = verdictMatch[1]!.toLowerCase() as ExamGradeVerdict
  const score = Math.min(2, Math.max(0, Number(scoreMatch[1])))
  const feedback = feedbackMatch?.[1]?.trim() || localFeedback(verdict, score, 2)

  return { verdict, score, maxScore: MAX_SCORE, feedback }
}

export type ExamGradeContext = {
  question: string
  rubric: readonly string[]
  sampleAnswer?: string
  studentAnswer: string
  mode: 'written' | 'oral'
  gradeId?: string
  chapterId?: string
  sectionTitle?: string
}

/** Оценка с попыткой ИИ через teacher_service, иначе локально. */
export async function gradeExamAnswer(ctx: ExamGradeContext): Promise<ExamGradeResult> {
  const trimmed = ctx.studentAnswer.trim()
  if (!trimmed) {
    return {
      verdict: 'incorrect',
      score: 0,
      maxScore: MAX_SCORE,
      feedback: 'Ответ пустой. Попробуйте сформулировать хотя бы основную мысль.',
    }
  }

  try {
    const { requestTeacherChat } = await import('./teacherServiceClient')
    const rubricText = ctx.rubric.map((r, i) => `${i + 1}. ${r}`).join('\n')
    const prompt = `Оцени ответ ученика 7 класса по химии.

Вопрос: ${ctx.question}

Ключевые пункты (рубрика):
${rubricText}

${ctx.sampleAnswer ? `Образец ответа: ${ctx.sampleAnswer}\n` : ''}
Ответ ученика: ${trimmed}

Ответь СТРОГО в формате:
VERDICT: correct|partial|incorrect
SCORE: 0|1|2
FEEDBACK: краткая обратная связь ученику (1–2 предложения, без формул)`

    const result = await requestTeacherChat([{ role: 'user', content: prompt }], {
      examGrade: true,
      examMode: ctx.mode,
      gradeId: ctx.gradeId,
      chapterId: ctx.chapterId,
      sectionTitle: ctx.sectionTitle,
    })

    if (result?.text) {
      const parsed = parseAiGrade(result.text)
      if (parsed) return parsed
    }
  } catch {
    /* fallback */
  }

  return gradeExamAnswerLocal(trimmed, ctx.rubric)
}

export function examPointsToTestScore(totalPoints: number, maxPoints: number, questionCount: number): number {
  if (maxPoints <= 0 || questionCount <= 0) return 0
  const ratio = totalPoints / maxPoints
  const maxScore = questionCount <= 5 ? 5 : 10
  return Math.round(ratio * maxScore)
}

export function examGradeLabelFromRatio(ratio: number): 'excellent' | 'good' | 'fair' | 'retry' {
  if (ratio >= 0.9) return 'excellent'
  if (ratio >= 0.7) return 'good'
  if (ratio >= 0.5) return 'fair'
  return 'retry'
}
