/**
 * HTTP автоматизации учителя (диспетчер из brain/server.ts), только по ключу учителя или админа:
 *   POST /teacher/plan  {teacherKey, unit:'g8:12', lang:'ru'|'uz'|'en', minutes?:45, polish?:true} → {ok, plan, polished, ms}
 *   POST /teacher/test  {teacherKey, units:['g8:12',…], lang, n?, format:'sor'|'soch'|'quiz', variant?:1} → {ok, test, ms}
 *   POST /teacher/grade {teacherKey, rubric, images:[base64…], lang} → {ok, grade:{recommendation:true, mode, scores…}, ms}
 * Ключ — поле teacherKey в теле (как у картинок: без новых заголовков и CORS); админ — X-Brain-Admin.
 * Лимиты — свои, на ключ учителя (config.teacher.rate); план и тест не требуют LLM, проверка работ без модели
 * со зрением отвечает mode 'manual'. Журнал не пишется: ни тексты, ни фото учеников не сохраняются.
 */
import crypto from 'node:crypto'
import type http from 'node:http'
import type { BrainConfig } from '../config.ts'
import type { ClientInfo } from '../http/clientIp.ts'
import { json, jsonError, readJson } from '../http/guard.ts'
import { checkChatImages } from '../http/photo.ts'
import { RateLimiter, type RateRule } from '../http/rateLimit.ts'
import { isTeacherKey } from '../image/roles.ts'
import type { Knowledge } from '../kb/shards.ts'
import type { LlmClient } from '../llm/ollama.ts'
import { QueueTicket, type LlmQueue } from '../llm/queue.ts'
import type { Lang } from '../pipeline/normalize.ts'
import { teacherConfig, type TeacherConfig } from './config.ts'
import { gradeWork, parseRubric } from './grade.ts'
import { buildPlan } from './plan.ts'
import { polishPlan } from './polish.ts'
import { buildTest, type TestFormat } from './test.ts'

export type TeacherHttpContext = {
  req: http.IncomingMessage
  res: http.ServerResponse
  url: URL
  method: string
  cors: Record<string, string>
  client: ClientInfo
  admin: boolean
  brain: { deps: { config: BrainConfig; kb: Knowledge; llm: LlmClient | null }; ready?: Promise<void>; queue?: LlmQueue }
}

const SMALL_BODY = 64 * 1024
const MIN = 60_000
const DAY = 24 * MIN
const limiter = new RateLimiter()
const UNIT_RE = /^g(7|8|9|10|11):[0-9a-z.]{1,8}$/

const isLang = (v: unknown): v is Lang => v === 'ru' || v === 'uz' || v === 'en'

/** Ключ учителя: config.teacher.tokens (+ image.teacherTokens, если useImageTokens). */
export function teacherRole(admin: boolean, key: unknown, cfg: BrainConfig): 'owner' | 'teacher' | 'public' | null {
  if (admin) return 'owner'
  const tc = teacherConfig(cfg)
  const tokens = [...tc.tokens, ...(tc.useImageTokens ? (cfg.image?.teacherTokens ?? []) : [])]
  if (isTeacherKey(key, tokens)) return 'teacher'
  // без ключа (teacher.public): те же инструменты, лимиты как у учителя, но на сессию ученика + адрес
  return tc.public ? 'public' : null
}

function rules(tc: TeacherConfig, grade: boolean): RateRule[] {
  return grade
    ? [
        { name: 'teacher_grade_minute', windowMs: MIN, max: tc.rate.gradePerMin },
        { name: 'teacher_grade_day', windowMs: DAY, max: tc.rate.gradePerDay },
      ]
    : [
        { name: 'teacher_minute', windowMs: MIN, max: tc.rate.perMin },
        { name: 'teacher_day', windowMs: DAY, max: tc.rate.perDay },
      ]
}

/** Сбросить счётчики (selftest). */
export function resetTeacherLimits(): void {
  ;(limiter as unknown as { buckets: Map<string, unknown> }).buckets.clear()
}

export async function handleTeacherRequest(ctx: TeacherHttpContext): Promise<void> {
  const { req, res, method, cors, url, brain } = ctx
  const cfg = brain.deps.config
  const tc = teacherConfig(cfg)
  const path = url.pathname
  const kind = path === '/teacher/plan' ? 'plan' : path === '/teacher/test' ? 'test' : path === '/teacher/grade' ? 'grade' : null
  if (!kind) {
    req.resume()
    return jsonError(res, 404, 'not_found', `${method} ${path.slice(0, 80)}`, cors)
  }
  if (method !== 'POST') {
    req.resume()
    return jsonError(res, 405, 'method_not_allowed', 'только POST', cors)
  }
  if (!tc.enabled) {
    req.resume()
    return jsonError(res, 503, 'disabled', 'автоматизация учителя выключена (config.teacher.enabled)', cors)
  }
  const body = (await readJson(req, kind === 'grade' ? tc.grade.bodyLimitBytes : SMALL_BODY)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonError(res, 400, 'bad_request', 'нужен JSON-объект', cors)
  const role = teacherRole(ctx.admin, body.teacherKey, cfg)
  if (!role) return jsonError(res, 403, 'forbidden', 'нужен ключ учителя (teacherKey)', cors)
  // лимит — на ключ (хеш), не на адрес: учителя одной школы за одним NAT не мешают друг другу; владелец без лимита;
  // без ключа — на сессию ученика (ctx.client.key уже учитывает X-Brain-Session + адрес)
  if (role === 'teacher' || role === 'public') {
    const key = role === 'teacher' ? crypto.createHash('sha256').update(String(body.teacherKey).trim()).digest('hex').slice(0, 16) : `pub:${ctx.client.key}`
    const v = limiter.hitAll([{ group: kind === 'grade' ? 'teacher_grade' : 'teacher', key, rules: rules(tc, kind === 'grade') }])
    if (!v.ok) return json(res, 429, { ok: false, error: 'rate', code: 'rate', rule: v.rule, retryAfterSec: v.retryAfterSec, message: 'Слишком много запросов подряд — подождите немного.' }, { ...cors, 'Retry-After': String(v.retryAfterSec) })
  }
  const lang: Lang = body.lang === undefined ? 'ru' : isLang(body.lang) ? body.lang : ('' as Lang)
  if (!lang) return jsonError(res, 400, 'bad_request', 'lang: ru | uz | en', cors)
  const t0 = performance.now()
  if (brain.ready) await brain.ready

  if (kind === 'plan') {
    const unit = typeof body.unit === 'string' ? body.unit.trim() : ''
    if (!UNIT_RE.test(unit)) return jsonError(res, 400, 'bad_request', "unit: 'g8:12' (класс:номер)", cors)
    if (body.minutes !== undefined && (typeof body.minutes !== 'number' || body.minutes < 20 || body.minutes > 90)) return jsonError(res, 400, 'bad_request', 'minutes: 20–90', cors)
    const plan = buildPlan(unit, lang, typeof body.minutes === 'number' ? body.minutes : 45, brain.deps.kb)
    if (!plan) return jsonError(res, 404, 'unknown_unit', `нет единицы ${unit} в карте программы`, cors)
    let out = plan
    let polished = 0
    if (tc.polish.enabled && body.polish !== false && brain.deps.llm && brain.queue) {
      const ticket = new QueueTicket(brain.deps.llm, brain.queue)
      try {
        const p = await polishPlan(plan, ticket, tc.polish.timeoutMs)
        out = p.plan
        polished = p.polished
      } catch {
        /* шлифовка — только украшение: ошибка модели не ломает план */
      } finally {
        ticket.release()
      }
    }
    return json(res, 200, { ok: true, plan: out, polished, ms: Math.round(performance.now() - t0) }, cors)
  }

  if (kind === 'test') {
    const units = Array.isArray(body.units) ? body.units.filter((u): u is string => typeof u === 'string').map((u) => u.trim()) : []
    if (!units.length || units.length > 12 || units.some((u) => !UNIT_RE.test(u))) return jsonError(res, 400, 'bad_request', "units: 1–12 единиц вида 'g8:12'", cors)
    const format = body.format === undefined ? 'quiz' : body.format
    if (format !== 'sor' && format !== 'soch' && format !== 'quiz') return jsonError(res, 400, 'bad_request', 'format: sor | soch | quiz', cors)
    if (body.n !== undefined && (typeof body.n !== 'number' || body.n < 3 || body.n > 40)) return jsonError(res, 400, 'bad_request', 'n: 3–40', cors)
    const variant = typeof body.variant === 'number' && Number.isInteger(body.variant) && body.variant >= 1 && body.variant <= 9 ? body.variant : 1
    const test = buildTest(units, lang, typeof body.n === 'number' ? body.n : undefined, format as TestFormat, brain.deps.kb, tc.scale, variant)
    if (!test) return jsonError(res, 404, 'unknown_unit', 'нет таких единиц в карте программы', cors)
    return json(res, 200, { ok: true, test, ms: Math.round(performance.now() - t0) }, cors)
  }

  // grade
  const rubric = parseRubric(body.rubric)
  if (typeof rubric === 'string') return jsonError(res, 400, 'bad_request', rubric, cors)
  const imgs = Array.isArray(body.images) ? body.images : []
  if (!imgs.length) return jsonError(res, 400, 'bad_request', 'images: 1+ фото работы (base64)', cors)
  const ph = checkChatImages({ messages: [{ images: imgs }] }, { maxImages: tc.grade.maxImages, maxImageBytes: tc.grade.maxImageBytes, bodyLimitBytes: tc.grade.bodyLimitBytes, perMin: 0, perDay: 0 })
  if (!ph.ok) return jsonError(res, ph.status, ph.code, ph.message, cors)
  const ac = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) ac.abort()
  })
  const ticket = brain.deps.llm && brain.queue ? new QueueTicket(brain.deps.llm, brain.queue, { signal: ac.signal }) : null
  try {
    const grade = await gradeWork({ rubric, images: ph.images, lang, llm: ticket ?? brain.deps.llm, cfg: tc, signal: ac.signal })
    return json(res, 200, { ok: true, grade, ms: Math.round(performance.now() - t0) }, cors)
  } finally {
    ticket?.release()
  }
}
