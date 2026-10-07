/**
 * Задачи-опыты (src/data/labTasks): данные, химия и честность измерений.
 *  • измерительный слой: школьные молярные массы, мл ↔ высота обратимы, газ при н.у./в классе, недостаток, баланс масс;
 *  • каждая задача: тексты RU/EN/UZ, шаги 4–11, жесты, измерения после существующих шагов, уравнение уравнено;
 *  • на 40 попытках (разные зёрна): показания в пределах приборов, ответ «из измерений» близок к учебнику
 *    (не дальше погрешности метода), строки сверки укладываются в погрешность, правильный ввод ответа засчитан;
 *  • проверка ответа: учебник, «по вашим измерениям», «почти», ошибка, запись числа (запятая, ·10^23).
 * Запуск: npx tsx scripts/test-lab-tasks.mts
 */
import { LAB_TASKS } from '../src/data/labTasks/labTasks.ts'
import { createTaskRng, INSTRUMENTS } from '../src/components/lab3d/measure/instruments.ts'
import { checkAnswer, compareRows, parseAnswerNumber } from '../src/components/lab3d/measure/labTaskCheck.ts'
import {
  BEAKER100_GEOM,
  TUBE_GEOM,
  cylinderGeom,
  gasMlAt,
  gasNormalMl,
  heightForVolume,
  massBalance,
  molarMass,
  parseReaction,
  react,
  toNormalMl,
  volumeForHeight,
} from '../src/components/lab3d/measure/quantities.ts'
import { equationImbalance, parseEquationText } from '../src/chemistry/equationFormula.ts'
import { stripHeatTerm } from '../src/data/labWorks/labExperimentMatch.ts'
import type { LabText } from '../src/components/lab3d/labContract.ts'

let failed = 0
const fail = (m: string) => {
  failed++
  console.error(`✗ ${m}`)
}
const ok = (m: string) => console.log(`✓ ${m}`)
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol

/* ── Измерительный слой ── */
const M: Array<[string, number]> = [
  ['Zn', 65],
  ['H2O', 18],
  ['Ca(OH)2', 74],
  ['CuSO4*5H2O', 250],
  ['Na2CO3*10H2O', 286],
  ['AgCl', 143.5],
  ['MgCl2', 95],
  ['BaSO4', 233],
  ['NaHCO3', 84],
  ['H2SO4', 98],
  ['Cu(OH)2', 98],
  ['KClO3', 122.5],
]
for (const [f, m] of M) if (molarMass(f) !== m) fail(`M(${f}) = ${molarMass(f)}, ожидалось ${m}`)
if (!near(gasNormalMl(0.02), 448, 1e-9)) fail('V(0,02 моль) при н.у. ≠ 448 мл')
if (!near(toNormalMl(gasMlAt(0.02, 22), 22), 448, 1e-6)) fail('приведение к н.у. не обратно')
if (!near(gasMlAt(0.02, 22), 484.1, 0.2)) fail(`V(0,02 моль, 22 °C) = ${gasMlAt(0.02, 22)}`)
for (const g of [TUBE_GEOM, BEAKER100_GEOM, cylinderGeom(100), cylinderGeom(250)])
  for (const ml of [0.3, 1, 2.5, 7, 20, 60]) {
    const h = heightForVolume(g, ml)
    if (!near(volumeForHeight(g, h), ml, 1e-3)) fail(`${g.kind}: ${ml} мл → ${h} м → ${volumeForHeight(g, h)} мл`)
  }
for (const cap of [10, 25, 50, 100, 250, 500]) {
  const g = cylinderGeom(cap)
  if (!near(volumeForHeight(g, g.scaleH), cap, cap * 0.01)) fail(`цилиндр ${cap} мл: по шкале ${volumeForHeight(g, g.scaleH).toFixed(1)} мл`)
}
{
  const r = parseReaction('BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl')
  const res = react(r, { BaCl2: 0.025, Na2SO4: 0.05 })
  if (res.limiting !== 'BaCl2' || !near(res.formed.BaSO4! * 233, 5.825, 1e-9)) fail('избыток/недостаток BaCl₂ + Na₂SO₄')
  const [a, b] = massBalance(r, res)
  if (!near(a, b, 1e-6)) fail(`баланс масс ${a} ≠ ${b}`)
}
ok('измерительный слой: молярные массы, мл ↔ высота, газы, недостаток, баланс масс')

/* ── Задачи ── */
const LANGS = ['ru', 'en', 'uz'] as const
function text(where: string, t: LabText | undefined) {
  if (!t) return fail(`${where}: нет текста`)
  for (const l of LANGS) if (!t[l]?.trim()) fail(`${where}: пусто на «${l}»`)
  if (t.ru === t.en) fail(`${where}: ru = en`)
}

const ids = new Set<string>()
for (const task of LAB_TASKS) {
  const id = task.id
  if (ids.has(id)) fail(`повтор id ${id}`)
  ids.add(id)
  for (const k of ['source', 'title', 'statement', 'conclusion', 'reconcile'] as const) text(`${id}.${k}`, task[k])
  if (task.bookNote) text(`${id}.bookNote`, task.bookNote)
  text(`${id}.labScale.note`, task.labScale.note)
  text(`${id}.story`, task.story.text)
  task.equipment.forEach((e, i) => text(`${id}.equipment[${i}]`, e))
  task.safety.forEach((e, i) => text(`${id}.safety[${i}]`, e))
  if (task.equipment.length < 3) fail(`${id}: оборудования меньше 3`)
  if (task.safety.length < 2) fail(`${id}: правил ТБ меньше 2`)
  if (!/^task-g[789]-/.test(id) || Number(id[6]) !== task.grade) fail(`${id}: id не по классу ${task.grade}`)
  if (task.kind !== 'physical') {
    const eq = parseEquationText(stripHeatTerm(task.equation))
    if (!eq) fail(`${id}: уравнение «${task.equation}» не разобрано`)
    else if (equationImbalance(eq).length) fail(`${id}: «${task.equation}» не уравнено`)
  }
  if (task.steps.length < 4 || task.steps.length > 11) fail(`${id}: шагов ${task.steps.length}`)
  if ((task.gear ?? []).length && task.steps[0]?.target !== 'ppe') fail(`${id}: при средствах защиты первый шаг — ppe`)
  task.steps.forEach((s, i) => {
    for (const k of ['instruction', 'observation', 'how', 'teacher'] as const) text(`${id}.steps[${i}].${k}`, s[k])
    if (s.mistake) text(`${id}.steps[${i}].mistake`, s.mistake)
    if (!(s.seconds >= 0.8 && s.seconds <= 12)) fail(`${id}.steps[${i}]: длительность ${s.seconds} с`)
  })
  task.labels.forEach((l, i) => text(`${id}.labels[${i}]`, l.text))
  task.answers.forEach((a, i) => text(`${id}.answers[${i}].what`, a.what))
  task.compare.forEach((c, i) => text(`${id}.compare[${i}].label`, c.label))
  task.measurements.forEach((m) => {
    text(`${id}.measure ${m.key}`, m.what)
    if (!(m.afterStep >= 0 && m.afterStep < task.steps.length)) fail(`${id}: измерение ${m.key} после шага ${m.afterStep}`)
    if (!INSTRUMENTS[m.instrument]) fail(`${id}: прибор ${m.instrument}`)
  })
  if (!task.measurements.length) fail(`${id}: нет измерений`)
  if (!task.answers.length || !task.compare.length) fail(`${id}: нет ответа или сверки`)
  if (task.quiz.map((q) => q.id).join() !== 'sign,type,product') fail(`${id}: вопросы ${task.quiz.map((q) => q.id).join()}`)
  task.quiz.forEach((q, i) => {
    text(`${id}.quiz[${i}].q`, q.q)
    text(`${id}.quiz[${i}].why`, q.why)
    q.options.forEach((o, k) => text(`${id}.quiz[${i}].options[${k}]`, o))
    if (q.options.length < 3 || q.correct < 0 || q.correct >= q.options.length) fail(`${id}.quiz[${i}]: варианты/ответ`)
  })
  if (!(task.labScale.factor >= 1)) fail(`${id}: масштаб ${task.labScale.factor}`)

  // 40 попыток: честные показания, ответ из измерений близок к учебнику, сверка в пределах погрешности метода
  let worstAns = 0
  let worstCmp = 0
  for (let seed = 1; seed <= 40; seed++) {
    const v = task.simulate(createTaskRng(seed * 7919))
    for (const m of task.measurements) {
      const x = v[m.key]
      if (x == null || !Number.isFinite(x)) {
        fail(`${id} (зерно ${seed}): нет значения ${m.key}`)
        continue
      }
      const spec = INSTRUMENTS[m.instrument]
      if (!m.derived && (x < spec.min - 1e-9 || x > spec.max + 1e-9)) fail(`${id}: ${m.key} = ${x} вне предела ${spec.id}`)
      if (!m.derived) {
        const k = x / spec.readStep
        if (Math.abs(k - Math.round(k)) > 1e-6) fail(`${id}: ${m.key} = ${x} не кратно шагу отсчёта ${spec.readStep}`)
      }
    }
    for (const a of task.answers) {
      const run = a.fromRun(v)
      const dev = Math.abs(run - a.book) / Math.abs(a.book)
      worstAns = Math.max(worstAns, dev)
      const tolMax = Math.max(...task.compare.map((c) => c.tolerancePct)) / 100 + 0.01
      if (dev > tolMax) fail(`${id} (зерно ${seed}): ${a.label} из измерений ${run.toFixed(4)} далеко от учебника ${a.book} (${(dev * 100).toFixed(1)} %)`)
      // ответ учебника и ответ из своих измерений — засчитываются
      const bookStr = a.exponent ? String(a.book) : String(a.book)
      if (checkAnswer(a, v, bookStr).status !== 'book') fail(`${id}: ответ учебника ${bookStr} не засчитан`)
      const runStr = run.toFixed(Math.max(a.decimals, 2))
      const st = checkAnswer(a, v, runStr).status
      if (st !== 'run' && st !== 'book') fail(`${id}: ответ из измерений ${runStr} не засчитан (${st})`)
      if (checkAnswer(a, v, String(a.book * 1.5)).status !== 'wrong') fail(`${id}: ×1,5 засчитан`)
      if (a.altFromRun) {
        const altStr = a.altFromRun(v).toFixed(Math.max(a.decimals, 2))
        const st2 = checkAnswer(a, v, altStr).status
        if (st2 !== 'run' && st2 !== 'book') fail(`${id}: ответ «× масштаб» ${altStr} не засчитан (${st2})`)
      }
    }
    for (const [i, r] of compareRows(task, v).entries()) {
      worstCmp = Math.max(worstCmp, Math.abs(r.devPct))
      if (!r.withinMethod) fail(`${id} (зерно ${seed}): сверка ${i} — отклонение ${r.devPct.toFixed(2)} % > ${task.compare[i]!.tolerancePct} %`)
    }
  }
  ok(`${id}: ${task.steps.length} шагов, измерений ${task.measurements.length}, ответ из измерений до ${(worstAns * 100).toFixed(1)} % от учебника, сверка до ${worstCmp.toFixed(1)} %`)
}

/* ── Ввод ответа ── */
const P: Array<[string, number, number | null]> = [
  ['0,4', 0, 0.4],
  [' 2.41 ', 0, 2.41],
  ['2,41·10^23', 23, 2.41],
  ['2,41*10²³', 23, 2.41],
  ['2.408e23', 23, 2.408],
  ['134,4 л', 0, 134.4],
  ['−1,5', 0, -1.5],
  ['abc', 0, null],
]
for (const [s, e, want] of P) {
  const got = parseAnswerNumber(s, e)
  if (want == null ? got != null : got == null || !near(got, want, 1e-9)) fail(`разбор «${s}» → ${got}, ожидалось ${want}`)
}
ok(`ввод ответа: ${P.length} записей`)

if (LAB_TASKS.length < 15) console.log(`\n(готово задач: ${LAB_TASKS.length} из 15)`)
if (failed) {
  console.error(`\n${failed} ошибок`)
  process.exit(1)
}
console.log('\nВсе проверки задач-опытов пройдены')
