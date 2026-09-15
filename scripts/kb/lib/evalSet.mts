/**
 * Evaluation questions with known answers (app section ids).
 *
 * 1. Quiz banks g7/g8/g9 (ru). Many questions are templates that quote the section title
 *    ("Какое обоснование по теме «Оксиды» корректно?"), which would leak the answer. Quoted text that
 *    matches the section title is removed; other quoted concepts ("процесс «горение»") are kept.
 *    Questions left without chemistry content are dropped; identical questions attached to several
 *    sections get all of them as gold.
 *    Two query variants: `query` (question only) and `queryQA` (question + correct answer text).
 * 2. sectionQuizI18n.json (en/uz translations): only the evaluation holdout (holdout.mts) — the automatic
 *    uz/en → ru alignment never saw those items.
 * 3. Hand-written questions for grades 10–11 (data/evalQuestions.mts).
 */
import fs from 'node:fs'
import path from 'node:path'
import { analyzeTerms } from '../../../src/learn/kb/analyzer.ts'
import { HANDWRITTEN_QUESTIONS } from '../data/evalQuestions.mts'
import { isEvalHoldout } from './holdout.mts'

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..')

export type EvalItem = {
  id: string
  grade: number
  lang: 'ru' | 'en' | 'uz'
  query: string
  /** question + correct answer (quiz items only) */
  queryQA?: string
  /** correct answer in Russian (quiz items; also for en/uz translations, since the corpus is Russian) */
  answer?: string
  /** "g8-c1-s03" keys */
  gold: string[]
  source: 'quiz' | 'hand'
}

const META = new Set(
  analyzeTerms(
    'обоснование теме тема химически корректно факте факт держится вывод выводы формулировка формулировку точнее ' +
      'отделяет похожих идей идея материалу материал параграфа параграф соответствует запомнить содержание урока урок ' +
      'отражает курсом курса класса класс согласованное изученному реальное свойство явление характерно смежного ' +
      'понятия сформулирован ошибки считают правильным связанный является утверждение учебнику пример примеру ' +
      'перечисленного отметьте найдите выберите отличает описывает признак ожидать следует сопровождается обычно ' +
      'характеристика относится понятию лучше объясняет суть процесс происходит таком термин термина понимать точное описание ' +
      'смысл раскрывает среди ответов называют словом верную понятия формулировку',
  ),
)

const OTHER_META = new Set(
  analyzeTerms(
    'rationale topic chemically conclusion considered fact formulation remember lesson content reflects course grade ' +
      'mavzu mavzusi asos kimyoviy jihatdan xulosa hisoblash mumkin fakt bandi band darslik material ' +
      "to'g'ri togri tanlang qaysi",
  ),
)

type BankQ = { id: string; question: string; choices?: string[]; correctIndex?: number }
type I18nQ = { questionEn?: string; questionUz?: string; choicesEn?: string[]; choicesUz?: string[] }

const QUOTE_RE = /«([^»]*)»|“([^”"]*)[”"]|"([^"]*)"|„([^“]*)“/g

/** Remove quoted segments that repeat the section title; unquote the others. Returns [text, titleRemoved]. */
function handleQuotes(q: string, titleTerms: Set<string>): [string, boolean] {
  let removed = false
  const text = q.replace(QUOTE_RE, (...m: string[]) => {
    const inner = m[1] ?? m[2] ?? m[3] ?? m[4] ?? ''
    const terms = analyzeTerms(inner)
    const overlap = terms.filter((t) => titleTerms.has(t)).length
    if (!terms.length || overlap / terms.length >= 0.5) {
      removed = true
      return ' '
    }
    return ` ${inner} `
  })
  return [text, removed]
}

function tidy(q: string): string {
  return q
    .replace(/^\s*По\s+§\s*:?\s*/i, '')
    .replace(/^\s*По учебнику\s*:\s*/i, '')
    .replace(/^\s*(According to (the textbook|§)|By §|Per §)\s*:?\s*/i, '')
    .replace(/^\s*(§\s*)?(bo[‘'`’]?yicha|Darslikka ko[‘'`’]?ra)\s*:?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function contentTerms(q: string, meta: Set<string>): string[] {
  return analyzeTerms(q, { query: true }).filter((t) => !meta.has(t))
}

export function buildEvalSet(): { items: EvalItem[]; stats: Record<string, number> } {
  const i18n = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/sectionQuizI18n.json'), 'utf8')) as Record<string, I18nQ>
  const stats: Record<string, number> = { quizTotal: 0, quizDroppedTemplate: 0, quizGroupsRu: 0, translated: 0 }
  const items: EvalItem[] = []
  for (const g of [7, 8, 9]) {
    const toc = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/g${g}BookToc.json`), 'utf8')) as {
      ch: number
      sec: number
      titleRu: string
    }[]
    const titleOf = new Map(toc.map((e) => [`g${g}-c${e.ch}-s${String(e.sec).padStart(2, '0')}`, e.titleRu]))
    const bank = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/g${g}SectionQuizBank.json`), 'utf8')) as {
      sections: Record<string, BankQ[]>
    }
    type Group = { query: string; answer: string; gold: Set<string>; ids: string[]; qs: BankQ[] }
    const groups = new Map<string, Group>()
    for (const [sid, qs] of Object.entries(bank.sections)) {
      const titleTerms = new Set(analyzeTerms(titleOf.get(sid) ?? ''))
      for (const q of qs) {
        stats.quizTotal += 1
        // questions generated from the old garbled grade-8 text ("Р åзульòàòы") cannot be answered by anything
        if ((q.question.match(/[À-ÿ]/g) ?? []).length >= 2) {
          stats.quizDroppedGarbled = (stats.quizDroppedGarbled ?? 0) + 1
          continue
        }
        const [unquoted] = handleQuotes(q.question, titleTerms)
        const query = tidy(unquoted.replace(/^\s*Параграф\s+—\s*это…?\s*$/i, ''))
        const content = contentTerms(query, META)
        if (content.length < 1 || (content.length < 2 && query.length < 12)) {
          stats.quizDroppedTemplate += 1
          continue
        }
        const key = content.join(' ')
        let grp = groups.get(key)
        const answer = q.choices && q.correctIndex != null ? (q.choices[q.correctIndex] ?? '') : ''
        if (!grp) groups.set(key, (grp = { query, answer, gold: new Set(), ids: [], qs: [] }))
        grp.gold.add(sid)
        grp.ids.push(q.id)
        grp.qs.push(q)
      }
    }
    for (const grp of groups.values()) {
      stats.quizGroupsRu += 1
      const gold = [...grp.gold]
      items.push({
        id: grp.ids[0],
        grade: g,
        lang: 'ru',
        query: grp.query,
        queryQA: grp.answer ? `${grp.query} ${grp.answer}` : undefined,
        answer: grp.answer || undefined,
        gold,
        source: 'quiz',
      })
      // translations only when every copy of this question is held out from the alignment training
      if (!grp.ids.every((id) => isEvalHoldout(id))) continue
      const q = grp.qs.find((x) => i18n[x.id]?.questionEn || i18n[x.id]?.questionUz)
      if (!q) continue
      const t = i18n[q.id]
      const sid = q.id.replace(/-(q|tpl)\d+$/, '')
      const titleTerms = new Set(analyzeTerms(titleOf.get(sid) ?? ''))
      for (const lang of ['en', 'uz'] as const) {
        const raw = lang === 'en' ? t.questionEn : t.questionUz
        if (!raw) continue
        // the title is in another language: drop every quote when the Russian original quoted the title
        const [ruUnquoted, ruRemoved] = handleQuotes(q.question, titleTerms)
        void ruUnquoted
        const text = tidy(
          ruRemoved ? raw.replace(QUOTE_RE, ' ') : raw.replace(QUOTE_RE, (...m: string[]) => ` ${m[1] ?? m[2] ?? m[3] ?? m[4] ?? ''} `),
        )
        if (contentTerms(text, OTHER_META).length < 2) continue
        const choices = lang === 'en' ? t.choicesEn : t.choicesUz
        const ans = q.correctIndex != null ? choices?.[q.correctIndex] : undefined
        stats.translated += 1
        items.push({
          id: `${q.id}-${lang}`,
          grade: g,
          lang,
          query: text,
          queryQA: ans ? `${text} ${ans}` : undefined,
          answer: grp.answer || undefined,
          gold,
          source: 'quiz',
        })
      }
    }
  }
  for (const h of HANDWRITTEN_QUESTIONS) {
    items.push({ id: h.id, grade: h.grade, lang: h.lang, query: h.q, gold: h.gold.map((s) => (/^c\d+-s\d+$/.test(s) ? `g${h.grade}-${s}` : `-${s}`)), source: 'hand' })
  }
  return { items, stats }
}

const ANSWER_META = new Set(analyzeTerms('всё перечисленное все перечисленные ни один из вариантов верны неверны оба'))

/**
 * Content terms of a quiz answer, or null when the answer is too short to be checked in a text
 * ("да", "3", a lone symbol). Used for the label-free "answer-bearing" metric.
 */
export function answerTerms(answer: string | undefined): string[] | null {
  if (!answer) return null
  const terms = [...new Set(analyzeTerms(answer, { query: true }).filter((t) => !ANSWER_META.has(t)))]
  return terms.length >= 2 ? terms : null
}

/** A retrieved text "bears the answer" when it contains at least 75 % of the answer's content terms. */
export function bearsAnswer(textTerms: Set<string>, aTerms: string[]): boolean {
  let found = 0
  for (const t of aTerms) if (textTerms.has(t)) found += 1
  return found >= Math.ceil(aTerms.length * 0.75)
}

/** Section key of a hit / chunk: "g8-c1-s03" (null when the chunk has no section). */
export function sectionKey(grade: number | null | undefined, chapterId?: string | null, sectionId?: string | null): string | null {
  if (grade == null || !chapterId || !sectionId) return null
  return `g${grade}-${chapterId}-${sectionId}`
}
