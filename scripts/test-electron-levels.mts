/**
 * Школьная схема электронных слоёв ↔ электронная конфигурация ядра данных.
 * Запуск: npx tsx scripts/test-electron-levels.mts
 */
import assert from 'node:assert/strict'
import { ATOMIC_DATA } from '../src/chemistry/data/atomicData.ts'
import { atomLevels, levelsText, outerElectrons, particleLevels } from '../src/chemistry/data/electronLevels.ts'

let checks = 0
const ok = (label: string, cond: boolean, detail = '') => {
  assert.ok(cond, `${label}${detail ? ` — ${detail}` : ''}`)
  checks++
}

const SUP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }
/** Электроны с наибольшим главным квантовым числом по записи конфигурации («[Ar] 3d⁶ 4s²» → n = 4, 2 e⁻). */
function outerFromConfiguration(conf: string): number {
  let maxN = 0
  let count = 0
  for (const m of conf.matchAll(/(\d)([spdf])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g)) {
    const n = Number(m[1])
    const e = Number([...m[3]!].map((c) => SUP[c]).join(''))
    if (n > maxN) {
      maxN = n
      count = e
    } else if (n === maxN) count += e
  }
  return count
}

// Элементы реакций 7 класса (каталог) и их ионы.
// Li в ядре пока нет — добавляется вместе со сценой Li₂O (план 7 класса, этап 3); схема Li — из правила слоёв.
const ELEMENTS = ['H', 'C', 'O', 'Na', 'Mg', 'Al', 'P', 'Cl', 'K', 'Ca', 'Fe', 'Zn'] as const
for (const el of ELEMENTS) {
  const a = ATOMIC_DATA[el]
  if (!a) throw new Error(`нет ${el} в ATOMIC_DATA`)
  const lv = atomLevels(a.z)
  ok(`${el}: сумма электронов слоёв = z`, lv.reduce((s, x) => s + x, 0) === a.z, lv.join(','))
  ok(`${el}: внешний слой = конфигурации ядра (${a.configuration})`, lv[lv.length - 1] === outerFromConfiguration(a.configuration), `${lv.join(',')}`)
  ok(`${el}: слоёв = главному квантовому числу внешних электронов`, lv.length === Math.max(...[...a.configuration.matchAll(/(\d)[spdf]/g)].map((m) => Number(m[1]))))
}

// Схемы из учебника и ионы школьных реакций.
const EXPECT: [string, number, number, string][] = [
  ['Na', 11, 0, '2, 8, 1'],
  ['Cl', 17, 0, '2, 8, 7'],
  ['Na⁺', 11, 1, '2, 8'],
  ['Cl⁻', 17, -1, '2, 8, 8'],
  ['O', 8, 0, '2, 6'],
  ['O²⁻', 8, -2, '2, 8'],
  ['Mg²⁺', 12, 2, '2, 8'],
  ['Al³⁺', 13, 3, '2, 8'],
  ['K', 19, 0, '2, 8, 8, 1'],
  ['K⁺', 19, 1, '2, 8, 8'],
  ['Ca²⁺', 20, 2, '2, 8, 8'],
  ['Li⁺', 3, 1, '2'],
  ['Fe', 26, 0, '2, 8, 14, 2'],
  ['Fe³⁺', 26, 3, '2, 8, 13'],
  ['Zn²⁺', 30, 2, '2, 8, 18'],
  ['P', 15, 0, '2, 8, 5'],
  ['C', 6, 0, '2, 4'],
]
for (const [name, z, q, text] of EXPECT) ok(`${name}: ${text}`, levelsText(z, q) === text, levelsText(z, q))
ok('H⁺: слоёв не осталось', particleLevels(1, 1).length === 0 && outerElectrons(1, 1) === 0)
ok('заряд сохраняется: электронов у иона = z − заряд', EXPECT.every(([, z, q]) => particleLevels(z, q).reduce((s, x) => s + x, 0) === z - q))
ok('завершённый внешний слой у ионов главных подгрупп (2 или 8)', ['Na⁺', 'Cl⁻', 'O²⁻', 'Mg²⁺', 'Al³⁺', 'K⁺', 'Ca²⁺', 'Li⁺'].every((n) => { const e = EXPECT.find((x) => x[0] === n)!; const o = outerElectrons(e[1], e[2]); return o === 8 || (o === 2 && particleLevels(e[1], e[2]).length === 1) }))

console.log(`✓ electron levels: ${checks} проверок пройдено`)
