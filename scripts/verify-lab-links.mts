/**
 * Проверка ссылок «открыть в лаборатории» на весь банк школьных реакций
 * и набор уравнений в стиле учебника.
 *
 * Для каждой поддержанной реакции: засеянное уравнение сбалансировано
 * (тем же способом, что и в LaboratoryPage) и prepareGuaranteedSynthesisRun успешен.
 * Реакции «только шарами» (stageOnly: ионы, электроны, органика, простое вещество-продукт):
 * уравнение сбалансировано по атомам И зарядам, синтез честно отказывает (STAGE_ONLY),
 * экран реакции (scientificStageLayout) строится — у каждого члена есть частицы, счёт сходится.
 * Печатает покрытие по причинам отказа и покрытие уравнений учебников 7–9 классов.
 *
 * Run: npx tsx scripts/verify-lab-links.mts [--list]
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { isReactorEquationBalanced } from '../src/chemistry/reactorEquationBalance.ts'
import {
  isScientificEquationBalanced,
  seedScientificReactorEquation,
} from '../src/chemistry/scientificReactorRecipes.ts'
import { SCHOOL_REACTION_BANK } from '../src/chemistry/schoolReactionBank.ts'
import { scientificStageLayout } from '../src/components/lab/scientific/scientificReactorStageLayout.ts'
import { compoundById } from '../src/data/compounds.ts'
import { labCompoundById } from '../src/data/labSpecies.ts'
import {
  parseReactorLinkParams,
  reactorHrefForBank,
  reactorHrefForEquation,
  resolveReactorEquation,
  sanitizeBackHref,
  type ReactorLinkOk,
  type ReactorLinkResult,
} from '../src/lab/reactorDeepLink.ts'
import { prepareGuaranteedSynthesisRun } from '../src/lab/synthesisGuarantee.ts'

const LIST = process.argv.includes('--list')

let idN = 0
const newId = () => `t${++idN}`

/** Экран реакции «шарами»: каждый член — частицы, счёт атомов и зарядов сходится. */
function checkStage(label: string, r: ReactorLinkOk): string[] {
  const problems: string[] = []
  const layout = scientificStageLayout(r.leftTerms, r.coProducts, r.productCompoundId, r.productCoeff)
  const termCount = r.leftTerms.length + r.coProducts.length + 1
  if (layout.terms.length !== termCount) problems.push(`${label}: stage terms ${layout.terms.length} ≠ ${termCount}`)
  for (const t of layout.terms) {
    const units = layout.units.filter((u) => u.termKey === t.key)
    if (units.length === 0 || units.some((u) => u.atomCount === 0)) problems.push(`${label}: stage term ${t.formula} без частиц`)
  }
  if (layout.atoms.some((a) => a.local.some((v) => !Number.isFinite(v)))) problems.push(`${label}: stage NaN`)
  if (!layout.tally.equal) problems.push(`${label}: stage tally not equal ${JSON.stringify(layout.tally.rows)}`)
  if (!(layout.fitScale > 0 && layout.fitScale <= 1)) problems.push(`${label}: stage fitScale ${layout.fitScale}`)
  return problems
}

function checkOk(label: string, r: ReactorLinkOk): string[] {
  const problems: string[] = []
  const product = labCompoundById[r.productCompoundId]
  if (!product) return [`${label}: product ${r.productCompoundId} missing`]
  if (!r.stageOnly && !compoundById[r.productCompoundId]) return [`${label}: product ${r.productCompoundId} not in catalog`]
  const balanced = r.recipe
    ? isScientificEquationBalanced(r.leftTerms, r.coProducts, product, r.productCoeff, labCompoundById, r.recipe)
    : isReactorEquationBalanced(r.leftTerms, product, r.productCoeff)
  if (!balanced) problems.push(`${label}: seeded equation not balanced`)
  const prepared = prepareGuaranteedSynthesisRun({
    leftTerms: r.leftTerms,
    productId: r.productCompoundId,
    productCoeff: r.productCoeff,
    compoundById,
    coProducts: r.coProducts,
    recipe: r.recipe ?? null,
  })
  if (r.stageOnly) {
    if (!r.recipe?.stageOnly) problems.push(`${label}: stageOnly без рецепта stageOnly`)
    if (prepared.ok || prepared.code !== 'STAGE_ONLY') problems.push(`${label}: stageOnly, но синтез не отказал STAGE_ONLY`)
  } else if (!prepared.ok) problems.push(`${label}: prepareGuaranteedSynthesisRun → ${prepared.code}`)
  if (r.recipe) problems.push(...checkStage(label, r))
  if (r.recipe) {
    // Сид из самого рецепта (как LaboratoryPage при повторном выборе) тоже сходится.
    const seeded = seedScientificReactorEquation(r.productCompoundId, newId, {
      withTargetCoeffs: true,
      recipe: r.recipe,
    })
    if (!seeded) problems.push(`${label}: seedScientificReactorEquation(recipe) → null`)
    else if (
      !isScientificEquationBalanced(seeded.leftTerms, seeded.coProducts, product, seeded.productCoeff, labCompoundById, r.recipe)
    ) {
      problems.push(`${label}: recipe seed not balanced`)
    }
    // Режим «уравняй сам»: коэффициенты 1, пока не уравнено (если исходное не 1:1).
    const self = resolveReactorEquation({ reactionId: r.bankId, equation: r.bankId ? null : r.equationUnicode }, {
      newId,
      balanceSelf: true,
    })
    assert.ok(self.ok, `${label}: balanceSelf should resolve`)
    const allOne = [...self.leftTerms, ...self.coProducts].every((t) => t.coeff === 1) && self.productCoeff === 1
    assert.ok(allOne, `${label}: balanceSelf should set all coefficients to 1`)
  }
  return problems
}

// ── банк ──
const byCode = new Map<string, string[]>()
const problems: string[] = []
let okDefault = 0
let okRecipe = 0
let okStage = 0
for (const rx of SCHOOL_REACTION_BANK) {
  const r: ReactorLinkResult = resolveReactorEquation({ reactionId: rx.id }, { newId })
  if (r.ok) {
    if (r.stageOnly) okStage++
    else if (r.recipe) okRecipe++
    else okDefault++
    problems.push(...checkOk(rx.id, r))
    if (LIST) console.log(`  ok ${r.recipe ? 'recipe ' : 'default'} ${rx.id}: ${r.equationUnicode} [main ${r.productCompoundId}]`)
    // href → params → тот же результат
    const params = new URLSearchParams(reactorHrefForBank(rx.id).split('?')[1])
    const parsed = parseReactorLinkParams(params)
    assert.equal(parsed?.spec.reactionId, rx.id)
  } else {
    const list = byCode.get(r.code) ?? []
    list.push(`${rx.id}: ${rx.equationRu}${r.details.formulas ? ` [${r.details.formulas.join(', ')}]` : ''}${r.details.reason ? ` (${r.details.reason})` : ''}${r.details.imbalance ? ` {${r.details.imbalance.join('; ')}}` : ''}`)
    byCode.set(r.code, list)
  }
}
const total = SCHOOL_REACTION_BANK.length
const supported = okDefault + okRecipe + okStage
console.log(`\nSCHOOL_REACTION_BANK: ${supported}/${total} supported (${((supported / total) * 100).toFixed(1)}%)`)
console.log(`  default route (elements → compound): ${okDefault}`)
console.log(`  runtime recipe: ${okRecipe}`)
console.log(`  stage only («шарами», без синтеза): ${okStage}`)
for (const [code, list] of [...byCode.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${code}: ${list.length}`)
  for (const line of list) console.log(`    - ${line}`)
}

// ── уравнения в стиле учебника ──
const TEXTBOOK: {
  eq: string
  expect: 'ok' | string
  main?: string
  route?: 'default' | 'recipe'
  /** ожидаемая причина «только шарами»; null — обычный синтез */
  stage?: string | null
}[] = [
  { eq: 'Zn + 2HCl = ZnCl2 + H2', expect: 'ok', route: 'recipe' },
  { eq: 'CaCO3 = CaO + CO2', expect: 'ok', route: 'recipe' },
  { eq: '2H2 + O2 = 2H2O', expect: 'ok', route: 'default' },
  { eq: '2Na + Cl₂ → 2NaCl', expect: 'ok', route: 'default' },
  { eq: 'H2 + 1/2O2 = H2O', expect: 'ok', route: 'default' },
  { eq: 'Fe + CuSO4 = FeSO4 + Cu', expect: 'ok', route: 'recipe' },
  { eq: '2KClO3 =(MnO2, t) 2KCl + 3O2', expect: 'ok', route: 'recipe' },
  { eq: 'NaOH + HCl = NaCl + H2O', expect: 'ok', route: 'recipe' },
  { eq: 'NaOH + HCl = NaCl + H2O', expect: 'ok', main: 'h2o', route: 'recipe' },
  { eq: '2NaClO2 + Cl2 -> 2NaCl + 2ClO2', expect: 'ok', main: 'clo2', route: 'recipe' },
  { eq: '2Li + Cl2 -> 2LiCl', expect: 'ok', stage: null },
  // ионы — частицы реактора: реакция открывается «шарами» (без синтеза)
  { eq: 'Ba²⁺ + SO₄²⁻ → BaSO₄↓', expect: 'ok', stage: 'ionic', main: 'salt_ba_so4' },
  { eq: 'Ag+ + Cl- = AgCl', expect: 'ok', stage: 'ionic' },
  { eq: 'H⁺ + OH⁻ → H₂O', expect: 'ok', stage: 'ionic' },
  { eq: 'H₂SO₄ ⇄ 2H⁺ + SO₄²⁻', expect: 'ok', stage: 'ionic' },
  { eq: 'NH₃ + H₂O ⇄ NH₄⁺ + OH⁻', expect: 'ok', stage: 'ionic' },
  { eq: '2Fe³⁺ + 3CO₃²⁻ + 3H₂O → 2Fe(OH)₃ + 3CO₂', expect: 'ok', stage: 'ionic' },
  // полуреакции: «− 2e⁻» слева переносится вправо, заряд уравнен
  { eq: 'Fe − 2e⁻ → Fe²⁺', expect: 'ok', stage: 'electron' },
  { eq: 'Na⁺ + e⁻ → Na', expect: 'ok', stage: 'electron' },
  { eq: '2H₂O + 2e⁻ → H₂ + 2OH⁻', expect: 'ok', stage: 'electron' },
  // атомы сходятся, заряд — нет
  { eq: 'Fe → Fe²⁺ + e⁻', expect: 'unbalanced' },
  // ион, которого нет в реестре
  { eq: 'MnO₄⁻ + e⁻ → MnO₄²⁻', expect: 'unknownSubstance' },
  { eq: 'Ca → CaO → Ca(OH)₂', expect: 'scheme' },
  { eq: 'Me + H2O = MeOH + H2', expect: 'scheme' },
  { eq: 'CH4 + 2O2 = CO2 + 2H2O', expect: 'ok', stage: 'organic' },
  { eq: 'C2H5OH + 3O2 = 2CO2 + 3H2O', expect: 'ok', stage: 'organic' },
  { eq: '6CO2 + 6H2O -> C6H12O6 + 6O2', expect: 'ok', stage: 'organic' },
  { eq: 'H2 + HCHO -> CH3OH', expect: 'ok', stage: 'organic' },
  // гидрокарбонат, которого нет в каталоге, — неорганика, а не «organic»
  { eq: 'Fe(HCO3)2 = FeCO3 + CO2 + H2O', expect: 'unknownSubstance' },
  // органика вне реестра реактора
  { eq: 'C4H10 + Cl2 = C4H9Cl + HCl', expect: 'organic' },
  // продукты — только простые вещества
  { eq: '2H2O = 2H2 + O2', expect: 'ok', stage: 'simpleProduct', main: 'simple_O2' },
  { eq: '2HgO -> 2Hg + O2', expect: 'ok', stage: 'simpleProduct' },
  { eq: '2O3 -> 3O2', expect: 'ok', stage: 'simpleProduct' },
  { eq: '2NaCl -> 2Na + Cl2', expect: 'ok', stage: 'simpleProduct' },
  // самая длинная реакция учебника: 3 реагента → 5 продуктов
  { eq: '2KMnO4 + 10NaCl + 8H2SO4 -> K2SO4 + 5Na2SO4 + 2MnSO4 + 5Cl2 + 8H2O', expect: 'ok', stage: null },
  // дробный гидрат (алебастр) разбирается, а не считается схемой
  { eq: '2CaSO4*2H2O = 2CaSO4*0.5H2O + 3H2O', expect: 'unknownSubstance' },
  { eq: 'H2 + O2 = H2O', expect: 'unbalanced' },
  { eq: 'A + B = C', expect: 'scheme' },
  { eq: '6nCO2 + 5nH2O -> (C6H10O5)n + 6nO2', expect: 'generalFormula' },
  { eq: 'Fe2O3*nH2O -> Fe2O3 + nH2O', expect: 'generalFormula' },
]
const tbProblems: string[] = []
for (const t of TEXTBOOK) {
  const r = resolveReactorEquation({ equation: t.eq, main: t.main }, { newId })
  const got = r.ok ? 'ok' : r.code
  if (got !== t.expect) tbProblems.push(`${t.eq}: expected ${t.expect}, got ${got}${r.ok ? '' : ` ${JSON.stringify(r.details)}`}`)
  if (r.ok) {
    if (t.stage !== undefined && r.stageOnly !== t.stage) tbProblems.push(`${t.eq}: expected stageOnly ${t.stage}, got ${r.stageOnly}`)
    if (t.route && (r.recipe ? 'recipe' : 'default') !== t.route) tbProblems.push(`${t.eq}: expected route ${t.route}`)
    if (t.main && r.productCompoundId !== t.main) tbProblems.push(`${t.eq}: expected main ${t.main}, got ${r.productCompoundId}`)
    tbProblems.push(...checkOk(t.eq, r))
    const params = new URLSearchParams(reactorHrefForEquation(t.eq, { main: t.main, balance: true, src: 'g8:p24' }).split('?')[1])
    const p = parseReactorLinkParams(params)
    assert.equal(p?.spec.equation, t.eq)
    assert.equal(p?.balanceSelf, true)
    assert.equal(p?.backHref, '/learn/g/g8/book?unit=p24')
  }
  console.log(
    `  textbook ${got.padEnd(18)} ${t.eq}${r.ok ? `  → ${r.equationUnicode} [${r.stageOnly ? `stage:${r.stageOnly}` : r.recipe ? 'recipe' : 'default'}, main ${r.productCompoundId}]` : ''}`,
  )
}

// ── уравнения учебников 7–9 классов (src/data/textbook/curated/gN.json) ──
// Тем же путём, что и генератор build-curated-equations.mts: сначала банк, затем текст уравнения.
// Не открыться может только запись, которая в принципе не реакция с определённым составом
// (обобщённая формула с «n»: полимер (C₆H₁₀O₅)n, олеум H₂SO₄·nSO₃, Fe₂O₃·nH₂O).
const normEq = (s: string) =>
  s.replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080)).replace(/[↑↓\s]/g, '').replace(/<->|<=>|→|=|⇄|⇌/g, '->')
const bankByEq = new Map(SCHOOL_REACTION_BANK.map((rx) => [normEq(rx.equationRu), rx.id]))
const coverage: string[] = []
for (const g of [7, 8, 9]) {
  const curated = JSON.parse(fs.readFileSync(`src/data/textbook/curated/g${g}.json`, 'utf8')) as { reactions: { eq: string; page: number }[] }
  let ok = 0
  const stage: Record<string, number> = {}
  const fails: Record<string, string[]> = {}
  for (const rx of curated.reactions) {
    const bankId = bankByEq.get(normEq(rx.eq)) ?? null
    const bankRes = bankId ? resolveReactorEquation({ reactionId: bankId }, { newId }) : null
    const r = bankRes?.ok ? bankRes : resolveReactorEquation({ equation: rx.eq }, { newId })
    if (r.ok) {
      ok++
      if (r.stageOnly) stage[r.stageOnly] = (stage[r.stageOnly] ?? 0) + 1
      tbProblems.push(...checkOk(`g${g} p${rx.page} ${rx.eq}`, r))
    } else {
      ;(fails[r.code] ??= []).push(`p${rx.page} ${rx.eq}`)
      // не реакция с определённым составом: общая формула с «n» (полимер, олеум, ржавчина)
      const generalN = r.code === 'generalFormula'
      if (!generalN) tbProblems.push(`g${g} p${rx.page} ${rx.eq}: не открывается (${r.code} ${JSON.stringify(r.details)})`)
    }
  }
  const n = curated.reactions.length
  const stageText = Object.entries(stage)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ')
  const line = `g${g}: ${ok}/${n} открываются (${((ok / n) * 100).toFixed(1)}%), из них только «шарами»: ${stageText || '0'}`
  coverage.push(line)
  console.log(`\n${line}`)
  for (const [code, list] of Object.entries(fails)) console.log(`  ${code}: ${list.length}\n    - ${list.join('\n    - ')}`)
}

assert.equal(sanitizeBackHref('//evil.example'), null)
assert.equal(sanitizeBackHref('https://evil.example'), null)
assert.equal(sanitizeBackHref('/learn/g/g8/read/p24?rx=3'), '/learn/g/g8/read/p24?rx=3')
assert.ok(!reactorHrefForBank('x').startsWith('#'))

const allProblems = [...problems, ...tbProblems]
if (allProblems.length > 0) {
  console.error(`\n${allProblems.length} problem(s):`)
  for (const p of allProblems) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log(
  '\nverify-lab-links: все открываемые реакции засеяны уравненными; с синтезом — prepareGuaranteedSynthesisRun ok, ' +
    '«шарами» — экран реакции строится, синтез честно отвечает STAGE_ONLY',
)
console.log(coverage.join('\n'))
