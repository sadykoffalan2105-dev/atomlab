/**
 * VR Lab reaction engine validation — run: npx tsx scripts/validate-vr-reactions.ts
 */
import { compoundById } from '../src/data/compounds'
import { mixVrLabSubstances } from '../src/vrLab/mixEngine'
import { precipitateLikely } from '../src/vrLab/chemistry/solubilityBridge'
import { parseSaltId } from '../src/vrLab/chemistry/ionRegistry'

type Case = {
  a: string
  b: string
  expectKind: 'reaction' | 'noReaction'
  expectEffect?: string
}

const KEY_CASES: Case[] = [
  { a: 'hcl', b: 'naoh', expectKind: 'reaction', expectEffect: 'neutralization' },
  { a: 'h2so4', b: 'naoh', expectKind: 'reaction', expectEffect: 'neutralization' },
  { a: 'salt_ag_no3', b: 'nacl', expectKind: 'reaction', expectEffect: 'precipitate' },
  { a: 'hcl', b: 'salt_nahco3', expectKind: 'reaction', expectEffect: 'gasEvolution' },
  { a: 'hcl', b: 'salt_ca_co3', expectKind: 'reaction', expectEffect: 'gasEvolution' },
  { a: 'salt_cu_so4', b: 'naoh', expectKind: 'reaction', expectEffect: 'precipitate' },
  { a: 'salt_fe3_cl', b: 'naoh', expectKind: 'reaction', expectEffect: 'precipitate' },
  { a: 'cao', b: 'h2o', expectKind: 'reaction', expectEffect: 'hydration' },
  { a: 'cuo', b: 'h2so4', expectKind: 'reaction', expectEffect: 'colorShift' },
  { a: 'salt_k_mno4', b: 'h2o', expectKind: 'noReaction' },
  { a: 'co2', b: 'so2', expectKind: 'noReaction' },
]

let passed = 0
let failed = 0

for (const c of KEY_CASES) {
  if (!compoundById[c.a] || !compoundById[c.b]) {
    console.warn(`SKIP missing compound: ${c.a} + ${c.b}`)
    continue
  }
  const r = mixVrLabSubstances(c.a, c.b)
  const ok =
    r.kind === c.expectKind &&
    (c.expectEffect == null || r.effect === c.expectEffect)
  if (ok) {
    passed++
    console.log(`OK  ${c.a} + ${c.b} → ${r.effect} (${r.confidence})`)
  } else {
    failed++
    console.error(`FAIL ${c.a} + ${c.b}: got ${r.kind}/${r.effect}, want ${c.expectKind}/${c.expectEffect}`)
    console.error(`     ${r.equationUnicode}`)
  }
}

let solOk = 0
for (const id of Object.keys(compoundById).filter((k) => k.startsWith('salt_'))) {
  const ions = parseSaltId(id)
  if (!ions) continue
  const insol = precipitateLikely(ions.cationId, ions.anionId)
  if (insol) solOk++
}

console.log(`\nKey reactions: ${passed} passed, ${failed} failed`)
console.log(`Salt ion pairs mapped: ${solOk} insoluble checks available`)
process.exit(failed > 0 ? 1 : 0)
