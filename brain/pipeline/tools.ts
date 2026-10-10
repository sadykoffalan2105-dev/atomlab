/**
 * Шаг 5: детерминированные инструменты (до LLM). Их результат — и в ответ, и в промпт как «ВЫЧИСЛЕНО ТОЧНО»;
 * LLM числа менять нельзя (post-check сверяет). Округление — 2 знака, атомные массы — IUPAC (atomicData).
 *
 * molarMass · massFraction · stoich (моль ↔ масса ↔ объём, 22,4 л/моль н.у.) · balance · oxidation ·
 * solution (ω, C) · dilution · gas (pV = nRT) · thermo (ΔH = ΣΔfH прод − ΣΔfH исх) · pH (сильные кислоты/щёлочи) ·
 * элемент с номером > 118 · перевод единиц · арифметика.
 */
import { molarMassGMol, type ElementSymbol, isElementSymbol, atomicMassU } from '../../src/chemistry/data/atomicData.ts'
import { equationImbalance, formatEquationUnicode, parseEquationText, type EquationSpecies } from '../../src/chemistry/equationFormula.ts'
import { minimalIntegerCoefficients } from '../../src/chemistry/equationNullspace.ts'
import { evaluateArithmetic, extractArithmetic, prettyExpression } from '../../src/learn/brain/human/safeMath.ts'
import { convertUnitsQuery } from '../../src/learn/brain/human/unitConvert.ts'
import type { Knowledge } from '../kb/shards.ts'
import { findElements, findFormulas, findSubstances, pretty, substanceFromText, toAsciiFormula } from './entities.ts'
import type { Lang } from './normalize.ts'

export type ToolResult = {
  tool: string
  /** Готовый текст для ученика (язык вопроса). */
  text: string
  /** Строка для промпта LLM — «ВЫЧИСЛЕНО ТОЧНО». */
  facts: string
  /** Ключевые числа/строки, которые обязаны остаться в ответе. */
  numbers: string[]
  errorTags?: string[]
  good?: number
}

const L = (lang: Lang, ru: string, uz: string, en: string) => (lang === 'ru' ? ru : lang === 'uz' ? uz : en)

/** Число: 2 знака после запятой, без хвостовых нулей; ru/uz — десятичная запятая. */
export function fmt(x: number, lang: Lang, digits = 2): string {
  if (!Number.isFinite(x)) return String(x)
  const abs = Math.abs(x)
  let s: string
  if (abs !== 0 && (abs < 0.01 || abs >= 1e7)) s = x.toExponential(2).replace(/e\+?(-?)(\d+)/, (_m, sign: string, p: string) => `·10${toSup(sign + p)}`)
  else s = String(Number(x.toFixed(digits)))
  return lang === 'en' ? s : s.replace('.', ',')
}

function toSup(s: string): string {
  const map: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
  return [...s].map((c) => map[c] ?? c).join('')
}

function num(s: string): number {
  return Number(s.replace(',', '.'))
}

const U = {
  gmol: (l: Lang) => L(l, 'г/моль', 'g/mol', 'g/mol'),
  g: (l: Lang) => L(l, 'г', 'g', 'g'),
  mol: (l: Lang) => L(l, 'моль', 'mol', 'mol'),
  l: (l: Lang) => L(l, 'л', 'l', 'L'),
  moll: (l: Lang) => L(l, 'моль/л', 'mol/l', 'mol/L'),
}

// ---------------------------------------------------------------- величины в тексте

type Quantity = { value: number; unit: 'g' | 'kg' | 'mg' | 'mol' | 'l' | 'ml' | 'm3' | 'pct' | 'M' | 'K' | 'C' | 'Pa' | 'kPa' | 'MPa' | 'atm' | 'mmHg' | 'bar'; index: number; after: string }

const UNIT_RE =
  /(\d+(?:[.,]\d+)?(?:\s*[·x×*]\s*10\s*\^?\s*[-−]?\d+|\s*[·x×*]\s*10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)?)\s*(кг|kg|мг|mg|г(?:р(?:амм\p{L}*)?)?|g(?:ramm?s?)?|gramm|моль\s*\/\s*л|mol\s*\/\s*l|моль|молей|mol(?:e|es)?|мл|ml|м3|м³|m3|m³|л(?:итр\p{L}*)?|l(?:itr\p{L}*|iters?|itres?)?|%|процент\p{L}*|foiz|percent|м(?=\s|$|[,.;)])|M(?=\s|$|[,.;)])|моль\/л|mol\/l|°\s*c|°\s*с|°|градус\p{L}*|k(?=\s|$|[,.;)])|к(?=\s|$|[,.;)])|кельвин\p{L}*|kelvin|кпа|kpa|мпа|mpa|па|pa|атм|atm|мм\s*рт\.?\s*ст\.?|mmhg|бар|bar)(?![\p{L}])/giu

function parseValue(s: string): number {
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

export function quantities(text: string): Quantity[] {
  const out: Quantity[] = []
  for (const m of text.matchAll(UNIT_RE)) {
    const value = parseValue(m[1]!)
    if (!Number.isFinite(value)) continue
    const u = m[2]!.toLowerCase().replace(/\s+/g, '')
    let unit: Quantity['unit'] | null = null
    if (/^(кг|kg)$/.test(u)) unit = 'kg'
    else if (/^(мг|mg)$/.test(u)) unit = 'mg'
    else if (/^(г|гр|грамм|g|gram|grams|gramm)/.test(u) && !/^(градус)/.test(u)) unit = 'g'
    else if (/^(моль\/л|mol\/l)$/.test(u) || m[2] === 'M') unit = 'M' // u уже без пробелов
    else if (/^(моль|молей|mol)/.test(u)) unit = 'mol'
    else if (/^(мл|ml)$/.test(u)) unit = 'ml'
    else if (/^(м3|м³|m3|m³)$/.test(u)) unit = 'm3'
    else if (/^(л|литр|l|litr|liter|litre)/.test(u)) unit = 'l'
    else if (/^(%|процент|foiz|percent)/.test(u)) unit = 'pct'
    else if (/^(°c|°с|°|градус)/.test(u)) unit = 'C'
    else if (/^(k|к|кельвин|kelvin)$/.test(u)) unit = 'K'
    else if (/^(кпа|kpa)$/.test(u)) unit = 'kPa'
    else if (/^(мпа|mpa)$/.test(u)) unit = 'MPa'
    else if (/^(па|pa)$/.test(u)) unit = 'Pa'
    else if (/^(атм|atm)$/.test(u)) unit = 'atm'
    else if (/^(ммрт|mmhg)/.test(u)) unit = 'mmHg'
    else if (/^(бар|bar)$/.test(u)) unit = 'bar'
    else if (u === 'м') unit = 'M'
    if (!unit) continue
    const end = (m.index ?? 0) + m[0].length
    out.push({ value, unit, index: m.index ?? 0, after: text.slice(end, end + 40).toLowerCase() })
  }
  return out
}

const toGrams = (q: Quantity) => (q.unit === 'kg' ? q.value * 1000 : q.unit === 'mg' ? q.value / 1000 : q.value)
const toLiters = (q: Quantity) => (q.unit === 'ml' ? q.value / 1000 : q.unit === 'm3' ? q.value * 1000 : q.value)
const isMass = (q: Quantity) => q.unit === 'g' || q.unit === 'kg' || q.unit === 'mg'
const isVol = (q: Quantity) => q.unit === 'l' || q.unit === 'ml' || q.unit === 'm3'

// ---------------------------------------------------------------- молярная масса и ω

function massOf(counts: Record<string, number>): number | null {
  for (const el of Object.keys(counts)) if (!isElementSymbol(el)) return null
  return molarMassGMol(counts as Partial<Record<ElementSymbol, number>>)
}

function arOf(el: string): string {
  const a = atomicMassU(el as ElementSymbol)
  return String(Number(a.toFixed(a >= 100 ? 1 : 3)))
}

function massBreakdown(counts: Record<string, number>, lang: Lang): string {
  return Object.entries(counts)
    .map(([el, n]) => `${n > 1 ? `${n}·` : ''}${fmtAr(arOf(el), lang)}`)
    .join(' + ')
}
const fmtAr = (s: string, lang: Lang) => (lang === 'en' ? s : s.replace('.', ','))

function molarMassTool(text: string, cmp: string, lang: Lang, kb: Knowledge): ToolResult | null {
  if (!/(молярн\p{L}* масс|молекулярн\p{L}* масс|относительн\p{L}* молекулярн|molar mass|molecular (weight|mass)|molyar massa|molekulyar massa|\bm\s*\(|\bmr\s*\(|вес моля)/iu.test(cmp)) return null
  const fs = findFormulas(text, true).slice(0, 3)
  const items = fs.length ? fs.map((f) => ({ pretty: f.pretty, counts: f.counts })) : (() => {
    const s = substanceFromText(text, kb, true)
    return s ? [{ pretty: s.pretty, counts: s.counts }] : []
  })()
  if (!items.length) return null
  const lines: string[] = []
  const numbers: string[] = []
  for (const it of items) {
    const M = massOf(it.counts)
    if (M == null) continue
    const v = fmt(M, lang)
    numbers.push(v)
    lines.push(`M(${it.pretty}) = ${massBreakdown(it.counts, lang)} = ${v} ${U.gmol(lang)}`)
  }
  if (!lines.length) return null
  const head = L(lang, 'Молярная масса (сумма атомных масс по формуле):', 'Molyar massa (formuladagi atom massalari yigʻindisi):', 'Molar mass (sum of the atomic masses in the formula):')
  const text1 = `${head}\n${lines.join('\n')}.`
  return { tool: 'molarMass', text: text1, facts: lines.join('; '), numbers }
}

function massFractionTool(text: string, cmp: string, lang: Lang, kb: Knowledge): ToolResult | null {
  if (!/(массов\p{L}* дол|ω|w\s*\(|процентн\p{L}* (содержан|состав)|mass (fraction|percent)|percent(age)? (by mass|composition)|massa ulush|foiz (tarkib|ulush))/iu.test(cmp)) return null
  if (/раствор|eritma|solution/iu.test(cmp) && quantities(text).filter(isMass).length >= 2) return null // это задача на раствор
  const sub = (() => {
    // формула, но не одиночный символ (он — искомый элемент); «кислорода» — это элемент, а не вещество O₂
    const f = findFormulas(text, false).filter((x) => Object.keys(x.counts).length > 1)
    if (f.length) return { pretty: f[0]!.pretty, counts: f[0]!.counts }
    const named = findSubstances(text, kb).filter((x) => Object.keys(x.item.comp).length > 1)
    return named.length ? { pretty: named[0]!.item.f, counts: named[0]!.item.comp } : null
  })()
  if (!sub) return null
  const M = massOf(sub.counts)
  if (M == null) return null
  let target: string | null = null
  const sym = text.match(/(?:ω|w)\s*\(\s*([A-Z][a-z]?)\s*\)/)
  if (sym && sub.counts[sym[1]!]) target = sym[1]!
  if (!target) for (const e of findElements(text, kb)) if (sub.counts[e.item.s]) target = e.item.s
  if (!target) for (const f of findFormulas(text, true)) if (Object.keys(f.counts).length === 1 && !/\d/.test(f.raw) && sub.counts[f.ascii]) target = f.ascii
  const els = target ? [target] : Object.keys(sub.counts)
  const lines: string[] = []
  const numbers: string[] = []
  for (const el of els) {
    const n = sub.counts[el]!
    const part = atomicMassU(el as ElementSymbol) * n
    const w = (part / M) * 100
    const v = fmt(w, lang)
    numbers.push(v)
    lines.push(`ω(${el}) = ${n > 1 ? `${n}·` : ''}${fmtAr(arOf(el), lang)} / ${fmt(M, lang)} · 100% = ${v}%`)
  }
  const head = L(lang, `Массовая доля элемента в ${sub.pretty}: ω = n·Ar / M · 100%.`, `${sub.pretty} dagi elementning massa ulushi: ω = n·Ar / M · 100%.`, `Mass fraction of an element in ${sub.pretty}: ω = n·Ar / M · 100%.`)
  return { tool: 'massFraction', text: `${head}\n${lines.join('\n')}.`, facts: `M(${sub.pretty}) = ${fmt(M, lang)}; ${lines.join('; ')}`, numbers }
}

// ---------------------------------------------------------------- моль ↔ масса ↔ объём

function stoichTool(text: string, cmp: string, lang: Lang, kb: Knowledge): ToolResult | null {
  const qs = quantities(text).filter((q) => isMass(q) || q.unit === 'mol' || isVol(q))
  if (qs.length !== 1) return null
  if (!/(сколько|какой|какова|каков|найд|вычисл|рассчит|определ|how many|what (mass|volume|amount)|calculate|find|necha|qancha|hisobla|toping|aniqla)/iu.test(cmp)) return null
  const s = substanceFromText(text, kb, true)
  if (!s) return null
  const M = massOf(s.counts)
  if (M == null) return null
  const q = qs[0]!
  const wantMol = /(моль|молей|количеств\p{L}* веществ|\bmol|moles|amount of substance|modda miqdori)/iu.test(cmp.replace(UNIT_RE, ' '))
  const wantMass = /(грамм|масс|mass|massa|\bг\b|weigh)/iu.test(cmp.replace(UNIT_RE, ' '))
  const wantVol = /(объ[её]м|литр|volume|hajm|\bл\b)/iu.test(cmp.replace(UNIT_RE, ' '))
  const wantN = /(молекул|частиц|атомов|molecules|particles|molekula|zarrach)/iu.test(cmp)
  const NA = 6.022e23
  let n: number
  const steps: string[] = []
  if (isMass(q)) {
    n = toGrams(q) / M
    steps.push(`n = m / M = ${fmt(toGrams(q), lang)} / ${fmt(M, lang)} = ${fmt(n, lang)} ${U.mol(lang)}`)
  } else if (q.unit === 'mol') {
    n = q.value
  } else {
    n = toLiters(q) / 22.4
    steps.push(`n = V / Vm = ${fmt(toLiters(q), lang)} / 22,4 = ${fmt(n, lang)} ${U.mol(lang)}`.replace('22,4', lang === 'en' ? '22.4' : '22,4'))
  }
  const numbers: string[] = []
  if (wantMass && !isMass(q)) {
    const m = n * M
    steps.push(`m = n · M = ${fmt(n, lang)} · ${fmt(M, lang)} = ${fmt(m, lang)} ${U.g(lang)}`)
    numbers.push(fmt(m, lang))
  }
  if (wantVol && !isVol(q)) {
    const V = n * 22.4
    steps.push(`V = n · Vm = ${fmt(n, lang)} · ${lang === 'en' ? '22.4' : '22,4'} = ${fmt(V, lang)} ${U.l(lang)} ${L(lang, '(для газа при н. у.)', '(gaz uchun, n. sh.)', '(for a gas at STP)')}`)
    numbers.push(fmt(V, lang))
  }
  if (wantN) {
    const N = n * NA
    steps.push(`N = n · Nₐ = ${fmt(n, lang)} · 6,022·10²³ = ${fmt(N, lang)}`.replace('6,022', lang === 'en' ? '6.022' : '6,022'))
    numbers.push(fmt(N, lang))
  }
  if ((wantMol || !numbers.length) && q.unit !== 'mol') numbers.push(fmt(n, lang))
  if (!steps.length) return null
  const head = L(lang, `M(${s.pretty}) = ${fmt(M, lang)} г/моль.`, `M(${s.pretty}) = ${fmt(M, lang)} g/mol.`, `M(${s.pretty}) = ${fmt(M, lang)} g/mol.`)
  return { tool: 'stoich', text: `${head}\n${steps.join('\n')}.`, facts: `${head} ${steps.join('; ')}`, numbers }
}

// ---------------------------------------------------------------- уравнения

/** Вырезать уравнение из текста: формулы и «+» вокруг первой стрелки. */
export function extractEquation(text: string): string | null {
  const t = text
    .replace(/(?<=[A-Za-z0-9₀-₉)\]])\s*(\+)\s*(?=\d*\s*[A-Z(\[])/g, ' + ')
    .replace(/\s*(→|->|⟶|⇄|⇌|=)\s*/g, ' $1 ')
  const toks = t.split(/\s+/)
  const arrowAt = toks.findIndex((x) => /^(→|->|⟶|⇄|⇌|=)$/.test(x))
  if (arrowAt < 0) return null
  // «Balance», «Uravnyay» — слова, а не формулы: в формуле после заглавной не бывает двух строчных подряд
  const isPart = (x: string) => x === '+' || (/^\d*[A-Z(\[][A-Za-z0-9₀-₉()[\]·*⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹^+-]*[↑↓]?[.,;:!?]?$/.test(x) && !/[a-z]{2}/.test(x)) || x === '?' || x === '…' || x === '...'
  let a = arrowAt - 1
  while (a >= 0 && isPart(toks[a]!)) a--
  let b = arrowAt + 1
  while (b < toks.length && isPart(toks[b]!)) b++
  const left = toks.slice(a + 1, arrowAt).filter((x) => x !== '?')
  const right = toks.slice(arrowAt + 1, b).map((x) => x.replace(/[.,;:!]+$/, '').replace(/[↑↓]/g, ''))
  if (!left.length || left[0] === '+') return null
  const arrow = toks[arrowAt] === '->' || toks[arrowAt] === '⟶' || toks[arrowAt] === '=' ? '→' : toks[arrowAt]!
  return `${left.join(' ')} ${arrow} ${right.filter((x) => x !== '?' && x !== '…' && x !== '...').join(' ')}`.replace(/\s*\+\s*$/, '').trim()
}

type Balanced = { eq: string; reactants: EquationSpecies[]; products: EquationSpecies[]; check: string; studentBalanced: boolean | null }

export function balanceEquation(eqText: string): Balanced | null | 'unbalanceable' | 'noproducts' {
  const toAscii = eqText.replace(/[₀-₉]/g, (c) => toAsciiFormula(c))
  if (/(→|⇄|⇌)\s*$/.test(toAscii.trim())) return 'noproducts'
  const parsed = parseEquationText(toAscii)
  if (!parsed) return null
  if (!parsed.products.length) return 'noproducts'
  const all = [...parsed.reactants, ...parsed.products]
  if (all.some((s) => !s.counts || s.electron)) return null
  const hadCoeffs = /(^|\s|\+\s*)\d+\s*[A-Z(]/.test(toAscii)
  const studentBalanced = hadCoeffs ? equationImbalance(parsed).length === 0 : null
  const coeffs = minimalIntegerCoefficients(
    all.map((s) => s.counts!),
    parsed.reactants.length,
    all.map((s) => s.charge),
  )
  if (!coeffs) return 'unbalanceable'
  const reactants = parsed.reactants.map((s, i) => ({ ...s, coeff: coeffs[i]! }))
  const products = parsed.products.map((s, i) => ({ ...s, coeff: coeffs[parsed.reactants.length + i]! }))
  const eq = formatEquationUnicode({ reactants, products, arrow: parsed.arrow === '=' ? '→' : parsed.arrow })
  const sum = (list: EquationSpecies[]) => {
    const c: Record<string, number> = {}
    for (const s of list) for (const [el, n] of Object.entries(s.counts!)) c[el] = (c[el] ?? 0) + n * s.coeff
    return c
  }
  const L1 = sum(reactants)
  const check = Object.keys(L1)
    .map((el) => `${el}: ${L1[el]} = ${L1[el]}`)
    .join(', ')
  return { eq, reactants, products, check, studentBalanced }
}

/** Реакции из qaBank с тем же набором исходных веществ — подсказка продуктов. */
function knownReactions(reactants: string[], kb: Knowledge): string[] {
  const want = [...new Set(reactants.map((r) => r.replace(/^\d+/, '')))].sort().join('|')
  const out: string[] = []
  for (const r of kb.qa.reactions) {
    if ([...new Set(r.r)].sort().join('|') === want) out.push(r.eq)
    if (out.length >= 2) break
  }
  return out
}

function balanceTool(text: string, _cmp: string, lang: Lang, kb: Knowledge): ToolResult | null {
  const eqText = extractEquation(text)
  if (!eqText) return null
  const res = balanceEquation(eqText)
  if (res === null) return null
  if (res === 'noproducts' || res === 'unbalanceable') {
    const left = eqText.split(/→|⇄|⇌/)[0]!.split('+').map((x) => toAsciiFormula(x.trim())).filter(Boolean)
    const known = knownReactions(left, kb)
    if (res === 'noproducts') {
      if (known.length) {
        const b = balanceEquation(toAsciiFormula(known[0]!))
        const eq = b && typeof b === 'object' ? b.eq : known[0]!
        return {
          tool: 'balance',
          text: L(lang, `Продукты не указаны. Для этих исходных веществ в учебнике есть реакция: ${eq}.`, `Mahsulotlar koʻrsatilmagan. Bu moddalar uchun darslikda shunday reaksiya bor: ${eq}.`, `No products were given. For these reactants the textbook has: ${eq}.`),
          facts: `${L(lang, 'реакция из учебника', 'darslikdagi reaksiya', 'textbook reaction')}: ${eq}`,
          numbers: [eq],
        }
      }
      return {
        tool: 'balance',
        text: L(
          lang,
          'Чтобы уравнять, нужны продукты реакции — напишите, что получается справа от стрелки. Подсказка: металл + кислород → оксид; металл + кислота → соль + H₂; кислота + основание → соль + вода; горение органики → CO₂ + H₂O.',
          'Tenglashtirish uchun reaksiya mahsulotlari kerak — strelkadan oʻngda nima hosil boʻlishini yozing. Maslahat: metall + kislorod → oksid; metall + kislota → tuz + H₂; kislota + asos → tuz + suv; organik modda yonishi → CO₂ + H₂O.',
          'To balance it I need the products — write what forms to the right of the arrow. Hint: metal + oxygen → oxide; metal + acid → salt + H₂; acid + base → salt + water; burning organics → CO₂ + H₂O.',
        ),
        facts: L(lang, 'продукты не указаны', 'mahsulotlar koʻrsatilmagan', 'products missing'),
        numbers: [],
      }
    }
    return {
      tool: 'balance',
      text: L(
        lang,
        `Уравнение ${eqText} не уравнивается единственным образом: проверьте формулы веществ (атомы каждого элемента должны встречаться с обеих сторон) или это схема из двух реакций.`,
        `${eqText} tenglamasi yagona usulda tenglashmaydi: moddalar formulalarini tekshiring (har bir element atomlari ikkala tomonda boʻlishi kerak) yoki bu ikki reaksiyaning sxemasi.`,
        `${eqText} cannot be balanced uniquely: check the formulas (every element must appear on both sides) or it may be two reactions combined.`,
      ),
      facts: 'not balanceable uniquely',
      numbers: [],
    }
  }
  const tags: string[] = []
  let good = 0
  let note = ''
  if (res.studentBalanced === false) {
    tags.push('unbalanced_equation')
    note = L(lang, ' В вашей записи коэффициенты не сходятся — сравните число атомов слева и справа.', ' Sizning yozuvingizda koeffitsiyentlar mos emas — chap va oʻngdagi atomlar sonini solishtiring.', ' Your coefficients do not match — compare the atom counts on both sides.')
  } else if (res.studentBalanced === true) {
    good = 1
    note = L(lang, ' Ваши коэффициенты верны.', ' Sizning koeffitsiyentlaringiz toʻgʻri.', ' Your coefficients are correct.')
  }
  return {
    tool: 'balance',
    text: `${L(lang, 'Уравненное уравнение', 'Tenglashtirilgan tenglama', 'Balanced equation')}: ${res.eq}\n${L(lang, 'Проверка по атомам', 'Atomlar boʻyicha tekshiruv', 'Atom check')}: ${res.check}.${note}`,
    facts: `${res.eq} (${res.check})`,
    numbers: [res.eq],
    errorTags: tags,
    good,
  }
}

// ---------------------------------------------------------------- степени окисления

const ALKALI = new Set(['Li', 'Na', 'K', 'Rb', 'Cs', 'Fr'])
const ALK_EARTH = new Set(['Be', 'Mg', 'Ca', 'Sr', 'Ba', 'Ra'])
const NEG: Record<string, number> = { F: -1, Cl: -1, Br: -1, I: -1, At: -1, O: -2, S: -2, Se: -2, Te: -2, N: -3, P: -3, As: -3, C: -4, Si: -4, B: -3, H: -1 }
const PEROXIDES = new Set(['H2O2', 'Na2O2', 'K2O2', 'Li2O2', 'BaO2', 'CaO2', 'SrO2', 'MgO2', 'ZnO2'])
const SUPEROXIDES = new Set(['KO2', 'NaO2', 'RbO2', 'CsO2'])
const METALS = new Set(
  'Li Be Na Mg Al K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Cs Ba La Ce Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Fr Ra U'.split(' '),
)

export type OxResult = { states: Record<string, number>; average: Set<string> }

export function oxidationStates(ascii: string, counts: Record<string, number>, charge: number, kb: Knowledge): OxResult | null {
  const els = Object.keys(counts)
  const states: Record<string, number> = {}
  const average = new Set<string>()
  if (els.length === 1) {
    states[els[0]!] = charge / counts[els[0]!]!
    if (!Number.isInteger(states[els[0]!])) average.add(els[0]!)
    return { states, average }
  }
  const plain = ascii.replace(/[*·].*$/, '')
  const hasMetal = els.some((e) => METALS.has(e))
  for (const e of els) {
    if (e === 'F') states[e] = -1
    else if (ALKALI.has(e)) states[e] = 1
    else if (ALK_EARTH.has(e)) states[e] = 2
    else if (e === 'Al') states[e] = 3
    else if (e === 'Zn') states[e] = 2
    else if (e === 'H') states[e] = hasMetal && els.length === 2 ? -1 : 1
    else if (e === 'O' && !counts.F) states[e] = PEROXIDES.has(plain) ? -1 : SUPEROXIDES.has(plain) ? -0.5 : -2
  }
  const solve = () => {
    const unknown = els.filter((e) => states[e] === undefined)
    if (unknown.length !== 1) return unknown
    const e = unknown[0]!
    let sum = 0
    for (const x of els) if (x !== e) sum += states[x]! * counts[x]!
    states[e] = (charge - sum) / counts[e]!
    if (!Number.isInteger(states[e])) average.add(e)
    return []
  }
  let rest = solve()
  let guard = 0
  while (rest.length > 1 && guard++ < 4) {
    const enOf = (e: string) => kb.elementBySymbol.get(e)?.en_ ?? 2
    const most = [...rest].sort((a, b) => enOf(b) - enOf(a))[0]!
    if (NEG[most] === undefined) return null
    states[most] = NEG[most]!
    rest = solve()
  }
  if (rest.length) return null
  for (const e of els) if (Math.abs(states[e]!) > 8) return null
  return { states, average }
}

function fmtOx(x: number, lang: Lang): string {
  if (Number.isInteger(x)) return x > 0 ? `+${x}` : x === 0 ? '0' : `−${-x}`
  for (const d of [2, 3, 4, 5, 6, 8]) {
    const n = x * d
    if (Math.abs(n - Math.round(n)) < 1e-9) return `${x > 0 ? '+' : '−'}${Math.abs(Math.round(n))}/${d}`
  }
  return fmt(x, lang)
}

function oxidationTool(text: string, cmp: string, lang: Lang, kb: Knowledge): ToolResult | null {
  if (!/(степен\p{L}* окислен|с\.\s?о\.|oxidation (state|number)|oksidlanish daraja)/iu.test(cmp)) return null
  const fs = findFormulas(text, true)
  if (!fs.length) return null
  // целевой элемент: одиночный символ или название («марганца»)
  const singles = fs.filter((f) => Object.keys(f.counts).length === 1 && !/\d/.test(f.raw) && f.charge === 0)
  const compounds = fs.filter((f) => !singles.includes(f))
  const targets = compounds.length ? compounds.slice(0, 2) : singles.slice(0, 1)
  let target: string | null = singles.length && compounds.length ? singles[0]!.ascii : null
  if (!target) for (const e of findElements(text, kb)) if (targets.some((t) => t.counts[e.item.s])) target = e.item.s
  const lines: string[] = []
  const numbers: string[] = []
  for (const f of targets) {
    const r = oxidationStates(f.ascii, f.counts, f.charge, kb)
    if (!r) continue
    const parts = Object.keys(f.counts).map((e) => `${e} ${fmtOx(r.states[e]!, lang)}${r.average.has(e) ? L(lang, ' (средняя)', ' (oʻrtacha)', ' (average)') : ''}`)
    const sumNote = L(lang, `сумма = ${f.charge === 0 ? '0' : fmtOx(f.charge, lang)}`, `yigʻindi = ${f.charge === 0 ? '0' : fmtOx(f.charge, lang)}`, `sum = ${f.charge === 0 ? '0' : fmtOx(f.charge, lang)}`)
    if (target && f.counts[target]) {
      const v = fmtOx(r.states[target]!, lang)
      numbers.push(v)
      lines.push(L(lang, `Степень окисления ${target} в ${f.pretty}: ${v}`, `${f.pretty} da ${target} ning oksidlanish darajasi: ${v}`, `Oxidation state of ${target} in ${f.pretty}: ${v}`) + ` (${parts.join(', ')}; ${sumNote})`)
    } else {
      for (const e of Object.keys(f.counts)) numbers.push(fmtOx(r.states[e]!, lang))
      lines.push(`${f.pretty}: ${parts.join(', ')} (${sumNote})`)
    }
  }
  if (!lines.length) return null
  const rule = L(
    lang,
    'Правила: F всегда −1; O обычно −2 (в пероксидах −1); H +1 (в гидридах металлов −1); щелочные металлы +1, щёлочноземельные +2, Al +3; сумма степеней окисления равна заряду частицы.',
    'Qoidalar: F doim −1; O odatda −2 (peroksidlarda −1); H +1 (metall gidridlarida −1); ishqoriy metallar +1, ishqoriy-yer metallari +2, Al +3; oksidlanish darajalari yigʻindisi zarracha zaryadiga teng.',
    'Rules: F is always −1; O is usually −2 (−1 in peroxides); H is +1 (−1 in metal hydrides); alkali metals +1, alkaline-earth metals +2, Al +3; the sum equals the particle charge.',
  )
  return { tool: 'oxidation', text: `${lines.join('.\n')}.\n${rule}`, facts: lines.join('; '), numbers }
}

// ---------------------------------------------------------------- растворы

function solutionTool(text: string, cmp: string, lang: Lang, kb: Knowledge): ToolResult | null {
  if (/разбав|dilut|suyult/iu.test(cmp)) return null
  const qs = quantities(text)
  const masses = qs.filter(isMass)
  const pct = qs.find((q) => q.unit === 'pct')
  const isSol = /(раствор|eritma|solution|растворил|eritildi|dissolved)/iu.test(cmp)
  if (!isSol) return null
  const words = (q: Quantity) => q.after
  // m(вещества) нужно для m(раствора) с ω%
  if (pct && masses.length === 1 && /(сколько|какую|какая|найд|how much|what mass|necha|qancha)/iu.test(cmp)) {
    const mSol = toGrams(masses[0]!)
    const mSolute = (mSol * pct.value) / 100
    const mWater = mSol - mSolute
    const v1 = fmt(mSolute, lang)
    return {
      tool: 'solution',
      text: L(lang, `m(вещества) = m(раствора) · ω = ${fmt(mSol, lang)} · ${fmt(pct.value / 100, lang, 4)} = ${v1} г; воды нужно ${fmt(mWater, lang)} г.`, `m(modda) = m(eritma) · ω = ${fmt(mSol, lang)} · ${fmt(pct.value / 100, lang, 4)} = ${v1} g; suv ${fmt(mWater, lang)} g kerak.`, `m(solute) = m(solution) · ω = ${fmt(mSol, lang)} · ${fmt(pct.value / 100, lang, 4)} = ${v1} g; water needed: ${fmt(mWater, lang)} g.`),
      facts: `m(solute) = ${v1} g, m(water) = ${fmt(mWater, lang)} g`,
      numbers: [v1],
    }
  }
  if (masses.length >= 2 && /(массов\p{L}* дол|процент|концентрац|ω|mass fraction|percent|concentration|massa ulush|foiz)/iu.test(cmp)) {
    // роли по слову после числа: «180 г воды» — вода, «200 г раствора» — раствор, остальное — вещество
    const role = (q: Quantity) => (/^\s*(вод|suv|water|h2o)/iu.test(words(q)) ? 'water' : /^\s*(раствор|eritma|solution)/iu.test(words(q)) ? 'solution' : 'solute')
    const soluteQ = masses.find((q) => role(q) === 'solute')
    const waterQ = masses.find((q) => role(q) === 'water')
    const solQ = masses.find((q) => role(q) === 'solution')
    if (!soluteQ || (!waterQ && !solQ)) return null
    const solute = toGrams(soluteQ)
    const isWater = !solQ
    const second = toGrams(isWater ? waterQ! : solQ!)
    const total = isWater ? solute + second : second
    if (total <= 0 || solute > total) return null
    const w = (solute / total) * 100
    const v = fmt(w, lang)
    const formula = isWater ? `ω = m(в-ва) / (m(в-ва) + m(воды)) = ${fmt(solute, lang)} / (${fmt(solute, lang)} + ${fmt(second, lang)})` : `ω = m(в-ва) / m(р-ра) = ${fmt(solute, lang)} / ${fmt(second, lang)}`
    const f2 = lang === 'ru' ? formula : formula.replace('m(в-ва)', 'm(solute)').replace(/m\(в-ва\)/g, 'm(solute)').replace('m(воды)', 'm(water)').replace('m(р-ра)', 'm(solution)')
    return { tool: 'solution', text: `${f2} · 100% = ${v}%.`, facts: `ω = ${v}%`, numbers: [v] }
  }
  // молярная концентрация
  const vol = qs.find(isVol)
  if (vol && /(молярн\p{L}* концентрац|концентрац|моль\/л|molar|molarity|concentration|konsentratsiya)/iu.test(cmp)) {
    let n: number | null = null
    const step: string[] = []
    const mol = qs.find((q) => q.unit === 'mol')
    if (mol) n = mol.value
    else if (masses.length) {
      const s = substanceFromText(text, kb, true)
      const M = s ? massOf(s.counts) : null
      if (s && M) {
        n = toGrams(masses[0]!) / M
        step.push(`n = ${fmt(toGrams(masses[0]!), lang)} / ${fmt(M, lang)} = ${fmt(n, lang)} ${U.mol(lang)}`)
      }
    }
    if (n == null) return null
    const V = toLiters(vol)
    const C = n / V
    const v = fmt(C, lang)
    step.push(`C = n / V = ${fmt(n, lang)} / ${fmt(V, lang)} = ${v} ${U.moll(lang)}`)
    return { tool: 'solution', text: step.join('\n') + '.', facts: step.join('; '), numbers: [v] }
  }
  return null
}

function dilutionTool(text: string, cmp: string, lang: Lang): ToolResult | null {
  if (!/(разбав|добавил\p{L}* \d+[.,]?\d*\s*(г|мл|л)?\s*вод|dilut|suyult)/iu.test(cmp)) return null
  const qs = quantities(text)
  const vols = qs.filter(isVol)
  const conc = qs.filter((q) => q.unit === 'M' || q.unit === 'pct')
  const masses = qs.filter(isMass)
  if (masses.length >= 2 && conc.length === 1 && conc[0]!.unit === 'pct') {
    const mSol = toGrams(masses[0]!)
    const mAdd = toGrams(masses[1]!)
    const w2 = (mSol * conc[0]!.value) / (mSol + mAdd)
    const v = fmt(w2, lang)
    return { tool: 'dilution', text: `ω₂ = m₁·ω₁ / (m₁ + m(${L(lang, 'воды', 'suv', 'water')})) = ${fmt(mSol, lang)}·${fmt(conc[0]!.value, lang)}% / ${fmt(mSol + mAdd, lang)} = ${v}%.`, facts: `ω2 = ${v}%`, numbers: [v] }
  }
  if (vols.length >= 2 && conc.length === 1) {
    const [v1, v2] = vols.map(toLiters) as [number, number]
    const c1 = conc[0]!.value
    const c2 = (c1 * v1) / v2
    const unit = conc[0]!.unit === 'pct' ? '%' : ` ${U.moll(lang)}`
    const v = fmt(c2, lang)
    return { tool: 'dilution', text: `C₁V₁ = C₂V₂ → C₂ = ${fmt(c1, lang)} · ${fmt(v1, lang)} / ${fmt(v2, lang)} = ${v}${unit}.`, facts: `C2 = ${v}${unit}`, numbers: [v] }
  }
  if (vols.length === 1 && conc.length === 2) {
    const [c1, c2] = conc.map((c) => c.value) as [number, number]
    const v1 = toLiters(vols[0]!)
    const v2 = (c1 * v1) / c2
    const v = fmt(v2 * 1000, lang)
    return { tool: 'dilution', text: `C₁V₁ = C₂V₂ → V₂ = ${fmt(c1, lang)} · ${fmt(v1, lang)} / ${fmt(c2, lang)} = ${fmt(v2, lang)} ${U.l(lang)} (${v} ${L(lang, 'мл', 'ml', 'mL')}).`, facts: `V2 = ${fmt(v2, lang)} L`, numbers: [fmt(v2, lang)] }
  }
  return null
}

// ---------------------------------------------------------------- газы

function gasTool(text: string, cmp: string, lang: Lang): ToolResult | null {
  const qs = quantities(text)
  const hasTP = qs.some((q) => q.unit === 'K' || q.unit === 'C') && qs.some((q) => ['Pa', 'kPa', 'MPa', 'atm', 'mmHg', 'bar'].includes(q.unit))
  if (!hasTP && !/(pv\s*=\s*nrt|менделеева|клапейрон|идеальн\p{L}* газ|давлени|ideal gas|pressure|bosim)/iu.test(cmp)) return null
  const T = qs.find((q) => q.unit === 'K' || q.unit === 'C')
  const p = qs.find((q) => ['Pa', 'kPa', 'MPa', 'atm', 'mmHg', 'bar'].includes(q.unit))
  const V = qs.find(isVol)
  const n = qs.find((q) => q.unit === 'mol')
  if (!T) return null
  const TK = T.unit === 'C' ? T.value + 273.15 : T.value
  const toPa = (q: Quantity) => q.value * ({ Pa: 1, kPa: 1e3, MPa: 1e6, atm: 101325, mmHg: 133.322, bar: 1e5 } as Record<string, number>)[q.unit]!
  const R = 8.314
  const r = lang === 'en' ? '8.314' : '8,314'
  if (p && n && !V) {
    const vol = ((n.value * R * TK) / toPa(p)) * 1000
    const v = fmt(vol, lang)
    return { tool: 'gas', text: `V = nRT / p = ${fmt(n.value, lang)} · ${r} · ${fmt(TK, lang)} / ${fmt(toPa(p), lang)} ${L(lang, 'Па', 'Pa', 'Pa')} = ${v} ${U.l(lang)}.`, facts: `V = ${v} L`, numbers: [v] }
  }
  if (p && V && !n) {
    const moles = (toPa(p) * toLiters(V) * 1e-3) / (R * TK)
    const v = fmt(moles, lang)
    return { tool: 'gas', text: `n = pV / RT = ${fmt(toPa(p), lang)} · ${fmt(toLiters(V) / 1000, lang, 5)} / (${r} · ${fmt(TK, lang)}) = ${v} ${U.mol(lang)}.`, facts: `n = ${v} mol`, numbers: [v] }
  }
  if (V && n && !p) {
    const pa = (n.value * R * TK) / (toLiters(V) * 1e-3)
    const v = fmt(pa / 1000, lang)
    return { tool: 'gas', text: `p = nRT / V = ${fmt(n.value, lang)} · ${r} · ${fmt(TK, lang)} / ${fmt(toLiters(V) / 1000, lang, 5)} = ${v} ${L(lang, 'кПа', 'kPa', 'kPa')}.`, facts: `p = ${v} kPa`, numbers: [v] }
  }
  return null
}

// ---------------------------------------------------------------- термохимия

/** Стандартные энтальпии образования ΔfH°298, кДж/моль (справочные значения; вода — жидкая). */
const DFH: Record<string, number> = {
  H2O: -285.8, 'H2O(g)': -241.8, CO2: -393.5, CO: -110.5, CH4: -74.8, C2H6: -84.7, C3H8: -103.8, C4H10: -126.2, C2H4: 52.3, C2H2: 226.7,
  C6H6: 49.0, CH3OH: -238.7, C2H5OH: -277.7, C6H12O6: -1273.3, C12H22O11: -2222.0, NH3: -46.1, NO: 90.3, NO2: 33.2, N2O: 82.1, N2O4: 9.2,
  SO2: -296.8, SO3: -395.7, H2S: -20.6, HCl: -92.3, HF: -271.1, HBr: -36.4, HI: 26.5, NaCl: -411.2, KCl: -436.7, CaCO3: -1206.9,
  CaO: -635.1, 'Ca(OH)2': -986.1, MgO: -601.7, Al2O3: -1675.7, Fe2O3: -824.2, Fe3O4: -1118.4, FeO: -272.0, CuO: -157.3, ZnO: -348.3,
  SiO2: -910.9, P2O5: -1492.0, H2SO4: -814.0, HNO3: -174.1, NaOH: -425.6, KOH: -424.8, Na2CO3: -1130.7, NaHCO3: -950.8, H2O2: -187.8,
  O3: 142.7, CCl4: -135.4, CHCl3: -134.5, HCOOH: -424.7, CH3COOH: -484.5, C8H18: -250.1,
}
const ELEMENTAL = new Set(['H2', 'O2', 'N2', 'C', 'S', 'Fe', 'Al', 'Mg', 'Ca', 'Na', 'K', 'Zn', 'Cu', 'Cl2', 'F2', 'Br2', 'I2', 'P', 'Si', 'Hg', 'Ag', 'Pb', 'Li'])

function thermoTool(text: string, cmp: string, lang: Lang): ToolResult | null {
  if (!/(энтальп|тепловой эффект|δh|Δh|теплот\p{L}* реакц|enthalpy|heat of reaction|entalpiya|issiqlik effekt)/iu.test(cmp)) return null
  const eqText = extractEquation(text)
  if (!eqText) return null
  const b = balanceEquation(eqText)
  if (!b || typeof b !== 'object') return null
  const val = (s: EquationSpecies) => (ELEMENTAL.has(s.formula) ? 0 : DFH[s.formula])
  const missing = [...b.reactants, ...b.products].filter((s) => val(s) === undefined).map((s) => pretty(s.formula))
  if (missing.length) {
    return {
      tool: 'thermo',
      text: L(
        lang,
        `${b.eq}. Для ΔH = ΣΔfH(продуктов) − ΣΔfH(исходных) нужны справочные ΔfH° для: ${missing.join(', ')} — возьмите их из таблицы в учебнике (точных значений я не придумываю).`,
        `${b.eq}. ΔH = ΣΔfH(mahsulotlar) − ΣΔfH(boshlangʻich) uchun ${missing.join(', ')} ning ΔfH° qiymatlari kerak — ularni darslik jadvalidan oling (aniq sonlarni oʻylab topmayman).`,
        `${b.eq}. ΔH = ΣΔfH(products) − ΣΔfH(reactants) needs tabulated ΔfH° for: ${missing.join(', ')} — take them from your data table (I do not invent exact values).`,
      ),
      facts: `${b.eq}; ΔfH missing for ${missing.join(', ')}`,
      numbers: [],
    }
  }
  const sum = (list: EquationSpecies[]) => list.reduce((s, x) => s + x.coeff * val(x)!, 0)
  const dH = sum(b.products) - sum(b.reactants)
  const v = fmt(dH, lang, 1)
  const kind = dH < 0 ? L(lang, 'экзотермическая (тепло выделяется)', 'ekzotermik (issiqlik ajraladi)', 'exothermic (heat is released)') : L(lang, 'эндотермическая (тепло поглощается)', 'endotermik (issiqlik yutiladi)', 'endothermic (heat is absorbed)')
  const detail = (list: EquationSpecies[]) => list.map((s) => `${s.coeff > 1 ? `${s.coeff}·` : ''}(${fmt(val(s)!, lang, 1)})`).join(' + ')
  return {
    tool: 'thermo',
    text: `${b.eq}\nΔH° = [${detail(b.products)}] − [${detail(b.reactants)}] = ${v} ${L(lang, 'кДж', 'kJ', 'kJ')} — ${kind}. ${L(lang, '(ΔfH° простых веществ = 0; вода — жидкая.)', '(oddiy moddalar ΔfH° = 0; suv — suyuq.)', '(ΔfH° of elements = 0; water taken as liquid.)')}`,
    facts: `${b.eq}; ΔH° = ${v} kJ`,
    numbers: [v],
  }
}

// ---------------------------------------------------------------- pH

const STRONG_ACIDS: Record<string, number> = { HCl: 1, HBr: 1, HI: 1, HNO3: 1, HClO4: 1, H2SO4: 2 }
const STRONG_BASES: Record<string, number> = { NaOH: 1, KOH: 1, LiOH: 1, RbOH: 1, CsOH: 1, 'Ba(OH)2': 2, 'Ca(OH)2': 2, 'Sr(OH)2': 2 }

function phTool(text: string, cmp: string, lang: Lang): ToolResult | null {
  if (!/(\bph\b|\bрн\b|водородн\p{L}* показател)/iu.test(cmp)) return null
  const conc = quantities(text).find((q) => q.unit === 'M')
  const fs = findFormulas(text, false)
  const f = fs[0]
  if (!conc || !f) return null
  const c = conc.value
  const ka = text.match(/k[aа]\s*=\s*([\d.,]+\s*(?:[·x×*]\s*10\s*\^?\s*[-−]?\d+|[·x×*]\s*10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)?)/i)
  if (STRONG_ACIDS[f.ascii]) {
    const h = c * STRONG_ACIDS[f.ascii]!
    const ph = -Math.log10(h)
    const v = fmt(ph, lang)
    return { tool: 'pH', text: L(lang, `${f.pretty} — сильная кислота, диссоциирует полностью: [H⁺] = ${fmt(h, lang, 6)} моль/л; pH = −lg[H⁺] = ${v}.`, `${f.pretty} — kuchli kislota, toʻliq dissotsilanadi: [H⁺] = ${fmt(h, lang, 6)} mol/l; pH = −lg[H⁺] = ${v}.`, `${f.pretty} is a strong acid and dissociates fully: [H⁺] = ${fmt(h, lang, 6)} mol/L; pH = −log[H⁺] = ${v}.`), facts: `pH = ${v}`, numbers: [v] }
  }
  if (STRONG_BASES[f.ascii]) {
    const oh = c * STRONG_BASES[f.ascii]!
    const ph = 14 + Math.log10(oh)
    const v = fmt(ph, lang)
    return { tool: 'pH', text: L(lang, `${f.pretty} — сильное основание: [OH⁻] = ${fmt(oh, lang, 6)} моль/л; pOH = ${fmt(-Math.log10(oh), lang)}; pH = 14 − pOH = ${v}.`, `${f.pretty} — kuchli asos: [OH⁻] = ${fmt(oh, lang, 6)} mol/l; pOH = ${fmt(-Math.log10(oh), lang)}; pH = 14 − pOH = ${v}.`, `${f.pretty} is a strong base: [OH⁻] = ${fmt(oh, lang, 6)} mol/L; pOH = ${fmt(-Math.log10(oh), lang)}; pH = 14 − pOH = ${v}.`), facts: `pH = ${v}`, numbers: [v] }
  }
  if (ka) {
    const K = parseValue(ka[1]!)
    const h = Math.sqrt(K * c)
    const v = fmt(-Math.log10(h), lang)
    return { tool: 'pH', text: L(lang, `Слабая кислота: [H⁺] ≈ √(Ka·C) = √(${fmt(K, lang)} · ${fmt(c, lang)}) = ${fmt(h, lang, 6)} моль/л; pH ≈ ${v}.`, `Kuchsiz kislota: [H⁺] ≈ √(Ka·C) = ${fmt(h, lang, 6)} mol/l; pH ≈ ${v}.`, `Weak acid: [H⁺] ≈ √(Ka·C) = ${fmt(h, lang, 6)} mol/L; pH ≈ ${v}.`), facts: `pH ≈ ${v}`, numbers: [v] }
  }
  return {
    tool: 'pH',
    text: L(lang, `${f.pretty} — не сильная кислота/щёлочь из школьного списка: для pH нужна константа диссоциации Ka (или Kb). Формула: [H⁺] ≈ √(Ka·C). Пришлите Ka — посчитаю точно.`, `${f.pretty} kuchli kislota/ishqor emas: pH uchun dissotsilanish konstantasi Ka (yoki Kb) kerak. Formula: [H⁺] ≈ √(Ka·C). Ka ni yuboring — aniq hisoblayman.`, `${f.pretty} is not on the strong acid/base list: pH needs the dissociation constant Ka (or Kb). Formula: [H⁺] ≈ √(Ka·C). Send me Ka and I will compute it exactly.`),
    facts: 'pH needs Ka',
    numbers: [],
  }
}

// ---------------------------------------------------------------- элемент > 118, единицы, арифметика

function elementGuardTool(cmp: string, lang: Lang, kb: Knowledge): ToolResult | null {
  const m = cmp.match(/(?:элемент\p{L}*\s*(?:№|номер\p{L}*|под номером)?\s*|element\s*(?:no\.?|number|#)?\s*|(\d{2,4})\s*-?\s*(?:й|ой|го|chi|th)?\s*element)(\d{1,4})?/u)
  if (!m) return null
  const z = Number(m[2] ?? m[1])
  if (!z || !Number.isFinite(z)) return null
  if (z > 118) {
    return {
      tool: 'element',
      text: L(
        lang,
        `Элемента с номером ${z} пока не существует: открыто и названо 118 элементов, последний — оганесон (Og, №118). Поэтому ни года открытия, ни свойств у «элемента ${z}» нет — их можно лишь предсказывать по периодическому закону (он попал бы в 8-й период).`,
        `${z}-raqamli element hali mavjud emas: 118 ta element ochilgan va nomlangan, oxirgisi — oganeson (Og, №118). Shuning uchun «${z}-element»ning ochilgan yili ham, xossalari ham yoʻq — ularni faqat davriy qonun asosida bashorat qilish mumkin (u 8-davrga tushardi).`,
        `There is no element number ${z} yet: 118 elements have been discovered and named, the last is oganesson (Og, No. 118). So “element ${z}” has no discovery year or measured properties — they can only be predicted from the periodic law (it would sit in period 8).`,
      ),
      facts: `element ${z} does not exist (max Z = 118)`,
      numbers: ['118'],
    }
  }
  if (z >= 1 && z <= 118 && /(элемент\p{L}*\s*(№|номер)|element\s*(no|number|#))/iu.test(cmp)) {
    const e = kb.elementByZ.get(z)
    if (!e) return null
    const A = lang === 'en' ? String(e.A) : String(e.A).replace('.', ',')
    return {
      tool: 'element',
      text: L(lang, `Элемент №${z} — ${e.ru} (${e.s}), Ar = ${A}, ${e.per}-й период, ${e.grp}-я группа.`, `${z}-element — ${e.uz} (${e.s}), Ar = ${A}, ${e.per}-davr, ${e.grp}-guruh.`, `Element No. ${z} is ${e.en} (${e.s}), Ar = ${A}, period ${e.per}, group ${e.grp}.`),
      facts: `Z=${z} ${e.s} ${e.en} Ar=${e.A}`,
      numbers: [e.s],
    }
  }
  return null
}

function unitsTool(text: string, lang: Lang): ToolResult | null {
  const u = convertUnitsQuery(text, lang)
  if (!u) return null
  return { tool: 'units', text: u.text, facts: u.text, numbers: [] }
}

function arithmeticTool(text: string, lang: Lang): ToolResult | null {
  if (/[A-Z][a-z]?\d/.test(text)) return null
  const expr = extractArithmetic(text)
  if (!expr) return null
  const v = evaluateArithmetic(expr)
  if (v == null) return null
  const s = fmt(v, lang, 6)
  return { tool: 'arithmetic', text: `${prettyExpression(expr)} = ${s}`, facts: `${expr} = ${s}`, numbers: [s] }
}

// ---------------------------------------------------------------- запуск

export function runTools(text: string, cmp: string, lang: Lang, kb: Knowledge): ToolResult[] {
  const out: ToolResult[] = []
  const push = (r: ToolResult | null) => {
    if (r && out.length < 2 && !out.some((x) => x.tool === r.tool)) out.push(r)
  }
  const thermo = thermoTool(text, cmp, lang)
  push(thermo)
  if (!thermo) push(balanceTool(text, cmp, lang, kb))
  push(oxidationTool(text, cmp, lang, kb))
  push(phTool(text, cmp, lang))
  push(gasTool(text, cmp, lang))
  const dil = dilutionTool(text, cmp, lang)
  push(dil)
  if (!dil) push(solutionTool(text, cmp, lang, kb))
  if (!out.some((r) => r.tool === 'solution' || r.tool === 'dilution')) push(massFractionTool(text, cmp, lang, kb))
  if (!out.length) push(stoichTool(text, cmp, lang, kb))
  if (!out.length) push(molarMassTool(text, cmp, lang, kb))
  if (!out.length) push(elementGuardTool(cmp, lang, kb))
  if (!out.length) push(unitsTool(text, lang))
  if (!out.length) push(arithmeticTool(text, lang))
  return out
}

/** Проверка ДЗ: число ученика рядом с «=» / «ответ» против точного расчёта. */
export function checkStudentNumbers(text: string, results: ToolResult[], lang: Lang): { note: string; tags: string[]; good: number } {
  const claimed = [...text.matchAll(/(?:=|ответ\p{L}*\s*:?|javob\p{L}*\s*:?|answer\s*:?)\s*(-?\d+(?:[.,]\d+)?)/giu)].map((m) => num(m[1]!))
  if (!claimed.length) return { note: '', tags: [], good: 0 }
  const exact = results.flatMap((r) => r.numbers.map((n) => num(n.replace(/^[+−]/, (s) => (s === '−' ? '-' : ''))))).filter((x) => Number.isFinite(x))
  if (!exact.length) return { note: '', tags: [], good: 0 }
  const ok = claimed.some((c) => exact.some((e) => Math.abs(c - e) <= Math.max(0.02 * Math.abs(e), 0.01)))
  if (ok) return { note: L(lang, 'Ваш ответ совпадает с точным расчётом — молодец!', 'Javobingiz aniq hisob bilan mos keladi — barakalla!', 'Your answer matches the exact calculation — well done!'), tags: [], good: 1 }
  const c = claimed[claimed.length - 1]!
  return {
    note: L(lang, `У вас получилось ${fmt(c, lang)}, а точный расчёт даёт ${results[0]!.numbers[0]} — проверьте единицы и молярные массы.`, `Sizda ${fmt(c, lang)} chiqdi, aniq hisob esa ${results[0]!.numbers[0]} beradi — birliklar va molyar massalarni tekshiring.`, `You got ${fmt(c, lang)}, but the exact calculation gives ${results[0]!.numbers[0]} — check the units and molar masses.`),
    tags: ['calc_mismatch'],
    good: 0,
  }
}
