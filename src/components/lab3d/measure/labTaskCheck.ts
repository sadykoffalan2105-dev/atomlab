/**
 * Проверка ответа задачи-опыта и сверка измерений с расчётом. Чистые функции — их используют доска, панель
 * лаборатории, прогресс и тесты.
 *
 * Ответ засчитывается, если он совпал:
 *  • с ответом учебника — с допуском на школьное округление (не меньше ±0,8 %, как в тренажёре задач);
 *  • ИЛИ с тем же расчётом из ваших измерений (±1,5 %): ученик честно подставил свои числа — это тоже верно.
 * «Почти» (±5 %) — арифметика верна по смыслу, но округлили слишком рано или ошиблись в последнем знаке.
 */
import type { LabTask, LabTaskAnswer, LabTaskValues } from '../../../data/labTasks/labTaskTypes'

export type AnswerStatus = 'empty' | 'invalid' | 'book' | 'run' | 'close' | 'wrong'

export interface AnswerCheck {
  readonly key: string
  readonly status: AnswerStatus
  readonly value: number | null
  readonly book: number
  readonly run: number
}

/** Разбор числа, как его пишут школьники: «0,4», «2.41», «2,41·10^23», «2,41*10²³», «134 л». */
export function parseAnswerNumber(raw: string, exponent = 0): number | null {
  let s = raw.trim().toLowerCase()
  if (!s) return null
  const sup: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' }
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/g, (c) => sup[c] ?? c)
  s = s.replace(/\s+/g, '').replace(/,/g, '.').replace(/−/g, '-')
  // «2.41·10^23», «2.41*10^23», «2.41x10^23», «2.41×1023» (без знака степени — как набирают на телефоне)
  const sci = s.match(/^(-?\d+(?:\.\d+)?)(?:[·*x×]10\^?(-?\d+))/)
  if (sci) {
    const v = Number(sci[1]) * 10 ** Number(sci[2])
    return exponent ? v / 10 ** exponent : v
  }
  const e = s.match(/^(-?\d+(?:\.\d+)?)e(-?\d+)/)
  if (e) {
    const v = Number(e[1]) * 10 ** Number(e[2])
    return exponent ? v / 10 ** exponent : v
  }
  const plain = s.match(/^-?\d+(?:\.\d+)?/)
  if (!plain) return null
  const v = Number(plain[0])
  if (!Number.isFinite(v)) return null
  // мантисса без степени (поле «·10²³» уже подписано) — как есть; полное число 2,4e23 в поле с exponent — делим
  if (exponent && Math.abs(v) >= 10 ** (exponent - 3)) return v / 10 ** exponent
  return v
}

const rel = (a: number, b: number) => (b === 0 ? Math.abs(a) : Math.abs(a - b) / Math.abs(b))

export function checkAnswer(a: LabTaskAnswer, values: LabTaskValues, raw: string): AnswerCheck {
  const run = a.fromRun(values)
  const base = { key: a.key, book: a.book, run }
  if (!raw.trim()) return { ...base, status: 'empty', value: null }
  const value = parseAnswerNumber(raw, a.exponent ?? 0)
  if (value == null) return { ...base, status: 'invalid', value: null }
  // допуск на округление до decimals знаков у ответа учебника
  const roundTol = (0.5 * 10 ** -a.decimals) / Math.max(1e-9, Math.abs(a.book))
  if (rel(value, a.book) <= Math.max(0.008, roundTol * 1.01)) return { ...base, status: 'book', value }
  const runTol = (x: number) => Math.max(0.015, (0.5 * 10 ** -a.decimals) / Math.max(1e-9, Math.abs(x)))
  if (rel(value, run) <= runTol(run)) return { ...base, status: 'run', value }
  // простое «× масштаб опыта» вместо пересчёта по фактической навеске — тоже честный расчёт из измерений
  const alt = a.altFromRun?.(values)
  if (alt != null && Number.isFinite(alt) && rel(value, alt) <= runTol(alt)) return { ...base, status: 'run', value }
  if (rel(value, a.book) <= 0.05 || rel(value, run) <= 0.05 || (alt != null && rel(value, alt) <= 0.05)) return { ...base, status: 'close', value }
  return { ...base, status: 'wrong', value }
}

export function checkAnswers(task: LabTask, values: LabTaskValues, raw: Readonly<Record<string, string>>): readonly AnswerCheck[] {
  return task.answers.map((a) => checkAnswer(a, values, raw[a.key] ?? ''))
}

export const answerOk = (c: AnswerCheck) => c.status === 'book' || c.status === 'run'

export interface CompareRow {
  readonly measured: number
  readonly predicted: number
  readonly book: number
  /** Отклонение измерения от расчёта по вашим количествам, %. */
  readonly devPct: number
  /** Отклонение от учебника (в масштабе опыта), %. */
  readonly bookDevPct: number
  /** Укладывается ли в погрешность метода. */
  readonly withinMethod: boolean
}

export function compareRows(task: LabTask, values: LabTaskValues): readonly CompareRow[] {
  return task.compare.map((c) => {
    const measured = c.measured(values)
    const predicted = c.predicted(values)
    const devPct = predicted === 0 ? 0 : ((measured - predicted) / predicted) * 100
    const bookDevPct = c.book === 0 ? 0 : ((measured - c.book) / c.book) * 100
    return { measured, predicted, book: c.book, devPct, bookDevPct, withinMethod: Math.abs(devPct) <= c.tolerancePct + 1e-9 }
  })
}
