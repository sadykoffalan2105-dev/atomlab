/**
 * npm run brain:curriculum-map — карта школьной программы Kimyo 7–11 → src/data/kb/curriculum/kimyo-map.json.
 *
 * Детерминированно (повторный запуск при тех же входах — тот же файл, включая generatedAt), без сети и без LLM.
 * Скелет — 247 печатных единиц из src/data/textbook/equations-g{7..11}.json (глава, номер как напечатан, страницы,
 * секции приложения, все 1448 уравнений); к каждой единице — понятия, определения, законы, формулы, вещества,
 * разобранные примеры и упражнения (майнинг текста kb-corpus-g*.json), типы задач (task-types.json), тесты
 * (g7/g8/g9 SectionQuizBank + sectionQuizI18n), названия ru/uz/en (gradesOutline*), тема и связи с другими классами.
 * Подробно — docs/plans/curriculum-map.md; типы — brain/curriculum/types.ts.
 *
 *   --check   — только собрать и сравнить с файлом на диске (код 1, если отличается)
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { analyzeTerms } from '../../src/learn/kb/analyzer.ts'
import { learnGradesOutlineEn } from '../../src/i18n/learn/gradesOutlineEn.ts'
import { learnGradesOutlineRu } from '../../src/i18n/learn/gradesOutlineRu.ts'
import { learnGradesOutlineUz } from '../../src/i18n/learn/gradesOutlineUz.ts'
import { CONCEPTS } from '../../brain/kb/concepts.ts'
import { classifyTopic } from '../../brain/kb/topicMap.ts'
import { UZ_GLOSSARY } from '../../brain/persona/uzGlossary.ts'
import type { Chapter, CurriculumMapFile, GradeKey, TaskType, TaskTypeId, Tri, Unit, UnitExample, UnitKind, UnitTest } from '../../brain/curriculum/types.ts'
import { asciiFormula, loadInventory } from '../kb/lib/textbookInventory.mts'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const OUT_DIR = path.join(ROOT, 'src', 'data', 'kb', 'curriculum')
const OUT = path.join(OUT_DIR, 'kimyo-map.json')
const GRADES = [7, 8, 9, 10, 11] as const
const t0 = performance.now()

const rel = (p: string) => path.join(ROOT, p)
const readJson = <T,>(p: string): T => JSON.parse(fs.readFileSync(rel(p), 'utf8')) as T
const sha = (p: string) => crypto.createHash('sha1').update(fs.readFileSync(rel(p))).digest('hex').slice(0, 12)
const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/u, '') + '…')
const squash = (s: string) => s.replace(/\s+/g, ' ').trim()
const letterShare = (s: string) => {
  const ns = s.replace(/\s+/g, '')
  return ns.length ? (ns.match(/\p{L}/gu) ?? []).length / ns.length : 0
}
const CYR = /[А-Яа-яЁё]/u
/** битый OCR («Р åзульòàòы») */
const MOJIBAKE = /[À-ÿ]{2}|[åòàîâûñ][а-я]?[åòàîâûñ]/u

// ——— входы
type Chunk = { id: string; grade: number; chapterId?: string; sectionId?: string; kp?: string; title: string; pageStart?: number; pageEnd?: number; type: string; text: string }
type EqUnit = {
  unitId: string
  chapterId: string
  chapterTitle: string
  kp: string
  title: string
  pageStart: number
  pageEnd: number
  appSections: string[]
  reactions: { id: string; page?: number; equation: string; equationAscii: string; conditions?: string; type: string; isIonic?: boolean; isGeneralScheme?: boolean; bankId?: string | null; lab?: { ok?: boolean; href?: string } }[]
}
type QaDef = { term: string; def: string; g: number; kp?: string; pg?: number }
type QaSub = { f: string; fa: string; ru: string; uz: string }
type QuizQ = { id: string; question: string; choices: string[]; correctIndex: number; explanation?: string }
type QuizI18n = { questionEn?: string; questionUz?: string; choicesEn?: string[]; choicesUz?: string[]; explanationEn?: string; explanationUz?: string }
type G7Know = { sections: { id: string; conceptsRu?: string[]; definitionsRu?: string[] }[] }

const INPUTS = [
  'src/data/kb/corpus/kb-sections.json',
  ...GRADES.map((g) => `src/data/kb/corpus/kb-corpus-g${g}.json`),
  ...GRADES.map((g) => `src/data/textbook/equations-g${g}.json`),
  ...GRADES.map((g) => `src/data/textbook/inventory-g${g}.json`),
  'src/data/teacher/qaBank.json',
  'src/data/g7TextbookKnowledge.json',
  'src/data/g7SectionQuizBank.json',
  'src/data/g8SectionQuizBank.json',
  'src/data/g9SectionQuizBank.json',
  'src/data/sectionQuizI18n.json',
  'src/data/kb/corpus/kb-glossary.json',
  'src/i18n/learn/gradesOutlineRu.ts',
  'src/i18n/learn/gradesOutlineUz.ts',
  'src/i18n/learn/gradesOutlineEn.ts',
  'src/data/kb/curriculum/task-types.json',
]

const sections = readJson<Record<string, unknown>>('src/data/kb/corpus/kb-sections.json')
const qa = readJson<{ definitions: QaDef[]; substances: QaSub[] }>('src/data/teacher/qaBank.json')
const g7Know = readJson<G7Know>('src/data/g7TextbookKnowledge.json')
const quizI18n = readJson<Record<string, QuizI18n>>('src/data/sectionQuizI18n.json')
const quizBanks: Record<number, Record<string, QuizQ[]>> = {}
for (const g of [7, 8, 9]) quizBanks[g] = readJson<{ sections: Record<string, QuizQ[]> }>(`src/data/g${g}SectionQuizBank.json`).sections
const glossary = readJson<{ entries: { ru: string; uz: string[]; en: string[] }[] }>('src/data/kb/corpus/kb-glossary.json').entries
const taskTypes = readJson<{ taskTypes: TaskType[] }>('src/data/kb/curriculum/task-types.json').taskTypes
const outline: Record<'ru' | 'uz' | 'en', Record<string, string>> = { ru: learnGradesOutlineRu, uz: learnGradesOutlineUz, en: learnGradesOutlineEn }

// ——— словарь ru → uz/en (глоссарий базы, глоссарий персоны, понятия мозга): ключ — стемы фразы
const dict = new Map<string, { uz?: string; en?: string }>()
const dkey = (s: string) => analyzeTerms(s).join(' ')
function addDict(ru: string, uz?: string, en?: string): void {
  const k = dkey(ru)
  if (!k) return
  const prev = dict.get(k) ?? {}
  dict.set(k, { uz: prev.uz ?? (uz && !CYR.test(uz) ? uz : undefined), en: prev.en ?? (en && !CYR.test(en) ? en : undefined) })
}
for (const p of UZ_GLOSSARY) addDict(p.ru, p.uz, p.en)
for (const c of CONCEPTS) for (const ru of c.names.ru) addDict(ru, c.names.uz[0], c.names.en[0])
for (const e of glossary) addDict(e.ru, e.uz[0], e.en[0])

/** Перевод фразы по словарю: целиком или по частям («X и Y», «X, Y»); null — если хоть одна часть не переведена. */
function translate(ru: string, lang: 'uz' | 'en'): string | null {
  const whole = dict.get(dkey(ru))?.[lang]
  if (whole) return whole
  const parts = ru.split(/\s*[.;:,]\s+|\s+и\s+|\s*[«»()]\s*/u).map((s) => s.trim()).filter((s) => analyzeTerms(s).length)
  if (parts.length < 2) return null
  const out: string[] = []
  for (const p of parts) {
    const t = dict.get(dkey(p))?.[lang]
    if (!t) return null
    out.push(t)
  }
  return out.join(lang === 'uz' ? ', ' : ', ')
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// ——— подписи
const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 }
function labelOf(g: number, kp: string): Tri {
  if (kp === 'lab') return { ru: `Kimyo ${g}, практические работы`, uz: `Kimyo ${g}, amaliy ishlar`, en: `Kimyo ${g}, practical works` }
  const m = kp.match(/^(\d+)\.(\d+)$/)
  if (m) return { ru: `Kimyo ${g}, гл. ${m[1]}, тема ${m[2]}`, uz: `Kimyo ${g}, ${m[1]}-bob, ${m[2]}-mavzu`, en: `Kimyo ${g}, ch. ${m[1]}, topic ${m[2]}` }
  return { ru: `Kimyo ${g}, §${kp}`, uz: `Kimyo ${g}, ${kp}-§`, en: `Kimyo ${g}, §${kp}` }
}
function kindOf(kp: string, title: string): UnitKind {
  if (kp === 'lab') return 'lab'
  if (/^Практическ/iu.test(title)) return 'practical'
  if (/^(Урок закрепления|Повторение|Обобщение)/iu.test(title)) return 'review'
  if (/^(Решение задач|Задачи)/iu.test(title)) return 'tasks'
  return 'paragraph'
}
const stripNum = (s: string) => s.replace(/^§\s*[\d.]+\.?\s*/u, '').replace(/^(Глава|Ch\.|Chapter)\s+[IVX\d]+\.\s*/u, '').replace(/^[IVX\d]+ bob\.\s*/u, '').trim()

/** 8 кл.: в оглавлении приложения названия несут печатный номер «§15. …» — ищем по нему (глава — как у секции приложения). */
function g8KeyByPrintedNum(kp: string, appSections: string[]): string | null {
  const ch = appSections[0]?.split('-')[0]
  const keys = Object.keys(outline.uz).filter((k) => /^learn\.g8\.c\d+\.s\d+\.title$/.test(k) && outline.uz[k]!.startsWith(`§${kp}.`))
  return keys.find((k) => k.startsWith(`learn.g8.${ch}.`)) ?? keys[0] ?? null
}

function titleTri(g: number, kp: string, ruTitle: string, appSections: string[]): Unit['title'] {
  const key = g === 8 ? g8KeyByPrintedNum(kp, appSections) : appSections[0] ? `learn.g${g}.${appSections[0].replace('-', '.')}.title` : null
  // 7, 10, 11 кл.: секция приложения = печатная единица; 8–9 кл.: название первой секции приложения этого §
  const uzI = key ? outline.uz[key] : undefined
  const enI = key ? outline.en[key] : undefined
  let uz: string | null = uzI && !CYR.test(uzI) ? stripNum(uzI) : null
  let uzSource: Unit['title']['uzSource'] = 'i18n'
  if (!uz) {
    uz = translate(ruTitle, 'uz')
    uzSource = uz ? 'auto' : 'ru'
  }
  const en = (enI && !CYR.test(enI) ? stripNum(enI) : null) ?? translate(ruTitle, 'en') ?? ruTitle
  return { ru: ruTitle, uz: uz ? cap(uz) : ruTitle, en: cap(en), uzSource }
}

// ——— майнинг текста
const VERBISH = /(ает|яет|ует|ит|ят|ется|ются|ался|алась|ают|яют|уют)$/u
function conceptList(raw: string): string[] {
  return raw
    .split(/[•;]|,\s+(?=[а-яё])/u)
    .map((s) => s.replace(/^[\s\-–—:]+|[\s.;:]+$/gu, '').trim())
    .filter((s) => s.length >= 3 && s.length <= 70 && /\p{L}{3}/u.test(s) && s.split(/\s+/).length <= 6 && !s.split(/\s+/).some((w) => VERBISH.test(w.toLowerCase())) && !MOJIBAKE.test(s))
}
function minedConcepts(texts: string[]): string[] {
  const out: string[] = []
  for (const t of texts) {
    for (const m of t.matchAll(/(Изучаемые понятия|Основные понятия|Элементы ЗУН)\s*:?\s*([^\n]{3,600})/gu)) {
      // до первого «настоящего» предложения после списка
      const list = m[2]!.split(/(?<=[.!?])\s+(?=[А-ЯЁ][а-яё]+\s+[а-яё]+\s+[а-яё]+)/u)[0]!
      out.push(...conceptList(list))
    }
  }
  return out
}

type Example = UnitExample
function minedExamples(text: string, pageAt: (i: number) => number | undefined): Example[] {
  const out: Example[] = []
  // «Пример 2.», «Задача-2.», «Задача 1:», «Задача №3» — с начала строки или после точки
  const heads = [...text.matchAll(/(?:^|\n|\.\s)\s*(Пример|Задача)(?=[\s\-–№\d.:])[\s\-–№]*(\d{0,2})\s*[.:)]?\s*/gu)]
  const seen = new Set<string>()
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i]!
    const start = h.index! + h[0].length
    const end = Math.min(heads[i + 1]?.index ?? text.length, start + 2500)
    const block = text.slice(start, end)
    // \b в JS не видит границ кириллических слов — только явный «не буква» после слова
    const sIdx = block.search(/(^|\n|[.:]\s)\s*(Решение|Дано)(?!\p{L})/u)
    const hasAnswer = /Ответ(?!\p{L})/u.test(block)
    if (sIdx < 0 && !hasAnswer) continue
    // без «Решение/Дано» условие — первая строка блока
    const statement = squash(sIdx >= 0 ? block.slice(0, sIdx) : block.split('\n')[0]!)
    if (statement.length < 15 || letterShare(statement) < 0.6 || MOJIBAKE.test(statement) || seen.has(statement)) continue
    seen.add(statement)
    const am = block.slice(Math.max(0, sIdx)).match(/Ответ(?!\p{L})\s*[.:]?\s*([^\n]{1,300})/u)
    let answer: string | undefined
    if (am) {
      answer = squash(am[1]!.split(/(?<=[^\d\s][.!])\s/u)[0]!).replace(/\.$/, '')
      if (!/\d/.test(answer) && !/[A-Z][a-z]?\d|[A-Z][a-z]?[₀-₉]/u.test(answer)) continue
    }
    out.push({ statement: clip(statement, 600), ...(answer ? { answer: clip(answer, 200) } : {}), ...(pageAt(h.index!) ? { page: pageAt(h.index!) } : {}), source: 'example' })
  }
  return out
}
function minedExercises(text: string): { n: number; text: string }[] {
  const out: { n: number; text: string }[] = []
  const re = /(Вопросы и задания|Задачи[^\n]{0,40}для самостоятельного решения|Упражнения|Задания)\s*[.:]?\s*\n([\s\S]{0,4000})/gu
  for (const m of text.matchAll(re)) {
    for (const line of m[2]!.split('\n')) {
      const x = line.match(/^\s*(\d{1,2})\s*[.)]\s*(.{10,})$/u)
      if (!x) {
        if (out.length && /^\s*[А-ЯЁA-Z]/u.test(line) && !/^\s*\d/.test(line) && line.length > 60) break
        continue
      }
      const t = squash(x[2]!)
      if (letterShare(t) < 0.6 || MOJIBAKE.test(t)) continue
      if (out.some((o) => o.text === t)) continue
      out.push({ n: Number(x[1]), text: clip(t, 400) })
      if (out.length >= 15) return out
    }
  }
  return out
}
function minedLaws(text: string): Unit['laws'] {
  const out: Unit['laws'] = []
  const seen = new Set<string>()
  for (const s of text.split(/(?<=[.!?])\s+/u)) {
    const m = s.match(/(закон[а-яё]*\s+(?:[А-ЯЁ][а-яё\-]+|сохранения [а-яё]+(?: [а-яё]+)?|постоянства [а-яё]+|кратных [а-яё]+|объ[её]мных [а-яё]+|эквивалентов|действующих масс)|правил[оа]\s+[А-ЯЁ][а-яё\-]+|принцип[а-яё]*\s+[А-ЯЁ][а-яё\-]+(?:\s*[–-]\s*[А-ЯЁ][а-яё]+)?|теори[яи]\s+(?:электролитической диссоциации|строения [а-яё]+(?: [а-яё]+)?|[А-ЯЁ][а-яё]+))/u)
    if (!m) continue
    const name = m[1]!.replace(/^закон[а-яё]*/u, 'закон').replace(/^правил[оа]/u, 'правило').replace(/^принцип[а-яё]*/u, 'принцип').replace(/^теори[яи]/u, 'теория')
    const k = name.toLowerCase()
    if (seen.has(k) || s.length < 30 || s.length > 420 || letterShare(s) < 0.6 || MOJIBAKE.test(s)) continue
    seen.add(k)
    const tr = translate(name, 'uz')
    const en = translate(name, 'en')
    out.push({ name: { ru: name, ...(tr ? { uz: tr } : {}), ...(en ? { en } : {}) }, statement: { ru: clip(squash(s), 300) } })
    if (out.length >= 4) break
  }
  return out
}
function minedFormulas(text: string): string[] {
  const out: string[] = []
  const re = /(?<![\p{L}\d])((?:Mr|Ar|Vm|NA|Mэ|Cм|Cн|M|m|n|V|N|D|Q|ω|η|ρ|C|α|v|E|I|t|p|K)(?:\s?\([^()\n]{1,25}\))?\s*=\s*[^\n;=]{2,60}?)(?=\s*[;\n]|\.\s|,\s|\s{2}|$)/gu
  for (const m of text.matchAll(re)) {
    const f = squash(m[1]!).replace(/\s*\*\s*/g, ' · ').replace(/\s*[⋅×]\s*/g, ' · ')
    const right = f.split('=').slice(1).join('=')
    // формула, а не подстановка чисел: справа есть переменная и знак деления/умножения
    if (!/[/·]/.test(right) || !/[A-Za-zωηρα]/u.test(right) || /\d[,.]\d|\d{2,}/.test(right) || f.length > 70 || /[а-яё]{4}/u.test(right)) continue
    if (!out.includes(f)) out.push(f)
    if (out.length >= 12) break
  }
  return out
}
function definitionsOf(chunks: Chunk[], unitTitle: string): Unit['definitions'] {
  const out: Unit['definitions'] = []
  for (const c of chunks) {
    if (c.type !== 'definition') continue
    const tail = c.title.startsWith(unitTitle + ': ') ? c.title.slice(unitTitle.length + 2) : c.title.replace(/^.*?:\s/u, '')
    const terms = tail.split(/,\s*/).map((s) => s.trim()).filter(Boolean)
    const lines = c.text.split('\n').map((s) => squash(s)).filter((s) => s.length >= 15)
    lines.forEach((line, i) => {
      if (letterShare(line) < 0.6 || MOJIBAKE.test(line)) return
      const ls = new Set(analyzeTerms(line))
      const byStem = terms.find((t) => { const ts = analyzeTerms(t); return ts.length > 0 && ts.every((x) => ls.has(x)) })
      const byDash = line.match(/^(.{2,60}?)\s[—–-]\s(это\s)?/u)?.[1]
      const term = byStem ?? (terms.length === lines.length ? terms[i] : undefined) ?? byDash
      if (!term) return
      out.push({ term: { ru: cap(term) }, text: { ru: clip(line, 420) }, ...(c.pageStart ? { page: c.pageStart } : {}), chunkId: c.id, source: 'textbook' })
    })
  }
  return out
}

// ——— типы задач
const TYPE_PRIORITY: TaskTypeId[] = [
  'combustion_formula', 'formula_from_fractions', 'metal_plate', 'mixture_fraction', 'excess_limiting', 'yield', 'impurities', 'crystal_hydrate',
  'solubility', 'normality', 'molarity', 'solution_density_volume', 'solution_mass_fraction', 'electrolysis_faraday', 'equivalent', 'water_hardness',
  'thermochem', 'reaction_rate', 'equilibrium', 'clapeyron', 'gas_mixture', 'gas_density', 'air_volume', 'dissociation_degree', 'ph',
  'redox_balance', 'oxidation_state', 'atomic_structure_counts', 'mass_fraction_element', 'equation_stoich', 'moles_mass_volume_particles', 'molar_mass',
]
const typeRe = new Map<TaskTypeId, RegExp[]>()
for (const t of taskTypes) typeRe.set(t.id, [...t.markers.ru, ...t.markers.uz, ...t.markers.en].map((s) => new RegExp(s, 'iu')))
function guessType(text: string): TaskTypeId | undefined {
  if (!/\d/.test(text)) return undefined
  for (const id of TYPE_PRIORITY) if (typeRe.get(id)?.some((re) => re.test(text))) return id
  return undefined
}

// ——— тесты
function testsOf(g: number, appSections: string[]): UnitTest[] {
  const bank = quizBanks[g]
  if (!bank) return []
  const all: QuizQ[] = []
  for (const s of appSections) all.push(...(bank[`g${g}-${s}`] ?? []))
  const good = all.filter((q) => !/^Параграф «/u.test(q.question) && !MOJIBAKE.test(q.question + q.choices.join(' ')) && q.choices?.length >= 2 && q.correctIndex >= 0 && q.correctIndex < q.choices.length)
  good.sort((a, b) => Number(/-tpl|-fill/.test(a.id)) - Number(/-tpl|-fill/.test(b.id)))
  return good.slice(0, 10).map((q) => {
    const i = quizI18n[q.id]
    const uzOk = i?.questionUz && i.choicesUz?.length === q.choices.length
    const enOk = i?.questionEn && i.choicesEn?.length === q.choices.length
    return {
      q: { ru: q.question, ...(uzOk ? { uz: i!.questionUz! } : {}), ...(enOk ? { en: i!.questionEn! } : {}) },
      choices: { ru: q.choices, ...(uzOk ? { uz: i!.choicesUz! } : {}), ...(enOk ? { en: i!.choicesEn! } : {}) },
      correct: q.correctIndex,
      a: { ru: q.choices[q.correctIndex]!, ...(uzOk ? { uz: i!.choicesUz![q.correctIndex]! } : {}), ...(enOk ? { en: i!.choicesEn![q.correctIndex]! } : {}) },
      ...(q.explanation ? { explanation: { ru: clip(q.explanation, 300) } } : {}),
    }
  })
}

// ——— сборка
const qaSubByAscii = new Map<string, QaSub>()
for (const s of qa.substances) if (!qaSubByAscii.has(s.fa)) qaSubByAscii.set(s.fa, s)
const introduced = new Map<string, Set<TaskTypeId>>()
for (const t of taskTypes) for (const u of t.introducedIn) (introduced.get(u) ?? introduced.set(u, new Set()).get(u)!).add(t.id)

const grades = {} as CurriculumMapFile['grades']
const allUnits: Unit[] = []
const conceptKeys = new Map<string, Set<string>>()
const report = { titleUz: { i18n: 0, auto: 0, ru: 0 }, withExamples: 0 }

for (const g of GRADES) {
  const gk = `g${g}` as GradeKey
  const eq = readJson<{ units: EqUnit[] }>(`src/data/textbook/equations-g${g}.json`).units
  const chunks = readJson<{ chunks: Chunk[] }>(`src/data/kb/corpus/kb-corpus-g${g}.json`).chunks
  const byKp = new Map<string, Chunk[]>()
  for (const c of chunks) if (c.kp) (byKp.get(c.kp) ?? byKp.set(c.kp, []).get(c.kp)!).push(c)
  const inv = new Map(loadInventory(g).map((s) => [s.kp, s]))
  const secList = (Array.isArray(sections[gk]) ? sections[gk] : (sections[gk] as { book: unknown[] }).book) as { kp: string; firstText?: string }[]
  const firstText = new Map(secList.map((s) => [String(s.kp), s.firstText ?? '']))
  const chapters: Chapter[] = []
  const units: Unit[] = []
  for (const e of eq) {
    const kp = String(e.kp)
    const id = `${g}`.length ? `g${g}:${kp}` : kp
    const cs = (byKp.get(kp) ?? []).slice().sort((a, b) => (a.pageStart ?? 0) - (b.pageStart ?? 0) || (a.id < b.id ? -1 : 1))
    const tb = cs.filter((c) => c.type === 'textbook')
    let text = ''
    const offs: [number, number | undefined][] = []
    for (const c of tb) {
      offs.push([text.length, c.pageStart])
      text += c.text + '\n'
    }
    const pageAt = (i: number) => {
      let p: number | undefined
      for (const [o, pg] of offs) if (o <= i) p = pg
      return p
    }
    // глава
    const chNum = e.chapterId === 'lab' ? 0 : (ROMAN[e.chapterTitle.match(/Глава\s+([IVX]+)/u)?.[1] ?? ''] ?? (Number(e.chapterId.replace(/\D/g, '')) || 0))
    const chId = e.chapterId === 'lab' ? 'lab' : `c${chNum}`
    let ch = chapters.find((c) => c.id === chId)
    if (!ch) {
      const ruT = stripNum(e.chapterTitle)
      const k = `learn.g${g}.${chId}.title`
      // у 8–9 кл. главы приложения не совпадают с главами книги — только у 7, 10, 11 берём готовые названия
      const sameToc = g === 7 || g === 10 || g === 11
      const uzI = sameToc ? outline.uz[k] : undefined
      const enI = sameToc ? outline.en[k] : undefined
      ch = {
        id: chId,
        num: chNum,
        title: {
          ru: ruT,
          uz: (uzI && !CYR.test(uzI) ? stripNum(uzI) : translate(ruT, 'uz')) ?? ruT,
          en: (enI && !CYR.test(enI) ? stripNum(enI) : translate(ruT, 'en')) ?? ruT,
        },
        units: [],
      }
      chapters.push(ch)
    }
    ch.units.push(id)

    const title = titleTri(g, kp, e.title, e.appSections ?? [])
    report.titleUz[title.uzSource]++
    // понятия
    const sumTexts = cs.filter((c) => c.type === 'summary' || c.type === 'textbook').map((c) => c.text)
    let conceptRu: string[] = []
    if (g === 7) conceptRu.push(...(g7Know.sections.find((s) => s.id === `g7-${e.appSections?.[0] ?? ''}`)?.conceptsRu ?? []))
    const ft = firstText.get(kp) ?? ''
    if (/^\s*•/u.test(ft)) conceptRu.push(...conceptList(ft))
    conceptRu.push(...minedConcepts(sumTexts))
    const definitions = definitionsOf(cs, e.title)
    for (const d of qa.definitions) {
      if (d.g !== g || String(d.kp) !== kp) continue
      const k = dkey(d.term)
      if (definitions.some((x) => dkey(x.term.ru) === k)) continue
      definitions.push({ term: { ru: cap(d.term) }, text: { ru: clip(squash(`${cap(d.term)} — ${d.def}`), 420) }, ...(d.pg ? { page: d.pg } : {}), source: 'qaBank' })
    }
    // нет блоков определений — определения 7 кл. из g7TextbookKnowledge и предложения «X — это …» из текста единицы
    if (!definitions.length) {
      const g7d = g === 7 ? (g7Know.sections.find((s) => s.id === `g7-${e.appSections?.[0] ?? ''}`)?.definitionsRu ?? []) : []
      const sents = [...g7d, ...text.split(/(?<=[.!?])\s+|\n/u)]
      for (const s0 of sents) {
        const s = squash(s0)
        const m = s.match(/^([А-ЯЁ][\p{L}\- ]{2,50}?)\s+[—–]\s+(?:это\s+)?\p{Ll}/u)
        if (!m || s.length < 25 || s.length > 420 || letterShare(s) < 0.6 || MOJIBAKE.test(s) || m[1]!.split(/\s+/).length > 5) continue
        if (definitions.some((d) => dkey(d.term.ru) === dkey(m[1]!))) continue
        definitions.push({ term: { ru: cap(m[1]!.trim()) }, text: { ru: s }, source: 'textbook' })
        if (definitions.length >= 3) break
      }
    }
    for (const d of definitions) {
      const uz = translate(d.term.ru, 'uz')
      const en = translate(d.term.ru, 'en')
      if (uz) d.term.uz = cap(uz)
      if (en) d.term.en = cap(en)
    }
    if (conceptRu.length < 3) conceptRu.push(...definitions.map((d) => d.term.ru))
    if (!conceptRu.length) conceptRu.push(...e.title.split(/\s*[.;:]\s+|\s*,\s+/u).filter((s) => analyzeTerms(s).length))
    const seenC = new Set<string>()
    const concepts: Unit['concepts'] = []
    for (const c of conceptRu) {
      const k = dkey(c)
      if (!k || seenC.has(k)) continue
      seenC.add(k)
      const uz = translate(c, 'uz')
      const en = translate(c, 'en')
      concepts.push({ ru: c, ...(uz ? { uz } : {}), ...(en ? { en } : {}), slug: k.replace(/\s+/g, '-') })
      if (concepts.length >= 12) break
    }
    // реакции
    const reactions: Unit['reactions'] = (e.reactions ?? []).map((r) => ({
      eq: r.equation,
      ascii: r.equationAscii,
      type: r.type,
      ...(r.conditions ? { conditions: clip(r.conditions, 160) } : {}),
      ...(r.page ? { page: r.page } : {}),
      ...(r.bankId ? { bankId: r.bankId } : {}),
      ...(r.lab?.ok && r.lab.href ? { labHref: r.lab.href } : {}),
      ...(r.isGeneralScheme ? { isGeneral: true } : {}),
      ...(r.isIonic ? { isIonic: true } : {}),
    }))
    // вещества (инвентарь книги)
    const subs: Unit['substances'] = []
    const sec = inv.get(kp)
    const seenS = new Set<string>()
    for (const s of [...(sec?.substances ?? [])].sort((a, b) => Number(b.role === 'studied') - Number(a.role === 'studied'))) {
      const f = s.formulaUnicode ?? s.formula ?? ''
      const k = (s.formula ?? s.name).toLowerCase()
      if (!f && !s.name) continue
      if (seenS.has(k)) continue
      seenS.add(k)
      const q = s.formula ? qaSubByAscii.get(asciiFormula(s.formula)) : undefined
      subs.push({ formula: f, nameRu: s.name || q?.ru || f, ...(q?.uz ? { nameUz: q.uz } : {}), role: s.role, kind: s.kind, ...(s.catalogId ? { catalogId: s.catalogId } : {}) })
      if (subs.length >= 30) break
    }
    // задачи
    const examples = minedExamples(text, pageAt)
    for (const x of examples) {
      const t = guessType(`${x.statement} ${x.answer ?? ''}`)
      if (t) x.typeGuess = t
    }
    const exercises: Unit['tasks']['exercises'] = minedExercises(text).map((x) => {
      const t = guessType(x.text)
      return t ? { ...x, typeGuess: t } : x
    })
    const types = new Set<TaskTypeId>(introduced.get(`g${g}:${kp}`) ?? [])
    for (const x of [...examples, ...exercises]) if (x.typeGuess) types.add(x.typeGuess)
    if (examples.some((x) => x.answer)) report.withExamples++
    const tests = testsOf(g, e.appSections ?? [])
    const tt = classifyTopic(e.title, concepts.map((c) => c.ru).join(', '), text.slice(0, 600), g)
    const topics = [tt.topic]
    for (const c of concepts.slice(0, 6)) {
      const t = classifyTopic(c.ru, '', '', g).topic
      if (t !== 'general' && !topics.includes(t) && topics.length < 4) topics.push(t)
    }
    const kind = kindOf(kp, e.title)
    const unit: Unit = {
      id,
      grade: g,
      kp,
      kind,
      label: labelOf(g, kp),
      cite: `[${labelOf(g, kp).ru}]`,
      chapter: { id: ch.id, num: ch.num, title: ch.title },
      appSections: e.appSections ?? [],
      title,
      pages: { start: e.pageStart, end: e.pageEnd },
      concepts,
      definitions: definitions.slice(0, 10),
      laws: minedLaws(text),
      formulas: minedFormulas(text),
      reactions,
      substances: subs,
      tasks: { types: TYPE_PRIORITY.filter((t) => types.has(t)).reverse(), examples: examples.slice(0, 12), exercises },
      tests,
      topics,
      domain: tt.domain,
      level: { prereq: [], next: [] },
      stats: {
        textbookChunks: tb.length,
        definitionChunks: cs.filter((c) => c.type === 'definition').length,
        summaryChunks: cs.filter((c) => c.type === 'summary').length,
        reactions: reactions.length,
        examples: examples.length,
        exercises: exercises.length,
        tests: tests.length,
        coverageScore: 0,
      },
    }
    const st = unit.stats
    unit.stats.coverageScore =
      Math.round(
        (0.25 * Number(concepts.length > 0) +
          0.25 * Number(unit.definitions.length > 0) +
          0.2 * Number(st.reactions >= 1 || kind === 'practical' || kind === 'review' || kind === 'tasks' || kind === 'lab') +
          0.15 * Number(st.examples + st.exercises >= 1) +
          0.15 * Number(st.tests >= 1 || g >= 10)) *
          100,
      ) / 100
    conceptKeys.set(id, new Set([...concepts.map((c) => dkey(c.ru)), ...unit.definitions.map((d) => dkey(d.term.ru))].filter(Boolean)))
    units.push(unit)
    allUnits.push(unit)
  }
  const pages = Math.max(...units.map((u) => u.pages.end || 0))
  grades[gk] = { book: { title: `Kimyo ${g} (рус.)`, pages }, chapters, units }
}

// связи: prereq — единицы младших классов с ≥ 2 общими понятиями (≤ 3), next — обратные ссылки
for (const u of allUnits) {
  const mine = conceptKeys.get(u.id)!
  const cand: { id: string; n: number; g: number }[] = []
  for (const v of allUnits) {
    if (v.grade >= u.grade) continue
    let n = 0
    for (const k of conceptKeys.get(v.id)!) if (mine.has(k)) n++
    if (n >= 2) cand.push({ id: v.id, n, g: v.grade })
  }
  cand.sort((a, b) => b.n - a.n || b.g - a.g || (a.id < b.id ? -1 : 1))
  u.level.prereq = cand.slice(0, 3).map((c) => c.id)
}
for (const u of allUnits) for (const p of u.level.prereq) {
  const v = allUnits.find((x) => x.id === p)!
  if (v.level.next.length < 5 && !v.level.next.includes(u.id)) v.level.next.push(u.id)
}

// ——— запись (детерминированно: generatedAt не меняется, пока не изменились входы)
const sources: Record<string, string> = {}
for (const p of INPUTS) sources[p] = fs.existsSync(rel(p)) ? sha(p) : 'missing'
let generatedAt = new Date().toISOString().slice(0, 10)
if (fs.existsSync(OUT)) {
  try {
    const prev = JSON.parse(fs.readFileSync(OUT, 'utf8')) as CurriculumMapFile
    if (JSON.stringify(prev.sources) === JSON.stringify(sources)) generatedAt = prev.generatedAt
  } catch {
    /* битый файл — перезапишем */
  }
}
const map: CurriculumMapFile = { version: 1, generatedAt, sources, taskTypes, grades }
// по строке на единицу — читаемые диффы
const lines: string[] = ['{', `"version":1,`, `"generatedAt":${JSON.stringify(generatedAt)},`, `"sources":${JSON.stringify(sources)},`, `"taskTypes":[`]
taskTypes.forEach((t, i) => lines.push(JSON.stringify(t) + (i < taskTypes.length - 1 ? ',' : '')))
lines.push('],', '"grades":{')
GRADES.forEach((g, gi) => {
  const gr = map.grades[`g${g}` as GradeKey]
  lines.push(`${JSON.stringify(`g${g}`)}:{"book":${JSON.stringify(gr.book)},"chapters":${JSON.stringify(gr.chapters)},"units":[`)
  gr.units.forEach((u, i) => lines.push(JSON.stringify(u) + (i < gr.units.length - 1 ? ',' : '')))
  lines.push(']}' + (gi < GRADES.length - 1 ? ',' : ''))
})
lines.push('}', '}')
const out = lines.join('\n') + '\n'
JSON.parse(out) // проверка, что собрали валидный JSON

if (process.argv.includes('--check')) {
  const same = fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === out
  console.log(same ? '[curriculum-map] файл актуален' : '[curriculum-map] файл устарел: npm run brain:curriculum-map')
  process.exit(same ? 0 : 1)
}
fs.mkdirSync(OUT_DIR, { recursive: true })
const prevText = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''
if (prevText !== out) fs.writeFileSync(OUT, out)

// ——— отчёт
const per = GRADES.map((g) => {
  const us = map.grades[`g${g}` as GradeKey].units
  const ex = us.reduce((s, u) => s + u.tasks.examples.filter((x) => x.answer).length, 0)
  const rx = us.reduce((s, u) => s + u.reactions.length, 0)
  const cov = us.reduce((s, u) => s + u.stats.coverageScore, 0) / us.length
  return `  ${g} кл.: единиц ${us.length}, реакций ${rx}, примеров с ответом ${ex}, тестов ${us.reduce((s, u) => s + u.tests.length, 0)}, покрытие ${cov.toFixed(2)}`
})
console.log(`[curriculum-map] ${allUnits.length} единиц → ${path.relative(ROOT, OUT)} (${(Buffer.byteLength(out) / 1e6).toFixed(2)} МБ)${prevText === out ? ' — без изменений' : ''}`)
for (const l of per) console.log(l)
console.log(`  названия uz: i18n ${report.titleUz.i18n}, auto ${report.titleUz.auto}, ru ${report.titleUz.ru}`)
const worst = allUnits.filter((u) => u.kind === 'paragraph').sort((a, b) => a.stats.coverageScore - b.stats.coverageScore).slice(0, 10)
console.log(`  худшие по покрытию: ${worst.map((u) => `${u.id} ${u.stats.coverageScore}`).join(', ')}`)
console.log(`  за ${((performance.now() - t0) / 1000).toFixed(1)} с`)
