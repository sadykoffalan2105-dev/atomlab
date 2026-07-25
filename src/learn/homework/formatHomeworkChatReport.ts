/**
 * Форматирование отчёта проверки ДЗ для чата ИИ-учителя.
 * Фокус: химия + авторство; без придирок к почерку/орфографии/OCR.
 */

import type { AppLocale } from '../../i18n/types'
import type { HomeworkReviewReport } from './types'

export function formatHomeworkReportForChat(report: HomeworkReviewReport, locale: AppLocale): string {
  const aiPct = Math.round(report.authorship.aiProbability * 100)
  if (locale === 'en') {
    return [
      '**Homework check** (chemistry meaning first — spelling/OCR ignored)',
      '',
      `**Authorship:** ${report.authorship.authorship} (AI ~${aiPct}%)`,
      report.authorship.summary,
      '',
      `**Chemistry:** ${report.chemistry.score}/100 · ${report.chemistry.verdict}`,
      report.chemistry.teacherNote,
      report.chemistry.strengths.length ? `Strengths: ${report.chemistry.strengths.join('; ')}` : '',
      report.chemistry.issues.length
        ? `Fix: ${report.chemistry.issues.map((i) => i.message).join(' · ')}`
        : '',
      '',
      '**For you:**',
      report.studentFeedback,
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (locale === 'uz') {
    return [
      "**Uy vazifasi tekshiruvi** (avvalo kimyo — imlo/OCR e'tiborga olinmaydi)",
      '',
      `**Mualliflik:** ${report.authorship.authorship} (AI ~${aiPct}%)`,
      report.authorship.summary,
      '',
      `**Kimyo:** ${report.chemistry.score}/100 · ${report.chemistry.verdict}`,
      report.chemistry.teacherNote,
      report.chemistry.strengths.length ? `Kuchli: ${report.chemistry.strengths.join('; ')}` : '',
      report.chemistry.issues.length
        ? `Tuzating: ${report.chemistry.issues.map((i) => i.message).join(' · ')}`
        : '',
      '',
      "**Siz uchun:**",
      report.studentFeedback,
    ]
      .filter(Boolean)
      .join('\n')
  }
  return [
    '**Проверка домашнего задания** (сначала химический смысл — орфография/почерк/OCR не оцениваю)',
    '',
    `**Авторство:** ${report.authorship.authorship} (ИИ ~${aiPct}%)`,
    report.authorship.summary,
    '',
    `**Химия:** ${report.chemistry.score}/100 · ${report.chemistry.verdict}`,
    report.chemistry.teacherNote,
    report.chemistry.strengths.length ? `Сильные стороны: ${report.chemistry.strengths.join('; ')}` : '',
    report.chemistry.issues.length
      ? `Исправить: ${report.chemistry.issues.map((i) => i.message).join(' · ')}`
      : '',
    '',
    '**Тебе:**',
    report.studentFeedback,
  ]
    .filter(Boolean)
    .join('\n')
}

/** Пользовательская подпись в ленте чата. */
export function homeworkUserLabel(locale: AppLocale, preview: string, fromScan: boolean): string {
  const head =
    locale === 'en'
      ? fromScan
        ? '📎 Homework scan'
        : '📎 Homework text'
      : locale === 'uz'
        ? fromScan
          ? '📎 Uy vazifasi skani'
          : '📎 Uy vazifasi matni'
        : fromScan
          ? '📎 Скан домашнего задания'
          : '📎 Текст домашнего задания'
  const body = preview.trim().slice(0, 900)
  return `${head}\n\n${body}`
}
