import assert from 'node:assert/strict'
import { buildAtomBalanceRows } from '../src/chemistry/atomBalanceTable.ts'
import type { ReactorEquationTerm } from '../src/chemistry/reactorEquationBalance.ts'
import type { CompoundDef } from '../src/types/chemistry.ts'

const fe2o3 = {
  id: 'fe2o3',
  composition: { Fe: 2, O: 3 },
} as CompoundDef

const h2o = {
  id: 'h2o',
  composition: { H: 2, O: 1 },
} as CompoundDef

{
  const left: ReactorEquationTerm[] = [
    { id: 'fe', z: 26, coeff: 1 },
    { id: 'o2', z: 8, coeff: 1, diatomic: true },
  ]
  const t = buildAtomBalanceRows(left, fe2o3, 1)
  assert.equal(t.allBalanced, false)
  const fe = t.rows.find((r) => r.symbol === 'Fe')
  const o = t.rows.find((r) => r.symbol === 'O')
  assert.deepEqual(fe, { symbol: 'Fe', left: 1, right: 2, balanced: false })
  assert.deepEqual(o, { symbol: 'O', left: 2, right: 3, balanced: false })
}

{
  const left: ReactorEquationTerm[] = [
    { id: 'fe', z: 26, coeff: 4 },
    { id: 'o2', z: 8, coeff: 3, diatomic: true },
  ]
  const t = buildAtomBalanceRows(left, fe2o3, 2)
  assert.equal(t.allBalanced, true)
  assert.ok(t.rows.every((r) => r.balanced))
}

{
  const left: ReactorEquationTerm[] = [
    { id: 'h2', z: 1, coeff: 2, diatomic: true },
    { id: 'o2', z: 8, coeff: 1, diatomic: true },
  ]
  const t = buildAtomBalanceRows(left, h2o, 2)
  assert.equal(t.allBalanced, true)
}

console.log('test-atom-balance-table: all passed')
