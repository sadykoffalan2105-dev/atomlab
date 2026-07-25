/**
 * Оркестратор проверки ДЗ: авторство + химия + (опционально) LLM-уточнение.
 */

import type { AppLocale } from '../../i18n/types'
import { retrieveChemistryKnowledge } from '../learnKnowledgeRetrieval'
import { analyzeAuthorshipLocal } from './authenticityDetector'
import { analyzeChemistryLocal } from './chemistryHomeworkAnalysis'
import { buildHomeworkReviewPrompt } from './homeworkReviewPrompt'
import type {
  AuthorshipAnalysis,
  ChemistryAnalysis,
  HomeworkReviewReport,
  HomeworkScanInput,
} from './types'

function uid(): string {
  return crypto.randomUUID()
}

function composeBrief(
  authorship: AuthorshipAnalysis,
  chemistry: ChemistryAnalysis,
  locale: AppLocale,
): { teacherBrief: string; studentFeedback: string } {
  if (locale === 'en') {
    const teacherBrief = [
      `AUTHENTICITY: ${authorship.authorship} (AI ~${Math.round(authorship.aiProbability * 100)}%). ${authorship.summary}`,
      `CHEMISTRY: ${chemistry.score}/100 — ${chemistry.verdict}. ${chemistry.teacherNote}`,
      chemistry.issues.length
        ? `Issues: ${chemistry.issues.map((i) => i.message).join(' · ')}`
        : 'No critical chemistry flags.',
      authorship.authorship === 'ai_likely' || authorship.authorship === 'mixed'
        ? 'Action: ask the student to redo one fragment by hand in class and explain it aloud.'
        : 'Action: give targeted feedback on weak points; praise concrete strengths.',
    ].join('\n')
    const studentFeedback = [
      chemistry.strengths.length ? `Strengths: ${chemistry.strengths.join('; ')}.` : '',
      chemistry.issues.length
        ? `Fix: ${chemistry.issues
            .slice(0, 3)
            .map((i) => i.message)
            .join(' ')}`
        : 'Keep practicing with your own words and examples.',
      authorship.authorship === 'ai_likely'
        ? 'Write the next draft yourself — teachers check that the thinking is yours.'
        : '',
    ]
      .filter(Boolean)
      .join(' ')
    return { teacherBrief, studentFeedback }
  }

  if (locale === 'uz') {
    const teacherBrief = [
      `MUALLIFLIK: ${authorship.authorship} (AI ~${Math.round(authorship.aiProbability * 100)}%). ${authorship.summary}`,
      `KIMYO: ${chemistry.score}/100 — ${chemistry.verdict}. ${chemistry.teacherNote}`,
      chemistry.issues.length
        ? `Muammolar: ${chemistry.issues.map((i) => i.message).join(' · ')}`
        : "Jiddiy kimyo xatosi yo'q.",
      authorship.authorship === 'ai_likely' || authorship.authorship === 'mixed'
        ? "Amal: o'quvchidan darsda qo'lda bitta parchani qayta yozishni va og'zaki tushuntirishni so'rang."
        : "Amal: zaif joylarga aniq feedback bering; kuchli tomonlarni maqtang.",
    ].join('\n')
    const studentFeedback = [
      chemistry.strengths.length ? `Kuchli tomonlar: ${chemistry.strengths.join('; ')}.` : '',
      chemistry.issues.length
        ? `Tuzating: ${chemistry.issues
            .slice(0, 3)
            .map((i) => i.message)
            .join(' ')}`
        : "O'z so'zlaringiz va misollar bilan mashq qiling.",
      authorship.authorship === 'ai_likely'
        ? "Keyingi qoralamani o'zingiz yozing — o'qituvchi fikrlash sizniki ekanini tekshiradi."
        : '',
    ]
      .filter(Boolean)
      .join(' ')
    return { teacherBrief, studentFeedback }
  }

  const teacherBrief = [
    `АВТОРСТВО: ${authorship.authorship} (ИИ ~${Math.round(authorship.aiProbability * 100)}%). ${authorship.summary}`,
    `ХИМИЯ: ${chemistry.score}/100 — ${chemistry.verdict}. ${chemistry.teacherNote}`,
    chemistry.issues.length
      ? `Замечания: ${chemistry.issues.map((i) => i.message).join(' · ')}`
      : 'Критических химических флагов нет.',
    authorship.authorship === 'ai_likely' || authorship.authorship === 'mixed'
      ? 'Действие: на уроке попросите переписать фрагмент от руки и объяснить вслух.'
      : 'Действие: точечная обратная связь по пробелам; отметьте сильные стороны.',
  ].join('\n')

  const studentFeedback = [
    chemistry.strengths.length ? `Сильные стороны: ${chemistry.strengths.join('; ')}.` : '',
    chemistry.issues.length
      ? `Исправьте: ${chemistry.issues
          .slice(0, 3)
          .map((i) => i.message)
          .join(' ')}`
      : 'Продолжайте своими словами и с примерами.',
    authorship.authorship === 'ai_likely'
      ? 'Следующий черновик напишите сами — учитель проверяет, что рассуждение ваше.'
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  return { teacherBrief, studentFeedback }
}

function parseAiAuthorshipOverlay(raw: string): Partial<AuthorshipAnalysis> | null {
  const auth = raw.match(/AUTHORSHIP:\s*(human|ai_likely|mixed|uncertain)/i)?.[1]?.toLowerCase()
  const prob = raw.match(/AI_PROB:\s*([01](?:\.\d+)?)/i)?.[1]
  const summary = raw.match(/SUMMARY:\s*(.+)/i)?.[1]?.trim()
  if (!auth && !prob && !summary) return null
  return {
    authorship: (auth as AuthorshipAnalysis['authorship']) || undefined,
    aiProbability: prob != null ? Math.min(1, Math.max(0, Number(prob))) : undefined,
    summary: summary || undefined,
  }
}

/** Локальная полная проверка (всегда доступна offline). */
export function reviewHomeworkLocal(input: HomeworkScanInput): HomeworkReviewReport {
  const authorship = analyzeAuthorshipLocal(input.text, input.locale)
  const chemistry = analyzeChemistryLocal(input.text, {
    locale: input.locale,
    topicHint: input.topicHint,
    gradeId: input.gradeId,
  })
  const { teacherBrief, studentFeedback } = composeBrief(authorship, chemistry, input.locale)
  return {
    id: uid(),
    createdAt: Date.now(),
    input: {
      text: input.text,
      source: input.source,
      topicHint: input.topicHint,
      gradeId: input.gradeId,
      assignmentTitle: input.assignmentTitle,
      locale: input.locale,
      hasImage: Boolean(input.imageDataUrl),
    },
    authorship,
    chemistry,
    teacherBrief,
    studentFeedback,
  }
}

/**
 * Полная проверка: локальный мозг + попытка усилить вердикт через teacher_service / Puter.
 */
export async function reviewHomework(input: HomeworkScanInput): Promise<HomeworkReviewReport> {
  const base = reviewHomeworkLocal(input)
  const locale = input.locale

  try {
    const { requestTeacherChat } = await import('../teacherServiceClient')
    const retrieved = retrieveChemistryKnowledge(
      input.topicHint ? `${input.topicHint}\n${input.text}` : input.text,
      { maxChunks: 5, minScore: 1, gradeId: input.gradeId },
    )
    const knowledgeSnippet = retrieved.chunks
      .map((ch) => (locale === 'en' ? ch.en : ch.ru))
      .filter(Boolean)
      .join('\n---\n')
      .slice(0, 3500)

    const prompt = buildHomeworkReviewPrompt({
      locale,
      text: input.text,
      topicHint: input.topicHint,
      gradeId: input.gradeId,
      assignmentTitle: input.assignmentTitle,
      knowledgeSnippet,
      localAuthorship: base.authorship,
      localChemistry: base.chemistry,
    })

    const result = await requestTeacherChat([{ role: 'user', content: prompt }], {
      homeworkReview: true,
      mode: 'teacher',
      gradeId: input.gradeId,
      sectionTitle: input.topicHint,
      locale,
      maxTokens: 700,
    })

    if (result?.text) {
      const overlay = parseAiAuthorshipOverlay(result.text)
      const chemNote = result.text.match(/CHEM_NOTE:\s*(.+)/i)?.[1]?.trim()
      const authorship: AuthorshipAnalysis = {
        ...base.authorship,
        authorship: overlay?.authorship ?? base.authorship.authorship,
        aiProbability: overlay?.aiProbability ?? base.authorship.aiProbability,
        summary: overlay?.summary ?? base.authorship.summary,
        signals: [
          ...base.authorship.signals,
          {
            id: 'llm_overlay',
            weight: 0,
            detail:
              locale === 'en'
                ? 'Refined by teacher LLM overlay.'
                : locale === 'uz'
                  ? 'O\'qituvchi LLM bilan aniqlashtirildi.'
                  : 'Уточнено поверх эвристик через ИИ-учителя.',
          },
        ],
      }
      const chemistry: ChemistryAnalysis = chemNote
        ? { ...base.chemistry, teacherNote: chemNote }
        : base.chemistry
      const { teacherBrief, studentFeedback } = composeBrief(authorship, chemistry, locale)
      return { ...base, authorship, chemistry, teacherBrief, studentFeedback }
    }
  } catch {
    /* offline / service down — local report is enough */
  }

  return base
}
