#!/usr/bin/env node
/**
 * Устные экзаменационные пулы для живого учителя, 8–11 класс.
 *
 * В приложении устный пул есть только для 7 класса (g7ExamPools.getOralExamPool).
 * Скрипт собирает вопросы с рубрикой (ключевые основы слов) из:
 *   1) шаблонных вопросов банков параграфов g8/g9 (+ переводы sectionQuizI18n.json);
 *   2) определений учебников в корпусе базы знаний (src/data/kb/corpus/kb-corpus-g*.json):
 *      «A называется B» → «Что называют B?», «X — это Y» → «Что такое X?»;
 *   3) фактов справочника тем (scripts/grade7-teacher-dataset/topics/grade*.json).
 * Переводы EN/UZ: из sectionQuizI18n, а для определений — через глоссарий kb-glossary.json
 * (только если термин и ≥2 ключевых слова рубрики переводятся).
 *
 * Выход: src/learn/brain/dualMode/examPools/oral-g{8..11}.json
 * Запуск: npx tsx scripts/build-teacher-exam-pools.mts
 */
import fs from 'node:fs'
import path from 'node:path'
import { contentStems, foldText, stemWord, tokenizeWords } from '../src/learn/brain/dualMode/textStems.ts'

type Lang = 'ru' | 'en' | 'uz'

type OralItem = {
  id: string
  kind: 'oral'
  questionSpeak: string
  questionDisplay?: string
  rubric: string[]
  sampleAnswer?: string
  chapterNum?: number
  sectionId?: string
  source: 'quiz' | 'textbook' | 'topics'
  questionSpeakEn?: string
  questionSpeakUz?: string
  rubricEn?: string[]
  rubricUz?: string[]
  sampleAnswerEn?: string
  sampleAnswerUz?: string
}

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'src/learn/brain/dualMode/examPools')
const MAX_PER_CHAPTER = 36

function readJson<T>(rel: string): T | null {
  const file = path.join(ROOT, rel)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

/* ------------------------------------------------------------ text quality */

const MOJIBAKE_RE = /[À-ÿðîåàñòâ]{2,}|[ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß]/
const SMALL_WORDS = new Set([
  'и', 'в', 'во', 'на', 'с', 'со', 'к', 'ко', 'о', 'об', 'у', 'по', 'за', 'из', 'от', 'до', 'не', 'ни', 'же', 'ли',
  'а', 'но', 'то', 'их', 'её', 'ее', 'он', 'мы', 'вы', 'её', 'ей', 'им', 'ею', 'при', 'для', 'без', 'над', 'под',
])

function looksClean(text: string): boolean {
  if (MOJIBAKE_RE.test(text)) return false
  if (/[`°]|\s[,.;:]\S|http|www\./.test(text)) return false
  const words = text.split(/\s+/)
  let tiny = 0
  for (const w of words) {
    const letters = w.replace(/[^\p{L}]/gu, '')
    if (!letters) continue
    // «НеоРгаНичесКиХ», «ме та л ло в»: странный регистр внутри слова / обрывки.
    if (/\p{Ll}\p{Lu}/u.test(letters) && !/^[A-Z][a-z]?\d/.test(w)) return false
    if (/[а-яё]/i.test(letters) && /[a-z]/i.test(letters)) return false
    if (letters.length <= 2 && /[а-яё]/i.test(letters) && !SMALL_WORDS.has(letters.toLowerCase())) tiny++
  }
  return tiny === 0
}

function tidy(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[•·\-–—\s]+/, '')
    .trim()
}

function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s
}

/* ------------------------------------------------------------------ rubric */

const RUBRIC_STOP = new Set([
  'который', 'которая', 'которое', 'которые', 'котор', 'является', 'являются', 'называется', 'называются', 'называют',
  'этого', 'этой', 'этом', 'такие', 'такой', 'также', 'только', 'между', 'более', 'менее', 'может', 'могут', 'одного',
  'одной', 'одним', 'других', 'другой', 'другие', 'после', 'всего', 'каждый', 'каждого', 'очень', 'часто', 'обычно',
  'школьная', 'школа', 'модель', 'пример', 'например', 'result', 'which', 'that', 'with', 'from', 'this', 'their',
])

/** Слишком общие основы: их скажут в любом ответе — рубрику они не проверяют. */
const GENERIC_PREFIXES = [
  'вещест', 'химиче', 'элемен', 'соедин', 'количе', 'значен', 'опреде', 'различ', 'образу', 'образо', 'содерж',
  'резуль', 'показы', 'котор', 'имеющ', 'требуе', 'перево', 'выража', 'необхо', 'минима', 'протек', 'пропус',
  'участв', 'междун', 'номенк', 'данны', 'случа', 'назван', 'процес', 'свойст', 'явлен', 'друг', 'числен',
  'величи', 'относи', 'подобн', 'основн', 'проявл', 'характ', 'некото', 'нескол', 'возник', 'помощ', 'поэт',
  'вступа', 'действ', 'соотно', 'разнов', 'одинак', 'простей', 'предста', 'сильн',
  'substa', 'chemic', 'elemen', 'compou', 'additi', 'reacti', 'proces', 'proper',
]

function isGeneric(stem: string): boolean {
  const s = stem.slice(0, 6)
  return GENERIC_PREFIXES.some((g) => s.length >= 4 && (g.startsWith(s) || s.startsWith(g)))
}

/** Обрывки слов из OCR («основ ной», «электро отрицательностью»). */
const FRAGMENT_RE =
  /(^|\s)(ной|ный|ная|ные|ного|ному|чей|ция|ции|ние|ния|тель|ств|ность|ностью|ских|ская|ского|рия|ми|электро|зада|катитон\p{L}*)(?=[\s,.;:!?…]|$)/iu

/** 2–4 ключевые основы (≥4 символов) для подстрочного сравнения в gradeExamAnswerLocal. */
function rubricFrom(text: string, exclude: string[] = [], max = 4, allowGeneric = true): string[] {
  const excl = exclude.flatMap((e) => contentStems(e))
  const seen = new Set<string>()
  const out: Array<{ stem: string; len: number; pos: number }> = []
  tokenizeWords(text).forEach((tok, pos) => {
    if (tok.length < 4 && !/\d/.test(tok)) return
    if (RUBRIC_STOP.has(tok)) return
    const stems = contentStems(tok)
    if (stems.length === 0) return
    let stem = stemWord(tok)
    if (/[a-z]/.test(stem) && stem.length > 6) stem = stem.slice(0, 6)
    if (stem.length < 3 && !/\d/.test(stem)) return
    if (excl.some((e) => e.startsWith(stem.slice(0, 5)) || stem.startsWith(e.slice(0, 5)))) return
    if (seen.has(stem)) return
    seen.add(stem)
    out.push({ stem, len: isGeneric(stem) ? tok.length - 20 : tok.length, pos })
  })
  // Длинные (информативные) слова важнее, общие («вещество», «элемент») — в конце.
  const specific = out.filter((x) => x.len > 0)
  if (!allowGeneric && specific.length < 2) return []
  return (specific.length >= 2 ? specific : out)
    .sort((a, b) => b.len - a.len || a.pos - b.pos)
    .slice(0, max)
    .sort((a, b) => a.pos - b.pos)
    .map((x) => x.stem)
}

/* ---------------------------------------------------------------- glossary */

type GlossaryEntry = { ru: string; en: string[]; uz: string[] }
const glossary = (readJson<{ entries: GlossaryEntry[] }>('src/data/kb/corpus/kb-glossary.json')?.entries ?? []).filter(
  (e) => e.ru && (e.en?.length || e.uz?.length),
)
const glossaryByStem = new Map<string, GlossaryEntry>()
for (const e of glossary) {
  const words = tokenizeWords(e.ru)
  if (words.length !== 1) continue
  glossaryByStem.set(stemWord(words[0]!).slice(0, 6), e)
}

function translateTerm(ruPhrase: string, lang: 'en' | 'uz'): string | null {
  const words = tokenizeWords(ruPhrase).filter((w) => w.length >= 3)
  if (words.length === 0 || words.length > 3) return null
  // Сначала вся фраза целиком.
  const whole = glossary.find((e) => foldText(e.ru) === foldText(ruPhrase))
  if (whole?.[lang]?.[0]) return whole[lang][0]!
  const parts: string[] = []
  for (const w of words) {
    const hit = glossaryByStem.get(stemWord(w).slice(0, 6))
    const tr = hit?.[lang]?.[0]
    if (!tr) return null
    parts.push(tr)
  }
  return parts.join(' ')
}

function translateRubric(rubricRu: string[], sourceText: string, lang: 'en' | 'uz'): string[] {
  const out: string[] = []
  for (const word of tokenizeWords(sourceText)) {
    const stem = stemWord(word).slice(0, 6)
    if (!rubricRu.some((r) => r.startsWith(stem.slice(0, 4)) || stem.startsWith(r.slice(0, 4)))) continue
    const tr = glossaryByStem.get(stem)?.[lang]?.[0]
    if (!tr) continue
    const key = stemWord(tr.split(/\s+/)[0] ?? tr).slice(0, 6)
    if (key.length >= 3 && !isGeneric(key) && !out.includes(key)) out.push(key)
  }
  return out.slice(0, 4)
}

/* ------------------------------------------------------------ 1) quiz bank */

type QuizItem = { id: string; templateKey?: string; question: string; choices: string[]; correctIndex: number }
type QuizI18n = { questionEn?: string; questionUz?: string; choicesEn?: string[]; choicesUz?: string[] }

const quizI18n = readJson<Record<string, QuizI18n>>('src/data/sectionQuizI18n.json') ?? {}
const JUNK_CHOICE_RE = /Так описывается другое|В данном § такой информации нет|неверная формулировка по учебнику|учебник Kimyo/

function stripParagraphPrefix(q: string): string {
  return q
    .replace(/^По § «[^»]*»:\s*/u, '')
    .replace(/^По учебнику:\s*/u, '')
    .replace(/^(According to|By|Per|In)\b[^:]{0,90}:\s*/iu, '')
    .replace(/^[«"“]?\s*§?\s*["“«][^"”»]*["”»]\s*(bo['‘ʻ’]?yicha|ga\s+ko['‘ʻ’]?ra)[^:]{0,20}:\s*/iu, '')
    .replace(/^Darslik[^:]{0,40}:\s*/iu, '')
    .trim()
}

function lowerTerm(s: string): string {
  return /^\p{Lu}{2}/u.test(s) ? s : s[0]!.toLowerCase() + s.slice(1)
}

function oralFromStem(stem: string, lang: Lang): string {
  const s = stem.trim()
  const m = s.match(/^(.{2,60}?)\s+[—–-]\s+(это|this is|is|are|bu)\s*(…|\.\.\.)$/iu)
  const shortTerm = Boolean(m) && m![1]!.trim().split(/\s+/).length <= 3 && !/[A-Za-z0-9₀-₉]/.test(lang === 'ru' ? m![1]! : '')
  if (m && shortTerm && lang === 'ru') return `Что такое ${lowerTerm(m[1]!.trim())}?`
  if (m && shortTerm && lang === 'en') return `What is ${lowerTerm(m[1]!.trim())}?`
  if (m && shortTerm && lang === 'uz') return `${m[1]!.trim()} nima?`
  if (/[?]$/.test(s)) return s
  const body = s.replace(/[:\s]*…$/u, '…')
  if (lang === 'en') return `Complete the sentence: “${body}”`
  if (lang === 'uz') return `Gapni davom ettiring: «${body}»`
  return `Закончи фразу: «${body}»`
}

function fromQuizBank(grade: 8 | 9): OralItem[] {
  const bank = readJson<{ sections: Record<string, QuizItem[]> }>(`src/data/g${grade}SectionQuizBank.json`)
  if (!bank) return []
  const out: OralItem[] = []
  const seen = new Set<string>()
  for (const [key, items] of Object.entries(bank.sections)) {
    const m = key.match(/^g\d+-c(\d+)-(s\d+)$/)
    if (!m) continue
    for (const it of items) {
      const correct = it.choices[it.correctIndex]
      if (!correct || it.choices.some((c) => JUNK_CHOICE_RE.test(c))) continue
      const stem = stripParagraphPrefix(it.question)
      if (!looksClean(stem) || !looksClean(correct) || stem.length > 140 || correct.length > 90) continue
      if (FRAGMENT_RE.test(stem) || FRAGMENT_RE.test(correct)) continue
      const dedupe = foldText(stem)
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      const rubric = rubricFrom(correct, [stem], 3)
      if (rubric.length === 0) continue
      const tr = quizI18n[it.id]
      const item: OralItem = {
        id: `g${grade}-oral-q-${it.id.replace(/^g\d+-/, '')}`,
        kind: 'oral',
        questionSpeak: oralFromStem(stem, 'ru'),
        rubric,
        sampleAnswer: `${stem.replace(/…$/u, '').trim()} ${correct}`.trim(),
        chapterNum: Number(m[1]),
        sectionId: m[2],
        source: 'quiz',
      }
      const correctEn = tr?.choicesEn?.[it.correctIndex]
      const correctUz = tr?.choicesUz?.[it.correctIndex]
      if (tr?.questionEn && correctEn) {
        const stemEn = stripParagraphPrefix(tr.questionEn)
        const rubricEn = rubricFrom(correctEn, [stemEn], 3)
        if (rubricEn.length > 0) {
          item.questionSpeakEn = oralFromStem(stemEn, 'en')
          item.rubricEn = rubricEn
          item.sampleAnswerEn = `${stemEn.replace(/\.\.\.$|…$/u, '').trim()} ${correctEn}`.trim()
        }
      }
      if (tr?.questionUz && correctUz) {
        const stemUz = stripParagraphPrefix(tr.questionUz)
        const rubricUz = rubricFrom(correctUz, [stemUz], 3)
        if (rubricUz.length > 0) {
          item.questionSpeakUz = oralFromStem(stemUz, 'uz')
          item.rubricUz = rubricUz
          item.sampleAnswerUz = `${stemUz.replace(/\.\.\.$|…$/u, '').trim()} ${correctUz}`.trim()
        }
      }
      out.push(item)
    }
  }
  return out
}

/* ------------------------------------------------- 2) textbook definitions */

type KbChunk = { id: string; grade: number | null; chapterId?: string; sectionId?: string; type: string; text: string }

const BAD_START_RE =
  /^(это|эта|этот|эти|такие|такой|такая|такое|он|она|оно|они|здесь|там|если|например|кроме|сначала|после|поэтому|также|при этом|в результате|все|всё|как|когда|затем|тогда)\s/i

function defsFromSentence(sentence: string): Array<{ term: string; definition: string; ask: string }> {
  const s = tidy(sentence).replace(/[:;]$/, '.')
  if (s.length < 30 || s.length > 260 || /\?/.test(s) || !/[.!]$/.test(s)) return []
  if (BAD_START_RE.test(s) || !/^[А-ЯЁA-Z]/.test(s) || !looksClean(s) || FRAGMENT_RE.test(s)) return []
  const out: Array<{ term: string; definition: string; ask: string }> = []
  const named = s.match(/^(.{18,200}?),?\s+называ(?:ется|ются|ют)\s+([а-яё«»\- ]{4,48}?)(?:\s*\([^)]*\))?[.!]$/iu)
  if (named) {
    const definition = named[1]!.replace(/,\s*$/, '').trim()
    const term = named[2]!
      .replace(/[«»]/g, '')
      .replace(/^[-–—\s]+/, '')
      .replace(/^(его|её|ее|их|эти|этот|эта|это|также)\s+/i, '')
      .trim()
    const words = term.split(/\s+/)
    const allAdjectives = words.every((w) => /(ым|им|ыми|ими|ой|ей|ого|его|ую|юю)$/i.test(w))
    if (!allAdjectives && words.length <= 4 && definition.split(/\s+/).length >= 4) {
      out.push({ term, definition, ask: `Что называют ${term}?` })
    }
  }
  const dash = s.match(/^([А-ЯЁ][а-яё\- ]{2,40})\s+—\s+(?:это\s+)?(.{16,220})[.!]$/u)
  if (dash) {
    const term = dash[1]!.trim()
    const definition = dash[2]!.trim()
    if (term.split(/\s+/).length <= 4) out.push({ term, definition, ask: `Что такое ${term.toLowerCase()}?` })
  }
  return out
}

function fromTextbookDefinitions(grade: number): OralItem[] {
  const data = readJson<KbChunk[] | { chunks: KbChunk[] }>(`src/data/kb/corpus/kb-corpus-g${grade}.json`)
  const chunks = Array.isArray(data) ? data : (data?.chunks ?? [])
  const out: OralItem[] = []
  const seen = new Set<string>()
  let n = 0
  for (const chunk of chunks) {
    if (chunk.type !== 'definition' || !chunk.chapterId) continue
    const chapterNum = Number(chunk.chapterId.replace(/^c/, ''))
    if (!chapterNum) continue
    for (const sentence of chunk.text.split(/\n+|\s\|\s/)) {
      for (const d of defsFromSentence(sentence)) {
        const key = foldText(d.term)
        if (seen.has(key)) continue
        const rubric = rubricFrom(d.definition, [d.term], 3, false)
        if (rubric.length < 2) continue
        seen.add(key)
        n++
        const item: OralItem = {
          id: `g${grade}-oral-def-${chunk.chapterId}-${String(n).padStart(3, '0')}`,
          kind: 'oral',
          questionSpeak: d.ask,
          rubric,
          sampleAnswer: `${capitalize(d.term)} — ${d.definition.replace(/[.!]$/, '')}.`,
          chapterNum,
          sectionId: chunk.sectionId,
          source: 'textbook',
        }
        const termBase = d.ask.replace(/^Что (называют|такое)\s+/, '').replace(/\?$/, '')
        for (const lang of ['en', 'uz'] as const) {
          const term = translateTerm(termBase, lang)
          const rub = translateRubric(rubric, d.definition, lang)
          if (!term || rub.length < 2) continue
          if (lang === 'en') {
            item.questionSpeakEn = `What is meant by “${term}”?`
            item.rubricEn = rub
          } else {
            item.questionSpeakUz = `«${term}» deb nimaga aytiladi?`
            item.rubricUz = rub
          }
        }
        out.push(item)
      }
    }
  }
  return out
}

/* ----------------------------------------------------------- 3) topic facts */

type TopicsFile = {
  topics: Array<{ chapter: number; subtopics: Array<{ kp: number; title: string; facts: string[] }> }>
}

function fromTopicFacts(grade: number): OralItem[] {
  const data = readJson<TopicsFile>(`scripts/grade7-teacher-dataset/topics/grade${grade}.json`)
  if (!data) return []
  const out: OralItem[] = []
  const seen = new Set<string>()
  for (const topic of data.topics) {
    for (const sub of topic.subtopics) {
      for (const fact of sub.facts) {
        if (/^Тема школьной программы/.test(fact)) continue
        const m = fact.match(/^([А-ЯЁ][а-яё\- ]{2,30})\s+—\s+(.{8,120})\.$/u)
        if (!m) continue
        const term = m[1]!.trim()
        const key = foldText(term)
        if (seen.has(key)) continue
        const rubric = rubricFrom(m[2]!, [term], 3)
        if (rubric.length < 1) continue
        seen.add(key)
        out.push({
          id: `g${grade}-oral-fact-c${topic.chapter}-${String(out.length + 1).padStart(2, '0')}`,
          kind: 'oral',
          questionSpeak: `Что такое ${term.toLowerCase()}?`,
          rubric,
          sampleAnswer: fact,
          chapterNum: topic.chapter,
          source: 'topics',
        })
      }
    }
  }
  return out
}

/* -------------------------------------------------------------------- main */

function balance(items: OralItem[]): OralItem[] {
  const byChapter = new Map<number, OralItem[]>()
  for (const it of items) {
    const list = byChapter.get(it.chapterNum ?? 0) ?? []
    list.push(it)
    byChapter.set(it.chapterNum ?? 0, list)
  }
  const out: OralItem[] = []
  for (const [, list] of [...byChapter.entries()].sort((a, b) => a[0] - b[0])) {
    // Сначала с переводами и из учебника — они лучше; затем остальные.
    const ranked = [...list].sort(
      (a, b) =>
        Number(Boolean(b.questionSpeakEn)) - Number(Boolean(a.questionSpeakEn)) ||
        Number(b.source === 'textbook') - Number(a.source === 'textbook'),
    )
    out.push(...ranked.slice(0, MAX_PER_CHAPTER))
  }
  return out
}

fs.mkdirSync(OUT_DIR, { recursive: true })
const summary: Record<string, unknown> = {}
for (const grade of [8, 9, 10, 11]) {
  const quiz = grade === 8 || grade === 9 ? fromQuizBank(grade) : []
  const defs = fromTextbookDefinitions(grade)
  const facts = fromTopicFacts(grade)
  const seenQ = new Set<string>()
  const merged = [...quiz, ...defs, ...facts].filter((it) => {
    const k = foldText(it.questionSpeak)
    if (seenQ.has(k)) return false
    seenQ.add(k)
    return true
  })
  const items = balance(merged)
  const chapters = [...new Set(items.map((i) => i.chapterNum))].sort((a, b) => (a ?? 0) - (b ?? 0))
  const file = path.join(OUT_DIR, `oral-g${grade}.json`)
  fs.writeFileSync(file, `${JSON.stringify({ grade, generatedBy: 'scripts/build-teacher-exam-pools.mts', items }, null, 1)}\n`)
  summary[`g${grade}`] = {
    total: items.length,
    quiz: items.filter((i) => i.source === 'quiz').length,
    textbook: items.filter((i) => i.source === 'textbook').length,
    topics: items.filter((i) => i.source === 'topics').length,
    en: items.filter((i) => i.questionSpeakEn).length,
    uz: items.filter((i) => i.questionSpeakUz).length,
    chapters,
  }
}
console.log(JSON.stringify(summary, null, 2))
