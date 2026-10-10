/**
 * Поиск сущностей в вопросе: формулы («H2SO4», «CuSO₄·5H₂O», «Ca(OH)2»), вещества и элементы по названию
 * (ru — по общей основе слова: «серной кислоты» = «серная кислота»; uz/en — по началу слова: «kislotaning»).
 */
import { formulaToUnicode, parseFormula } from '../../src/chemistry/equationFormula.ts'
import { CONCEPTS, type Concept } from '../kb/concepts.ts'
import type { Knowledge, QaElement, QaSubstance } from '../kb/shards.ts'
import type { Lang } from './normalize.ts'

export type FoundFormula = { raw: string; ascii: string; pretty: string; counts: Record<string, number>; charge: number; index: number }

const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }

export function toAsciiFormula(s: string): string {
  return [...s].map((c) => SUB[c] ?? c).join('').replace(/[·•∙]/g, '*')
}

/** Красивая формула: «H2SO4» → «H₂SO₄». */
export function pretty(ascii: string): string {
  try {
    return formulaToUnicode(ascii)
  } catch {
    return ascii
  }
}

const TOKEN_RE = /[A-Z[(][A-Za-z0-9₀-₉()[\]·•∙*⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]*(?:\^\d*[+-])?/g
/** Заглавные сокращения, которые случайно состоят из символов элементов. */
const NOT_FORMULA = new Set(['OK', 'IB', 'TV', 'PC', 'CV', 'SI', 'US', 'UK', 'BC', 'AC', 'DC', 'PS', 'CPU', 'GPU', 'USB', 'NB', 'ES'])

/**
 * Формулы в тексте. Одиночный символ элемента («He», «I», «As») принимается, только если вопрос
 * не английский или рядом есть химический контекст (allowSingle).
 */
export function findFormulas(text: string, allowSingle: boolean): FoundFormula[] {
  const out: FoundFormula[] = []
  const seen = new Set<string>()
  for (const m of text.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0
    const prev = idx > 0 ? text[idx - 1]! : ' '
    if (/[A-Za-zА-Яа-яЁё]/.test(prev)) continue
    const raw = m[0].replace(/[.,;:!?]+$/, '')
    if (!raw || NOT_FORMULA.has(raw) || /^[A-Z][a-z]{2,}/.test(raw)) continue // слово с заглавной («Hello»), сокращения («OK»)
    if (/^[(\[]/.test(raw) && !/[)\]]/.test(raw)) continue
    const ascii = toAsciiFormula(raw)
    const parsed = parseFormula(ascii)
    if (!parsed || parsed.electron || !Object.keys(parsed.counts).length) continue
    const nSym = Object.keys(parsed.counts).length
    const hasDigit = /[0-9₀-₉]/.test(raw)
    if (nSym === 1 && !hasDigit && !allowSingle) continue
    if (nSym === 1 && !hasDigit && !/^[A-Z][a-z]?$/.test(raw)) continue
    if (nSym === 1 && !hasDigit && /\d\s*$/.test(text.slice(Math.max(0, idx - 6), idx))) continue // «300 K» — единица, не калий
    if (seen.has(ascii)) continue
    seen.add(ascii)
    out.push({ raw, ascii, pretty: pretty(ascii), counts: parsed.counts, charge: parsed.charge, index: idx })
  }
  return out
}

function words(text: string): { w: string; i: number }[] {
  const out: { w: string; i: number }[] = []
  for (const m of text.toLowerCase().replace(/ё/g, 'е').replace(/[ʻʼ‘’`´]/g, "'").matchAll(/[\p{L}']+/gu)) out.push({ w: m[0], i: m.index ?? 0 })
  return out
}

function ruMatch(a: string, b: string): boolean {
  let p = 0
  while (p < a.length && p < b.length && a[p] === b[p]) p++
  return p >= Math.max(3, Math.max(a.length, b.length) - 3)
}

function latMatch(textWord: string, nameWord: string): boolean {
  if (nameWord.length < 3) return textWord === nameWord
  return textWord.startsWith(nameWord.replace(/'/g, "'")) && textWord.length - nameWord.length <= 7
}

type NameEntry<T> = { words: string[]; lang: Lang; item: T }

function buildNames<T>(items: readonly T[], names: (x: T) => Partial<Record<Lang, string>>): NameEntry<T>[] {
  const out: NameEntry<T>[] = []
  for (const it of items) {
    for (const [lang, name] of Object.entries(names(it)) as [Lang, string | undefined][]) {
      if (!name) continue
      for (const variant of name.split(/[;,/]|\s\(/)) {
        const ws = words(variant).map((x) => x.w)
        if (ws.length && ws.join('').length >= 3) out.push({ words: ws, lang, item: it })
      }
    }
  }
  // длинные названия первыми: «серная кислота» раньше «сера»
  return out.sort((a, b) => b.words.length - a.words.length || b.words.join(' ').length - a.words.join(' ').length)
}

const cache = new WeakMap<Knowledge, { subs: NameEntry<QaSubstance>[]; els: NameEntry<QaElement>[] }>()

function names(kb: Knowledge) {
  let c = cache.get(kb)
  if (!c) {
    c = {
      subs: buildNames(kb.qa.substances, (s) => ({ ru: s.ru, uz: s.uz, en: s.en })),
      els: buildNames(kb.qa.elements, (e) => ({ ru: e.ru, uz: e.uz, en: e.en })),
    }
    cache.set(kb, c)
  }
  return c
}

function findNamed<T>(text: string, entries: NameEntry<T>[], key: (x: T) => string): { item: T; index: number; len: number }[] {
  const ws = words(text)
  const out: { item: T; index: number; len: number }[] = []
  const used = new Set<number>()
  const seen = new Set<string>()
  for (const e of entries) {
    const n = e.words.length
    for (let i = 0; i + n <= ws.length; i++) {
      let ok = true
      for (let k = 0; k < n; k++) {
        if (used.has(i + k)) {
          ok = false
          break
        }
        const tw = ws[i + k]!.w
        const nw = e.words[k]!
        const isCyr = /[а-я]/.test(nw)
        if (!(isCyr ? ruMatch(tw, nw) : latMatch(tw, nw))) {
          ok = false
          break
        }
      }
      if (!ok) continue
      for (let k = 0; k < n; k++) used.add(i + k)
      const id = key(e.item)
      if (!seen.has(id)) {
        seen.add(id)
        out.push({ item: e.item, index: ws[i]!.i, len: n })
      }
    }
  }
  return out.sort((a, b) => a.index - b.index)
}

export function findSubstances(text: string, kb: Knowledge): { item: QaSubstance; index: number }[] {
  return findNamed(text, names(kb).subs, (s) => s.id)
}

export function findElements(text: string, kb: Knowledge): { item: QaElement; index: number }[] {
  return findNamed(text, names(kb).els, (e) => e.s)
}

/** Вещество по формуле или названию (первое в тексте). */
export function substanceFromText(text: string, kb: Knowledge, allowSingle: boolean): { ascii: string; pretty: string; counts: Record<string, number>; sub?: QaSubstance } | null {
  const f = findFormulas(text, allowSingle)
  const named = findSubstances(text, kb)
  if (f.length && (!named.length || f[0]!.index <= named[0]!.index)) {
    const sub = kb.substanceByFormula.get(f[0]!.ascii.replace(/\*/g, '·'))
    return { ascii: f[0]!.ascii, pretty: f[0]!.pretty, counts: f[0]!.counts, sub: sub ?? kb.substanceByFormula.get(f[0]!.ascii) }
  }
  if (named.length) {
    const s = named[0]!.item
    const parsed = parseFormula(s.fa)
    if (parsed) return { ascii: s.fa, pretty: s.f, counts: parsed.counts, sub: s }
  }
  return null
}

export function elementName(e: QaElement, lang: Lang): string {
  return lang === 'ru' ? e.ru : lang === 'uz' ? e.uz : e.en
}

export function substanceName(s: QaSubstance, lang: Lang): string {
  return lang === 'ru' ? s.ru : lang === 'uz' ? s.uz : s.en
}

// ---------------------------------------------------------------- понятия (brain/kb/concepts.ts)

const GENERIC_CONCEPTS = new Set(['element', 'atom', 'reaction', 'molecule', 'solution', 'metals', 'bond'])
let conceptNames: NameEntry<Concept>[] | null = null

/** Понятия из вопроса в порядке появления; общие («атом», «элемент», «реакция») — после конкретных. */
export function findConcepts(text: string): Concept[] {
  conceptNames ??= buildNames(CONCEPTS, (c) => ({ ru: c.names.ru.join(';'), uz: c.names.uz.join(';'), en: c.names.en.join(';') }))
  const hits = findNamed(text, conceptNames, (c) => c.id)
  const specific = hits.filter((h) => !GENERIC_CONCEPTS.has(h.item.id)).map((h) => h.item)
  const generic = hits.filter((h) => GENERIC_CONCEPTS.has(h.item.id)).map((h) => h.item)
  return [...specific, ...generic]
}
