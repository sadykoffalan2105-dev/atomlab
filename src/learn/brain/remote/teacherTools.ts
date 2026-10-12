/**
 * Инструменты учителя (nextBuild #4, сторона сайта): контракт и клиент трёх запросов мозга.
 *
 *   POST /teacher/plan  {unit, lang, minutes}            → {plan: LessonPlan}   (или сам объект плана)
 *   POST /teacher/test  {units[], lang, n, format}       → {test: TeacherTest}
 *   POST /teacher/grade {lang, unit?, rubric[], images[]} → {grade: GradeResult} — РЕКОМЕНДАЦИЯ, решает учитель
 *
 * Имена полей ответа — ровно как в задании серверу (не переименовывать):
 *   plan  {title, objectives[], stages[{name, minutes, activities[]}], questions[], problems[{text, solution, answer}], links[]}
 *   test  {title, items[{type, q, options?, answer, points, unit}], totalPoints, scale}
 *   grade {criteria[{name, max, points, comment}], total, max, note}
 *
 * Доступ — как у «Нарисовать»: владелец — заголовок X-Brain-Admin, учитель — teacherKey в теле
 * (ключи из imageClient.readBrainKeys, вводятся один раз). Ученику сервер отвечает 403.
 * unit — id единицы карты программы (kimyo-map.json): «g8:12», «g7:2.6», «g10:3.15» (см. teacherUnits.json).
 * images — JPEG base64 без «data:» (chatPhoto.prepareChatPhoto: ≤ 1280 px, без EXIF), не больше 4.
 *
 * Ответы разбираются терпеливо (normPlan/normTest/normGrade): лишние поля игнорируются, пропуски — пустые,
 * чтобы сервер, собираемый параллельно, не ломал страницу. Демо без сервера — teacherToolsMock.ts.
 */
import { BRAIN_SESSION_HEADER, brainSessionId, ensureBrainOnline, getBrainUrl } from './brainClient'
import { readBrainKeys } from './imageClient'

/* ------------------------------------------------------------------ контракт */

export type TeacherToolKind = 'plan' | 'test' | 'grade'
export type TeacherLang = 'ru' | 'uz' | 'en'
export type TestFormat = 'sor' | 'soch' | 'quiz'

export interface PlanRequest {
  unit: string
  lang: TeacherLang
  /** Длительность урока, мин (обычно 45 или 40; 20–90). */
  minutes: number
}

export interface TestRequest {
  units: string[]
  lang: TeacherLang
  /** Число заданий (3–40). */
  n: number
  format: TestFormat
}

export interface GradeRubricItem {
  name: string
  max: number
}

export interface GradeRequest {
  lang: TeacherLang
  /** Единица, по которой работа (необязательно — помогает серверу). */
  unit?: string
  rubric: GradeRubricItem[]
  /** JPEG base64 без «data:», 1–4 шт. */
  images: string[]
}

export interface PlanStage {
  name: string
  minutes: number
  activities: string[]
}

export interface PlanProblem {
  text: string
  solution: string
  answer: string
}

/** Ссылка на 3D-сцену / опыт / § сайта. Сервер может прислать строку — тогда title = href. */
export interface PlanLink {
  title: string
  href: string
}

export interface LessonPlan {
  title: string
  objectives: string[]
  stages: PlanStage[]
  questions: string[]
  problems: PlanProblem[]
  links: PlanLink[]
}

/** single — один ответ, multi — несколько, open — открытый, calc — расчёт, match — соответствие (любой другой — как open). */
export type TestItemType = 'single' | 'multi' | 'open' | 'calc' | 'match' | (string & {})

export interface TestItem {
  type: TestItemType
  q: string
  options?: string[]
  /** Ключ: текст ответа (для выбора — сам вариант или его буква). */
  answer: string
  points: number
  /** Единица программы, из которой вопрос (g8:12). */
  unit: string
}

/** Строка шкалы перевода баллов в отметку: от from до to баллов включительно → mark. */
export interface TestScaleRow {
  mark: string
  from: number
  to: number
}

export interface TeacherTest {
  title: string
  items: TestItem[]
  totalPoints: number
  scale: TestScaleRow[]
}

export interface GradeCriterion {
  name: string
  max: number
  points: number
  comment: string
}

export interface GradeResult {
  criteria: GradeCriterion[]
  total: number
  max: number
  /** Пометка сервера; всегда показываем и «рекомендация, решение за учителем». */
  note: string
}

export interface TeacherToolMap {
  plan: { req: PlanRequest; res: LessonPlan }
  test: { req: TestRequest; res: TeacherTest }
  grade: { req: GradeRequest; res: GradeResult }
}

export type TeacherToolErrorCode =
  | 'offline'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'forbidden'
  | 'bad_request'
  | 'not_found'
  | 'rate'
  | 'busy'
  | 'disabled'
  | 'internal'

export class TeacherToolError extends Error {
  readonly code: TeacherToolErrorCode
  readonly retryAfterSec?: number
  constructor(code: TeacherToolErrorCode, message = '', retryAfterSec?: number) {
    super(message || code)
    this.name = 'TeacherToolError'
    this.code = code
    if (retryAfterSec != null && Number.isFinite(retryAfterSec) && retryAfterSec > 0) this.retryAfterSec = Math.ceil(retryAfterSec)
  }
}

/* ------------------------------------------------------------------ ограничения запроса */

export const PLAN_MINUTES = { min: 20, max: 90, def: 45 } as const
export const TEST_N = { min: 3, max: 40 } as const
/** Сколько заданий по умолчанию: СОР — короткий, СОЧ — за четверть, квиз — разминка. */
export const TEST_N_DEFAULT: Record<TestFormat, number> = { sor: 8, soch: 15, quiz: 6 }
export const TEST_UNITS_MAX = 12
export const GRADE_IMAGES_MAX = 4
export const GRADE_RUBRIC_MAX = 12

const clampInt = (v: unknown, min: number, max: number, d: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : d
  return Math.min(max, Math.max(min, n))
}
const normLang = (l: unknown): TeacherLang => (l === 'uz' || l === 'en' ? l : 'ru')
const UNIT_RE = /^g(7|8|9|10|11):\d+(\.\d+)?$/

export function isUnitId(v: unknown): v is string {
  return typeof v === 'string' && UNIT_RE.test(v)
}

/** Тело запроса (без ключей): проверка и обрезка до контракта. Бросает bad_request, если нечего отправлять. */
export function buildBody<K extends TeacherToolKind>(kind: K, req: TeacherToolMap[K]['req']): Record<string, unknown> {
  if (kind === 'plan') {
    const r = req as PlanRequest
    if (!isUnitId(r.unit)) throw new TeacherToolError('bad_request', 'unit')
    return { unit: r.unit, lang: normLang(r.lang), minutes: clampInt(r.minutes, PLAN_MINUTES.min, PLAN_MINUTES.max, PLAN_MINUTES.def) }
  }
  if (kind === 'test') {
    const r = req as TestRequest
    const units = [...new Set((r.units ?? []).filter(isUnitId))].slice(0, TEST_UNITS_MAX)
    if (!units.length) throw new TeacherToolError('bad_request', 'units')
    const format: TestFormat = r.format === 'soch' || r.format === 'quiz' ? r.format : 'sor'
    return { units, lang: normLang(r.lang), n: clampInt(r.n, TEST_N.min, TEST_N.max, TEST_N_DEFAULT[format]), format }
  }
  const r = req as GradeRequest
  const images = (r.images ?? [])
    .map((x) => (typeof x === 'string' ? x.replace(/^data:[^,]*,/, '') : ''))
    .filter(Boolean)
    .slice(0, GRADE_IMAGES_MAX)
  if (!images.length) throw new TeacherToolError('bad_request', 'images')
  const rubric = (r.rubric ?? [])
    .map((c) => ({ name: String(c?.name ?? '').trim().slice(0, 200), max: clampInt(c?.max, 1, 100, 1) }))
    .filter((c) => c.name)
    .slice(0, GRADE_RUBRIC_MAX)
  if (!rubric.length) throw new TeacherToolError('bad_request', 'rubric')
  return { lang: normLang(r.lang), ...(isUnitId(r.unit) ? { unit: r.unit } : {}), rubric, images }
}

/* ------------------------------------------------------------------ разбор ответа */

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '')
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN
  return Number.isFinite(n) ? n : d
}
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x) || str(obj(x)?.text) || str(obj(x)?.q)).filter(Boolean) : [])
/** Ответ сервера: {plan:{…}} | {result:{…}} | {data:{…}} | сам объект. */
function payload(raw: unknown, key: TeacherToolKind): Obj {
  const r = obj(raw) ?? {}
  return obj(r[key]) ?? obj(r.result) ?? obj(r.data) ?? r
}

export function normPlan(raw: unknown): LessonPlan {
  const p = payload(raw, 'plan')
  const stages = (Array.isArray(p.stages) ? p.stages : [])
    .map((s): PlanStage | null => {
      const o = obj(s)
      if (!o) return str(s) ? { name: str(s), minutes: 0, activities: [] } : null
      const name = str(o.name) || str(o.title)
      if (!name) return null
      return { name, minutes: Math.max(0, Math.round(num(o.minutes ?? o.min))), activities: strList(o.activities ?? o.steps) }
    })
    .filter((s): s is PlanStage => !!s)
  const problems = (Array.isArray(p.problems) ? p.problems : [])
    .map((x): PlanProblem | null => {
      const o = obj(x)
      if (!o) return str(x) ? { text: str(x), solution: '', answer: '' } : null
      const text = str(o.text) || str(o.q)
      return text ? { text, solution: str(o.solution), answer: str(o.answer) } : null
    })
    .filter((x): x is PlanProblem => !!x)
  const links = (Array.isArray(p.links) ? p.links : [])
    .map((x): PlanLink | null => {
      if (typeof x === 'string') return x.trim() ? { title: x.trim(), href: x.trim() } : null
      const o = obj(x)
      const href = str(o?.href) || str(o?.url) || str(o?.route)
      const title = str(o?.title) || str(o?.name) || href
      return href || title ? { title, href } : null
    })
    .filter((x): x is PlanLink => !!x)
  return { title: str(p.title), objectives: strList(p.objectives ?? p.goals), stages, questions: strList(p.questions), problems, links }
}

function normScale(raw: unknown): TestScaleRow[] {
  const rows: TestScaleRow[] = []
  if (Array.isArray(raw)) {
    for (const x of raw) {
      const o = obj(x)
      if (!o) continue
      const mark = str(o.mark ?? o.grade ?? o.score ?? o.label)
      if (!mark) continue
      rows.push({ mark, from: num(o.from ?? o.min), to: num(o.to ?? o.max) })
    }
  } else if (obj(raw)) {
    // {"5": [14, 16]} | {"5": {from, to}} | {"5": 14} (только нижняя граница)
    for (const [mark, v] of Object.entries(raw as Obj)) {
      if (Array.isArray(v)) rows.push({ mark, from: num(v[0]), to: num(v[1], num(v[0])) })
      else if (obj(v)) rows.push({ mark, from: num(obj(v)!.from ?? obj(v)!.min), to: num(obj(v)!.to ?? obj(v)!.max) })
      else if (typeof v === 'number') rows.push({ mark, from: v, to: NaN })
    }
    // только нижние границы → верхняя = следующая нижняя − 1
    rows.sort((a, b) => b.from - a.from)
    for (let i = 0; i < rows.length; i++) if (!Number.isFinite(rows[i]!.to)) rows[i]!.to = i === 0 ? rows[i]!.from : rows[i - 1]!.from - 1
  }
  return rows.filter((r) => Number.isFinite(r.from) && Number.isFinite(r.to)).sort((a, b) => b.from - a.from)
}

/** Школьная пятибалльная шкала по проценту (если сервер шкалу не прислал): 86/71/56 % — как в отчётах СОР/СОЧ. */
export function defaultScale(total: number): TestScaleRow[] {
  const t = Math.max(1, Math.round(total))
  const at = (p: number) => Math.ceil((t * p) / 100)
  const s5 = at(86)
  const s4 = Math.min(at(71), s5 - 1)
  const s3 = Math.min(at(56), s4 - 1)
  return [
    { mark: '5', from: s5, to: t },
    { mark: '4', from: s4, to: s5 - 1 },
    { mark: '3', from: s3, to: s4 - 1 },
    { mark: '2', from: 0, to: s3 - 1 },
  ].filter((r) => r.to >= r.from)
}

export function normTest(raw: unknown): TeacherTest {
  const p = payload(raw, 'test')
  const items = (Array.isArray(p.items) ? p.items : Array.isArray(p.questions) ? p.questions : [])
    .map((x): TestItem | null => {
      const o = obj(x)
      const q = str(o?.q) || str(o?.question) || str(o?.text)
      if (!o || !q) return null
      const options = Array.isArray(o.options ?? o.choices) ? strList(o.options ?? o.choices) : undefined
      const ans = Array.isArray(o.answer) ? strList(o.answer).join('; ') : str(o.answer ?? o.key)
      const item: TestItem = { type: str(o.type) || (options?.length ? 'single' : 'open'), q, answer: ans, points: Math.max(0, num(o.points, 1)), unit: str(o.unit) }
      if (options?.length) item.options = options
      return item
    })
    .filter((x): x is TestItem => !!x)
  const sum = items.reduce((a, it) => a + it.points, 0)
  const totalPoints = num(p.totalPoints, sum) || sum
  const scale = normScale(p.scale)
  return { title: str(p.title), items, totalPoints, scale: scale.length ? scale : defaultScale(totalPoints) }
}

export function normGrade(raw: unknown): GradeResult {
  const p = payload(raw, 'grade')
  const criteria = (Array.isArray(p.criteria) ? p.criteria : [])
    .map((x): GradeCriterion | null => {
      const o = obj(x)
      const name = str(o?.name)
      if (!o || !name) return null
      const max = Math.max(0, num(o.max))
      return { name, max, points: Math.min(max || Infinity, Math.max(0, num(o.points))), comment: str(o.comment) }
    })
    .filter((x): x is GradeCriterion => !!x)
  const total = num(p.total, criteria.reduce((a, c) => a + c.points, 0))
  const max = num(p.max, criteria.reduce((a, c) => a + c.max, 0))
  return { criteria, total, max, note: str(p.note) }
}

const NORM: { [K in TeacherToolKind]: (raw: unknown) => TeacherToolMap[K]['res'] } = { plan: normPlan, test: normTest, grade: normGrade }

/** Пустой ли ответ (сервер не справился) — показываем ошибку, а не пустую карточку. */
export function isEmptyResult(kind: TeacherToolKind, r: LessonPlan | TeacherTest | GradeResult): boolean {
  if (kind === 'plan') return !(r as LessonPlan).stages.length && !(r as LessonPlan).objectives.length
  if (kind === 'test') return !(r as TeacherTest).items.length
  return !(r as GradeResult).criteria.length
}

/* ------------------------------------------------------------------ запрос */

/** План и тест сервер обещает ≤ 20 с; проверка по фото читает до 4 снимков моделью — дольше. */
export const TIMEOUT_MS: Record<TeacherToolKind, number> = { plan: 60_000, test: 60_000, grade: 120_000 }

const SERVER_CODES: readonly TeacherToolErrorCode[] = ['forbidden', 'bad_request', 'not_found', 'rate', 'busy', 'disabled', 'internal']

function errorFrom(raw: unknown, fallback: TeacherToolErrorCode, retryHeader: number | null): TeacherToolError {
  const r = obj(raw) ?? {}
  const nested = obj(r.error)
  const codeRaw = str(r.code) || str(nested?.code) || str(r.error)
  const code = (SERVER_CODES as readonly string[]).includes(codeRaw) ? (codeRaw as TeacherToolErrorCode) : fallback
  return new TeacherToolError(code, str(r.message) || str(nested?.message), num(r.retryAfterSec, 0) || retryHeader || undefined)
}

export interface TeacherToolOptions {
  signal?: AbortSignal
  /** Подмена fetch (тесты). */
  fetchImpl?: typeof fetch
  /** Адрес мозга (тесты); по умолчанию — brainClient. */
  baseUrl?: string
}

/** Вызвать инструмент учителя. Успех — разобранный ответ; любой отказ — throw TeacherToolError. */
export async function callTeacherTool<K extends TeacherToolKind>(
  kind: K,
  req: TeacherToolMap[K]['req'],
  opts: TeacherToolOptions = {},
): Promise<TeacherToolMap[K]['res']> {
  const body = buildBody(kind, req)
  let base = opts.baseUrl ?? getBrainUrl()
  if (!base && !opts.baseUrl) {
    await ensureBrainOnline()
    base = getBrainUrl()
  }
  if (!base) throw new TeacherToolError('offline')

  const { owner, teacher } = readBrainKeys()
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json', [BRAIN_SESSION_HEADER]: brainSessionId() }
  if (owner) headers['X-Brain-Admin'] = owner
  else if (teacher) body.teacherKey = teacher

  const ctrl = new AbortController()
  let timedOut = false
  const outer = opts.signal
  const onAbort = () => ctrl.abort()
  if (outer?.aborted) throw new TeacherToolError('aborted')
  outer?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => {
    timedOut = true
    ctrl.abort()
  }, TIMEOUT_MS[kind])
  try {
    let res: Response
    try {
      res = await (opts.fetchImpl ?? fetch)(`${base}/teacher/${kind}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: ctrl.signal,
        cache: 'no-store',
      })
    } catch {
      if (outer?.aborted) throw new TeacherToolError('aborted')
      throw new TeacherToolError(timedOut ? 'timeout' : 'network')
    }
    let data: unknown = null
    try {
      data = await res.json()
    } catch {
      if (outer?.aborted) throw new TeacherToolError('aborted')
      if (timedOut) throw new TeacherToolError('timeout')
      data = null
    }
    const retryRaw = Number(res.headers.get('Retry-After'))
    const retry = Number.isFinite(retryRaw) && retryRaw > 0 ? retryRaw : null
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw errorFrom(data, 'forbidden', null)
      if (res.status === 404) throw errorFrom(data, 'disabled', null) // старый сервер без /teacher/*
      if (res.status === 429) throw errorFrom(data, 'rate', retry)
      if (res.status === 400 || res.status === 413 || res.status === 422) throw errorFrom(data, 'bad_request', null)
      if (res.status === 503) throw errorFrom(data, 'busy', retry)
      throw errorFrom(data, 'internal', null)
    }
    if (obj(data)?.ok === false) throw errorFrom(data, 'internal', retry)
    const out = NORM[kind](data) as TeacherToolMap[K]['res']
    if (isEmptyResult(kind, out)) throw new TeacherToolError('internal', 'empty')
    return out
  } finally {
    clearTimeout(timer)
    outer?.removeEventListener('abort', onAbort)
  }
}
