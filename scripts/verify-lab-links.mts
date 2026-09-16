/**
 * Проверка ссылок «открыть в лаборатории» на весь банк школьных реакций
 * и набор уравнений в стиле учебника.
 *
 * Для каждой поддержанной реакции: засеянное уравнение сбалансировано
 * (тем же способом, что и в LaboratoryPage) и prepareGuaranteedSynthesisRun успешен.
 * Печатает покрытие по причинам отказа.
 *
 * Run: npx tsx scripts/verify-lab-links.mts [--list]
 */
import assert from 'node:assert/strict'
import { isReactorEquationBalanced } from '../src/chemistry/reactorEquationBalance.ts'
import {
  isScientificEquationBalanced,
  seedScientificReactorEquation,
} from '../src/chemistry/scientificReactorRecipes.ts'
import { SCHOOL_REACTION_BANK } from '../src/chemistry/schoolReactionBank.ts'
import { compoundById } from '../src/data/compounds.ts'
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

function checkOk(label: string, r: ReactorLinkOk): string[] {
  const problems: string[] = []
  const product = compoundById[r.productCompoundId]
  if (!product) return [`${label}: product ${r.productCompoundId} missing`]
  const balanced = r.recipe
    ? isScientificEquationBalanced(r.leftTerms, r.coProducts, product, r.productCoeff, compoundById, r.recipe)
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
  if (!prepared.ok) problems.push(`${label}: prepareGuaranteedSynthesisRun → ${prepared.code}`)
  if (r.recipe) {
    // Сид из самого рецепта (как LaboratoryPage при повторном выборе) тоже сходится.
    const seeded = seedScientificReactorEquation(r.productCompoundId, newId, {
      withTargetCoeffs: true,
      recipe: r.recipe,
    })
    if (!seeded) problems.push(`${label}: seedScientificReactorEquation(recipe) → null`)
    else if (
      !isScientificEquationBalanced(seeded.leftTerms, seeded.coProducts, product, seeded.productCoeff, compoundById, r.recipe)
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
for (const rx of SCHOOL_REACTION_BANK) {
  const r: ReactorLinkResult = resolveReactorEquation({ reactionId: rx.id }, { newId })
  if (r.ok) {
    if (r.recipe) okRecipe++
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
const supported = okDefault + okRecipe
console.log(`\nSCHOOL_REACTION_BANK: ${supported}/${total} supported (${((supported / total) * 100).toFixed(1)}%)`)
console.log(`  default route (elements → compound): ${okDefault}`)
console.log(`  runtime recipe: ${okRecipe}`)
for (const [code, list] of [...byCode.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${code}: ${list.length}`)
  for (const line of list) console.log(`    - ${line}`)
}

// ── уравнения в стиле учебника ──
const TEXTBOOK: { eq: string; expect: 'ok' | string; main?: string; route?: 'default' | 'recipe' }[] = [
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
  { eq: 'Ba²⁺ + SO₄²⁻ → BaSO₄↓', expect: 'ionic' },
  { eq: 'Ag+ + Cl- = AgCl', expect: 'ionic' },
  { eq: 'Ca → CaO → Ca(OH)₂', expect: 'scheme' },
  { eq: 'Me + H2O = MeOH + H2', expect: 'scheme' },
  { eq: 'CH4 + 2O2 = CO2 + 2H2O', expect: 'ok' },
  { eq: 'C2H5OH + 3O2 = 2CO2 + 3H2O', expect: 'organic' },
  // гидрокарбонат, которого нет в каталоге, — неорганика, а не «organic»
  { eq: 'Fe(HCO3)2 = FeCO3 + CO2 + H2O', expect: 'unknownSubstance' },
  { eq: '2H2O = 2H2 + O2', expect: 'noCompoundProduct' },
  // дробный гидрат (алебастр) разбирается, а не считается схемой
  { eq: '2CaSO4*2H2O = 2CaSO4*0.5H2O + 3H2O', expect: 'unknownSubstance' },
  { eq: 'H2 + O2 = H2O', expect: 'unbalanced' },
  { eq: 'A + B = C', expect: 'scheme' },
]
const tbProblems: string[] = []
for (const t of TEXTBOOK) {
  const r = resolveReactorEquation({ equation: t.eq, main: t.main }, { newId })
  const got = r.ok ? 'ok' : r.code
  if (t.eq.startsWith('CH4') && !r.ok) {
    // CH₄ может отсутствовать в неорганическом каталоге — тогда допустим organic.
    if (r.code !== 'organic') tbProblems.push(`${t.eq}: expected ok|organic, got ${got}`)
    console.log(`  textbook ${got.padEnd(18)} ${t.eq}`)
    continue
  }
  if (got !== t.expect) tbProblems.push(`${t.eq}: expected ${t.expect}, got ${got}${r.ok ? '' : ` ${JSON.stringify(r.details)}`}`)
  if (r.ok) {
    if (t.route && (r.recipe ? 'recipe' : 'default') !== t.route) tbProblems.push(`${t.eq}: expected route ${t.route}`)
    if (t.main && r.productCompoundId !== t.main) tbProblems.push(`${t.eq}: expected main ${t.main}, got ${r.productCompoundId}`)
    tbProblems.push(...checkOk(t.eq, r))
    const params = new URLSearchParams(reactorHrefForEquation(t.eq, { main: t.main, balance: true, src: 'g8:p24' }).split('?')[1])
    const p = parseReactorLinkParams(params)
    assert.equal(p?.spec.equation, t.eq)
    assert.equal(p?.balanceSelf, true)
    assert.equal(p?.backHref, '/learn/g/g8/book?unit=p24')
  }
  console.log(`  textbook ${got.padEnd(18)} ${t.eq}${r.ok ? `  → ${r.equationUnicode} [${r.recipe ? 'recipe' : 'default'}, main ${r.productCompoundId}]` : ''}`)
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
console.log('\nverify-lab-links: all supported reactions seed balanced and pass prepareGuaranteedSynthesisRun')
