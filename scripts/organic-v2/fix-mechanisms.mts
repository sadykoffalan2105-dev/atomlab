/**
 * Органика v2 · исправление атомного соответствия по школьным механизмам (правила — mechanisms.mts).
 *   npx tsx scripts/organic-v2/fix-mechanisms.mts
 * Вызывается в конце build_reactions.py; можно запускать отдельно на готовом reactions.json (идемпотентно).
 * Также исправляет тип реакции, если распознаватель ошибся (TYPE_OVERRIDES).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import type { OV2Reaction, OV2ReactionsFile, OV2ReactionType } from '../../src/data/organicV2/types.ts'
import { fixMechanisms, mechanismViolations } from './mechanisms.mts'

const path = new URL('../../src/data/organicV2/reactions.json', import.meta.url)
const file = JSON.parse(readFileSync(path, 'utf8')) as OV2ReactionsFile & { reactions: OV2Reaction[] }

/** тип по механизму учебника, где распознаватель ошибся: id → [type, typeRu] */
const TYPE_OVERRIDES: Record<string, [OV2ReactionType, string]> = {
  // CH₃–CH₂Cl → CH₂=CH₂ + HCl — пример реакции отщепления (гл. I), не изомеризация
  'g10-c1-s06-r11': ['elimination', 'отщепление'],
  // (CH₃COO)₂Ca → CH₃COCH₃ + CaCO₃ — термическое разложение соли (получение ацетона), не изомеризация
  'g10-c3-s11-r4': ['other', 'разложение'],
}

let fixed = 0
let left = 0
const t0 = Date.now()
file.reactions = file.reactions.map((r) => {
  let x = r
  const ov = TYPE_OVERRIDES[r.id]
  if (ov && (r.type !== ov[0] || r.typeRu !== ov[1])) x = { ...x, type: ov[0], typeRu: ov[1] }
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
