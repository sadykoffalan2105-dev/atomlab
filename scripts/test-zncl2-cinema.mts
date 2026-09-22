#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт урока «получение водорода: Zn (тв.) + 2 HCl (р-р) → ZnCl₂ (р-р) + H₂ (г.)↑».
 *
 * Сцена проверяется ДАННЫМИ, а не глазами: раскадровка — чистая функция
 * sampleZncl2Frame(t), поэтому весь урок сэмплируется в Node.
 *
 * Что доказывает этот тест:
 *   • хронометраж: 6 шагов, 26–34 экранных секунды, cue'ы по возрастанию,
 *     контракт лаборатории embryo → birth → complete на месте;
 *   • раскадровка: дорожки монотонны, ни один видимый атом не прыгает
 *     больше чем на 0.09 ед. между кадрами 1/30 с;
 *   • химия: длина связи H–H, O–H и угол H–O–H — из ядра (bondData),
 *     Zn–O = 208 пм у всех шести молекул аквакомплекса (КЧ 6),
 *     радиус цинка 134 → 74 пм ровно тогда, когда ион покидает решётку;
 *   • решётка металла: ГПУ-фрагмент, соседи в слое ровно на a = 266,49 пм,
 *     есть соседи и между слоями;
 *   • электронейтральность кадра: 2 H⁺ и 2 Cl⁻ до реакции, Zn²⁺ и 2 Cl⁻ после;
 *   • энергия: сумма цикла Гесса = ΔH°f(Zn²⁺, водн), знаки ступеней верные;
 *   • электрохимия: E°(Zn) < 0 < E°(Cu), ЭДС с цинком > 0, с медью < 0;
 *   • стехиометрия молекулярного и сокращённого ионного уравнения (атомы И заряд);
 *   • тексты есть в ru / en / uz для каждого шага; подписи локализуются.
 *
 * Запуск: npx tsx scripts/test-zncl2-cinema.mts
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { bondAngleDeg, bondEnthalpyKJ, bondLengthPm, dHfKJ, getCrystal, radiusForSpecies } from '../src/chemistry/data/index.ts'

/**
 * Числа, извлечённые из текста урока: «435,8», «−93,6», «+1307,4» → числа.
 * Тексты не сверяются по фразам — сверяются ЧИСЛА с научным ядром.
 */
const NUM_RE = /[−-]?\+?\d+(?:[.,]\d+)?/g
function numbersIn(text: string): number[] {
  return [...text.matchAll(NUM_RE)].map((m) => Number(m[0].replace('−', '-').replace('+', '').replace(',', '.')))
}
/** Есть ли в тексте число, равное value с точностью tol. */
function hasNumber(text: string, value: number, tol = 0.051): boolean {
  return numbersIn(text).some((n) => Math.abs(n - value) <= tol)
}
/** Первое число после якоря (якорь — фрагмент формулы или символ, не фраза). */
function numberAfter(text: string, anchor: string): number | null {
  const i = text.indexOf(anchor)
  if (i < 0) return null
  const n = numbersIn(text.slice(i + anchor.length))
  return n.length ? n[0]! : null
}

import { storyWallDuration } from '../src/lab/cinema/core/storyTime.ts'
import {
  assertNoPositionJumps,
  createLabelStates,
  labelTokensUsed,
  localizeSceneLabels,
  SCENE_LABEL_TOKENS,
} from '../src/lab/cinema/scenes/kit/sceneKit.ts'
import { assertIonSizeOrder, SPECIES_SCALE, speciesRadiusPm } from '../src/lab/cinema/scenes/kit/cpkAtoms.ts'
import { ladderLevels } from '../src/lab/cinema/scenes/kit/energyLadderData.ts'
import {
  ZNCL2_AQUA_BONDS,
  ZNCL2_ATOMS,
  ZNCL2_CUES,
  ZNCL2_END,
  ZNCL2_GEOM,
  ZNCL2_H2_BOND,
  ZNCL2_LABELS,
  ZNCL2_METAL_BONDS,
  ZNCL2_OH_BONDS,
  ZNCL2_SEGMENTS,
  ZNCL2_STEPS,
  ZNCL2_STEP_IDS,
  ZNCL2_TIMING,
  createZncl2Frame,
  sampleZncl2Frame,
  validateZncl2Storyboard,
} from '../src/lab/cinema/scenes/zncl2/zncl2Storyboard.ts'
import {
  ZNCL2_CELL_CU_V,
  ZNCL2_CELL_V,
  ZNCL2_COUPLES,
  ZNCL2_E0_CU_V,
  ZNCL2_E0_H_V,
  ZNCL2_E0_ZN_V,
  ZNCL2_HALF_REACTIONS,
  ZNCL2_IONIC_REACTION,
  ZNCL2_LADDER,
  ZNCL2_REACTION,
  ZNCL2_REACTION_DH_KJ,
  ZNCL2_SOLID_DHF_KJ,
  ZNCL2_SOLUTION_DHF_KJ,
  validateZncl2Energetics,
} from '../src/lab/cinema/scenes/zncl2/zncl2Energetics.ts'
import { getZncl2MechanismText, type Zncl2Locale } from '../src/lab/cinema/scenes/zncl2/zncl2MechanismText.ts'
import { zncl2ScientificWatchdogMs } from '../src/lab/scientificSynthesis/zncl2ScenarioTiming.ts'

const LOCALES: Zncl2Locale[] = ['ru', 'en', 'uz']
/** Сцена считает в мировых единицах; обратно в пикометры — через этот множитель. */
const PM_PER_UNIT = ZNCL2_GEOM.bond.hh > 0 ? bondLengthPm('H-H') / ZNCL2_GEOM.bond.hh : 1
const frame = createZncl2Frame()
const at = (t: number) => sampleZncl2Frame(t, frame)
const pm = (units: number) => units * PM_PER_UNIT

let checks = 0
function ok(label: string, cond: boolean, detail = ''): void {
  assert.ok(cond, `${label}${detail ? ` — ${detail}` : ''}`)
  checks++
}
function near(label: string, got: number, want: number, tol: number): void {
  ok(label, Math.abs(got - want) <= tol, `получилось ${got.toFixed(3)}, ожидалось ${want} ± ${tol}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Хронометраж и контракт лаборатории
// ─────────────────────────────────────────────────────────────────────────────

ZNCL2_TIMING.validate()
ok('шагов 6 ± 1', ZNCL2_STEPS.length >= 5 && ZNCL2_STEPS.length <= 7, `${ZNCL2_STEPS.length}`)
ok('id шагов совпадают', ZNCL2_STEP_IDS.join(',') === ZNCL2_STEPS.map((s) => s.id).join(','))

const wall = storyWallDuration(ZNCL2_SEGMENTS)
ok('экранная длительность 26–34 с', wall >= 26 && wall <= 34, `${wall.toFixed(1)} с`)

let prevTo = 0
for (const s of ZNCL2_STEPS) {
  ok(`шаг ${s.id} непрерывен`, s.from === prevTo && s.to > s.from)
  ok(`шаг ${s.id} имеет экранное время`, s.wall > 0)
  prevTo = s.to
}

let prevCue = -Infinity
for (const c of ZNCL2_CUES) {
  ok(`cue ${c.id} внутри сюжета`, c.at >= 0 && c.at <= ZNCL2_END, `${c.at}`)
  ok(`cue ${c.id} по возрастанию`, c.at >= prevCue)
  prevCue = c.at
}
const cueIndex = (id: string) => ZNCL2_CUES.findIndex((c) => c.id === id)
ok(
  'контракт лаборатории embryo → birth → complete',
  cueIndex('embryo') >= 0 && cueIndex('embryo') < cueIndex('birth') && cueIndex('birth') < cueIndex('complete'),
)
ok('complete совпадает с концом сюжета', ZNCL2_CUES[cueIndex('complete')]!.at === ZNCL2_END)
ok('watchdog лаборатории положителен', zncl2ScientificWatchdogMs() > 0)

for (let i = 0; i < ZNCL2_STEPS.length; i++) {
  const s = ZNCL2_STEPS[i]!
  ok(`stepIndexAt(${s.id})`, ZNCL2_TIMING.stepIndexAt((s.from + s.to) / 2) === i)
}

// Порядок событий сюжета: сначала подход, потом электроны, молекула, пузырёк,
// уход иона, гидратация, зрители, тепло.
const order = ['dissociation', 'approach', 'electrons', 'h2form', 'bubble', 'znLeave', 'hydration', 'spectator', 'exo']
for (let i = 1; i < order.length; i++) {
  ok(`«${order[i - 1]}» раньше «${order[i]}»`, ZNCL2_TIMING.cueAt(order[i - 1] as never) < ZNCL2_TIMING.cueAt(order[i] as never))
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Раскадровка: дорожки и отсутствие рывков
// ─────────────────────────────────────────────────────────────────────────────

validateZncl2Storyboard()

const scratch = createZncl2Frame()
const buf = ZNCL2_ATOMS.map((a) => ({ id: a.id as string, pos: new THREE.Vector3(), opacity: 0 }))
assertNoPositionJumps(
  (t) => {
    sampleZncl2Frame(t, scratch)
    for (let i = 0; i < ZNCL2_ATOMS.length; i++) {
      const id = ZNCL2_ATOMS[i]!.id
      buf[i]!.pos.copy(scratch.atoms[id]!)
      buf[i]!.opacity = scratch.opacity[id]!
    }
    return buf
  },
  ZNCL2_END,
)
checks++

// Прозрачность, радиусы и заряды остаются в допустимых пределах весь сюжет.
for (let t = 0; t <= ZNCL2_END + 1e-9; t += 0.1) {
  at(t)
  for (const a of ZNCL2_ATOMS) {
    const o = frame.opacity[a.id]!
    const r = frame.radius[a.id]!
    const q = frame.charge[a.id]!
    assert.ok(o >= -1e-6 && o <= 1 + 1e-6, `прозрачность ${a.id} вне [0,1] при t=${t.toFixed(2)}: ${o}`)
    assert.ok(r > 0, `радиус ${a.id} обязан быть положительным при t=${t.toFixed(2)}`)
    assert.ok(q >= -1 - 1e-6 && q <= 1 + 1e-6, `заряд ${a.id} вне [−1,1] при t=${t.toFixed(2)}: ${q}`)
  }
  assert.ok(frame.camera.zoom > 0, 'зум камеры обязан быть положительным')
}
checks++

// ─────────────────────────────────────────────────────────────────────────────
// 3. Химия кадра: настоящие расстояния и углы
// ─────────────────────────────────────────────────────────────────────────────

// —— Молекула H₂: 74,14 пм ——
at(12.5)
near('d(H–H) в молекуле, пм', pm(frame.atoms[ZNCL2_H2_BOND.a]!.distanceTo(frame.atoms[ZNCL2_H2_BOND.b]!)), bondLengthPm('H-H'), 0.05)
ok('связь H–H видна после образования', frame.h2Bond.opacity > 0.9)
at(9.5)
ok('связи H–H ещё нет до встречи атомов', frame.h2Bond.opacity < 0.05)

// —— Вода: O–H и угол H–O–H из ядра ——
at(18)
for (let i = 0; i < 6; i++) {
  const o = frame.atoms[`W${i}` as 'oA']!
  const h1 = frame.atoms[`WH${i * 2}` as 'oA']!
  const h2 = frame.atoms[`WH${i * 2 + 1}` as 'oA']!
  near(`d(O–H) воды ${i}, пм`, pm(o.distanceTo(h1)), bondLengthPm('O-H'), 0.05)
  const a = (h1.clone().sub(o).angleTo(h2.clone().sub(o)) * 180) / Math.PI
  near(`угол H–O–H воды ${i}, °`, a, bondAngleDeg('water'), 0.05)
}

// —— Аквакомплекс [Zn(H₂O)₆]²⁺: Zn–O 208 пм, шесть вершин, октаэдр ——
ok('в аквакомплексе ровно шесть молекул воды (КЧ 6)', ZNCL2_AQUA_BONDS.length === 6)
const znPos = frame.atoms.Z0!
const dirs: THREE.Vector3[] = []
for (const bond of ZNCL2_AQUA_BONDS) {
  const o = frame.atoms[bond.o]!
  near(`d(Zn–O) ${bond.o}, пм`, pm(znPos.distanceTo(o)), bondLengthPm('Zn-O'), 0.05)
  dirs.push(o.clone().sub(znPos).normalize())
}
// В октаэдре у каждой вершины ровно одна противоположная (180°) и четыре под 90°.
for (let i = 0; i < dirs.length; i++) {
  let opposite = 0
  let right = 0
  for (let j = 0; j < dirs.length; j++) {
    if (i === j) continue
    const deg = (dirs[i]!.angleTo(dirs[j]!) * 180) / Math.PI
    if (Math.abs(deg - 180) < 0.5) opposite++
    else if (Math.abs(deg - 90) < 0.5) right++
  }
  ok(`вершина ${i} октаэдра: одна напротив и четыре под 90°`, opposite === 1 && right === 4, `${opposite}/${right}`)
}
ok('связи Zn ← OH₂ видны на шаге гидратации', frame.aquaBond > 0.5)

// —— Гидроксоний H₃O⁺: пирамида, три связи O–H ——
at(2)
for (const h of ['hA1', 'hA2', 'hA3'] as const) {
  near(`d(O–H) в H₃O⁺ (${h}), пм`, pm(frame.atoms.oA!.distanceTo(frame.atoms[h]!)), bondLengthPm('O-H'), 0.05)
}
const angA = (frame.atoms.hA2!.clone().sub(frame.atoms.oA!).angleTo(frame.atoms.hA3!.clone().sub(frame.atoms.oA!)) * 180) / Math.PI
near('угол H–O–H в H₃O⁺, °', angA, bondAngleDeg('tetrahedral'), 0.05)
ok('H₃O⁺ несёт положительный заряд', frame.charge.oA! > 0.2 && frame.charge.hA2! > 0.2)
ok('голое ядро H⁺ меньше атома H', frame.radius.hA1! < frame.radius.hA2!)

// После ухода протона остаётся именно вода: угол смыкается до угла воды из ядра.
at(11)
const angW = (frame.atoms.hA2!.clone().sub(frame.atoms.oA!).angleTo(frame.atoms.hA3!.clone().sub(frame.atoms.oA!)) * 180) / Math.PI
near('угол H–O–H после потери протона, °', angW, bondAngleDeg('water'), 0.05)
ok('бывший H₃O⁺ стал нейтральной водой', Math.abs(frame.charge.oA!) < 0.05)

// —— Протон получил электрон и стал атомом ——
at(6.8)
near('радиус H⁺ до прихода электрона, пм', pm(frame.radius.hA1!), pm(ZNCL2_GEOM.radius.proton), 0.01)
ok('H⁺ заряжен положительно', frame.charge.hA1! > 0.9)
at(8.4)
ok('атом H нейтрален', Math.abs(frame.charge.hA1!) < 0.05)
near('радиус атома H, пм', pm(frame.radius.hA1!) / SPECIES_SCALE, radiusForSpecies('H', 0), 0.5)

// —— Цинк: 134 → 74 пм ровно тогда, когда ион покидает решётку ——
assertIonSizeOrder('Zn', 2)
checks++
at(12)
near('радиус Zn в металле, пм', pm(frame.radius.Z0!) / SPECIES_SCALE, speciesRadiusPm('Zn', 0), 0.5)
ok('цинк в металле не заряжен', Math.abs(frame.charge.Z0!) < 0.02)
at(16)
near('радиус Zn²⁺ в растворе, пм', pm(frame.radius.Z0!) / SPECIES_SCALE, speciesRadiusPm('Zn', 2), 0.5)
ok('ион цинка заряжен положительно', frame.charge.Z0! > 0.9)
ok(
  'катион Zn²⁺ почти вдвое меньше атома',
  speciesRadiusPm('Zn', 2) / speciesRadiusPm('Zn', 0) < 0.6,
  `${(speciesRadiusPm('Zn', 2) / speciesRadiusPm('Zn', 0)).toFixed(2)}`,
)

// Ион действительно ушёл из решётки к концу сцены.
const inLattice = new THREE.Vector3()
at(10)
inLattice.copy(frame.atoms.Z0!)
at(17)
ok('Zn²⁺ покинул пластинку', frame.atoms.Z0!.distanceTo(inLattice) > 1.5)

// —— Металл: ГПУ-фрагмент ——
const metal = getCrystal('zn_metal')!
ok('в пластинке 18 атомов цинка', ZNCL2_ATOMS.filter((a) => a.role === 'metal').length === 18)
ok('решётка металла — ГПУ', metal.latticeType === 'ГПУ' && metal.spaceGroup === 'P6₃/mmc')
at(3)
let inLayer = 0
let between = 0
for (const [a, b] of ZNCL2_METAL_BONDS) {
  const d = pm(frame.atoms[a]!.distanceTo(frame.atoms[b]!))
  if (Math.abs(d - metal.cellPm.a) < 0.05) inLayer++
  else between++
  ok(`ребро ${a}–${b} не длиннее 1,15·a`, d < metal.cellPm.a * 1.15 + 0.5, `${d.toFixed(1)} пм`)
}
ok('есть соседи в слое на a = 266,49 пм', inLayer > 0, `${inLayer}`)
ok('есть соседи между слоями (ГПУ-укладка)', between > 0, `${between}`)

// —— Cl⁻: зрители, размер не меняется ——
const clIds = ZNCL2_ATOMS.filter((a) => a.role === 'spectator').map((a) => a.id)
ok('ионов-зрителей Cl⁻ ровно два', clIds.length === 2)
for (let t = 2; t <= ZNCL2_END; t += 0.5) {
  at(t)
  for (const id of clIds) {
    near(`радиус ${id} не меняется, пм`, pm(frame.radius[id]!) / SPECIES_SCALE, speciesRadiusPm('Cl', -1), 0.5)
    ok(`заряд ${id} остаётся −1`, Math.abs(frame.charge[id]! + 1) < 1e-6)
  }
}
ok('Cl⁻ больше атома Cl', speciesRadiusPm('Cl', -1) > speciesRadiusPm('Cl', 0))

// Ионы-зрители никогда не «прилипают» к цинку: связей Zn–Cl в сцене нет.
for (let t = 14; t <= ZNCL2_END; t += 0.5) {
  at(t)
  for (const id of clIds) {
    ok(`${id} не касается Zn²⁺ при t=${t.toFixed(1)}`, frame.atoms[id]!.distanceTo(frame.atoms.Z0!) > frame.radius[id]! + frame.radius.Z0!)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Электронейтральность и баланс уравнений
// ─────────────────────────────────────────────────────────────────────────────

const protons = ZNCL2_ATOMS.filter((a) => a.role === 'proton').length
ok('в кадре ровно два протона', protons === 2)
ok('до реакции заряд сходится: 2(+1) + 2(−1) = 0', protons * 1 + clIds.length * -1 === 0)
ok('после реакции заряд сходится: (+2) + 2(−1) = 0', 2 + clIds.length * -1 === 0)

const ATOMS_IN: Record<string, Record<string, number>> = {
  Zn: { Zn: 1 },
  HCl: { H: 1, Cl: 1 },
  ZnCl2: { Zn: 1, Cl: 2 },
  H2: { H: 2 },
  H: { H: 1 },
}
function tally(side: readonly { formula: string; coeff: number }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const term of side) {
    const comp = ATOMS_IN[term.formula]
    assert.ok(comp, `неизвестная формула «${term.formula}»`)
    for (const [el, n] of Object.entries(comp)) out[el] = (out[el] ?? 0) + n * term.coeff
  }
  return out
}
const left = tally(ZNCL2_REACTION.left)
const right = tally(ZNCL2_REACTION.right)
for (const el of new Set([...Object.keys(left), ...Object.keys(right)])) {
  ok(`молекулярное уравнение сбалансировано по ${el}`, left[el] === right[el], `${left[el]} ≠ ${right[el]}`)
}

const ionLeft = tally(ZNCL2_IONIC_REACTION.left)
const ionRight = tally(ZNCL2_IONIC_REACTION.right)
for (const el of new Set([...Object.keys(ionLeft), ...Object.keys(ionRight)])) {
  ok(`ионное уравнение сбалансировано по ${el}`, ionLeft[el] === ionRight[el], `${ionLeft[el]} ≠ ${ionRight[el]}`)
}
const chargeLeft = ZNCL2_IONIC_REACTION.left.reduce((s, t) => s + t.charge * t.coeff, 0)
const chargeRight = ZNCL2_IONIC_REACTION.right.reduce((s, t) => s + t.charge * t.coeff, 0)
ok('ионное уравнение сбалансировано по ЗАРЯДУ', chargeLeft === chargeRight, `${chargeLeft} ≠ ${chargeRight}`)
ok('хлорид-ионы не входят в сокращённое ионное уравнение', !ionLeft.Cl && !ionRight.Cl)

const given = ZNCL2_HALF_REACTIONS[0].electrons * ZNCL2_HALF_REACTIONS[0].times
const taken = ZNCL2_HALF_REACTIONS[1].electrons * ZNCL2_HALF_REACTIONS[1].times
ok('электронный баланс полуреакций', given === taken, `${given} ≠ ${taken}`)
ok('окисление: цинк отдаёт 2 e⁻ и становится +2', ZNCL2_HALF_REACTIONS[0].chargeRight - ZNCL2_HALF_REACTIONS[0].chargeLeft === given)
ok('восстановление: два протона принимают 2 e⁻', ZNCL2_HALF_REACTIONS[1].chargeLeft - ZNCL2_HALF_REACTIONS[1].chargeRight === taken)
ok('в уравнениях нет выдуманных частиц', ZNCL2_HALF_REACTIONS.every((h) => !/H²|Cl²⁻|Zn⁺⁺/.test(h.equation)))

// ─────────────────────────────────────────────────────────────────────────────
// 5. Энергия и электрохимия
// ─────────────────────────────────────────────────────────────────────────────

validateZncl2Energetics()
checks++

ok('в цикле семь ступеней', ZNCL2_LADDER.stages.length === 7, `${ZNCL2_LADDER.stages.length}`)
near('сумма цикла Гесса = табличная ΔH°f(Zn²⁺, водн)', ZNCL2_LADDER.sumKJ, ZNCL2_LADDER.tableKJ, 1)
ok('реакция экзотермическая', ZNCL2_REACTION_DH_KJ < 0, `${ZNCL2_REACTION_DH_KJ} кДж/моль`)
near('тепловой эффект ≈ −154 кДж/моль', ZNCL2_REACTION_DH_KJ, -154, 1)

const levels = ladderLevels(ZNCL2_LADDER)
ok('уровней на один больше, чем ступеней', levels.length === ZNCL2_LADDER.stages.length + 1)
near('последний уровень = сумма цикла', levels[levels.length - 1]!, ZNCL2_LADDER.sumKJ, 1e-6)
let stageAt = -Infinity
for (const s of ZNCL2_LADDER.stages) {
  ok(`ступень «${s.id}» по возрастанию времени`, s.at >= stageAt, `${s.at}`)
  ok(`ступень «${s.id}» внутри сюжета`, s.at >= 0 && s.at <= ZNCL2_END)
  ok(`у ступени «${s.id}» есть уравнение`, s.equation.length > 4)
  stageAt = s.at
}
// Вторая энергия ионизации всегда больше первой.
const ie1 = ZNCL2_LADDER.stages.find((s) => s.id === 'ionization1')!
const ie2 = ZNCL2_LADDER.stages.find((s) => s.id === 'ionization2')!
ok('IE₂ > IE₁', ie2.dH > ie1.dH, `${ie2.dH} vs ${ie1.dH}`)
// Гидратация иона и сборка молекулы H₂ — экзотермичны.
ok('гидратация Zn²⁺ экзотермична', ZNCL2_LADDER.stages.find((s) => s.id === 'hydration')!.dH < 0)
near('сборка H₂ = −D(H–H)', ZNCL2_LADDER.stages.find((s) => s.id === 'recombination')!.dH, -436, 0.5)

ok('ΔH°f(ZnCl₂, р-р) отрицательна', ZNCL2_SOLUTION_DHF_KJ < 0, `${ZNCL2_SOLUTION_DHF_KJ}`)
ok('ΔH°f(ZnCl₂, тв.) отрицательна', ZNCL2_SOLID_DHF_KJ < 0, `${ZNCL2_SOLID_DHF_KJ}`)

near('E°(Zn²⁺/Zn) = −0,76 В', ZNCL2_E0_ZN_V, -0.7618, 1e-4)
ok('E°(2H⁺/H₂) = 0 — ноль шкалы по определению', ZNCL2_E0_H_V === 0)
near('E°(Cu²⁺/Cu) = +0,34 В', ZNCL2_E0_CU_V, 0.3419, 1e-4)
near('ЭДС реакции с цинком = +0,76 В', ZNCL2_CELL_V, 0.7618, 1e-4)
ok('цинк вытесняет водород (E° > 0)', ZNCL2_CELL_V > 0)
ok('медь водород НЕ вытесняет (E° < 0)', ZNCL2_CELL_CU_V < 0, `${ZNCL2_CELL_CU_V}`)
for (const [id, couple] of Object.entries(ZNCL2_COUPLES)) {
  ok(`у пары «${id}» полуреакция записана с двумя электронами`, couple.n === 2, `${couple.n}`)
  ok(`у пары «${id}» есть текст полуреакции`, couple.half.includes('2e⁻'))
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Тексты урока ru / en / uz
// ─────────────────────────────────────────────────────────────────────────────

for (const locale of LOCALES) {
  const text = getZncl2MechanismText(locale)
  ok(`${locale}: есть вступление`, text.intro.title.length > 2 && text.intro.speak.length > 10)
  ok(`${locale}: есть предупреждение о безопасности`, text.safety.length > 40)
  ok(`${locale}: легенда объясняет электрон, металл и воду`, Boolean(text.legend.electron && text.legend.orbitalPhase && text.legend.water))
  for (const id of ZNCL2_STEP_IDS) {
    const s = text.steps[id]
    ok(`${locale}/${id}: заголовок`, Boolean(s?.title && s.title.length > 3))
    ok(`${locale}/${id}: тело 2–4 предложения`, Boolean(s?.body && s.body.length > 140))
    ok(`${locale}/${id}: уравнение стадии`, Boolean(s?.equation && s.equation.length > 5))
    ok(`${locale}/${id}: реплика преподавателя`, Boolean(s?.speak && s.speak.length > 15))
  }
  // Честная пометка о схематичности — на каждом шаге.
  for (const id of ZNCL2_STEP_IDS) {
    ok(`${locale}/${id}: есть пометка note`, Boolean(text.steps[id]?.note && text.steps[id]!.note!.length > 20))
  }
  const energy = text.energy
  ok(`${locale}: подписи всех ступеней лестницы`, ZNCL2_LADDER.stages.every((s) => Boolean((energy.stages as Record<string, string>)[s.id])))
  ok(`${locale}: единица измерения у лестницы`, energy.unit.length > 2)
  ok(`${locale}: aria-подпись лестницы содержит {dH}`, energy.summary.includes('{dH}'))
  ok(`${locale}: указаны источники`, energy.sources.length > 20)
}
// ─────────────────────────────────────────────────────────────────────────────
// Разбор замечаний: соль в уроке — именно α-ZnCl₂ из ядра
// ─────────────────────────────────────────────────────────────────────────────

// Плотность ZnCl₂ в ядре спорная (рентгеновская 3,01 против справочной 2,907),
// поэтому урок её НЕ называет вовсе; зато модификация, группа, параметры ячейки
// и координация обязаны совпадать с ядром слово в слово.
const SALT = ZNCL2_GEOM.data.salt
ok('соль урока — α-форма, группа I-42d (122)', SALT.spaceGroup === 'I-42d' && SALT.spaceGroupNo === 122, SALT.spaceGroup)
ok('координация α-ZnCl₂: Zn 4, Cl 2', SALT.coordination['Zn²⁺'] === 4 && SALT.coordination['Cl⁻'] === 2)
ok('решётка тетрагональная, c задан', SALT.cPm > 0 && SALT.aPm > 0, `${SALT.aPm} × ${SALT.cPm}`)
for (const locale of LOCALES) {
  const text = getZncl2MechanismText(locale)
  const all = Object.values(text.steps).map((s) => `${s.body} ${s.note ?? ''}`).join(' ')
  ok(`${locale}: названа группа α-формы из ядра`, all.includes(SALT.spaceGroup), SALT.spaceGroup)
  ok(`${locale}: параметр a из ядра`, all.includes(String(SALT.aPm).replace('.', ',')) || all.includes(String(SALT.aPm)))
  ok(`${locale}: d(Zn–Cl) из ядра`, all.includes(String(SALT.znClPm)))
  // Спорное число в урок не просочилось ни в какой шкале.
  // Структурно: единицы плотности в уроке нет вовсе — спорное число не названо ни в какой шкале.
  ok(`${locale}: урок не называет плотность ZnCl₂`, !/г\/см³|g\/cm³|g\/sm³/.test(all))
}

// Переводы действительно разные.
ok('ru ≠ en', getZncl2MechanismText('ru').steps.acid.body !== getZncl2MechanismText('en').steps.acid.body)
ok('ru ≠ uz', getZncl2MechanismText('ru').steps.acid.body !== getZncl2MechanismText('uz').steps.acid.body)
ok('en ≠ uz', getZncl2MechanismText('en').steps.acid.body !== getZncl2MechanismText('uz').steps.acid.body)

// ─────────────────────────────────────────────────────────────────────────────
// 7. Подписи в 3D: токены и локализация
// ─────────────────────────────────────────────────────────────────────────────

for (const token of labelTokensUsed(ZNCL2_LABELS)) {
  ok(`токен «{${token}}» есть в словаре`, Boolean(SCENE_LABEL_TOKENS.ru[token]), token)
}
for (const locale of LOCALES) {
  const states = createLabelStates(ZNCL2_LABELS)
  localizeSceneLabels(states, locale)
  for (const st of states) ok(`${locale}: подпись «${st.id}» без нераскрытых токенов`, !/\{\w+\}/.test(st.text), st.text)
}
{
  const ru = createLabelStates(ZNCL2_LABELS)
  const en = createLabelStates(ZNCL2_LABELS)
  localizeSceneLabels(ru, 'ru')
  localizeSceneLabels(en, 'en')
  ok('русские подписи отличаются от английских', ru.some((s, i) => s.text !== en[i]!.text))
}
// Подписи одного якоря не должны налезать друг на друга.
const byAnchor = new Map<string, number[]>()
for (const d of ZNCL2_LABELS) {
  const list = byAnchor.get(d.anchor) ?? []
  list.push(d.dy)
  byAnchor.set(d.anchor, list)
}
for (const [anchor, dys] of byAnchor) {
  const sorted = [...dys].sort((a, b) => a - b)
  for (let i = 1; i < sorted.length; i++) {
    ok(`подписи якоря «${anchor}» разведены по высоте`, sorted[i]! - sorted[i - 1]! >= 0.4, `${sorted[i - 1]} и ${sorted[i]}`)
  }
}
// В подписях не должно быть жёстко вшитых единиц и состояний.
for (const d of ZNCL2_LABELS) {
  for (const k of d.keys) {
    // Сами токены вырезаем: проверяем ровно то, что осталось «руками написанным».
    const bare = k.text.replace(/\{\w+\}/g, '')
    ok(`подпись «${d.id}» не содержит вшитых единиц`, !/\b(pm|пм|kJ\/mol|кДж)\b/.test(bare), k.text)
    ok(`подпись «${d.id}» не содержит вшитого состояния`, !/\(\s*(s|g|l|aq|тв\.|г\.|р-р)\s*\)/.test(bare), k.text)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Связи кадра: пулы не переполняются
// ─────────────────────────────────────────────────────────────────────────────

ok('связей O–H столько же, сколько водородов воды и гидроксония', ZNCL2_OH_BONDS.length === 30, `${ZNCL2_OH_BONDS.length}`)
ok('две связи O–H помечены как рвущиеся', ZNCL2_OH_BONDS.filter((b) => b.breaking).length === 2)
for (const b of ZNCL2_OH_BONDS) {
  ok(`связь ${b.o}–${b.h} соединяет существующие частицы`, ZNCL2_ATOMS.some((a) => a.id === b.o) && ZNCL2_ATOMS.some((a) => a.id === b.h))
}
for (const b of ZNCL2_AQUA_BONDS) {
  ok(`связь ${b.zn}←${b.o} соединяет существующие частицы`, ZNCL2_ATOMS.some((a) => a.id === b.zn) && ZNCL2_ATOMS.some((a) => a.id === b.o))
}
ok('у молекулы H₂ оба конца — бывшие протоны', ZNCL2_ATOMS.filter((a) => a.id === ZNCL2_H2_BOND.a || a.id === ZNCL2_H2_BOND.b).every((a) => a.role === 'proton'))

// ─────────────────────────────────────────────────────────────────────────────
// 9. Замечание профессора (круг 2): безводный ZnCl₂ простым выпариванием не получить
// ─────────────────────────────────────────────────────────────────────────────
// Из водного раствора кристаллизуются ГИДРАТЫ, а при нагревании идёт гидролиз с
// отщеплением HCl (Zn(OH)Cl → ZnO). Безводную соль упаривают в токе сухого HCl
// либо обезвоживают SOCl₂ (Greenwood & Earnshaw; Brauer).
{
  const DRY_HCL: Record<Zncl2Locale, RegExp> = {
    ru: /сухого хлороводорода|сухого HCl/i,
    en: /dry hydrogen chloride|dry HCl/i,
    uz: /quruq vodorod xlorid|quruq HCl/i,
  }
  const HYDRATES: Record<Zncl2Locale, RegExp> = {
    ru: /ГИДРАТЫ|гидрат/,
    en: /HYDRATES|hydrate/,
    uz: /GIDRATLAR|gidrat/,
  }
  const HYDROLYSIS: Record<Zncl2Locale, RegExp> = {
    ru: /гидролиз/i,
    en: /hydrolysis/i,
    uz: /gidroliz/i,
  }
  for (const locale of LOCALES) {
    const step = getZncl2MechanismText(locale).steps.spectators
    ok(`[${locale}] в шаге spectators упаривание идёт в токе сухого HCl`, DRY_HCL[locale].test(step.body), step.body.slice(0, 80))
    ok(`[${locale}] note шага spectators предупреждает о гидратах`, HYDRATES[locale].test(step.note ?? ''))
    ok(`[${locale}] note шага spectators называет гидролиз при нагревании`, HYDROLYSIS[locale].test(step.note ?? ''))
  }
}

// ── Числа текста = научное ядро ──
for (const locale of LOCALES) {
  const text = getZncl2MechanismText(locale)
  // Шаг hydrogen: d(H–H) и E(H–H) — из bondData.
  const h = text.steps.hydrogen
  ok(`[${locale}] d(H–H) в уравнении шага = bondData`, numberAfter(h.equation, 'd(H–H) =') === bondLengthPm('H-H'), h.equation)
  ok(`[${locale}] E(H–H) в уравнении шага = bondData`, numberAfter(h.equation, 'E(H–H) =') === bondEnthalpyKJ('H-H'), h.equation)
  ok(`[${locale}] E(H–H) в тексте шага = bondData`, hasNumber(h.body, bondEnthalpyKJ('H-H')))
  // Шаг energy: каждая ступень цикла Гесса и итог — те же числа, что в лестнице ядра.
  const e = text.steps.energy
  for (const st of ZNCL2_LADDER.stages) ok(`[${locale}] ступень «${st.id}» ${st.dH} названа в тексте`, hasNumber(e.body, st.dH))
  ok(`[${locale}] ΔH в тексте = сумма цикла ${ZNCL2_LADDER.sumKJ}`, hasNumber(e.body, ZNCL2_LADDER.sumKJ) && hasNumber(e.equation, ZNCL2_LADDER.sumKJ))
  // Сборка H₂ = −2·ΔH°f(H, г): оговорка note сверяется с ядром (оба числа и их разность).
  const rec = ZNCL2_LADDER.stages.find((s) => s.id === 'recombination')!
  near(`[${locale}] сборка H₂ = −2·ΔH°f(H, г)`, rec.dH, -2 * dHfKJ('H(g)'), 1e-9)
  ok(`[${locale}] note называет E(H–H) из bondData`, hasNumber(e.note ?? '', bondEnthalpyKJ('H-H')))
  ok(`[${locale}] note называет расхождение ${Math.abs(rec.dH + bondEnthalpyKJ('H-H')).toFixed(1)}`, hasNumber(e.note ?? '', Math.abs(rec.dH + bondEnthalpyKJ('H-H'))))
  // Вода в легенде: O–H и угол — из ядра.
  ok(`[${locale}] O–H в легенде = bondData`, hasNumber(text.legend.water, bondLengthPm('O-H')))
  ok(`[${locale}] угол H–O–H в легенде = ядро`, hasNumber(text.legend.water, bondAngleDeg('water'), 0.001))
}

console.log(`test-zncl2-cinema: OK, проверок ${checks}`)
