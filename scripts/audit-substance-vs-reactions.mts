/**
 * Аудит: вещества (из простых веществ) vs школьные реакции (молекула+…).
 * Запуск: npx tsx scripts/audit-substance-vs-reactions.mts
 */
import { compoundById } from '../src/data/compounds.ts'
import {
  fromElementsPolicy,
  preferredSchoolReactionId,
  listForbiddenFromElementsIds,
} from '../src/chemistry/substanceSynthesisRoute.ts'
import { SCHOOL_REACTION_BANK } from '../src/chemistry/schoolReactionBank.ts'
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

const compounds = Object.values(compoundById)
const reactionIds = new Set(SCHOOL_REACTION_BANK.map((r) => r.id))

console.log('=== Substance vs Reactions audit ===\n')
console.log(`Compounds in catalog: ${compounds.length}`)
console.log(`School reactions: ${SCHOOL_REACTION_BANK.length}`)
console.log(`Balance lessons: ${BALANCE_LESSON_BANK.length}`)

let forbidden = 0
let allowed = 0
for (const c of compounds) {
  const policy = fromElementsPolicy(c.id)
  if (policy === 'forbidden') {
    forbidden++
    const recipe = c.laboratoryRecipeRu
    if (!recipe.includes('Маршрут') && !recipe.includes('→') && recipe.includes('=')) {
      fail(`${c.id}: forbidden but still auto element equation «${recipe}»`)
    }
    if (/2S\s*\+\s*3O|3O₂\s*\+\s*2S/.test(recipe)) {
      fail(`${c.id}: still has wrong SO₃ shortcut «${recipe}»`)
    }
    const pref = preferredSchoolReactionId(c.id)
    if (pref && !reactionIds.has(pref)) {
      fail(`${c.id}: preferredSchoolReactionId «${pref}» missing from school bank`)
    }
  } else {
    allowed++
  }
}

console.log(`From-elements allowed: ${allowed}`)
console.log(`From-elements forbidden (school route): ${forbidden}`)
console.log(`Explicit forbidden list size: ${listForbiddenFromElementsIds().length}`)

for (const id of [
  'so3-h2o',
  'so2-h2o',
  'p2o5-h2o',
  'co2-h2o',
  'so2-o2-so3',
  'ostwald-hno3',
  'na2sio3-hcl',
  'baclo3-h2so4',
  'cl2-h2o-hclo',
] as const) {
  if (!reactionIds.has(id)) fail(`missing school reaction ${id}`)
}

const so3 = compoundById.so3
if (!so3) fail('so3 missing')
else {
  if (/2S\s*\+\s*3O/.test(so3.laboratoryRecipeRu)) fail('so3 recipe still 2S+3O₂')
  if (!so3.laboratoryRecipeRu.includes('SO₂')) warn('so3 recipe should mention SO₂ step')
  const cat = so3.synthesisConditionsRu.catalyst ?? ''
  if (!/V₂O₅|V2O5/.test(cat)) fail('so3 missing V₂O₅ in catalyst conditions')
  const temp = so3.synthesisConditionsRu.temperature ?? ''
  if (!/400/.test(temp)) fail('so3 missing ~400 °C in temperature conditions')
}

const contactLesson = BALANCE_LESSON_BANK.find((l) => l.id === 'so2-o2-so3')
if (!contactLesson) fail('balance lesson so2-o2-so3 missing')
else {
  if (contactLesson.kind !== 'practice_only') fail('so2-o2-so3 lesson must be practice_only (molecule route)')
  if (/2S\s*\+\s*3O/.test(contactLesson.howToRu)) fail('so2-o2-so3 lesson howTo still teaches 2S+3O₂')
  if (!contactLesson.displayEquationRu?.includes('SO₂')) fail('so2-o2-so3 display must show SO₂')
}

for (const id of ['cao-h2o', 'cao-co2', 'nh3-hcl'] as const) {
  const l = BALANCE_LESSON_BANK.find((x) => x.id === id)
  if (!l) {
    fail(`balance lesson ${id} missing`)
    continue
  }
  if (l.kind !== 'practice_only') fail(`${id} should be practice_only (not flattened atoms)`)
}

const schoolContact = SCHOOL_REACTION_BANK.find((r) => r.id === 'so2-o2-so3')
if (schoolContact && !/⇄|⇌/.test(schoolContact.equationRu)) {
  warn('so2-o2-so3 school equation should use equilibrium arrow')
}

console.log(`\nErrors: ${errors.length}, Warnings: ${warnings.length}`)
if (errors.length) process.exit(1)
console.log('OK')
