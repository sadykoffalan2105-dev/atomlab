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
import {
  buildBody,
  errorFrom,
  isEmptyResult,
  NORM,
  TeacherToolError,
  TIMEOUT_MS,
  type TeacherToolKind,
  type TeacherToolMap,
} from './teacherToolsContract'

// контракт (типы, ограничения, разбор) — в teacherToolsContract.ts; отсюда реэкспорт, чтобы импорт был один
export * from './teacherToolsContract'

/* ------------------------------------------------------------------ запрос */

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
    if (data && typeof data === 'object' && (data as { ok?: unknown }).ok === false) throw errorFrom(data, 'internal', retry)
    const out = NORM[kind](data) as TeacherToolMap[K]['res']
    if (isEmptyResult(kind, out)) throw new TeacherToolError('internal', 'empty')
    return out
  } finally {
    clearTimeout(timer)
    outer?.removeEventListener('abort', onAbort)
  }
}
