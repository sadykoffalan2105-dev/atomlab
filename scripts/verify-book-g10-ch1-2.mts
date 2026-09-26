/**
 * Каталог «Реакции учебника «Kimyo», 10 класс», главы I–II: школьные примеры на месте и химически верны.
 *
 * Источник ожиданий — docs/textbook/g10-ch1-2-organic-examples.md (раздел 1, реакции с. 26–28, 46–50, 54–55).
 * Данные — src/data/textbook/equations-g10.json (конвейер: build-g10-part1.mjs → merge-parts.mjs 10 →
 * build-book-reader.mts --grade 10). json руками не правится — если проверка падает, чините данные конвейера.
 *
 * Проверяет:
 *  1) каждая карточка глав I–II (юниты c1-*, c2-*) уравнена по атомам — кроме общих схем (isGeneralScheme: R, A, B,
 *     смесь продуктов Вюрца) и записей с символами окислителя/восстановителя [O]/[H];
 *  2) страница карточки лежит в диапазоне своего параграфа (pageStart..pageEnd);
 *  3) все реакции спецификации есть: параграф, страница, тип, условия (и пояснение, где оно обязательно);
 *  4) опечатка учебника на с. 28 показана исправленной (R• + Cl₂ → R–Cl + Cl•) с пояснением, неверной записи нет;
 *  5) у органической реакции, которую реактор не открывает, есть ссылка в органическую лабораторию на существующий урок
 *     (для общих схем — по конкретному примеру R = CH₃).
 *
 * Страницы — как в PDF, который открывает приложение (public/textbooks/kimyo-10-ru-2022.pdf). В спецификации
 * у § 2.4 и § 2.6 часть страниц на единицу больше (с. 49/50 и 55 вместо 48/49 и 54): по тексту PDF горение
 * метана, пропана и бутана — с. 48, хлорирование метана и каталитический крекинг декана — с. 49, гидрирование
 * циклопропана/циклопентана и хлорирование циклогексана — с. 54.
 *
 * Run: npx tsx scripts/verify-book-g10-ch1-2.mts
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formulaCompositionKey, parseFormula, type FormulaCounts } from '../src/chemistry/equationFormula.ts'
import { ORGANIC_CURRICULUM } from '../src/data/organicLab/organicCurriculum.ts'
import { G10_G11_EDU_EQUATIONS } from '../src/data/researchLab/g10g11Equations.ts'
import type { ReaderGrade, ReaderReaction, ReaderUnit } from '../src/data/textbook/bookReader.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const grade = JSON.parse(readFileSync(path.join(ROOT, 'src/data/textbook/equations-g10.json'), 'utf8')) as ReaderGrade

const errors: string[] = []
const fail = (m: string) => errors.push(m)

// ── atom balance (independent of the build scripts) ──
const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', 'ₙ': 'n' }
const plain = (s: string) => s.replace(/[₀-₉ₙ]/g, (c) => SUB[c]!)

function termCounts(term0: string): { coeff: number; counts: FormulaCounts } | null {
  let t = plain(term0).trim().replace(/[↑↓]/g, '')
  let coeff = 1
  const m = /^(\d*)n?(?=[A-Z(])/.exec(t)
  if (m && m[0]) {
    coeff = m[1] ? Number(m[1]) : 1
    t = t.slice(m[0].length)
  }
  t = t
    .replace(/^[•·∙*]+|[•·∙*]+$/g, '') // radical dot: Cl•, CH₃•
    .replace(/\)n(?![a-z])/g, ')') // polymer repeating unit (…)n
    .replace(/[-–—=≡]/g, '')
  const f = parseFormula(t)
  return f ? { coeff, counts: f.counts } : null
}

function imbalance(equation: string): string | null {
  const [l, r] = plain(equation).split(/\s*(?:→|⇌|->|<=>)\s*/)
  if (!l || !r) return 'no arrow'
  const sum = (side: string) => {
    const tot: FormulaCounts = {}
    for (const term of side.split(/\s+\+\s+/)) {
      const c = termCounts(term)
      if (!c) throw new Error(`не разобрана формула «${term}»`)
      for (const [el, n] of Object.entries(c.counts)) tot[el] = (tot[el] ?? 0) + n * c.coeff
    }
    return tot
  }
  try {
    const L = sum(l)
    const R = sum(r)
    const diff = [...new Set([...Object.keys(L), ...Object.keys(R)])].filter((el) => (L[el] ?? 0) !== (R[el] ?? 0))
    return diff.length ? diff.map((el) => `${el} ${L[el] ?? 0}/${R[el] ?? 0}`).join(', ') : null
  } catch (e) {
    return (e as Error).message
  }
}

// ── 1–2: every card of chapters I–II ──
const units = grade.units.filter((u) => u.chapterId === 'c1' || u.chapterId === 'c2')
if (units.length < 20) fail(`глав I–II подозрительно мало параграфов: ${units.length}`)
let checked = 0
let schemes = 0
for (const u of units) {
  for (const r of u.reactions) {
    const at = `${u.unitId} ${r.id} «${r.equation}»`
    if (r.page == null) fail(`${at}: нет страницы`)
    else if ((u.pageStart != null && r.page < u.pageStart) || (u.pageEnd != null && r.page > u.pageEnd))
      fail(`${at}: с. ${r.page} вне параграфа ${u.pageStart}–${u.pageEnd}`)
    if (/[*]/.test(r.equation)) fail(`${at}: радикал записан «*», нужна точка «•»`)
    if (r.isGeneralScheme) {
      schemes += 1
      continue
    }
    if (/\[[OH]\]/.test(r.equation)) continue
    const bad = imbalance(r.equation)
    if (bad) fail(`${at}: не уравнено (${bad})`)
    checked += 1
  }
}

// ── 3: the textbook examples of the specification ──
type Expect = { unit: string; page: number; type: string; eq: string; cond?: string[]; note?: string[]; scheme?: boolean }
const E = (unit: string, page: number, type: string, eq: string, more: Partial<Expect> = {}): Expect => ({ unit, page, type, eq, ...more })
const EXPECTED: Expect[] = [
  // § 1.6, с. 26–28
  E('c1-s06', 26, 'substitution', 'CH3-CH3 + Cl2 → CH3-CH2Cl + HCl', { cond: ['свет'] }),
  E('c1-s06', 26, 'substitution', 'CH3-CH2Cl + KOH → CH3-CH2OH + KCl', { cond: ['водный раствор'] }),
  E('c1-s06', 26, 'addition', 'CH3-CH=CH2 + H2 → CH3-CH2-CH3', { note: ['пропен', 'пропан'] }),
  E('c1-s06', 27, 'addition', 'CH2=CH2 + Cl2 → CH2Cl-CH2Cl', { note: ['1,2-дихлорэтан'] }),
  E('c1-s06', 27, 'addition', 'CH2=CH2 + HCl → CH3-CH2Cl', { note: ['хлорэтан'] }),
  E('c1-s06', 27, 'decomposition', 'C10H22 → C5H12 + C5H10'),
  E('c1-s06', 27, 'decomposition', 'CH4 → C + 2H2', { cond: ['1000'] }),
  E('c1-s06', 27, 'elimination', 'CH3-CH2Cl → CH2=CH2 + HCl'),
  E('c1-s06', 27, 'elimination', 'CH3-CH2OH → CH2=CH2 + H2O'),
  E('c1-s06', 27, 'elimination', 'CH3-CH3 → CH2=CH2 + H2'),
  E('c1-s06', 27, 'isomerization', 'CH3-CH2-CH2-CH2-CH3 → CH3-CH(CH3)-CH2-CH3', { note: ['2-метилбутан'] }),
  E('c1-s06', 28, 'condensation', '2CH3-CHO → CH3-CH(OH)-CH2-CHO', { note: ['3-гидроксибутаналь', 'альдольное присоединение'] }),
  E('c1-s06', 28, 'polycondensation', 'nHOOC-C6H4-COOH + nHO-CH2-CH2-OH → (-OC-C6H4-CO-O-CH2-CH2-O-)n + 2nH2O', { note: ['лавсан', '(2n − 1)', 'Q'] }),
  E('c1-s06', 28, 'radical', 'Cl2 → Cl• + Cl•', { cond: ['свет'] }),
  E('c1-s06', 28, 'radical', 'R-H + Cl• → R• + HCl', { scheme: true, note: ['R = CH₃'] }),
  E('c1-s06', 28, 'radical', 'R• + Cl2 → R-Cl + Cl•', { scheme: true, note: ['опечатка', 'R• + HCl', 'R• + Cl₂ → R–Cl + Cl•'] }),
  // § 2.3, с. 46–47
  E('c2-s03', 46, 'substitution', '2CH3-CH2Br + 2Na → CH3-CH2-CH2-CH3 + 2NaBr'),
  E('c2-s03', 46, 'substitution', 'CH3CH2-Br + Br-CH3 + Na → CH3CH2CH3 + CH3CH3 + CH3CH2CH2CH3', { scheme: true, note: ['три'] }),
  E('c2-s03', 46, 'substitution', 'CH3CH2-Br + Br-CH3 + 2Na → CH3CH2CH3 + 2NaBr', { note: ['пропан'] }),
  E('c2-s03', 46, 'substitution', '2CH3-Br + 2Na → CH3CH3 + 2NaBr', { note: ['этан'] }),
  E('c2-s03', 46, 'substitution', '2C2H5Br + 2Na → C4H10 + 2NaBr', { note: ['бутан'] }),
  E('c2-s03', 46, 'exchange', 'CH3COONa + NaOH → CH4 + Na2CO3', { cond: ['t°'] }),
  E('c2-s03', 46, 'exchange', 'C2H5COONa + NaOH → C2H6 + Na2CO3', { cond: ['t°'] }),
  E('c2-s03', 46, 'hydrolysis', 'Al4C3 + 12H2O → 4Al(OH)3 + 3CH4'),
  E('c2-s03', 46, 'exchange', 'Al4C3 + 12HCl → 4AlCl3 + 3CH4', { note: ['только метан'] }),
  E('c2-s03', 46, 'redox', '2R-COONa + 2H2O → R-R + 2CO2 + 2NaOH + H2', { scheme: true, cond: ['электролиз'], note: ['R = CH₃'] }),
  E('c2-s03', 46, 'redox', '2CH3COONa + 2H2O → C2H6 + 2CO2 + 2NaOH + H2', { cond: ['электролиз'], note: ['R = CH₃'] }),
  E('c2-s03', 47, 'decomposition', 'C8H18 → C4H8 + C4H10', { cond: ['кат', 't°'] }),
  E('c2-s03', 47, 'decomposition', 'C12H26 → C6H12 + C6H14', { cond: ['p', 't°'] }),
  E('c2-s03', 47, 'combination', 'C + 2H2 → CH4'),
  E('c2-s03', 47, 'redox', 'CO + 3H2 → CH4 + H2O'),
  // § 2.4 (страницы PDF, см. шапку)
  E('c2-s04', 48, 'combustion', 'CH4 + 2O2 → CO2 + 2H2O'),
  E('c2-s04', 48, 'combustion', 'C3H8 + 5O2 → 3CO2 + 4H2O'),
  E('c2-s04', 48, 'combustion', '2C4H10 + 13O2 → 8CO2 + 10H2O'),
  E('c2-s04', 49, 'decomposition', 'CH3-(CH2)8-CH3 → C4H10 + (CH3)2C=C(CH3)2', { cond: ['кат'], note: ['2,3-диметилбут-2-ен'] }),
  E('c2-s04', 49, 'substitution', 'CH4 + Cl2 → CH3Cl + HCl', { cond: ['свет'], note: ['метилхлорид', 'хлорметан'] }),
  E('c2-s04', 49, 'substitution', 'CH3Cl + Cl2 → CH2Cl2 + HCl', { cond: ['свет'], note: ['метиленхлорид', 'дихлорметан'] }),
  E('c2-s04', 49, 'substitution', 'CH2Cl2 + Cl2 → CHCl3 + HCl', { cond: ['свет'], note: ['хлороформ', 'трихлорметан'] }),
  E('c2-s04', 49, 'substitution', 'CHCl3 + Cl2 → CCl4 + HCl', { cond: ['свет'], note: ['хлорид углерода(IV)', 'тетрахлорметан'] }),
  // § 2.6
  E('c2-s06', 54, 'substitution', 'BrCH2-CH2-CH2-CH2-CH2Br + Zn → C5H10 + ZnBr2', { note: ['1,5-дибромпентан', 'циклопентан'] }),
  E('c2-s06', 54, 'addition', 'C6H6 + 3H2 → C6H12', { cond: ['кат', 't°'] }),
  E('c2-s06', 54, 'addition', 'C3H6 + H2 → CH3-CH2-CH3', { cond: ['Pt', '50–70 °C'], note: ['циклопропан'] }),
  E('c2-s06', 54, 'addition', 'C5H10 + H2 → CH3-CH2-CH2-CH2-CH3', { cond: ['Pt', '300 °C'], note: ['циклопентан'] }),
  E('c2-s06', 54, 'substitution', 'C6H12 + Cl2 → C6H11Cl + HCl', { cond: ['свет'], note: ['хлорциклогексан'] }),
]

const eqKey = (s: string) => plain(s).replace(/[\s–]/g, '').replace(/-/g, '').toLowerCase()
const byUnit = new Map<string, ReaderUnit>(grade.units.map((u) => [u.unitId, u]))
const found = new Set<ReaderReaction>()
for (const x of EXPECTED) {
  const u = byUnit.get(x.unit)
  const at = `${x.unit} с. ${x.page} «${x.eq}»`
  if (!u) {
    fail(`${at}: нет параграфа`)
    continue
  }
  const r = u.reactions.find((y) => eqKey(y.equation) === eqKey(x.eq))
  if (!r) {
    fail(`${at}: карточки нет (в параграфе: ${u.reactions.map((y) => y.equation).join(' | ')})`)
    continue
  }
  found.add(r)
  if (r.page !== x.page) fail(`${at}: страница ${r.page}`)
  if (r.type !== x.type) fail(`${at}: тип ${r.type}, ожидался ${x.type}`)
  if (!!x.scheme !== r.isGeneralScheme) fail(`${at}: isGeneralScheme=${r.isGeneralScheme}`)
  if (r.exercise) fail(`${at}: помечена как задание`)
  for (const c of x.cond ?? []) if (!(r.conditions ?? '').includes(c)) fail(`${at}: в условиях нет «${c}» (${r.conditions ?? '—'})`)
  for (const n of x.note ?? []) if (!(r.note ?? '').includes(n)) fail(`${at}: в пояснении нет «${n}» (${r.note ?? '—'})`)
}

// ── 4: the misprint of p. 28 is shown fixed, never as printed ──
for (const u of units) {
  for (const r of u.reactions) {
    if (/^R[•*]\s*\+\s*HCl\s*→/.test(r.equation)) fail(`${u.unitId} ${r.id}: опечатка учебника «${r.equation}» показана как уравнение`)
  }
}

// ── 5: organic reactions outside the reactor lead to an existing organic lab lesson ──
// Lesson equations (equation mode) by composition of both sides; a card with the same substances must link to
// that lesson — the same rule build-book-reader.mts uses (score 100), so new lesson equations are picked up.
const sideKey = (terms: readonly string[]) =>
  terms
    .map((t) => termCounts(t))
    .map((c) => (c ? formulaCompositionKey(c.counts) : '?'))
    .sort()
    .join('+')
const splitSides = (eq: string) => plain(eq).split(/\s*(?:→|⇌|->|<=>)\s*/).map((s) => s.split(/\s+\+\s+/))
const lessonsByEq = new Map<string, Set<string>>()
for (const lesson of ORGANIC_CURRICULUM) {
  for (const e of G10_G11_EDU_EQUATIONS.filter((x) => lesson.equationIds.includes(x.id))) {
    const k = `${sideKey(e.left)}=${sideKey(e.right)}`
    lessonsByEq.set(k, new Set([...(lessonsByEq.get(k) ?? []), lesson.id]))
  }
}
const lessonIds = new Set(ORGANIC_CURRICULUM.map((l) => l.id))
let organicLinks = 0
let exactLessons = 0
let organicWithoutLesson = 0
for (const u of units) {
  for (const r of u.reactions) {
    if (r.lab.ok) continue
    const alt = r.lab.altHref
    const at = `${u.unitId} ${r.id} «${r.equation}»`
    if (alt) {
      const q = new URLSearchParams(alt.split('?')[1] ?? '')
      if (!alt.startsWith('/organic?') || !lessonIds.has(q.get('lesson') ?? '') || q.get('mode') !== 'equation') fail(`${at}: плохая ссылка ${alt}`)
      else organicLinks += 1
    } else if (r.lab.reason === 'organic') organicWithoutLesson += 1
    // a textbook scheme of the specification links by its concrete example (R = CH₃)
    if (found.has(r) && r.isGeneralScheme && !alt) fail(`${at}: у схемы нет ссылки в органическую лабораторию`)
    if (r.isGeneralScheme) continue
    const [l, p] = splitSides(r.equation)
    if (!l || !p) continue
    const want = lessonsByEq.get(`${sideKey(l)}=${sideKey(p)}`)
    if (!want) continue
    exactLessons += 1
    const got = alt ? new URLSearchParams(alt.split('?')[1] ?? '').get('lesson') : null
    if (!got || !want.has(got)) fail(`${at}: есть уравнение урока (${[...want].join(', ')}), а ссылка ${alt ?? 'отсутствует'}`)
  }
}
// composition key sanity: CH₃• counts as CH₃ (the lesson matcher strips radical dots the same way)
const ch3 = termCounts('CH₃•')
if (!ch3 || formulaCompositionKey(ch3.counts) !== formulaCompositionKey({ C: 1, H: 3 })) fail('радикал CH₃• не разбирается как CH₃')

if (errors.length) {
  console.error(`verify-book-g10-ch1-2: ${errors.length} ошибок`)
  for (const e of errors) console.error('  ✗ ' + e)
  process.exit(1)
}
console.log(
  `verify-book-g10-ch1-2: главы I–II — ${units.length} параграфов, уравнено ${checked} карточек, схем ${schemes}; ` +
    `примеры спецификации ${EXPECTED.length}/${EXPECTED.length}; ссылок в органическую лабораторию ${organicLinks} ` +
    `(совпадений с уравнением урока ${exactLessons}; органических без подходящего урока ${organicWithoutLesson})`,
)
