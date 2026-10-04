/**
 * Опыты новой 3D-лаборатории: тексты на трёх языках, шаги, уравнения уравнены, страницы учебника,
 * цели шагов есть в установках, кнопка «3D-опыт →» находит опыт только для трёх уравнений § 2.12.
 * Запуск: npm run test:lab3d
 */
import { LAB_EXPERIMENTS, LAB_PARTICLE_STORY, LAB_QUIZ, LAB_SIDE_EQUATIONS, LAB_STEP_ACTIONS } from '../src/data/labWorks/labExperiments.ts'
import { findLabExperimentForEquation, stripHeatTerm } from '../src/data/labWorks/labExperimentMatch.ts'
import { LAB_EXPERIMENT_GROUPS } from '../src/data/labWorks/labExperiments.ts'
import { RIG_FOCUS, RIG_GESTURES, RIG_LABELS, RIG_STEP_SECONDS, RIG_TARGETS } from '../src/components/lab3d/experiments/rigTargets.ts'
import { HOOD_WORK_SIZE, WORK_AREA_SIZE } from '../src/components/lab3d/labContract.ts'
import { LAB_GLASS_IDS, LAB_REAGENT_IDS } from '../src/components/lab3d/labEvents.ts'
import { equationImbalance, parseEquationText } from '../src/chemistry/equationFormula.ts'
import type { LabText } from '../src/components/lab3d/labContract.ts'
import { readFileSync } from 'node:fs'

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
for (const want of ['baso4', 'ch4-burn', 'zn-hcl', 'h2-practical', 'salt-purify', 'nh3', 'halogens', 'water-oxides', 'co2', 'metals-acids'] as const) if (!ids.includes(want)) fail(`нет опыта ${want}`)
if (new Set(ids).size !== ids.length) fail('повторяются id опытов')

const PAGES: Record<string, number> = { baso4: 67, 'ch4-burn': 67, 'zn-hcl': 67, 'h2-practical': 115, 'salt-purify': 24, nh3: 169, halogens: 202, 'water-oxides': 140, co2: 191, 'metals-acids': 124 }
const KINDS: Record<string, string> = {
  baso4: 'exchange',
  'ch4-burn': 'combustion',
  'zn-hcl': 'substitution',
  'h2-practical': 'substitution',
  'salt-purify': 'physical',
  nh3: 'exchange',
  halogens: 'substitution',
  'water-oxides': 'combination',
  co2: 'exchange',
  'metals-acids': 'substitution',
}
const GRADES: Record<string, number> = { baso4: 7, 'ch4-burn': 7, 'zn-hcl': 7, 'h2-practical': 7, 'salt-purify': 7, nh3: 8, halogens: 8, 'water-oxides': 7, co2: 9, 'metals-acids': 7 }
// по ТБ: аммиак, хлор и бром — только в вытяжном шкафу, в очках и перчатках
const HOOD: Record<string, readonly string[]> = { nh3: ['goggles', 'gloves', 'coat'], halogens: ['goggles', 'gloves'] }

for (const e of LAB_EXPERIMENTS) {
  checkText(`${e.id}.source`, e.source)
  checkText(`${e.id}.title`, e.title)
  checkText(`${e.id}.conclusion`, e.conclusion)
  if (e.grade !== GRADES[e.id]) fail(`${e.id}: класс ${e.grade}, ожидался ${GRADES[e.id]}`)
  if (e.page !== PAGES[e.id]) fail(`${e.id}: страница ${e.page}, ожидалась ${PAGES[e.id]}`)
  if (e.kind !== KINDS[e.id]) fail(`${e.id}: тип ${e.kind}, ожидался ${KINDS[e.id]}`)
  // физическое явление (очистка соли) — не реакция, уравнения нет
  if (e.kind !== 'physical') checkBalanced(`${e.id}.equation`, e.equation)
  const hood = HOOD[e.id]
  if (hood) {
    if (e.place !== 'hood') fail(`${e.id}: опыт должен идти в вытяжном шкафу (place: 'hood')`)
    if ((e.gear ?? []).join() !== hood.join()) fail(`${e.id}: средства защиты ${(e.gear ?? []).join()} ≠ ${hood.join()}`)
    if (e.steps[0]?.target !== 'ppe') fail(`${e.id}: первый шаг — «наденьте средства защиты» (цель ppe)`)
  } else if (e.place === 'hood') fail(`${e.id}: лишняя вытяжка`)
  for (const side of LAB_SIDE_EQUATIONS[e.id] ?? []) checkBalanced(`${e.id} (наблюдение)`, side)
  if (e.equipment.length < 2) fail(`${e.id}: мало оборудования`)
  if (e.safety.length < 2) fail(`${e.id}: мало правил ТБ`)
  e.equipment.forEach((t, i) => checkText(`${e.id}.equipment[${i}]`, t))
  e.safety.forEach((t, i) => checkText(`${e.id}.safety[${i}]`, t))
  if (e.steps.length < 4 || e.steps.length > 9) fail(`${e.id}: шагов ${e.steps.length}, нужно 4–9`)
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
      const area = e.place === 'hood' ? HOOD_WORK_SIZE : WORK_AREA_SIZE
      for (const v of [g.from, g.to]) if (Math.abs(v[0]) > area.w / 2 || Math.abs(v[2]) > area.d / 2 || v[1] < 0 || v[1] > 0.5) fail(`${e.id}.steps[${i}]: точка жеста ${v.join(',')} вне рабочего места`)
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
const typeWant: Record<string, RegExp> = { baso4: /Обмен/, 'zn-hcl': /Замещ/, 'ch4-burn': /Горение/, 'salt-purify': /Физическ/, halogens: /Замещ/, 'water-oxides': /Соедин/, co2: /Обмен/, 'metals-acids': /Замещ/ }
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
  ['2NH₄Cl + Ca(OH)₂ → CaCl₂ + 2NH₃↑ + 2H₂O', 'nh3'],
  ['2NH4Cl + Ca(OH)2 = CaCl2 + 2NH3 + 2H2O', 'nh3'],
  ['Cl₂ + 2NaBr → 2NaCl + Br₂', 'halogens'],
  ['Cl2 + 2KI = 2KCl + I2', 'halogens'],
  ['Br₂ + 2NaI → 2NaBr + I₂', 'halogens'],
  ['NH₃ + HCl → NH₄Cl', null],
  ['CaO + H₂O → Ca(OH)₂', 'water-oxides'],
  ['CaO + H2O = Ca(OH)2', 'water-oxides'],
  ['CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑', 'co2'],
  ['CaCO3 + 2HCl = CaCl2 + CO2 + H2O', 'co2'],
  ['Mg + H₂SO₄ → MgSO₄ + H₂↑', 'metals-acids'],
  ['Mg + 2HCl → MgCl₂ + H₂↑', 'metals-acids'],
  ['Cu + HCl → CuCl₂ + H₂', null],
]
for (const [eq, want] of chip) {
  const got = findLabExperimentForEquation(eq)
  if (got !== want) fail(`3D-ссылка для «${eq}»: ${got ?? 'нет'}, ожидалось ${want ?? 'нет'}`)
}
ok(`3D-ссылка: ${chip.length} уравнений`)

// практические работы: порядок шагов и ключевые наблюдения — по учебнику
const order: Record<string, string> = {
  'salt-purify': 'add-salt,dissolve,fold,filter-in,filter,to-dish,heat,evaporate,stop',
  nh3: 'gear,mix,fill,assemble,collect,heat,smell,litmus,hcl',
  halogens: 'gear,cl-nabr,cl-nai,br-nai,br-nacl,starch,compare',
  'water-oxides': 'gear,cao,water,mineral,distilled,phenolphthalein,litmus-acid,litmus-water,compare',
  co2: 'gear,marble,acid,stopper,limewater,excess,water,litmus,alkali',
  'metals-acids': 'gear,mg,mg-acid,test,zn,zn-acid,cu,cu-acid,compare',
}
for (const [id, want] of Object.entries(order)) {
  const e = LAB_EXPERIMENTS.find((x) => x.id === id)
  if (!e) continue
  if (e.steps.map((s) => s.id).join() !== want) fail(`${id}: порядок шагов ${e.steps.map((s) => s.id).join()} ≠ ${want}`)
}
const obs = (id: string, step: string) => LAB_EXPERIMENTS.find((e) => e.id === id)?.steps.find((s) => s.id === step)?.observation?.ru ?? ''
if (!/фильтрат/.test(obs('salt-purify', 'filter'))) fail('salt-purify: при фильтровании нет «фильтрата»')
if (!/кристаллы/.test(obs('salt-purify', 'evaporate'))) fail('salt-purify: при выпаривании нет «кристаллов»')
if (!/синеет/.test(obs('nh3', 'litmus'))) fail('nh3: лакмус должен синеть')
if (!/белый/i.test(obs('nh3', 'hcl'))) fail('nh3: с HCl нет белого дыма')
if (!/помахиванием|Помахиванием/.test(LAB_EXPERIMENTS.find((e) => e.id === 'nh3')!.steps.find((s) => s.id === 'smell')!.instruction.ru)) fail('nh3: запах — только помахиванием')
if (!/жёлто-оранжев/.test(obs('halogens', 'cl-nabr'))) fail('halogens: Br₂ — жёлто-оранжевый')
if (!/бур/.test(obs('halogens', 'cl-nai'))) fail('halogens: I₂ — жёлто-бурый')
if (!/Изменений нет/.test(obs('halogens', 'br-nacl'))) fail('halogens: бром не вытесняет хлор')
if (!/синее/.test(obs('halogens', 'starch'))) fail('halogens: крахмал с йодом — синее окрашивание')
// Kimyo 7 § 6.5: тепло и пар, индикаторы — цвета по таблице учебника
if (!/пар/.test(obs('water-oxides', 'water')) || !/Ca\(OH\)₂/.test(obs('water-oxides', 'water'))) fail('water-oxides: CaO с водой — пар и Ca(OH)₂')
if (!/малинов/.test(obs('water-oxides', 'phenolphthalein'))) fail('water-oxides: фенолфталеин в основании — малиновый')
if (!/красн/.test(obs('water-oxides', 'litmus-acid'))) fail('water-oxides: лакмус в кислоте — красный')
if (!/фиолетов/.test(obs('water-oxides', 'litmus-water'))) fail('water-oxides: лакмус в воде — фиолетовый')
// Kimyo 9 ПР 1: известковая вода мутнеет, при избытке CO₂ — снова прозрачная; лакмус краснеет; щёлочь обесцвечивается
if (!/мутнеет/.test(obs('co2', 'limewater'))) fail('co2: известковая вода мутнеет')
if (!/исчезает/.test(obs('co2', 'excess')) || !/Ca\(HCO₃\)₂/.test(obs('co2', 'excess'))) fail('co2: при избытке CO₂ муть исчезает — Ca(HCO₃)₂')
if (!/красне/.test(obs('co2', 'litmus'))) fail('co2: синий лакмус краснеет')
if (!/исчезает/.test(obs('co2', 'alkali'))) fail('co2: малиновая окраска исчезает')
// Kimyo 7 § 5.6: магний — активно, хлопок водорода, медь не реагирует
if (!/активно/.test(obs('metals-acids', 'mg-acid'))) fail('metals-acids: магний реагирует активно')
if (!/хлопок/.test(obs('metals-acids', 'test'))) fail('metals-acids: водород — хлопок')
if (!/Изменений нет/.test(obs('metals-acids', 'cu-acid'))) fail('metals-acids: медь не реагирует')
// средства защиты: шаг 0 — «наденьте» (цель ppe), если опыт требует защиту
for (const e of LAB_EXPERIMENTS) if ((e.gear ?? []).length && e.id !== 'salt-purify' && !['baso4', 'ch4-burn', 'zn-hcl', 'h2-practical'].includes(e.id) && e.steps[0]?.target !== 'ppe') fail(`${e.id}: первый шаг — средства защиты`)

// цели шагов действительно есть в установке: name="…" или target="…" в файле rigs/<Опыт>Rig.tsx
const RIG_FILES: Record<string, string> = {
  baso4: 'Baso4Rig',
  'ch4-burn': 'Ch4BurnRig',
  'zn-hcl': 'ZnHclRig',
  'h2-practical': 'H2PracticalRig',
  'salt-purify': 'SaltPurifyRig',
  nh3: 'Nh3Rig',
  halogens: 'HalogensRig',
  'water-oxides': 'WaterOxidesRig',
  co2: 'Co2Rig',
  'metals-acids': 'MetalsAcidsRig',
}
for (const e of LAB_EXPERIMENTS) {
  const file = RIG_FILES[e.id]
  if (!file) {
    fail(`${e.id}: нет файла установки`)
    continue
  }
  const src = readFileSync(new URL(`../src/components/lab3d/experiments/rigs/${file}.tsx`, import.meta.url), 'utf8')
  for (const tg of RIG_TARGETS[e.id]) if (!new RegExp(`(name|target)="${tg}"`).test(src)) fail(`${e.id}: в ${file}.tsx нет цели «${tg}»`)
}
ok('цели шагов найдены в файлах установок')

// карточки на доске: все опыты в группах ровно по одному разу
const grouped = LAB_EXPERIMENT_GROUPS.flatMap((g) => g.ids)
if (grouped.length !== ids.length || new Set(grouped).size !== ids.length || ids.some((i) => !grouped.includes(i))) fail(`группы карточек: ${grouped.join()} ≠ ${ids.join()}`)
LAB_EXPERIMENT_GROUPS.forEach((g) => checkText(`группа ${g.id}`, g.title))
ok(`практические работы: порядок шагов, наблюдения, ТБ, ${LAB_EXPERIMENT_GROUPS.length} группы карточек`)

if (failed) {
  console.error(`\n${failed} ошибок`)
  process.exit(1)
}
console.log('\nВсе проверки опытов 3D-лаборатории пройдены')
