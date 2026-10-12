/**
 * WER / CER для оценки распознавания речи (ru / uz / en).
 *
 * Нормализация: нижний регистр, ё→е, апострофы узбекской латиницы (ʻ ʼ ’ ‘ ` ') → ', пунктуация → пробел,
 * подстрочные цифры (H₂O) → обычные. Сравнение берёт МИНИМУМ WER из вариантов:
 *   plain   — как есть после нормализации;
 *   words   — цифры → слова в обеих строках («18» = «восемнадцать», «o'n sakkiz», «eighteen»);
 *   digits  — числа словами → цифры в обеих строках (с падежами ru: «двенадцати» = 12);
 *   chem    — обе строки через fixTranscript (формулы словами → запись, ослышки терминов) — как делает клиент.
 * Расстояние — Левенштейн по словам (WER) и по символам (CER).
 */
import { fixTranscript } from '../../src/learn/brain/speech/chemTranscript.ts'

export type WerLang = 'ru' | 'uz' | 'en'

/* ------------------------------------------------------------ нормализация */

const SUBSCRIPT: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
const SUPERSCRIPT_RE = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]/g

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[ʻʼ’‘`´']/g, "'")
    .replace(/[₀-₉]/g, (c) => SUBSCRIPT[c] ?? c)
    .replace(SUPERSCRIPT_RE, '')
    // апостроф оставляем только внутри слова (o'n, bo'ladi, let's)
    .replace(/(^|[^\p{L}])'|'(?=[^\p{L}]|$)/gu, '$1 ')
    .replace(/[^\p{L}\p{N}'\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function words(text: string): string[] {
  const n = normalizeText(text)
  return n ? n.split(' ') : []
}

/* ------------------------------------------------------------ числа: цифры → слова */

const RU_UNITS = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
const RU_TEENS = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать']
const RU_TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
const RU_HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']

const UZ_UNITS = ['nol', 'bir', 'ikki', 'uch', "to'rt", 'besh', 'olti', 'yetti', 'sakkiz', "to'qqiz"]
const UZ_TENS = ['', "o'n", 'yigirma', "o'ttiz", 'qirq', 'ellik', 'oltmish', 'yetmish', 'sakson', "to'qson"]

const EN_UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const EN_TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function ruBelow1000(n: number): string[] {
  const out: string[] = []
  if (n >= 100) out.push(RU_HUNDREDS[Math.floor(n / 100)])
  const r = n % 100
  if (r >= 10 && r < 20) out.push(RU_TEENS[r - 10])
  else {
    if (r >= 20) out.push(RU_TENS[Math.floor(r / 10)])
    if (r % 10 || (!out.length && r === 0)) out.push(RU_UNITS[r % 10])
  }
  return out
}

function numberToWords(n: number, lang: WerLang): string {
  if (!Number.isFinite(n) || n < 0 || n > 999_999) return String(n)
  if (lang === 'ru') {
    if (n === 0) return 'ноль'
    const th = Math.floor(n / 1000)
    const rest = n % 1000
    const out: string[] = []
    if (th) {
      const t = ruBelow1000(th)
      const last = th % 10
      const teen = th % 100 >= 10 && th % 100 < 20
      if (!teen && last === 1) t[t.length - 1] = 'одна'
      if (!teen && last === 2) t[t.length - 1] = 'две'
      out.push(...(th === 1 ? [] : t), teen || last === 0 || last >= 5 ? 'тысяч' : last === 1 ? 'тысяча' : 'тысячи')
    }
    if (rest || !th) out.push(...ruBelow1000(rest))
    return out.filter(Boolean).join(' ')
  }
  if (lang === 'uz') {
    const below = (x: number): string[] => {
      const o: string[] = []
      if (x >= 100) o.push(...(Math.floor(x / 100) > 1 ? [UZ_UNITS[Math.floor(x / 100)]] : []), 'yuz')
      const r = x % 100
      if (r >= 10) o.push(UZ_TENS[Math.floor(r / 10)])
      if (r % 10) o.push(UZ_UNITS[r % 10])
      return o
    }
    if (n === 0) return 'nol'
    const th = Math.floor(n / 1000)
    const out = [...(th ? [...(th > 1 ? below(th) : []), 'ming'] : []), ...below(n % 1000)]
    return out.join(' ')
  }
  const below = (x: number): string[] => {
    const o: string[] = []
    if (x >= 100) o.push(EN_UNITS[Math.floor(x / 100)], 'hundred')
    const r = x % 100
    if (r >= 10 && r < 20) o.push(EN_TEENS[r - 10])
    else {
      if (r >= 20) o.push(EN_TENS[Math.floor(r / 10)])
      if (r % 10) o.push(EN_UNITS[r % 10])
    }
    return o
  }
  if (n === 0) return 'zero'
  const th = Math.floor(n / 1000)
  return [...(th ? [...below(th), 'thousand'] : []), ...below(n % 1000)].join(' ')
}

export function digitsToWords(text: string, lang: WerLang): string {
  return normalizeText(text).replace(/\d+/g, (d) => (d.length > 6 ? d.split('').map((c) => numberToWords(+c, lang)).join(' ') : numberToWords(Number(d), lang)))
}

/* ------------------------------------------------------------ числа: слова → цифры */

type NumWord = { v: number; k: 'unit' | 'ten' | 'hundred' | 'scale' }

function ruNumWords(): Map<string, NumWord> {
  const m = new Map<string, NumWord>()
  const add = (forms: string[], v: number, k: NumWord['k']) => forms.forEach((f) => m.set(f, { v, k }))
  add(['ноль', 'нуля', 'нулю', 'нулем'], 0, 'unit')
  add(['один', 'одна', 'одно', 'одного', 'одной', 'одному', 'одним', 'одном', 'одну'], 1, 'unit')
  add(['два', 'две', 'двух', 'двум', 'двумя'], 2, 'unit')
  add(['три', 'трех', 'трем', 'тремя'], 3, 'unit')
  add(['четыре', 'четырех', 'четырем', 'четырьмя'], 4, 'unit')
  const regular: [string, number][] = [
    ['пят', 5], ['шест', 6], ['сем', 7], ['восем', 8], ['девят', 9], ['десят', 10], ['одиннадцат', 11], ['двенадцат', 12],
    ['тринадцат', 13], ['четырнадцат', 14], ['пятнадцат', 15], ['шестнадцат', 16], ['семнадцат', 17], ['восемнадцат', 18],
    ['девятнадцат', 19], ['двадцат', 20], ['тридцат', 30],
  ]
  for (const [stem, v] of regular) add([`${stem}ь`, `${stem}и`, `${stem}ью`], v, v < 20 ? 'unit' : 'ten')
  add(['восьми', 'восемью'], 8, 'unit')
  add(['сорок', 'сорока'], 40, 'ten')
  add(['пятьдесят', 'пятидесяти'], 50, 'ten')
  add(['шестьдесят', 'шестидесяти'], 60, 'ten')
  add(['семьдесят', 'семидесяти'], 70, 'ten')
  add(['восемьдесят', 'восьмидесяти'], 80, 'ten')
  add(['девяносто', 'девяноста'], 90, 'ten')
  add(['сто', 'ста', 'сотни'], 100, 'hundred')
  add(['двести', 'двухсот'], 200, 'hundred')
  add(['триста', 'трехсот'], 300, 'hundred')
  add(['четыреста', 'четырехсот'], 400, 'hundred')
  add(['пятьсот', 'пятисот'], 500, 'hundred')
  add(['шестьсот'], 600, 'hundred')
  add(['семьсот'], 700, 'hundred')
  add(['восемьсот'], 800, 'hundred')
  add(['девятьсот'], 900, 'hundred')
  add(['тысяча', 'тысячи', 'тысяч', 'тысячу', 'тысячей'], 1000, 'scale')
  return m
}

function uzNumWords(): Map<string, NumWord> {
  const m = new Map<string, NumWord>()
  UZ_UNITS.forEach((w, i) => m.set(w, { v: i, k: 'unit' }))
  UZ_TENS.forEach((w, i) => w && m.set(w, { v: i * 10, k: 'ten' }))
  m.set('yuz', { v: 100, k: 'hundred' })
  m.set('ming', { v: 1000, k: 'scale' })
  return m
}

function enNumWords(): Map<string, NumWord> {
  const m = new Map<string, NumWord>()
  EN_UNITS.forEach((w, i) => m.set(w, { v: i, k: 'unit' }))
  EN_TEENS.forEach((w, i) => m.set(w, { v: 10 + i, k: 'unit' }))
  EN_TENS.forEach((w, i) => w && m.set(w, { v: i * 10, k: 'ten' }))
  m.set('hundred', { v: 100, k: 'hundred' })
  m.set('thousand', { v: 1000, k: 'scale' })
  return m
}

const NUM_WORDS: Record<WerLang, Map<string, NumWord>> = { ru: ruNumWords(), uz: uzNumWords(), en: enNumWords() }

export function wordsToDigits(text: string, lang: WerLang): string {
  const dict = NUM_WORDS[lang]
  const out: string[] = []
  let total = 0
  let cur = 0
  let active = false
  let lastK: NumWord['k'] | null = null
  const flush = () => {
    if (active) out.push(String(total + cur))
    total = 0
    cur = 0
    active = false
    lastK = null
  }
  for (const w of words(text)) {
    const nw = dict.get(w)
    // «hundred» в uz — множитель предыдущей цифры; в ru «сто/двести» — самостоятельные сотни
    if (!nw || (lastK === 'unit' && nw.k === 'unit') || (lastK === 'ten' && nw.k === 'ten')) {
      if (!nw) {
        flush()
        out.push(w)
        continue
      }
      flush()
    }
    active = true
    if (nw.k === 'scale') {
      total += (cur || 1) * nw.v
      cur = 0
    } else if (nw.k === 'hundred' && lang !== 'ru') cur = (cur || 1) * nw.v
    else cur += nw.v
    lastK = nw.k
  }
  flush()
  return out.join(' ')
}

/* ------------------------------------------------------------ Левенштейн */

export function editDistance<T>(a: readonly T[], b: readonly T[]): number {
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

export interface WerResult {
  /** ошибки (S+D+I) лучшего варианта */
  errors: number
  /** слов в эталоне (для лучшего варианта) */
  refWords: number
  wer: number
  cer: number
  variant: 'plain' | 'words' | 'digits' | 'chem'
  ref: string
  hyp: string
}

function scoreWords(ref: string[], hyp: string[]): { errors: number; refWords: number; wer: number } {
  const errors = editDistance(ref, hyp)
  const refWords = ref.length
  return { errors, refWords, wer: refWords ? errors / refWords : hyp.length ? 1 : 0 }
}

export function cer(ref: string, hyp: string): number {
  const r = [...normalizeText(ref)]
  const h = [...normalizeText(hyp)]
  return r.length ? editDistance(r, h) / r.length : h.length ? 1 : 0
}

/** WER с минимумом по вариантам нормализации (plain / числа словами / числа цифрами / fixTranscript). */
export function wer(refText: string, hypText: string, lang: WerLang): WerResult {
  const variants: [WerResult['variant'], string, string][] = [
    ['plain', normalizeText(refText), normalizeText(hypText)],
    ['words', digitsToWords(refText, lang), digitsToWords(hypText, lang)],
    ['digits', wordsToDigits(refText, lang), wordsToDigits(hypText, lang)],
    ['chem', normalizeText(fixTranscript(refText, lang)), normalizeText(fixTranscript(hypText, lang))],
  ]
  let best: WerResult | null = null
  for (const [variant, r, h] of variants) {
    const s = scoreWords(r ? r.split(' ') : [], h ? h.split(' ') : [])
    if (!best || s.wer < best.wer) best = { ...s, cer: cer(r, h), variant, ref: r, hyp: h }
  }
  return best!
}

/** Формула/фраза после fixTranscript совпала точно (как увидит её учитель). */
export function chemExact(refText: string, hypText: string, lang: WerLang): boolean {
  const f = (t: string) => normalizeText(fixTranscript(t, lang)).replace(/\s+/g, '')
  return f(refText) === f(hypText)
}

/* ------------------------------------------------------------ отчёт */

export interface WerRow {
  id: string
  lang: WerLang
  variant: string
  cat: string
  ref: string
  hyp: string
}

export interface WerGroup {
  key: string
  clips: number
  refWords: number
  errors: number
  /** корпусный WER = Σ ошибок / Σ слов эталона */
  wer: number
  cer: number
}

export function aggregate(rows: WerRow[], keyOf: (r: WerRow) => string): WerGroup[] {
  const groups = new Map<string, { clips: number; refWords: number; errors: number; cerSum: number }>()
  for (const r of rows) {
    const k = keyOf(r)
    const s = wer(r.ref, r.hyp, r.lang)
    const g = groups.get(k) ?? { clips: 0, refWords: 0, errors: 0, cerSum: 0 }
    g.clips++
    g.refWords += s.refWords
    g.errors += s.errors
    g.cerSum += s.cer
    groups.set(k, g)
  }
  return [...groups]
    .map(([key, g]) => ({ key, clips: g.clips, refWords: g.refWords, errors: g.errors, wer: g.refWords ? g.errors / g.refWords : 0, cer: g.cerSum / g.clips }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

export function formatGroups(title: string, groups: WerGroup[]): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`.padStart(7)
  const lines = [`${title}`, `  ${'группа'.padEnd(22)} клипов   слов   WER     CER`]
  for (const g of groups) lines.push(`  ${g.key.padEnd(22)} ${String(g.clips).padStart(6)} ${String(g.refWords).padStart(6)} ${pct(g.wer)} ${pct(g.cer)}`)
  return lines.join('\n')
}
