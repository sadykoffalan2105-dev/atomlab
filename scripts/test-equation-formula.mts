/**
 * Unit tests: src/chemistry/equationFormula.ts
 * Run: npx tsx scripts/test-equation-formula.mts
 */
import assert from 'node:assert/strict'
import {
  equationImbalance,
  formatEquationAscii,
  formatEquationUnicode,
  formulaCompositionKey,
  formulaToUnicode,
  isParsedEquationBalanced,
  parseEquationText,
  parseFormula,
} from '../src/chemistry/equationFormula.ts'

let passed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
  } catch (e) {
    console.error(`FAIL ${name}`)
    throw e
  }
}

// ── formulas ──
test('simple', () => {
  assert.deepEqual(parseFormula('H2O')?.counts, { H: 2, O: 1 })
  assert.deepEqual(parseFormula('NaCl')?.counts, { Na: 1, Cl: 1 })
  assert.deepEqual(parseFormula('O2')?.counts, { O: 2 })
})
test('parentheses', () => {
  assert.deepEqual(parseFormula('Ca(OH)2')?.counts, { Ca: 1, O: 2, H: 2 })
  assert.deepEqual(parseFormula('(NH4)2SO4')?.counts, { N: 2, H: 8, S: 1, O: 4 })
  assert.deepEqual(parseFormula('Al2(SO4)3')?.counts, { Al: 2, S: 3, O: 12 })
})
test('brackets / complexes', () => {
  assert.deepEqual(parseFormula('Na[Al(OH)4]')?.counts, { Na: 1, Al: 1, O: 4, H: 4 })
  assert.deepEqual(parseFormula('[Cu(NH3)4]SO4')?.counts, { Cu: 1, N: 4, H: 12, S: 1, O: 4 })
  assert.deepEqual(parseFormula('K4[Fe(CN)6]')?.counts, { K: 4, Fe: 1, C: 6, N: 6 })
})
test('hydrates', () => {
  assert.deepEqual(parseFormula('CuSO4*5H2O')?.counts, { Cu: 1, S: 1, O: 9, H: 10 })
  assert.deepEqual(parseFormula('CuSO₄·5H₂O')?.counts, { Cu: 1, S: 1, O: 9, H: 10 })
  assert.deepEqual(parseFormula('Na2CO3•10H2O')?.counts, { Na: 2, C: 1, O: 13, H: 20 })
  // дробный множитель гидрата (алебастр) — не «схема»
  assert.deepEqual(parseFormula('CaSO₄·0.5H₂O')?.counts, { Ca: 1, S: 1, O: 4.5, H: 1 })
  assert.deepEqual(parseFormula('CaSO4*0,5H2O')?.counts, { Ca: 1, S: 1, O: 4.5, H: 1 })
  const gyps = parseEquationText('2CaSO₄·2H₂O → 2CaSO₄·0.5H₂O + 3H₂O')!
  assert.equal(gyps.isScheme, false)
  assert.equal(gyps.products[0]!.coeff, 2)
  assert.equal(formatEquationUnicode(gyps), '2CaSO₄·2H₂O → 2CaSO₄·0.5H₂O + 3H₂O')
})
test('unicode subscripts', () => {
  assert.deepEqual(parseFormula('Fe₂(SO₄)₃')?.counts, { Fe: 2, S: 3, O: 12 })
  assert.deepEqual(parseFormula('Na₂[Zn(OH)₄]')?.counts, { Na: 2, Zn: 1, O: 4, H: 4 })
})
test('charges', () => {
  assert.equal(parseFormula('SO₄²⁻')?.charge, -2)
  assert.deepEqual(parseFormula('SO₄²⁻')?.counts, { S: 1, O: 4 })
  assert.equal(parseFormula('SO4^2-')?.charge, -2)
  assert.equal(parseFormula('Fe³⁺')?.charge, 3)
  assert.equal(parseFormula('Na+')?.charge, 1)
  assert.equal(parseFormula('Cl-')?.charge, -1)
  assert.equal(parseFormula('NH4+')?.charge, 1)
  assert.deepEqual(parseFormula('NH4+')?.counts, { N: 1, H: 4 })
  assert.equal(parseFormula('Fe3+')?.charge, 3)
  assert.deepEqual(parseFormula('Fe3+')?.counts, { Fe: 1 })
  assert.equal(parseFormula('OH⁻')?.charge, -1)
  assert.equal(parseFormula('ē')?.electron, true)
  assert.equal(parseFormula('e⁻')?.electron, true)
})
test('state marks', () => {
  assert.deepEqual(parseFormula('BaSO₄↓')?.counts, { Ba: 1, S: 1, O: 4 })
  assert.deepEqual(parseFormula('CO₂↑')?.counts, { C: 1, O: 2 })
  assert.deepEqual(parseFormula('H2SO4 (конц.)')?.counts, { H: 2, S: 1, O: 4 })
  assert.deepEqual(parseFormula('NaCl(aq)')?.counts, { Na: 1, Cl: 1 })
})
test('rejects placeholders', () => {
  assert.equal(parseFormula('Me'), null)
  assert.equal(parseFormula('MeO'), null)
  assert.equal(parseFormula('R-OH'), null)
  assert.equal(parseFormula('CnH2n+2'), null)
  assert.equal(parseFormula('Ca(OH'), null)
  assert.equal(parseFormula('Ca)OH('), null)
  assert.equal(parseFormula(''), null)
  assert.equal(parseFormula('Xx2'), null)
})
test('unicode output', () => {
  assert.equal(formulaToUnicode('Ca(OH)2'), 'Ca(OH)₂')
  assert.equal(formulaToUnicode('SO4^2-'), 'SO₄²⁻')
  assert.equal(formulaToUnicode('CuSO4*5H2O'), 'CuSO₄·5H₂O')
  assert.equal(formulaToUnicode('Na2[Zn(OH)4]'), 'Na₂[Zn(OH)₄]')
})
test('composition key', () => {
  assert.equal(formulaCompositionKey({ O: 1, H: 2 }), 'H:2|O:1')
})

// ── equations ──
test('ascii =', () => {
  const eq = parseEquationText('Zn + 2HCl = ZnCl2 + H2')!
  assert.equal(eq.arrow, '=')
  assert.deepEqual(
    eq.reactants.map((s) => [s.coeff, s.formula]),
    [
      [1, 'Zn'],
      [2, 'HCl'],
    ],
  )
  assert.deepEqual(
    eq.products.map((s) => [s.coeff, s.formula]),
    [
      [1, 'ZnCl2'],
      [1, 'H2'],
    ],
  )
  assert.equal(eq.isIonic, false)
  assert.equal(eq.isScheme, false)
  assert.equal(isParsedEquationBalanced(eq), true)
})
test('unicode →', () => {
  const eq = parseEquationText('2KMnO₄ + 16HCl → 2KCl + 2MnCl₂ + 5Cl₂ + 8H₂O')!
  assert.equal(eq.arrow, '→')
  assert.equal(eq.reactants.length, 2)
  assert.equal(eq.products.length, 4)
  assert.equal(eq.products[3]!.coeff, 8)
  assert.equal(isParsedEquationBalanced(eq), true)
})
test('reversible arrows', () => {
  assert.equal(parseEquationText('N₂ + 3H₂ ⇄ 2NH₃')!.arrow, '⇌')
  assert.equal(parseEquationText('N2 + 3H2 <=> 2NH3')!.arrow, '⇌')
  assert.equal(parseEquationText('N2 + 3H2 ⇌ 2NH3')!.arrow, '⇌')
  assert.equal(parseEquationText('CaCO3 -> CaO + CO2')!.arrow, '→')
})
test('no spaces', () => {
  const eq = parseEquationText('2H2+O2=2H2O')!
  assert.equal(eq.reactants.length, 2)
  assert.equal(eq.products[0]!.coeff, 2)
  assert.equal(isParsedEquationBalanced(eq), true)
})
test('precipitate / gas marks', () => {
  const eq = parseEquationText('Na₂CO₃ + 2HCl → 2NaCl + H₂O + CO₂↑')!
  assert.equal(eq.products[2]!.formula, 'CO2')
  assert.equal(isParsedEquationBalanced(eq), true)
  const eq2 = parseEquationText('BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl')!
  assert.equal(eq2.products[0]!.formula, 'BaSO4')
})
test('conditions after arrow', () => {
  const eq = parseEquationText('Fe₂O₃ + CO →(>570 °C) 2FeO + CO₂')!
  assert.equal(eq.conditions, '>570 °C')
  assert.equal(eq.products[0]!.formula, 'FeO')
  assert.equal(isParsedEquationBalanced(eq), true)
  const eq2 = parseEquationText('2KClO3 =(MnO2, t) 2KCl + 3O2')!
  assert.equal(eq2.conditions, 'MnO2, t')
  assert.equal(eq2.products.length, 2)
  const eq3 = parseEquationText('CaCO3 = t° CaO + CO2')!
  assert.equal(eq3.conditions, 't°')
  assert.equal(eq3.products[0]!.formula, 'CaO')
})
test('parenthesised product right after arrow is a substance', () => {
  const eq = parseEquationText('2NH₃ + H₂SO₄ → (NH₄)₂SO₄')!
  assert.equal(eq.conditions, null)
  assert.equal(eq.products[0]!.formula, '(NH4)2SO4')
  assert.equal(isParsedEquationBalanced(eq), true)
  const eq2 = parseEquationText('CuSO4 + 4NH3 -> [Cu(NH3)4]SO4')!
  assert.equal(eq2.products[0]!.formula, '[Cu(NH3)4]SO4')
  assert.equal(isParsedEquationBalanced(eq2), true)
})
test('fractions', () => {
  const eq = parseEquationText('H2 + 1/2O2 = H2O')!
  assert.equal(eq.reactants[1]!.coeff, 0.5)
  assert.equal(isParsedEquationBalanced(eq), true)
  const eq2 = parseEquationText('H₂ + ½O₂ → H₂O')!
  assert.equal(eq2.reactants[1]!.coeff, 0.5)
  const eq3 = parseEquationText('H2 + 0.5 O2 = H2O')!
  assert.equal(eq3.reactants[1]!.coeff, 0.5)
})
test('ionic', () => {
  const eq = parseEquationText('Ba²⁺ + SO₄²⁻ → BaSO₄↓')!
  assert.equal(eq.isIonic, true)
  assert.equal(eq.isScheme, false)
  assert.equal(isParsedEquationBalanced(eq), true)
  const eq2 = parseEquationText('Ag+ + Cl- = AgCl')!
  assert.equal(eq2.isIonic, true)
  assert.equal(eq2.reactants.length, 2)
  assert.equal(isParsedEquationBalanced(eq2), true)
  const eq3 = parseEquationText('Zn⁰ − 2ē → Zn²⁺')
  assert.ok(eq3 == null || eq3.isIonic || eq3.isScheme)
  const eq4 = parseEquationText('Cu²⁺ + 2ē → Cu')!
  assert.equal(eq4.isIonic, true)
  assert.equal(isParsedEquationBalanced(eq4), true)
  const eq5 = parseEquationText('Fe^3+ + 3OH^- -> Fe(OH)3')!
  assert.equal(eq5.reactants.length, 2)
  assert.equal(isParsedEquationBalanced(eq5), true)
})
test('schemes', () => {
  assert.equal(parseEquationText('Ca → CaO → Ca(OH)₂')!.isScheme, true)
  assert.equal(parseEquationText('4NH₃ + 5O₂ → 4NO + 6H₂O; 2NO + O₂ → 2NO₂')!.isScheme, true)
  assert.equal(parseEquationText('Me + H2O = MeOH + H2')!.isScheme, true)
  assert.equal(parseEquationText('кислота + основание = соль + вода')!.isScheme, true)
})
test('not equations', () => {
  assert.equal(parseEquationText(''), null)
  assert.equal(parseEquationText('H2O'), null)
  assert.equal(parseEquationText('= H2O'), null)
})
test('unbalanced detection', () => {
  const eq = parseEquationText('H2 + O2 = H2O')!
  assert.equal(isParsedEquationBalanced(eq), false)
  assert.deepEqual(equationImbalance(eq), ['O: 2≠1'])
})
test('format round trip', () => {
  const eq = parseEquationText('2H2 + O2 = 2H2O')!
  assert.equal(formatEquationUnicode(eq), '2H₂ + O₂ = 2H₂O')
  assert.equal(formatEquationAscii(eq), '2H2 + O2 = 2H2O')
  const back = parseEquationText(formatEquationAscii(parseEquationText('Ba²⁺ + SO₄²⁻ → BaSO₄↓')!))!
  assert.equal(back.isIonic, true)
  assert.equal(isParsedEquationBalanced(back), true)
})

console.log(`test-equation-formula: ${passed} passed`)
