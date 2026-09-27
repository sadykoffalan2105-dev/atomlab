/**
 * Общие схемы и формулы с «n» книг 7–11 классов открываются в реакторе по конкретному примеру учебника.
 *
 * Для каждой карточки src/data/textbook/equations-gN.json — общей схемы (isGeneralScheme: R, Me, Hal, A + B) или
 * уравнения с «n» (полимер, олеум, ржавчина):
 *  - есть пример (lab.example), иначе причина в списке «химически нельзя» (NO_EXAMPLE);
 *  - пример уравнен по элементам;
 *  - пример — из учебника: уравнение другой карточки того же параграфа, либо его вещества — вещества самой схемы,
 *    прямое подставление (n = 1, 2, 3…; R = H, CH₃, C₂H₅…; Me — металл, названный на странице; Hal — галоген),
 *    либо напечатаны на странице карточки (± 1) или на странице из пояснения («с. 81»); и все конкретные вещества
 *    схемы (без R, Me, Hal, n) есть в примере;
 *  - lab.ok ⇔ реактор собирает пример; ссылка ведёт именно на пример;
 * ядерные реакции 11 класса в химическом реакторе не открываются — причина есть на RU/EN/UZ.
 *
 * Итог: сколько схем открывается, сколько ждут вещества в реакторе (с формулами), сколько химически нельзя.
 * Запуск: npx tsx scripts/test-book-schemes.mts [--list]
 */
import fs from 'node:fs'
import path from 'node:path'
import { equationImbalance, formulaCompositionKey, parseEquationText, parseFormula, type FormulaCounts } from '../src/chemistry/equationFormula.ts'
import { parseReactorLinkParams } from '../src/lab/reactorDeepLink.ts'
import { reasonKey } from '../src/components/learn/book/bookUi.ts'
import { messagesRu } from '../src/i18n/messagesRu.ts'
import { messagesEn } from '../src/i18n/messagesEn.ts'
import { messagesUz } from '../src/i18n/messagesUz.ts'
import { exampleDisplay, reactorExampleTexts, resolveExample } from './textbook-inventory/scheme-example.mts'

const LIST = process.argv.includes('--list')
const ROOT = path.resolve(import.meta.dirname, '..')

type Lab = { ok: boolean; href?: string; reason?: string; altHref?: string; example?: string }
type Rx = { id: string; page: number | null; equation: string; equationAscii: string; isGeneralScheme: boolean; isIonic: boolean; note?: string; lab: Lab }
type Book = { units: { unitId: string; reactions: Rx[] }[] }

/**
 * Карточки, у которых конкретного примера нет и быть не может (химически нельзя показать отдельными молекулами).
 * Ключ — «gN pNN» и начало уравнения.
 */
const NO_EXAMPLE: { grade: number; page: number; startsWith: string; why: string }[] = [
  {
    grade: 10,
    page: 69,
    startsWith: '(-CH2-C(CH3)=CH-CH2-)n + ',
    why: 'вулканизация: сера сшивает цепи каучука мостиками –S–, это реакция полимерной сетки — у (C₅H₈S)ₙ нет звена-молекулы, учебник даёт только рисунок',
  },
]
/** Полимеризация и поликонденсация «nA (+ nB) → (…)n (+ nH₂O)»: при n = 1 реакции нет — звено цепи не молекула. */
const isPolymerization = (ascii: string) => {
  const [l, r] = ascii.split(/\s*(?:->|<=>)\s*/)
  if (!l || !r) return false
  const left = l.split(/\s+\+\s+/)
  const right = r.split(/\s+\+\s+/)
  // мономеры (без «(…)n») → полимер «(…)n» (+ вода при поликонденсации); коэффициенты n в equationAscii сокращены
  return (
    left.every((t) => !/\)n$/.test(t)) &&
    right.some((t) => /\)n$/.test(t)) &&
    right.every((t) => /\)n$/.test(t) || /^\d*n?H2O$/.test(t))
  )
}
const POLYMERIZATION_WHY =
  'полимеризация (поликонденсация): при n = 1 реакции нет — звено цепи не молекула, а число звеньев в учебнике не задано; уравнение разбирается в органической лаборатории'

/** Формула с «n» или дробью n/2 (полимер, олеум, ржавчина, гомологический ряд). */
const hasN = (ascii: string) => /(^|[\s+(])\d*n(?=[A-Z(\[])|\)n(?![a-z])|[·*]\s*n(?=[A-Z])|n\/\d|\bCn(?=H)/.test(ascii)

// ── текст страниц учебника (как у базы знаний: слои PDF 7–10, OCR 11) ──
const CACHE = path.join(ROOT, 'scripts', 'kb', '.cache')
const pageTextCache = new Map<number, Map<number, string>>()
function pageText(grade: number, page: number): string | null {
  let m = pageTextCache.get(grade)
  if (!m) {
    m = new Map()
    try {
      if (grade === 11) {
        for (const f of fs.readdirSync(path.join(CACHE, 'g11'))) {
          const j = JSON.parse(fs.readFileSync(path.join(CACHE, 'g11', f), 'utf8')) as { page: number; text?: string }
          m.set(j.page, j.text ?? '')
        }
      } else {
        const all = JSON.parse(fs.readFileSync(path.join(CACHE, `lines-g${grade}.json`), 'utf8')) as { page: number; lines: { t: string }[] }[]
        for (const p of all) m.set(p.page, p.lines.map((l) => l.t).join('\n'))
      }
    } catch {
      /* кэш текста не собран (npm run kb:extract) — проверка по тексту пропускается */
    }
    pageTextCache.set(grade, m)
  }
  return m.size ? (m.get(page) ?? '') : null
}
const SUB = '₀₁₂₃₄₅₆₇₈₉'
/** Для поиска формулы в тексте: цифры, без пробелов, связей и точек. */
const flat = (s: string) =>
  s
    .replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c)))
    .replace(/[\s\-‐‑–—=≡•·∙*↑↓]/g, '')

// ── вещества примера и схемы ──
type Term = { raw: string; coeff: string; core: string }
function terms(ascii: string): { left: Term[]; right: Term[] } | null {
  const parts = ascii.split(/\s*(?:<=>|->)\s*/)
  if (parts.length !== 2) return null
  const side = (s: string) =>
    s.split(/\s+\+\s+/).map((raw) => {
      const m = /^((?:\d+(?:[.,]\d+)?)?(?:n\/\d+|n)?)(?=[A-Z(\[]|\(|-)/.exec(raw.trim())
      const coeff = m?.[1] ?? ''
      return { raw: raw.trim(), coeff, core: raw.trim().slice(coeff.length) }
    })
  return { left: side(parts[0]!), right: side(parts[1]!) }
}
const plainCore = (core: string) => core.replace(/^[•·∙*]+|[•·∙*]+$/g, '').replace(/(?<=[A-Za-z0-9)\]'])[-‐‑–—=≡]+(?=[A-Z(\[])/g, '').replace(/\)n$/, ')')
function counts(core: string): FormulaCounts | null {
  const f = plainCore(core)
  if (!f || /[^A-Za-z0-9()[\]*·.]/.test(f)) return null
  const p = parseFormula(f.replace(/·/g, '*'))
  return p?.counts ?? null
}
const key = (c: FormulaCounts) => formulaCompositionKey(c)
/** Составы пропорциональны: Fe₂O₃·3H₂O и Fe(OH)₃ (2 : 1), C₆H₁₀O₅ и (C₆H₁₀O₅)ₙ. */
function proportional(a: FormulaCounts, b: FormulaCounts): boolean {
  const ea = Object.keys(a).filter((e) => a[e]! > 0).sort()
  const eb = Object.keys(b).filter((e) => b[e]! > 0).sort()
  if (ea.join() !== eb.join()) return false
  const r = a[ea[0]!]! / b[ea[0]!]!
  return ea.every((e) => Math.abs(a[e]! / b[e]! - r) < 1e-9)
}

const R_GROUPS = ['H', 'CH3', 'C2H5', 'C3H7', 'C4H9', 'C6H5', 'C15H31', 'C17H35', 'C17H33']
const HAL = ['F', 'Cl', 'Br', 'I']
const METALS = ['Li', 'Na', 'K', 'Rb', 'Cs', 'Be', 'Mg', 'Ca', 'Sr', 'Ba', 'Al', 'Mn', 'Zn', 'Cr', 'Fe', 'Cd', 'Co', 'Ni', 'Sn', 'Pb', 'Cu', 'Hg', 'Ag', 'Pd', 'Pt', 'Au']

/** Варианты схемного вещества после прямого подставления: n = 1…6, R/R′ — алкил, Me — металл страницы, Hal — галоген. */
function substitutions(core: string, metals: string[]): FormulaCounts[] {
  let variants = [plainCore(core)]
  // гомологический ряд CₙH₂ₙ₋₂, CₙH₂ₙ₊₁OH
  if (/Cn/.test(core)) {
    variants = []
    for (let k = 1; k <= 6; k++)
      variants.push(
        plainCore(core)
          .replace(/H2n([+-])(\d)/g, (_m, s: string, d: string) => `H${2 * k + (s === '+' ? 1 : -1) * Number(d)}`)
          .replace(/H2n/g, `H${2 * k}`)
          .replace(/Cn/g, `C${k}`),
      )
  }
  const expand = (list: string[], token: RegExp, values: string[]) =>
    list.flatMap((v) => (token.test(v) ? values.map((x) => v.replace(token, x)) : [v]))
  variants = expand(variants, /R'/g, R_GROUPS)
  variants = expand(variants, /R(?![a-z])/g, R_GROUPS)
  variants = expand(variants, /Me(?![a-z])/g, metals)
  variants = expand(variants, /Hal/g, HAL)
  // «n» внутри формулы: H₂SO₄·nSO₃, Fe₂O₃·nH₂O, (C₆H₁₀O₅)n
  variants = variants.flatMap((v) => (/[*·]n(?=[A-Z])/.test(v) ? [1, 2, 3, 4, 5, 6].map((k) => v.replace(/([*·])n(?=[A-Z])/, `$1${k}`)) : [v]))
  const out: FormulaCounts[] = []
  for (const v of variants) {
    const c = counts(v)
    if (c) out.push(c)
  }
  return out
}
const isGeneralTerm = (core: string) => /R(?![a-z])|R'|Me(?![a-z])|Hal|\)n$|[*·]n|Cn/.test(core)

// ── проверка ──
const problems: string[] = []

// записи примера для реактора и для карточки
{
  const eq = (a: unknown, b: unknown, what: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) problems.push(`${what}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`)
  }
  eq(reactorExampleTexts('CH4 + Cl* → CH3* + HCl'), ['CH4 + Cl* -> CH3* + HCl', 'CH4 + Cl -> CH3 + HCl'], 'радикалы')
  eq(reactorExampleTexts('CH2Cl-CH2Cl + 2NaOH → HOCH2CH2OH + 2NaCl').at(-1), 'CH2ClCH2Cl + 2NaOH -> HOCH2CH2OH + 2NaCl', 'связи')
  eq(reactorExampleTexts('2CuSO4 + 2H2O -> 2Cu + O2 + 2H2SO4'), ['2CuSO4 + 2H2O -> 2Cu + O2 + 2H2SO4'], 'неорганика без изменений')
  eq(exampleDisplay('H2SO4 + SO3 -> H2S2O7'), 'H₂SO₄ + SO₃ → H₂S₂O₇', 'отображение')
  eq(exampleDisplay('CH3* + Cl2 → CH3Cl + Cl*'), 'CH₃• + Cl₂ → CH₃Cl + Cl•', 'радикал в карточке')
  eq(exampleDisplay('C3H5(OH)3 + 3HNO3 <=> C3H5(ONO2)3 + 3H2O'), 'C₃H₅(OH)₃ + 3HNO₃ ⇌ C₃H₅(ONO₂)₃ + 3H₂O', 'обратимая')
}
const opened: string[] = []
const waiting: string[] = []
const impossible: string[] = []
const nuclear: string[] = []

for (const key of ['learn.book.rx.unsupported.nuclear', 'lab.deepLink.unsupported.nuclear'] as const) {
  for (const [lang, msgs] of [['RU', messagesRu], ['EN', messagesEn], ['UZ', messagesUz]] as const) {
    const text = (msgs as Record<string, string>)[key]
    if (!text || text.length < 40) problems.push(`нет текста причины ${key} (${lang})`)
  }
}
if (reasonKey('nuclear') !== 'learn.book.rx.unsupported.nuclear') problems.push('reasonKey(nuclear) не ведёт на текст причины')

for (const grade of [7, 8, 9, 10, 11]) {
  const book = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/textbook/equations-g${grade}.json`), 'utf8')) as Book
  for (const u of book.units) {
    for (const r of u.reactions) {
      const label = `g${grade} ${u.unitId}/${r.id} с. ${r.page} ${r.equation}`
      if (r.lab.reason === 'nuclear') {
        nuclear.push(label)
        if (r.lab.ok) problems.push(`${label}: ядерная реакция открывается в химическом реакторе`)
        continue
      }
      if (!r.isGeneralScheme && !hasN(r.equationAscii)) {
        // пример — только у схемы: у обычной карточки реактор открывает её саму («Cl₂ → Cl• + Cl•» — не «CH₄ + Cl₂»)
        if (r.lab.example) problems.push(`${label}: пример ${r.lab.example} у карточки, которая не схема`)
        continue
      }
      const ex = r.lab.example
      if (!ex) {
        const why =
          NO_EXAMPLE.find((x) => x.grade === grade && x.page === r.page && r.equationAscii.startsWith(x.startsWith))?.why ??
          (isPolymerization(r.equationAscii) ? POLYMERIZATION_WHY : null)
        if (why) impossible.push(`${label} — ${why}`)
        else problems.push(`${label}: нет примера учебника (labExample)`)
        continue
      }
      const exAscii = reactorExampleTexts(ex).at(-1)!
      // уравнен
      const parsed = parseEquationText(exAscii)
      if (!parsed || !parsed.reactants.length || !parsed.products.length) problems.push(`${label}: пример «${ex}» не разбирается`)
      else {
        const imb = equationImbalance(parsed)
        if (imb.length) problems.push(`${label}: пример «${ex}» не уравнен (${imb.join(', ')})`)
      }
      // реактор и ссылка
      const { text, res } = resolveExample(ex)
      if (res.ok !== r.lab.ok) problems.push(`${label}: lab.ok ${r.lab.ok}, а реактор по примеру — ${res.ok} (перегенерируйте книгу)`)
      if (r.lab.ok) {
        const p = parseReactorLinkParams(new URLSearchParams((r.lab.href ?? '').split('?')[1] ?? ''))
        if (p?.spec.equation !== text) problems.push(`${label}: ссылка ведёт не на пример (${p?.spec.equation})`)
        opened.push(`${label}  ⇒  ${ex}`)
      } else {
        const formulas = (res.ok ? [] : ((res.details as { formulas?: string[] }).formulas ?? [])).join(', ')
        waiting.push(`${label}  ⇒  ${ex}  [${res.ok ? '' : res.code}${formulas ? `: ${formulas}` : ''}]`)
      }
      // пример из учебника
      const same = u.reactions.find((o) => o !== r && !o.isGeneralScheme && !hasN(o.equationAscii) && sameEquation(o.equationAscii, exAscii))
      if (same) continue
      const scheme = terms(r.equationAscii)
      const exT = terms(exAscii)
      if (!scheme || !exT) {
        problems.push(`${label}: не разобрать схему или пример`)
        continue
      }
      const cited = [...(r.note ?? '').matchAll(/с\.\s*(\d{1,3})/g)].map((m) => Number(m[1]))
      const pages = [...new Set([...(r.page != null ? [r.page - 1, r.page, r.page + 1] : []), ...cited])]
      const texts = pages.map((p) => pageText(grade, p)).filter((t): t is string => t != null)
      const bookText = flat(texts.join('\n'))
      const metals = METALS.filter((m) => new RegExp(`(?<![A-Za-z])${m}(?![a-z])`).test(texts.join('\n')))
      const schemeTerms = [...scheme.left, ...scheme.right]
      const concrete = schemeTerms.filter((t) => !isGeneralTerm(t.core)).map((t) => counts(t.core)).filter((c): c is FormulaCounts => !!c)
      const exTerms = [...exT.left, ...exT.right]
      const exCounts = exTerms.map((t) => ({ t, c: counts(t.core) }))
      // все конкретные вещества схемы есть в примере
      for (const c of concrete) if (!exCounts.some((x) => x.c && key(x.c) === key(c))) problems.push(`${label}: в примере «${ex}» нет вещества схемы ${key(c)}`)
      // каждое вещество примера: из схемы, подставлением или напечатано на странице
      for (const { t, c } of exCounts) {
        if (!c) {
          problems.push(`${label}: вещество примера ${t.core} не разбирается`)
          continue
        }
        const fromScheme = schemeTerms.some((s) => {
          const sc = counts(s.core)
          return (sc && key(sc) === key(c)) || substitutions(s.core, metals).some((v) => key(v) === key(c) || proportional(v, c))
        })
        if (fromScheme) continue
        if (bookText && bookText.includes(flat(plainCore(t.core)))) continue
        problems.push(`${label}: вещество примера ${t.core} не из схемы и не напечатано на с. ${pages.join(', ')}`)
      }
    }
  }
}

function sameEquation(a: string, b: string): boolean {
  const ta = terms(a)
  const tb = terms(b)
  if (!ta || !tb) return false
  const side = (list: Term[]) =>
    list
      .map((t) => counts(t.core))
      .map((c) => (c ? key(c) : '?'))
      .sort()
      .join('+')
  return side(ta.left) === side(tb.left) && side(ta.right) === side(tb.right)
}

const show = (title: string, list: string[]) => {
  console.log(`\n${title}: ${list.length}`)
  if (LIST || list.length <= 40) for (const x of list) console.log(`  - ${x}`)
}
show('открываются в реакторе по примеру учебника', opened)
show('пример есть, ждут вещество в реакторе', waiting)
show('химически нельзя (без примера, с причиной)', impossible)
show('ядерные реакции (в химическом реакторе — осознанно нет; причина на RU/EN/UZ)', nuclear)

if (problems.length) {
  console.error(`\n✗ test-book-schemes: ${problems.length} проблем`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log(
  `\n✓ test-book-schemes: схем и формул с «n» ${opened.length + waiting.length + impossible.length} — в реакторе по примеру ${opened.length}, ждут вещество ${waiting.length}, химически нельзя ${impossible.length}; ядерных ${nuclear.length}`,
)
