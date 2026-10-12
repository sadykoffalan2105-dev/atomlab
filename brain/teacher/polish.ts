/**
 * Шлифовка формулировок плана моделью (если она есть): одна короткая просьба на все строки целей и ключевых вопросов.
 * Строка заменяется, только если в ней те же числа и формулы, тот же язык, нет R3-фраз и пересказа плана —
 * иначе остаётся детерминированный текст. Задачи, решения, уравнения и ссылки модель не видит и не меняет.
 */
import type { LlmClient } from '../llm/ollama.ts'
import { matchesLang, type Lang } from '../pipeline/normalize.ts'
import { hasCjk, hasR3, isPlanLeak } from '../pipeline/postcheck.ts'
import { L3 } from './content.ts'
import type { LessonPlan } from './plan.ts'

const tokens = (s: string) => (s.match(/\d+(?:[.,]\d+)?|[A-Z][a-z]?[₀-₉\d]*/g) ?? []).sort().join('|')

/** Годится ли новая строка вместо старой. */
export function polishedOk(before: string, after: string, lang: Lang): boolean {
  const a = after.trim()
  if (!a || a.length > before.length * 1.8 + 40 || a.length < before.length * 0.4) return false
  if (tokens(before) !== tokens(a)) return false
  if (hasR3(a) || hasCjk(a) || isPlanLeak(a) || !matchesLang(a, lang)) return false
  return true
}

export async function polishPlan(plan: LessonPlan, llm: LlmClient | null, timeoutMs: number, signal?: AbortSignal): Promise<{ plan: LessonPlan; polished: number }> {
  const st = llm?.status()
  if (!llm || !st?.available) return { plan, polished: 0 }
  const model = st.fastModel ?? st.chatModel
  if (!model) return { plan, polished: 0 }
  const lines = [...plan.objectives, ...plan.keyQuestions.map((k) => k.q)]
  const lang = plan.lang
  const prompt = L3(
    lang,
    'Перепиши каждую строку живым языком учителя химии, сохрани смысл, все числа и формулы. Ответ — те же номера строк, по одной на строке, без пояснений.',
    'Har bir qatorni kimyo oʻqituvchisi tilida qayta yoz, maʼno, barcha sonlar va formulalarni saqla. Javob — oʻsha raqamli qatorlar, har biri alohida qatorda, izohsiz.',
    'Rewrite each line in a natural chemistry-teacher voice; keep the meaning, all numbers and formulas. Reply with the same numbered lines, one per line, no comments.',
  )
  let text: string | null = null
  try {
    text = await llm.complete({ model, messages: [{ role: 'system', content: prompt }, { role: 'user', content: lines.map((l, i) => `${i + 1}. ${l}`).join('\n') }], temperature: 0.2, numPredict: 60 + lines.length * 50, timeoutMs, ...(signal ? { signal } : {}) })
  } catch {
    text = null
  }
  if (!text) return { plan, polished: 0 }
  const got = new Map<number, string>()
  for (const row of text.split('\n')) {
    const m = row.match(/^\s*(\d{1,2})[.)]\s+(.+)$/)
    if (m) got.set(Number(m[1]) - 1, m[2]!.trim())
  }
  let polished = 0
  const next = lines.map((l, i) => {
    const g = got.get(i)
    if (g && g !== l && polishedOk(l, g, lang)) {
      polished++
      return g
    }
    return l
  })
  const nObj = plan.objectives.length
  return {
    plan: { ...plan, objectives: next.slice(0, nObj), keyQuestions: plan.keyQuestions.map((k, i) => ({ ...k, q: next[nObj + i]! })) },
    polished,
  }
}
