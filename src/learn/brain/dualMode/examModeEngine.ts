/**
 * Движок режима «Строгий экзаменатор». Правило «НЕТ ОТВЕТАМ»: оценивает ответ по
 * рубрике и, при неверном ответе, возвращает сократовский наводящий вопрос,
 * НИКОГДА не раскрывая решение. Итеративный цикл ведёт TeacherIntelligence.
 */
import type { AppLocale } from '../../../i18n/types'
import { gradeExamAnswerLocal, gradeExamAnswer, type ExamGradeResult } from '../../learnExamGrader'
import type { QuestionGenerator } from './questionGenerator'
import type { AssistantLang, QuestionCard } from './dualModeTypes'

export interface ExamEvaluation {
  grade: ExamGradeResult
  /** true → ученик справился, можно двигаться дальше. */
  passed: boolean
  /** Реплика экзаменатора: похвала при успехе или сократовский вопрос при провале. */
  say: string
  /** Ответ засчитан провальным (для учёта проблемных зон). */
  failed: boolean
}

export interface ExamEngineConfig {
  lang: AssistantLang
  generator: QuestionGenerator
  /** Пытаться оценивать через ИИ (иначе — локально по рубрике). */
  useAiGrading?: boolean
  gradeId?: string
  chapterId?: string
}

export class ExamModeEngine {
  private readonly cfg: ExamEngineConfig

  constructor(config: ExamEngineConfig) {
    this.cfg = config
  }

  /**
   * Оценка ответа. attempt — номер попытки по текущему вопросу (для эскалации
   * сократовских подсказок). Ответ или подсказка НЕ содержат решения.
   */
  async evaluate(answer: string, card: QuestionCard, attempt: number): Promise<ExamEvaluation> {
    const locale = this.cfg.lang as AppLocale
    let grade: ExamGradeResult
    if (this.cfg.useAiGrading) {
      grade = await gradeExamAnswer({
        question: card.speak,
        rubric: card.rubric,
        sampleAnswer: card.sampleAnswer,
        studentAnswer: answer,
        mode: 'oral',
        locale,
        gradeId: this.cfg.gradeId,
        chapterId: this.cfg.chapterId,
        sectionTitle: card.topic,
      })
    } else {
      grade = gradeExamAnswerLocal(answer, card.rubric, locale)
    }
    return this.respond(grade, card, attempt)
  }

  /**
   * Превратить готовую оценку (например, из UnifiedBrain) в реплику экзаменатора
   * без повторного оценивания. Строго соблюдает правило «НЕТ ОТВЕТАМ».
   */
  respond(grade: ExamGradeResult, card: QuestionCard, attempt: number): ExamEvaluation {
    if (grade.verdict === 'correct') {
      return { grade, passed: true, failed: false, say: this.praise() }
    }
    const socratic = this.cfg.generator.socraticFollowUp(card, attempt)
    const lead = grade.verdict === 'partial' ? this.almost() : this.notYet()
    return {
      grade,
      passed: false,
      failed: grade.verdict === 'incorrect',
      say: `${lead} ${socratic}`.trim(),
    }
  }

  private praise(): string {
    if (this.cfg.lang === 'en') return 'Correct. Well reasoned.'
    if (this.cfg.lang === 'uz') return 'To‘g‘ri. Yaxshi fikrladingiz.'
    return 'Верно. Хорошо рассуждаешь.'
  }

  private almost(): string {
    if (this.cfg.lang === 'en') return 'Close, but not complete.'
    if (this.cfg.lang === 'uz') return 'Yaqin, lekin to‘liq emas.'
    return 'Близко, но не полностью.'
  }

  private notYet(): string {
    if (this.cfg.lang === 'en') return 'Not quite.'
    if (this.cfg.lang === 'uz') return 'Unchalik emas.'
    return 'Пока не то.'
  }
}
