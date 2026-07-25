/**
 * ATOMLAB Homework Brain — проверка домашнего задания.
 *
 * Контракты: скан → текст → химическая оценка + вердикт «человек / ИИ / смешанный».
 */

import type { AppLocale } from '../../i18n/types'

export type HomeworkAuthorship = 'human' | 'ai_likely' | 'mixed' | 'uncertain'

export type HomeworkChemistryVerdict = 'excellent' | 'good' | 'fair' | 'weak' | 'off_topic'

export type AuthorshipSignal = {
  id: string
  /** + тянет к ИИ, − к человеку */
  weight: number
  detail: string
}

export type AuthorshipAnalysis = {
  authorship: HomeworkAuthorship
  /** 0..1 — уверенность, что текст сгенерирован ИИ */
  aiProbability: number
  signals: AuthorshipSignal[]
  summary: string
}

export type ChemistryIssue = {
  kind: 'error' | 'omission' | 'style' | 'safety'
  message: string
}

export type ChemistryAnalysis = {
  verdict: HomeworkChemistryVerdict
  /** 0..100 */
  score: number
  strengths: string[]
  issues: ChemistryIssue[]
  keyConceptsHit: string[]
  teacherNote: string
}

export type HomeworkScanSource = 'paste' | 'upload' | 'camera'

export type HomeworkScanInput = {
  text: string
  /** data URL превью (фото/скан), если есть */
  imageDataUrl?: string | null
  source: HomeworkScanSource
  topicHint?: string
  gradeId?: string
  assignmentTitle?: string
  locale: AppLocale
}

export type HomeworkReviewReport = {
  id: string
  createdAt: number
  input: Omit<HomeworkScanInput, 'imageDataUrl'> & { hasImage: boolean }
  authorship: AuthorshipAnalysis
  chemistry: ChemistryAnalysis
  /** Итоговый разбор для учителя (локаль ученика/учителя) */
  teacherBrief: string
  /** Советы ученику */
  studentFeedback: string
}

export type HomeworkReviewHistoryItem = {
  id: string
  createdAt: number
  authorship: HomeworkAuthorship
  aiProbability: number
  chemistryVerdict: HomeworkChemistryVerdict
  score: number
  topicHint?: string
  preview: string
}
