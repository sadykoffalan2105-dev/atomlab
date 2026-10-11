/**
 * npm run brain:curriculum-eval — контрольные вопросы по КАЖДОЙ единице программы Kimyo 7–11 (247 § и тем):
 * определения, «почему», расчёт, реакция, тест, получение, вопрос «о чём §» — на ru и uz (en — для части единиц)
 * с ожидаемыми фактами из учебника. Детерминированно (сид 2026, без LLM и сети): повторный запуск — те же файлы.
 *
 * Вход — карта программы src/data/kb/curriculum/kimyo-map.json (строитель A). Пока карты нет, берётся «заглушка»
 * из тех же данных, что читает A (kb-sections, корпус учебников, equations-g*, qaBank, тесты § и их переводы,
 * g7TextbookKnowledge); после слияния A — пересобрать этой же командой (index.json: mapSource). --require-map — без
 * карты выйти с кодом 2. Расчёты считаются СВОИМИ формулами (независимо от калькулятора B) по школьным Ar: таблица
 * SCHOOL_AR из brain/calc/constants.ts (B), пока её нет — копия из спецификации (значения те же).
 *
 * Выход: brain/eval/curriculum/{g7..g11}.jsonl (формат brain/eval/questions.jsonl + поля unit, sub, needs),
 * index.json (счётчики, пробелы), sample-live.jsonl (100 случаев для живой модели: класс × подтип × язык).
 * needs: 'A' — проверка цитаты точного § («[Kimyo 7, гл. 2, тема 6]») и вопрос «о чём §12» (sectionRef A);
 *        'B' — расчёт типа, которого нет в старых инструментах tools.ts (избыток, выход, примеси, D(H₂), p/n/e,
 *              задачи учебника из фикстур B). Ждать ли их — решает раннер по brain/eval/curriculum/pending.json.
 */
import fs from 'node:fs'
import path from 'node:path'
import { Knowledge, REPO_ROOT } from '../../brain/kb/shards.ts'
import { classifyTopic } from '../../brain/kb/topicMap.ts'
import { balanceEquation } from '../../brain/pipeline/tools.ts'
import { findFormulas, pretty } from '../../brain/pipeline/entities.ts'
import { eqKey, obtainTool } from '../../brain/pipeline/obtain.ts'
import { cmpForm, type Lang } from '../../brain/pipeline/normalize.ts'
import { analyzeTerms } from '../../src/learn/kb/analyzer.ts'

const OUT_DIR = path.join(REPO_ROOT, 'brain', 'eval', 'curriculum')
const MAP_FILE = path.join(REPO_ROOT, 'src', 'data', 'kb', 'curriculum', 'kimyo-map.json')
const FIXTURES = path.join(REPO_ROOT, 'brain', 'calc', 'fixtures', 'textbook.jsonl')
const SEED = 2026
const GRADES = [7, 8, 9, 10, 11] as const
/** Объём на единицу (ограничения спецификации): определений ≤ 4, «почему» ≤ 2, реакций ≤ 3, тестов ≤ 3 на язык. */
const MAX = { def: 4, why: 2, rx: 3, test: 3, whyUnitsPerGrade: 3, sample: 100 }
/** Доля единиц, где добавляются вопросы на английском (определения, «почему», тест). */
const EN_SHARE = 0.3

const flag = (name: string) => process.argv.includes(`--${name}`)
const readJson = <T,>(p: string): T => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, p), 'utf8')) as T

// ——— детерминированный генератор случайных чисел (сид на единицу и подтип — порядок обхода не влияет)
function rngFor(key: string): () => number {
  let h = 2166136261 ^ SEED
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!
const between = (r: () => number, lo: number, hi: number, step = 1) => lo + Math.floor(r() * ((hi - lo) / step + 1)) * step

// ——— единица программы (подмножество Unit из контракта A, которое нужно генератору)
type L3 = { ru: string; uz?: string; en?: string }
type Kind = 'paragraph' | 'practical' | 'review' | 'tasks' | 'lab'
type Rx = { eq: string; ascii: string; isGeneral?: boolean; isIonic?: boolean; bankId?: string | null }
type Test = { q: L3; choices?: { ru: string[]; uz?: string[]; en?: string[] }; correct?: number }
type CUnit = {
  id: string
  grade: number
  kp: string
  kind: Kind
  label: { ru: string; uz: string; en: string }
  cite: string
  title: L3
  concepts: L3[]
  definitions: { term: L3; text: string }[]
  reactions: Rx[]
  /** изучаемые вещества (формула ASCII) — для «как получить» */
  substances: string[]
  taskTypes: string[]
  tests: Test[]
  topics: string[]
  coverageScore: number
}

// ——— подписи § (формат контракта A: 8/9/11 — «§12», 7/10 — «гл. 2, тема 6»)
export function labelOf(grade: number, kp: string): { label: CUnit['label']; cite: string } {
  const m = /^(\d+)\.(\d+)$/.exec(kp)
  const label = m
    ? { ru: `Kimyo ${grade}, гл. ${m[1]}, тема ${m[2]}`, uz: `Kimyo ${grade}, ${m[1]}-bob, ${m[2]}-mavzu`, en: `Kimyo ${grade}, ch. ${m[1]}, topic ${m[2]}` }
    : { ru: `Kimyo ${grade}, §${kp}`, uz: `Kimyo ${grade}, ${kp}-§`, en: `Kimyo ${grade}, §${kp}` }
  return { label, cite: `[${label.ru}]` }
}
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** regex цитаты единицы: «[Kimyo 8, §12]» → «Kimyo 8, §12(?![\d.])» (страница после запятой допускается) */
export const citeRegex = (cite: string) => `${reEsc(cite.replace(/^\[|\]$/g, ''))}(?![\\d.])`

function kindOf(title: string, kp: string): Kind {
  if (kp === 'lab') return 'lab'
  if (/^практическ/iu.test(title)) return 'practical'
  if (/урок закреплени|^повторени/iu.test(title)) return 'review'
  if (/^решение задач|^задачи\b/iu.test(title)) return 'tasks'
  return 'paragraph'
}

/** Типы задач по оглавлению (introducedIn из спецификации A) — для заглушки карты; с картой A берутся unit.tasks.types. */
const INTRODUCED: Record<string, string[]> = {
  'g7:2.4': ['atomic_structure_counts'], 'g7:2.7': ['molar_mass'], 'g7:2.9': ['moles_mass_volume_particles'],
  'g7:2.11': ['mass_fraction_element', 'formula_from_fractions'], 'g7:2.12': ['equation_stoich'], 'g7:6.8': ['equation_stoich', 'crystal_hydrate'],
  'g8:1': ['molar_mass', 'moles_mass_volume_particles'], 'g8:7': ['atomic_structure_counts'], 'g8:8': ['atomic_structure_counts'],
  'g8:18': ['oxidation_state'], 'g8:20': ['redox_balance'], 'g8:25': ['gas_density', 'moles_mass_volume_particles'], 'g8:26': ['equivalent'],
  'g8:35': ['yield', 'impurities'], 'g8:42': ['mass_fraction_element'], 'g8:43': ['mass_fraction_element'],
  'g9:5': ['dissociation_degree'], 'g9:6': ['excess_limiting', 'equation_stoich'], 'g9:11': ['equation_stoich'], 'g9:16': ['mixture_fraction'],
  'g9:19': ['electrolysis_faraday'], 'g9:24': ['water_hardness'], 'g9:36': ['yield', 'impurities'], 'g9:37': ['yield', 'impurities'],
  'g10:1.3': ['oxidation_state'], 'g10:2.23': ['combustion_formula', 'formula_from_fractions', 'gas_density'], 'g10:2.24': ['combustion_formula', 'formula_from_fractions', 'gas_density'],
  'g10:3.13': ['equation_stoich', 'yield'], 'g10:3.24': ['equation_stoich', 'yield'], 'g10:3.25': ['equation_stoich', 'yield'],
  'g11:1': ['atomic_structure_counts'], 'g11:2': ['atomic_structure_counts'], 'g11:3': ['atomic_structure_counts'], 'g11:5': ['moles_mass_volume_particles'],
  'g11:6': ['gas_mixture', 'gas_density'], 'g11:7': ['equivalent'], 'g11:8': ['clapeyron'], 'g11:10': ['dissociation_degree'], 'g11:11': ['ph'],
  'g11:13': ['solubility'], 'g11:14': ['solubility'], 'g11:15': ['solution_mass_fraction', 'solution_density_volume'], 'g11:16': ['solution_mass_fraction', 'solution_density_volume'],
  'g11:17': ['solution_mass_fraction', 'solution_density_volume'], 'g11:18': ['molarity'], 'g11:19': ['normality'], 'g11:20': ['molarity', 'normality'], 'g11:21': ['molarity', 'normality'],
  'g11:22': ['reaction_rate'], 'g11:23': ['reaction_rate'], 'g11:24': ['reaction_rate'], 'g11:25': ['equilibrium'], 'g11:26': ['equilibrium'], 'g11:27': ['equilibrium'],
  'g11:28': ['redox_balance', 'equivalent'], 'g11:29': ['redox_balance', 'equivalent'], 'g11:30': ['redox_balance', 'equivalent'],
  'g11:31': ['electrolysis_faraday'], 'g11:32': ['electrolysis_faraday'], 'g11:33': ['electrolysis_faraday'],
}

const dehyph = (s: string) => s.replace(/(\p{L})- (\p{L})/gu, '$1$2').replace(/\s+/g, ' ').trim()
const DEF_LINE = /^([А-ЯЁ][А-Яа-яЁё\- ]{2,45}?)\s+[—–-]\s+(?:это\s+)?(.{20,})$/u
/** термин в именительном падеже: без цифр/скобок и без творительного падежа из «… называется оксидами / молярной массой» */
const goodTerm = (t: string) => t.length >= 3 && t.length <= 45 && t.split(/\s+/).length <= 4 && !/[\d()]/.test(t) && !/(ой|ью|ами|ями|ыми|ими|ым)$/u.test(t)
const asciiFormula = (s: string) => s.replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080))

// ——— заглушка карты (до слияния A): те же источники, без майнинга примеров
type SecRow = { id?: string; kp: string; title: string; page: number; firstText?: string; appSections?: string[] }
type Chunk = { kp: string; type: string; title: string; text: string }
type EqUnit = { kp: string; reactions: { equation: string; equationAscii: string; isIonic?: boolean; isGeneralScheme?: boolean; bankId?: string | null }[] }
type QuizQ = { id: string; question: string; choices: string[]; correctIndex: number }
type QuizI18n = Record<string, { questionUz?: string; questionEn?: string; choicesUz?: string[]; choicesEn?: string[] }>

function stubUnits(kb: Knowledge): CUnit[] {
  const secs = readJson<Record<string, SecRow[] | { book: SecRow[] }>>('src/data/kb/corpus/kb-sections.json')
  const i18n = readJson<QuizI18n>('src/data/sectionQuizI18n.json')
  const g7tk = new Map(readJson<{ sections: { id: string; conceptsRu?: string[]; definitionsRu?: string[] }[] }>('src/data/g7TextbookKnowledge.json').sections.map((s) => [s.id, s]))
  const out: CUnit[] = []
  for (const grade of GRADES) {
    const raw = secs[`g${grade}`]!
    const rows: SecRow[] = Array.isArray(raw) ? raw : raw.book
    const chunks = readJson<{ chunks: Chunk[] }>(`src/data/kb/corpus/kb-corpus-g${grade}.json`).chunks
    const eqs = new Map(readJson<{ units: EqUnit[] }>(`src/data/textbook/equations-g${grade}.json`).units.map((u) => [String(u.kp), u]))
    const quiz = grade <= 9 ? readJson<{ sections: Record<string, QuizQ[]> }>(`src/data/g${grade}SectionQuizBank.json`).sections : {}
    for (const row of rows) {
      const kp = String(row.kp)
      const id = `g${grade}:${kp}`
      const appSections = row.appSections ?? (row.id ? [row.id] : [])
      const mine = chunks.filter((c) => String(c.kp) === kp)
      // понятия: «Изучаемые понятия • …», «Элементы ЗУН: …» (summary), у 7 кл. — conceptsRu
      const concepts = new Set<string>()
      for (const c of g7tk.get(`g7-${row.id}`)?.conceptsRu ?? []) concepts.add(dehyph(c))
      for (const c of mine.filter((x) => x.type === 'summary')) {
        const m = /(?:Изучаемые понятия|Элементы ЗУН|Основные понятия)\s*:?\s*([^]*?)(?:\n|Выводы|$)/u.exec(c.text)
        for (const p of (m?.[1] ?? '').split(/[•;,]/)) {
          const t = dehyph(p.replace(/\.$/, ''))
          if (t.length >= 3 && t.length <= 60) concepts.add(t)
        }
      }
      // определения: qaBank (g + kp) → строки «Термин — это …» definition-чанков → definitionsRu 7 кл.
      const defs = new Map<string, { term: L3; text: string }>()
      const addDef = (term: string, text: string) => {
        const t = dehyph(term)
        if (!goodTerm(t) || defs.has(t.toLowerCase())) return
        defs.set(t.toLowerCase(), { term: { ru: t }, text: dehyph(text).slice(0, 420) })
      }
      for (const d of kb.qa.definitions) if (d.g === grade && String(d.kp) === kp) addDef(d.term, d.def)
      for (const c of mine.filter((x) => x.type === 'definition'))
        for (const line of c.text.split('\n')) {
          const m = DEF_LINE.exec(dehyph(line))
          if (m) addDef(m[1]!, m[2]!)
        }
      for (const line of g7tk.get(`g7-${row.id}`)?.definitionsRu ?? []) {
        const m = DEF_LINE.exec(dehyph(line))
        if (m) addDef(m[1]!, m[2]!)
      }
      const reactions: Rx[] = (eqs.get(kp)?.reactions ?? []).map((r) => ({ eq: r.equation, ascii: r.equationAscii, isGeneral: r.isGeneralScheme, isIonic: r.isIonic, bankId: r.bankId }))
      const tests: Test[] = []
      for (const sec of appSections)
        for (const q of quiz[`g${grade}-${sec}`] ?? []) {
          const tr = i18n[q.id]
          tests.push({ q: { ru: q.question, uz: tr?.questionUz, en: tr?.questionEn }, choices: { ru: q.choices, uz: tr?.choicesUz, en: tr?.choicesEn }, correct: q.correctIndex })
        }
      // изучаемые вещества — продукты реакций единицы, известные банку веществ
      const substances = [...new Set(reactions.flatMap((r) => sides(r.ascii)?.[1].map((s) => s.f) ?? []))].filter((f) => kb.substanceByFormula.has(f))
      const conceptList = [...concepts].slice(0, 10)
      const firstText = mine.find((x) => x.type === 'textbook')?.text ?? row.firstText ?? ''
      const topics = new Set<string>()
      topics.add(classifyTopic(row.title, conceptList.join(', '), firstText, grade).topic)
      for (const t of [...conceptList, ...[...defs.values()].map((d) => d.term.ru)]) topics.add(classifyTopic(t, '', '', grade).topic)
      topics.delete('general')
      const kind = kindOf(row.title, kp)
      const taskTypes = INTRODUCED[id] ?? []
      const coverageScore =
        0.25 * +(conceptList.length > 0) + 0.25 * +(defs.size > 0) + 0.2 * +(reactions.length > 0 || kind === 'practical' || kind === 'review' || kind === 'tasks') + 0.15 * +(taskTypes.length > 0) + 0.15 * +(tests.length > 0 || grade >= 10)
      out.push({ id, grade, kp, kind, ...labelOf(grade, kp), title: { ru: row.title }, concepts: conceptList.map((ru) => ({ ru })), definitions: [...defs.values()], reactions, substances, taskTypes, tests, topics: [...topics], coverageScore: Math.round(coverageScore * 100) / 100 })
    }
  }
  return out
}

// ——— карта A (если уже есть): читаем только нужные поля, всё необязательное — защитно
type MapUnit = {
  id: string; grade: number; kp: string; kind?: Kind; label?: CUnit['label']; cite?: string; title?: L3
  concepts?: L3[]; definitions?: { term: L3; text: { ru: string } }[]; reactions?: { eq: string; ascii: string; isGeneral?: boolean; isIonic?: boolean; bankId?: string | null }[]
  substances?: { formula: string; role?: string }[]; tasks?: { types?: string[] }; tests?: Test[]; topics?: string[]; stats?: { coverageScore?: number }
}
function mapUnits(file: string): CUnit[] {
  const map = JSON.parse(fs.readFileSync(file, 'utf8')) as { grades: Record<string, { units: MapUnit[] }> }
  const out: CUnit[] = []
  for (const g of GRADES)
    for (const u of map.grades[`g${g}`]?.units ?? []) {
      const lc = labelOf(u.grade, u.kp)
      out.push({
        id: u.id, grade: u.grade, kp: u.kp, kind: u.kind ?? kindOf(u.title?.ru ?? '', u.kp), label: u.label ?? lc.label, cite: u.cite ?? lc.cite,
        title: u.title ?? { ru: u.id }, concepts: u.concepts ?? [], definitions: (u.definitions ?? []).map((d) => ({ term: d.term, text: d.text.ru })),
        reactions: (u.reactions ?? []).map((r) => ({ eq: r.eq, ascii: r.ascii, isGeneral: r.isGeneral, isIonic: r.isIonic, bankId: r.bankId })),
        substances: (u.substances ?? []).filter((s) => s.role === 'studied').map((s) => asciiFormula(s.formula)),
        taskTypes: u.tasks?.types ?? [], tests: u.tests ?? [], topics: u.topics ?? [], coverageScore: u.stats?.coverageScore ?? 0,
      })
    }
  return out
}

// ——— уравнения
type Sp = { k: number; f: string }
/** «2H2 + O2 -> 2H2O» → [[{2,H2},{1,O2}], [{2,H2O}]]; null — схема/ионы/непонятные частицы */
function sides(ascii: string): [Sp[], Sp[]] | null {
  const parts = ascii.replace(/\s*(<=>|<->|=|→|⟶|⇄|⇌)\s*/g, ' -> ').split(/\s*->\s*/)
  if (parts.length !== 2) return null
  const side = (s: string) =>
    s.split(/\s+\+\s+/).map((x) => {
      const m = /^(\d*)\s*([A-Z][A-Za-z0-9()]*)(?:\s*[↑↓])?$/.exec(x.trim())
      return m ? { k: m[1] ? Number(m[1]) : 1, f: m[2]! } : null
    })
  const l = side(parts[0]!)
  const r = side(parts[1]!)
  if (l.some((x) => !x) || r.some((x) => !x) || !l.length || !r.length) return null
  return [l as Sp[], r as Sp[]]
}
const spPretty = (s: Sp) => `${s.k > 1 ? s.k : ''}${pretty(s.f)}`
const eqPretty = (l: Sp[], r: Sp[], withK = true) => `${l.map((s) => (withK ? spPretty(s) : pretty(s.f))).join(' + ')} → ${r.map((s) => (withK ? spPretty(s) : pretty(s.f))).join(' + ')}`
/** Уравнять уравнением мозга: результат — коэффициенты, как их выдаст инструмент «balance». */
function balanced(l: Sp[], r: Sp[]): [Sp[], Sp[]] | null {
  const b = balanceEquation(`${l.map((s) => s.f).join(' + ')} -> ${r.map((s) => s.f).join(' + ')}`)
  if (!b || typeof b === 'string') return null
  return sides(asciiFormula(b.eq).replace(/→/g, '->'))
}
/** regex уравнения: коэффициенты как в эталоне (1 — без цифры), индексы обычные или подстрочные, ↑↓ и пробелы — любые */
function eqRegex(l: Sp[], r: Sp[]): string {
  const sp = (s: Sp) => {
    const f = reEsc(s.f).replace(/\d/g, (d) => `[${d}${String.fromCharCode(0x2080 + Number(d))}]`)
    return `${s.k > 1 ? `${s.k}\\s*` : '(?<![\\d₀-₉A-Za-z])'}${f}(?![a-z₀-₉\\d])\\s*[↑↓]?`
  }
  return `${l.map(sp).join('\\s*\\+\\s*')}\\s*(?:→|->|=|⟶|⇄|⇌)\\s*(?:\\([^)]{0,16}\\)\\s*)?${r.map(sp).join('\\s*\\+\\s*')}`
}

// ——— школьные атомные массы: brain/calc/constants.ts (B), иначе копия из спецификации (те же значения)
const SPEC_AR: Record<string, number> = {
  H: 1, He: 4, Li: 7, Be: 9, B: 11, C: 12, N: 14, O: 16, F: 19, Ne: 20, Na: 23, Mg: 24, Al: 27, Si: 28, P: 31, S: 32, Cl: 35.5, Ar: 40, K: 39, Ca: 40,
  Cr: 52, Mn: 55, Fe: 56, Co: 59, Ni: 59, Cu: 64, Zn: 65, Br: 80, Ag: 108, Sn: 119, I: 127, Ba: 137, W: 184, Pt: 195, Au: 197, Hg: 201, Pb: 207,
}
async function schoolAr(kb: Knowledge): Promise<{ ar: (sym: string) => number | null; from: string }> {
  let table: Record<string, number> = SPEC_AR
  let from = 'spec'
  const bPath = path.join(REPO_ROOT, 'brain', 'calc', 'constants.ts')
  if (fs.existsSync(bPath)) {
    try {
      const modPath = '../../brain/calc/constants.ts' // путь в переменной: файл появится только после слияния B
      const mod = (await import(modPath)) as { SCHOOL_AR?: Record<string, number> }
      if (mod.SCHOOL_AR) (table = mod.SCHOOL_AR), (from = 'brain/calc/constants.ts')
    } catch {
      /* таблица B не загрузилась — остаётся копия из спецификации */
    }
  }
  return { ar: (s) => table[s] ?? (kb.elementBySymbol.get(s) ? Math.round(kb.elementBySymbol.get(s)!.A) : null), from }
}

// ——— случаи
type Sub = 'definition' | 'why' | 'calc' | 'reaction' | 'test' | 'obtain' | 'section'
type Need = 'A' | 'B'
type Case = {
  id: string; cat: 'curriculum'; lang: Lang; q: string; context: { gradeId: string; detail: 'brief' }
  expect: Record<string, unknown>; unit: string; sub: Sub; needs?: Need[]; calcType?: string
}

const kb = new Knowledge().load()
const mapExists = fs.existsSync(MAP_FILE)
if (!mapExists && flag('require-map')) {
  console.error('[curriculum-eval] нет карты src/data/kb/curriculum/kimyo-map.json — сначала npm run brain:curriculum-map (строитель A)')
  process.exit(2)
}
const units = mapExists ? mapUnits(MAP_FILE) : stubUnits(kb)
const { ar, from: arFrom } = await schoolAr(kb)
const whyTpl = readJson<{ templates: { id: string; topic: string; minGrade: number; q: Record<Lang, string>; mustMatch: string[] }[] }>('brain/eval/curriculum/why-templates.json').templates
const fixtures: { grade: number; kp: string; statement: string; expect: { value: number; tol?: { rel?: number; abs?: number } }[]; type?: string; lang?: string }[] = fs.existsSync(FIXTURES)
  ? fs.readFileSync(FIXTURES, 'utf8').split('\n').filter((s) => s.trim()).map((s) => JSON.parse(s))
  : []

const glossUz = (ru: string) => kb.glossaryRu.get(ru.toLowerCase())?.uz[0] ?? null
const glossEn = (ru: string) => kb.glossaryRu.get(ru.toLowerCase())?.en[0] ?? null
const lowerTerm = (t: string) => (/^[А-ЯЁ][а-яё]/u.test(t) ? t[0]!.toLowerCase() + t.slice(1) : t)
/** корень слова для regex: ≥ 4 букв, «е» ≈ «ё» */
const stemRe = (w: string) => reEsc(w.length > 6 ? w.slice(0, w.length - 2) : w).replace(/е/g, '[её]')
/** «хотя бы 2 из 3» корней — регекс с просмотром вперёд */
function twoOfThree(stems: string[]): string {
  if (stems.length < 3) return stems.map(stemRe).join('|')
  const [a, b, c] = stems.map((s) => `(?=[\\s\\S]*${stemRe(s)})`)
  return `^(?:${a}${b}|${a}${c}|${b}${c})`
}
const fmtNum = (x: number, lang: Lang) => (lang === 'en' ? String(x) : String(x).replace('.', ','))
const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d

const cases: Case[] = []
const whyUse = new Map<string, number>() // шаблон × класс → сколько единиц уже взяли
const stats = { noCalcWithTypes: [] as string[], fallbackCalc: [] as string[], fewCases: [] as string[] }

function push(u: CUnit, sub: Sub, n: number, lang: Lang, q: string, expect: Record<string, unknown>, needs: Need[] = [], calcType?: string) {
  const id = `${u.id}-${sub}-${n}-${lang}`
  const base: Record<string, unknown> = { lang, scope: 'school', notSource: ['encyclopedia'], citationMatch: citeRegex(u.cite) }
  // цитата точного § проверяется у всех случаев — до слияния A это «ждёт A» (см. pending.json)
  const allNeeds = [...new Set<Need>(['A', ...needs])].sort()
  cases.push({ id, cat: 'curriculum', lang, q, context: { gradeId: `g${u.grade}`, detail: 'brief' }, expect: { ...base, ...expect }, unit: u.id, sub, needs: allNeeds, ...(calcType ? { calcType } : {}) })
}

// ——— расчёты: свои формулы по школьным Ar
type Counts = Record<string, number>
const countsOf = (f: string): Counts | null => findFormulas(f, true)[0]?.counts ?? null
function molar(f: string, school = true): number | null {
  const c = countsOf(f)
  if (!c) return null
  let m = 0
  for (const [el, n] of Object.entries(c)) {
    const a = school ? ar(el) : kb.elementBySymbol.get(el)?.A
    if (a == null) return null
    m += a * n
  }
  return m
}
/** вещество пригодно для расчёта, если школьная и точная M расходятся ≤ 0,4 % (ответ мозга в допуске 1 % и до, и после B) */
const okSub = (f: string) => {
  const s = molar(f)
  const p = molar(f, false)
  return s != null && p != null && s > 0 && Math.abs(s - p) / p <= 0.004
}
const POOL = ['H2O', 'CO2', 'NaOH', 'H2SO4', 'CaCO3', 'NH3', 'HNO3', 'KOH', 'MgO', 'Na2CO3', 'CaO', 'SO2']
const SALTS = ['NaCl', 'KNO3', 'Na2CO3', 'KCl', 'NaOH', 'NH4NO3', 'KOH', 'Na2SO4']
const GASES = ['CO2', 'O2', 'N2', 'NH3', 'CH4', 'SO2', 'H2S', 'C2H6', 'NO2', 'C3H8']
const FALLBACK_RX = ['CaCO3 -> CaO + CO2', '2H2 + O2 -> 2H2O', '2Mg + O2 -> 2MgO', 'NaOH + HCl -> NaCl + H2O', 'Zn + 2HCl -> ZnCl2 + H2', 'S + O2 -> SO2']
type Problem = { q: Record<Lang, string>; value: number; decimals: number; needsB: boolean }
type Gen = (u: CUnit, r: () => number, lang: Lang) => Problem | null

function unitSubs(u: CUnit): string[] {
  const xs = [...new Set(u.reactions.flatMap((x) => (x.isGeneral || x.isIonic ? [] : (sides(x.ascii)?.flat() ?? []).map((s) => s.f))))].filter(okSub).sort()
  return xs.length ? xs : POOL.filter(okSub)
}
/** реакция единицы (или запасная) с двумя участниками, годными для расчёта: R (дано) и P (найти) */
function unitReaction(u: CUnit, r: () => number, twoReactants = false): { l: Sp[]; rr: Sp[]; R: Sp; P: Sp; R2?: Sp } | null {
  const pool = [...u.reactions.filter((x) => !x.isGeneral && !x.isIonic).map((x) => x.ascii), ...FALLBACK_RX]
  for (const ascii of pool) {
    const s = sides(ascii)
    const b = s && balanced(s[0], s[1])
    if (!b) continue
    const [l, rr] = b
    const rs = l.filter((x) => okSub(x.f))
    const ps = rr.filter((x) => okSub(x.f) && x.f !== 'H2O')
    if (!rs.length || !ps.length) continue
    if (twoReactants && (l.length !== 2 || rs.length !== 2)) continue
    return { l, rr, R: rs[0]!, P: pick(r, ps), R2: twoReactants ? rs[1] : undefined }
  }
  return null
}
const GEN: Record<string, Gen> = {
  molar_mass: (u, r) => {
    const F = pretty(pick(r, unitSubs(u)))
    const M = molar(asciiFormula(F))!
    return { q: { ru: `Вычисли молярную массу ${F}.`, uz: `${F} ning molyar massasini hisoblang.`, en: `Calculate the molar mass of ${F}.` }, value: M, decimals: 1, needsB: false }
  },
  mass_fraction_element: (u, r) => {
    const fs2 = unitSubs(u).filter((f) => Object.keys(countsOf(f) ?? {}).length >= 2)
    if (!fs2.length) return null
    const f = pick(r, fs2)
    const c = countsOf(f)!
    const el = pick(r, Object.keys(c).sort())
    const F = pretty(f)
    const w = round(((ar(el)! * c[el]!) / molar(f)!) * 100, 1)
    return { q: { ru: `Вычисли массовую долю элемента ${el} в ${F}.`, uz: `${F} tarkibidagi ${el} elementining massa ulushini hisoblang.`, en: `Calculate the mass fraction of ${el} in ${F}.` }, value: w, decimals: 1, needsB: false }
  },
  moles_mass_volume_particles: (u, r) => {
    const f = pick(r, unitSubs(u))
    const F = pretty(f)
    const m = between(r, 10, 200, 2)
    const n = round(m / molar(f)!, 2)
    if (n < 0.05) return null
    return { q: { ru: `Сколько моль составляют ${m} г ${F}?`, uz: `${m} g ${F} necha mol boʻladi?`, en: `How many moles are there in ${m} g of ${F}?` }, value: n, decimals: 2, needsB: false }
  },
  solution_mass_fraction: (_u, r) => {
    const F = pretty(pick(r, SALTS))
    const ms = between(r, 5, 50)
    const mw = between(r, 50, 250, 5)
    const w = round((ms / (ms + mw)) * 100, 1)
    return { q: { ru: `В ${mw} г воды растворили ${ms} г ${F}. Вычисли массовую долю ${F} в растворе (%).`, uz: `${mw} g suvda ${ms} g ${F} eritildi. Eritmadagi ${F} ning massa ulushini (%) hisoblang.`, en: `${ms} g of ${F} was dissolved in ${mw} g of water. Calculate the mass fraction of ${F} in the solution (%).` }, value: w, decimals: 1, needsB: false }
  },
  molarity: (_u, r) => {
    const F = pretty(pick(r, SALTS))
    const n = between(r, 1, 20) / 10
    const V = pick(r, [0.5, 1, 2, 2.5, 4, 5])
    const c = round(n / V, 2)
    return { q: { ru: `В ${fmtNum(V, 'ru')} л раствора содержится ${fmtNum(n, 'ru')} моль ${F}. Вычисли молярную концентрацию раствора.`, uz: `${fmtNum(V, 'uz')} l eritmada ${fmtNum(n, 'uz')} mol ${F} bor. Eritmaning molyar konsentratsiyasini hisoblang.`, en: `${fmtNum(V, 'en')} L of solution contains ${fmtNum(n, 'en')} mol of ${F}. Calculate the molar concentration.` }, value: c, decimals: 2, needsB: false }
  },
  equation_stoich: (u, r) => {
    const x = unitReaction(u, r)
    if (!x) return null
    const m = between(r, 10, 100, 2)
    const mp = round((m / molar(x.R.f)!) * (x.P.k / x.R.k) * molar(x.P.f)!, 2)
    const eq = eqPretty(x.l, x.rr)
    const R = pretty(x.R.f)
    const P = pretty(x.P.f)
    return { q: { ru: `${eq}. Какая масса ${P} образуется из ${m} г ${R}?`, uz: `${eq}. ${m} g ${R} dan qancha massa ${P} hosil boʻladi?`, en: `${eq}. What mass of ${P} is formed from ${m} g of ${R}?` }, value: mp, decimals: 2, needsB: false }
  },
  excess_limiting: (u, r) => {
    const x = unitReaction(u, r, true)
    if (!x?.R2) return null
    const m1 = between(r, 10, 60, 2)
    const m2 = between(r, 10, 60, 2)
    const e1 = m1 / molar(x.R.f)! / x.R.k
    const e2 = m2 / molar(x.R2.f)! / x.R2.k
    if (Math.abs(e1 - e2) / Math.max(e1, e2) < 0.05) return null // почти эквимолярно — двусмысленно
    const mp = round(Math.min(e1, e2) * x.P.k * molar(x.P.f)!, 2)
    const eq = eqPretty(x.l, x.rr)
    const [A, B, P] = [pretty(x.R.f), pretty(x.R2.f), pretty(x.P.f)]
    return { q: { ru: `${eq}. Смешали ${m1} г ${A} и ${m2} г ${B}. Какая масса ${P} образуется?`, uz: `${eq}. ${m1} g ${A} va ${m2} g ${B} aralashtirildi. Qancha massa ${P} hosil boʻladi?`, en: `${eq}. ${m1} g of ${A} and ${m2} g of ${B} were mixed. What mass of ${P} is formed?` }, value: mp, decimals: 2, needsB: true }
  },
  yield: (u, r) => {
    const x = unitReaction(u, r)
    if (!x) return null
    const m = between(r, 20, 100, 2)
    const theo = (m / molar(x.R.f)!) * (x.P.k / x.R.k) * molar(x.P.f)!
    const mp = round(theo * (between(r, 60, 95) / 100), 1)
    const eta = round((mp / theo) * 100, 1)
    const eq = eqPretty(x.l, x.rr)
    const [R, P] = [pretty(x.R.f), pretty(x.P.f)]
    return { q: { ru: `${eq}. Из ${m} г ${R} получили ${fmtNum(mp, 'ru')} г ${P}. Вычисли выход продукта (%).`, uz: `${eq}. ${m} g ${R} dan ${fmtNum(mp, 'uz')} g ${P} olindi. Mahsulot unumini (%) hisoblang.`, en: `${eq}. ${fmtNum(mp, 'en')} g of ${P} was obtained from ${m} g of ${R}. Calculate the yield (%).` }, value: eta, decimals: 1, needsB: true }
  },
  impurities: (u, r) => {
    const x = unitReaction(u, r)
    if (!x) return null
    const m = between(r, 20, 200, 5)
    const w = between(r, 5, 25)
    const mp = round(((m * (1 - w / 100)) / molar(x.R.f)!) * (x.P.k / x.R.k) * molar(x.P.f)!, 2)
    const eq = eqPretty(x.l, x.rr)
    const [R, P] = [pretty(x.R.f), pretty(x.P.f)]
    return { q: { ru: `${eq}. Какая масса ${P} получится из ${m} г технического ${R}, содержащего ${w} % примесей?`, uz: `${eq}. Tarkibida ${w} % aralashma boʻlgan ${m} g texnik ${R} dan qancha massa ${P} olinadi?`, en: `${eq}. What mass of ${P} is obtained from ${m} g of technical ${R} containing ${w} % impurities?` }, value: mp, decimals: 2, needsB: true }
  },
  gas_density: (_u, r) => {
    const f = pick(r, GASES.filter(okSub))
    const air = r() < 0.4
    const D = round(molar(f)! / (air ? 29 : 2), 2)
    const G = pretty(f)
    return air
      ? { q: { ru: `Вычисли относительную плотность ${G} по воздуху.`, uz: `${G} ning havoga nisbatan zichligini hisoblang.`, en: `Calculate the relative density of ${G} with respect to air.` }, value: D, decimals: 2, needsB: true }
      : { q: { ru: `Вычисли относительную плотность ${G} по водороду.`, uz: `${G} ning vodorodga nisbatan zichligini hisoblang.`, en: `Calculate the relative density of ${G} with respect to hydrogen.` }, value: D, decimals: 2, needsB: true }
  },
  atomic_structure_counts: (_u, r) => {
    const el = kb.elementBySymbol.get(pick(r, ['C', 'N', 'O', 'Na', 'Mg', 'Al', 'P', 'S', 'K', 'Ca', 'Fe', 'Cu', 'Zn']))!
    const A = Math.round(el.A)
    return { q: { ru: `Сколько нейтронов в ядре атома ${el.s} с массовым числом ${A}?`, uz: `Massa soni ${A} boʻlgan ${el.s} atomi yadrosida nechta neytron bor?`, en: `How many neutrons are in the nucleus of a ${el.s} atom with mass number ${A}?` }, value: A - el.z, decimals: 0, needsB: true }
  },
}
const CALC_FALLBACK = ['moles_mass_volume_particles', 'molar_mass']

// ——— обход единиц
for (const u of units) {
  const before = cases.length
  const r = rngFor(u.id)
  const withEn = r() < EN_SHARE
  const genOnly = u.kind === 'review' // повторение — только тесты (спецификация)

  // вопрос «о чём §» — проверка ссылки на § (sectionRef A)
  {
    const rs = rngFor(`${u.id}:section`)
    const words = analyzeTerms(u.title.ru).filter((w) => w.length >= 5).sort((a, b) => b.length - a.length || a.localeCompare(b)).slice(0, 3)
    if (words.length && !genOnly) {
      const ru = pick(rs, [`Что изучают в ${u.label.ru}?`, `О чём ${u.label.ru}?`, `Расскажи кратко, что в ${u.label.ru}.`])
      push(u, 'section', 1, 'ru', ru, { mustMatch: [words.map(stemRe).join('|')] })
      push(u, 'section', 1, 'uz', `${u.label.uz} nima haqida?`, { mustMatch: ['.{40,}'] })
      if (withEn) push(u, 'section', 1, 'en', `What is ${u.label.en} about?`, { mustMatch: ['.{40,}'] })
    }
  }

  if (!genOnly) {
    // определения
    const rd = rngFor(`${u.id}:def`)
    u.definitions.slice(0, MAX.def).forEach((d, i) => {
      const term = lowerTerm(d.term.ru)
      const stems = [...new Set(analyzeTerms(d.text))].filter((s) => s.length >= 5 && !analyzeTerms(d.term.ru).some((t) => t.startsWith(s.slice(0, 5)) || s.startsWith(t.slice(0, 5))))
      const top = stems.sort((a, b) => b.length - a.length || a.localeCompare(b)).slice(0, 3)
      if (!top.length) return
      const ruQ = pick(rd, [`Что такое ${term}?`, `Дай определение: ${term}`, `Что означает термин «${term}»?`])
      push(u, 'definition', i + 1, 'ru', ruQ, { kind: 'definition', mustMatch: [twoOfThree(top)] })
      const uzT = d.term.uz ?? glossUz(d.term.ru)
      const termStem = (t: string) => stemRe(t.split(/\s+/)[0]!.toLowerCase())
      const uzQ = uzT ? pick(rd, [`${uzT} nima?`, `${uzT} deb nimaga aytiladi?`]) : `«${term}» nima?`
      push(u, 'definition', i + 1, 'uz', uzQ, { kind: 'definition', mustMatch: [uzT ? termStem(uzT) : termStem(term)] })
      const enT = d.term.en ?? glossEn(d.term.ru)
      if (withEn && enT) push(u, 'definition', i + 1, 'en', pick(rd, [`What is ${enT}?`, `Define ${enT}.`]), { kind: 'definition', mustMatch: [termStem(enT)] })
    })

    // «почему» — по темам единицы
    let nWhy = 0
    for (const t of whyTpl) {
      if (nWhy >= MAX.why) break
      if (!u.topics.includes(t.topic) || u.grade < t.minGrade) continue
      const key = `${t.id}:${u.grade}`
      if ((whyUse.get(key) ?? 0) >= MAX.whyUnitsPerGrade) continue
      whyUse.set(key, (whyUse.get(key) ?? 0) + 1)
      nWhy++
      for (const lang of ['ru', 'uz', ...(withEn ? ['en' as const] : [])] as Lang[]) push(u, 'why', nWhy, lang, t.q[lang], { mustMatch: t.mustMatch })
    }

    // реакции: «Уравняй» (детерминированно — инструмент balance) и «Закончи уравнение» (для реакций из банка)
    const rr = rngFor(`${u.id}:rx`)
    let nRx = 0
    const seen = new Set<string>()
    for (const x of u.reactions) {
      if (nRx >= MAX.rx) break
      if (x.isGeneral || x.isIonic) continue
      const s = sides(x.ascii)
      const b = s && balanced(s[0], s[1])
      if (!s || !b || s[0].length + s[1].length < 3) continue
      const key = eqKey(eqPretty(b[0], b[1]))
      if (seen.has(key)) continue
      seen.add(key)
      nRx++
      const complete = !!x.bankId && rr() < 0.4
      const re = eqRegex(b[0], b[1])
      const left = s[0].map((y) => pretty(y.f)).join(' + ')
      const bare = eqPretty(s[0], s[1], false)
      push(u, 'reaction', nRx, 'ru', complete ? `Закончи уравнение реакции: ${left} →` : `Уравняй: ${bare}`, { mustMatch: [re] })
      push(u, 'reaction', nRx, 'uz', complete ? `Reaksiya tenglamasini tugating: ${left} →` : `Tenglashtiring: ${bare}`, { mustMatch: [re] })
      if (withEn) push(u, 'reaction', nRx, 'en', complete ? `Complete the equation: ${left} →` : `Balance the equation: ${bare}`, { mustMatch: [re] })
    }

    // расчёт — по типам задач единицы
    if (u.taskTypes.length) {
      const rc = rngFor(`${u.id}:calc`)
      const own = u.taskTypes.filter((t) => GEN[t])
      const fx = fixtures.filter((f) => f.grade === u.grade && String(f.kp) === u.kp && (f.lang ?? 'ru') === 'ru').slice(0, 2)
      let made = 0
      const langs: Lang[] = ['ru', 'uz']
      for (let i = 0; i < 2; i++) {
        const type = own[i % Math.max(1, own.length)]
        if (!type) break
        const p = GEN[type]!(u, rc, langs[i]!)
        if (!p) continue
        const tol = Math.max(0.01, round(0.01 * Math.abs(p.value), 3))
        push(u, 'calc', i + 1, langs[i]!, p.q[langs[i]!], { intent: 'calc|homework', kind: 'calc|homework', number: { value: round(p.value, p.decimals), tol } }, p.needsB ? ['B'] : [], type)
        made++
      }
      // типы без своего генератора — готовые задачи учебника из фикстур B (ответ напечатан в книге)
      fx.forEach((f, i) => {
        if (made >= 2 + i) return
        const nums = f.expect.map((e) => ({ value: e.value, tol: Math.max(e.tol?.abs ?? 0.01, (e.tol?.rel ?? 0.01) * Math.abs(e.value)) }))
        push(u, 'calc', 10 + i, 'ru', f.statement, { intent: 'calc|homework', kind: 'calc|homework', number: nums.length === 1 ? nums[0] : nums }, ['B'], f.type ?? 'textbook')
        made++
      })
      // ни генератора, ни фикстур — базовые задачи на вещества единицы (n и M), помечены calcType «замена: …»
      if (made < 2) {
        stats.fallbackCalc.push(u.id)
        for (let i = made; i < 2; i++) {
          const type = CALC_FALLBACK[i % CALC_FALLBACK.length]!
          const p = GEN[type]!(u, rc, langs[i]!)
          if (!p) continue
          push(u, 'calc', 20 + i, langs[i]!, p.q[langs[i]!], { intent: 'calc|homework', kind: 'calc|homework', number: { value: round(p.value, p.decimals), tol: Math.max(0.01, round(0.01 * Math.abs(p.value), 3)) } }, [], `${type} (замена: ${u.taskTypes.join(', ')})`)
          made++
        }
      }
      if (made < 2) stats.noCalcWithTypes.push(u.id)
    }

    // получение — вещество единицы, для которого инструмент знает уравнение этой же единицы
    const ro = rngFor(`${u.id}:obtain`)
    const unitKeys = new Set(u.reactions.map((x) => eqKey(x.eq)))
    for (const f of [...u.substances].sort((a, b) => (ro() < 0.5 ? -1 : 1) || a.localeCompare(b))) {
      const sub = kb.substanceByFormula.get(f)
      if (!sub || !sub.ru) continue
      const qRu = `Как получить ${sub.ru.toLowerCase()}?`
      const tool = obtainTool(qRu, cmpForm(qRu), 'ru', kb)
      if (!tool) continue
      const lines = tool.text.split(/[\n;]/).map((l) => l.replace(/^\s*[①-⑥\d.]+\s*/, '').replace(/^[^:]*:\s*/, '').replace(/\s+—.*$/, '').trim())
      const hit = lines.find((l) => unitKeys.has(eqKey(l)))
      const hs = hit && sides(asciiFormula(hit).replace(/→/g, '->'))
      if (!hs) continue
      const re = eqRegex(hs[0], hs[1])
      push(u, 'obtain', 1, 'ru', qRu, { mustMatch: [re] })
      if (sub.uz) push(u, 'obtain', 1, 'uz', `${sub.uz} qanday olinadi?`, { mustMatch: [re] })
      break
    }
  }

  // тесты § (7–9 кл.): вопрос + варианты; правильный — буква в начале или слово правильного варианта
  {
    const usable = u.tests.filter((t) => t.choices?.ru && t.correct != null && t.choices.ru.length >= 2 && !/^Параграф «/u.test(t.q.ru) && !t.choices.ru.some((c) => /учебник Kimyo|такой информации нет/iu.test(c)))
    const chosen = usable.filter((_, i) => i % Math.max(1, Math.floor(usable.length / MAX.test)) === 0).slice(0, MAX.test)
    chosen.forEach((t, i) => {
      for (const lang of ['ru', 'uz', ...(withEn ? ['en' as const] : [])] as Lang[]) {
        const qq = (lang === 'ru' ? t.q.ru : lang === 'uz' ? t.q.uz : t.q.en)?.replace(/^(По § «[^»]+»|§ [“«"][^”»"]+[”»"][^:]{0,30}|According to § [“«"][^”»"]+[”»"]):\s*/u, '')
        const ch = lang === 'ru' ? t.choices!.ru : lang === 'uz' ? t.choices!.uz : t.choices!.en
        if (!qq || !ch || ch.length !== t.choices!.ru.length) continue
        const letters = lang === 'ru' ? ['а', 'б', 'в', 'г', 'д', 'е'] : ['a', 'b', 'c', 'd', 'e', 'f']
        const head = lang === 'ru' ? 'Выбери правильный ответ:' : lang === 'uz' ? 'Toʻgʻri javobni tanlang:' : 'Choose the correct answer:'
        const q = `${head} ${qq}\n${ch.map((c, k) => `${letters[k]}) ${c}`).join('\n')}`
        const correct = ch[t.correct!]!
        const others = ch.filter((_, k) => k !== t.correct).join(' ').toLowerCase()
        const word = (correct.toLowerCase().match(/[\p{L}]{5,}/gu) ?? []).filter((w) => !others.includes(w.slice(0, 5))).sort((a, b) => b.length - a.length)[0]
        const L = letters[t.correct!]!
        push(u, 'test', i + 1, lang, q, { kind: 'test_style', mustMatch: [`^\\W{0,3}${L}\\)|^\\W{0,3}${L.toUpperCase()}\\)${word ? `|${stemRe(word)}` : ''}`] })
      }
    })
  }

  // «Изучаемые понятия» § — добрать определения до 4 (и до 5 случаев на §): ru, uz — если термин есть в глоссарии
  if (u.kind === 'paragraph') {
    const room = Math.max(MAX.def - u.definitions.length, 5 - (cases.length - before), 2)
    const defTerms = new Set(u.definitions.map((d) => d.term.ru.toLowerCase()))
    u.concepts
      .filter((c) => !defTerms.has(c.ru.toLowerCase()) && goodTerm(c.ru))
      .slice(0, Math.max(0, room))
      .forEach((c, i) => {
        const t = lowerTerm(c.ru)
        const w = analyzeTerms(t).sort((a, b) => b.length - a.length)[0]
        if (!w || w.length < 4) return
        push(u, 'definition', 50 + i, 'ru', `Что такое ${t}?`, { mustMatch: [stemRe(w)] })
        const uzT = c.uz ?? glossUz(c.ru)
        if (uzT) push(u, 'definition', 50 + i, 'uz', `${uzT} nima?`, { mustMatch: [stemRe(uzT.split(/\s+/)[0]!.toLowerCase())] })
      })
  }
  if (u.kind === 'paragraph' && cases.length - before < 5) stats.fewCases.push(u.id)
}

// ——— запись
fs.mkdirSync(OUT_DIR, { recursive: true })
const byGrade = new Map<number, Case[]>()
for (const c of cases) {
  const g = Number(c.unit.slice(1, c.unit.indexOf(':')))
  byGrade.set(g, [...(byGrade.get(g) ?? []), c])
}
const sizes: Record<string, number> = {}
for (const g of GRADES) {
  const body = (byGrade.get(g) ?? []).map((c) => JSON.stringify(c)).join('\n') + '\n'
  fs.writeFileSync(path.join(OUT_DIR, `g${g}.jsonl`), body)
  sizes[`g${g}`] = Buffer.byteLength(body)
}
// живая выборка: класс × подтип × язык, по кругу, детерминированно
const groups = new Map<string, Case[]>()
for (const c of cases) groups.set(`${c.unit.split(':')[0]}|${c.sub}|${c.lang}`, [...(groups.get(`${c.unit.split(':')[0]}|${c.sub}|${c.lang}`) ?? []), c])
const keys = [...groups.keys()].sort()
const sample: Case[] = []
for (let pass = 0; sample.length < MAX.sample && pass < 50; pass++)
  for (const k of keys) {
    const g = groups.get(k)!
    const idx = Math.floor(rngFor(`${k}:${pass}`)() * g.length)
    const c = g[idx]!
    if (sample.length < MAX.sample && !sample.includes(c)) sample.push(c)
  }
fs.writeFileSync(path.join(OUT_DIR, 'sample-live.jsonl'), sample.map((c) => JSON.stringify(c)).join('\n') + '\n')

const count = (f: (c: Case) => string) => {
  const m: Record<string, number> = {}
  for (const c of cases) m[f(c)] = (m[f(c)] ?? 0) + 1
  return Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })))
}
const perUnit = new Map<string, number>()
for (const c of cases) perUnit.set(c.unit, (perUnit.get(c.unit) ?? 0) + 1)
const secsAll = readJson<{ g9: { appSections: { id: string; title: string; bookParagraphs: number[] }[] } }>('src/data/kb/corpus/kb-sections.json')
const index = {
  version: 1,
  seed: SEED,
  mapSource: mapExists ? 'src/data/kb/curriculum/kimyo-map.json' : 'заглушка (kb-sections + корпус + equations + qaBank + тесты) — пересобрать после слияния A',
  schoolAr: arFrom,
  fixtures: fixtures.length ? `brain/calc/fixtures/textbook.jsonl (${fixtures.length})` : 'нет (B не слит)',
  units: units.length,
  unitsByKind: (() => {
    const m: Record<string, number> = {}
    for (const u of units) m[u.kind] = (m[u.kind] ?? 0) + 1
    return m
  })(),
  cases: cases.length,
  bytes: sizes,
  byGrade: count((c) => c.unit.split(':')[0]!),
  bySub: count((c) => c.sub),
  byLang: count((c) => c.lang),
  byGradeSub: count((c) => `${c.unit.split(':')[0]}/${c.sub}`),
  needs: { A: cases.filter((c) => c.needs?.includes('A')).length, B: cases.filter((c) => c.needs?.includes('B')).length },
  paragraphUnitsUnder5: stats.fewCases,
  unitsWithTypesWithoutCalc: stats.noCalcWithTypes,
  unitsWithCalcFallback: stats.fallbackCalc,
  gaps: {
    g9AppSectionsWithoutBook: secsAll.g9.appSections.filter((s) => !s.bookParagraphs?.length).map((s) => `${s.id} ${s.title}`),
    lowCoverage: units.filter((u) => u.coverageScore < 0.6).map((u) => `${u.id} ${u.coverageScore} ${u.title.ru}`),
  },
  minCasesPerParagraph: Math.min(...units.filter((u) => u.kind === 'paragraph').map((u) => perUnit.get(u.id) ?? 0)),
}
fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n')
const uzShare = cases.filter((c) => c.lang === 'uz').length / Math.max(1, cases.length)
console.log(
  `[curriculum-eval] ${units.length} единиц (${index.mapSource.startsWith('src') ? 'карта A' : 'заглушка карты'}) → ${cases.length} случаев · uz ${(uzShare * 100).toFixed(0)} % · ${JSON.stringify(index.bySub)} · ` +
    `мин. на §: ${index.minCasesPerParagraph} · единиц с типами задач без 2 расчётов: ${stats.noCalcWithTypes.length} · размеры ${Object.entries(sizes).map(([k, v]) => `${k} ${(v / 1024).toFixed(0)} КБ`).join(', ')}`,
)
