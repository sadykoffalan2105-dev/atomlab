/**
 * POST /kb/feedback — «Сообщить об ошибке» под ответом ИИ-учителя (публично, со строгими лимитами).
 *
 * Тело: { answer, question?, comment?, reason?, lang?, grade?, route? } (Content-Type: application/json, ≤ bodyLimitBytes).
 * Запись — в журнал базы (append-only, brain/kb/journal.ts) с kind 'feedback': в поиск не попадает (searchableKind),
 * в снимок установщика не берётся (scripts/brain/package.mts). Хранится только { question, answer, comment } и
 * короткие метки (reason, lang, grade, route). Ни адреса, ни сессии, ни их хешей — запись нельзя связать с учеником.
 * Телефоны и почта в тексте маскируются до записи (ЗРУ-547: минимизация персональных данных).
 *
 * Лимиты (config.server.feedback, умолчания FEEDBACK_DEFAULTS): на ученика (адрес + X-Brain-Session) в минуту и сутки,
 * потолок адреса (школьный NAT), общий потолок сервера в сутки (диск не забить), длины полей — сверх лимита 400, не обрезка.
 * Владелец с этого ПК (exemptLocal) и админ по ключу лимитами не ограничены, как и в /chat.
 */
import type http from 'node:http'
import type { Brain } from '../server.ts'
import type { BrainConfig } from '../config.ts'
import type { ClientInfo } from './clientIp.ts'
import { json, jsonError, readJson } from './guard.ts'
import type { RateCheck, RateLimiter } from './rateLimit.ts'

export type FeedbackConfig = {
  /** false — 404 (как будто пути нет) */
  enabled: boolean
  /** на ученика (адрес + сессия сайта) */
  perMin: number
  perDay: number
  /** потолок одного адреса (класс за школьным NAT) */
  ipPerMin: number
  ipPerDay: number
  /** на весь сервер в сутки */
  globalPerDay: number
  bodyLimitBytes: number
  maxQuestionChars: number
  maxAnswerChars: number
  maxCommentChars: number
}

export const FEEDBACK_DEFAULTS: FeedbackConfig = {
  enabled: true,
  perMin: 3,
  perDay: 20,
  ipPerMin: 30,
  ipPerDay: 300,
  globalPerDay: 3000,
  bodyLimitBytes: 16 * 1024,
  maxQuestionChars: 2000,
  maxAnswerChars: 6000,
  maxCommentChars: 1000,
}

export const FEEDBACK_REASONS = ['wrong', 'unclear', 'unsafe', 'language', 'other'] as const
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number]

export type FeedbackInput = {
  question: string
  answer: string
  comment: string
  reason: FeedbackReason
  lang: 'ru' | 'uz' | 'en'
  grade: string
  route: string
}

/** Итоговые лимиты: config.server.feedback поверх умолчаний (старый config.json без блока — умолчания). */
export function feedbackConfig(cfg: Pick<BrainConfig, 'server'>): FeedbackConfig {
  const raw = (cfg.server as { feedback?: Partial<FeedbackConfig> }).feedback
  return { ...FEEDBACK_DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) }
}

const MIN = 60_000
const DAY = 24 * 60 * MIN

/** Проверки частоты: ученик, адрес, весь сервер (отказ любой — 429, не засчитывается ни одна). */
export function feedbackChecks(client: Pick<ClientInfo, 'key' | 'student'>, f: FeedbackConfig): RateCheck[] {
  return [
    {
      group: 'feedback',
      key: client.student,
      rules: [
        { name: 'feedback_minute', windowMs: MIN, max: f.perMin },
        { name: 'feedback_day', windowMs: DAY, max: f.perDay },
      ],
    },
    {
      group: 'feedback_ip',
      key: client.key,
      rules: [
        { name: 'feedback_ip_minute', windowMs: MIN, max: f.ipPerMin },
        { name: 'feedback_ip_day', windowMs: DAY, max: f.ipPerDay },
      ],
    },
    { group: 'feedback_all', key: 'all', rules: [{ name: 'feedback_global_day', windowMs: DAY, max: f.globalPerDay }] },
  ]
}

/** Управляющие символы (кроме перевода строки и табуляции) — вон; NFC; края без пробелов. */
function clean(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u2028\u2029\ufeff]/g, '').trim()
}

/**
 * Маскировка персональных данных в свободном тексте: почта, телефоны Узбекистана (+998 / 998 / 8 0xx) и любые
 * номера в международном формате (+ и 10–13 цифр). Химические числа («2,5 моль», «1000 г») не трогаются.
 */
export function maskPersonal(s: string): string {
  return s
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[почта]')
    .replace(/(?:\+?998|\b8)[\s\-()]*\d{2}[\s\-()]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}\b/g, '[телефон]')
    .replace(/\+\d[\d\s\-()]{9,16}\d/g, '[телефон]')
}

/** Строгая проверка тела: строка — текст ошибки 400 (сверх лимита — отказ, а не тихая обрезка). */
export function validateFeedback(body: unknown, f: FeedbackConfig): FeedbackInput | string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'тело запроса должно быть JSON-объектом'
  const b = body as Record<string, unknown>
  const allowed = new Set(['question', 'answer', 'comment', 'reason', 'lang', 'grade', 'route'])
  const extra = Object.keys(b).filter((k) => !allowed.has(k))
  if (extra.length) return `лишние поля: ${extra.slice(0, 5).join(', ').slice(0, 80)}`
  for (const k of ['question', 'answer', 'comment', 'reason', 'lang', 'grade', 'route']) {
    if (b[k] !== undefined && typeof b[k] !== 'string') return `${k} — строка`
  }
  const answer = clean(String(b.answer ?? ''))
  const question = clean(String(b.question ?? ''))
  const comment = clean(String(b.comment ?? ''))
  if (!answer) return 'answer обязателен'
  if (answer.length > f.maxAnswerChars) return `answer ≤ ${f.maxAnswerChars} символов`
  if (question.length > f.maxQuestionChars) return `question ≤ ${f.maxQuestionChars} символов`
  if (comment.length > f.maxCommentChars) return `comment ≤ ${f.maxCommentChars} символов`
  const reason = (b.reason ?? 'other') as string
  if (!(FEEDBACK_REASONS as readonly string[]).includes(reason)) return `reason ∈ ${FEEDBACK_REASONS.join('|')}`
  const lang = (b.lang ?? 'ru') as string
  if (lang !== 'ru' && lang !== 'uz' && lang !== 'en') return 'lang ∈ ru|uz|en'
  const grade = String(b.grade ?? '')
  if (grade && !/^g(7|8|9|10|11)$/.test(grade)) return 'grade ∈ g7..g11'
  const route = String(b.route ?? '')
  if (route && !/^[a-z_-]{1,24}$/.test(route)) return 'route — короткая метка [a-z_-]'
  return { question: maskPersonal(question), answer: maskPersonal(answer), comment: maskPersonal(comment), reason: reason as FeedbackReason, lang, grade, route }
}

/** Что уходит в журнал: только вопрос, ответ, комментарий и метки — без адреса, сессии и их хешей. */
export function feedbackAppend(v: FeedbackInput) {
  const text = [`Вопрос: ${v.question || '—'}`, `Ответ ИИ: ${v.answer}`, `Комментарий: ${v.comment || '—'}`].join('\n')
  return {
    kind: 'feedback' as const,
    lang: v.lang,
    title: 'Сообщение об ошибке ИИ-учителя',
    text,
    tags: ['feedback', 'site', `reason:${v.reason}`, ...(v.grade ? [`grade:${v.grade}`] : [])],
    source: 'site-feedback',
    meta: { question: v.question, answer: v.answer, comment: v.comment, reason: v.reason, ...(v.grade ? { grade: v.grade } : {}), ...(v.route ? { route: v.route } : {}), v: 1 },
  }
}

/** Обработчик POST /kb/feedback (крючок в brain/server.ts — одна строка). */
export async function handleFeedbackRequest(o: {
  req: http.IncomingMessage
  res: http.ServerResponse
  method: string
  cors: Record<string, string>
  client: ClientInfo
  limited: boolean
  limiter: RateLimiter
  brain: Brain
}): Promise<void> {
  const { req, res, cors, client, brain } = o
  const f = feedbackConfig(brain.deps.config)
  if (!f.enabled) {
    req.resume()
    return jsonError(res, 404, 'not_found', 'POST /kb/feedback', cors)
  }
  if (o.method !== 'POST') {
    req.resume()
    return jsonError(res, 405, 'method_not_allowed', 'только POST', { ...cors, Allow: 'POST, OPTIONS' })
  }
  // лимит — до чтения тела (как /chat)
  if (o.limited) {
    const v = o.limiter.hitAll(feedbackChecks(client, f))
    if (!v.ok) {
      req.resume()
      return json(
        res,
        429,
        { ok: false, error: 'rate', code: 'rate', rule: v.rule, retryAfterSec: v.retryAfterSec, message: 'Спасибо! Сообщений слишком много подряд — попробуйте позже.' },
        { ...cors, 'Retry-After': String(v.retryAfterSec) },
      )
    }
  }
  const body = await readJson(req, f.bodyLimitBytes)
  const v = validateFeedback(body, f)
  if (typeof v === 'string') return jsonError(res, 400, 'bad_request', v, cors)
  // замеры/eval (BRAIN_NO_DIALOG_LOG=1) — журнал владельца не трогаем, но ответ тот же
  if (brain.deps.noJournal) return json(res, 200, { ok: true, stored: false }, cors)
  if (brain.ready) await brain.ready
  const { record } = brain.deps.journal.append(feedbackAppend(v))
  return json(res, 200, { ok: true, stored: true, id: record.id }, cors)
}
