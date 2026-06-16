/**
 * Краткая форма ПСХЭ (российский стандарт).
 * 8 групп × 2 подгруппы (A/B) = 16 подколонок.
 * g: 1–8, s: "a" | "b", y: ряд, t: триада VIII, f: слот f-ряда.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = join(__dirname, '../src/data/ruElementGridPositions.json')

const pos = []

function add(z, y, g, s, t, f) {
  const e = { z, y }
  if (g != null) e.g = g
  if (s != null) e.s = s
  if (t != null) e.t = t
  if (f != null) e.f = f
  pos.push(e)
}

function row(y, entries) {
  for (const [z, g, s] of entries) add(z, y, g, s)
}

/** Триада VIII: Fe/Ru/Os/Hs — в группе VIII; Co–Ni и т.д. — в 2 колонках справа. */
function triad(y, z0, z1, z2) {
  add(z0, y, 8, 'b')
  add(z1, y, null, null, 1)
  add(z2, y, null, null, 2)
}

// Период 1, ряд 1 — H (I A), He (VIII A)
add(1, 1, 1, 'a')
add(2, 1, 8, 'a')

// Период 2, ряд 2 — подгруппа A; благородные — VIII A
row(2, [
  [3, 1, 'a'],
  [4, 2, 'a'],
  [5, 3, 'a'],
  [6, 4, 'a'],
  [7, 5, 'a'],
  [8, 6, 'a'],
  [9, 7, 'a'],
  [10, 8, 'a'],
])

// Период 3, ряд 3
row(3, [
  [11, 1, 'a'],
  [12, 2, 'a'],
  [13, 3, 'a'],
  [14, 4, 'a'],
  [15, 5, 'a'],
  [16, 6, 'a'],
  [17, 7, 'a'],
  [18, 8, 'a'],
])

// Период 4, ряды 4–5
row(4, [
  [19, 1, 'a'],
  [20, 2, 'a'],
  [21, 3, 'b'],
  [22, 4, 'b'],
  [23, 5, 'b'],
  [24, 6, 'b'],
  [25, 7, 'b'],
])
triad(4, 26, 27, 28)
row(5, [
  [29, 1, 'b'],
  [30, 2, 'b'],
  [31, 3, 'a'],
  [32, 4, 'a'],
  [33, 5, 'a'],
  [34, 6, 'a'],
  [35, 7, 'a'],
  [36, 8, 'a'],
])

// Период 5, ряды 6–7
row(6, [
  [37, 1, 'a'],
  [38, 2, 'a'],
  [39, 3, 'b'],
  [40, 4, 'b'],
  [41, 5, 'b'],
  [42, 6, 'b'],
  [43, 7, 'b'],
])
triad(6, 44, 45, 46)
row(7, [
  [47, 1, 'b'],
  [48, 2, 'b'],
  [49, 3, 'a'],
  [50, 4, 'a'],
  [51, 5, 'a'],
  [52, 6, 'a'],
  [53, 7, 'a'],
  [54, 8, 'a'],
])

// Период 6*, ряды 8–9
row(8, [
  [55, 1, 'a'],
  [56, 2, 'a'],
  [57, 3, 'a'],
  [72, 4, 'b'],
  [73, 5, 'b'],
  [74, 6, 'b'],
  [75, 7, 'b'],
])
triad(8, 76, 77, 78)
row(9, [
  [79, 1, 'b'],
  [80, 2, 'b'],
  [81, 3, 'a'],
  [82, 4, 'a'],
  [83, 5, 'a'],
  [84, 6, 'a'],
  [85, 7, 'a'],
  [86, 8, 'a'],
])

// Период 7*, ряды 10–11
row(10, [
  [87, 1, 'a'],
  [88, 2, 'a'],
  [89, 3, 'a'],
  [104, 4, 'b'],
  [105, 5, 'b'],
  [106, 6, 'b'],
  [107, 7, 'b'],
])
triad(10, 108, 109, 110)
row(11, [
  [111, 1, 'b'],
  [112, 2, 'b'],
  [113, 3, 'a'],
  [114, 4, 'a'],
  [115, 5, 'a'],
  [116, 6, 'a'],
  [117, 7, 'a'],
  [118, 8, 'a'],
])

// Лантаноиды Ce–Lu (La в основной сетке)
for (let i = 0; i < 14; i++) add(58 + i, 12, null, null, null, i)

// Актиниды Th–Lr (Ac в основной сетке)
for (let i = 0; i < 14; i++) add(90 + i, 13, null, null, null, i)

pos.sort((a, b) => a.z - b.z)
writeFileSync(out, JSON.stringify(pos, null, 4) + '\n', 'utf8')
console.log('Wrote', pos.length, 'positions')
