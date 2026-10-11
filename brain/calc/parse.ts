/**
 * Школьный калькулятор: разбор условия задачи. Величины — quantities() из tools.ts плюс свои единицы
 * (г/мл, кДж, Кл, А, с/мин/ч, частицы ·10²³, «D(H₂) = 22», «γ = 3», «Z = 26»); вещества — entities.ts;
 * роли — по словам рядом с числом («13 г цинка», «m(Zn) = 13 г», «раствора … 9,8 %»).
 * «Ответ ученика» («Ответ: 36 г», «у меня получилось …») данными не считается.
 */
import type { Knowledge } from '../kb/shards.ts'
import { findElements, findFormulas, findSubstances, pretty } from '../pipeline/entities.ts'
import type { Lang } from '../pipeline/normalize.ts'
import { quantities } from '../pipeline/tools.ts'

export type QUnit = 'g' | 'mol' | 'l' | 'pct' | 'M' | 'N' | 'K' | 'C' | 'kPa' | 'gml' | 'gl' | 'kj' | 'kjmol' | 'gmol' | 'coul' | 'A' | 's' | 'particles'

export type Qty = {
  /** значение в базовых единицах: г, моль, л, %, моль/л, К (температура — всегда в К), кПа, г/мл, кДж, Кл, А, с */
  value: number
  /** как записано в условии (для «Дано») */
  raw: number
  rawUnit: string
  unit: QUnit
  index: number
  end: number
  /** 40 символов после величины (нижний регистр) */
  after: string
  /** 40 символов до величины (нижний регистр) */
  before: string
}

export type Species = { ascii: string; pretty: string; counts: Record<string, number>; index: number; end: number; charge: number }

const PRESS: Record<string, number> = { Pa: 0.001, kPa: 1, MPa: 1000, atm: 101.325, mmHg: 101.325 / 760, bar: 100 }

function num(s: string): number {
  const t = s.replace(/\s+/g, '').replace(',', '.').replace('−', '-')
  const sup = t.match(/^([\d.]+)[·x×*]10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/)
  if (sup) {
    const map: Record<string, string> = { '⁻': '-', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }
    return Number(sup[1]) * 10 ** Number([...sup[2]!].map((c) => map[c] ?? c).join(''))
  }
  const pow = t.match(/^([\d.]+)[·x×*]10\^?(-?\d+)$/)
  if (pow) return Number(pow[1]) * 10 ** Number(pow[2])
  return Number(t)
}

const NUM = String.raw`(\d+(?:[.,]\d+)?(?:\s*[·x×*]\s*10\s*\^?\s*[-−]?\d+|\s*[·x×*]\s*10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)?)`
/** Единицы, которых нет в quantities(): плотность, энергия, заряд, ток, время, частицы, нормальность. */
const EXTRA_RE = new RegExp(
  NUM +
    String.raw`\s*(г\s*\/\s*моль|g\s*\/\s*mol|кдж\s*\/\s*моль|kj\s*\/\s*mol|г\s*\/\s*мл|g\s*\/\s*ml|г\s*\/\s*см[3³]|g\s*\/\s*cm[3³]|г\s*\/\s*л|g\s*\/\s*l|кдж|kj|кл|кулон\p{L}*|coulombs?|kulon\p{L}*|а|a|ампер\p{L}*|amper\p{L}*|amperes?|amps?|с|сек\p{L}*|s|sec\p{L}*|soniya|мин\p{L}*|min\p{L}*|daqiqa\p{L}*|ч|час\p{L}*|h|hours?|soat\p{L}*|н\.|n\.|н|молекул\p{L}*|атом\p{L}*|частиц\p{L}*|molecules?|atoms?|particles?|molekula\p{L}*|zarra\p{L}*)(?![\p{L}\d/])`,
  'giu',
)

const TIME_CTX = /(за|в течение|течени|время|ток|vaqt|davomida|for|during|current|tok|электролиз|elektroliz|electroly|пропуска|o['ʻ’]tkaz|passed)/iu

/** Убрать «ответ ученика»: «Ответ: 36 г», «у меня получилось 2 моль», «javobim …». */
export function stripStudentAnswer(text: string): string {
  return text.replace(/(?:^|[\s.;,!?])(?:ответ\p{L}*|у меня получил\p{L}*|получилось|javob\p{L}*|men topdim|answer|i got|my answer)\s*[:\-—]?\s*[^?]*$/iu, ' ').trim()
}

export function extractQuantities(text: string): Qty[] {
  const out: Qty[] = []
  const lower = text.toLowerCase()
  const push = (value: number, raw: number, rawUnit: string, unit: QUnit, index: number, end: number) => {
    if (!Number.isFinite(value)) return
    if (out.some((q) => index < q.end && end > q.index)) return
    out.push({ value, raw, rawUnit, unit, index, end, after: lower.slice(end, end + 40), before: lower.slice(Math.max(0, index - 40), index) })
  }
  // сначала свои (длиннее: «г/мл» раньше «г»)
  for (const m of text.matchAll(EXTRA_RE)) {
    const v = num(m[1]!)
    const u = m[2]!.toLowerCase().replace(/\s+/g, '')
    const index = m.index ?? 0
    const end = index + m[0].length
    // число — индекс формулы или часть слова («H2», «A1»)
    if (index > 0 && /[A-Za-zА-Яа-я₀-₉)]/.test(text[index - 1]!)) continue
    if (/^(г\/моль|g\/mol)/.test(u)) push(v, v, m[2]!, 'gmol', index, end)
    else if (/^(кдж\/моль|kj\/mol)/.test(u)) push(v, v, m[2]!, 'kjmol', index, end)
    else if (/^(г\/мл|g\/ml|г\/см|g\/cm)/.test(u)) push(v, v, m[2]!, 'gml', index, end)
    else if (/^(г\/л|g\/l)/.test(u)) push(v, v, m[2]!, 'gl', index, end)
    else if (/^(кдж|kj)$/.test(u)) push(v, v, m[2]!, 'kj', index, end)
    else if (/^(кл|кулон|coulomb|kulon)/.test(u)) push(v, v, m[2]!, 'coul', index, end)
    else if (/^(ампер|amper|amp)/.test(u) || (/^(а|a)$/.test(u) && /(ток|tok|current|сил)/iu.test(lower.slice(Math.max(0, index - 40), index)))) push(v, v, m[2]!, 'A', index, end)
    else if (/^(сек|sec|soniya)/.test(u) || (/^(с|s)$/.test(u) && TIME_CTX.test(lower.slice(Math.max(0, index - 50), index)))) push(v, v, m[2]!, 's', index, end)
    else if (/^(мин|min|daqiqa)/.test(u)) push(v * 60, v, m[2]!, 's', index, end)
    else if (/^(час|hour|soat)/.test(u) || (/^(ч|h)$/.test(u) && TIME_CTX.test(lower.slice(Math.max(0, index - 50), index)))) push(v * 3600, v, m[2]!, 's', index, end)
    else if (/^(н\.?|n\.?)$/.test(u) || /^n$/.test(u)) {
      if (/(раствор|eritma|solution|normal|нормальн)/iu.test(lower.slice(Math.max(0, index - 40), end + 40))) push(v, v, m[2]!, 'N', index, end)
    } else if (/^(молекул|атом|частиц|molecul|atom|particle|molekula|zarra)/.test(u)) {
      if (v >= 1e3) push(v, v, m[2]!, 'particles', index, end)
    }
  }
  for (const q of quantities(text)) {
    const index = q.index
    const tail = text.slice(index).match(/^\S+(?:\s*[·x×*]\s*10\S*)?\s*\S+/)?.[0] ?? ''
    const end = index + Math.max(1, tail.length)
    if (index > 0 && /[A-Za-zА-Яа-я₀-₉)(]/.test(text[index - 1]!)) continue
    const u = q.unit
    if (u === 'kg') push(q.value * 1000, q.value, 'кг', 'g', index, end)
    else if (u === 'mg') push(q.value / 1000, q.value, 'мг', 'g', index, end)
    else if (u === 'g') push(q.value, q.value, 'г', 'g', index, end)
    else if (u === 'mol') push(q.value, q.value, 'моль', 'mol', index, end)
    else if (u === 'ml') push(q.value / 1000, q.value, 'мл', 'l', index, end)
    else if (u === 'm3') push(q.value * 1000, q.value, 'м³', 'l', index, end)
    else if (u === 'l') push(q.value, q.value, 'л', 'l', index, end)
    else if (u === 'pct') push(q.value, q.value, '%', 'pct', index, end)
    else if (u === 'M') push(q.value, q.value, 'моль/л', 'M', index, end)
    else if (u === 'K') push(q.value, q.value, 'К', 'K', index, end)
    else if (u === 'C') push(q.value + 273, q.value, '°C', 'K', index, end)
    else if (u in PRESS) push(q.value * PRESS[u]!, q.value, u, 'kPa', index, end)
  }
  return out.sort((a, b) => a.index - b.index)
}

/** Число после метки: «D(H₂) = 22», «γ = 3», «Z = 26». */
export function labeled(text: string, re: RegExp): number | null {
  const m = text.match(re)
  if (!m) return null
  const v = num(m[m.length - 1]!)
  return Number.isFinite(v) ? v : null
}

const DIATOMIC = new Set(['H', 'O', 'N', 'F', 'Cl', 'Br', 'I'])

/** Вещества с позициями: формулы, названия веществ, элементы (элемент → простое вещество). */
export function findSpecies(text: string, kb: Knowledge): Species[] {
  const out: Species[] = []
  const add = (ascii: string, index: number, end: number, counts: Record<string, number> | null, charge = 0) => {
    if (!counts || out.some((x) => x.index === index || (x.ascii === ascii && Math.abs(x.index - index) < 3))) return
    if (out.some((x) => index >= x.index && index < x.end)) return
    out.push({ ascii, pretty: pretty(ascii), counts, index, end, charge })
  }
  for (const f of findFormulas(text, true)) add(f.ascii, f.index, f.index + f.raw.length, f.counts, f.charge)
  const wordEnd = (index: number, nWords: number) => {
    const m = text.slice(index).match(new RegExp(String.raw`^\S+(?:\s+\S+){${Math.max(0, nWords - 1)}}`, 'u'))
    return index + (m?.[0].length ?? 1)
  }
  for (const s of findSubstances(text, kb)) {
    const f = findFormulas(s.item.fa, true)[0]
    add(s.item.fa, s.index, wordEnd(s.index, s.item.ru.split(/\s+/).length), f?.counts ?? null)
  }
  for (const e of findElements(text, kb)) {
    const ascii = DIATOMIC.has(e.item.s) ? `${e.item.s}2` : e.item.s
    add(ascii, e.index, wordEnd(e.index, 1), DIATOMIC.has(e.item.s) ? { [e.item.s]: 2 } : { [e.item.s]: 1 })
  }
  return out.sort((a, b) => a.index - b.index)
}

/** Вещество, к которому относится величина: «13 г цинка» (после), «m(Zn) = 13 г» / «цинк массой 13 г» (до). */
export function speciesOf(q: Qty, sp: Species[], text: string): Species | null {
  const after = sp.find((s) => s.index >= q.end && s.index - q.end <= 28 && !/[\d;?]/.test(text.slice(q.end, s.index)))
  if (after) {
    const gap = text.slice(q.end, after.index).toLowerCase()
    // «200 г раствора серной кислоты» — тоже относится к кислоте (раствор учтён отдельно)
    if (!/[,.]\s/.test(gap) || /раствор|eritma|solution/.test(gap)) return after
  }
  const before = [...sp].reverse().find((s) => s.end <= q.index && q.index - s.end <= 30 && !/[\d;?]/.test(text.slice(s.end, q.index).replace(/^[)\]]/, '')))
  if (before) {
    const gap = text.slice(before.end, q.index).toLowerCase()
    if (/^\s*\)?\s*[=:]\s*$/.test(gap) || /(масс|объ[её]м|количеств|massa|hajm|miqdor|mass|volume|amount|взят|olindi|of)\p{L}*\s*[=:]?\s*$/iu.test(gap) || /^\s*[-—–]?\s*$/.test(gap)) return before
  }
  return null
}

export type AskKind = 'mass' | 'volume' | 'mol' | 'particles' | 'pct' | 'conc' | 'heat' | 'formula' | 'M' | 'density' | 'time' | 'current' | 'times'

const ASK_START = /(сколько|какая|какой|какое|каков|чему равн|найд|вычисл|рассчит|определ|how (much|many)|what|calculate|find|determine|compute|qancha|necha|qanday|toping|hisobla|aniqla|nechta)/iu

/** Вопросная часть задачи: от слова-вопроса до конца (или последнее предложение). */
export function askClause(text: string): { text: string; index: number } {
  const sentences = [...text.matchAll(/[^.?!]+[.?!]?/g)]
  for (let i = sentences.length - 1; i >= 0; i--) {
    const s = sentences[i]![0]
    const m = ASK_START.exec(s)
    if (m) {
      const index = (sentences[i]!.index ?? 0) + (m.index ?? 0)
      return { text: text.slice(index), index }
    }
  }
  const last = sentences[sentences.length - 1]
  return { text: last?.[0] ?? text, index: last?.index ?? 0 }
}

/** Что спрашивают: масса, объём, количество… (в порядке упоминания). */
export function askKinds(clause: string): AskKind[] {
  const c = clause.toLowerCase()
  const found: { k: AskKind; i: number }[] = []
  const add = (k: AskKind, re: RegExp) => {
    const m = re.exec(c)
    if (m) found.push({ k, i: m.index })
  }
  add('mass', /(масс|грамм|\bг\b|\bmass|massa|gramm|weigh|\bkg\b|кг)/u)
  add('volume', /(объ[её]м|литр|\bл\b|volume|hajm|litr|\bm3\b|м3|м³)/u)
  add('mol', /(количеств\p{L}* веществ|\bмоль|сколько моль|\bmol\b|moles|amount of substance|modda miqdor)/u)
  add('particles', /(молекул|атом\p{L}*(?! масс)|частиц|molecules|atoms|particles|molekula|zarra)/u)
  add('heat', /(теплот|тепла|энерги|кдж|heat|energy|\bkj\b|issiqlik|energiya)/u)
  add('pct', /(массов\p{L}* дол|выход|процент|\bω|долю|mass fraction|yield|percent|ulush|unum|foiz)/u)
  add('conc', /(концентрац|молярност|konsentratsiya|molarity|concentration)/u)
  return found.sort((a, b) => a.i - b.i).map((x) => x.k)
}

export type Ctx = {
  text: string
  cmp: string
  lang: Lang
  kb: Knowledge
  qs: Qty[]
  species: Species[]
  ask: { text: string; index: number; kinds: AskKind[] }
}

/** Разбор целиком (ParsedTask строит каждый решатель сам по Ctx). */
export function buildCtx(rawText: string, cmp: string, lang: Lang, kb: Knowledge): Ctx {
  const text = stripStudentAnswer(rawText)
  const qs = extractQuantities(text)
  const species = findSpecies(text, kb)
  const a = askClause(text)
  return { text, cmp, lang, kb, qs, species, ask: { ...a, kinds: askKinds(a.text) } }
}

export const isAmount = (q: Qty) => q.unit === 'g' || q.unit === 'l' || q.unit === 'mol' || q.unit === 'particles'
