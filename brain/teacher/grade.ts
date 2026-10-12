/**
 * POST /teacher/grade — проверка письменной работы по разбаловке: баллы по критериям — РЕКОМЕНДАЦИЯ,
 * окончательную оценку ставит и подтверждает учитель (ЗРУ-1115 «Об искусственном интеллекте»: решение ИИ в отношении
 * человека — только рекомендательное, с участием человека). Фото работ никуда не пишутся: только память запроса.
 * Модель со зрением есть — читает фото и предлагает баллы (строго в пределах максимума критерия);
 * нет модели или ответ не разобран — mode 'manual': та же разбаловка с пустыми баллами, учитель ставит сам.
 */
import type { LlmClient } from '../llm/ollama.ts'
import type { Lang } from '../pipeline/normalize.ts'
import { hasR3 } from '../pipeline/postcheck.ts'
import type { TeacherConfig } from './config.ts'
import { L3 } from './content.ts'
import { scaleFor } from './test.ts'

export type RubricCriterion = { task: number; criterion: number; label: string; max: number; answer?: string }
export type GradeScore = RubricCriterion & { points: number | null; comment?: string }
export type GradeResult = {
  recommendation: true
  mode: 'vision' | 'manual'
  notice: string
  lang: Lang
  scores: GradeScore[]
  totalMax: number
  totalRecommended: number | null
  markRecommended: 5 | 4 | 3 | 2 | null
  model?: string
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v.replace(',', '.'))) ? Number(v.replace(',', '.')) : null)

/**
 * Разбаловка: строка «1; 2+2; 1+1+1+1» (как в «Отчётах СОР/СОЧ», скобки раскрываются) или {tasks:[{title, max, answer?,
 * criteria?:[{label, points}] | parts?:[{label, max}]}]} (ответ /teacher/test подходит как есть: items или structure).
 * Ошибка — строка для 400.
 */
export function parseRubric(raw: unknown): RubricCriterion[] | string {
  const out: RubricCriterion[] = []
  if (typeof raw === 'string') {
    const tasks = raw.split(/[;\n]/).map((s) => s.trim()).filter(Boolean)
    if (!tasks.length || tasks.length > 60) return 'rubric: 1–60 заданий'
    tasks.forEach((t, i) => {
      const parts = t.replace(/[()]/g, ' ').split(/[+,\s/]+/).filter(Boolean)
      parts.forEach((p, k) => out.push({ task: i + 1, criterion: k + 1, label: '', max: num(p) ?? NaN }))
    })
  } else if (raw && typeof raw === 'object') {
    const r = raw as { tasks?: unknown; items?: unknown; structure?: { tasks?: unknown } }
    const tasks = Array.isArray(r.tasks) ? r.tasks : Array.isArray(r.items) ? r.items : Array.isArray(r.structure?.tasks) ? r.structure.tasks : null
    if (!tasks || !tasks.length || tasks.length > 60) return 'rubric: {tasks:[…]} 1–60 заданий'
    tasks.forEach((t, i) => {
      const o = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>
      const answer = typeof o.answer === 'string' ? o.answer.slice(0, 400) : undefined
      const crit = Array.isArray(o.criteria) ? o.criteria : Array.isArray(o.parts) && o.parts.length ? o.parts : null
      if (crit) {
        crit.forEach((c, k) => {
          const cc = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
          out.push({ task: i + 1, criterion: k + 1, label: typeof cc.label === 'string' ? cc.label.slice(0, 80) : '', max: num(cc.points ?? cc.max) ?? NaN, ...(answer && k === 0 ? { answer } : {}) })
        })
      } else out.push({ task: i + 1, criterion: 1, label: typeof o.title === 'string' ? o.title.slice(0, 80) : '', max: num(o.max ?? o.points) ?? NaN, ...(answer ? { answer } : {}) })
    })
  } else return 'rubric: строка разбаловки или {tasks:[…]}'
  if (!out.length || out.length > 200) return 'rubric: 1–200 критериев'
  if (out.some((c) => !Number.isFinite(c.max) || c.max <= 0 || c.max > 100)) return 'rubric: баллы критерия — числа 0 < max ≤ 100'
  return out
}

const NOTICE: Record<Lang, string> = {
  ru: 'Рекомендация ИИ, подтверждает учитель. Окончательные баллы ставит учитель (ЗРУ-1115).',
  uz: 'Sunʼiy intellekt tavsiyasi, oʻqituvchi tasdiqlaydi. Yakuniy ballni oʻqituvchi qoʻyadi (OʻRQ-1115).',
  en: 'AI recommendation, confirmed by the teacher. The teacher sets the final score (Law ZRU-1115).',
}

function markOf(total: number, max: number, scale: TeacherConfig['scale']): 5 | 4 | 3 | 2 {
  const s = scaleFor(max, scale)
  return (s.find((x) => total >= x.minPoints)?.mark ?? 2) as 5 | 4 | 3 | 2
}

/** Подсказка модели: разбаловка + ключ; ответ — только JSON. */
export function gradePrompt(rubric: RubricCriterion[], lang: Lang): { system: string; user: string } {
  const lines = rubric.map((c) => `${c.task}.${c.criterion} max=${c.max}${c.label ? ` «${c.label}»` : ''}${c.answer ? ` | ${L3(lang, 'ключ', 'kalit', 'key')}: ${c.answer}` : ''}`)
  const system = L3(
    lang,
    'Ты помощник учителя химии. Проверь работу ученика на фото по разбаловке. Баллы — только рекомендация, решение принимает учитель. Ответь ТОЛЬКО JSON: {"scores":[{"task":1,"criterion":1,"points":0,"comment":"кратко"}]}. points — от 0 до max критерия, шаг 0.5. Не видно ответа — points 0 и комментарий «не видно».',
    'Sen kimyo oʻqituvchisining yordamchisisan. Rasmdagi oʻquvchi ishini ballar taqsimoti boʻyicha tekshir. Ballar faqat tavsiya, qarorni oʻqituvchi qabul qiladi. FAQAT JSON bilan javob ber: {"scores":[{"task":1,"criterion":1,"points":0,"comment":"qisqa"}]}. points — 0 dan mezon max gacha, qadam 0.5.',
    'You are a chemistry teacher assistant. Check the student work in the photo against the rubric. Scores are only a recommendation; the teacher decides. Reply with JSON ONLY: {"scores":[{"task":1,"criterion":1,"points":0,"comment":"short"}]}. points from 0 to the criterion max, step 0.5.',
  )
  return { system, user: `${L3(lang, 'Разбаловка', 'Ballar taqsimoti', 'Rubric')}:\n${lines.join('\n')}` }
}

/** Разобрать ответ модели; баллы обрезаются в [0, max] и округляются до 0,5. null — не JSON / нет баллов. */
export function parseGradeReply(text: string, rubric: RubricCriterion[]): Map<string, { points: number; comment?: string }> | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  let obj: unknown
  try {
    obj = JSON.parse(m[0])
  } catch {
    return null
  }
  const arr = (obj as { scores?: unknown })?.scores
  if (!Array.isArray(arr)) return null
  const out = new Map<string, { points: number; comment?: string }>()
  for (const s of arr) {
    const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>
    const task = num(o.task)
    const crit = num(o.criterion) ?? 1
    const pts = num(o.points)
    const rc = rubric.find((c) => c.task === task && c.criterion === crit)
    if (!rc || pts == null) continue
    const clipped = Math.max(0, Math.min(rc.max, Math.round(pts * 2) / 2))
    const comment = typeof o.comment === 'string' && !hasR3(o.comment) ? o.comment.slice(0, 200) : undefined
    out.set(`${rc.task}.${rc.criterion}`, { points: clipped, ...(comment ? { comment } : {}) })
  }
  return out.size ? out : null
}

export async function gradeWork(opts: { rubric: RubricCriterion[]; images: string[]; lang: Lang; llm: LlmClient | null; cfg: TeacherConfig; signal?: AbortSignal }): Promise<GradeResult> {
  const { rubric, images, lang, llm, cfg } = opts
  const totalMax = rubric.reduce((a, c) => a + c.max, 0)
  const manual = (): GradeResult => ({
    recommendation: true,
    mode: 'manual',
    notice: NOTICE[lang],
    lang,
    scores: rubric.map((c) => ({ ...c, points: null })),
    totalMax,
    totalRecommended: null,
    markRecommended: null,
  })
  const st = llm?.status()
  if (!llm || !st?.available || st.vision !== true || !st.chatModel || !images.length) return manual()
  const p = gradePrompt(rubric, lang)
  let text: string | null = null
  try {
    text = await llm.complete({
      model: st.chatModel,
      messages: [
        { role: 'system', content: p.system },
        { role: 'user', content: p.user, images },
      ],
      temperature: 0,
      numPredict: 200 + rubric.length * 40,
      timeoutMs: cfg.grade.timeoutMs,
      ...(opts.signal ? { signal: opts.signal } : {}),
    })
  } catch {
    text = null
  }
  const got = text ? parseGradeReply(text, rubric) : null
  if (!got) return manual()
  const scores: GradeScore[] = rubric.map((c) => {
    const g = got.get(`${c.task}.${c.criterion}`)
    return { ...c, points: g ? g.points : null, ...(g?.comment ? { comment: g.comment } : {}) }
  })
  const complete = scores.every((s) => s.points != null)
  const total = scores.reduce((a, s) => a + (s.points ?? 0), 0)
  return {
    recommendation: true,
    mode: 'vision',
    notice: NOTICE[lang],
    lang,
    scores,
    totalMax,
    totalRecommended: complete ? total : null,
    markRecommended: complete ? markOf(total, totalMax, cfg.scale) : null,
    model: st.chatModel,
  }
}
