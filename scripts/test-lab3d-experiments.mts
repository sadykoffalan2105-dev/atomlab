/**
 * Опыты новой 3D-лаборатории: тексты на трёх языках, шаги, уравнения уравнены, страницы учебника,
 * цели шагов есть в установках, кнопка «3D-опыт →» находит опыт только для трёх уравнений § 2.12.
 * Запуск: npm run test:lab3d
 */
import { LAB_EXPERIMENTS, LAB_SIDE_EQUATIONS } from '../src/data/labWorks/labExperiments.ts'
import { findLabExperimentForEquation, stripHeatTerm } from '../src/data/labWorks/labExperimentMatch.ts'
import { RIG_STEP_SECONDS, RIG_TARGETS } from '../src/components/lab3d/experiments/rigTargets.ts'
import { equationImbalance, parseEquationText } from '../src/chemistry/equationFormula.ts'
import type { LabText } from '../src/components/lab3d/labContract.ts'

let failed = 0
const fail = (msg: string) => {
  failed++
  console.error(`✗ ${msg}`)
}
const ok = (msg: string) => console.log(`✓ ${msg}`)

const LANGS = ['ru', 'en', 'uz'] as const
function checkText(where: string, t: LabText | undefined) {
  if (!t) return fail(`${where}: нет текста`)
  for (const l of LANGS) if (!t[l] || !t[l].trim()) fail(`${where}: пусто на «${l}»`)
  if (t.ru === t.en) fail(`${where}: русский и английский тексты совпадают`)
}

function checkBalanced(where: string, eq: string) {
  const parsed = parseEquationText(stripHeatTerm(eq))
  if (!parsed) return fail(`${where}: уравнение «${eq}» не разобрано`)
  const diff = equationImbalance(parsed)
  if (diff.length) fail(`${where}: «${eq}» не уравнено: ${diff.join(', ')}`)
}

const ids = LAB_EXPERIMENTS.map((e) => e.id)
for (const want of ['baso4', 'ch4-burn', 'zn-hcl', 'h2-practical'] as const) if (!ids.includes(want)) fail(`нет опыта ${want}`)
if (new Set(ids).size !== ids.length) fail('повторяются id опытов')

const PAGES: Record<string, number> = { baso4: 67, 'ch4-burn': 67, 'zn-hcl': 67, 'h2-practical': 115 }
const KINDS: Record<string, string> = { baso4: 'exchange', 'ch4-burn': 'combustion', 'zn-hcl': 'substitution', 'h2-practical': 'substitution' }

for (const e of LAB_EXPERIMENTS) {
  checkText(`${e.id}.source`, e.source)
  checkText(`${e.id}.title`, e.title)
  checkText(`${e.id}.conclusion`, e.conclusion)
  if (e.grade !== 7) fail(`${e.id}: класс ${e.grade}, ожидался 7`)
  if (e.page !== PAGES[e.id]) fail(`${e.id}: страница ${e.page}, ожидалась ${PAGES[e.id]}`)
  if (e.kind !== KINDS[e.id]) fail(`${e.id}: тип ${e.kind}, ожидался ${KINDS[e.id]}`)
  checkBalanced(`${e.id}.equation`, e.equation)
  for (const side of LAB_SIDE_EQUATIONS[e.id] ?? []) checkBalanced(`${e.id} (наблюдение)`, side)
  if (e.equipment.length < 2) fail(`${e.id}: мало оборудования`)
  if (e.safety.length < 2) fail(`${e.id}: мало правил ТБ`)
  e.equipment.forEach((t, i) => checkText(`${e.id}.equipment[${i}]`, t))
  e.safety.forEach((t, i) => checkText(`${e.id}.safety[${i}]`, t))
  if (e.steps.length < 4 || e.steps.length > 7) fail(`${e.id}: шагов ${e.steps.length}, нужно 4–7`)
  const targets: readonly string[] = RIG_TARGETS[e.id]
  const stepIds = new Set<string>()
  e.steps.forEach((s, i) => {
    if (stepIds.has(s.id)) fail(`${e.id}: повтор id шага ${s.id}`)
    stepIds.add(s.id)
    checkText(`${e.id}.steps[${i}].instruction`, s.instruction)
    checkText(`${e.id}.steps[${i}].observation`, s.observation)
    if (!s.target) fail(`${e.id}.steps[${i}]: нет цели`)
    else if (!targets.includes(s.target)) fail(`${e.id}.steps[${i}]: цели «${s.target}» нет в установке (${targets.join(', ')})`)
  })
  for (const t of targets) if (!e.steps.some((s) => s.target === t)) fail(`${e.id}: цель «${t}» установки не используется шагами`)
  const secs = RIG_STEP_SECONDS[e.id]
  if (secs.length !== e.steps.length) fail(`${e.id}: длительностей ${secs.length}, шагов ${e.steps.length}`)
  ok(`${e.id}: ${e.steps.length} шагов, ${e.equation}`)
}

// Практическое занятие § 5.2 — по учебнику: кислота, цинк, пробка с трубкой, сбор, спиртовка, проверка на чистоту, горение.
const h2 = LAB_EXPERIMENTS.find((e) => e.id === 'h2-practical')!
const h2Order = ['acid', 'zinc', 'stopper', 'collect', 'lamp', 'purity', 'burn']
if (h2.steps.map((s) => s.id).join() !== h2Order.join()) fail(`h2-practical: порядок шагов ${h2.steps.map((s) => s.id).join()} ≠ ${h2Order.join()}`)
if (!/хлопок/.test(h2.steps.find((s) => s.id === 'purity')?.observation?.ru ?? '')) fail('h2-practical: в проверке на чистоту нет «хлопка»')
if (!/капли воды/.test(h2.steps.find((s) => s.id === 'burn')?.observation?.ru ?? '')) fail('h2-practical: при горении нет «капель воды»')

// Кнопка «3D-опыт →» у реакций учебника
const chip: Array<[string, string | null]> = [
  ['BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl', 'baso4'],
  ['BaCl2 + H2SO4 → BaSO4↓ + 2HCl', 'baso4'],
  ['CH₄ + 2O₂ → CO₂ + 2H₂O + Q', 'ch4-burn'],
  ['CH4 + 2O2 → CO2 + 2H2O', 'ch4-burn'],
  ['Zn + 2HCl → ZnCl₂ + H₂↑', 'zn-hcl'],
  ['Zn + 2HCl = ZnCl2 + H2', 'zn-hcl'],
  ['Zn + HCl → ZnCl₂ + H₂', null],
  ['2H₂ + O₂ → 2H₂O', null],
  ['Fe + H₂SO₄ → FeSO₄ + H₂↑', null],
  ['NaOH + HCl → NaCl + H₂O', null],
  ['C + O₂ → CO₂', null],
  ['BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl', null],
]
for (const [eq, want] of chip) {
  const got = findLabExperimentForEquation(eq)
  if (got !== want) fail(`3D-ссылка для «${eq}»: ${got ?? 'нет'}, ожидалось ${want ?? 'нет'}`)
}
ok(`3D-ссылка: ${chip.length} уравнений`)

if (failed) {
  console.error(`\n${failed} ошибок`)
  process.exit(1)
}
console.log('\nВсе проверки опытов 3D-лаборатории пройдены')
