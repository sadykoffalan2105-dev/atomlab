#!/usr/bin/env node
/**
 * Автооформление формул в «Рабочей зоне» (pure TS, без DOM).
 * Запуск: npx tsx scripts/test-workzone-format.mts
 */
import assert from 'node:assert/strict'
import {
  formatChemistry,
  formatChemistryInRange,
  insertAtRange,
  insertBlockAtRange,
  normalizeArrows,
} from '../src/components/learn/LearnBoardPadFormat.ts'

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    passed += 1
    console.log(`ok   ${name}`)
  } catch (e) {
    failed += 1
    console.error(`FAIL ${name}`)
    console.error(e instanceof Error ? e.message : e)
  }
}

test('H2SO4 → H₂SO₄', () => assert.equal(formatChemistry('H2SO4'), 'H₂SO₄'))
test('Ca(OH)2 → Ca(OH)₂', () => assert.equal(formatChemistry('Ca(OH)2'), 'Ca(OH)₂'))
test('2H2O keeps the leading coefficient', () => assert.equal(formatChemistry('2H2O'), '2H₂O'))
test('Fe2(SO4)3 → Fe₂(SO₄)₃', () => assert.equal(formatChemistry('Fe2(SO4)3'), 'Fe₂(SO₄)₃'))
test('CuSO4·5H2O → CuSO₄·5H₂O', () => assert.equal(formatChemistry('CuSO4·5H2O'), 'CuSO₄·5H₂O'))

test('whole equation with coefficients and ASCII arrow', () =>
  assert.equal(formatChemistry('2Al + 3H2SO4 -> Al2(SO4)3 + 3H2'), '2Al + 3H₂SO₄ → Al₂(SO₄)₃ + 3H₂'))
test('reversible arrow', () => assert.equal(normalizeArrows('N2 + 3H2 <=> 2NH3'), 'N2 + 3H2 ⇄ 2NH3'))
test('already formatted text is stable', () => assert.equal(formatChemistry('H₂SO₄ + 2NaOH'), 'H₂SO₄ + 2NaOH'))
test('two-digit index', () => assert.equal(formatChemistry('C6H12O6'), 'C₆H₁₂O₆'))
test('(NH4)2SO4 with a bracket at the start', () => assert.equal(formatChemistry('(NH4)2SO4'), '(NH₄)₂SO₄'))
test('plain prose and numbers untouched', () =>
  assert.equal(formatChemistry('Задача 1: масса 25 г, x2 = 4, mol 3'), 'Задача 1: масса 25 г, x2 = 4, mol 3'))
test('temperature and units untouched', () => assert.equal(formatChemistry('t = 25 °C, V = 22.4 л'), 't = 25 °C, V = 22.4 л'))

test('range: only the selection is formatted', () => {
  const src = 'H2O и H2SO4'
  const r = formatChemistryInRange(src, { start: 6, end: 11 })
  assert.equal(r.text, 'H2O и H₂SO₄')
  assert.deepEqual(r.range, { start: 6, end: 11 })
  assert.equal(r.changed, true)
})
test('range: collapsed caret formats everything and keeps caret', () => {
  const r = formatChemistryInRange('H2O + CO2', { start: 3, end: 3 })
  assert.equal(r.text, 'H₂O + CO₂')
  assert.deepEqual(r.range, { start: 3, end: 3 })
})
test('range: unchanged text reports changed=false', () => {
  assert.equal(formatChemistryInRange('NaCl', { start: 0, end: 0 }).changed, false)
})

test('insertAtRange replaces the selection and moves the caret', () => {
  const r = insertAtRange('SO4', { start: 2, end: 3 }, '₄')
  assert.equal(r.text, 'SO₄')
  assert.equal(r.caret, 3)
})
test('insertBlockAtRange starts on a fresh line', () => {
  const r = insertBlockAtRange('Тема', { start: 4, end: 4 }, 'Дано:')
  assert.equal(r.text, 'Тема\nДано:\n')
  assert.equal(r.caret, r.text.length)
})
test('insertBlockAtRange at the start adds no leading break', () => {
  assert.equal(insertBlockAtRange('', { start: 0, end: 0 }, 'A').text, 'A\n')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
