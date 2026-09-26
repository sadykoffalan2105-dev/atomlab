/**
 * Каталог «Реакции учебника «Kimyo», 10 класс», с. 55–167 (главы II–III): каждая строка таблиц «Реакции»
 * расшифровок ведущего есть карточкой своей страницы, уравнена, ошибки учебника показаны исправленными.
 *
 * Источник ожиданий — docs/textbook/g10-ch2-alkenes-dienes.md, g10-ch2-alkynes-arenes.md, g10-ch3-alcohols.md,
 * g10-ch3-phenols-carbonyls.md, g10-ch3-acids-esters-carbs.md (уравнения — в исправленном виде, как их надо показывать).
 * Данные — src/data/textbook/equations-g10.json (конвейер: g10-part1-data-e.mjs → build-g10-part1.mjs;
 * g10p2-fixes.mjs → build-g10-part2.mjs; merge-parts.mjs 10; build-book-reader.mts --grade 10). json руками не правится.
 *
 * Проверяет:
 *  1) каждая карточка с. 55–167 уравнена по атомам — кроме общих схем (R, R′, Hal, CₙH₂ₙ₋₂, n/2);
 *  2) каждая строка расшифровок найдена на своей странице — по записи формулы, иначе по составу обеих сторон
 *     (структурные формулы «CH₂=CH₂» и «C₂H₄» совпадают), общая схема — карточкой-схемой; где надо — условия,
 *     пояснение (запись учебника с ошибкой), обратимость ⇄, задание (карточка-задание с текстом учебника);
 *  3) ошибки учебника не показаны как уравнения (неуравненные записи и химически неверные «2C₂H₅Cl + Zn …»).
 *
 * Run: npx tsx scripts/verify-book-g10-ch2-3.mts
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formulaCompositionKey, parseFormula, type FormulaCounts } from '../src/chemistry/equationFormula.ts'
import type { ReaderGrade, ReaderReaction, ReaderUnit } from '../src/data/textbook/bookReader.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const grade = JSON.parse(readFileSync(path.join(ROOT, 'src/data/textbook/equations-g10.json'), 'utf8')) as ReaderGrade

const errors: string[] = []
const fail = (m: string) => errors.push(m)

const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', 'ₙ': 'n' }
const plain = (s: string) => s.replace(/[₀-₉ₙ]/g, (c) => SUB[c]!)
const ARROW = /\s*(?:→|⇌|⇄|->|<=>)\s*/

function termCounts(term0: string): { coeff: number; counts: FormulaCounts } | null {
  let t = plain(term0).trim().replace(/[↑↓]/g, '')
  let coeff = 1
  const m = /^(\d*)n?(?=[A-Z([])/.exec(t)
  if (m && m[0]) {
    coeff = m[1] ? Number(m[1]) : 1
    t = t.slice(m[0].length)
  }
  t = t
    .replace(/^[•·∙*]+|[•·∙*]+$/g, '')
    .replace(/\)n(?![a-z])/g, ')')
    .replace(/[-–—=≡]/g, '')
  const f = parseFormula(t)
  return f ? { coeff, counts: f.counts } : null
}

function sides(eq: string): [string[], string[]] | null {
  const parts = plain(eq).split(ARROW)
  if (parts.length !== 2) return null
  return [parts[0]!.split(/\s+\+\s+/), parts[1]!.split(/\s+\+\s+/)]
}

function imbalance(equation: string): string | null {
  const s = sides(equation)
  if (!s) return 'не одна стрелка'
  const sum = (list: string[]) => {
    const tot: FormulaCounts = {}
    for (const term of list) {
      const c = termCounts(term)
      if (!c) throw new Error(`не разобрана формула «${term}»`)
      for (const [el, n] of Object.entries(c.counts)) tot[el] = (tot[el] ?? 0) + n * c.coeff
    }
    return tot
  }
  try {
    const L = sum(s[0])
    const R = sum(s[1])
    const diff = [...new Set([...Object.keys(L), ...Object.keys(R)])].filter((el) => (L[el] ?? 0) !== (R[el] ?? 0))
    return diff.length ? diff.map((el) => `${el} ${L[el] ?? 0}/${R[el] ?? 0}`).join(', ') : null
  } catch (e) {
    return (e as Error).message
  }
}

/** Состав обеих сторон с относительными коэффициентами: «CH₂=CH₂ + H₂ → CH₃–CH₃» = «C₂H₄ + H₂ → C₂H₆». */
function signature(eq: string): string | null {
  const s = sides(eq)
  if (!s) return null
  const terms = [...s[0], ...s[1]].map(termCounts)
  if (terms.some((t) => !t)) return null
  const min = Math.min(...terms.map((t) => t!.coeff))
  const side = (list: string[]) =>
    list
      .map((t) => termCounts(t)!)
      .map((t) => `${formulaCompositionKey(t.counts)}*${+(t.coeff / min).toFixed(3)}`)
      .sort()
      .join('+')
  return `${side(s[0])}=${side(s[1])}`
}

/** Запись без пробелов, связей и индексов — для общих схем и изомеров одного состава. */
const spelling = (s: string) => plain(s).replace(/[\s–—\-=≡↑↓]/g, '').replace(/⇄|<=>|->/g, (m) => (m === '->' ? '→' : '⇌')).toLowerCase()

// ── 1: every card of pp. 55–167 is balanced (except general schemes) ──
const FROM = 55
const TO = 167
const cards: { u: ReaderUnit; r: ReaderReaction }[] = []
for (const u of grade.units) for (const r of u.reactions) if (r.page != null && r.page >= FROM && r.page <= TO) cards.push({ u, r })
if (cards.length < 230) fail(`карточек с. ${FROM}–${TO} подозрительно мало: ${cards.length}`)
let balanced = 0
let schemes = 0
for (const { u, r } of cards) {
  const at = `${u.unitId} ${r.id} с. ${r.page} «${r.equation}»`
  if ((u.pageStart != null && r.page! < u.pageStart) || (u.pageEnd != null && r.page! > u.pageEnd)) fail(`${at}: страница вне параграфа ${u.pageStart}–${u.pageEnd}`)
  if (r.isGeneralScheme) {
    schemes += 1
    continue
  }
  const bad = imbalance(r.equation)
  if (bad) fail(`${at}: не уравнено (${bad})`)
  else balanced += 1
}

// ── 2: every row of the transcripts ──
type Expect = { page: number; eq: string; scheme?: boolean; ex?: boolean; rev?: boolean; cond?: string[]; note?: string[] }
const X: Expect[] = []
const E = (page: number, eq: string, more: Partial<Expect> = {}) => X.push({ page, eq, ...more })

// g10-ch2-alkenes-dienes.md, с. 55–69
E(55, 'C6H12 → C6H6 + 3H2', { cond: ['Pt'] })
E(59, 'CH2=CH2 + H2 → CH3-CH3')
E(59, 'CH2=CH2 + Br2 → CH2Br-CH2Br', { note: ['качественная'] })
E(59, 'CH2=CH2 + HBr → CH3-CH2Br')
E(59, 'CH2=CH-CH3 + HBr → CH3-CH(Br)-CH3', { note: ['Марковникова'] })
E(60, '3CH2=CH2 + 4H2O + 2KMnO4 → 3CH2OH-CH2OH + 2MnO2 + 2KOH', { note: ['этиленгликоль'] })
E(60, 'nCH2=CH2 → (-CH2-CH2-)n', { note: ['полиэтилен'] })
E(60, 'C2H5OH → C2H4 + H2O', { cond: ['H2SO4'] })
E(60, '2CH4 → C2H4 + 2H2')
E(60, 'C2H6 → C2H4 + H2')
E(60, 'CH2Br-CHBr-CH3 + Zn → CH2=CH-CH3 + ZnBr2', { note: ['1,2-дибромпропан'] })
E(60, 'C3H7Cl + KOH → C3H6 + KCl + H2O')
E(61, 'C2H4 + HCl → C2H5Cl', { note: ['с. 61'] })
E(61, 'C2H4 + H2O → C2H5OH', { cond: ['H3PO4'], note: ['с. 61'] })
E(61, 'C2H4 + Cl2 → CH2Cl-CH2Cl', { note: ['с. 61'] })
E(61, '2C2H4 + O2 → 2C2H4O', { cond: ['Ag'], note: ['с. 61'] })
E(62, 'H2C=CH2 + Br2 → CH2Br-CH2Br')
E(62, '5C2H4 + 12KMnO4 + 18H2SO4 → 10CO2 + 6K2SO4 + 12MnSO4 + 28H2O', { note: ['Mn⁺⁷'] })
E(66, '2CH3CH2OH → CH2=CH-CH=CH2 + H2 + 2H2O')
E(66, 'CH3-CH2-CH2-CH3 → CH2=CH-CH=CH2 + 2H2')
E(66, 'nCH2=CH-CH=CH2 → (-CH2-CH=CH-CH2-)n', { note: ['полибутадиен'] })
E(66, 'nCH2=C(CH3)-CH=CH2 → (-CH2-C(CH3)=CH-CH2-)n')
E(66, 'nCH2=C(Cl)-CH=CH2 → (-CH2-C(Cl)=CH-CH2-)n', { note: ['2-хлорбута-1,3-диен'] })
E(66, 'CH2=CH-CH=CH2 + Br2 → CH2Br-CH=CH-CH2Br', { note: ['1,4-дибромбут-2-ен'] })
E(66, 'CH2=CH-CH=CH2 + Br2 → CH2Br-CHBr-CH=CH2', { note: ['3,4-дибромбут-1-ен'] })
E(67, 'CnH2n-2 + (1,5n-0,5)O2 → nCO2 + (n-1)H2O', { scheme: true })
E(67, 'C3H4 + 4O2 → 3CO2 + 2H2O')
E(67, 'nCH2=CH-CH=CH2 → (-CH2-CH=CH-CH2-)n', { cond: ['C4H9Li'], note: ['цис'] })
E(67, 'CH2=CH-CH=CH2 + 2H2 → CH3-CH2-CH2-CH3')
E(69, '(-CH2-C(CH3)=CH-CH2-)n + nS → (C5H8S)n', { scheme: true, note: ['вулканизации'] })
// g10-ch2-alkynes-arenes.md, с. 70–102
E(70, 'nCH2=C(Cl)-CH=CH2 → (-CH2-C(Cl)=CH-CH2-)n', { note: ['Стереорегулярный'] })
E(70, 'nCH2=C(CH3)-CH=CH2 → (-CH2-C(CH3)=CH-CH2-)n', { note: ['цис-1,4-полиизопрен'] })
E(70, 'nCH2=CH-CH=CH2 + nC6H5-CH=CH2 → (-CH2-CH=CH-CH2-CH(C6H5)-CH2-)n')
E(74, 'CaC2 + 2H2O → HC≡CH + Ca(OH)2')
E(74, '2CH4 → HC≡CH + 3H2', { cond: ['1500'] })
E(74, 'HC≡CH + H2O → CH3-CHO', { cond: ['Hg'] })
E(75, '3HC≡CH → C6H6')
E(75, 'CnH2n-2 + (1,5n-0,5)O2 → nCO2 + (n-1)H2O', { scheme: true })
E(75, 'C3H4 + 4O2 → 3CO2 + 2H2O')
E(75, 'C5H8 + 7O2 → 5CO2 + 4H2O')
E(75, '3CH≡CH + 8KMnO4 → 3KOOC-COOK + 8MnO2 + 2KOH + 2H2O', { note: ['«+ 2H₂»'] })
E(79, 'C6H12 → C6H6 + 3H2')
E(79, 'C6H11-CH3 → C6H5-CH3 + 3H2')
E(79, '3HC≡CH → C6H6')
E(79, 'C6H6 + Br2 → C6H5Br + HBr', { cond: ['FeCl3'] })
E(79, 'C6H6 + HNO3 → C6H5NO2 + H2O', { cond: ['H2SO4'] })
E(80, 'C6H5-CH3 + 3HNO3 → CH3-C6H2(NO2)3 + 3H2O', { note: ['тринитротолуол'] })
E(80, 'C6H5-CH3 + 3Br2 → CH3-C6H2Br3 + 3HBr', { cond: ['FeBr3'] })
E(80, '5C6H5-CH3 + 6KMnO4 + 9H2SO4 → 5C6H5-COOH + 6MnSO4 + 3K2SO4 + 14H2O', { note: ['боковая цепь'] })
E(80, 'C6H6 + 3Cl2 → C6H6Cl6', { note: ['гексахлор'] })
E(80, 'C6H6 + 3H2 → C6H12')
E(82, 'C6H5-CH=CH2 + H2 → C6H5-CH2-CH3', { cond: ['Ni'] })
E(82, 'C6H5-CH=CH2 + Cl2 → C6H5-CHCl-CH2Cl')
E(82, 'C6H5-CH=CH2 + HCl → C6H5-CHCl-CH3', { note: ['Марковникова'] })
E(82, 'C6H5-CH=CH2 + H2O → C6H5-CH(OH)-CH3', { note: ['1-фенилэтанол'] })
E(82, 'nC6H5-CH=CH2 → (-CH(C6H5)-CH2-)n')
E(82, 'C6H5-CH=CH2 + 10O2 → 8CO2 + 4H2O')
E(82, 'C6H5-CH=CH2 + 2KMnO4 + 3H2SO4 → C6H5-COOH + CO2 + 2MnSO4 + K2SO4 + 4H2O')
E(83, '3C6H5-CH=CH2 + 10KMnO4 → 3C6H5-COOK + 3K2CO3 + 10MnO2 + KOH + 4H2O')
E(83, '3C6H5-CH=CH2 + 2KMnO4 + 4H2O → 3C6H5-CH(OH)-CH2OH + 2MnO2 + 2KOH')
E(83, 'C6H5-CH2-CH3 → C6H5-CH=CH2 + H2', { note: ['дегидрированием'] })
E(83, 'C6H6 + HC≡CH → C6H5-CH=CH2', { cond: ['AlCl3'] })
E(87, 'CH4 + 2O2 → CO2 + 2H2O', { note: ['66 г'] })
E(87, '2CH4 → HC≡CH + 3H2', { note: ['3 моль'] })
E(101, 'CH3-CH2-CH3 + Br2 → CH3-CH(Br)-CH3 + HBr')
E(101, 'CH3-CH(Br)-CH3 + NaOH → CH3-CH=CH2 + NaBr + H2O', { note: ['KOH'] })
E(101, 'CH3-CH=CH2 + C6H6 → C6H5-CH(CH3)2', { note: ['кумол'] })
E(102, '5C6H5-CH(CH3)2 + 18KMnO4 + 27H2SO4 → 5C6H5COOH + 10CO2 + 9K2SO4 + 18MnSO4 + 42H2O')
E(102, 'C6H5-COOH + C2H5OH → C6H5-COO-C2H5 + H2O', { note: ['этерификация'] })
// задание 1 с. 102 — цепочки a–d, ответ по «Показать ответ»
for (const eq of [
  'CaCO3 → CaO + CO2',
  'CaO + 3C → CaC2 + CO',
  'CaC2 + 2H2O → C2H2 + Ca(OH)2',
  'C2H2 + H2O → CH3CHO',
  '2CH4 → C2H2 + 3H2',
  'C2H2 + HCl → CH2=CHCl',
  'nCH2=CHCl → (-CH2-CHCl-)n',
  'C2H6 + Cl2 → C2H5Cl + HCl',
  'C2H5Cl + KOH → C2H4 + KCl + H2O',
  'C2H4 + Cl2 → CH2Cl-CH2Cl',
  'CH2Cl-CH2Cl + 2KOH → C2H2 + 2KCl + 2H2O',
  'C2H2 + H2 → C2H4',
  'C2H4 + HCl → C2H5Cl',
  '2C2H5Cl + 2Na → C4H10 + 2NaCl',
])
  E(102, eq, { ex: true })
// g10-ch3-alcohols.md, с. 103–121
E(103, 'CaC2 + 2H2O → HC≡CH + Ca(OH)2', { note: ['33,6'] })
E(110, '2C2H5OH + 2Na → 2C2H5ONa + H2', { note: ['этилат'] })
E(110, 'C2H5OH + HNO3 → C2H5-O-NO2 + H2O', { note: ['этилнитрат'] })
E(110, 'C2H5OH + H2SO4 → C2H5-O-SO3H + H2O')
E(110, '2C2H5OH → C2H5-O-C2H5 + H2O', { cond: ['140'] })
E(110, 'CH3COOH + C2H5OH ⇌ CH3COOC2H5 + H2O', { rev: true })
E(110, 'C2H5OH + HCl → C2H5Cl + H2O', { note: ['2C₂H₅OH + HCl'] })
E(112, 'C2H5OH + 6NaOH + 4I2 → CHI3 + HCOONa + 5NaI + 5H2O', { note: ['«J»'] })
E(112, 'CH2=CH2 + H2O → CH3CH2OH', { cond: ['H3PO4'] })
E(112, 'CH3(CH2)3CHO + H2 → CH3(CH2)3CH2OH', { cond: ['Ni'], note: ['«H⁺»'] })
E(112, 'CH3CH2CH=CHCOOC2H5 + 2H2 → CH3CH2CH=CHCH2OH + C2H5OH', { note: ['«H⁺»'] })
E(112, '2CH4 + O2 → 2CH3OH', { note: ['три направления'] })
E(112, 'CH4 + O2 → HCHO + H2O', { note: ['три направления'] })
E(112, '2CH4 + 3O2 → 2HCOOH + 2H2O', { note: ['три направления'] })
E(113, 'C6H12O6 → 2C2H5OH + 2CO2')
E(113, 'CH2=CH2 + H2O → CH3-CH2-OH')
E(113, 'CH3-CH2-Cl + H2O → CH3-CH2-OH + HCl', { note: ['щёлочи'] })
E(118, 'C2H4O + H2O → HO-CH2-CH2-OH')
E(118, 'R-CHCl-CH2Cl + 2NaOH → R-CHOH-CH2OH + 2NaCl', { scheme: true, note: ['R = H'] })
E(118, '3R-CH=CH2 + 2KMnO4 + 4H2O → 3R-CHOH-CH2OH + 2MnO2 + 2KOH', { scheme: true })
E(118, 'C3H5(OCOR)3 + 3H2O ⇌ C3H5(OH)3 + 3RCOOH', { scheme: true, rev: true, note: ['омыление'] })
E(118, 'CH2Cl-CH2Cl + 2NaOH → HOCH2CH2OH + 2NaCl')
E(119, 'HO-CH2-CH2-OH + 2Na → NaO-CH2-CH2-ONa + H2', { note: ['1,68'] })
E(119, 'CH2(OH)-CH2(OH) + CH3-COOH → CH2(OH)-CH2-OC(O)-CH3 + H2O', { note: ['нет H₂O'] })
E(119, 'HOCH2CH2OH + HHal → CH2(OH)CH2Hal + H2O', { scheme: true })
E(119, 'HOCH2CH2OH + HCl → HOCH2CH2Cl + H2O')
E(119, 'CH2(OH)-CH2(OH) → CH3-CHO + H2O')
E(119, '2HO-CH2-CH2-OH → C4H8O2 + 2H2O', { note: ['диоксан'] })
E(120, 'C3H5(OH)3 + 3HNO3 → C3H5(ONO2)3 + 3H2O', { note: ['нитроглицерин'] })
E(120, 'C3H5(OH)3 + 3HCl → C3H5Cl3 + 3H2O')
E(120, '2C3H5(OH)3 + Cu(OH)2 → [C3H5(OH)2O]2Cu + 2H2O', { note: ['синий'] })
E(121, 'C3H5(OH)3 + 3RCOOH → C3H5(OCOR)3 + 3H2O', { scheme: true, note: ['−H₂O'] })
E(121, 'C2H5Cl + KOH → C2H4 + KCl + H2O', { note: ['+ Zn'] })
E(121, 'CH2=CH2 + Br2 → Br-CH2-CH2-Br', { cond: ['CCl4'] })
E(121, 'Br-CH2-CH2-Br + 2NaOH → HO-CH2-CH2-OH + 2NaBr')
E(121, 'HO-CH2-CH(OH)-CH2-OH + 3HCl → Cl-CH2-CHCl-CH2-Cl + 3H2O')
E(121, 'Cl-CH2-CHCl-CH2-Cl + 3NaOH → C3H5(OH)3 + 3NaCl')
E(121, 'C3H5(OH)3 + 3HO-NO2 → C3H5(ONO2)3 + 3H2O', { note: ['C–N'] })
E(121, '2HOCH2CH2OH + Cu(OH)2 → [HOCH2CH2O]2Cu + 2H2O')
// g10-ch3-phenols-carbonyls.md, с. 125–138
E(125, '2C6H5OH + 2Na → 2C6H5ONa + H2')
E(125, 'C6H5OH + NaOH → C6H5ONa + H2O', { note: ['2C₆H₅OH + NaOH'] })
E(125, 'C6H5ONa + CO2 + H2O → C6H5OH + NaHCO3', { note: ['→ 2C₆H₅OH'] })
E(125, 'C6H5OH + 3Br2 → C6H2Br3OH + 3HBr', { cond: ['бромная вода'], note: ['+ 3Br₂'] })
E(126, 'C6H5OH + HCHO → HO-C6H4-CH2OH')
E(126, 'HO-C6H4-CH2OH + C6H5OH → HO-C6H4-CH2-C6H4-OH + H2O')
E(126, '6C6H5OH + FeCl3 → [Fe(C6H5OH)6]Cl3', { note: ['не уравнено'] })
E(126, '3C6H5OH + FeCl3 → Fe(OC6H5)3 + 3HCl')
E(127, 'C6H5CH2Cl + H2O → C6H5CH2OH + HCl')
E(127, 'C6H5SO3H + NaOH → C6H5SO3Na + H2O')
E(127, 'C6H5SO3Na + 2NaOH → C6H5ONa + Na2SO3 + H2O', { note: ['сплавлен'] })
E(127, 'C6H6 + Cl2 → C6H5Cl + HCl', { cond: ['FeCl3'], note: ['+ 2Cl₂'] })
E(127, 'C6H5Cl + 2NaOH → C6H5ONa + NaCl + H2O', { cond: ['Cu'] })
E(127, 'C6H5ONa + HCl → C6H5OH + NaCl')
E(128, 'C6H5OH + NaOH → C6H5ONa + H2O')
E(128, 'C6H5ONa + H2SO4 → C6H5OH + NaHSO4')
E(131, "RONa + R'Cl → ROR' + NaCl", { scheme: true, note: ['Вильямсона'] })
E(131, 'C2H5OH + H2SO4 → C2H5OSO3H + H2O')
E(131, 'C2H5OSO3H + C2H5OH → C2H5-O-C2H5 + H2SO4', { cond: ['140'] })
E(131, 'C2H5OSO3H + CH3OH → C2H5-O-CH3 + H2SO4')
E(131, '2C2H5OH → C2H5-O-C2H5 + H2O', { cond: ['Al2O3'], note: ['этилен'] })
E(131, '(C2H5)2O + H2SO4 → [(C2H5)2OH]HSO4')
E(132, 'CH3CH(CH3)-O-(CH2)3CH3 + HI → CH3CH(OH)CH3 + CH3(CH2)3I', { note: ['1-иодбутан'] })
E(132, 'C2H5OC2H5 + 2Na → C2H5ONa + C2H5Na', { note: ['не реагирует'] })
E(133, 'CH3OH + CuO → HCHO + Cu + H2O')
E(133, 'HC≡CH + H2O → CH3CHO', { cond: ['HgSO4'], note: ['виниловый спирт'] })
E(133, 'CH3CHCl2 + 2NaOH → CH3CHO + 2NaCl + H2O')
E(134, 'CH3CH2CHO + H2 → CH3CH2CH2OH', { cond: ['Ni'] })
E(134, 'CH3CH2CHO + Ag2O → CH3CH2COOH + 2Ag', { cond: ['NH3'] })
E(134, 'CH3CHO + 2Cu(OH)2 → CH3COOH + 2CuOH + H2O', { note: ['Жёлтый'] })
E(134, '2CuOH → Cu2O + H2O', { note: ['оксид меди(I)'] })
E(135, 'nC6H5OH + nHCHO → (C6H3(OH)CH2)n + nH2O', { note: ['коэффициента n'] })
E(136, 'CuSO4 + 2NaOH → Cu(OH)2 + Na2SO4', { ex: true })
E(136, '2C3H5(OH)3 + Cu(OH)2 → [C3H5(OH)2O]2Cu + 2H2O')
E(136, 'R-CHO + 2Cu(OH)2 → R-COOH + 2CuOH + H2O', { scheme: true })
E(136, 'HCHO + 2Cu(OH)2 → HCOOH + 2CuOH + H2O')
E(138, 'R-C≡C-H + H2O → R-CO-CH3', { scheme: true, cond: ['Hg'] })
E(138, 'CH3C≡CH + H2O → CH3COCH3')
E(138, 'CH3-CCl2-CH3 + H2O → CH3-CO-CH3 + 2HCl')
E(138, "R-CO-R' + H2 → R-CHOH-R'", { scheme: true })
E(138, 'CH3COCH3 + H2 → CH3CH(OH)CH3')
E(138, '(CH3COO)2Ca → CH3COCH3 + CaCO3')
E(138, '2CH3COOH → CH3COCH3 + CO2 + H2O', { cond: ['Al2O3'] })
// g10-ch3-acids-esters-carbs.md, с. 141–167
E(141, 'C2H5OH + CuO → CH3CHO + Cu + H2O', { note: ['цепочке с. 141'] })
E(141, '2CH3CHO + O2 → 2CH3COOH', { note: ['цепочке с. 141'] })
E(141, "R-COO-R' + H2O ⇌ R-COOH + R'-OH", { scheme: true, rev: true })
E(141, 'CH3-CO-O-C2H5 + H2O ⇌ CH3-COOH + C2H5-OH', { rev: true, cond: ['H2SO4'] })
E(141, '2CH3CH2CH2COONa + H2SO4 → 2CH3CH2CH2COOH + Na2SO4')
E(142, '2RCOOH + 2Na → 2RCOONa + H2', { scheme: true })
E(142, '2CH3-COOH + 2Na → 2CH3-COONa + H2')
E(142, 'RCOOH + NaOH → RCOONa + H2O', { scheme: true })
E(142, 'C2H5-COOH + NaOH → C2H5-COONa + H2O')
E(142, '2RCOOH + MgO → (RCOO)2Mg + H2O', { scheme: true })
E(142, '2CH3-COOH + MgO → (CH3-COO)2Mg + H2O')
E(142, 'CH3COOH + C2H5OH ⇌ CH3COOC2H5 + H2O', { rev: true })
E(142, 'HCOOH + Ag2O → CO2 + H2O + 2Ag')
E(142, 'CH3COOH + Cl2 → CH2ClCOOH + HCl', { note: ['хлорическая'] })
E(142, 'CH2ClCOOH + Cl2 → CHCl2COOH + HCl')
E(142, 'CHCl2COOH + Cl2 → CCl3COOH + HCl')
E(142, 'C3H5(OH)3 + 3C17H35COOH → (C17H35COO)3C3H5 + 3H2O')
E(147, 'CH3COOH + C2H5OH → CH3COOC2H5 + H2O')
E(148, 'CH3COOC2H5 + H2O ⇌ CH3COOH + C2H5OH', { rev: true })
E(148, 'CH3COOC2H5 + NaOH → CH3COONa + C2H5OH')
E(149, 'CH3COOH + CH3OH → CH3COOCH3 + H2O')
E(149, 'CH3COOCH3 + H2O → CH3COOH + CH3OH', { note: ['вариант B'] })
E(149, 'C6H5OH + NaOH → C6H5ONa + H2O')
E(153, 'C3H5(OCOR)3 + 3H2O ⇌ C3H5(OH)3 + 3RCOOH', { scheme: true, rev: true, note: ['без коэффициента 3'] })
E(153, '(C17H35COO)3C3H5 + 3NaOH → C3H5(OH)3 + 3C17H35COONa')
E(153, '(C17H33COO)3C3H5 + 3H2 → (C17H35COO)3C3H5', { cond: ['Ni'] })
E(154, 'C3H5(OH)3 + 3C17H33COOH → (C17H33COO)3C3H5 + 3H2O', { note: ['справа налево'] })
E(155, '(C15H31COO)3C3H5 + 3NaOH → C3H5(OH)3 + 3C15H31COONa')
E(155, 'C17H35COONa + H2SO4 → C17H35COOH + NaHSO4')
E(155, 'C17H35COONa + H2O ⇌ C17H35COOH + NaOH', { rev: true })
E(158, 'C6H12O6 + CH3OH → C6H11O5-OCH3 + H2O', { cond: ['HCl'] })
E(158, 'C6H12O6 + 5CH3COOH → C6H7O6(CH3CO)5 + 5H2O', { note: ['без 5H₂O'] })
E(158, 'C6H12O6 + Cu(OH)2 → C6H10O6Cu + 2H2O')
E(158, 'CH2OH(CHOH)4-CHO + 2[Ag(NH3)2]OH → CH2OH(CHOH)4-COONH4 + 2Ag + 3NH3 + H2O', { note: ['–COH'] })
E(158, 'CH2OH(CHOH)4-CHO + 2Cu(OH)2 → CH2OH(CHOH)4-COOH + Cu2O + 2H2O')
E(159, 'CH2OH(CHOH)4-CHO + H2 → CH2OH(CHOH)4-CH2OH', { note: ['сорбит'] })
E(159, '2C6H12O6 + Cu(OH)2 → (C6H11O6)2Cu + 2H2O', { note: ['ярко-синий'] })
E(161, 'C12H22O11 + H2O → C6H12O6 + C6H12O6')
E(165, '(C6H7O2(OH)3)n + 3nHNO3 → (C6H7O2(ONO2)3)n + 3nH2O')
E(165, '(C6H7O2(OH)3)n + 3nCH3COOH → (C6H7O2(OCOCH3)3)n + 3nH2O')
E(165, '(C6H10O5)n + nH2O → nC6H12O6')
E(165, '(C6H10O5)n + n/2H2O → n/2C12H22O11', { scheme: true, note: ['n/2'] })
E(165, 'C12H22O11 + H2O → 2C6H12O6')
E(166, '(C6H7O2(OH)3)n + 3nHNO3 → (C6H7O2(ONO2)3)n + 3nH2O')
E(166, '(C6H7O2(OH)3)n + 3nCH3COOH → (C6H7O2(OCOCH3)3)n + 3nH2O')
E(167, 'CH2OH(CHOH)4-CHO + 2Cu(OH)2 → CH2OH(CHOH)4-COOH + Cu2O + 2H2O', { note: ['CuOH'] })

const used = new Set<ReaderReaction>()
for (const x of X) {
  const at = `с. ${x.page} «${x.eq}»`
  const onPage = cards.filter(({ r }) => r.page === x.page && !used.has(r))
  const sp = spelling(x.eq)
  const sig = x.scheme ? null : signature(x.eq)
  if (!x.scheme && !sig) {
    fail(`${at}: спецификация не разбирается`)
    continue
  }
  const hit =
    onPage.find(({ r }) => spelling(r.equation) === sp) ??
    (sig ? onPage.find(({ r }) => !r.isGeneralScheme && signature(r.equation) === sig) : undefined)
  if (!hit) {
    fail(`${at}: карточки нет (на странице: ${cards.filter(({ r }) => r.page === x.page).map(({ r }) => r.equation).join(' | ') || '—'})`)
    continue
  }
  const r = hit.r
  used.add(r)
  if (!!x.scheme !== r.isGeneralScheme) fail(`${at}: isGeneralScheme=${r.isGeneralScheme}`)
  if (x.ex && !(r.exercise && r.asInBook)) fail(`${at}: должна быть карточкой-заданием с текстом учебника`)
  if (!x.ex && r.exercise) fail(`${at}: помечена как задание`)
  if (x.rev && !/[⇌⇄]/.test(r.equation)) fail(`${at}: обратимая реакция показана без ⇄ («${r.equation}»)`)
  if (!x.rev && /[⇌⇄]/.test(r.equation) && /[⇌⇄]/.test(x.eq) === false) fail(`${at}: лишняя ⇄ («${r.equation}»)`)
  for (const c of x.cond ?? []) if (!(r.conditions ?? '').includes(c)) fail(`${at}: в условиях нет «${c}» (${r.conditions ?? '—'})`)
  for (const n of x.note ?? []) if (!(r.note ?? '').includes(n)) fail(`${at}: в пояснении нет «${n}» (${r.note ?? '—'})`)
}

// ── 3: textbook errors are never shown as equations ──
const BOOK_ERRORS = [
  '2C2H5OH + HCl → 2C2H5Cl + H2O',
  '2CH3-CH2-Cl + Zn → 2CH2=CH2 + ZnCl2',
  '2CH3CH2Cl + Zn → 2CH2=CH2 + ZnCl2 + H2',
  'CH4 + O2 → CH3OH + CH2=O + HCOOH',
  '3CH≡CH + 8KMnO4 → 3KOOC-COOK + 8MnO2 + 2KOH + 2H2',
  '2C6H5OH + NaOH → C6H5ONa + H2O',
  'C6H5ONa + CO2 + H2O → 2C6H5OH + NaHCO3',
  'C6H5OH + 3Br2 → C6H2Br3OH + 3Br2',
  'C6H5OH + FeCl3 → [Fe(C6H5OH)6]Cl3',
  'C6H6 + 2Cl2 → C6H5Cl + HCl',
  'C6H5SO3Na + NaOH → C6H5ONa + NaHSO3',
  'C6H12O6 + 5CH3COOH → C6H7O6(CH3CO)5',
  'C3H5(OCOR)3 + 3H2O → C3H5(OH)3 + RCOOH',
  'HOCH2CH2OH + CH3COOH → CH2(OH)CH2OC(O)CH3',
  '2MnO4 + 6H + 5NO2 → 2Mn + 8H2O + 5NO3',
]
const errSpell = new Set(BOOK_ERRORS.map(spelling))
for (const { u, r } of cards) {
  if (errSpell.has(spelling(r.equation))) fail(`${u.unitId} ${r.id} с. ${r.page}: запись учебника с ошибкой показана как уравнение «${r.equation}»`)
  // цепочка ступенчатого гидролиза «… → nC₁₂H₂₂O₁₁ → nC₆H₁₂O₆» (n вместо n/2) — только в пояснении
  if (/nC₁₂H₂₂O₁₁\s*→\s*nC₆H₁₂O₆/.test(r.equation)) fail(`${u.unitId} ${r.id}: цепочка гидролиза крахмала с коэффициентами учебника`)
}

if (errors.length) {
  console.error(`verify-book-g10-ch2-3: ${errors.length} ошибок`)
  for (const e of errors) console.error('  ✗ ' + e)
  process.exit(1)
}
console.log(
  `verify-book-g10-ch2-3: с. ${FROM}–${TO} — ${cards.length} карточек, уравнено ${balanced}, общих схем ${schemes}; ` +
    `строк расшифровок ${X.length}/${X.length} на своих страницах; ошибок учебника среди уравнений нет`,
)
