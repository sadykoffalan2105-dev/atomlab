#!/usr/bin/env node
/**
 * Проверка годов открытия всех 118 элементов.
 * Запуск: npm run validate:element-years
 */
import assert from 'node:assert/strict'
import { ELEMENTS } from '../src/data/elements.ts'
import {
  ELEMENT_DISCOVERY_YEARS,
  ELEMENT_DISCOVERY_YEAR_ANCIENT,
  elementDiscoveryYear,
} from '../src/data/elementDiscoveryYears.ts'

assert.equal(Object.keys(ELEMENT_DISCOVERY_YEARS).length, 118, 'reference covers 118 elements')

for (let z = 1; z <= 118; z++) {
  const ref = elementDiscoveryYear(z)
  assert.ok(ref, `missing reference year for z=${z}`)
  const el = ELEMENTS.find((e) => e.z === z)
  assert.ok(el, `missing element z=${z}`)
  assert.equal(
    el.yearDiscovered,
    ref,
    `${el.symbol} (z=${z}): expected ${ref}, got ${el.yearDiscovered}`,
  )
}

const ancient = ELEMENTS.filter((e) => e.yearDiscovered === ELEMENT_DISCOVERY_YEAR_ANCIENT)
assert.ok(ancient.length >= 10, 'ancient elements present')
assert.equal(ELEMENTS.find((e) => e.symbol === 'Si')?.yearDiscovered, '1824', 'silicon year')

console.log('validate-element-years: all 118 elements OK')
