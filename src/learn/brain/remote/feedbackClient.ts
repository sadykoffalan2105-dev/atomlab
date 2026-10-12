/**
 * «Сообщить об ошибке» под ответом ИИ-учителя → POST {мозг}/kb/feedback (brain/http/feedback.ts).
 *
 * Уходит только { question, answer, comment, reason, lang, grade, route } — без имени, класса ученика и адреса;
 * сервер пишет запись kind 'feedback' в журнал без адреса и сессии (заголовок X-Brain-Session нужен только лимитам).
 * Длины подрезаются под лимиты сервера заранее (сервер сверх лимита отвечает 400, а не обрезает).
 */
import { BRAIN_SESSION_HEADER, brainGradeId, brainSessionId, ensureBrainOnline, getBrainUrl } from './brainClient'

export type FeedbackReason = 'wrong' | 'unclear' | 'unsafe' | 'language' | 'other'
export type FeedbackResult = 'sent' | 'offline' | 'rate' | 'error'

/** Совпадают с FEEDBACK_DEFAULTS сервера (brain/http/feedback.ts). */
export const FEEDBACK_LIMITS = { question: 2000, answer: 6000, comment: 1000 } as const

export type FeedbackReport = {
  question: string
  answer: string
  comment?: string
  reason?: FeedbackReason
  lang?: string
  gradeId?: string
  /** откуда ответ: llm / fallback / local … (короткая метка) */
  route?: string
}

/** Тело запроса (чистая функция — проверяется selftest без сети). */
export function feedbackBody(r: FeedbackReport): Record<string, string> {
  const lang = r.lang === 'uz' || r.lang === 'en' ? r.lang : 'ru'
  const route = String(r.route ?? '').toLowerCase().replace(/[^a-z_-]/g, '').slice(0, 24)
  const grade = brainGradeId(r.gradeId)
  return {
    question: r.question.trim().slice(0, FEEDBACK_LIMITS.question),
    answer: r.answer.trim().slice(0, FEEDBACK_LIMITS.answer),
    comment: (r.comment ?? '').trim().slice(0, FEEDBACK_LIMITS.comment),
    reason: r.reason ?? 'other',
    lang,
    ...(grade ? { grade } : {}),
    ...(route ? { route } : {}),
  }
}

export async function reportBrainAnswer(r: FeedbackReport, opts: { fetchImpl?: typeof fetch; baseUrl?: string | null; timeoutMs?: number } = {}): Promise<FeedbackResult> {
  if (!r.answer.trim()) return 'error'
  const doFetch = opts.fetchImpl ?? (typeof fetch === 'undefined' ? null : fetch)
  if (!doFetch) return 'offline'
  let base = opts.baseUrl !== undefined ? opts.baseUrl : getBrainUrl()
  if (!base && opts.baseUrl === undefined) base = (await ensureBrainOnline()) ? getBrainUrl() : null
  if (!base) return 'offline'
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000)
  try {
    const res = await doFetch(`${base}/kb/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [BRAIN_SESSION_HEADER]: brainSessionId() },
      body: JSON.stringify(feedbackBody(r)),
      signal: ctrl.signal,
    })
    if (res.ok) return 'sent'
    if (res.status === 429) return 'rate'
    if (res.status === 404) return 'offline' // старый мозг без /kb/feedback
    return 'error'
  } catch {
    return 'offline'
  } finally {
    clearTimeout(timer)
  }
}
