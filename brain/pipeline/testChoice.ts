/**
 * Тест с вариантами ответа («Выбери правильный ответ: … а) … б) … в) …») → буква правильного варианта и одна строка
 * обоснования из банка тестов учебника (карта программы Kimyo 7–11: unit.tests с correct). Вопрос ищется по тексту
 * (ru/uz/en, без приставки «По § «…»:») и по набору вариантов; ученик мог переставить варианты — буква берётся из его
 * списка. Не нашли в банке — null: отвечает обычный конвейер (без выдуманной буквы).
 *
 *   parseChoiceQuestion(text)            — { stem, choices: [{ letter, text }] } | null
 *   testChoiceTool(text, lang, kb, grade) — ToolResult 'test' (подпись — § единицы теста)
 */
import type { CurriculumMap } from '../curriculum/map.ts'
import type { Unit, UnitTest } from '../curriculum/types.ts'
import type { Knowledge } from '../kb/shards.ts'
import { unitCite } from './bookCite.ts'
import type { Lang } from './normalize.ts'
import type { ToolResult } from './tools.ts'

export type Choice = { letter: string; text: string }
export type ChoiceQuestion = { stem: string; choices: Choice[] }

const L = (lang: Lang, ru: string, uz: string, en: string) => (lang === 'ru' ? ru : lang === 'uz' ? uz : en)
const HEAD_RE = /^\s*(выбери(те)?\s+(один\s+)?(правильный|верный)\s+(ответ|вариант)|to['ʻʼ‘’`]?g['ʻʼ‘’`]?ri\s+javobni\s+tanlang|choose\s+the\s+correct\s+(answer|option))\s*[:.!]?\s*/iu
const PREFIX_RE = /^(По § «[^»]+»|§ [“«"][^”»"]+[”»"][^:]{0,30}|According to § [“«"][^”»"]+[”»"]):\s*/u
const LETTERS = 'абвгдеabcdefABCDEFАБВГДЕ'

/** вариант с новой строки «а) …», «Б. …», «c) …» */
const LINE_RE = /^\s*\(?([а-еА-Еa-fA-F])\s*[).]\s+(.+?)\s*$/u
/** варианты в одну строку: «… а) X б) Y в) Z» */
const INLINE_RE = /(?:^|\s)\(?([а-еА-Еa-fA-F])\)\s+/gu

function letterIndex(l: string): number {
  const i = LETTERS.indexOf(l)
  return i < 0 ? -1 : i % 6
}

export function parseChoiceQuestion(text: string): ChoiceQuestion | null {
  const lines = text.replace(/\r/g, '').split('\n')
  const choices: Choice[] = []
  const stem: string[] = []
  for (const line of lines) {
    const m = LINE_RE.exec(line)
    if (m && letterIndex(m[1]!) === choices.length) choices.push({ letter: m[1]!, text: m[2]! })
    else if (!choices.length) stem.push(line)
    else if (choices.length && line.trim()) choices[choices.length - 1]!.text += ' ' + line.trim()
  }
  if (choices.length < 2) {
    // одна строка: ищем «а) … б) …» с буквами по порядку
    const flat = text.replace(/\s+/g, ' ')
    const marks = [...flat.matchAll(INLINE_RE)].filter((m) => letterIndex(m[1]!) >= 0)
    const seq: RegExpMatchArray[] = []
    for (const m of marks) if (letterIndex(m[1]!) === seq.length) seq.push(m)
    if (seq.length < 2) return null
    const out: Choice[] = seq.map((m, i) => ({ letter: m[1]!, text: flat.slice(m.index! + m[0].length, i + 1 < seq.length ? seq[i + 1]!.index! : undefined).trim() }))
    return { stem: flat.slice(0, seq[0]!.index!).trim().replace(HEAD_RE, ''), choices: out }
  }
  return { stem: stem.join(' ').trim().replace(HEAD_RE, ''), choices }
}

/** для сравнения: строчные, апострофы узбекской латиницы — один знак, только буквы/цифры */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ʻʼ‘’`']/g, '')
    .replace(/ё/g, 'е')
    .replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

type Entry = { unit: Unit; test: UnitTest; lang: 'ru' | 'uz' | 'en'; order: number }
const INDEX = new WeakMap<CurriculumMap, { byStem: Map<string, Entry[]>; byChoices: Map<string, Entry[]> }>()
const choicesKey = (cs: string[]) => cs.map(norm).sort().join('|')

function index(map: CurriculumMap) {
  let ix = INDEX.get(map)
  if (ix) return ix
  const byStem = new Map<string, Entry[]>()
  const byChoices = new Map<string, Entry[]>()
  const add = (m: Map<string, Entry[]>, k: string, e: Entry) => k && m.set(k, [...(m.get(k) ?? []), e])
  map.units.forEach((unit, order) => {
    for (const test of unit.tests) {
      if (test.correct == null || !test.choices?.ru || test.choices.ru.length < 2) continue
      for (const lang of ['ru', 'uz', 'en'] as const) {
        const q = test.q[lang]
        const ch = test.choices[lang]
        if (!q || !ch || ch.length !== test.choices.ru.length) continue
        const e = { unit, test, lang, order }
        add(byStem, norm(q.replace(PREFIX_RE, '')), e)
        add(byChoices, choicesKey(ch), e)
      }
    }
  })
  ix = { byStem, byChoices }
  INDEX.set(map, ix)
  return ix
}

/** Найти тест банка: тот же вопрос и те же варианты (порядок вариантов не важен). */
export function findBankTest(map: CurriculumMap, q: ChoiceQuestion, grade: number | null): { entry: Entry; correctAt: number } | null {
  const ix = index(map)
  const mine = q.choices.map((c) => norm(c.text))
  const stem = norm(q.stem.replace(PREFIX_RE, ''))
  const cands = [...(ix.byStem.get(stem) ?? []), ...(ix.byChoices.get(choicesKey(q.choices.map((c) => c.text))) ?? [])]
  let best: { entry: Entry; correctAt: number; score: number } | null = null
  for (const e of cands) {
    const ch = e.test.choices![e.lang]!
    const correct = norm(ch[e.test.correct!]!)
    const correctAt = mine.indexOf(correct)
    if (correctAt < 0) continue
    const overlap = ch.filter((c) => mine.includes(norm(c))).length / Math.max(ch.length, mine.length)
    const stemOk = norm(e.test.q[e.lang]!.replace(PREFIX_RE, '')) === stem
    if (!stemOk && overlap < 1) continue
    // тот же порядок вариантов — это тот самый тест (одинаковые вопросы встречаются в нескольких §)
    const sameOrder = ch.length === mine.length && ch.every((c, k) => norm(c) === mine[k])
    const score = overlap + (stemOk ? 1 : 0) + (sameOrder ? 0.75 : 0) + (grade != null && e.unit.grade === grade ? 0.5 : 0) - e.order / 1e6
    if (!best || score > best.score) best = { entry: e, correctAt, score }
  }
  return best ? { entry: best.entry, correctAt: best.correctAt } : null
}

/** одна строка «почему»: пояснение банка (ru) или ответ банка, если он не повторяет вариант; иначе — ссылка на § */
function reasonOf(e: Entry, choice: string, lang: Lang): string {
  const label = e.unit.label[lang] ?? e.unit.label.ru
  const cand = [lang === 'ru' ? e.test.explanation?.ru : undefined, e.test.a[lang]].find((x) => !!x && norm(x) !== norm(choice) && x.length <= 240)
  const tail = L(lang, `так написано в учебнике (${label}).`, `darslikda shunday yozilgan (${label}).`, `this is what the textbook says (${label}).`)
  if (!cand) return tail
  const s = cand.trim().replace(/\s+/g, ' ')
  return `${s}${/[.!?]$/.test(s) ? '' : '.'} ${L(lang, 'Источник', 'Manba', 'Source')}: ${label}.`
}

export function testChoiceTool(text: string, lang: Lang, kb: Knowledge, grade: number | null): ToolResult | null {
  const map = kb.curriculum
  if (!map || text.length > 1500) return null
  const q = parseChoiceQuestion(text)
  if (!q || !q.stem) return null
  const hit = findBankTest(map, q, grade)
  if (!hit) return null
  const c = q.choices[hit.correctAt]!
  const reason = reasonOf(hit.entry, c.text, lang)
  const line = `${c.letter}) ${c.text} — ${reason}`
  return {
    tool: 'test',
    text: line,
    facts: `${L(lang, 'Правильный ответ теста', 'Testning toʻgʻri javobi', 'Correct test answer')}: ${c.letter}) ${c.text}`,
    numbers: [],
    cite: unitCite(hit.entry.unit),
  }
}
