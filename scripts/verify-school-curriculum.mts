/**
 * Аудит школьной программы 7–9 кл. против каталога веществ.
 * Запуск: npx tsx scripts/verify-school-curriculum.mts
 */
import { compoundById } from '../src/data/compounds.ts'
import {
  CURRICULUM_COMPOUNDS,
  CURRICULUM_REACTIONS,
} from '../src/data/curriculum/schoolInorganicManifest.ts'
import { SCHOOL_REACTION_BANK } from '../src/chemistry/schoolReactionBank.ts'
import { COMPOUND_GRADE_MAP } from '../src/data/curriculum/compoundGradeMap.generated.ts'
import { BALANCE_LESSON_BANK } from '../src/chemistry/balanceLessonBank.ts'

const errors: string[] = []
const warnings: string[] = []

function fail(msg: string) {
  errors.push(msg)
  console.error('FAIL', msg)
}

function warn(msg: string) {
  warnings.push(msg)
  console.warn('WARN', msg)
}

console.log('=== School curriculum audit (grades 7–9) ===\n')

// —— Compounds ——
const missingCompounds: string[] = []
for (const c of CURRICULUM_COMPOUNDS) {
  if (!compoundById[c.id]) missingCompounds.push(c.id)
}

console.log(`Curriculum compounds: ${CURRICULUM_COMPOUNDS.length}`)
console.log(`In catalog: ${CURRICULUM_COMPOUNDS.length - missingCompounds.length}`)
console.log(`Missing: ${missingCompounds.length}`)

if (missingCompounds.length > 0) {
  for (const id of missingCompounds) fail(`missing compound: ${id}`)
}

// —— Reactions: compound refs ——
for (const r of CURRICULUM_REACTIONS) {
  for (const cid of r.compoundIds) {
    if (!compoundById[cid]) fail(`reaction ${r.id}: missing compound ${cid}`)
  }
  if (r.productId && !compoundById[r.productId]) {
    fail(`reaction ${r.id}: missing product ${r.productId}`)
  }
}

// —— School reaction bank ——
for (const r of SCHOOL_REACTION_BANK) {
  if (r.productId && !compoundById[r.productId]) {
    fail(`schoolReaction ${r.id}: missing product ${r.productId}`)
  }
}

// —— Balance lessons ——
for (const l of BALANCE_LESSON_BANK) {
  if (l.productId && !compoundById[l.productId]) {
    fail(`balanceLesson ${l.id}: missing product ${l.productId}`)
  }
}

const lessonIds = new Set(BALANCE_LESSON_BANK.map((l) => l.id))
for (const r of SCHOOL_REACTION_BANK) {
  if (r.kind === 'synthesis' && !lessonIds.has(r.id)) {
    warn(`synthesis reaction ${r.id} has no balance lesson entry`)
  }
}

// —— Summary by grade ——
const byGrade = { 7: 0, 8: 0, 9: 0 } as Record<7 | 8 | 9, number>
for (const c of CURRICULUM_COMPOUNDS) {
  if (compoundById[c.id]) {
    for (const g of c.grades) byGrade[g]++
  }
}
console.log(`Catalog compounds: ${Object.keys(compoundById).length}`)
console.log(`Grade map entries: ${Object.keys(COMPOUND_GRADE_MAP).length}`)

const unmapped = Object.keys(compoundById).filter((id) => !COMPOUND_GRADE_MAP[id])
if (unmapped.length > 0) {
  for (const id of unmapped.slice(0, 10)) fail(`no grade map: ${id}`)
  if (unmapped.length > 10) fail(`... and ${unmapped.length - 10} more without grade map`)
}

const gradeStats = { 7: 0, 8: 0, 9: 0 }
for (const id of Object.keys(compoundById)) {
  const g = COMPOUND_GRADE_MAP[id]?.grades ?? []
  if (g.includes(7)) gradeStats[7]++
  if (g.includes(8)) gradeStats[8]++
  if (g.includes(9)) gradeStats[9]++
}
console.log('Grade distribution:', gradeStats)
console.log(`School reactions: ${SCHOOL_REACTION_BANK.length}`)
console.log(`Balance lessons: ${BALANCE_LESSON_BANK.length}`)
console.log(`Warnings: ${warnings.length}`)

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s) — fix catalog or manifest IDs.`)
  process.exit(1)
}

console.log('\nOK — curriculum manifest matches catalog.')
