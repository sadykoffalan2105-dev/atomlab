import assert from 'node:assert/strict'
import { computeElectronBalance } from '../src/chemistry/electronBalanceEngine.ts'
import { oxidationForCompound, oxidationForElementTerm } from '../src/chemistry/oxidationStateEngine.ts'
import type { ReactorEquationTerm } from '../src/chemistry/reactorEquationBalance.ts'
import type { CompoundDef } from '../src/types/chemistry.ts'

const fe2o3 = {
  id: 'fe2o3',
  composition: { Fe: 2, O: 3 },
  formulaUnicode: 'Fe₂O₃',
} as CompoundDef

const al2o3 = {
  id: 'al2o3',
  composition: { Al: 2, O: 3 },
  formulaUnicode: 'Al₂O₃',
} as CompoundDef

const h2o = {
  id: 'h2o',
  composition: { H: 2, O: 1 },
  formulaUnicode: 'H₂O',
} as CompoundDef

{
  const ox = oxidationForCompound(fe2o3)!
  const fe = ox.labels.find((l) => l.symbol === 'Fe')
  const o = ox.labels.find((l) => l.symbol === 'O')
  assert.equal(fe?.ox, 3)
  assert.equal(o?.ox, -2)
}

{
  const t: ReactorEquationTerm = { id: 'o2', z: 8, coeff: 1, diatomic: true }
  assert.ok(oxidationForElementTerm(t).formulaWithOx.includes('O'))
}

{
  const left: ReactorEquationTerm[] = [
    { id: 'fe', z: 26, coeff: 1 },
    { id: 'o2', z: 8, coeff: 1, diatomic: true },
  ]
  const r = computeElectronBalance(left, fe2o3)!
  assert.equal(r.isRedox, true)
  assert.equal(r.suggestedLeft.fe, 4)
  assert.equal(r.suggestedLeft.o2, 3)
  assert.equal(r.suggestedProductCoeff, 2)
}

{
  const left: ReactorEquationTerm[] = [
    { id: 'al', z: 13, coeff: 1 },
    { id: 'o2', z: 8, coeff: 1, diatomic: true },
  ]
  const r = computeElectronBalance(left, al2o3)!
  assert.equal(r.isRedox, true)
  assert.equal(r.suggestedLeft.al, 4)
  assert.equal(r.suggestedLeft.o2, 3)
  assert.equal(r.suggestedProductCoeff, 2)
}

{
  const left: ReactorEquationTerm[] = [
    { id: 'h2', z: 1, coeff: 1, diatomic: true },
    { id: 'o2', z: 8, coeff: 1, diatomic: true },
  ]
  const r = computeElectronBalance(left, h2o)!
  assert.equal(r.isRedox, true)
  assert.equal(r.suggestedLeft.h2, 2)
  assert.equal(r.suggestedLeft.o2, 1)
  assert.equal(r.suggestedProductCoeff, 2)
}

console.log('test-electron-balance: all passed')
