/**
 * Опыты новой 3D-лаборатории: тексты на трёх языках, шаги, уравнения уравнены, страницы учебника,
 * цели шагов есть в установках, кнопка «3D-опыт →» находит опыт только для трёх уравнений § 2.12.
 * Запуск: npm run test:lab3d
 */
import { LAB_EXPERIMENTS, LAB_PARTICLE_STORY, LAB_QUIZ, LAB_SIDE_EQUATIONS, LAB_STEP_ACTIONS } from '../src/data/labWorks/labExperiments.ts'
import { findLabExperimentForEquation, stripHeatTerm } from '../src/data/labWorks/labExperimentMatch.ts'
import { RIG_FOCUS, RIG_GESTURES, RIG_LABELS, RIG_STEP_SECONDS, RIG_TARGETS } from '../src/components/lab3d/experiments/rigTargets.ts'
import { LAB_GLASS_IDS, LAB_REAGENT_IDS } from '../src/components/lab3d/labEvents.ts'
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

// Действия руками: у каждого шага — жест, «как сделать» на 3 языках, у перетаскивания — траектория и цель;
// крупные планы и 3D-подписи — в пределах опыта; мини-проверка — 3 вопроса, правильный ответ среди вариантов.
const ITEM_IDS: readonly string[] = [...LAB_REAGENT_IDS, ...LAB_GLASS_IDS]
for (const e of LAB_EXPERIMENTS) {
  const acts = LAB_STEP_ACTIONS[e.id]
  const gst = RIG_GESTURES[e.id]
  if (acts.length !== e.steps.length) fail(`${e.id}: действий ${acts.length}, шагов ${e.steps.length}`)
  if (gst.length !== e.steps.length) fail(`${e.id}: жестов установки ${gst.length}, шагов ${e.steps.length}`)
  let moving = 0
  e.steps.forEach((s, i) => {
    const a = acts[i]
    const g = gst[i]
    if (!a || !g) return fail(`${e.id}.steps[${i}]: нет действия/жеста`)
    checkText(`${e.id}.actions[${i}].how`, a.how)
    if (a.gesture !== g.kind) fail(`${e.id}.steps[${i}]: жест данных «${a.gesture}» ≠ жест установки «${g.kind}»`)
    if (a.need && !ITEM_IDS.includes(a.need)) fail(`${e.id}.steps[${i}]: неизвестный предмет ${a.need}`)
    if (g.kind !== 'tap') {
      moving++
      const len = Math.hypot(g.to[0] - g.from[0], g.to[1] - g.from[1], g.to[2] - g.from[2])
      if (len < 0.05) fail(`${e.id}.steps[${i}]: путь жеста ${len.toFixed(3)} м — слишком короткий`)
      if (!(g.lead > 0 && g.lead <= 1)) fail(`${e.id}.steps[${i}]: доля шага под пальцем ${g.lead} вне (0, 1]`)
      for (const v of [g.from, g.to]) if (Math.abs(v[0]) > 0.65 || Math.abs(v[2]) > 0.3 || v[1] < 0 || v[1] > 0.5) fail(`${e.id}.steps[${i}]: точка жеста ${v.join(',')} вне рабочего места`)
    }
  })
  if (moving < 2) fail(`${e.id}: меньше двух действий «перетащить/провести» (${moving})`)
  for (const f of RIG_FOCUS[e.id]) if (!(f.from < f.to && f.from >= 0 && f.to <= e.steps.length)) fail(`${e.id}: крупный план ${f.from}–${f.to} вне опыта`)
  if (!RIG_FOCUS[e.id].length) fail(`${e.id}: нет крупного плана реакции`)
  RIG_LABELS[e.id].forEach((l, i) => {
    checkText(`${e.id}.labels[${i}]`, l.text)
    if (!(l.at > 0 && l.at < e.steps.length)) fail(`${e.id}.labels[${i}]: отметка ${l.at} вне опыта`)
  })
  if (!RIG_LABELS[e.id].length) fail(`${e.id}: нет 3D-подписей наблюдений`)
  const story = LAB_PARTICLE_STORY[e.id]
  checkText(`${e.id}.story`, story.text)
  if (!/→/.test(story.equation)) fail(`${e.id}: в «Что произошло» нет уравнения`)
  const quiz = LAB_QUIZ[e.id]
  if (quiz.map((q) => q.id).join() !== 'sign,type,product') fail(`${e.id}: проверка — ${quiz.map((q) => q.id).join()}, нужно sign,type,product`)
  quiz.forEach((q, i) => {
    checkText(`${e.id}.quiz[${i}].q`, q.q)
    checkText(`${e.id}.quiz[${i}].why`, q.why)
    if (q.options.length < 3) fail(`${e.id}.quiz[${i}]: вариантов ${q.options.length}`)
    q.options.forEach((o, k) => checkText(`${e.id}.quiz[${i}].options[${k}]`, o))
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) fail(`${e.id}.quiz[${i}]: правильный ответ ${q.correct} вне вариантов`)
    if (new Set(q.options.map((o) => o.ru)).size !== q.options.length) fail(`${e.id}.quiz[${i}]: повтор вариантов`)
  })
  ok(`${e.id}: жестов «перетащить/провести» ${moving}, крупных планов ${RIG_FOCUS[e.id].length}, подписей ${RIG_LABELS[e.id].length}, вопросов ${quiz.length}`)
}
// типы реакций в проверке совпадают с типом опыта
const typeWant: Record<string, RegExp> = { baso4: /Обмен/, 'zn-hcl': /Замещ/, 'ch4-burn': /Горение/ }
for (const [id, re] of Object.entries(typeWant)) {
  const q = LAB_QUIZ[id as keyof typeof LAB_QUIZ].find((x) => x.id === 'type')!
  if (!re.test(q.options[q.correct]!.ru)) fail(`${id}: правильный тип реакции «${q.options[q.correct]!.ru}»`)
}

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
