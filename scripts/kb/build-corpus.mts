/**
 * KB-1: textbook corpus (grades 7–11) + reference cards + quiz items + glossary + stats.
 *
 * Reads the extraction caches (scripts/kb/.cache: pdfjs lines for grades 7–10 — `npm run kb:extract`,
 * tesseract OCR pages for grade 11 — `npm run kb:ocr11`), cleans the text (lib/pages.mts, lib/textRepair.mts),
 * finds section boundaries, chunks every section on paragraph/sentence boundaries (700–1100 chars, ~12 % overlap,
 * never across sections), extracts definition and summary ("Основные понятия", "Изучаемые понятия", "Элементы ЗУН",
 * "Выводы", "Запомните!") chunks, and generates cards from app data (lib/cards.mts).
 *
 * Section ids use the APP's ids (src/data/g{N}BookToc.json → chapterId "c2", sectionId "s03"), so the teacher can
 * boost the lesson the student has open. Grades 8/9: the app TOC is a curriculum estimate that does not match the
 * printed book, so the real "§ N" headings are detected in the text and mapped onto app sections
 * (data/sectionMapG8G9.mts); `kp` keeps the printed § number for citations. Grades 7/10/11: `kp` = "chapter.topic"
 * (7, 10) or the § number (11), section starts are located in the text near the TOC page.
 *
 * Output (src/data/kb/corpus/, compact JSON):
 *   kb-corpus-g{7..11}.json, kb-corpus-common.json   { version, shard, generatedAt, count, chunks: KbChunk[] }
 *   kb-quiz.json                                      same wrapper; quiz items ru/en/uz (NOT picked up by build-index:
 *                                                     quiz questions are the retrieval evaluation set)
 *   kb-glossary.json                                  { version, count, entries: GlossaryEntry[] }
 *   kb-sections.json                                  detected sections / mapping (for review)
 *   kb-stats.json                                     per-grade counts, chunk sizes, empty-section and garbling checks
 *
 * Usage: npx tsx scripts/kb/build-corpus.mts [--strict]   (npm run kb:corpus; --strict exits 1 when checks fail)
 */
import fs from 'node:fs'
import path from 'node:path'
import { analyzeTerms, foldText } from '../../src/learn/kb/analyzer.ts'
import { stemRussian } from '../../src/learn/kb/stemRu.ts'
import { SECTION_MAP } from './data/sectionMapG8G9.mts'
import { appFormulas, buildCards, buildQuizChunks, type CorpusChunk } from './lib/cards.mts'
import { buildGlossary } from './lib/glossary.mts'
import { OCR_PAGE_STATS, letterRatio, loadLayoutParagraphs, loadOcrParagraphs, repairJoinedOcr, type Para } from './lib/pages.mts'
import { addKnownFormulas, capitalizeSentences, knownFormulaCount, parseFormula, registerPageFormulas, segmentGlued } from './lib/textRepair.mts'
import { INVENTORY_GRADES, inventoryFormulas, inventoryPageFormulas } from './lib/textbookInventory.mts'
import { buildBookIndex } from './lib/bookIndex.mts'
import { countGarbled } from './textClean.mjs'

export type { CorpusChunk }

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const OUT = path.join(ROOT, 'src', 'data', 'kb', 'corpus')
const STRICT = process.argv.includes('--strict')
fs.mkdirSync(OUT, { recursive: true })

type TocEntry = { ch: number; sec: number; kp?: number; page: number; titleRu: string }
const readJson = <T,>(p: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')) as T

const pad2 = (n: number) => String(n).padStart(2, '0')
const SOURCE = (g: number) => `Kimyo ${g}`
const GRADES = [7, 8, 9, 10, 11]

const PARAS = new Map<number, Para[]>()
function paragraphs(grade: number): Para[] {
  let p = PARAS.get(grade)
  if (!p) {
    p = grade === 11 ? loadOcrParagraphs() : loadLayoutParagraphs(grade)
    PARAS.set(grade, p)
  }
  return p
}

function termSet(text: string): Set<string> {
  return new Set(analyzeTerms(text).filter((t) => t.length > 1))
}

function tidyTitle(t: string): string {
  let s = capitalizeProperNouns(fixTitleCase(foldText(t).replace(/\s+/g, ' ').trim()))
  const letters = s.replace(/[^А-Яа-яA-Za-z]/g, '')
  const upper = letters.replace(/[^А-ЯA-Z]/g, '').length
  // "ПеРиоДичесКий заКоН" (broken small caps) / ALL CAPS → sentence case
  if (letters.length > 3 && (upper / letters.length > 0.6 || /[а-яa-z][А-ЯA-Z]/.test(s))) {
    s = s.toLowerCase().replace(/(^|[.!?]\s+)([а-яa-z])/g, (_m, a: string, b: string) => a + b.toUpperCase())
  }
  s = s.replace(/^[\s.:–—-]+|[\s.:–—-]+$/g, '').replace(/([.!?]\s+)([а-яё])/g, (_m, a: string, b: string) => a + b.toUpperCase())
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function sentenceCase(s: string): string {
  const low = s.toLowerCase()
  return low.charAt(0).toUpperCase() + low.slice(1)
}

/**
 * Grades 8/9 headings capitalise common nouns ("Химическое Равновесие", "Виды Химической связи"): lower-case a
 * capitalised word that is not sentence-initial when the books use it in lower case far more often than capitalised.
 */
function fixTitleCase(text: string): string {
  return text.replace(/(?<=[^.!?\s][ \t]+)([А-ЯЁ][а-яё]{2,})(?![а-яёА-ЯЁ])/g, (w: string) => {
    const low = w.toLowerCase()
    const lowerUses = VOCAB_LOWER.get(low) ?? 0
    const capUses = VOCAB_CAPMID.get(low) ?? 0
    return lowerUses >= 3 && capUses <= lowerUses * 0.25 ? low : w
  })
}

/** Grades 8/9 lose capitals of proper nouns ("закон авогадро"): capitalise words the other books always capitalise. */
function capitalizeProperNouns(text: string): string {
  return text.replace(/(?<![А-Яа-яЁё])([а-яё]{4,})(?![А-Яа-яЁё])/g, (w: string) => {
    const capUses = VOCAB_CAPMID.get(w) ?? 0
    const lowerUses = VOCAB_LOWER.get(w) ?? 0
    return capUses >= 3 && lowerUses <= capUses * 0.1 ? w.charAt(0).toUpperCase() + w.slice(1) : w
  })
}

/** First page of the end matter (contents, answers, imprint) — text from there on belongs to no section. */
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

/** Grades 8/9: the practical / laboratory works printed after the last §. */
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
  return { kp: 'lab', title: 'Практические и лабораторные работы', page: paras[i].page, y: paras[i].y - 1, paras: [] }
}

/** A detected textbook section: starts at (page, y); owns every paragraph up to the next start. */
type Section = {
  chapterId?: string
  sectionId?: string
  kp: string
  title: string
  page: number
  y: number
  paras: number[]
}

const before = (aPage: number, aY: number, bPage: number, bY: number) => aPage < bPage || (aPage === bPage && aY <= bY + 2)

/** Assign paragraphs to sections by position (page, y), which survives column/side-box reading order. */
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

/** TOC-driven section starts (grades 7, 10, 11: TOC page numbers match the PDF). */
function sectionsFromToc(grade: number, paras: Para[], toc: TocEntry[], marker: RegExp): Section[] {
  const out: Section[] = []
  let prevPage = 0
  let prevY = -1
  toc.forEach((e, idx) => {
    const title = termSet(e.titleRu)
    let best = -1
    let bestScore = 0
    for (let i = 0; i < paras.length; i += 1) {
      const p = paras[i]
      if (p.page < e.page - 1 || p.page > e.page + 1) continue
      if (!before(prevPage, prevY + 3, p.page, p.y)) continue
      const head = termSet(p.text.slice(0, 200) + ' ' + (p.text.length < 90 ? (paras[i + 1]?.text.slice(0, 100) ?? '') : ''))
      let hit = 0
      for (const t of title) if (head.has(t)) hit += 1
      let score = title.size ? hit / title.size : 0
      if (p.heading) score += 0.25
      if (marker.test(p.text.slice(0, 60))) score += 0.9
      if (/^\d{1,2}\s*[.)]\s/.test(p.text)) score -= 0.6 // numbered exercise
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
      // a title set on two lines can come out as two paragraphs ("Молекула. Относительная молекулярная" + "масса"):
      // start at the upper part when it sits right above and carries title words
      for (let k = best - 1; k >= 0 && k >= best - 2; k -= 1) {
        const up = paras[k]
        const cur = paras[k + 1]
        if (up.page !== cur.page || cur.y - up.y > 40 || cur.y < up.y || up.text.length > 120) break
        if (![...termSet(up.text)].some((t) => title.has(t))) break
        if (!before(prevPage, prevY + 3, up.page, up.y)) break
        best = k
      }
      page = paras[best].page
      y = paras[best].y
    }
    // heading near the top of its page with only a key-concepts box / short lines above it: the page belongs to it
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

/** Grades 8/9: the real "§ N" headings (title lines sit next to the marker, above or below it). */
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
    // title lines sit right next to the marker; headings further up (chapter titles) only move the section start
    const titleNear = near
      .filter((x) => Math.abs(x.q.y - p.y) <= 32)
      .sort((a, b) => Math.abs(a.q.y - p.y) - Math.abs(b.q.y - p.y))
      .slice(0, 2)
      .sort((a, b) => a.q.y - b.q.y)
    const titleParts = [m[2], ...(titleNear.length ? titleNear : near.slice(0, 1)).map((x) => x.q.text)].filter((s) => s && s.length > 2)
    const y = Math.min(p.y, ...near.slice(0, 3).map((x) => x.q.y))
    // continuation lines start in lower case; ALL-CAPS parts ("НЕМЕТАЛЛЫ. ГРУППА УГЛЕРОДА") → sentence case;
    // stop before the title turns into body text
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

// ---------------------------------------------------------------- chunking

const CHUNK = { target: 900, max: 1100, min: 700, unitMax: 550, overlap: 0.12, tailMin: 350 }

const SENT_RE = /[^.!?…]+(?:[.!?…]+|$)/g

function splitSentences(text: string): string[] {
  return (text.match(SENT_RE) ?? [text]).map((s) => s.trim()).filter(Boolean)
}

type Unit = { text: string; page: number }

/** Split a paragraph longer than unitMax on sentence (then word) boundaries. */
function splitUnit(u: Unit): Unit[] {
  if (u.text.length <= CHUNK.unitMax) return [u]
  const pieces: string[] = []
  for (const s of splitSentences(u.text)) {
    if (s.length <= CHUNK.max) pieces.push(s)
    else {
      let buf = ''
      for (const w of s.split(/\s+/)) {
        if (buf && buf.length + w.length + 1 > CHUNK.target) {
          pieces.push(buf)
          buf = ''
        }
        buf = buf ? `${buf} ${w}` : w
      }
      if (buf) pieces.push(buf)
    }
  }
  const out: Unit[] = []
  let buf = ''
  for (const s of pieces) {
    if (buf && buf.length + s.length + 1 > CHUNK.unitMax) {
      out.push({ text: buf, page: u.page })
      buf = ''
    }
    buf = buf ? `${buf} ${s}` : s
  }
  if (buf) out.push({ text: buf, page: u.page })
  return out
}

/** ~12 % of the chunk carried into the next one: whole trailing sentences when short enough, else trailing words. */
function overlapTail(text: string): string {
  const want = Math.max(60, Math.round(text.length * CHUNK.overlap))
  const sents = splitSentences(text.split('\n').pop() ?? text)
  let tail = ''
  for (let i = sents.length - 1; i >= 0; i -= 1) {
    const cand = tail ? `${sents[i]} ${tail}` : sents[i]
    if (cand.length > want * 1.9) break
    tail = cand
    if (tail.length >= want * 0.7) break
  }
  if (tail.length >= want * 0.5) return tail
  const words = text.split(/\s+/)
  let t = ''
  for (let i = words.length - 1; i >= 0 && t.length < want; i -= 1) t = t ? `${words[i]} ${t}` : words[i]
  return `…${t}`
}

type Packed = { text: string; pageStart: number; pageEnd: number; overlap: number }

function packChunks(input: Unit[], target: number = CHUNK.target): Packed[] {
  const units = input.flatMap(splitUnit)
  const out: Packed[] = []
  let cur: string[] = []
  let len = 0
  let fresh = 0
  let carried = 0
  let pStart = 0
  let pEnd = 0
  const flush = () => {
    const text = cur.join('\n')
    out.push({ text, pageStart: pStart, pageEnd: pEnd, overlap: carried })
    const tail = overlapTail(text)
    cur = [tail]
    len = tail.length
    carried = tail.length
    fresh = 0
    pStart = pEnd
  }
  for (const u of units) {
    if (fresh > 0 && (len + u.text.length + 1 > CHUNK.max || len >= target)) flush()
    if (fresh === 0 && carried === 0) pStart = u.page
    cur.push(u.text)
    len += u.text.length + 1
    fresh += u.text.length
    pEnd = u.page
  }
  if (fresh > 0) {
    const last = out[out.length - 1]
    const freshText = cur.slice(carried ? 1 : 0).join('\n')
    if (last && fresh < CHUNK.tailMin && last.text.length + freshText.length + 1 <= CHUNK.max + 150) {
      last.text = `${last.text}\n${freshText}`
      last.pageEnd = pEnd
    } else {
      out.push({ text: cur.join('\n'), pageStart: pStart, pageEnd: pEnd, overlap: carried })
    }
  }
  return out
}

/**
 * Pack with a few fill targets around CHUNK.target and keep the split whose chunk lengths stay closest to
 * [min, max] (a short section tail otherwise becomes a tiny chunk or an oversized merge).
 */
function packBalanced(units: Unit[]): Packed[] {
  let best: Packed[] = []
  let bestCost = Infinity
  for (const target of [900, 860, 940, 820, 980, 780, 1020]) {
    const packed = packChunks(units, target)
    const cost = packed.reduce((s, c) => s + Math.max(0, c.text.length - CHUNK.max) * 2 + Math.max(0, CHUNK.min - 100 - c.text.length), 0)
    if (cost < bestCost - 1e-9) {
      best = packed
      bestCost = cost
    }
    if (cost === 0) break
  }
  return best
}

/** Re-join sentences that PDF layout split into separate paragraphs. */
function mergeBroken(units: Unit[]): Unit[] {
  const out: Unit[] = []
  for (const u of units) {
    const prev = out[out.length - 1]
    if (prev && (prev.page === u.page || prev.page + 1 === u.page)) {
      if (/[а-яa-z]-$/i.test(prev.text) && /^[а-яa-z]/.test(u.text)) {
        prev.text = prev.text.slice(0, -1) + u.text
        continue
      }
      if (!/[.!?:;»")]$/.test(prev.text) && /^[а-яa-z(]/.test(u.text) && prev.text.length + u.text.length < 1400) {
        prev.text = `${prev.text} ${u.text}`
        continue
      }
    }
    out.push({ ...u })
  }
  return out
}

const NOT_LETTER = String.raw`(?![А-Яа-яЁёA-Za-z])`
const DEF_RE = new RegExp(String.raw`(называ(ется|ются|ют)|\s[—–-]\s*это${NOT_LETTER}|принято называть|определяется как|понимают\s)`, 'i')

function definitionSentences(texts: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of texts) {
    for (const s of splitSentences(t)) {
      if (s.length < 35 || s.length > 420 || !DEF_RE.test(s)) continue
      if (letterRatio(s) < 0.75 || /\?$/.test(s)) continue
      const key = s.toLowerCase().replace(/\s+/g, ' ')
      if (seen.has(key)) continue
      seen.add(key)
      out.push(s)
    }
  }
  return out
}

/** The defined term of a definition sentence ("Оксиды — это …", "… называются оксидами"). */
function definedTerm(s: string): string | null {
  const a = /^([А-ЯЁA-Z][^,:;—–]{2,60}?)\s[—–-]\s*(это\s)?/.exec(s)
  if (a && a[1].split(/\s+/).length <= 6) return a[1].trim()
  const b = /называ(?:ется|ются|ют)\s+([^,.;:()]{3,60})/i.exec(s)
  if (b && b[1].split(/\s+/).length <= 5) return b[1].trim()
  return null
}

const SUMMARY_RE = new RegExp(
  String.raw`^[!•*?\s]*(основные понятия|изучаемые понятия|закрепляемые понятия|элементы зун|выводы?|запомните|помните|это важно|обобщение знаний)${NOT_LETTER}[:!.]?`,
  'i',
)

function usable(p: Para): boolean {
  if (p.text.length < 3) return false
  const lr = letterRatio(p.text)
  const equation = /[A-Z][a-z]?\d*/.test(p.text) && /(=|→|⇄|->|—>)/.test(p.text)
  if (lr < (equation ? 0.3 : 0.55)) return false
  if (/^(§\s*\d+|\d+\s*-\s*тема|TEMA\s*\d+\.?)$/i.test(p.text.trim())) return false
  if (/сведения о состоянии арендного учебника|таблица заполняется классным руководителем|состояние учебника|фамилия учащегося|удовлетво-? ?рительное/i.test(p.text)) return false
  return true
}

const VOCAB = new Map<string, number>()
const STEM_VOCAB = new Map<string, number>()
/** lower-case uses / capitalised mid-sentence uses per lower-cased word (for heading case repair) */
const VOCAB_LOWER = new Map<string, number>()
const VOCAB_CAPMID = new Map<string, number>()

/** Join Cyrillic word fragments split by letter-spacing when the joined word is common in the books. */
function repairSplitWords(text: string): string {
  // words at odd indices, separators (spaces, punctuation, formulas) at even ones: "кар бонаты," joins too
  const parts = text.split(/([А-Яа-яЁё]+)/)
  const out: string[] = []
  const freq = (w: string) => VOCAB.get(w.toLowerCase()) ?? 0
  const accept = (joined: string, first: string, last: string) => {
    const jf = freq(joined)
    if (jf >= 3 && jf > Math.min(freq(first), freq(last))) return true
    const sf = STEM_VOCAB.get(stemRussian(joined.toLowerCase())) ?? 0
    return sf >= 5 && freq(last) <= Math.max(2, sf / 20)
  }
  let i = 0
  while (i < parts.length) {
    let word = parts[i]
    if (/^[А-Яа-яЁё]+$/.test(word)) {
      // absorb following fragments ("табл и ц ы", "ги д рокарбонаты"): longest acceptable run of up to 4 first
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
          if (accept(word + frags.slice(0, n).join(''), word, frags[n - 1])) {
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

/** A rare word form whose stem is common in the books is a real word, not glued words. */
function knownByStem(low: string): boolean {
  return (STEM_VOCAB.get(stemRussian(low)) ?? 0) >= 3
}

/** Uzbek (Latin script) sentences left over from bilingual pages ("Bu varaq hali to‘liq quruq emas."). */
function dropLatinProse(text: string): string {
  return text
    .replace(/[^.!?\n]+[.!?]*/g, (s) => {
      const words = s.match(/[A-Za-zА-Яа-яЁё‘’']{3,}/g) ?? []
      const latin = words.filter((w) => /^[A-Za-z‘’']+$/.test(w) && /[a-z]{2}/.test(w) && !parseFormula(w)).length
      // Uzbek markers (o‘/g‘, q/x in words, frequent function words): keeps Latin element names and formula rows
      const uzbek = /[oOgG][‘’']|[a-z]*[qx][a-z]*|(?<![A-Za-z])(va|bilan|uchun|mumkin|emas|bu|ham|yoki|ta|uni|biz)(?![A-Za-z])/.test(s)
      const drop = uzbek && words.length >= 4 && latin / words.length > 0.6
      if (drop && process.env.KB_DEBUG_LATIN) console.log('[latin-prose]', JSON.stringify(s.slice(0, 160)))
      return drop ? ' ' : s
    })
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

type Assign = (text: string) => { chapterId?: string; sectionId?: string }

type SectionResult = { chunks: CorpusChunk[]; overlapRatios: number[] }

function sectionUnits(grade: number, paras: Para[], sec: Section): Unit[] {
  let units = mergeBroken(
    sec.paras
      .map((i) => paras[i])
      .filter(usable)
      .map((p) => ({ text: p.heading && (grade === 8 || grade === 9) ? fixTitleCase(p.text) : p.text, page: p.page })),
  ).map((u) => ({ ...u, text: dropLatinProse(segmentGlued(repairSplitWords(u.text), (w) => VOCAB.get(w) ?? 0, knownByStem)) }))
    .filter((u) => u.text.length > 0)
  if (grade === 8 || grade === 9) units = units.map((u) => ({ ...u, text: capitalizeProperNouns(capitalizeSentences(u.text)) }))
  // OCR paragraphs re-joined across a hyphen: the halves may only now form a word ("Be-" + "щества")
  if (grade === 11) units = units.map((u) => ({ ...u, text: repairJoinedOcr(u.text) }))
  return units
}

function summaryText(grade: number, paras: Para[], sec: Section): { text: string; pageStart: number; pageEnd: number } | null {
  const idx = sec.paras
  const parts: { text: string; page: number }[] = []
  const used = new Set<number>()
  idx.forEach((pi, k) => {
    const p = paras[pi]
    if (used.has(pi) || !SUMMARY_RE.test(p.text)) return
    used.add(pi)
    const own = p.text.replace(SUMMARY_RE, '').trim()
    const label = SUMMARY_RE.exec(p.text)![1]
    let body = own
    // heading-only marker: take the following box paragraphs
    for (let j = k + 1; j < idx.length && body.length < 600; j += 1) {
      if (own.length > 40) break
      const q = paras[idx[j]]
      if (q.page !== p.page || q.heading || SUMMARY_RE.test(q.text) || !usable(q)) break
      used.add(idx[j])
      body = body ? `${body} ${q.text}` : q.text
    }
    if (body.replace(/[•;:.,\s]/g, '').length < 30) return
    const labelText = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()
    parts.push({ text: `${labelText.replace(/зун/i, 'ЗУН')}: ${body.replace(/^[:!.\s]+/, '')}`, page: p.page })
  })
  if (!parts.length) return null
  let text = ''
  for (const part of parts) {
    const repaired = dropLatinProse(segmentGlued(repairSplitWords(part.text), (w) => VOCAB.get(w) ?? 0, knownByStem))
    const t = grade === 8 || grade === 9 ? capitalizeSentences(repaired) : grade === 11 ? repairJoinedOcr(repaired) : repaired
    if (text && text.length + t.length > CHUNK.max) break
    text = text ? `${text}\n${t}` : t
  }
  if (text.length > CHUNK.max) text = text.slice(0, CHUNK.max).replace(/\s+\S*$/, '') + '…'
  return { text, pageStart: parts[0].page, pageEnd: parts[parts.length - 1].page }
}

function sectionChunks(grade: number, paras: Para[], sec: Section, idPrefix: string, assign: Assign): SectionResult {
  const units = sectionUnits(grade, paras, sec)
  const chunks: CorpusChunk[] = []
  const overlapRatios: number[] = []
  const base = (text: string) => {
    const ids = assign(text)
    return { grade, chapterId: ids.chapterId, sectionId: ids.sectionId, kp: sec.kp, lang: 'ru' as const, source: SOURCE(grade) }
  }
  packBalanced(units).forEach((c, n) => {
    if (n > 0) overlapRatios.push(c.overlap / c.text.length)
    chunks.push({
      id: `${idPrefix}-t${pad2(n + 1)}`,
      ...base(c.text),
      title: sec.title,
      pageStart: c.pageStart,
      pageEnd: c.pageEnd,
      type: 'textbook',
      text: c.text,
    })
  })
  // definitions: small groups (≤ 450 chars) titled with the defined terms
  const defs = definitionSentences(units.map((t) => t.text))
  const groups: string[][] = []
  for (const d of defs) {
    const g = groups[groups.length - 1]
    if (g && g.join(' ').length + d.length < 450) g.push(d)
    else groups.push([d])
  }
  const pageOf = (s: string) => units.find((u) => u.text.includes(s.slice(0, 40)))?.page ?? units[0]?.page
  groups.forEach((g, n) => {
    const terms = [...new Set(g.map(definedTerm).filter((t): t is string => !!t))]
    const text = g.join('\n')
    chunks.push({
      id: `${idPrefix}-d${pad2(n + 1)}`,
      ...base(text),
      title: `${sec.title}: ${terms.length ? terms.join(', ').slice(0, 90) : 'определения'}`,
      pageStart: pageOf(g[0]),
      pageEnd: pageOf(g[g.length - 1]),
      type: 'definition',
      text,
    })
  })
  const sum = summaryText(grade, paras, sec)
  if (sum) {
    chunks.push({
      id: `${idPrefix}-sum`,
      ...base(sum.text),
      title: `${sec.title}: главное`,
      pageStart: sum.pageStart,
      pageEnd: sum.pageEnd,
      type: 'summary',
      text: sum.text,
    })
  }
  return { chunks, overlapRatios }
}

// ---------------------------------------------------------------- per grade

const sectionsReport: Record<string, unknown> = {}
const gradeStats: Record<string, unknown> = {}
const problems: string[] = []
const TOC_MARKERS: Record<number, RegExp> = {
  7: /\d+\s*-\s*тема/i,
  10: /(TEMA|ТЕМА)\s*\d+/i,
  11: /(^|\s)(\d{1,2}\s*-?\s*§|§\s*\d{1,2}\b)/,
}

function quantiles(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  const q = (p: number) => (s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0)
  return { min: s[0] ?? 0, p10: q(0.1), p50: q(0.5), p90: q(0.9), max: s[s.length - 1] ?? 0 }
}

function mixedScriptWords(text: string): number {
  return (text.match(/[А-Яа-яЁё]+[A-Za-z]+[А-Яа-яЁёA-Za-z]*|[A-Za-z]+[А-Яа-яЁё]+[А-Яа-яЁёA-Za-z]*/g) ?? []).length
}

function buildGrade(grade: number): CorpusChunk[] {
  const paras = paragraphs(grade)
  const toc = readJson<TocEntry[]>(`src/data/g${grade}BookToc.json`)
  const chunks: CorpusChunk[] = []
  const overlapRatios: number[] = []
  const lastPage = Math.max(...paras.map((p) => p.page))
  const emptySections: string[] = []
  let sectionCount = 0

  if (grade === 8 || grade === 9) {
    const book = sectionsFromMarkers(paras)
    const endPage = endMatterPage(paras, lastPage)
    const lab = labSection(paras, book, endPage)
    if (lab) book.push(lab)
    assignParagraphs(paras, book, endPage)
    const titleById = new Map(toc.map((e) => [`c${e.ch}-s${pad2(e.sec)}`, e.titleRu]))
    // § number → app sections that list it (in app order)
    const owners = new Map<number, { chapterId: string; sectionId: string; terms: string[] }[]>()
    for (const [appId, nums] of Object.entries(SECTION_MAP[grade])) {
      const [chapterId, sectionId] = appId.split('-')
      const terms = [...termSet(titleById.get(appId) ?? '')]
      for (const n of nums) owners.set(n, [...(owners.get(n) ?? []), { chapterId, sectionId, terms }])
    }
    const perBook: { kp: string; title: string; page: number; paragraphs: number; chunks: number; appSections: string[] }[] = []
    for (const b of book) {
      const candidates = b.kp === 'lab' ? [] : (owners.get(Number(b.kp)) ?? [])
      const assign: Assign = (text) => {
        if (!candidates.length) return {}
        if (candidates.length === 1) return { chapterId: candidates[0].chapterId, sectionId: candidates[0].sectionId }
        const tf = new Map<string, number>()
        for (const t of analyzeTerms(text)) tf.set(t, (tf.get(t) ?? 0) + 1)
        let best = candidates[0]
        let bestS = 0
        for (const c of candidates) {
          let s = 0
          for (const t of c.terms) s += Math.log(1 + (tf.get(t) ?? 0))
          s /= Math.max(1, c.terms.length)
          if (s > bestS + 1e-9) {
            bestS = s
            best = c
          }
        }
        return { chapterId: best.chapterId, sectionId: best.sectionId }
      }
      const prefix = b.kp === 'lab' ? `g${grade}-lab` : `g${grade}-p${pad2(Number(b.kp))}`
      const r = sectionChunks(grade, paras, b, prefix, assign)
      chunks.push(...r.chunks)
      overlapRatios.push(...r.overlapRatios)
      sectionCount += 1
      const nText = r.chunks.filter((c) => c.type === 'textbook').length
      if (!nText) emptySections.push(`§${b.kp}`)
      perBook.push({
        kp: b.kp,
        title: b.title,
        page: b.page,
        paragraphs: b.paras.length,
        chunks: nText,
        appSections: candidates.map((c) => `${c.chapterId}-${c.sectionId}`),
      })
    }
    const counts = new Map<string, number>()
    for (const c of chunks) {
      if (!c.sectionId) continue
      const key = `${c.chapterId}-${c.sectionId}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    sectionsReport[`g${grade}`] = {
      book: perBook,
      appSections: toc.map((e) => {
        const id = `c${e.ch}-s${pad2(e.sec)}`
        return { id, title: e.titleRu, bookParagraphs: SECTION_MAP[grade][id] ?? [], chunks: counts.get(id) ?? 0 }
      }),
    }
  } else {
    const sections = sectionsFromToc(grade, paras, toc, TOC_MARKERS[grade])
    const endPage = Math.min(endMatterPage(paras, lastPage), toc[toc.length - 1].page + 9)
    assignParagraphs(paras, sections, endPage)
    const report: unknown[] = []
    for (const s of sections) {
      const r = sectionChunks(grade, paras, s, `g${grade}-${s.chapterId}-${s.sectionId}`, () => ({
        chapterId: s.chapterId,
        sectionId: s.sectionId,
      }))
      chunks.push(...r.chunks)
      overlapRatios.push(...r.overlapRatios)
      sectionCount += 1
      const nText = r.chunks.filter((c) => c.type === 'textbook').length
      if (!nText) emptySections.push(`${s.chapterId}-${s.sectionId}`)
      report.push({
        id: `${s.chapterId}-${s.sectionId}`,
        kp: s.kp,
        title: s.title,
        page: s.page,
        firstText: s.paras.length ? paras[s.paras[0]].text.slice(0, 80) : '',
        paragraphs: s.paras.length,
        chunks: nText,
      })
    }
    sectionsReport[`g${grade}`] = report
  }

  // ---- checks + stats
  const text = chunks.map((c) => c.text).join('\n')
  const garbled = countGarbled(text)
  const mixed = mixedScriptWords(text)
  const byType: Record<string, number> = {}
  for (const c of chunks) byType[c.type] = (byType[c.type] ?? 0) + 1
  const tb = chunks.filter((c) => c.type === 'textbook')
  const pages = new Set(paras.map((p) => p.page))
  const covered = new Set<number>()
  for (const c of tb) for (let p = c.pageStart ?? 0; p <= (c.pageEnd ?? -1); p += 1) covered.add(p)
  if (garbled > 0) problems.push(`g${grade}: ${garbled} Latin-1 look-alike chars (garbled cp1251 runs)`)
  if (emptySections.length) problems.push(`g${grade}: empty sections ${emptySections.join(', ')}`)
  const noSection = chunks.filter((c) => !c.sectionId).length
  gradeStats[`g${grade}`] = {
    source: SOURCE(grade),
    extraction: grade === 11 ? 'ocr (tesseract.js rus+eng)' : 'pdf text layer (pdfjs-dist)',
    pdfPagesWithText: pages.size,
    pagesCoveredByChunks: covered.size,
    ...(grade === 11
      ? { note: 'the grade 11 book has no summary/remember boxes (only "Вопросы и задания"), so no summary chunks', ocrMeanConfidence: Math.round(OCR_PAGE_STATS.reduce((s, p) => s + p.conf, 0) / Math.max(1, OCR_PAGE_STATS.length)), ocrPagesBelow80: OCR_PAGE_STATS.filter((p) => p.conf < 80).map((p) => p.page) }
      : {}),
    paragraphs: paras.length,
    sections: sectionCount,
    emptySections,
    chunks: chunks.length,
    byType,
    chunksWithoutAppSection: noSection,
    textbookChars: tb.reduce((s, c) => s + c.text.length, 0),
    allChars: text.length,
    textbookChunkLength: quantiles(tb.map((c) => c.text.length)),
    meanOverlapPct: Number(((overlapRatios.reduce((s, x) => s + x, 0) / Math.max(1, overlapRatios.length)) * 100).toFixed(1)),
    garbledLatin1Chars: garbled,
    mixedScriptWords: mixed,
  }
  return chunks
}

function writeFile(name: string, body: unknown) {
  const file = path.join(OUT, name)
  const json = JSON.stringify(body)
  fs.writeFileSync(file, json)
  return Buffer.byteLength(json)
}

const fileBytes: Record<string, number> = {}

function writeShard(name: string, chunks: CorpusChunk[], fileName = `kb-corpus-${name}.json`) {
  const ids = new Set<string>()
  for (const c of chunks) {
    if (ids.has(c.id)) throw new Error(`duplicate chunk id ${c.id}`)
    ids.add(c.id)
    if (!c.text.trim()) problems.push(`${name}: empty chunk ${c.id}`)
  }
  const body = { version: 2, shard: name, generatedAt: new Date().toISOString(), count: chunks.length, chunks }
  fileBytes[fileName] = writeFile(fileName, body)
  const chars = chunks.reduce((s, c) => s + c.text.length, 0)
  console.log(`[corpus] ${name}: ${chunks.length} chunks, ${(chars / 1000).toFixed(0)}k chars, ${(fileBytes[fileName] / 1024).toFixed(0)} KB → ${fileName}`)
}

const t0 = Date.now()
addKnownFormulas(await appFormulas())
console.log(`[corpus] known formulas from app data: ${knownFormulaCount()}`)
// r10: formulas printed in the books (verified inventory) — known formulas + same-page prior for the formula repair
addKnownFormulas(inventoryFormulas())
for (const g of INVENTORY_GRADES) registerPageFormulas(g, inventoryPageFormulas(g))
console.log(`[corpus] + textbook inventory formulas: ${knownFormulaCount()}`)
for (const g of GRADES) {
  const t = Date.now()
  paragraphs(g)
  console.log(`[corpus] g${g}: ${PARAS.get(g)!.length} paragraphs (${((Date.now() - t) / 1000).toFixed(1)}s)`)
}
// vocabulary for re-joining letter-spaced words ("про мышленности" → "промышленности")
for (const g of GRADES) {
  for (const p of paragraphs(g)) for (const w of p.text.toLowerCase().match(/[а-яё]+/g) ?? []) VOCAB.set(w, (VOCAB.get(w) ?? 0) + 1)
}
for (const [w, n] of VOCAB) if (w.length >= 5) STEM_VOCAB.set(stemRussian(w), (STEM_VOCAB.get(stemRussian(w)) ?? 0) + n)
// lower-case uses from every book; capitalised mid-sentence uses only from books with reliable casing (7, 10, 11)
for (const g of GRADES) {
  for (const p of paragraphs(g)) {
    if (p.heading) continue
    for (const m of p.text.matchAll(/(?:^|([.!?:»"]?)\s+)([А-ЯЁа-яё][а-яё]{2,})(?![А-ЯЁа-яё])/g)) {
      const w = m[2]
      const low = w.toLowerCase()
      if (w === low) VOCAB_LOWER.set(low, (VOCAB_LOWER.get(low) ?? 0) + 1)
      else if (g !== 8 && g !== 9 && m.index > 0 && !m[1]) VOCAB_CAPMID.set(low, (VOCAB_CAPMID.get(low) ?? 0) + 1)
    }
  }
}

if (process.env.KB_DEBUG) {
  for (const w of process.env.KB_DEBUG.split(',')) console.log('[debug]', w, 'vocab', VOCAB.get(w), 'stem', STEM_VOCAB.get(stemRussian(w)), 'lower', VOCAB_LOWER.get(w), 'capmid', VOCAB_CAPMID.get(w))
}
const allIds = new Set<string>()
const shardCounts: Record<string, number> = {}
for (const g of GRADES) {
  const chunks = buildGrade(g)
  writeShard(`g${g}`, chunks)
  shardCounts[`g${g}`] = chunks.length
  chunks.forEach((c) => allIds.add(c.id))
}
const cards = await buildCards()
for (const c of cards) {
  if (allIds.has(c.id)) throw new Error(`card id collides with textbook chunk: ${c.id}`)
}
writeShard('common', cards)

// r10: book index (formulas, reactions, § contents, page locations) from the verified textbook inventory —
// its own shard with its own BM25 statistics (build-index.mts), searched only on request (types: ['index']).
const bookIndex = await buildBookIndex()
for (const c of bookIndex) {
  if (allIds.has(c.id) || cards.some((x) => x.id === c.id)) throw new Error(`book index id collides: ${c.id}`)
}
writeShard('book', bookIndex)

const sectionTitles = new Map<string, string>()
for (const g of [7, 8, 9]) {
  for (const e of readJson<TocEntry[]>(`src/data/g${g}BookToc.json`)) sectionTitles.set(`g${g}-c${e.ch}-s${pad2(e.sec)}`, e.titleRu)
}
const quiz = await buildQuizChunks(sectionTitles)
writeShard('quiz', quiz, 'kb-quiz.json')

const glossary = await buildGlossary()
fileBytes['kb-glossary.json'] = writeFile('kb-glossary.json', { version: 2, count: glossary.length, entries: glossary })
console.log(`[corpus] glossary: ${glossary.length} entries`)
fs.writeFileSync(path.join(OUT, 'kb-sections.json'), JSON.stringify(sectionsReport, null, 1))

const count = <T,>(xs: T[], key: (x: T) => string) => {
  const m: Record<string, number> = {}
  for (const x of xs) m[key(x)] = (m[key(x)] ?? 0) + 1
  return m
}
const stats = {
  version: 2,
  generatedAt: new Date().toISOString(),
  chunkPolicy: CHUNK,
  grades: gradeStats,
  cards: { count: cards.length, byType: count(cards, (c) => c.type), bySource: count(cards, (c) => c.source), chars: cards.reduce((s, c) => s + c.text.length, 0) },
  quiz: { count: quiz.length, byLang: count(quiz, (c) => c.lang), bySource: count(quiz, (c) => c.source) },
  glossary: { count: glossary.length, bySource: count(glossary, (e) => e.source), withUz: glossary.filter((e) => e.uz.length).length, withEn: glossary.filter((e) => e.en.length).length },
  files: fileBytes,
  totalBytes: Object.values(fileBytes).reduce((s, n) => s + n, 0),
  problems,
}
fs.writeFileSync(path.join(OUT, 'kb-stats.json'), JSON.stringify(stats, null, 1))

console.log('[corpus] per grade:')
for (const [g, s] of Object.entries(gradeStats) as [string, Record<string, unknown>][]) {
  const len = s.textbookChunkLength as Record<string, number>
  console.log(
    `  ${g}: ${s.sections} sections (${(s.emptySections as string[]).length} empty), ${s.chunks} chunks ${JSON.stringify(s.byType)}, ` +
      `${s.textbookChars} textbook chars, len p10/p50/p90 ${len.p10}/${len.p50}/${len.p90}, overlap ${s.meanOverlapPct}%, ` +
      `garbled ${s.garbledLatin1Chars}, mixed-script words ${s.mixedScriptWords}, no app section ${s.chunksWithoutAppSection}`,
  )
}
console.log(`[corpus] total ${(stats.totalBytes / 1024 / 1024).toFixed(2)} MB; problems: ${problems.length ? '\n  - ' + problems.join('\n  - ') : 'none'}`)
console.log(`[corpus] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
if (STRICT && problems.length) process.exit(1)
