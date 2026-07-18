/**
 * Педагогическая стратегия — чистая функция принятия решения преподавателя
 * на основе сведённого контекста, оценки ответа и долгосрочного профиля.
 *
 * Правила приоритизированы: целостность > присутствие > эмоция > верность ответа.
 * Тон и уровень подсказки адаптируются под чувствительность конкретного ученика.
 */
import type { ExamGradeResult } from '../learnExamGrader'
import type { FusedContext, StrategyDecision } from './brainTypes'
import type { StudentProfile } from './studentMemoryStore'

export interface StrategyInput {
  fused: FusedContext
  /** Оценка последнего устного ответа (если фаза опроса). */
  grade: ExamGradeResult | null
  /** Профиль ученика для персонализации. */
  profile: StudentProfile
  /** Сколько подряд неверных/частичных ответов по текущему вопросу. */
  consecutiveMisses: number
}

function verbosityFor(fused: FusedContext): StrategyDecision['verbosity'] {
  if (fused.attention < 0.4) return 'short' // рассеян — не грузим длинным
  if (fused.emotion === 'confused') return 'full' // непонятно — объясняем подробно
  return 'normal'
}

export function decideStrategy(input: StrategyInput): StrategyDecision {
  const { fused, grade, profile, consecutiveMisses } = input
  const sensitive = profile.rapport.sensitivity > 0.55

  // 1) Подозрение на списывание — деликатный сигнал целостности.
  if (fused.integrityRisk > 0.6) {
    return {
      tone: 'neutral',
      action: 'integrity_nudge',
      hintLevel: 0,
      verbosity: 'short',
      difficultyDelta: 0,
      rationale: 'Высокий риск списывания: мягко возвращаем к честной работе.',
    }
  }

  // 2) Ученик отсутствует/отвёл взгляд надолго — переустанавливаем контакт.
  if (fused.engagement === 'absent') {
    return {
      tone: 'warm',
      action: 're_engage',
      hintLevel: 0,
      verbosity: 'short',
      difficultyDelta: 0,
      rationale: 'Лицо не в кадре — зовём ученика вернуться к уроку.',
    }
  }
  if (fused.engagement === 'distracted') {
    return {
      tone: 'encouraging',
      action: 're_engage',
      hintLevel: 1,
      verbosity: 'short',
      difficultyDelta: 0,
      rationale: 'Внимание упало — короткий бодрый крючок, чтобы вовлечь.',
    }
  }

  // 3) Эмоция важнее строгости: растерянность/фрустрация → поддержка.
  if (fused.emotion === 'frustrated' && fused.emotionConfidence > 0.4) {
    return {
      tone: 'warm',
      action: 'encourage',
      hintLevel: sensitive ? 2 : 1,
      verbosity: 'normal',
      difficultyDelta: -1,
      rationale: 'Виден признак фрустрации — снижаем строгость, подбадриваем, упрощаем.',
    }
  }
  if (fused.emotion === 'confused' && fused.emotionConfidence > 0.4) {
    return {
      tone: 'warm',
      action: 'explain',
      hintLevel: 2,
      verbosity: verbosityFor(fused),
      difficultyDelta: 0,
      rationale: 'Ученик в замешательстве — объясняем иначе и даём опорную подсказку.',
    }
  }

  // 4) Реакция на оценку устного ответа.
  if (grade) {
    if (grade.verdict === 'correct') {
      return {
        tone: fused.emotion === 'confident' ? 'neutral' : 'encouraging',
        action: 'advance',
        hintLevel: 0,
        verbosity: 'short',
        difficultyDelta: fused.emotion === 'confident' ? 1 : 0,
        rationale: 'Ответ полный — хвалим и повышаем планку.',
      }
    }
    if (grade.verdict === 'partial') {
      return {
        tone: sensitive ? 'warm' : 'neutral',
        action: 'give_hint',
        hintLevel: Math.min(3, 1 + consecutiveMisses),
        verbosity: verbosityFor(fused),
        difficultyDelta: 0,
        rationale: 'Ответ частичный — наводящий вопрос/подсказка, чтобы дотянуть до полного.',
      }
    }
    // incorrect
    return {
      tone: sensitive ? 'warm' : 'neutral',
      action: consecutiveMisses >= 2 ? 'explain' : 'give_hint',
      hintLevel: Math.min(3, 2 + consecutiveMisses),
      verbosity: verbosityFor(fused),
      difficultyDelta: consecutiveMisses >= 2 ? -1 : 0,
      rationale:
        consecutiveMisses >= 2
          ? 'Несколько промахов подряд — переходим к объяснению, снижаем сложность.'
          : 'Ответ неверный — даём более явную подсказку, не отнимая шанс подумать.',
    }
  }

  // 5) Уверенный и вовлечён — можно двигаться дальше/усложнять.
  if (fused.emotion === 'confident' && fused.attention > 0.6) {
    return {
      tone: 'neutral',
      action: 'ask_question',
      hintLevel: 0,
      verbosity: 'short',
      difficultyDelta: 1,
      rationale: 'Ученик уверен и внимателен — задаём следующий, более сложный вопрос.',
    }
  }

  // 6) Спокойное состояние — обычный ход диалога.
  return {
    tone: 'neutral',
    action: 'ask_question',
    hintLevel: 0,
    verbosity: verbosityFor(fused),
    difficultyDelta: 0,
    rationale: 'Стабильное состояние — продолжаем опрос в обычном темпе.',
  }
}
