/**
 * Органика v2 · исправление атомного соответствия по школьным механизмам (правила — mechanisms.mts).
 *   npx tsx scripts/organic-v2/fix-mechanisms.mts
 * Вызывается в конце build_reactions.py; можно запускать отдельно на готовом reactions.json (идемпотентно).
 * Также исправляет тип реакции, если распознаватель ошибся (TYPE_OVERRIDES).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import type { OV2Reaction, OV2ReactionsFile, OV2ReactionType } from '../../src/data/organicV2/types.ts'
import { fixMechanisms, mechanismViolations, recomputeChanges } from './mechanisms.mts'

const path = new URL('../../src/data/organicV2/reactions.json', import.meta.url)
const file = JSON.parse(readFileSync(path, 'utf8')) as OV2ReactionsFile & { reactions: OV2Reaction[] }

/** тип по механизму учебника, где распознаватель ошибся: id → [type, typeRu] */
const TYPE_OVERRIDES: Record<string, [OV2ReactionType, string]> = {
  // CH₃–CH₂Cl → CH₂=CH₂ + HCl — пример реакции отщепления (гл. I), не изомеризация
  'g10-c1-s06-r11': ['elimination', 'отщепление'],
  // (CH₃COO)₂Ca → CH₃COCH₃ + CaCO₃ — термическое разложение соли (получение ацетона), не изомеризация
  'g10-c3-s11-r4': ['other', 'разложение'],
}

/**
 * Ручное соответствие тяжёлых атомов продукта (перебор обменов его не находит): id → [номер участника-продукта,
 * номера map по индексам тяжёлых атомов продукта]. Водороды назначаются «за своим соседом» автоматически.
 */
const MANUAL_HEAVY: Record<string, [number, number[]]> = {
  // бутадиен-стирольный каучук: звено бутадиена C1=C2–C3=C4 → –C1–C2=C3–C4– (1,4-присоединение),
  // стирол CH₂=CH(C₆H₅) → –CH₂–CH(C₆H₅)–; новые C–C — только между атомами бывших двойных связей.
  // Цепь продукта: [CH₂]0–1=2–3–4(Ph 5…10)–11–12–13=14–15–16(Ph 17…22)–23–24–25=26–27–28(Ph 29…34)–35[CH₂]
  'g10-c2-s12-r3': [6, [
    21, 22, 23, 24, 32, 33, 34, 35, 36, 37, 38, 31,
    1, 2, 3, 4, 48, 49, 50, 51, 52, 53, 54, 47,
    11, 12, 13, 14, 64, 65, 66, 67, 68, 69, 70, 63,
  ]],
}

type MutSpecies = { side: 'L' | 'R'; map: number[]; atoms: readonly { el: string }[]; bonds: readonly { a: number; b: number; o: number }[] }

function applyManual(r: OV2Reaction): OV2Reaction {
  const m = MANUAL_HEAVY[r.id]
  if (!m) return r
  const [si, heavyMaps] = m
  const species = r.species.map((x) => ({ ...x, map: [...x.map] })) as unknown as MutSpecies[]
  const prod = species[si]
  const heavyIdx = prod.atoms.map((a, k) => (a.el === 'H' ? -1 : k)).filter((k) => k >= 0)
  if (heavyIdx.length !== heavyMaps.length) throw new Error(`${r.id}: тяжёлых атомов ${heavyIdx.length} ≠ ${heavyMaps.length}`)
  // H слева: map тяжёлого атома → map его водородов
  const hOf = new Map<number, number[]>()
  for (const x of species) {
    if (x.side !== 'L') continue
    for (const b of x.bonds) {
      const [h, c] = x.atoms[b.a].el === 'H' ? [b.a, b.b] : x.atoms[b.b].el === 'H' ? [b.b, b.a] : [-1, -1]
      if (h < 0 || x.atoms[c].el === 'H') continue
      const list = hOf.get(x.map[c]) ?? []
      list.push(x.map[h])
      hOf.set(x.map[c], list)
    }
  }
  const newMap = [...prod.map]
  heavyIdx.forEach((k, n) => (newMap[k] = heavyMaps[n]))
  for (const b of prod.bonds) {
    const [h, c] = prod.atoms[b.a].el === 'H' ? [b.a, b.b] : prod.atoms[b.b].el === 'H' ? [b.b, b.a] : [-1, -1]
    if (h < 0) continue
    const pool = hOf.get(newMap[c])
    if (!pool?.length) throw new Error(`${r.id}: у атома map ${newMap[c]} не хватает водородов`)
    newMap[h] = pool.shift()!
  }
  if (new Set(newMap).size !== newMap.length) throw new Error(`${r.id}: повтор номеров соответствия`)
  prod.map = newMap
  const out = { ...r, species: species as unknown as OV2Reaction['species'] }
  return { ...out, changes: recomputeChanges({ species }) }
}

let fixed = 0
let left = 0
const t0 = Date.now()
file.reactions = file.reactions.map((r) => {
  let x = r
  const ov = TYPE_OVERRIDES[r.id]
  if (ov && (r.type !== ov[0] || r.typeRu !== ov[1])) x = { ...x, type: ov[0], typeRu: ov[1] }
  x = applyManual(x)
  const f = fixMechanisms(x)
  if (f) {
    const before = mechanismViolations(x).length
    const after = mechanismViolations(f).length
    if (after < before) {
      fixed++
      console.log(`  ✓ ${r.id}: нарушений ${before} → ${after}, изменений связей ${x.changes.length} → ${f.changes.length}`)
      x = f
    }
    if (after) left++
  }
  return x
})
writeFileSync(path, JSON.stringify(file))
console.log(`fix-mechanisms: исправлено ${fixed} реакций, осталось с нарушениями ${left}; ${Date.now() - t0} мс`)
