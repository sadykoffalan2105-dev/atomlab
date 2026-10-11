/**
 * Школьный калькулятор: сверка ответа модели с расчётом (чистая функция).
 * Если среди инструментов есть calc:* и в предложении «Ответ/Javob/Answer» (или в последнем предложении ответа
 * модели) стоит число, которого нет в расчёте (допуск 0,5 % или 0,01), — это предложение заменяется строкой
 * «Ответ: …» инструмента. Если итогового числа в ответе нет — в конец добавляется строка «Ответ: …», а если модель
 * не привела ни одного шага (нет «=») — блок «Точный расчёт: …» целиком. Хук: dialogCheck.ts selfCheck после шага (1).
 */
import type { Lang } from '../pipeline/normalize.ts'
import type { ToolResult } from '../pipeline/tools.ts'

const ANSWER_RE = /^(?:\s*[-•*]?\s*)(ответ|javob|answer)(?![\p{L}])/iu
const EXACT_HEAD = /(Точный расчёт|Aniq hisob|Exact calculation)\s*:/u

/** Числа предложения, кроме индексов формул (H2O), коэффициентов (2H₂) и степеней (10²³). */
function numbersOf(s: string): number[] {
  const out: number[] = []
  for (const m of s.replace(/[−–]/g, '-').matchAll(/(?<![\p{L}\d)₀-₉.,])-?\d+(?:[.,]\d+)?(?![\d₀-₉]*\s*[A-Z(])/gu)) {
    const v = Number(m[0].replace(',', '.'))
    if (Number.isFinite(v)) out.push(v)
  }
  return out
}

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.005 * Math.abs(b), 0.01)
const numOf = (s: string) => Number(s.replace(/\s+/g, '').replace(/^[+−]/, (x) => (x === '−' ? '-' : '')).replace(',', '.').replace(/·10.*$/, ''))

function sentences(text: string): string[] {
  return text.split(/\n+/).flatMap((p) => p.split(/(?<=[.!?])\s+(?=[A-ZА-ЯЁʻ«(])/u)).filter((s) => s.trim())
}

export function reconcileCalcAnswer(text: string, tools: ToolResult[], lang: Lang): string {
  const calc = tools.filter((t) => t.tool.startsWith('calc:'))
  if (!calc.length || !text.trim()) return text
  // часть ответа, написанная моделью (до блока «Точный расчёт», если его уже добавил ensureToolNumbers)
  const cut = text.search(EXACT_HEAD)
  const model = cut >= 0 ? text.slice(0, cut) : text
  const tail = cut >= 0 ? text.slice(cut) : ''
  const known = calc.flatMap((t) => numbersOf(t.text))
  const finals = calc.flatMap((t) => t.numbers.map(numOf)).filter((x) => Number.isFinite(x))
  const answerLine = calc.map((t) => t.text.split('\n').find((l) => ANSWER_RE.test(l))).filter(Boolean).join(' ')
  let out = model
  const ss = sentences(model)
  const last = ss[ss.length - 1]
  for (const s of ss) {
    const isAns = ANSWER_RE.test(s) || (s === last && numbersOf(s).length > 0 && /=|≈/.test(s))
    if (!isAns || !answerLine) continue
    const nums = numbersOf(s)
    if (!nums.length) continue
    const bad = nums.some((n) => !known.some((k) => close(n, k)))
    if (bad) {
      out = out.replace(s, answerLine)
    }
  }
  // итогового числа нет (или модель не привела ни шага) — строка «Ответ» / расчёт целиком в конец
  if (!tail) {
    const have = numbersOf(out)
    const textAns = calc.flatMap((t) => t.numbers).filter((n) => !Number.isFinite(numOf(n)))
    const missing = finals.some((f) => !have.some((n) => close(n, f))) || textAns.some((x) => !out.includes(x))
    if (missing) {
      const head = lang === 'ru' ? 'Точный расчёт' : lang === 'uz' ? 'Aniq hisob' : 'Exact calculation'
      if (!/=/.test(model)) return `${out.trim()}\n\n${head}: ${calc.map((t) => t.text).join('\n')}`
      if (answerLine) return `${out.trim()}\n${answerLine}`
    }
  }
  return out + tail
}
