/**
 * Уравнения учебника для панели PDF-читалки: src/data/textbook/equations-g{7..11}.json (типы — src/data/textbook/bookReader.ts).
 *
 * Источники:
 *  - инвентарь учебника src/data/textbook/inventory-gN.json (параграфы, вещества, реакции, лабораторные);
 *  - текст страниц — тот же конвейер, что у базы знаний (scripts/kb/lib/pages.mts): слои PDF
 *    scripts/kb/.cache/lines-gN.json (7–10) и OCR scripts/kb/.cache/g11/pNNN.json (11) — без колонтитулов,
 *    с переносами, починкой cp1251 и формул; границы параграфов — как в scripts/kb/build-corpus.mts
 *    (заголовки «§ N» для 8–9, оглавление для 7/10/11), поэтому юниты совпадают с kb-sections.json;
 *    если текста нет — кусочки src/data/kb/corpus/kb-corpus-gN.json;
 *  - поддержка лаборатории — настоящий резолвер src/lab/reactorDeepLink.ts (как scripts/verify-lab-links.mts).
 *
 * Блоки: заголовки, абзацы, подписи (Рис./Таблица), вопросы и задания, формулы. Реакции встают в текст чипами
 * {rx} (нечёткое сравнение «скелета» формул — OCR ломает индексы), остальные — отдельным блоком формулы в конце
 * своей страницы. Вещества — первое упоминание названия (или формулы) в параграфе → {sub}.
 *
 * Run: npm run book:reader            (все классы)
 *      npx tsx scripts/textbook-inventory/build-book-reader.mts --grade 8 --dump p24   (отладка одного параграфа)
 */
import fs from 'node:fs'
import path from 'node:path'
import { analyzeTerms, foldText } from '../../src/learn/kb/analyzer.ts'
import { repairLayout } from '../../src/learn/kb/layoutRepair.ts'
import { stemRussian } from '../../src/learn/kb/stemRu.ts'
import {
  formulaCompositionKey,
  isElementSymbol,
  parseEquationText,
  parseFormula,
} from '../../src/chemistry/equationFormula.ts'
import {
  isOrganicFormula,
  parseReactorLinkParams,
  reactorHrefForBank,
  reactorHrefForEquation,
  resolveReactorEquation,
  type ReactorLinkResult,
} from '../../src/lab/reactorDeepLink.ts'
import { compoundById } from '../../src/data/compounds.ts'
import { getElementBySymbol } from '../../src/data/elements.ts'
import { ORGANIC_CURRICULUM } from '../../src/data/organicLab/organicCurriculum.ts'
import { ORGANIC_MOLECULES, organicMoleculeById } from '../../src/data/organicLab/organicMoleculeRegistry.ts'
import { G10_G11_EDU_EQUATIONS } from '../../src/data/researchLab/g10g11Equations.ts'
import { isCatalogVisibleId } from '../../src/data/textbook/catalogWhitelist.ts'
import { readerUnitHref, type ReaderGrade, type ReaderLab, type ReaderReaction, type ReaderUnit } from '../../src/data/textbook/bookReader.ts'
import { learnGradesOutlineRu } from '../../src/i18n/learn/gradesOutlineRu.ts'
import { appFormulas } from '../kb/lib/cards.mts'
import { letterRatio, loadLayoutParagraphs, loadOcrParagraphs, repairJoinedOcr, type Para } from '../kb/lib/pages.mts'
import { addKnownFormulas, capitalizeSentences, parseFormula as kbParseFormula, segmentGlued } from '../kb/lib/textRepair.mts'

// Internal page-text model: used only to place reactions in the text and to detect exercises; NOT emitted
// (the PDF viewer shows the book itself, the panel only needs the equations).
type ReaderSeg = { t: string } | { rx: number } | { sub: number }
type ReaderBlock = { kind: 'h' | 'p' | 'caption' | 'q' | 'formula'; segs: ReaderSeg[] }
type ReaderPage = { page: number; blocks: ReaderBlock[] }
type ReaderSubstance = {
  key: string
  formula: string | null
  nameRu: string
  catalogId: string | null
  organicId: string | null
  elementSymbol: string | null
}
type FullUnit = ReaderUnit & { pages: ReaderPage[]; substances: ReaderSubstance[] }

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const OUT_DIR = path.join(ROOT, 'src', 'data', 'textbook')
const GRADES = [7, 8, 9, 10, 11] as const
type Grade = (typeof GRADES)[number]

const argv = process.argv.slice(2)
const argValue = (name: string): string | null => {
  const i = argv.indexOf(name)
  return i >= 0 ? (argv[i + 1] ?? null) : null
}
const ONLY_GRADE = argValue('--grade') ? Number(argValue('--grade')) : null
const DUMP_UNIT = argValue('--dump')

const readJson = <T,>(p: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')) as T
const pad2 = (n: number) => String(n).padStart(2, '0')
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

// ═════════════════════════════ inventory types (loose: the grades were built by different agents) ═════════════════

type InvSpecies = { formula?: string; coeff?: number }
type InvReaction = {
  equationAsInBook?: string | null
  equation?: string | null
  equationUnicode?: string | null
  equationAscii?: string | null
  reactants?: InvSpecies[]
  products?: InvSpecies[]
  conditions?: string | null
  type?: string | null
  isGeneralScheme?: boolean
  isIonic?: boolean
  reversible?: boolean
  arrow?: string | null
  page?: number | null
  pages?: number[]
  bankId?: string | null
  // where the reaction comes from (each grade's inventory marks exercises its own way)
  fromExercise?: boolean
  context?: string | null
  subtype?: string | null
  inExercise?: boolean
  note?: string | null
  quote?: string | null
  /** Пояснение для карточки каталога/панели (build-g10-part1.mjs: opts.show) — показывается ученику. */
  catalogNote?: string | null
  /** Общая схема учебника (R, A, B), которую всё же показать карточкой (opts.catalog). */
  showInCatalog?: boolean
  /** Конкретный пример схемы (R = CH3): только для подбора урока органической лаборатории (opts.labAs). */
  labExample?: string | null
}
type InvSubstance = {
  formula?: string | null
  formulaUnicode?: string | null
  molecularFormula?: string | null
  nameRu?: string | null
  kind?: string | null
  catalogId?: string | null
  elementSymbol?: string | null
  element?: string | null
  isIon?: boolean
  page?: number | null
}
type InvLabWork = { title?: string; page?: number | null; pages?: number[] }
type InvSection = {
  sectionId: string | null
  chapterId: string | null
  kp: string | null
  title: string
  pageStart: number | null
  pageEnd: number | null
  appSections?: string[]
  substances?: InvSubstance[]
  reactions?: InvReaction[]
  labWorks?: (InvLabWork | string)[]
}
type Inventory = { sections: InvSection[] }

// ═════════════════════════════ book chapters ═════════════════════════════

/** Grades 8/9: the printed chapters (from the book's table of contents), not the app curriculum. */
const BOOK_CHAPTERS: Partial<Record<Grade, { n: number; roman: string; page: number; title: string }[]>> = {
  8: [
    { n: 1, roman: 'I', page: 5, title: 'Повторение основных понятий курса химии 7 класса' },
    { n: 2, roman: 'II', page: 17, title: 'Периодический закон и периодическая таблица элементов. Строение атома' },
    { n: 3, roman: 'III', page: 62, title: 'Химические связи' },
    { n: 4, roman: 'IV', page: 88, title: 'Неметаллы' },
    { n: 5, roman: 'V', page: 129, title: 'Общая характеристика элементов главной подгруппы шестой группы' },
    { n: 6, roman: 'VI', page: 155, title: 'Подгруппа азота' },
  ],
  9: [
    { n: 1, roman: 'I', page: 5, title: 'Повторение наиболее важных тем курса химии 8 класса' },
    { n: 2, roman: 'II', page: 20, title: 'Теория электролитической диссоциации' },
    { n: 3, roman: 'III', page: 41, title: 'Неметаллы. Группа углерода' },
    { n: 4, roman: 'IV', page: 70, title: 'Металлы' },
    { n: 5, roman: 'V', page: 176, title: 'Обобщение знаний, полученных по неорганической химии' },
  ],
}

const outline = learnGradesOutlineRu as Record<string, string>

/** § titles as printed in the book's contents where the detected heading glued in a neighbour line. */
const TITLE_FIXES: Partial<Record<Grade, Record<string, string>>> = {
  8: {
    '2': 'Основные классы неорганических соединений',
    '3': 'Первоначальная классификация химических элементов',
    '21': 'Общие свойства неметаллов',
    '29': 'Элементы подгруппы кислорода',
  },
  9: { '32': 'Двух-, трех- и шестивалентные соединения хрома и их свойства' },
}

function unitChapter(grade: Grade, sec: InvSection): { chapterId: string | null; chapterTitle: string | null } {
  const table = BOOK_CHAPTERS[grade]
  if (table) {
    if (sec.kp === 'lab') return { chapterId: 'lab', chapterTitle: 'Практические занятия и лабораторные опыты' }
    const page = sec.pageStart ?? 0
    let hit = table[0]!
    for (const ch of table) if (page >= ch.page) hit = ch
    return { chapterId: `ch${hit.n}`, chapterTitle: `Глава ${hit.roman}. ${hit.title}` }
  }
  const chapterId = sec.chapterId ?? (sec.sectionId?.split('-')[0] || null)
  if (!chapterId) return { chapterId: null, chapterTitle: null }
  return { chapterId, chapterTitle: outline[`learn.g${grade}.${chapterId}.title`] ?? null }
}

function unitIdFor(grade: Grade, sec: InvSection): string {
  if (grade === 8 || grade === 9) return sec.kp === 'lab' ? 'lab' : `p${Number(sec.kp)}`
  return sec.sectionId!
}

// ═════════════════════════════ section detection (mirrors scripts/kb/build-corpus.mts) ═════════════════════════════

type TocEntry = { ch: number; sec: number; kp?: number; page: number; titleRu: string }
type Section = { chapterId?: string; sectionId?: string; kp: string; title: string; page: number; y: number; paras: number[] }

const VOCAB = new Map<string, number>()
const STEM_VOCAB = new Map<string, number>()
const VOCAB_LOWER = new Map<string, number>()
const VOCAB_CAPMID = new Map<string, number>()

function termSet(text: string): Set<string> {
  return new Set(analyzeTerms(text).filter((t) => t.length > 1))
}

function fixTitleCase(text: string): string {
  return text.replace(/(?<=[^.!?\s][ \t]+)([А-ЯЁ][а-яё]{2,})(?![а-яёА-ЯЁ])/g, (w: string) => {
    const low = w.toLowerCase()
    const lowerUses = VOCAB_LOWER.get(low) ?? 0
    const capUses = VOCAB_CAPMID.get(low) ?? 0
    return lowerUses >= 3 && capUses <= lowerUses * 0.25 ? low : w
  })
}

function capitalizeProperNouns(text: string): string {
  return text.replace(/(?<![А-Яа-яЁё])([а-яё]{4,})(?![А-Яа-яЁё])/g, (w: string) => {
    const capUses = VOCAB_CAPMID.get(w) ?? 0
    const lowerUses = VOCAB_LOWER.get(w) ?? 0
    return capUses >= 3 && lowerUses <= capUses * 0.1 ? w.charAt(0).toUpperCase() + w.slice(1) : w
  })
}

function tidyTitle(t: string): string {
  let s = capitalizeProperNouns(fixTitleCase(foldText(t).replace(/\s+/g, ' ').trim()))
  const letters = s.replace(/[^А-Яа-яA-Za-z]/g, '')
  const upper = letters.replace(/[^А-ЯA-Z]/g, '').length
  if (letters.length > 3 && (upper / letters.length > 0.6 || /[а-я][А-Я]/.test(s))) {
    // keep formulas ("H2SO4") while lowering Cyrillic caps
    s = s.replace(/[А-ЯЁа-яё]+/g, (w) => w.toLowerCase()).replace(/(^|[.!?]\s+)([а-яё])/g, (_m, a: string, b: string) => a + b.toUpperCase())
  }
  s = s.replace(/^[\s.:–—-]+|[\s.:–—-]+$/g, '').replace(/([.!?]\s+)([а-яё])/g, (_m, a: string, b: string) => a + b.toUpperCase())
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function sentenceCase(s: string): string {
  const low = s.toLowerCase()
  return low.charAt(0).toUpperCase() + low.slice(1)
}

function endMatterPage(paras: Para[], lastPage: number): number {
  let end = lastPage
  for (const p of paras) {
    if (p.page < lastPage * 0.85) continue
    const t = p.text.trim()
    if (
      /^(оглавление|содержание)[.:]?$/i.test(t) ||
      /^ответы на задачи/i.test(t) ||
      (/^(оглавление|содержание)\s/i.test(t) && /\.{4,}|ГЛАВА|§/.test(t))
    ) {
      end = Math.min(end, p.page - 1)
    }
  }
  return end
}

function labSection(paras: Para[], book: Section[], endPage: number): Section | null {
  const last = book[book.length - 1]
  if (!last) return null
  const i = paras.findIndex(
    (p) =>
      p.page <= endPage &&
      (p.page > last.page || (p.page === last.page && p.y > last.y)) &&
      /^(практические занятия|практическая работа\s*№?\s*\d|лабораторная работа\s*№?\s*\d)/i.test(p.text.trim()),
  )
  if (i < 0) return null
  return { kp: 'lab', title: 'Практические и лабораторные работы', page: paras[i]!.page, y: paras[i]!.y - 1, paras: [] }
}

const before = (aPage: number, aY: number, bPage: number, bY: number) => aPage < bPage || (aPage === bPage && aY <= bY + 2)

function assignParagraphs(paras: Para[], sections: Section[], hardEndPage: number) {
  sections.sort((a, b) => a.page - b.page || a.y - b.y)
  paras.forEach((p, i) => {
    if (p.page > hardEndPage) return
    let owner: Section | null = null
    for (const s of sections) {
      if (before(s.page, s.y, p.page, p.y)) owner = s
      else break
    }
    if (owner) owner.paras.push(i)
  })
}

function sectionsFromToc(grade: number, paras: Para[], toc: TocEntry[], marker: RegExp): Section[] {
  const out: Section[] = []
  let prevPage = 0
  let prevY = -1
  toc.forEach((e, idx) => {
    const title = termSet(e.titleRu)
    let best = -1
    let bestScore = 0
    for (let i = 0; i < paras.length; i += 1) {
      const p = paras[i]!
      if (p.page < e.page - 1 || p.page > e.page + 1) continue
      if (!before(prevPage, prevY + 3, p.page, p.y)) continue
      const head = termSet(p.text.slice(0, 200) + ' ' + (p.text.length < 90 ? (paras[i + 1]?.text.slice(0, 100) ?? '') : ''))
      let hit = 0
      for (const t of title) if (head.has(t)) hit += 1
      let score = title.size ? hit / title.size : 0
      if (p.heading) score += 0.25
      if (marker.test(p.text.slice(0, 60))) score += 0.9
      if (/^\d{1,2}\s*[.)]\s/.test(p.text)) score -= 0.6
      if (p.text.length > 400) score -= 0.3
      if (p.page !== e.page) score -= 0.25
      if (score > bestScore) {
        bestScore = score
        best = i
      }
    }
    let page = e.page
    let y = 0
    if (best >= 0 && bestScore >= 0.6) {
      for (let k = best - 1; k >= 0 && k >= best - 2; k -= 1) {
        const up = paras[k]!
        const cur = paras[k + 1]!
        if (up.page !== cur.page || cur.y - up.y > 40 || cur.y < up.y || up.text.length > 120) break
        if (![...termSet(up.text)].some((t) => title.has(t))) break
        if (!before(prevPage, prevY + 3, up.page, up.y)) break
        best = k
      }
      page = paras[best]!.page
      y = paras[best]!.y
    }
    if (grade !== 11 && y > 0 && page > prevPage) {
      const above = paras.filter((p) => p.page === page && p.y < y)
      if (above.every((p) => p.text.length < 120 || /^[•·]/.test(p.text))) y = 0
    }
    if (!before(prevPage, prevY, page, y)) {
      page = prevPage
      y = prevY + 1
    }
    out.push({
      chapterId: `c${e.ch}`,
      sectionId: `s${pad2(e.sec)}`,
      kp: grade === 11 ? String(idx + 1) : `${e.ch}.${e.sec}`,
      title: tidyTitle(e.titleRu),
      page,
      y,
      paras: [],
    })
    prevPage = page
    prevY = y
  })
  return out
}

function sectionsFromMarkers(paras: Para[]): Section[] {
  const out: Section[] = []
  let last = 0
  paras.forEach((p, i) => {
    const m = /^§\s*(\d{1,2})(?!\d)\s*(.*)$/.exec(p.text)
    if (!m || p.text.length > 160) return
    const n = Number(m[1])
    if (n <= last || n > last + 2) return
    const near = paras
      .map((q, j) => ({ q, j }))
      .filter(
        ({ q, j }) =>
          j !== i &&
          q.page === p.page &&
          q.heading &&
          Math.abs(q.y - p.y) < 70 &&
          q.text.length < 120 &&
          !/^[•·]/.test(q.text) &&
          !/^(глава|раздел)(?![а-яё])/i.test(q.text) &&
          !/^§/.test(q.text),
      )
      .sort((a, b) => a.q.y - b.q.y)
    const titleNear = near
      .filter((x) => Math.abs(x.q.y - p.y) <= 32)
      .sort((a, b) => Math.abs(a.q.y - p.y) - Math.abs(b.q.y - p.y))
      .slice(0, 2)
      .sort((a, b) => a.q.y - b.q.y)
    const titleParts = [m[2], ...(titleNear.length ? titleNear : near.slice(0, 1)).map((x) => x.q.text)].filter(
      (s): s is string => !!s && s.length > 2,
    )
    const y = Math.min(p.y, ...near.slice(0, 3).map((x) => x.q.y))
    let title = ''
    for (const raw of titleParts) {
      const letters = raw.replace(/[^А-Яа-яЁё]/g, '')
      const part = letters.length > 3 && letters.replace(/[^А-ЯЁ]/g, '').length / letters.length > 0.6 ? sentenceCase(raw) : raw
      if (title && title.length + part.length > 95) break
      title = !title ? part : /^[а-яё(]/.test(part) ? `${title.replace(/[.\s]+$/, '')} ${part}` : `${title.replace(/[.\s]+$/, '')}. ${part}`
    }
    out.push({ kp: String(n), title: tidyTitle(title) || `§ ${n}`, page: p.page, y, paras: [] })
    last = n
  })
  return out
}

const TOC_MARKERS: Record<number, RegExp> = {
  7: /\d+\s*-\s*тема/i,
  10: /(TEMA|ТЕМА)\s*\d+/i,
  11: /(^|\s)(\d{1,2}\s*-?\s*§|§\s*\d{1,2}\b)/,
}

/** Detected book sections of a grade, keyed like the inventory ('c1-s01' for 7/10/11, kp '24' / 'lab' for 8/9). */
function detectSections(grade: Grade, paras: Para[]): Map<string, Section> {
  const lastPage = Math.max(...paras.map((p) => p.page))
  const out = new Map<string, Section>()
  if (grade === 8 || grade === 9) {
    const book = sectionsFromMarkers(paras)
    const endPage = endMatterPage(paras, lastPage)
    const lab = labSection(paras, book, endPage)
    if (lab) book.push(lab)
    assignParagraphs(paras, book, endPage)
    for (const s of book) out.set(s.kp, s)
  } else {
    const toc = readJson<TocEntry[]>(`src/data/g${grade}BookToc.json`)
    const sections = sectionsFromToc(grade, paras, toc, TOC_MARKERS[grade]!)
    const endPage = Math.min(endMatterPage(paras, lastPage), toc[toc.length - 1]!.page + 9)
    assignParagraphs(paras, sections, endPage)
    for (const s of sections) out.set(`${s.chapterId}-${s.sectionId}`, s)
  }
  return out
}

// ═════════════════════════════ text repair (mirrors build-corpus sectionUnits) ═════════════════════════════

/** Answer options of a test («A) 7,02·10²³; B) 5,01·10²³;») — mostly digits, but part of the question. */
const OPTION_LINE_RE = /^\s*[A-DАВСa-dа-г]\)\s*\S/

function usable(p: Para): boolean {
  if (p.text.length < 2) return false
  const lr = letterRatio(p.text)
  const equation = /[A-Z][a-z]?\d*/.test(p.text) && /(=|→|⇄|->|—>)/.test(p.text)
  if (lr < (equation ? 0.3 : 0.5) && !(OPTION_LINE_RE.test(p.text) && p.text.trim().length >= 4)) return false
  if (/^(§\s*\d+|\d+\s*-\s*тема|TEMA\s*\d+\.?|ТЕМА\s*\d+\.?)$/i.test(p.text.trim())) return false
  if (/сведения о состоянии арендного учебника|таблица заполняется классным руководителем|состояние учебника|фамилия учащегося|удовлетво-? ?рительное/i.test(p.text)) return false
  return true
}

function repairSplitWords(text: string): string {
  const parts = text.split(/([А-Яа-яЁё]+)/)
  const out: string[] = []
  const freq = (w: string) => VOCAB.get(w.toLowerCase()) ?? 0
  const accept = (joined: string, first: string, last: string) => {
    // "водород а на аноде" is a word and the conjunction, not "водорода"
    if (last.length === 1 && freq(first) >= 3) return false
    const jf = freq(joined)
    if (jf >= 3 && jf > Math.min(freq(first), freq(last))) return true
    const sf = STEM_VOCAB.get(stemRussian(joined.toLowerCase())) ?? 0
    return sf >= 5 && freq(last) <= Math.max(2, sf / 20)
  }
  let i = 0
  while (i < parts.length) {
    let word = parts[i]!
    if (/^[А-Яа-яЁё]+$/.test(word)) {
      for (let round = 0; round < 3; round += 1) {
        const frags: string[] = []
        for (let k = 1; k <= 4; k += 1) {
          const sep = parts[i + 2 * k - 1]
          const next = parts[i + 2 * k]
          if (sep !== ' ' || !next || !/^[а-яё]+$/.test(next)) break
          frags.push(next)
        }
        let taken = 0
        for (let n = frags.length; n >= 1; n -= 1) {
          if (accept(word + frags.slice(0, n).join(''), word, frags[n - 1]!)) {
            taken = n
            break
          }
        }
        if (!taken) break
        word += frags.slice(0, taken).join('')
        i += 2 * taken
      }
    }
    out.push(word)
    i += 1
  }
  return out.join('')
}

function knownByStem(low: string): boolean {
  return (STEM_VOCAB.get(stemRussian(low)) ?? 0) >= 3
}

function dropLatinProse(text: string): string {
  return text
    .replace(/[^.!?\n]+[.!?]*/g, (s) => {
      const words = s.match(/[A-Za-zА-Яа-яЁё‘’']{3,}/g) ?? []
      const latin = words.filter((w) => /^[A-Za-z‘’']+$/.test(w) && /[a-z]{2}/.test(w) && !kbParseFormula(w)).length
      const uzbek = /[oOgG][‘’']|[a-z]*[qx][a-z]*|(?<![A-Za-z])(va|bilan|uchun|mumkin|emas|bu|ham|yoki|ta|uni|biz)(?![A-Za-z])/.test(s)
      const drop = uzbek && words.length >= 4 && latin / words.length > 0.6
      return drop ? ' ' : s
    })
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** Latin look-alike repair of formulas typed with Cyrillic capitals: «Н2О» → «H2O», «СН4» → «CH4», «НСl» → «HCl». */
const CYR_TO_LAT: Record<string, string> = { А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', К: 'K', М: 'M', О: 'O', Р: 'P', Т: 'T', Х: 'X' }
function latinizeFormulas(text: string): string {
  return text.replace(/(?<![А-Яа-яЁё])[АВСЕНКМОРТХA-Z][АВСЕНКМОРТХA-Za-z\d()]*(?![А-Яа-яЁё])/g, (tok) => {
    if (!/[АВСЕНКМОРТХ]/.test(tok)) return tok
    if (!/\d|[A-Za-z]/.test(tok)) return tok
    const mapped = [...tok].map((c) => CYR_TO_LAT[c] ?? c).join('')
    const core = mapped.replace(/^\d+/, '')
    return parseFormula(core) ? mapped : tok
  })
}

// ═════════════════════════════ blocks ═════════════════════════════

type Piece = { text: string; page: number; y: number; heading: boolean; size: number; caption: boolean; boldTail?: boolean }
type Span = { start: number; end: number; rx?: number; sub?: number }
type DraftBlock = { kind: ReaderBlock['kind']; text: string; page: number; spans: Span[] }

const CAPTION_RE = /^(Рис(унок|\.)?\s*\d|Рис\.\s*\d|Таблица\s*\d|Табл\.\s*\d|Схема\s*\d)/i
const QHEAD_RE = /^(вопросы и задания|задачи и упражнения|вопросы и упражнения|задания для самостоятельной работы|тестовые задания|контрольные вопросы|проверьте себя|вопросы|задания|упражнения|задачи)(?![а-яё])/i
const MARKER_RE = /^(§\s*\d{1,2}\.?|\d{1,2}\s*-\s*тема[.:]?|(TEMA|ТЕМА)\s*\d+[.:]?|\d{1,2}\.\d{1,2}\.?|глава\s+[IVX]+\.?\s*\d*\s*-?\s*тема[.:]?)\s*/i

function medianSize(paras: Para[]): Map<number, number> {
  const byPage = new Map<number, number[]>()
  for (const p of paras) {
    if (!p.size || p.text.length < 60) continue
    const list = byPage.get(p.page) ?? []
    list.push(p.size)
    byPage.set(p.page, list)
  }
  const all = [...byPage.values()].flat().sort((a, b) => a - b)
  const global = all[Math.floor(all.length / 2)] ?? 0
  const out = new Map<number, number>()
  for (const [page, list] of byPage) {
    list.sort((a, b) => a - b)
    out.set(page, list[Math.floor(list.length / 2)] ?? global)
  }
  out.set(-1, global)
  return out
}

function isFigureLabel(p: Para, body: number): boolean {
  if (!p.size || !body) return false
  if (CAPTION_RE.test(p.text)) return false
  return p.size < body * 0.8 && p.text.length < 90
}

/** A paragraph that stops on a word which cannot end a sentence ("…называются", "…– это", "…находятся в"). */
const RUN_ON_TAIL_RE =
  /(?:^|[\s(])(в|во|и|на|с|со|от|к|ко|по|из|о|об|а|но|что|как|при|под|над|до|за|у|или|для|между|через|это|является|являются|называется|называются|называют|который|которая|которое|которые|их|его|её|ее)$/i

/** Real headings that can follow an unfinished line (not a run-on of the sentence). */
const HEADING_START_RE = /^(практическ|лабораторн|вопросы|задачи|задания|упражнения|тестовые|глава|тема|§)/i

/** Bold lines from i on (same page, each going on in lower case) end a sentence — a key statement, not a heading. */
function boldRunEndsSentence(pieces: Piece[], i: number): boolean {
  let j = i
  while (!/[.!?]$/.test(pieces[j]!.text)) {
    const next = pieces[j + 1]
    if (!next || !next.heading || next.caption || next.page !== pieces[j]!.page || !/^[а-яё(]/.test(next.text)) return false
    j += 1
  }
  return true
}

function mergePieces(pieces: Piece[], grade: Grade): Piece[] {
  const out: Piece[] = []
  for (let idx = 0; idx < pieces.length; idx++) {
    const u = pieces[idx]!
    const prev = out[out.length - 1]
    if (prev && (prev.page === u.page || prev.page + 1 === u.page)) {
      const sameSize = !prev.size || !u.size || Math.abs(prev.size - u.size) <= 1.2
      // "…химическим уравнени-" + bold "ем": a word broken across a style change
      if (!prev.heading && !prev.caption && /[а-яё]-$/.test(prev.text) && /^[а-яё]/.test(u.text)) {
        prev.text = prev.text.slice(0, -1) + u.text
        continue
      }
      // a sentence that runs on into a bold key statement set in body size (8–9: every bold line is a "heading"):
      // "Д.И.Менделеев первоначально сформулировал перио" + bold "дический закон так: …",
      // "· Энергия ионизации – это количество энергии, необходимое" + bold "для отделения электрона от атома."
      if (
        !prev.heading &&
        !prev.caption &&
        u.heading &&
        !u.caption &&
        (!prev.size || !u.size || Math.abs(prev.size - u.size) <= 0.6) &&
        /^[а-яё(]/.test(u.text) &&
        !HEADING_START_RE.test(u.text) &&
        !(prev.boldTail ? /[.!?:;]$/ : /[.!?:;»")]$/).test(prev.text)
      ) {
        const tail = /([а-яё]+)$/.exec(prev.text)?.[1]
        const head = /^[а-яё]+/.exec(u.text)?.[0]
        const fragment = !!tail && tail.length <= 7 && (VOCAB.get(tail) ?? 0) < 2 && !knownByStem(tail)
        // "…сформулировал перио" + "дический закон": the word itself was split by the style change
        const joined = tail && head ? (VOCAB.get(tail + head) ?? 0) : 0
        const split = joined >= 2 && joined > (VOCAB.get(tail!) ?? 0) && joined > (VOCAB.get(head!) ?? 0)
        if (
          prev.boldTail ||
          split ||
          RUN_ON_TAIL_RE.test(prev.text) ||
          (fragment && !!head) ||
          (/[а-яё,–—-]$/.test(prev.text) && boldRunEndsSentence(pieces, idx))
        ) {
          prev.text = split ? prev.text + u.text : `${prev.text} ${u.text}`
          prev.boldTail = true
          continue
        }
      }
      // a bold run-in lead that goes on in body text: "3. Эпоха зарождения научной химии (XVI–XVIII" + "века). На этом …"
      // (grades 8/9 lost sentence capitals, so a lower-case start does not mark a continuation there)
      if (
        grade !== 8 &&
        grade !== 9 &&
        prev.heading &&
        !u.heading &&
        !u.caption &&
        prev.page === u.page &&
        !/[.!?:»")]$/.test(prev.text) &&
        /^[а-яё(]/.test(u.text)
      ) {
        const glued = /[а-яё]$/.test(prev.text) && /^[а-яё]+/.test(u.text) && (VOCAB.get(`${/[а-яё]+$/.exec(prev.text)![0]}${/^[а-яё]+/.exec(u.text)![0]}`) ?? 0) >= 2
        prev.text = glued ? prev.text + u.text : `${prev.text} ${u.text}`
        prev.heading = false
        prev.size = u.size
        continue
      }
      const caps = (t: string) => {
        const letters = t.replace(/[^А-Яа-яЁё]/g, '')
        return letters.length > 3 && letters.replace(/[^А-ЯЁ]/g, '').length / letters.length > 0.7
      }
      if (
        prev.heading &&
        u.heading &&
        prev.page === u.page &&
        !/[.!?:]$/.test(prev.text) &&
        prev.text.length + u.text.length < 160 &&
        (/^[а-яёa-z(]/.test(u.text) || (caps(prev.text) && caps(u.text)))
      ) {
        prev.text = `${prev.text} ${u.text}`
        continue
      }
      if (!prev.heading && !u.heading && sameSize) {
        if (prev.caption) {
          if (/^[а-яё(]/.test(u.text) && u.text.length < 120 && !/[.!?]$/.test(prev.text) && (!prev.size || Math.abs(prev.size - u.size) <= 0.6)) {
            prev.text = `${prev.text} ${u.text}`
            continue
          }
        } else if (!u.caption) {
          if (/[а-яa-z]-$/i.test(prev.text) && /^[а-яa-z]/.test(u.text)) {
            prev.text = prev.text.slice(0, -1) + u.text
            continue
          }
          // continuation: lower case, "4,28 г …", "CaCO3 тремя способами"
          // "…2,8 г железа из раствора" + "CuSO4?": a formula that ends the sentence
          const continues =
            /^[а-яa-z(]/.test(u.text) ||
            /^\d+[,.]\d+\s/.test(u.text) ||
            /^\d+\s+(г|кг|мг|л|мл|моль|%)(?![а-яё])/.test(u.text) ||
            /^[A-Z][A-Za-z0-9()]*\s+[а-яё]/.test(u.text) ||
            /^[A-Z][A-Za-z0-9()]{1,14}[?.!]$/.test(u.text)
          if (!/[.!?:;»")]$/.test(prev.text) && continues && prev.text.length + u.text.length < 1400) {
            prev.text = `${prev.text} ${u.text}`
            continue
          }
        }
      }
    }
    out.push({ ...u })
  }
  return out
}

function splitNumbered(text: string): string[] {
  return text
    // «…электролитом. 4. 0,1 моль FeCl3 …», «C) Fe + Cl2 → ; 9. Укажите …»
    .split(/(?<=[.?!:;)»])\s+(?=\d{1,2}\s*[.)]\s+(?:[А-ЯЁA-Z«(]|\d+,\d))/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function cyrWords(text: string): number {
  return (text.match(/[А-Яа-яЁё]{3,}/g) ?? []).length
}

function titleLike(text: string, title: string): boolean {
  const stripped = text.replace(MARKER_RE, '').trim()
  if (!stripped) return true
  const a = termSet(stripped)
  const b = termSet(title)
  if (!a.size || !b.size) return false
  let hit = 0
  for (const t of b) if (a.has(t)) hit += 1
  return hit / b.size >= 0.7 && stripped.length <= title.length * 1.6 + 20
}

function buildDraftBlocks(grade: Grade, paras: Para[], idxs: number[], sizes: Map<number, number>, title: string): DraftBlock[] {
  const pieces: Piece[] = []
  for (const i of idxs) {
    const p = paras[i]!
    if (!usable(p)) continue
    const body = sizes.get(p.page) ?? sizes.get(-1) ?? 0
    if (isFigureLabel(p, body)) continue
    if (!/\p{L}{2}/u.test(p.text) && p.text.length < 24 && !OPTION_LINE_RE.test(p.text)) continue
    pieces.push({
      text: p.text,
      page: p.page,
      y: p.y,
      heading: p.heading && p.text.length < 140 && !CAPTION_RE.test(p.text) && /^[\p{L}§\d«"(]/u.test(p.text) && letterRatio(p.text) >= 0.6,
      size: p.size,
      caption: CAPTION_RE.test(p.text),
    })
  }
  const merged = mergePieces(pieces, grade).map((u) => {
    let text = dropLatinProse(segmentGlued(repairSplitWords(u.text), (w) => VOCAB.get(w) ?? 0, knownByStem))
    if (grade === 8 || grade === 9) text = u.heading ? text : capitalizeProperNouns(capitalizeSentences(text))
    if (grade === 11) text = repairJoinedOcr(text)
    // hyphens left from line breaks: "древнегре-ческим", "явля- ется" → one word when the books know it
    text = text.replace(/([А-Яа-яЁё]{2,})-(\s?)([а-яё]{2,})/g, (m, a: string, sp: string, b: string) => {
      const joined = `${a}${b}`.toLowerCase()
      if (((VOCAB.get(joined) ?? 0) >= 2 || knownByStem(joined)) && (VOCAB.get(b) ?? 0) < 50) return `${a}${b}`
      // "предна- значен", "ис- следуемым": a hyphen before a space with a non-word first half
      if (sp && (VOCAB.get(a.toLowerCase()) ?? 0) < 2) return `${a}${b}`
      return m
    })
    text = latinizeFormulas(text)
    if (u.heading) text = tidyTitle(text)
    return { ...u, text: norm(text) }
  })

  const unitText = merged.map((u) => u.text).join('\n')
  const fixH2SO4 = /H2SO4/.test(unitText) && !/H2SO3/.test(unitText)

  const blocks: DraftBlock[] = []
  let inQuestions = false
  let seenBody = false
  for (const u of merged) {
    let text = u.text
    if (fixH2SO4) text = text.replace(/H2SO(?![0-9₀-₉])/g, 'H2SO4')
    if (!text) continue
    // lone labels of structural formulas and drawings ("CH3", "Fe", "OH", "1, 259")
    if (!/[А-Яа-яЁё]{2}/.test(text) && text.length <= 8 && !/[=→⇄⇌]/.test(text) && !OPTION_LINE_RE.test(text)) continue
    if (u.heading) {
      // the unit title / a bare "§ N" marker is shown by the page header
      if (!seenBody && (titleLike(text, title) || MARKER_RE.test(text) && !text.replace(MARKER_RE, '').trim())) continue
      // "Глава 1. Понятия о структуре атомов … § 1 структура атома": keep the chapter part only
      const para = /\s§\s*\d{1,2}\b/.exec(text)
      if (!seenBody && para && titleLike(text.slice(para.index).trim(), title)) {
        text = text.slice(0, para.index).trim()
        if (!text) continue
      }
      inQuestions = QHEAD_RE.test(text.replace(MARKER_RE, ''))
      blocks.push({ kind: 'h', text, page: u.page, spans: [] })
      continue
    }
    seenBody = true
    if (u.caption) {
      blocks.push({ kind: 'caption', text, page: u.page, spans: [] })
      continue
    }
    if (text.length < 60 && QHEAD_RE.test(text) && !/\d\s*[.)]\s/.test(text)) {
      // "Тестовые задания по теме:" set in body font
      blocks.push({ kind: 'h', text: tidyTitle(text), page: u.page, spans: [] })
      inQuestions = true
      continue
    }
    const qInline = /^(Вопросы и задания|Задачи и упражнения|Вопросы и упражнения|Тестовые задания|Задания|Упражнения|Вопросы)[.:]?\s+(?=\d{1,2}\s*[.)]\s)/i.exec(text)
    if (qInline) {
      blocks.push({ kind: 'h', text: tidyTitle(qInline[1]!), page: u.page, spans: [] })
      text = text.slice(qInline[0].length)
      inQuestions = true
    }
    if (inQuestions) {
      for (const q of splitNumbered(text)) {
        // the numbers stood in their own column and are lost: one question per block at least («…углерода? Каково…»)
        const parts = /^\d{1,2}\s*[.)]/.test(q) || q.length < 160 ? [q] : q.split(/(?<=\?)\s+(?=[А-ЯЁ])/)
        for (const part of parts) blocks.push({ kind: 'q', text: part, page: u.page, spans: [] })
      }
      continue
    }
    const equationOnly = cyrWords(text) <= 1 && /[=→⇄⇌]|->/.test(text) && /[A-Z]/.test(text)
    if (equationOnly) {
      blocks.push({ kind: 'formula', text, page: u.page, spans: [] })
      continue
    }
    // numbered tasks without a "Вопросы и задания" heading (grade 10 marks them with an icon only)
    if (
      /^\d{1,2}\.\s+[А-ЯЁ]/.test(text) &&
      (/\?\s*$/.test(text) || /^\d{1,2}\.\s+(Напишите|Определите|Вычислите|Рассчитайте|Составьте|Объясните|Приведите|Назовите|Найдите|Укажите|Сравните|Изобразите|Запишите|Сколько|Какой|Какая|Какие|Каким|Каков|Почему|Что|Как)(?![а-яё])/.test(text))
    ) {
      for (const q of splitNumbered(text)) blocks.push({ kind: 'q', text: q, page: u.page, spans: [] })
      continue
    }
    // layout/OCR slips + reviewed errata of the printed book (runtime module shared with the AI teacher)
    const repaired = norm(repairLayout(text).replace(/\n+/g, ' '))
    if (repaired.length >= text.length * 0.8) text = repaired
    // numbered steps glued into one paragraph ("… кислоты. 2. Закройте пробирку … 3. Опустите …"): one block per step
    const steps = splitNumbered(text)
    const numbers = steps.slice(1).map((s) => Number(/^(\d{1,2})/.exec(s)?.[1] ?? NaN))
    const sequential = numbers.length >= 1 && numbers.every((n, i) => i === 0 ? Number.isFinite(n) : n === numbers[i - 1]! + 1)
    if (steps.length >= 3 && sequential) {
      for (const s of steps) blocks.push({ kind: 'p', text: s, page: u.page, spans: [] })
      continue
    }
    blocks.push({ kind: 'p', text, page: u.page, spans: [] })
  }
  return blocks
}

type CorpusChunk = { id: string; kp: string; chapterId?: string; sectionId?: string; pageStart: number; pageEnd: number; type: string; text: string }

/** Fallback when the page pipeline found no text for a unit: the KB corpus chunks (overlap removed). */
function blocksFromCorpus(grade: Grade, unitId: string, sec: InvSection): DraftBlock[] {
  const corpus = readJson<{ chunks: CorpusChunk[] }>(`src/data/kb/corpus/kb-corpus-g${grade}.json`)
  const prefix = grade === 8 || grade === 9 ? (unitId === 'lab' ? `g${grade}-lab-` : `g${grade}-p${pad2(Number(sec.kp))}-`) : `g${grade}-${unitId}-`
  const chunks = corpus.chunks.filter((c) => c.id.startsWith(prefix) && c.type === 'textbook')
  const blocks: DraftBlock[] = []
  let prev = ''
  for (const c of chunks) {
    let text = c.text
    // chunks overlap ~12 %: drop the repeated head
    for (let k = Math.min(prev.length, text.length, 400); k >= 40; k -= 1) {
      if (prev.endsWith(text.slice(0, k))) {
        text = text.slice(k)
        break
      }
    }
    prev = c.text
    for (const line of text.split('\n').map(norm).filter(Boolean)) {
      blocks.push({ kind: CAPTION_RE.test(line) ? 'caption' : 'p', text: line, page: c.pageStart, spans: [] })
    }
  }
  return blocks
}

// ═════════════════════════════ unit boundaries ═════════════════════════════

type UnitDraft = { sec: InvSection; unitId: string; draft: DraftBlock[] }

const CHAPTER_HEAD_RE = /^(\d+\s*-?\s*)?(глава|раздел)(?![а-яё])/i

/**
 * Text that the page split put into the wrong unit:
 *  - the next chapter's heading at the end of a unit («Глава II», «3 глава. Слабые и сильные электролиты…»): a full
 *    title opens the next unit, a bare «Глава II» goes (the chapter is shown in the breadcrumbs);
 *  - a heading cut in two («ГЛАВА обобщение знаний, полученных» | «по неорганической химии»): the next unit's first
 *    heading becomes the whole chapter title;
 *  - «Задачи по теме» ending a unit while its problems open the next one (before that unit's own heading).
 */
function fixUnitBoundaries(grade: Grade, items: UnitDraft[]) {
  items.forEach((item, i) => {
    const cur = item.draft
    const next = items[i + 1]?.draft
    let droppedChapter = false
    while (cur.length && cur[cur.length - 1]!.kind === 'h' && CHAPTER_HEAD_RE.test(cur[cur.length - 1]!.text)) {
      const h = cur.pop()!
      droppedChapter = true
      const rest = h.text.replace(CHAPTER_HEAD_RE, '').replace(/^[\s.:–—-]*([IVX]+\b)?[\s.:–—-]*/, '').trim()
      if (next?.length && next[0]!.kind !== 'h' && cyrWords(rest) >= 2) {
        next.unshift({ ...h, page: Math.max(h.page, next[0]!.page) })
      }
    }
    if (droppedChapter && next?.length && next[0]!.kind === 'h') {
      const title = unitChapter(grade, items[i + 1]!.sec).chapterTitle?.replace(/^Глава\s+[IVX]+\.\s*/, '')
      const head = next[0]!.text.toLowerCase().replace(/ё/g, 'е')
      if (title && head.length >= 8 && head !== title.toLowerCase() && title.toLowerCase().replace(/ё/g, 'е').includes(head)) {
        next[0]!.text = title
      }
    }
    const last = cur[cur.length - 1]
    if (next && last?.kind === 'h' && QHEAD_RE.test(last.text.replace(MARKER_RE, ''))) {
      let k = 0
      while (k < next.length && next[k]!.kind === 'q') k++
      if (k > 0) cur.push(...next.splice(0, k))
    }
  })
}

// ═════════════════════════════ reactions ═════════════════════════════

const SUB_TO_DIGIT: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
const SUP_TO_ASCII: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-' }
const DIGIT_TO_SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉']
const SUP_OUT: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻' }

const SUP_CLASS = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻'
const asciiDigits = (s: string) =>
  s.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (c) => SUB_TO_DIGIT[c]!).replace(new RegExp(`[${SUP_CLASS}]`, 'g'), (c) => SUP_TO_ASCII[c]!)

const ARROW_RE = /<=>|<->|⇄|⇌|↔|->|[—–-]+>|→|⟶|=/g
/** Cyrillic capitals that OCR puts into formulas ("СО", "Н2О") — as Latin for matching only. */
const latinCaps = (s: string) => s.replace(/[АВСЕНКМОРТХ](?![а-яё])/g, (c) => CYR_TO_LAT[c]!)

/** Letters of the formulas and the + / arrow skeleton, lower case: robust to lost indices and spaces. */
function skeleton(s: string): string {
  return latinCaps(asciiDigits(s))
    .replace(/[<>]?\s*-?\d+\s*°\s*C?/g, ' ')
    .replace(ARROW_RE, '=')
    .replace(/(?<![A-Za-z])(t\s*°?\s*C?|kat|hv|hν)(?![A-Za-z])/g, ' ')
    .replace(/[А-Яа-яЁё]+/g, ' ')
    .replace(/[^A-Za-z+=]/g, '')
    .replace(/\+{2,}/g, '+')
    .replace(/=+/g, '=')
    .replace(/^\++|\++$/g, '')
    .toLowerCase()
}

function fullKey(s: string): string {
  return latinCaps(asciiDigits(s))
    .replace(ARROW_RE, '=')
    .replace(/[А-Яа-яЁё]+/g, ' ')
    .replace(/[^A-Za-z0-9+=]/g, '')
    .toLowerCase()
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = new Array<number>(b.length + 1)
  let cur = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[b.length]!
}

const similarity = (a: string, b: string) => {
  const m = Math.max(a.length, b.length)
  if (!m) return 0
  if (Math.abs(a.length - b.length) > m * 0.4) return 0
  return 1 - levenshtein(a, b) / m
}

type EqPiece = { block: number; start: number; end: number; skel: string; full: string; page: number; noArrow: boolean; open: boolean }

/** Terms of each side in a fixed order: "hno+cu=…" and "cu+hno=…" compare equal. */
const sortedSkeleton = (s: string) =>
  s
    .split('=')
    .map((side) => side.split('+').sort().join('+'))
    .join('=')

const RUN_RE = /[A-Za-zАВСЕНКМОРТХ0-9₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻()\[\]·*•∙.,+=→⟶⇄⇌↔↑↓°<>»›\-–— \t]+/g

/** Equation-looking spans of a block ("2Na + O2 = Na2O2"), also across short Cyrillic conditions over the arrow. */
function equationPieces(text: string): { start: number; end: number; noArrow: boolean; open: boolean }[] {
  const runs: { start: number; end: number }[] = []
  for (const m of text.matchAll(RUN_RE)) runs.push({ start: m.index!, end: m.index! + m[0].length })
  const merged: { start: number; end: number }[] = []
  for (const r of runs) {
    const prev = merged[merged.length - 1]
    if (prev) {
      const gap = text.slice(prev.end, r.start)
      const left = text.slice(prev.start, prev.end).trim()
      const right = text.slice(r.start, r.end).trim()
      const arrowEdge = /([—–=→>-]|t°?)$/.test(left) || /^(→|=|⇄|⇌|->|—>)/.test(right)
      if (arrowEdge && gap.length <= 25 && !/[!?:;]/.test(gap)) {
        prev.end = r.end
        continue
      }
    }
    merged.push({ ...r })
  }
  const segments: { start: number; end: number }[] = []
  for (const r of merged) {
    const chunk = text.slice(r.start, r.end)
    // split lists of equations: "…, 2Na + 2H2O = 2NaOH + H2, …"
    const cuts: number[] = [0]
    for (const m of chunk.matchAll(/(?:[,;]|\.(?=\s))\s+/g)) cuts.push(m.index!, m.index! + m[0].length)
    cuts.push(chunk.length)
    // "3H2 +N, ⇄ 2NH3" (OCR comma for an index) stays one piece: a cut only separates two equations
    const arrow = (p: { start: number; end: number }) => HAS_ARROW_RE.test(text.slice(p.start, p.end).replace(/t\s*°?\s*=\s*-?\d+/g, ''))
    const parts: { start: number; end: number }[] = []
    for (let k = 0; k + 1 < cuts.length; k += 2) {
      const part = { start: r.start + cuts[k]!, end: r.start + cuts[k + 1]! }
      const last = parts[parts.length - 1]
      const joinable =
        !!last &&
        (/^(→|⇄|⇌|=|->|—>|<=>|↔|\+)/.test(text.slice(part.start, part.end).trim()) ||
          /(→|⇄|⇌|=|->|—>|<=>|↔|\+)$/.test(text.slice(last.start, last.end).trim()))
      if (last && joinable && (!arrow(last) || !arrow(part))) last.end = part.end
      else parts.push(part)
    }
    for (const p of parts) for (const piece of splitByEquations(text, p.start, p.end)) segments.push(piece)
  }
  const out: { start: number; end: number; noArrow: boolean; open: boolean }[] = []
  for (const seg of segments) {
    let s = seg.start
    let e = seg.end
    const trim = () => {
      while (s < e && !/[A-Za-zАВСЕНКМОРТХ0-9(\[]/.test(text[s]!)) s++
      while (e > s && !/[A-Za-zАВСЕНКМОРТХ0-9₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻)\]↑↓]/.test(text[e - 1]!)) e--
    }
    trim()
    // a Russian one-letter word next to the formula ("… = 2HCl. В лаборатории") is not part of it
    if (/^[АВСЕНКМОРТХ]\s/.test(text.slice(s, e))) {
      s += 2
      trim()
    }
    if (/\s[АВСЕНКМОРТХ]$/.test(text.slice(s, e))) {
      e -= 2
      trim()
    }
    if (e <= s) continue
    // a formula with a blank in it starts the piece: «2H2“?” + 3O2 → 2H2O + 2SO2»
    const blankHead = HEAD_FORMULA_BLANK_RE.exec(text.slice(0, s))
    if (blankHead) s -= blankHead[0].length
    const piece = text.slice(s, e)
    const sk = skeleton(piece)
    // a task leaves a part to fill in: «KOH+CO2 → ... ;», «Cu + HCl → ;», «NaH + H2O = NaOH + ?», «? + 2H2O = …»
    const open = !!blankHead || OPEN_TAIL_RE.test(text.slice(e)) || OPEN_HEAD_RE.test(text.slice(0, s))
    if (!sk.includes('=')) {
      // lost arrow ("CH4 + Cl2 CH3Cl + HCl", "2Na + Cl 2 2Na Cl"): matched later only against a near-identical skeleton
      const capitals = (piece.match(/[A-ZАВСЕНКМОРТХ]/g) ?? []).length
      if (/\+/.test(piece) && capitals >= 3 && sk.replace(/\+/g, '').length >= 5 && cyrWords(piece) === 0) {
        out.push({ start: s, end: e, noArrow: true, open })
      } else if (open && /\+/.test(piece) && capitals >= 2 && sk.replace(/\+/g, '').length >= 3 && cyrWords(piece) === 0) {
        out.push({ start: s, end: e, noArrow: true, open })
      }
      continue
    }
    const [l, rgt] = sk.split('=')
    if (!l || !rgt || sk.replace(/[+=]/g, '').length < 3) continue
    out.push({ start: s, end: e, noArrow: false, open })
  }
  return out
}

const ARROW_ALT = '(?:→|⟶|->|—>|=|⇄|⇌)'
/** A blank of a task: «?», «“?”», «...», «……», «_____». */
const BLANK = '(?:[“”"«»]\\s*\\?\\s*[“”"«»]|\\?|\\.{2,}|…+\\.*|_{2,})'
const TERM = '\\d*[A-Z][A-Za-z0-9()]*\\s?[↑↓]?'
/** After a piece: an arrow / «+» with a blank (or nothing) in place of the products, a blank glued to the last formula. */
const OPEN_TAIL_RE = new RegExp(`^\\s*(?:${ARROW_ALT}|\\+)?\\s*${BLANK}|^\\s*${ARROW_ALT}\\s*(?:[;,.]|$|[A-DА-Г]\\))`)
/** Before a piece: «? + 2H2O = …», «... → CaO». */
const OPEN_HEAD_RE = new RegExp(`${BLANK}\\s*(?:\\+|${ARROW_ALT})\\s*$`)
/** A formula with a blank right before the piece: «2H2“?” + ». */
const HEAD_FORMULA_BLANK_RE = new RegExp(`\\d*[A-Z][A-Za-z0-9()]*${BLANK}\\s*(?:\\+|${ARROW_ALT})\\s*$`)
/** What an exercise chip takes over after its piece: «→ ...», «=? + H2↑», «“?” + H2 ↑», «+ ?», a bare «→» before «;». */
const EXERCISE_TAIL_RE = new RegExp(
  `^(?:\\s*(?:${ARROW_ALT}|\\+)?\\s*${BLANK}[A-Za-z0-9]*(?:\\s*(?:${ARROW_ALT}|\\+)\\s*(?:${BLANK}[A-Za-z0-9]*|${TERM}))*|\\s*${ARROW_ALT}(?=\\s*(?:[;,.]|$|[A-DА-Г]\\))))`,
)
const EXERCISE_HEAD_RE = new RegExp(`(?:${BLANK}\\s*(?:\\+|${ARROW_ALT})\\s*)+$`)

const HAS_ARROW_RE = /=|→|⟶|⇄|⇌|↔|->|—>|–>/
const CONDITION_TOKEN_RE = /^(\(?t°?C?\)?|\(?t\s*°\)?|kat\.?|hv|hν|[<>]?-?\d+°C?|[а-яё][А-Яа-яЁё.,°()]*|[А-Яа-яЁё]{2,}[.,°()]*)$/

/** "Na2O + Al2O3 → 2NaAlO2 Al2O3 + 3N2O5 → 2Al(NO3)3": a new equation starts where two terms meet without "+" after an arrow. */
function splitByEquations(text: string, start: number, end: number): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []
  let pieceStart = start
  let seenArrow = false
  let prev: string | null = null
  for (const m of text.slice(start, end).matchAll(/\S+/g)) {
    const tok = m[0]
    const at = start + m.index!
    if (/^(\d{1,2}|[A-Da-dА-Га-г])\)/.test(tok)) {
      // "… 2NO2 1) смещает" / "A) CO + …": answer labels end a piece
      out.push({ start: pieceStart, end: at })
      pieceStart = at + tok.length
      seenArrow = false
      prev = null
      continue
    }
    if (CONDITION_TOKEN_RE.test(tok) && !/^\d+$/.test(tok)) continue
    const startsOp = /^[+=→⟶⇄⇌↔<>—–↑↓-]/.test(tok)
    const formulaStart = /^[\d(\[]*[A-ZАВСЕНКМОРТХ]/.test(tok)
    if (seenArrow && prev != null && formulaStart && !startsOp && !/[+=→⟶⇄⇌↔>—–-]$/.test(prev) && !/^\d+$/.test(prev)) {
      out.push({ start: pieceStart, end: at })
      pieceStart = at
      seenArrow = false
    }
    if (HAS_ARROW_RE.test(tok)) seenArrow = true
    prev = tok
  }
  out.push({ start: pieceStart, end })
  return out
}

/** A task as printed («KOH+CO2 → ...») in display form: «KOH + CO₂ → ...». */
function bookEquationText(t: string): string {
  return equationToUnicode(norm(t))
    .replace(/(?<=[A-Za-z0-9₀-₉)\]↑↓?.…])\s*\+\s*(?=[\d(\[]*[A-Z?.…])/g, ' + ')
    .replace(/\s*(→|⇌|⇄|=)\s*/g, ' $1 ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Pieces of the equation OCR left next to a chip: a charge («⟦… NH₄⁺⟧+ .») or the rest of the last formula
 * («⟦S + 3F₂ → SF₆⟧ F6», «⟦3Ca + 2P → Ca₃P₂⟧ 3P2»). Returns how many characters after the chip to take over.
 */
function leftoverTail(text: string, end: number, r: { isIonic?: boolean; display: string; ascii: string }): number {
  const after = text.slice(end)
  const charge = /^[+\-–−]{1,2}(?=[\s.,;:)]|$)/.exec(after)
  if (charge) return r.isIonic || /[⁺⁻]|\^|ē/.test(r.display) ? charge[0].length : 0
  const tail = /^\s?((?:\d*[A-Z][a-z]?\d*)+)(?=[\s.,;:)]|$)/.exec(after)
  if (!tail) return 0
  const last = /(?:^|[+=→⇄⇌>\s])\s*\d*([A-Z][A-Za-z0-9()]*)$/.exec(asciiDigits(text.slice(0, end)))?.[1]
  if (!last) return 0
  const products = (r.ascii.split(/<=>|->|=/)[1] ?? '').split('+').map((p) => p.trim().replace(/^\d+/, '').replace(/[↑↓\s]/g, ''))
  const joined = last + asciiDigits(tail[1]!)
  return products.includes(joined) ? tail[0].length : 0
}

/** Display form: digits after a symbol → subscripts, "^2-" → superscripts, ASCII arrows → Unicode. */
function equationToUnicode(s: string): string {
  let t = s
    .replace(/<=>|<->/g, '⇌')
    .replace(/[—–-]+>/g, '→')
    .replace(/\^(\d*[+-])/g, (_m, c: string) => [...c].map((ch) => SUP_OUT[ch] ?? ch).join(''))
  t = t.replace(/([A-Za-z)\]])(\d+)/g, (_m, a: string, d: string) => a + [...d].map((c) => DIGIT_TO_SUB[Number(c)]).join(''))
  t = t.replace(/(?<=[₀-₉A-Za-z)])\*(?=\d*[A-Z])/g, '·')
  return norm(t)
}

type InvRx = InvReaction & {
  key: string
  ascii: string
  display: string
  texts: string[]
  /** equationAsInBook without labels and notes; null when the book gives no equation (words, a word problem) */
  printed: string | null
  /** the inventory took it from a task, test or exercise */
  exerciseContext: boolean
}

/** Inventory notes for editors ("t° (в книге не указано)", "HNO3 (в книге «конц.»)") are not shown to students. */
function stripEditorialNotes(s: string): string {
  return s.replace(/\s*\([^()]*в книге[^()]*\)/g, '').replace(/^\s*в книге над стрелкой\s*/i, '')
}

function cleanConditions(c: string | null | undefined): string | null {
  if (!c) return null
  const out = norm(stripEditorialNotes(c))
  return out && !/в книге/i.test(out) ? out : null
}

function condensedAscii(r: InvReaction): string | null {
  if (!r.reactants?.length || !r.products?.length) return null
  const side = (list: InvSpecies[]) =>
    list
      .map((s) => {
        const f = (s.formula ?? '').trim()
        if (!f) return null
        const c = s.coeff != null && s.coeff !== 1 ? String(s.coeff) : ''
        return `${c}${f}`
      })
      .filter(Boolean)
      .join(' + ')
  const l = side(r.reactants)
  const p = side(r.products)
  if (!l || !p) return null
  const eqText = `${r.equation ?? ''} ${r.equationUnicode ?? ''} ${r.equationAscii ?? ''} ${r.arrow ?? ''}`
  const reversible = r.reversible === true || /⇄|⇌|<=>|↔/.test(eqText)
  return `${l} ${reversible ? '<=>' : '->'} ${p}`
}

function prepareReactions(list: InvReaction[]): InvRx[] {
  const out: InvRx[] = []
  const seen = new Set<string>()
  for (const r of list) {
    const unicodeRaw = r.equationUnicode ?? (r.equation && /[₀-₉]/.test(r.equation) ? r.equation : null)
    const asciiRaw = r.equationAscii ?? (r.equation && !/[₀-₉]/.test(r.equation) ? r.equation : null) ?? r.equation ?? ''
    const ascii = condensedAscii(r) ?? asciiDigits(asciiRaw).replace(/→|⟶/g, '->').replace(/⇄|⇌/g, '<=>')
    const arrows = (s: string | null | undefined) => (s?.match(/→|->|=|⇄|⇌/g) ?? []).length
    // a chain of transformations keeps all its steps ("CaCO3 → CO2 → Na2CO3 → …", not "CaCO3 → NaCl")
    const chain = r.isGeneralScheme && r.equationAsInBook && arrows(r.equationAsInBook) >= 2 && arrows(r.equationAsInBook) > arrows(unicodeRaw ?? asciiRaw)
    const display = stripEditorialNotes(equationToUnicode(chain ? r.equationAsInBook! : (unicodeRaw ?? asciiRaw ?? ascii)))
      .replace(/→\(\s*\)/g, '→')
      .replace(/\s{2,}/g, ' ')
    const key = fullKey(ascii)
    if (!key || seen.has(key)) continue
    seen.add(key)
    const texts = (chain ? [r.equationAsInBook] : [r.equationAsInBook, r.equation, r.equationUnicode, r.equationAscii, ascii]).filter(
      (s): s is string => typeof s === 'string' && /[A-Za-z]/.test(s) && /=|→|->|⇄|⇌/.test(s),
    )
    const printed = cleanAsInBook(r.equationAsInBook)
    out.push({ ...r, key, ascii, display, texts, printed, exerciseContext: exerciseContext(r) })
  }
  return out
}

// ── exercises: the inventory completed / balanced what the student has to write ──

/** «а) Pb(NO3)2 + NaCl →», «B) Mg + H2SO4 → ; (тест 8)» → «Pb(NO3)2 + NaCl →»; words instead of an equation → null. */
function cleanAsInBook(s: string | null | undefined): string | null {
  if (!s) return null
  const t = latinizeFormulas(
    norm(stripEditorialNotes(s))
      .replace(/\s*\((тест|задани|задач|вопрос|упражнени|пример)[^()]*\)\s*$/i, '')
      // labels of a list or a matching test: «E) H2S + O2 →», «1) 2H2O + SO3 →»
      .replace(/^([A-ZА-ЯЁa-zа-яё]|\d{1,2})\)\s*/, '')
      // the answer column of a matching test: «Н2 + O2 → ... 2) Н2О»
      .replace(/(\.{2,}|…)\s+\d{1,2}\)\s.*$/, '$1')
      // editor's remarks in brackets («(схема на рисунке; «Напишите уравнение этой реакции»)»)
      .replace(/\s*\((?=[^()]*[А-Яа-яЁё]{3,}[^()]*\s[^()]*[А-Яа-яЁё]{3,})[^()]*\)/g, '')
      .replace(/¯/g, '↓')
      .replace(/і/g, 'i')
      .replace(/\s*[;,]\s*$/, '')
      .replace(/(?<!\.)\.\s*$/, '')
      .trim(),
  )
  if (cyrWords(t.replace(/\([^()]*\)/g, ' ')) >= 2 || !/[A-Z?]/.test(t)) return null
  // «Na и O2»: the pair of reactants to write the equation for
  if (!/[+=→⇄⇌]|->/.test(t) && !/^[A-Z][A-Za-z0-9()]*\s+и\s+[A-Z][A-Za-z0-9()]*$/.test(t)) return null
  return t
}

/** The printed equation leaves something to fill in: «KOH + CO2 → ...», «NaH + H2O = NaOH + ?», «Cu + HCl →». */
const isOpenEquation = (t: string) =>
  /\.{2,}|…|_{2,}|[“”"]\s*\?\s*[“”"]|(^|[\s+=→⇄⇌>(])\?/.test(t) ||
  // «2H2? + 3O2 → …»: a blank glued to a formula, but not the question mark ending a sentence («… ⇄ 2CO – Q?»)
  /[A-Za-z0-9₀-₉)]\?(?!\s*$)/.test(t) ||
  /(→|⟶|->|=|⇄|⇌)\s*[;,.]?\s*$/.test(t)

/** For comparing: without heat terms («+ Q», «– 572 кДж»), states «(г)», «(конц.)» and a closing «?». */
const comparable = (t: string) =>
  t
    .replace(/\s*[+\-–−]\s*\d*[.,]?\d*\s*(Q|кДж)(?![A-Za-zА-Яа-яЁё]).*$/i, '')
    .replace(/\((г|ж|тв|р-р|р|aq|s|l|g|конц\.?|разб\.?)\)/gi, '')
    .replace(/(?<=[A-Za-z0-9₀-₉)])\?\s*$/, '')

/** Charges written without «^» («Cu2+», «SO42-») or as superscripts («SO₄²⁻») → no charge, for comparing ionic texts. */
const withoutCharges = (t: string) =>
  t.replace(/(?<=[A-Za-z)\]0-9₀-₉])\^?(?:[0-9⁰-⁹]?[+\-–−⁺⁻]|[⁰-⁹]*[⁺⁻])(?=\s|$|[,;.)])/g, '')

const EXERCISE_NOTE_RE = /(задани[еяй]|задач[аиеу]|упражнени|тест\s*\d|вопрос\s*\d)/i
const TASK_WORDS_RE =
  /(уравняйте|расставьте|подставьте|завершите|допишите|закончите|дополните|составьте уравнени|напишите уравнени|запишите уравнени|осуществите|определите сумм|невозможно осуществить|протекают до конца)/i

function exerciseContext(r: InvReaction): boolean {
  if (r.fromExercise === true || r.context === 'exercise' || r.subtype === 'exercise' || r.inExercise === true) return true
  const note = r.note ?? ''
  if (EXERCISE_NOTE_RE.test(note) && !/(то же уравнение|повторяется|также в тексте)/i.test(note)) return true
  return TASK_WORDS_RE.test(r.quote ?? '')
}

/** Species with their relative coefficients, sides order-free: equal for «CuO + H2 = Cu + H2O» and «H2 + CuO → H2O + Cu». */
function equationSignature(text: string): string | null {
  const p = parseEquationText(text)
  if (!p || !p.reactants.length || !p.products.length) return null
  const all = [...p.reactants, ...p.products]
  const min = Math.min(...all.map((s) => s.coeff))
  if (!(min > 0)) return null
  const side = (list: typeof p.reactants) =>
    list.map((s) => `${s.counts ? formulaCompositionKey(s.counts) : s.formula}^${s.charge}*${+(s.coeff / min).toFixed(3)}`).sort().join('+')
  return `${side(p.reactants)}=${side(p.products)}`
}

/** Does the page already print the whole answer (same substances and coefficients)? */
function printsAnswer(r: InvRx, printedRaw: string): boolean {
  if (isOpenEquation(printedRaw)) return false
  const printed = comparable(printedRaw)
  const answers = [r.ascii, r.display].map(comparable)
  const sig = (t: string) => equationSignature(t) ?? (r.isIonic ? equationSignature(withoutCharges(t)) : null)
  const b = sig(printed)
  for (const a of answers.map(sig)) if (a && b && a === b) return true
  if (r.isIonic) {
    const bi = equationSignature(withoutCharges(printed))
    if (bi && answers.some((t) => equationSignature(withoutCharges(t)) === bi)) return true
  }
  // chains and schemes: the same formulas and numbers in any order of terms
  return answers.some((t) => sortedSkeleton(fullKey(printed)) === sortedSkeleton(fullKey(t)))
}

/** OCR lost the case of symbols in grade 8 («Kcl», «hNO3», «ca3(PO4)2»): the reaction's own formulas put it back. */
function fixFormulaCase(text: string, r: InvRx): string {
  const species = new Map<string, string>()
  for (const t of r.ascii.split(/\s*(?:<=>|->|=|\+)\s*/)) {
    const f = t.trim().replace(/^\d+/, '').replace(/[↑↓]|\(.*?[а-яё].*?\)/gi, '').trim()
    if (f && /[A-Z]/.test(f)) species.set(f.toLowerCase(), f)
  }
  return text.replace(/(?<![A-Za-z])[A-Za-z][A-Za-z0-9]*(?:\([A-Za-z0-9]+\)\d*[A-Za-z0-9]*)*/g, (tok) => species.get(tok.toLowerCase()) ?? tok)
}

/**
 * Formula core of a term for composition matching: without the coefficient («2», «n», «2n»), the radical dot
 * («CH₃•», «Cl·», «•CH₃», «R*»), the polymer index «(C₈H₈)ₙ» and the bond marks «-», «=», «≡»
 * (a hydrate dot inside «CuSO₄·5H₂O» stays).
 */
const speciesCore = (term: string | null | undefined) =>
  asciiDigits(term ?? '')
    .replace(/ₙ/g, 'n')
    .trim()
    .replace(/^(?:\d+n|\d+|n)(?=[A-Z(\[])/, '')
    .replace(/^[•·∙*]+|[•·∙*]+$/g, '')
    .replace(/\)n$/, ')')
    .replace(/[-=≡↑↓]/g, '')
    .trim()

/** Composition key of an organic species ("CH3COOH", "C₂H₅OH"); null for inorganic carbon (NaHCO₃, KCN) and the rest. */
function organicKey(formulaRaw: string | null | undefined): string | null {
  const f = speciesCore(formulaRaw)
  const counts = f ? parseFormula(f)?.counts : null
  return counts && isOrganicFormula(f, counts) ? formulaCompositionKey(counts) : null
}

function isOrganicSpeciesList(r: InvReaction): boolean {
  return [...(r.reactants ?? []), ...(r.products ?? [])].some((s) => organicKey(s.formula) != null)
}

type OrganicEq = { lessonId: string; left: Set<string>; right: Set<string>; organic: Set<string> }

/** Equations of the organic lab lessons (equation mode) by composition of their terms. */
const ORGANIC_LESSON_EQS: OrganicEq[] = ORGANIC_CURRICULUM.flatMap((lesson) =>
  G10_G11_EDU_EQUATIONS.filter((e) => lesson.equationIds.includes(e.id)).map((e) => {
    const keyOf = (term: string) => {
      const f = speciesCore(term)
      const c = parseFormula(f)?.counts
      return c ? formulaCompositionKey(c) : null
    }
    const left = new Set(e.left.map(keyOf).filter((k): k is string => !!k))
    const right = new Set(e.right.map(keyOf).filter((k): k is string => !!k))
    const organic = new Set([...e.left, ...e.right].map((t) => organicKey(t)).filter((k): k is string => !!k))
    return { lessonId: lesson.id, left, right, organic }
  }),
)

/**
 * Organic lab lesson whose equation mode fits the reaction: the same equation, otherwise the most shared organic
 * substances (at least one). null — no lesson practises these substances (no link then, only the reason).
 */
function organicAltHref(r: InvReaction, src: string): string | null {
  const keys = (list: InvSpecies[] | undefined) =>
    new Set((list ?? []).map((s) => {
      const f = speciesCore(s.formula)
      const c = parseFormula(f)?.counts
      return c ? formulaCompositionKey(c) : null
    }).filter((k): k is string => !!k))
  const left = keys(r.reactants)
  const right = keys(r.products)
  const organic = new Set([...(r.reactants ?? []), ...(r.products ?? [])].map((s) => organicKey(s.formula)).filter((k): k is string => !!k))
  if (!organic.size) return null
  const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((k) => b.has(k))
  let best: { lessonId: string; score: number } | null = null
  for (const e of ORGANIC_LESSON_EQS) {
    const shared = [...organic].filter((k) => e.organic.has(k)).length
    if (!shared) continue
    // the same equation; otherwise most shared organic substances, then most shared substances overall
    const sharedAll = [...left, ...right].filter((k) => e.left.has(k) || e.right.has(k)).length
    const score = same(left, e.left) && same(right, e.right) ? 100 : shared * 10 + sharedAll * 3 - Math.abs(e.organic.size - organic.size)
    if (!best || score > best.score) best = { lessonId: e.lessonId, score }
  }
  if (!best) return null
  const q = new URLSearchParams({ lesson: best.lessonId, mode: 'equation', src })
  return `/organic?${q.toString()}`
}

const labReasonCounts = new Map<string, number>()

/** Species of the reaction for the organic lab match: the concrete example (labExample) of a scheme, else itself. */
function labProbe(r: InvReaction): InvReaction {
  if (!r.labExample) return r
  const [l, p] = r.labExample.split(/\s*(?:→|->|=|⇌|<=>)\s*/)
  if (!l || !p) return r
  const side = (t: string): InvSpecies[] =>
    t.split(/\s+\+\s+/).map((x) => {
      const m = /^(\d+)(?=[A-Z(\[])/.exec(x.trim())
      return { formula: m ? x.trim().slice(m[1]!.length) : x.trim(), coeff: m ? Number(m[1]) : 1 }
    })
  return { ...r, reactants: side(l), products: side(p) }
}

function labFor(grade: Grade, unitId: string, pageStart: number | null, r: InvRx, rxId: string): ReaderLab {
  const src = readerUnitHref(`g${grade}`, unitId, { rx: rxId, page: pageStart })
  // a scheme «R–H + Cl• → R• + HCl» picks its organic lesson by the book's concrete example (R = CH₃)
  const probe = labProbe(r)
  const organic = isOrganicSpeciesList(probe)
  // a refusal keeps its code (a general scheme «AB + C → AC + B» is a scheme, NaHCO₃ is not organic); only a real
  // organic reaction reads «organic» (structural formulas «CH₂=CH₂» fail the parser as a scheme). An organic lab
  // lesson is offered only when it practises these substances.
  const failWith = (code: string): ReaderLab => {
    const alt = organic && code !== 'ionic' ? organicAltHref(probe, src) : null
    // «(C₆H₇O₂(OH)₃)n + …» without a lesson keeps its «n — general formula» explanation
    const reason = organic && code !== 'ionic' && !r.isGeneralScheme && (alt || code !== 'generalFormula') ? 'organic' : code
    return alt ? { ok: false, reason, altHref: alt } : { ok: false, reason }
  }
  if (r.isGeneralScheme) return failWith('scheme')
  let res: ReactorLinkResult | null = null
  if (r.bankId) {
    res = resolveReactorEquation({ reactionId: r.bankId })
    if (res.ok) return { ok: true, href: reactorHrefForBank(r.bankId, { src }) }
  }
  // conditions over the arrow go into the link when they survive the round trip
  const clean = cleanConditions(r.conditions)
  const cond = clean && clean.length <= 30 && !/[()]/.test(clean) ? clean : null
  const withCond = cond ? r.ascii.replace(/ (->|<=>) /, (_m, a: string) => ` ${a}(${cond}) `) : null
  if (withCond) {
    const rc = resolveReactorEquation({ equation: withCond })
    if (rc.ok && rc.conditions === cond) return { ok: true, href: reactorHrefForEquation(withCond, { src }) }
  }
  res = resolveReactorEquation({ equation: r.ascii })
  if (res.ok) return { ok: true, href: reactorHrefForEquation(r.ascii, { src }) }
  return failWith(res.code)
}

// ═════════════════════════════ substances ═════════════════════════════

const organicByName = new Map<string, string>()
const organicByKey = new Map<string, string[]>()
for (const m of ORGANIC_MOLECULES) {
  organicByName.set(m.nameRu.toLowerCase().replace(/ё/g, 'е').trim(), m.id)
  const c = parseFormula(asciiDigits(m.formula))?.counts
  if (c) {
    const k = formulaCompositionKey(c)
    organicByKey.set(k, [...(organicByKey.get(k) ?? []), m.id])
  }
}

function matchOrganic(s: InvSubstance): string | null {
  if (s.catalogId && organicMoleculeById[s.catalogId]) return s.catalogId
  const name = (s.nameRu ?? '').toLowerCase().replace(/ё/g, 'е').trim()
  if (name && organicByName.has(name)) return organicByName.get(name)!
  const f = (s.molecularFormula ?? s.formula ?? '').replace(/[-=≡]/g, '')
  const c = f ? parseFormula(asciiDigits(f))?.counts : null
  if (c && (c.C ?? 0) > 0 && (c.H ?? 0) > 0) {
    const ids = organicByKey.get(formulaCompositionKey(c))
    if (ids?.length === 1) return ids[0]!
  }
  return null
}

function buildSubstances(list: InvSubstance[]): ReaderSubstance[] {
  const out: ReaderSubstance[] = []
  const seen = new Set<string>()
  for (const s of list) {
    if (s.isIon) continue
    const nameRu = cleanSubstanceName(s.nameRu ?? '')
    const catalogId = s.catalogId && compoundById[s.catalogId] && isCatalogVisibleId(s.catalogId) ? s.catalogId : null
    const organicId = matchOrganic(s)
    const symRaw = s.elementSymbol ?? s.element ?? null
    const elementSymbol = !catalogId && !organicId && symRaw && isElementSymbol(symRaw) && getElementBySymbol(symRaw) ? symRaw : null
    if (!catalogId && !organicId && !elementSymbol) continue
    const key = catalogId ? `c:${catalogId}` : organicId ? `o:${organicId}` : `e:${elementSymbol}`
    if (seen.has(key)) continue
    seen.add(key)
    const formulaRaw = s.formulaUnicode ?? s.formula ?? null
    const catalog = catalogId ? compoundById[catalogId] : null
    // no formula in the inventory («вода», «песок»): the catalog's
    const formula = formulaRaw ? equationToUnicode(formulaRaw) : (catalog?.formulaUnicode ?? null)
    // descriptive inventory phrases («калий : хлор 1:1», «черный порошок», «соединение хлора с кальцием») → catalog name
    const descriptive = /:|соединени|^вещество(?![а-яё])|порош[о]?к|^смесь(?![а-яё])/i.test(nameRu)
    const nameShown = descriptive && catalog ? lowerFirst(catalog.nameRu) : nameRu
    out.push({
      key,
      formula,
      // a formula given as the name ("MgCl2", OCR "SO3 )") is shown like the text around it: "MgCl₂"
      nameRu: /[А-Яа-яЁё]/.test(nameShown) ? nameShown : (formula ?? (nameShown ? equationToUnicode(nameShown) : key)),
      catalogId,
      organicId,
      elementSymbol,
    })
  }
  return out
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** «Хлорид калия» → «хлорид калия» (reader names are lower case; the chip capitalises a sentence start). */
const lowerFirst = (s: string) => (/^[А-ЯЁ][а-яё]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s)

/**
 * Display name of a substance: qualifiers in brackets go ("хлорид натрия (поваренная соль)" → "хлорид натрия",
 * "серная кислота (концентрированная)" → "серная кислота"), valence stays ("оксид марганца(IV)").
 */
function cleanSubstanceName(nameRu: string): string {
  return norm(nameRu.replace(/\s*\((?![IVX]+\))[^)]*\)/g, ' ').replace(/[«»"“”]/g, ''))
}

/**
 * A {sub} segment replaces its text and the reader shows the substance name there, so only exact mentions of the
 * name count (no inflected forms — "раствора хлорида водорода" must not turn into "раствора хлорид водорода").
 */
function nameRegex(name: string): RegExp | null {
  if (!/[А-Яа-яЁё]/.test(name)) {
    // a formula used as the name ("Na₂O"): the page text still has ASCII indices at this point
    const f = asciiDigits(name).replace(/·/g, '*').trim()
    if (f.length < 2 || !/^[A-Z(\[][A-Za-z0-9()[\]*]*$/.test(f)) return null
    if (!/\d/.test(f) && (f.match(/[A-Z]/g) ?? []).length < 2) return null
    // whole formulas only: «KCl» is not the start of «KClO3», «H2» not of «H2O» / «H2CO3», «SO4» not the tail of «Fe2(SO4)3»
    return new RegExp(`(?<![A-Za-z0-9)\\]·*])${escapeRe(f)}(?![A-Za-z0-9₀-₉(\\[·*])`, 'g')
  }
  const base = name.replace(/ё/g, 'е').trim()
  const words = base.split(/\s+/).filter(Boolean)
  if (!words.length || words.length > 5 || base.length < 3) return null
  if (words.length === 1 && words[0]!.length < 4) return null
  const src = `(?<![\\p{L}\\d-])${words.map((w) => escapeRe(w).replace(/е/g, '[её]')).join('\\s+')}(?![\\p{L}\\d-])`
  return new RegExp(src, 'giu')
}

/** Adjectives that make a one-word substance name a different substance: «известковая вода», «хлорная вода». */
const SOLUTION_MODIFIER_RE =
  /(?<![А-Яа-яЁё])(известков|аммиачн|бромн|хлорн|баритов|жавелев|сероводородн|йодн|иодн|кремнев|царск|плавиков|марганцовк)[а-яё]*\s+$/i

function overlaps(spans: Span[], s: number, e: number): boolean {
  return spans.some((x) => s < x.end && e > x.start)
}

// ═════════════════════════════ segments ═════════════════════════════

const SIMPLE_FORMULAS = new Set(['H2', 'O2', 'N2', 'Cl2', 'F2', 'Br2', 'I2', 'O3', 'P4', 'S8'])

/** Formulas in running text → Unicode subscripts ("H2SO4" → "H₂SO₄"); leading coefficients stay. */
function textFormulasToUnicode(text: string): string {
  return text.replace(/(?<![A-Za-z0-9А-Яа-яЁё_-])(\d*)((?:\((?:[A-Z][a-z]?\d*)+\)\d*|[A-Z][a-z]?\d*){1,8})(?![A-Za-zА-Яа-яЁё\d])/g, (m, coeff: string, f: string) => {
    if (!/\d/.test(f)) return m
    const symbols = f.match(/[A-Z][a-z]?/g) ?? []
    if (!symbols.every((s) => isElementSymbol(s))) return m
    if (symbols.length === 1 && !f.includes('(') && !SIMPLE_FORMULAS.has(f)) return m
    return coeff + f.replace(/([A-Za-z)])(\d+)/g, (_x, a: string, d: string) => a + [...d].map((c) => DIGIT_TO_SUB[Number(c)]).join(''))
  })
}

function blockToSegs(b: DraftBlock): ReaderSeg[] {
  const segs: ReaderSeg[] = []
  const spans = [...b.spans].sort((x, y) => x.start - y.start)
  let pos = 0
  const pushText = (s: string) => {
    if (!s) return
    const t = textFormulasToUnicode(s)
    const last = segs[segs.length - 1]
    if (last && 't' in last) last.t += t
    else segs.push({ t })
  }
  for (const sp of spans) {
    pushText(b.text.slice(pos, sp.start))
    if (sp.rx != null) segs.push({ rx: sp.rx })
    else if (sp.sub != null) segs.push({ sub: sp.sub })
    pos = sp.end
  }
  pushText(b.text.slice(pos))
  return segs.filter((s) => !('t' in s) || s.t.length > 0)
}

// ═════════════════════════════ unit build ═════════════════════════════

type GradeStats = {
  units: number
  pages: number
  blocks: number
  chars: number
  reactions: number
  inline: number
  appended: number
  exercises: number
  labOk: number
  labByReason: Map<string, number>
  substances: number
  substancesPlaced: number
  fallbackUnits: string[]
  emptyUnits: string[]
}

/** General schemes the inventory asks to keep as cards (showInCatalog): «R–H + Cl• → R• + HCl», Kolbe «2R–COONa…». */
const SHOWN_SCHEMES = new WeakSet<ReaderReaction>()

function buildUnit(grade: Grade, sec: InvSection, draft: DraftBlock[], stats: GradeStats): FullUnit {
  const unitId = unitIdFor(grade, sec)
  const { chapterId, chapterTitle } = unitChapter(grade, sec)
  const reactionsInv = prepareReactions(sec.reactions ?? [])
  const reactions: ReaderReaction[] = reactionsInv.map((r, i) => {
    const id = `r${i + 1}`
    const lab = labFor(grade, unitId, sec.pageStart ?? null, r, id)
    return {
      id,
      page: r.page ?? r.pages?.[0] ?? null,
      equation: r.display,
      equationAscii: r.ascii,
      conditions: cleanConditions(r.conditions),
      type: r.type ?? 'other',
      isIonic: r.isIonic === true,
      isGeneralScheme: r.isGeneralScheme === true,
      bankId: r.bankId ?? null,
      lab,
      ...(r.catalogNote ? { note: norm(r.catalogNote) } : {}),
    }
  })
  reactionsInv.forEach((r, i) => {
    if (r.isGeneralScheme && r.showInCatalog) SHOWN_SCHEMES.add(reactions[i]!)
  })

  // ── inline reaction chips ──
  const pieces: EqPiece[] = []
  draft.forEach((b, bi) => {
    if (b.kind === 'h' && !/[A-Z].*(→|=|⇄|⇌)/.test(b.text)) return
    for (const p of equationPieces(b.text)) {
      const t = b.text.slice(p.start, p.end)
      pieces.push({ block: bi, start: p.start, end: p.end, skel: skeleton(t), full: fullKey(t), page: b.page, noArrow: p.noArrow, open: p.open })
    }
  })
  type Cand = { rx: number; piece: number; score: number }
  const cands: Cand[] = []
  reactionsInv.forEach((r, ri) => {
    const skels = [...new Set(r.texts.map(skeleton).filter((s) => s.includes('=')))]
    const fulls = [...new Set(r.texts.map(fullKey))]
    const page = r.page ?? r.pages?.[0] ?? null
    const taskLike = r.exerciseContext || (r.printed != null && isOpenEquation(r.printed))
    pieces.forEach((p, pi) => {
      const dist = page == null ? 0 : Math.abs(p.page - page)
      if (dist > 3) return
      if (p.noArrow) {
        if (dist > 1) return
        // an open task piece («KOH + CO2 → ...», «Fe + Cl2 → ;») stands for the reactants only
        const leftToo = p.open && (taskLike || draft[p.block]!.kind === 'q')
        const sides = (s: string) => (leftToo ? [s.replace(/=/g, ''), s.split('=')[0]!] : [s.replace(/=/g, '')])
        let sk = 0
        for (const s of skels) for (const v of sides(s)) sk = Math.max(sk, similarity(v, p.skel), similarity(sortedSkeleton(v), sortedSkeleton(p.skel)) - 0.02)
        if (sk < 0.9) return
        let fu = 0
        for (const f of fulls) for (const v of sides(f)) fu = Math.max(fu, similarity(v, p.full))
        const score = 0.75 * sk + 0.25 * fu - 0.04 * dist - 0.08
        if (score >= 0.7) cands.push({ rx: ri, piece: pi, score })
        return
      }
      let sk = 0
      // terms may come in another order ("4HNO3 + Cu = …" for "Cu + 4HNO3 = …")
      for (const s of skels) sk = Math.max(sk, similarity(s, p.skel), similarity(sortedSkeleton(s), sortedSkeleton(p.skel)) - 0.03)
      if (sk < (p.skel.length <= 10 ? 0.8 : 0.72)) return
      let fu = 0
      for (const f of fulls) fu = Math.max(fu, similarity(f, p.full), similarity(sortedSkeleton(f), sortedSkeleton(p.full)) - 0.03)
      const score = 0.75 * sk + 0.25 * fu - 0.04 * dist
      if (score < 0.7) return
      // a chain ("Ca → CaH2 → Ca(OH)2") only stands for a chain with as many arrows
      const arrowsIn = (s: string) => (s.match(/=/g) ?? []).length
      if (!skels.some((s) => arrowsIn(s) === arrowsIn(p.skel))) return
      // below a near-exact score every formula of the piece must be one of the reaction's ("CO + 3H2 → CH4 + H2O"
      // is not "CO2 + H2 ⇌ CO + H2O"); the last one may be cut short ("2FeHPO4 + Fe = Fe…")
      if (score < 0.9) {
        const terms = p.skel.split(/[+=]/).filter(Boolean)
        const known = new Set(skels.flatMap((s) => s.split(/[+=]/)).filter(Boolean))
        const misses = terms.filter((t, i) => !known.has(t) && !(i === terms.length - 1 && [...known].some((k) => k.startsWith(t)))).length
        if (misses > Math.floor((terms.length - 1) / 4)) return
      }
      cands.push({ rx: ri, piece: pi, score })
    })
  })
  cands.sort((a, b) => b.score - a.score)
  if (DUMP_UNIT === unitId) {
    console.log(`[why] ${pieces.length} pieces:`)
    for (const p of pieces) console.log(`   piece p${p.page} "${draft[p.block]!.text.slice(p.start, p.end)}" skel=${p.skel}`)
    reactionsInv.forEach((r, ri) => {
      const best = cands.filter((c) => c.rx === ri).slice(0, 2)
      console.log(`   rx${ri + 1} p${r.page} ${r.texts.map(skeleton).join(' | ')} → ${best.map((c) => `${c.score.toFixed(2)} "${draft[pieces[c.piece]!.block]!.text.slice(pieces[c.piece]!.start, pieces[c.piece]!.end)}"`).join(' ; ') || '—'}`)
    })
  }
  const placedRx = new Set<number>()
  const usedPiece = new Set<number>()
  /** where each placed reaction stands: the text it replaces, an open task piece, a question block */
  const placement = new Map<number, { text: string; open: boolean; q: boolean }>()
  for (const c of cands) {
    if (placedRx.has(c.rx) || usedPiece.has(c.piece)) continue
    const p = pieces[c.piece]!
    const b = draft[p.block]!
    if (overlaps(b.spans, p.start, p.end)) continue
    let start = p.start
    let end = p.end
    const r = reactionsInv[c.rx]!
    if (p.open || b.kind === 'q' || r.exerciseContext) {
      // the chip of a task takes over its blanks: «KOH+CO2 → ...», «NaH + H2O = NaOH + ?», «? + 2H2O = …»
      const tail = EXERCISE_TAIL_RE.exec(b.text.slice(end))
      const head = EXERCISE_HEAD_RE.exec(b.text.slice(0, start))
      const s2 = head ? start - head[0].length : start
      const e2 = tail ? end + tail[0].length : end
      if (!overlaps(b.spans, s2, e2)) {
        start = s2
        end = e2
      }
    } else {
      // pieces of the formula left next to the chip: «⟦S + 3F₂ → SF₆⟧ F6 .», «⟦… NH₄⁺⟧+ .»
      end += leftoverTail(b.text, end, r)
    }
    while (start < end && /\s/.test(b.text[start]!)) start++
    while (end > start && /\s/.test(b.text[end - 1]!)) end--
    b.spans.push({ start, end, rx: c.rx })
    placement.set(c.rx, { text: b.text.slice(start, end), open: p.open, q: b.kind === 'q' })
    placedRx.add(c.rx)
    usedPiece.add(c.piece)
    if (process.env.BOOK_DEBUG_MATCH && c.score < Number(process.env.BOOK_DEBUG_MATCH)) {
      console.log(`[match] g${grade}/${unitId} ${c.score.toFixed(2)} "${b.text.slice(p.start, p.end)}" ⇒ ${reactionsInv[c.rx]!.display}`)
    }
  }

  // ── exercises: a task prints less than the completed equation → the chip shows the book's text, the answer is hidden ──
  reactionsInv.forEach((r, i) => {
    const pl = placement.get(i)
    const printed = [pl?.text, r.printed].filter((t): t is string => !!t)
    if (printed.some((t) => printsAnswer(r, t))) return
    const task = r.exerciseContext || !!pl?.open || !!pl?.q || (r.printed != null && isOpenEquation(r.printed))
    if (!task) return
    let bookText: string | null = null
    if (pl) {
      const ps = r.printed != null ? skeleton(r.printed) : ''
      const ts = skeleton(pl.text)
      const similar = r.printed != null && (ps.includes(ts) || Math.max(similarity(ps, ts), similarity(sortedSkeleton(ps), sortedSkeleton(ts))) >= 0.6)
      bookText = similar ? r.printed : pl.text
    } else {
      bookText = r.printed
    }
    reactions[i]!.exercise = true
    reactions[i]!.asInBook = bookText ? bookEquationText(fixFormulaCase(asciiDigits(bookText), r)) : null
    stats.exercises += 1
  })

  // ── substances: first mention of the name (then of the formula) ──
  const substances = buildSubstances(sec.substances ?? [])
  const order = substances.map((s, i) => ({ s, i })).sort((a, b) => b.s.nameRu.length - a.s.nameRu.length)
  const placedSub = new Set<number>()
  // pass 1: a mention with the same letter case as the name (not the capitalised sentence start); pass 2: any case
  for (const sameCase of [true, false]) {
    for (const { s, i } of order) {
      const re = nameRegex(s.nameRu)
      if (!re || placedSub.has(i)) continue
      found: for (const b of draft) {
        if (b.kind === 'h' || b.kind === 'formula') continue
        for (const m of b.text.matchAll(re)) {
          const st = m.index!
          const en = st + m[0].length
          if (sameCase && m[0].replace(/ё/g, 'е') !== asciiDigits(s.nameRu).replace(/ё/g, 'е')) continue
          if (overlaps(b.spans, st, en)) continue
          // «известковая вода» is Ca(OH)₂, «бромная вода» Br₂ — not the water of the one-word name
          if (!/\s/.test(s.nameRu) && SOLUTION_MODIFIER_RE.test(b.text.slice(Math.max(0, st - 40), st))) continue
          b.spans.push({ start: st, end: en, sub: i })
          placedSub.add(i)
          break found
        }
      }
    }
  }

  // ── pages ──
  const pageMap = new Map<number, ReaderBlock[]>()
  for (const b of draft) {
    const segs = blockToSegs(b)
    if (!segs.length) continue
    const list = pageMap.get(b.page) ?? []
    list.push({ kind: b.kind, segs })
    pageMap.set(b.page, list)
  }
  const textPages = [...pageMap.keys()].sort((a, b) => a - b)
  const firstPage = textPages[0] ?? sec.pageStart ?? 0
  reactions.forEach((r, i) => {
    if (placedRx.has(i)) return
    const inRange = r.page != null && sec.pageStart != null && sec.pageEnd != null && r.page >= sec.pageStart && r.page <= sec.pageEnd
    // outside the unit's pages: under the nearest page of the text (not the first one)
    const nearest = r.page != null && textPages.length ? textPages.reduce((a, b) => (Math.abs(b - r.page!) < Math.abs(a - r.page!) ? b : a)) : firstPage
    const page = r.page != null && (pageMap.has(r.page) || inRange) ? r.page : nearest
    const list = pageMap.get(page) ?? []
    list.push({ kind: 'formula', segs: [{ rx: i }] })
    pageMap.set(page, list)
  })
  const pages: ReaderPage[] = [...pageMap.entries()].sort((a, b) => a[0] - b[0]).map(([page, blocks]) => ({ page, blocks }))

  const labWorks: { title: string; page: number | null }[] = []
  const seenLab = new Set<string>()
  for (const lw of sec.labWorks ?? []) {
    const title = norm(typeof lw === 'string' ? lw : (lw.title ?? ''))
    if (!title || seenLab.has(title.toLowerCase())) continue
    seenLab.add(title.toLowerCase())
    labWorks.push({ title, page: typeof lw === 'string' ? null : (lw.page ?? lw.pages?.[0] ?? null) })
  }

  // ── stats ──
  stats.reactions += reactions.length
  stats.inline += placedRx.size
  stats.appended += reactions.length - placedRx.size
  for (const r of reactions) {
    if (r.lab.ok) stats.labOk += 1
    const reason = r.lab.ok ? 'ok' : r.lab.reason
    stats.labByReason.set(reason, (stats.labByReason.get(reason) ?? 0) + 1)
    labReasonCounts.set(reason, (labReasonCounts.get(reason) ?? 0) + 1)
  }
  stats.substances += substances.length
  stats.substancesPlaced += placedSub.size
  stats.pages += pages.length
  stats.blocks += pages.reduce((s, p) => s + p.blocks.length, 0)
  stats.chars += pages.reduce((s, p) => s + p.blocks.reduce((q, b) => q + b.segs.reduce((w, g) => w + ('t' in g ? g.t.length : 0), 0), 0), 0)

  return {
    unitId,
    chapterId,
    chapterTitle,
    kp: sec.kp ?? null,
    // grades 8/9 headings capitalise common nouns ("Первоначальная Классификация …"); a few are fixed from the printed contents
    title: TITLE_FIXES[grade]?.[String(sec.kp)] ?? (grade === 8 || grade === 9 ? tidyTitle(sec.title) : norm(sec.title)),
    pageStart: sec.pageStart ?? null,
    pageEnd: sec.pageEnd ?? null,
    appSections: grade === 8 || grade === 9 ? [...(sec.appSections ?? [])] : sec.sectionId ? [sec.sectionId] : [],
    pages,
    reactions,
    substances,
    labWorks,
  }
}

/** Structural checks: ids, indices, every reaction visible exactly where the lab link will send the reader back. */
function validateUnit(grade: Grade, u: FullUnit): string[] {
  const out: string[] = []
  const at = `g${grade}/${u.unitId}`
  if (!/^[A-Za-z0-9-]+$/.test(u.unitId)) out.push(`${at}: unitId not URL-safe`)
  if (!u.title) out.push(`${at}: no title`)
  if (!u.pages.length) out.push(`${at}: no pages`)
  const seenRx = new Set<number>()
  const seenSub = new Set<number>()
  let lastPage = -Infinity
  for (const p of u.pages) {
    if (p.page <= lastPage) out.push(`${at}: pages not sorted (${p.page})`)
    lastPage = p.page
    if (!p.blocks.length) out.push(`${at}: empty page ${p.page}`)
    for (const b of p.blocks) {
      if (!b.segs.length) out.push(`${at}: empty block on p${p.page}`)
      for (const s of b.segs) {
        if ('t' in s) {
          if (!s.t) out.push(`${at}: empty text seg`)
        } else if ('rx' in s) {
          if (!u.reactions[s.rx]) out.push(`${at}: rx ${s.rx} out of range`)
          if (seenRx.has(s.rx)) out.push(`${at}: rx ${s.rx} placed twice`)
          seenRx.add(s.rx)
        } else {
          // a chip inside a longer word or formula («⟨KCl⟩O₃», «⟨H₂⟩CO₃»)
          const prev = b.segs[b.segs.indexOf(s) - 1]
          const nextSeg = b.segs[b.segs.indexOf(s) + 1]
          if ((nextSeg && 't' in nextSeg && /^[\p{L}\d₀-₉(]/u.test(nextSeg.t)) || (prev && 't' in prev && /[\p{L}\d₀-₉]$/u.test(prev.t))) {
            out.push(`${at}: sub ${u.substances[s.sub]?.nameRu} glued to text on p${p.page}`)
          }
          if (!u.substances[s.sub]) out.push(`${at}: sub ${s.sub} out of range`)
          if (seenSub.has(s.sub)) out.push(`${at}: sub ${s.sub} placed twice`)
          seenSub.add(s.sub)
        }
      }
    }
  }
  const lastBlock = u.pages[u.pages.length - 1]?.blocks.at(-1)
  if (lastBlock?.kind === 'h' && lastBlock.segs.some((s) => 't' in s && CHAPTER_HEAD_RE.test(s.t))) out.push(`${at}: ends with a chapter heading`)
  u.reactions.forEach((r, i) => {
    if (!seenRx.has(i)) out.push(`${at}: reaction ${r.id} not visible`)
    if (r.exercise && r.asInBook === '') out.push(`${at}: ${r.id} empty exercise text`)
    if (r.lab.ok) {
      const params = parseReactorLinkParams(new URLSearchParams(r.lab.href.split('?')[1] ?? ''))
      if (!params) out.push(`${at}: ${r.id} lab href does not parse`)
      else {
        if (params.backHref !== readerUnitHref(`g${grade}`, u.unitId, { rx: r.id, page: u.pageStart })) out.push(`${at}: ${r.id} back link ${params.backHref}`)
        const res = resolveReactorEquation(params.spec)
        if (!res.ok) out.push(`${at}: ${r.id} lab href no longer resolves (${res.code})`)
      }
    }
  })
  for (const s of u.substances) {
    if (s.catalogId && !compoundById[s.catalogId]) out.push(`${at}: unknown catalogId ${s.catalogId}`)
    if (s.organicId && !organicMoleculeById[s.organicId]) out.push(`${at}: unknown organicId ${s.organicId}`)
  }
  return out
}

function dumpUnit(u: FullUnit) {
  console.log(`\n══ ${u.unitId} · §${u.kp} ${u.title} (pp. ${u.pageStart}–${u.pageEnd}) · ${u.chapterId} ${u.chapterTitle}`)
  for (const p of u.pages) {
    console.log(`\n--- page ${p.page}`)
    for (const b of p.blocks) {
      const text = b.segs
        .map((s) => ('t' in s ? s.t : 'rx' in s ? `⟦${u.reactions[s.rx]!.equation}⟧` : `⟨${u.substances[s.sub]!.nameRu}⟩`))
        .join('')
      console.log(`[${b.kind}] ${text}`)
    }
  }
  console.log('\nreactions:')
  for (const r of u.reactions) console.log(`  ${r.id} p${r.page} ${r.equation}  lab=${r.lab.ok ? r.lab.href : `${r.lab.reason}${r.lab.altHref ? ` alt ${r.lab.altHref}` : ''}`}`)
  console.log('substances:', u.substances.map((s) => `${s.nameRu}[${s.catalogId ?? s.organicId ?? s.elementSymbol}]`).join(', '))
}

// ═════════════════════════════ main ═════════════════════════════

const t0 = Date.now()
addKnownFormulas(await appFormulas())
const PARAS = new Map<Grade, Para[]>()
for (const g of GRADES) PARAS.set(g, g === 11 ? loadOcrParagraphs() : loadLayoutParagraphs(g))
for (const g of GRADES) {
  for (const p of PARAS.get(g)!) for (const w of p.text.toLowerCase().match(/[а-яё]+/g) ?? []) VOCAB.set(w, (VOCAB.get(w) ?? 0) + 1)
}
for (const [w, n] of VOCAB) if (w.length >= 5) STEM_VOCAB.set(stemRussian(w), (STEM_VOCAB.get(stemRussian(w)) ?? 0) + n)
for (const g of GRADES) {
  for (const p of PARAS.get(g)!) {
    if (p.heading) continue
    for (const m of p.text.matchAll(/(?:^|([.!?:»"]?)\s+)([А-ЯЁа-яё][а-яё]{2,})(?![А-ЯЁа-яё])/g)) {
      const w = m[2]!
      const low = w.toLowerCase()
      if (w === low) VOCAB_LOWER.set(low, (VOCAB_LOWER.get(low) ?? 0) + 1)
      else if (g !== 8 && g !== 9 && m.index! > 0 && !m[1]) VOCAB_CAPMID.set(low, (VOCAB_CAPMID.get(low) ?? 0) + 1)
    }
  }
}
console.log(`[book] page text loaded (${((Date.now() - t0) / 1000).toFixed(1)}s)`)

const rows: string[] = []
const problems: string[] = []
for (const grade of GRADES) {
  if (ONLY_GRADE && ONLY_GRADE !== grade) continue
  const tg = Date.now()
  const paras = PARAS.get(grade)!
  const sizes = medianSize(paras)
  const detected = detectSections(grade, paras)
  const inv = readJson<Inventory>(`src/data/textbook/inventory-g${grade}.json`)
  const stats: GradeStats = {
    units: 0, pages: 0, blocks: 0, chars: 0, reactions: 0, inline: 0, appended: 0, exercises: 0, labOk: 0,
    labByReason: new Map(), substances: 0, substancesPlaced: 0, fallbackUnits: [], emptyUnits: [],
  }
  const units: FullUnit[] = []
  const ids = new Set<string>()
  const drafts: UnitDraft[] = []
  for (const sec of inv.sections) {
    const unitId = unitIdFor(grade, sec)
    if (ids.has(unitId)) throw new Error(`g${grade}: duplicate unitId ${unitId}`)
    ids.add(unitId)
    const key = grade === 8 || grade === 9 ? String(sec.kp) : String(sec.sectionId)
    const found = detected.get(key)
    let draft = found ? buildDraftBlocks(grade, paras, found.paras, sizes, sec.title) : []
    if (!draft.some((b) => b.kind !== 'h' && b.text.length > 40)) {
      const fb = blocksFromCorpus(grade, unitId, sec)
      if (fb.length) {
        draft = fb
        stats.fallbackUnits.push(unitId)
      }
    }
    drafts.push({ sec, unitId, draft })
  }
  fixUnitBoundaries(grade, drafts)
  for (const { sec, unitId, draft } of drafts) {
    const unit = buildUnit(grade, sec, draft, stats)
    if (!unit.pages.some((p) => p.blocks.some((b) => b.segs.some((s) => 't' in s && s.t.length > 20)))) stats.emptyUnits.push(unitId)
    problems.push(...validateUnit(grade, unit))
    units.push(unit)
    if (DUMP_UNIT && DUMP_UNIT === unitId) dumpUnit(unit)
  }
  stats.units = units.length
  // lightweight output: pages and substances are dropped (the PDF viewer shows the book itself)
  // Only real equations reach the panel: no word schemes («крахмал + I₂ → синее окрашивание»),
  // no general schemes, no exercises without the book's text, no duplicates within a grade.
  const seenEq = new Set<string>()
  const formulaSide = /[A-Z][a-z]?[₀-₉0-9]*/
  const keepReaction = (r: ReaderReaction): boolean => {
    if (r.isGeneralScheme && !SHOWN_SCHEMES.has(r)) return false
    if (r.exercise && !r.asInBook) return false
    const body = r.equation.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ')
    if (/[А-Яа-яЁё]{3,}/.test(body)) return false
    const m = body.split(/→|⇄|⇌|=|->/)
    if (m.length < 2 || !formulaSide.test(m[0]!) || !formulaSide.test(m[m.length - 1]!)) return false
    if (/не идёт|не идет|\?/.test(r.equation)) return false
    const k = r.equationAscii.replace(/\s+/g, '').toLowerCase()
    if (seenEq.has(k)) return false
    seenEq.add(k)
    return true
  }
  let dropped = 0
  const slim: ReaderUnit[] = units.map(({ pages: _pages, substances: _subs, ...u }) => {
    const kept = u.reactions.filter(keepReaction)
    dropped += u.reactions.length - kept.length
    return { ...u, reactions: kept }
  })
  console.log(`g${grade}: reactions kept ${slim.reduce((n, u) => n + u.reactions.length, 0)}, dropped ${dropped}`)
  const body: ReaderGrade = { grade, gradeId: `g${grade}`, generatedAt: new Date().toISOString(), units: slim }
  const file = path.join(OUT_DIR, `equations-g${grade}.json`)
  const json = JSON.stringify(body)
  fs.writeFileSync(file, json + '\n')
  const kb = (Buffer.byteLength(json, 'utf8') / 1024).toFixed(0)
  const reasons = [...stats.labByReason.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')
  console.log(
    `[book] g${grade}: ${stats.units} units, ${stats.pages} pages, ${stats.blocks} blocks, ${(stats.chars / 1000).toFixed(0)}k chars, ` +
      `reactions ${stats.reactions} (inline ${stats.inline}, appended ${stats.appended}, exercises ${stats.exercises}; lab ok ${stats.labOk}: ${reasons}), ` +
      `substances ${stats.substances} (placed ${stats.substancesPlaced}) → equations-g${grade}.json ${kb} KB (${((Date.now() - tg) / 1000).toFixed(1)}s)`,
  )
  if (stats.fallbackUnits.length) console.log(`        corpus fallback: ${stats.fallbackUnits.join(', ')}`)
  if (stats.emptyUnits.length) console.log(`        ⚠ units without text: ${stats.emptyUnits.join(', ')}`)
  rows.push(
    `| g${grade} | ${stats.units} | ${stats.pages} | ${stats.reactions} | ${stats.inline} | ${stats.labOk} | ${stats.substances} / ${stats.substancesPlaced} | ${kb} KB |`,
  )
}
console.log('\n| grade | units | pages | reactions | inline | lab ok | substances / placed | size |')
console.log('|---|---|---|---|---|---|---|---|')
for (const r of rows) console.log(r)
console.log(`\nlab reasons (all): ${[...labReasonCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`)
console.log(`[book] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems.slice(0, 60)) console.error(`  ✗ ${p}`)
  process.exitCode = 1
}
