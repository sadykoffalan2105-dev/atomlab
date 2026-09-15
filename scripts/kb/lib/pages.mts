/**
 * Page text → ordered, cleaned paragraphs for the textbook corpus build (KB-1).
 *
 * Input: extraction caches
 *   scripts/kb/.cache/lines-g{7..10}.json  (pdfjs lines: t, x0, x1, y, s, b, i — `npm run kb:extract`)
 *   scripts/kb/.cache/g11/pNNN.json         (tesseract OCR: text, paragraphs — `npm run kb:ocr11`)
 *
 * Cleaning: running headers/footers and page numbers, de-hyphenation, cp1251 repair (grade 8), formula repair,
 * broken small caps, letter-spaced headings, OCR noise (grade 11), sub/superscripts → ASCII, ё → е.
 */
import fs from 'node:fs'
import path from 'node:path'
import { countGarbled, fixMixedScript, normalizeText, repairCp1251 } from '../textClean.mjs'
import {
  dropOcrJunk,
  joinLetterSpaced,
  repairCaseNoise,
  repairFormulas,
  repairLoneSymbols,
  repairOcrMarkers,
  repairOcrText,
  repairUnitDupes,
  stripGluedTranslations,
} from './textRepair.mts'

export const CACHE_DIR = path.resolve(import.meta.dirname, '..', '.cache')
/** OCR cache folder of grade 11 (scripts/kb/.cache/<dir>); KB_OCR_DIR overrides it to compare OCR runs. */
export const OCR_DIR = process.env.KB_OCR_DIR || 'g11'

type RawLine = { t: string; x0: number; x1: number; y: number; s: number; b?: number | boolean; i?: number | boolean }
type RawPage = { page: number; width: number; height: number; lines: RawLine[] }

export type Para = {
  page: number
  /** top of the first line (pt from the page top; OCR: pixel y / 4) */
  y: number
  text: string
  /** font size of the first line (0 for OCR) */
  size: number
  bold: boolean
  /** short line(s) set in a larger/bold font — likely a heading */
  heading: boolean
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

let VOCAB: Map<string, number> | null = null

/** Lowercase Cyrillic word frequencies over the text-layer books (grades 7–10), for vocabulary-checked repairs. */
export function textLayerVocab(): Map<string, number> {
  if (VOCAB) return VOCAB
  VOCAB = new Map()
  for (const g of [7, 8, 9, 10]) {
    const file = path.join(CACHE_DIR, `lines-g${g}.json`)
    if (!fs.existsSync(file)) continue
    const pages = JSON.parse(fs.readFileSync(file, 'utf8')) as RawPage[]
    for (const p of pages) {
      for (const l of p.lines) {
        let t = l.t
        if (g === 8) t = repairCp1251(t)
        for (const w of t.toLowerCase().replace(/ё/g, 'е').match(/(?<![a-z])[а-я]{2,}(?![a-z])/g) ?? []) {
          VOCAB.set(w, (VOCAB.get(w) ?? 0) + 1)
        }
      }
    }
  }
  return VOCAB
}

const LAT_IN_CYR: Record<string, string> = {
  a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', m: 'м', t: 'т', k: 'к', h: 'н', n: 'п', u: 'и', r: 'г', b: 'ь',
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У',
}

/** Mixed-script words ("Неmеtаллы", "Atomов"): vocabulary-checked Latin → Cyrillic, else the look-alike fix. */
function repairMixedWords(text: string): string {
  const vocab = textLayerVocab()
  return text.replace(/[A-Za-zА-Яа-яЁё]{2,}/g, (w) => {
    if (!/[A-Za-z]/.test(w) || !/[А-Яа-яЁё]/.test(w)) return w
    const mapped = [...w].map((c) => LAT_IN_CYR[c] ?? c).join('')
    if (!/[A-Za-z]/.test(mapped) && (vocab.get(mapped.toLowerCase().replace(/ё/g, 'е')) ?? 0) >= 2) return mapped
    return fixMixedScript(w)
  })
}

function cleanLayoutLine(t: string, grade: number): string {
  let s = t
  // Latin-1 letters never occur in these Russian books: any À–ÿ is a cp1251 font-map artifact
  if (grade === 8 || countGarbled(s) > 0) s = repairCp1251(s)
  s = normalizeText(s)
  s = repairUnitDupes(s)
  s = stripGluedTranslations(s, textLayerVocab())
  s = repairFormulas(s, grade === 8 ? 'case' : 'layout')
  if (grade === 8) s = repairLoneSymbols(s)
  s = repairMixedWords(s)
  s = repairCaseNoise(s)
  s = joinLetterSpaced(s)
  return norm(s)
}

function cleanOcrText(t: string): string {
  // accented Latin letters never occur in these books: OCR noise ("pactsopénnoe")
  let s = normalizeText(t).normalize('NFD').replace(/(?<=[A-Za-z])[\u0300-\u036f]/g, '').normalize('NFC')
  // OCR arrows "—>", "——>", "<—>" → the arrows the text-layer books use
  s = s.replace(/<\s*[-—–]+\s*>/g, ' ⇄ ').replace(/[-—–]+\s*>/g, ' → ')
  s = repairOcrMarkers(s)
  s = repairFormulas(s, 'ocr')
  s = repairOcrText(s, textLayerVocab())
  s = repairUnitDupes(s)
  s = repairMixedWords(s)
  s = repairCaseNoise(s)
  s = dropOcrJunk(s)
  return norm(s)
}

/**
 * Grade 11 OCR after line joining: de-hyphenation glues halves from different lines, so a Latin look-alike
 * half ("Ta-" + "ким", "Be-" + "щества", "pe-" + "акции") only becomes a word now. Mid-sentence words whose
 * first letters were read as capitals ("количествами Вещества", "КОНцентрацией") go back to lower case.
 */
export function repairJoinedOcr(text: string): string {
  const vocab = textLayerVocab()
  const freq = (w: string) => vocab.get(w.toLowerCase().replace(/ё/g, 'е')) ?? 0
  let s = text.replace(/(?<![A-Za-zА-Яа-яЁё])[A-Za-zА-Яа-яЁё]{3,}(?![A-Za-zА-Яа-яЁё])/g, (w, offset: number, all: string) => {
    if (!/[A-Za-z]/.test(w) || !/[А-Яа-яЁё]/.test(w)) return w
    const fixed = repairMixedWords(repairOcrText(w, vocab))
    if (/[A-Za-z]/.test(fixed) || freq(fixed) < 2) return w
    const midSentence = /[а-яё0-9,;:]\s+$/.test(all.slice(Math.max(0, offset - 3), offset))
    return midSentence ? fixed.toLowerCase() : fixed.charAt(0) + fixed.slice(1).toLowerCase()
  })
  s = s.replace(/(?<=[а-яё,;:]\s)([А-ЯЁ]{2,4}[а-яё]{3,})(?![А-Яа-яЁё])/g, (w) => (freq(w) >= 2 ? w.toLowerCase() : w))
  return s
}

/** Share of Cyrillic words (3+ letters) that occur in the text-layer books — low for OCR of drawings and tables. */
function vocabCoverage(text: string): { words: number; share: number } {
  const vocab = textLayerVocab()
  const words = text.toLowerCase().match(/[а-яё]{3,}/g) ?? []
  if (!words.length) return { words: 0, share: 0 }
  const hit = words.filter((w) => (vocab.get(w.replace(/ё/g, 'е')) ?? 0) >= 1).length
  return { words: words.length, share: hit / words.length }
}

/** Group lines into visual blocks (columns, side boxes) and return them in reading order. */
function orderLines(page: RawPage): RawLine[][] {
  const lines = page.lines.filter((l) => norm(l.t)).sort((a, b) => a.y - b.y || a.x0 - b.x0)
  type Block = { lines: RawLine[]; top: number }
  const blocks: Block[] = []
  const open: Block[] = []
  for (const l of lines) {
    let best: Block | null = null
    let bestGap = Infinity
    for (const b of open) {
      const last = b.lines[b.lines.length - 1]
      const gap = l.y - last.y
      if (gap < 0 || gap > Math.max(last.s, l.s) * 2.3) continue
      const ov = Math.min(last.x1, l.x1) - Math.max(last.x0, l.x0)
      const narrow = Math.min(last.x1 - last.x0, l.x1 - l.x0)
      if (ov < Math.max(4, narrow * 0.45)) continue
      if (gap < bestGap) {
        best = b
        bestGap = gap
      }
    }
    if (best) best.lines.push(l)
    else {
      const b = { lines: [l], top: l.y }
      blocks.push(b)
      open.push(b)
    }
  }
  return blocks.sort((a, b) => a.top - b.top).map((b) => b.lines)
}

/** Lines repeated at the top/bottom of many pages (running headers, footers, page numbers). */
function runningKeys(pages: RawPage[]): Set<string> {
  const counts = new Map<string, number>()
  for (const p of pages) {
    const seen = new Set<string>()
    for (const l of p.lines) {
      if (l.y > p.height * 0.1 && l.y < p.height * 0.92) continue
      const key = norm(l.t).toLowerCase().replace(/\d+/g, '#')
      if (!key || seen.has(key)) continue
      seen.add(key)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  const out = new Set<string>()
  for (const [k, n] of counts) if (n >= 4 || /^#$/.test(k)) out.add(k)
  return out
}

/** A header/footer line that carries this page's number ("1.2. ТЕОРИЯ СТРОЕНИЯ … 13", "ГЛАВА IV неMETAллы 89"). */
function isPageRunner(l: RawLine, page: RawPage): boolean {
  const t = norm(l.t)
  if (t.length > 140 || /^§/.test(t)) return false
  const nums = (t.match(/(?<![\d,.])\d{1,3}(?![\d,])/g) ?? []).map(Number)
  if (!nums.some((n) => Math.abs(n - page.page) <= 2)) return false
  return /^\d{1,3}\s{2,}|\s{2,}\d{1,3}$/.test(l.t) || /^\d{1,3}\s+\S/.test(t) || /\S\s+\d{1,3}$/.test(t)
}

/** Join visual lines; a line-end hyphen is removed ("опре-" + "деленной") unless both halves are words of their own
 * and the joined form is unknown ("окислительно-" + "восстановительных"). */
export function joinLines(parts: string[]): string {
  const vocab = textLayerVocab()
  const f = (w: string) => vocab.get(w.toLowerCase().replace(/ё/g, 'е')) ?? 0
  let out = ''
  for (const raw of parts) {
    const p = raw.trim()
    if (!p) continue
    if (!out) out = p
    else if (/[а-яa-z]-$/i.test(out) && /^[а-яa-z]/.test(p)) {
      const left = /([А-Яа-яЁё]+)-$/.exec(out)?.[1] ?? ''
      const right = /^[А-Яа-яЁё]+/.exec(p)?.[0] ?? ''
      const keep = left.length >= 4 && right.length >= 4 && f(left) >= 2 && f(right) >= 2 && f(left + right) < 2
      out = keep ? out + p : out.slice(0, -1) + p
    } else out += ' ' + p
  }
  return out
}

export function loadLayoutParagraphs(grade: number): Para[] {
  const file = path.join(CACHE_DIR, `lines-g${grade}.json`)
  const pages = JSON.parse(fs.readFileSync(file, 'utf8')) as RawPage[]
  const running = runningKeys(pages)
  const paras: Para[] = []
  for (const page of pages) {
    const sizes = page.lines.map((l) => l.s).sort((a, b) => a - b)
    const body = sizes[Math.floor(sizes.length / 2)] || 11
    for (const block of orderLines(page)) {
      let cur: RawLine[] = []
      const flush = () => {
        if (!cur.length) return
        const text = joinLines(cur.map((l) => cleanLayoutLine(l.t, grade)))
        if (text) {
          const first = cur[0]
          const heading =
            text.length < 140 && (first.s >= body * 1.12 || (!!first.b && cur.every((l) => l.b)))
          paras.push({ page: page.page, y: first.y, text, size: first.s, bold: !!first.b, heading })
        }
        cur = []
      }
      const minX = Math.min(...block.map((l) => l.x0))
      for (const l of block) {
        const key = norm(l.t).toLowerCase().replace(/\d+/g, '#')
        const edge = l.y <= page.height * 0.1 || l.y >= page.height * 0.92
        if (edge && !/^§/.test(key) && (running.has(key) || /^#?$/.test(key) || /скачано с сайта/i.test(key))) continue
        if (edge && isPageRunner(l, page)) continue
        if (/скачано с сайта|www\.idum\.uz/i.test(l.t)) continue
        if (cur.length) {
          const prev = cur[cur.length - 1]
          const styleChange = !!prev.b !== !!l.b || Math.abs(prev.s - l.s) > 1.2
          const indent = l.x0 > minX + 9 && l.x0 - minX < 60
          const bigGap = l.y - prev.y > Math.max(prev.s, l.s) * 1.75
          if (styleChange || indent || bigGap) flush()
        }
        cur.push(l)
      }
      flush()
    }
  }
  return paras
}

type OcrLine = { t: string; b: [number, number, number, number]; c: number; h?: number }
type OcrPage = { page: number; conf: number; width: number; height: number; text: string; paragraphs: { b: number[]; lines: OcrLine[] }[] }

export type OcrPageStat = { page: number; conf: number; chars: number }
export const OCR_PAGE_STATS: OcrPageStat[] = []

/**
 * Grade 11 OCR pages. Tesseract paragraphs (with pixel boxes) are split further at large vertical gaps and
 * indented first lines; headings are short lines set in a taller font or with a § / chapter marker.
 */
export function loadOcrParagraphs(): Para[] {
  const dir = path.join(CACHE_DIR, OCR_DIR)
  const files = fs.readdirSync(dir).filter((f) => /^p\d+\.json$/.test(f)).sort()
  const paras: Para[] = []
  OCR_PAGE_STATS.length = 0
  for (const f of files) {
    const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as OcrPage
    OCR_PAGE_STATS.push({ page: p.page, conf: p.conf, chars: p.text.replace(/\s/g, '').length })
    const allLines = p.paragraphs.flatMap((q) => q.lines)
    const heights = allLines.map((l) => l.b[3] - l.b[1]).sort((a, b) => a - b)
    const bodyH = heights[Math.floor(heights.length / 2)] || 60
    const lefts = allLines.map((l) => l.b[0]).sort((a, b) => a - b)
    const leftMargin = lefts[Math.floor(lefts.length * 0.2)] ?? 0
    for (const para of p.paragraphs) {
      let cur: OcrLine[] = []
      const flush = () => {
        if (!cur.length) return
        const lines = cur.map((l) => l.t.trim()).filter(Boolean)
        cur = []
        if (!lines.length) return
        if (lines.length === 1 && /^\d{1,3}$/.test(lines[0])) return // page number
        const text = repairJoinedOcr(joinLines(lines.map(cleanOcrText)))
        if (!text) return
        const cov = vocabCoverage(text)
        if (cov.words >= 4 && cov.share < 0.45) return // OCR of a drawing / table
        const first = lines[0]
        const tall = (cur0H ?? 0) > bodyH * 1.18 && letterRatio(text) > 0.75 && (text.match(/[А-Яа-яЁё]{3,}/g) ?? []).length >= 2
        const heading =
          text.length < 140 &&
          (tall || /^§\s*\d/.test(text) || /^(\d+\s*-?\s*)?(ГЛАВА|РАЗДЕЛ)/i.test(text) || /^[А-ЯЁ\s.,-]{8,}$/.test(first))
        paras.push({ page: p.page, y: Math.round(cur0Y / 4), text, size: 0, bold: false, heading })
      }
      let cur0Y = 0
      let cur0H: number | undefined
      for (const l of para.lines) {
        const h = l.b[3] - l.b[1]
        if (cur.length) {
          const prev = cur[cur.length - 1]
          const gap = l.b[1] - prev.b[3]
          const indent = l.b[0] - leftMargin > bodyH * 0.9 && l.b[0] - leftMargin < bodyH * 4
          const sizeJump = Math.abs(h - (prev.b[3] - prev.b[1])) > bodyH * 0.35
          if (gap > bodyH * 0.8 || indent || sizeJump) flush()
        }
        if (!cur.length) {
          cur0Y = l.b[1]
          cur0H = h
        }
        cur.push(l)
      }
      flush()
    }
  }
  return paras
}

/** Share of letters in a paragraph (tables / OCR noise have few). */
export function letterRatio(text: string): number {
  const letters = (text.match(/\p{L}/gu) ?? []).length
  return letters / Math.max(1, text.replace(/\s/g, '').length)
}
