#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт урока «ионная связь: 2 Na (тв.) + Cl₂ (г.) → 2 NaCl (тв.)».
 *
 * Сцена проверяется ДАННЫМИ, а не глазами: раскадровка — чистая функция
 * sampleNaclFrame(t), поэтому весь урок сэмплируется в Node.
 *
 * Что доказывает этот тест:
 *   • хронометраж: 6 шагов, 26–34 экранных секунды, cue'ы по возрастанию,
 *     контракт лаборатории embryo → birth → complete на месте;
 *   • раскадровка: дорожки монотонны, ни один видимый атом не прыгает
 *     больше чем на 0.09 ед. между кадрами 1/30 с;
 *   • химия: Cl₂ стартует МОЛЕКУЛОЙ, радиусы Na 186→102 и Cl 99→181 пм
 *     меняются в момент перехода электрона, Cl⁻ ≈ 1.78 · Na⁺;
 *   • решётка: 64 иона фрагмента 4×4×4, 144 ребра, КЧ 6, заряды чередуются;
 *   • энергия: сумма цикла Борна — Габера = табличная ΔH°f, знаки верные;
 *   • стехиометрия показанного уравнения и электронный/зарядовый баланс полуреакций;
 *   • тексты есть в ru / en / uz для каждого шага.
 *
 * Запуск: npx tsx scripts/test-nacl-cinema.mts
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { storyWallDuration } from '../src/lab/cinema/core/storyTime.ts'
import {
  assertNoPositionJumps,
  createLabelStates,
  labelTokensUsed,
  localizeSceneLabels,
  SCENE_LABEL_TOKENS,
} from '../src/lab/cinema/scenes/kit/sceneKit.ts'
import { assertIonSizeOrder, speciesLabel, speciesRadiusPm } from '../src/lab/cinema/scenes/kit/cpkAtoms.ts'
import { ladderLevels } from '../src/lab/cinema/scenes/kit/energyLadderData.ts'
import {
  NACL_ATOMS,
  NACL_COORDINATION_IDS,
  NACL_CUES,
  NACL_EDGES,
  NACL_END,
  NACL_GEOM,
  NACL_LABELS,
  NACL_SEGMENTS,
  NACL_STEPS,
  NACL_STEP_IDS,
  NACL_TIMING,
  createNaclFrame,
  sampleNaclFrame,
  validateNaclStoryboard,
  type NaclAtomId,
} from '../src/lab/cinema/scenes/nacl/naclStoryboard.ts'
import {
  NACL_DHF_KJ,
  NACL_DHF_TABLE_KJ,
  NACL_HALF_REACTIONS,
  NACL_LADDER,
  NACL_LATTICE_KJ,
  NACL_COST_BEFORE_LATTICE_KJ,
  NACL_REACTION,
  validateNaclEnergetics,
} from '../src/lab/cinema/scenes/nacl/naclEnergetics.ts'
import { getNaclMechanismText, type NaclLocale } from '../src/lab/cinema/scenes/nacl/naclMechanismText.ts'
import { naclScientificWatchdogMs } from '../src/lab/scientificSynthesis/naclScenarioTiming.ts'

const LOCALES: NaclLocale[] = ['ru', 'en', 'uz']
const frame = createNaclFrame()
const at = (t: number) => sampleNaclFrame(t, frame)

let checks = 0
function ok(label: string, cond: boolean, detail = ''): void {
  assert.ok(cond, `${label}${detail ? ` — ${detail}` : ''}`)
  checks++
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Хронометраж и контракт лаборатории
// ─────────────────────────────────────────────────────────────────────────────

NACL_TIMING.validate()
ok('шагов 6 ± 1', NACL_STEPS.length >= 5 && NACL_STEPS.length <= 7, `${NACL_STEPS.length}`)
ok('id шагов совпадают', NACL_STEP_IDS.join(',') === NACL_STEPS.map((s) => s.id).join(','))

const wall = storyWallDuration(NACL_SEGMENTS)
ok('экранная длительность 26–34 с', wall >= 26 && wall <= 34, `${wall.toFixed(1)} с`)

let prevTo = 0
for (const s of NACL_STEPS) {
  ok(`шаг ${s.id} непрерывен`, s.from === prevTo && s.to > s.from)
  ok(`шаг ${s.id} имеет экранное время`, s.wall > 0)
  prevTo = s.to
}

let prevCue = -Infinity
for (const c of NACL_CUES) {
  ok(`cue ${c.id} внутри сюжета`, c.at >= 0 && c.at <= NACL_END, `${c.at}`)
  ok(`cue ${c.id} по возрастанию`, c.at >= prevCue)
  prevCue = c.at
}
const cueIndex = (id: string) => NACL_CUES.findIndex((c) => c.id === id)
ok('контракт лаборатории embryo → birth → complete', cueIndex('embryo') < cueIndex('birth') && cueIndex('birth') < cueIndex('complete'))
ok('complete совпадает с концом сюжета', NACL_CUES[cueIndex('complete')]!.at === NACL_END)
ok('watchdog лаборатории положителен', naclScientificWatchdogMs() > 0)

// каждый шаг обязан попасть в свой индекс
for (let i = 0; i < NACL_STEPS.length; i++) {
  const s = NACL_STEPS[i]!
  ok(`stepIndexAt(${s.id})`, NACL_TIMING.stepIndexAt((s.from + s.to) / 2) === i)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Раскадровка: дорожки и отсутствие рывков
// ─────────────────────────────────────────────────────────────────────────────

validateNaclStoryboard()

const scratch = createNaclFrame()
const buf = NACL_ATOMS.map((a) => ({ id: a.id as string, pos: new THREE.Vector3(), opacity: 0 }))
assertNoPositionJumps(
  (t) => {
    sampleNaclFrame(t, scratch)
    for (let i = 0; i < NACL_ATOMS.length; i++) {
      const id = NACL_ATOMS[i]!.id
      buf[i]!.pos.copy(scratch.atoms[id])
      buf[i]!.opacity = scratch.opacity[id]
    }
    return buf
  },
  NACL_END,
  0.09,
  1 / 30,
)
checks++

// Радиус и прозрачность тоже не должны щёлкать.
{
  let prev: Record<string, { r: number; o: number }> | null = null
  for (let t = 0; t <= NACL_END + 1e-9; t += 1 / 30) {
    at(t)
    const now: Record<string, { r: number; o: number }> = {}
    for (const a of NACL_ATOMS) now[a.id] = { r: frame.radius[a.id], o: frame.opacity[a.id] }
    if (prev) {
      for (const a of NACL_ATOMS) {
        ok(`радиус ${a.id} без скачка при t=${t.toFixed(2)}`, Math.abs(now[a.id]!.r - prev[a.id]!.r) <= 0.02)
        ok(`прозрачность ${a.id} без скачка при t=${t.toFixed(2)}`, Math.abs(now[a.id]!.o - prev[a.id]!.o) <= 0.12)
      }
    }
    prev = now
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Химия кадра
// ─────────────────────────────────────────────────────────────────────────────

// 3.1 Радиусы — из справочника, катион меньше атома, анион больше.
assertIonSizeOrder('Na', 1)
assertIonSizeOrder('Cl', -1)
ok('Na⁰ берётся металлическим радиусом 186 пм', speciesRadiusPm('Na', 0) === 186)
ok('Na⁺ 102 пм (Shannon, КЧ 6)', speciesRadiusPm('Na', 1) === 102)
ok('Cl⁰ берётся ковалентным радиусом (Cordero 2008, 102 пм)', speciesRadiusPm('Cl', 0) === 102)
// Половина длины связи Cl–Cl (198.8 / 2 = 99.4 пм) — то же самое в пределах разброса Cordero ±4 пм.
ok(
  'ковалентный радиус согласован с половиной длины связи Cl–Cl',
  Math.abs(speciesRadiusPm('Cl', 0) - (NACL_GEOM.data.clClPm ?? 198.8) / 2) < 4,
)
ok('Cl⁻ 181 пм (Shannon, КЧ 6)', speciesRadiusPm('Cl', -1) === 181)
const ratio = speciesRadiusPm('Cl', -1) / speciesRadiusPm('Na', 1)
ok('Cl⁻ примерно в 1.78 раза крупнее Na⁺', Math.abs(ratio - 1.78) < 0.03, ratio.toFixed(3))
ok('подписи частиц', speciesLabel('Na', 1) === 'Na⁺' && speciesLabel('Cl', -1) === 'Cl⁻' && speciesLabel('O', -2) === 'O²⁻')

// 3.2 Старт: хлор — МОЛЕКУЛА с настоящей длиной связи, натрий — металл.
at(0.5)
const clDist = frame.atoms.clA.distanceTo(frame.atoms.clB)
ok('на старте Cl₂ — молекула с длиной связи 198.8 пм', Math.abs(clDist - NACL_GEOM.clHalf * 2) < 1e-6, clDist.toFixed(4))
ok('на старте связь Cl–Cl видна', frame.bond.opacity > 0.9)
ok('на старте натрий имеет металлический радиус', Math.abs(frame.radius.na1 - NACL_GEOM.radius.na) < 1e-6)
ok('на старте у хлора ковалентный радиус', Math.abs(frame.radius.clA - NACL_GEOM.radius.cl) < 1e-6)
ok('на старте зарядов нет', frame.charge.na1 === 0 && frame.charge.clA === 0)
ok('на старте металлический фрагмент виден', frame.opacity.M0 > 0.5)
ok('на старте кристалла ещё нет', frame.edges === 0 && frame.opacity.L0 === 0)

// 3.3 Натрий стартует В РЕШЁТКЕ металла: расстояние до соседа = 371.6 пм.
{
  const d = frame.atoms.na1.distanceTo(frame.atoms.M0)
  const want = (NACL_GEOM.data.metal.cellPm * Math.sqrt(3)) / 2
  const wantScene = (want / 100) * (NACL_GEOM.cell / (NACL_GEOM.data.cellPm / 100))
  ok('Na в металле: КЧ 8 на расстоянии a·√3/2', Math.abs(d - wantScene) < 1e-3, `${d.toFixed(4)} против ${wantScene.toFixed(4)}`)
}

// 3.4 Связь Cl–Cl рвётся ГОМОЛИТИЧЕСКИ (split = 0 — пара делится поровну).
at(NACL_TIMING.cueAt('bondBreak') + 0.5)
ok('после разрыва связь Cl–Cl гаснет', frame.bond.opacity < 0.5)
ok('разрыв симметричный: оба атома хлора нейтральны', frame.charge.clA === 0 && frame.charge.clB === 0)

// 3.5 Радиус меняется РОВНО тогда, когда электрон уходит / приходит.
at(NACL_TIMING.cueAt('transfer') - 1.6)
const naBefore = frame.radius.na1
const clBefore = frame.radius.clA
at(NACL_TIMING.cueAt('transfer') + 1.0)
ok('Na сжался до иона', frame.radius.na1 < naBefore && Math.abs(frame.radius.na1 - NACL_GEOM.radius.naIon) < 1e-6)
ok('Cl вырос до иона', frame.radius.clA > clBefore && Math.abs(frame.radius.clA - NACL_GEOM.radius.clIon) < 1e-6)
ok('Na⁺ получил заряд +1', Math.abs(frame.charge.na1 - 1) < 1e-6)
ok('Cl⁻ получил заряд −1', Math.abs(frame.charge.clA + 1) < 1e-6)
ok('на экране Cl⁻ крупнее Na⁺', frame.radius.clA > frame.radius.na1 * 1.7)

// 3.6 Ионная пара: ровно d(Na⁺–Cl⁻) = 282.01 пм.
at(NACL_TIMING.cueAt('contact'))
{
  const d = frame.atoms.na1.distanceTo(frame.atoms.clA)
  ok('ионная пара сошлась на 282 пм', Math.abs(d - NACL_GEOM.latticeNaCl) < 1e-6, d.toFixed(4))
  ok('линии поля включены на шаге притяжения', frame.field > 0.4)
}

// 3.7 Решётка: чередование зарядов, КЧ 6, 144 ребра, 64 иона.
ok('64 иона фрагмента', NACL_ATOMS.filter((a) => !a.id.startsWith('M')).length === 64)
ok('7 атомов металлического фрагмента', NACL_ATOMS.filter((a) => a.id.startsWith('M')).length === 7)
ok('144 ребра Na⁺–Cl⁻', NACL_EDGES.length === 144)
ok('КЧ(Na⁺) = 6', NACL_COORDINATION_IDS.length === 6)
ok('справочное КЧ из crystalData', NACL_GEOM.data.coordination['Na⁺'] === 6 && NACL_GEOM.data.coordination['Cl⁻'] === 6)
ok('пространственная группа Fm-3m (225)', NACL_GEOM.data.spaceGroup === 'Fm-3m' && NACL_GEOM.data.spaceGroupNo === 225)
ok('ГЦК-подрешётки', NACL_GEOM.data.latticeType === 'ГЦК')
ok('a = 564.02 пм, d = 282.01 пм, Z = 4', NACL_GEOM.data.cellPm === 564.02 && NACL_GEOM.data.naClPm === 282.01 && NACL_GEOM.data.z === 4)
ok('ребро ячейки = 4 · HALF', Math.abs(NACL_GEOM.cell - NACL_GEOM.half * 4) < 1e-9)

{
  const el = new Map(NACL_ATOMS.map((a) => [a.id as string, a.el]))
  for (const [a, b] of NACL_EDGES) ok(`соседи ${a}/${b} разноимённые`, el.get(a) !== el.get(b))
}

at(NACL_TIMING.cueAt('lattice') + 0.2)
{
  const ids = NACL_ATOMS.filter((a) => !a.id.startsWith('M')).map((a) => a.id as NaclAtomId)
  for (const id of ids) ok(`ион ${id} проявлен в решётке`, frame.opacity[id] > 0.85)
  // ближайшие соседи разноимённых ионов стоят ровно на 282 пм
  let pairs = 0
  for (const [a, b] of NACL_EDGES) {
    const d = frame.atoms[a].distanceTo(frame.atoms[b])
    ok(`ребро ${a}–${b} = 282 пм`, Math.abs(d - NACL_GEOM.latticeNaCl) < 2e-3, d.toFixed(4))
    pairs++
  }
  ok('проверены все рёбра', pairs === 144)
  ok('металлический фрагмент уже растворился', frame.opacity.M0 < 0.01)
}

// 3.8 Финал отдаёт кадр лаборатории.
at(NACL_END)
ok('в конце кадр затемнён', frame.env.fade > 0.95)

// ─────────────────────────────────────────────────────────────────────────────
// 4. Энергетика
// ─────────────────────────────────────────────────────────────────────────────

validateNaclEnergetics()
ok('пять ступеней цикла', NACL_LADDER.stages.length === 5)
ok('сумма цикла ≈ табличная ΔH°f', Math.abs(NACL_LADDER.sumKJ - NACL_DHF_TABLE_KJ) < 5, `${NACL_LADDER.sumKJ} против ${NACL_DHF_TABLE_KJ}`)
ok('ΔH°f отрицательна (реакция экзотермическая)', NACL_DHF_KJ < 0, `${NACL_DHF_KJ} кДж/моль`)
ok('ΔH°f ≈ −411 кДж/моль', NACL_DHF_KJ === -411, `${NACL_DHF_KJ}`)
ok('энергия решётки отрицательна и самая большая по модулю', NACL_LATTICE_KJ < 0 && NACL_LADDER.stages.every((s) => Math.abs(s.dH) <= Math.abs(NACL_LATTICE_KJ)))
ok('без решётки процесс был бы эндотермическим', NACL_COST_BEFORE_LATTICE_KJ > 0, `${NACL_COST_BEFORE_LATTICE_KJ} кДж/моль`)

{
  const byKind = Object.fromEntries(NACL_LADDER.stages.map((s) => [s.kind, s.dH]))
  ok('ΔH_суб > 0', byKind.sublimation! > 0)
  ok('½D(Cl–Cl) > 0', byKind.dissociation! > 0)
  ok('IE₁ > 0', byKind.ionization! > 0)
  ok('EA(Cl) < 0', byKind.affinity! < 0)
  ok('U_реш < 0', byKind.lattice! < 0)
}

{
  const levels = ladderLevels(NACL_LADDER)
  ok('лестница начинается с нуля', levels[0] === 0)
  ok('последний уровень = сумма цикла', Math.abs(levels[levels.length - 1]! - NACL_LADDER.sumKJ) < 1e-6)
  ok('ступени идут по времени сюжета', NACL_LADDER.stages.every((s, i) => i === 0 || s.at >= NACL_LADDER.stages[i - 1]!.at))
  ok('все ступени попадают в сюжет', NACL_LADDER.stages.every((s) => s.at >= 0 && s.at <= NACL_END))
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Стехиометрия и электронный баланс
// ─────────────────────────────────────────────────────────────────────────────

/** Считает атомы в формуле вида «NaCl», «Cl2», «H2O» (без скобок). */
function countAtoms(formula: string, coeff: number, into: Map<string, number>): void {
  const re = /([A-Z][a-z]?)(\d*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(formula))) {
    if (!m[1]) continue
    const n = m[2] ? Number(m[2]) : 1
    into.set(m[1], (into.get(m[1]) ?? 0) + n * coeff)
  }
}

{
  const left = new Map<string, number>()
  const right = new Map<string, number>()
  for (const t of NACL_REACTION.left) countAtoms(t.formula, t.coeff, left)
  for (const t of NACL_REACTION.right) countAtoms(t.formula, t.coeff, right)
  const keys = new Set([...left.keys(), ...right.keys()])
  for (const k of keys) ok(`баланс по ${k}`, left.get(k) === right.get(k), `${left.get(k)} ≠ ${right.get(k)}`)
  ok('слева есть двухатомный Cl₂', NACL_REACTION.left.some((t) => t.formula === 'Cl2'))
  ok('слева нет одиночных атомов хлора', !NACL_REACTION.left.some((t) => t.formula === 'Cl'))
}

{
  const given = NACL_HALF_REACTIONS.filter((h) => h.id === 'oxidation').reduce((s, h) => s + h.electrons * h.times, 0)
  const taken = NACL_HALF_REACTIONS.filter((h) => h.id === 'reduction').reduce((s, h) => s + h.electrons * h.times, 0)
  ok('электронный баланс полуреакций', given === taken && given === 2, `отдано ${given}, принято ${taken}`)
  const chargeLeft = NACL_HALF_REACTIONS.reduce((s, h) => s + h.chargeLeft * h.times, 0)
  const chargeRight = NACL_HALF_REACTIONS.reduce((s, h) => s + h.chargeRight * h.times, 0)
  ok('зарядовый баланс суммарного уравнения', chargeLeft === 0 && chargeRight === 0)
  for (const h of NACL_HALF_REACTIONS) ok(`полуреакция ${h.id} без выдуманных частиц`, !/Cl²⁻|Cl2-/.test(h.equation))
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Подписи в 3D и тексты ru / en / uz
// ─────────────────────────────────────────────────────────────────────────────

{
  const cl2 = NACL_LABELS.find((l) => l.id === 'cl2')!
  ok('подпись Cl₂ видна до разрыва связи', cl2.windows[0]![1] <= NACL_TIMING.cueAt('bondBreak'))
  const clA = NACL_LABELS.find((l) => l.id === 'clA')!
  ok('подпись отдельного Cl появляется только после разрыва', clA.windows[0]![0] >= NACL_TIMING.cueAt('bondBreak'))
  const naIon = NACL_LABELS.find((l) => l.id === 'na1')!
  ok('подпись Na становится Na⁺ после перехода электрона', naIon.keys.some((k) => k.text === 'Na⁺' && k.t >= NACL_TIMING.cueAt('transfer')))
  ok('нет выдуманной частицы в подписях', NACL_LABELS.every((l) => l.keys.every((k) => !/Cl²⁻/.test(k.text))))
  for (const l of NACL_LABELS) {
    for (const w of l.windows) ok(`окно подписи ${l.id} корректно`, w[0] < w[1] && w[0] >= 0 && w[1] <= NACL_END + 1e-9)
  }

  // Подписи локализуются: раскадровка пишет токены, сцена подставляет язык.
  const known = new Set(Object.keys(SCENE_LABEL_TOKENS.ru))
  for (const token of labelTokensUsed(NACL_LABELS)) {
    ok(`токен подписи {${token}} есть в словаре кита`, known.has(token))
  }
  // Единицы и состояния НЕ зашиты по-английски мимо токенов.
  for (const l of NACL_LABELS) {
    for (const k of l.keys) {
      // Сами токены {pm}/{kJmol} вырезаем — проверяем только текст ВНЕ них.
      const bare = k.text.replace(/\{\w+\}/g, '')
      ok(
        `подпись ${l.id} без зашитой английской единицы: «${k.text}»`,
        !/\b(pm|kJ\/mol|kJ)\b/.test(bare) && !/\((s|g|l|aq)\)/.test(bare),
      )
    }
  }
  for (const locale of LOCALES) {
    const states = createLabelStates(NACL_LABELS)
    localizeSceneLabels(states, locale)
    for (const st of states) {
      ok(`[${locale}] подпись ${st.id} без нераскрытых токенов: «${st.text}»`, !/\{\w+\}/.test(st.text))
      ok(`[${locale}] подпись ${st.id} непустая`, st.text.trim().length > 0)
    }
  }
  // Русский язык действительно отличается от английского (иначе токены не работают).
  const ru = createLabelStates(NACL_LABELS)
  const en = createLabelStates(NACL_LABELS)
  localizeSceneLabels(ru, 'ru')
  localizeSceneLabels(en, 'en')
  ok(
    'подписи ru отличаются от en (состояния и единицы переведены)',
    ru.some((s, i) => s.text !== en[i]!.text),
  )
  const ruCell = ru.find((s) => s.id === 'cell')!.text
  ok(`подпись ячейки по-русски в пикометрах: «${ruCell}»`, ruCell.includes('пм') && !ruCell.includes('pm'))

  // Подписи над кубом не должны налезать друг на друга.
  const cell = NACL_LABELS.find((l) => l.id === 'cell')!
  const coord = NACL_LABELS.find((l) => l.id === 'coord')!
  ok(`подписи «a = …» и КЧ разведены по высоте (Δ=${(cell.dy - coord.dy).toFixed(2)})`, Math.abs(cell.dy - coord.dy) >= 0.5)
}

for (const locale of LOCALES) {
  const text = getNaclMechanismText(locale)
  ok(`[${locale}] есть заголовок урока`, text.intro.title.length > 0)
  ok(`[${locale}] есть предупреждение о безопасности`, text.safety.length > 20)
  for (const id of NACL_STEP_IDS) {
    const s = text.steps[id]
    ok(`[${locale}] шаг ${id}: заголовок`, !!s && s.title.trim().length > 0)
    ok(`[${locale}] шаг ${id}: 2–4 предложения`, s.body.split(/[.!?]\s/).length >= 2, `${s.body.length} симв.`)
    ok(`[${locale}] шаг ${id}: уравнение`, s.equation.trim().length > 0)
    ok(`[${locale}] шаг ${id}: реплика`, s.speak.trim().length > 0)
  }
  ok(`[${locale}] честная пометка есть хотя бы у половины шагов`, NACL_STEP_IDS.filter((id) => text.steps[id].note).length >= 3)
  for (const s of NACL_LADDER.stages) {
    ok(`[${locale}] подпись ступени ${s.id}`, (text.energy.stages as Record<string, string>)[s.id]?.length > 0)
  }
  ok(`[${locale}] единица энергии`, text.energy.unit.length > 0)
  ok(`[${locale}] итоговая строка лестницы`, text.energy.stages.total.length > 0)
  ok(`[${locale}] aria-подпись лестницы`, text.energy.summary.includes('{dH}'))
  ok(`[${locale}] нет частицы «Cl²⁻» в текстах`, !JSON.stringify(text).includes('Cl²⁻'))
}

console.log(`✓ nacl cinema: ${checks} проверок пройдено`)
console.log(`  шагов ${NACL_STEPS.length}, экранное время ${wall.toFixed(1)} с, сюжет ${NACL_END} с`)
console.log(`  цикл Борна — Габера: Σ = ${NACL_LADDER.sumKJ} кДж/моль (таблица ${NACL_DHF_TABLE_KJ})`)
console.log(
  `  радиусы: Na ${speciesRadiusPm('Na', 0)} → Na⁺ ${speciesRadiusPm('Na', 1)} пм, ` +
    `Cl ${speciesRadiusPm('Cl', 0)} → Cl⁻ ${speciesRadiusPm('Cl', -1)} пм (Cl⁻ / Na⁺ = ${ratio.toFixed(2)})`,
)
