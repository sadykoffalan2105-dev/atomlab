#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт урока «горение магния: 2 Mg (тв.) + O₂ (г.) → 2 MgO (тв.)».
 *
 * Сцена проверяется ДАННЫМИ, а не глазами: раскадровка — чистая функция
 * sampleMgoFrame(t), поэтому весь урок сэмплируется в Node.
 *
 * Что доказывает этот тест:
 *   • хронометраж: 6 шагов, 26–34 экранных секунды, cue'ы по возрастанию,
 *     контракт лаборатории embryo → birth → complete на месте;
 *   • раскадровка: дорожки монотонны, ни один видимый атом не прыгает
 *     больше чем на 0.09 ед. между кадрами 1/30 с;
 *   • химия: O₂ стартует МОЛЕКУЛОЙ с двойной связью 120,8 пм, магний стоит
 *     в ГПУ-решётке с КЧ 12, радиусы Mg 160→72 и O 66→140 пм меняются
 *     в момент перехода электронов, O²⁻ ≈ 1,94 · Mg²⁺;
 *   • решётка: 64 иона фрагмента 4×4×4, 144 ребра, КЧ 6, заряды чередуются,
 *     ячейка MgO МЕНЬШЕ ячейки NaCl при вдвое больших зарядах;
 *   • энергия: семь ступеней цикла Борна — Габера, сумма = табличная ΔH°f,
 *     EA₂ кислорода ЭНДОтермическая, решётка MgO прочнее решётки NaCl;
 *   • стехиометрия показанного уравнения и электронный/зарядовый баланс полуреакций;
 *   • тексты есть в ru / en / uz для каждого шага.
 *
 * Запуск: npx tsx scripts/test-mgo-cinema.mts
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
import { getCrystal } from '../src/chemistry/data/index.ts'
import {
  METAL_BONDS,
  MGO_ATOMS,
  MGO_COORDINATION_IDS,
  MGO_CUES,
  MGO_EDGES,
  MGO_END,
  MGO_GEOM,
  MGO_LABELS,
  MGO_SEGMENTS,
  MGO_STEPS,
  MGO_STEP_IDS,
  MGO_TIMING,
  createMgoFrame,
  sampleMgoFrame,
  validateMgoStoryboard,
  type MgoAtomId,
} from '../src/lab/cinema/scenes/mgo/mgoStoryboard.ts'
import {
  MGO_COST_BEFORE_LATTICE_KJ,
  MGO_DHF_KJ,
  MGO_DHF_TABLE_KJ,
  MGO_HALF_REACTIONS,
  MGO_LADDER,
  MGO_LATTICE_KJ,
  MGO_LATTICE_RATIO,
  MGO_REACTION,
  MGO_REACTION_DH_KJ,
  MGO_SECOND_EA_KJ,
  NACL_LATTICE_REF_KJ,
  validateMgoEnergetics,
} from '../src/lab/cinema/scenes/mgo/mgoEnergetics.ts'
import { getMgoMechanismText, type MgoLocale } from '../src/lab/cinema/scenes/mgo/mgoMechanismText.ts'
import { mgoScientificWatchdogMs } from '../src/lab/scientificSynthesis/mgoScenarioTiming.ts'

const LOCALES: MgoLocale[] = ['ru', 'en', 'uz']
const frame = createMgoFrame()
const at = (t: number) => sampleMgoFrame(t, frame)

let checks = 0
function ok(label: string, cond: boolean, detail = ''): void {
  assert.ok(cond, `${label}${detail ? ` — ${detail}` : ''}`)
  checks++
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Хронометраж и контракт лаборатории
// ─────────────────────────────────────────────────────────────────────────────

MGO_TIMING.validate()
ok('шагов 6 ± 1', MGO_STEPS.length >= 5 && MGO_STEPS.length <= 7, `${MGO_STEPS.length}`)
ok('id шагов совпадают', MGO_STEP_IDS.join(',') === MGO_STEPS.map((s) => s.id).join(','))

const wall = storyWallDuration(MGO_SEGMENTS)
ok('экранная длительность 26–34 с', wall >= 26 && wall <= 34, `${wall.toFixed(1)} с`)

let prevTo = 0
for (const s of MGO_STEPS) {
  ok(`шаг ${s.id} непрерывен`, s.from === prevTo && s.to > s.from)
  ok(`шаг ${s.id} имеет экранное время`, s.wall > 0)
  prevTo = s.to
}

let prevCue = -Infinity
for (const c of MGO_CUES) {
  ok(`cue ${c.id} внутри сюжета`, c.at >= 0 && c.at <= MGO_END, `${c.at}`)
  ok(`cue ${c.id} по возрастанию`, c.at >= prevCue)
  prevCue = c.at
}
const cueIndex = (id: string) => MGO_CUES.findIndex((c) => c.id === id)
ok(
  'контракт лаборатории embryo → birth → complete',
  cueIndex('embryo') < cueIndex('birth') && cueIndex('birth') < cueIndex('complete'),
)
ok('complete совпадает с концом сюжета', MGO_CUES[cueIndex('complete')]!.at === MGO_END)
ok('поджиг идёт после появления реагентов и до разрыва связи', MGO_TIMING.cueAt('ignite') > MGO_TIMING.cueAt('sublimate') && MGO_TIMING.cueAt('ignite') < MGO_TIMING.cueAt('bondBreak'))
ok('watchdog лаборатории положителен', mgoScientificWatchdogMs() > 0)

// каждый шаг обязан попасть в свой индекс
for (let i = 0; i < MGO_STEPS.length; i++) {
  const s = MGO_STEPS[i]!
  ok(`stepIndexAt(${s.id})`, MGO_TIMING.stepIndexAt((s.from + s.to) / 2) === i)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Раскадровка: дорожки и отсутствие рывков
// ─────────────────────────────────────────────────────────────────────────────

validateMgoStoryboard()

const scratch = createMgoFrame()
const buf = MGO_ATOMS.map((a) => ({ id: a.id as string, pos: new THREE.Vector3(), opacity: 0 }))
assertNoPositionJumps(
  (t) => {
    sampleMgoFrame(t, scratch)
    for (let i = 0; i < MGO_ATOMS.length; i++) {
      const id = MGO_ATOMS[i]!.id
      buf[i]!.pos.copy(scratch.atoms[id])
      buf[i]!.opacity = scratch.opacity[id]
    }
    return buf
  },
  MGO_END,
  0.09,
  1 / 30,
)
checks++

// Радиус и прозрачность тоже не должны щёлкать.
{
  let prev: Record<string, { r: number; o: number }> | null = null
  for (let t = 0; t <= MGO_END + 1e-9; t += 1 / 30) {
    at(t)
    const now: Record<string, { r: number; o: number }> = {}
    for (const a of MGO_ATOMS) now[a.id] = { r: frame.radius[a.id], o: frame.opacity[a.id] }
    if (prev) {
      for (const a of MGO_ATOMS) {
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
assertIonSizeOrder('Mg', 2)
assertIonSizeOrder('O', -2)
ok('Mg⁰ берётся металлическим радиусом 160 пм', speciesRadiusPm('Mg', 0) === 160)
ok('Mg²⁺ 72 пм (Shannon, КЧ 6)', speciesRadiusPm('Mg', 2) === 72)
ok('O⁰ берётся ковалентным радиусом 66 пм', speciesRadiusPm('O', 0) === 66)
ok('O²⁻ 140 пм (Shannon, КЧ 6)', speciesRadiusPm('O', -2) === 140)
ok(
  'ковалентный радиус согласован с половиной длины связи O=O',
  Math.abs(speciesRadiusPm('O', 0) - MGO_GEOM.data.ooPm / 2) < 6,
  `${speciesRadiusPm('O', 0)} против ${(MGO_GEOM.data.ooPm / 2).toFixed(1)}`,
)
const ratio = speciesRadiusPm('O', -2) / speciesRadiusPm('Mg', 2)
ok('O²⁻ примерно в 1.94 раза крупнее Mg²⁺', Math.abs(ratio - 1.94) < 0.03, ratio.toFixed(3))
ok('катион вдвое меньше своего атома', speciesRadiusPm('Mg', 2) < speciesRadiusPm('Mg', 0) / 2)
ok('подписи частиц', speciesLabel('Mg', 2) === 'Mg²⁺' && speciesLabel('O', -2) === 'O²⁻')

// 3.2 Старт: кислород — МОЛЕКУЛА с настоящей длиной двойной связи, магний — металл.
at(0.5)
const ooDist = frame.atoms.oA.distanceTo(frame.atoms.oB)
ok('на старте O₂ — молекула с длиной связи 120.8 пм', Math.abs(ooDist - MGO_GEOM.oHalf * 2) < 1e-6, ooDist.toFixed(4))
ok('связь O=O двойная и прочная (498 кДж/моль)', MGO_GEOM.data.ooKJ === 498)
ok('на старте связь O=O видна', frame.bond.opacity > 0.9)
ok('на старте магний имеет металлический радиус', Math.abs(frame.radius.mg1 - MGO_GEOM.radius.mg) < 1e-6)
ok('на старте у кислорода ковалентный радиус', Math.abs(frame.radius.oA - MGO_GEOM.radius.o) < 1e-6)
ok('на старте зарядов нет', frame.charge.mg1 === 0 && frame.charge.oA === 0)
ok('на старте металлический фрагмент виден', frame.opacity.M0 > 0.5)
ok('на старте кристалла ещё нет', frame.edges === 0 && frame.opacity.L0 === 0)
ok('на старте пламени ещё нет', frame.env.flame === 0)

// 3.3 Магний стартует В РЕШЁТКЕ металла: ГПУ, КЧ 12, соседи на 320 пм.
{
  const metal = getCrystal('mg_metal')!
  ok('справочная ГПУ-решётка магния', metal.latticeType === 'ГПУ' && metal.spaceGroup === 'P6₃/mmc')
  ok('КЧ магния в металле = 12', MGO_GEOM.data.metal.coordination === 12)
  ok('связей у центрального атома металла ровно 12', METAL_BONDS.length === 12)
  const scale = MGO_GEOM.cell / MGO_GEOM.data.cellPm
  for (const id of ['mg1', 'mg2'] as const) {
    const d = frame.atoms[id].distanceTo(frame.atoms.M0)
    ok(
      `${id} стоит в узле ГПУ на расстоянии ≈ 320 пм`,
      Math.abs(d / scale - MGO_GEOM.data.metal.nearestPm) < 6,
      `${(d / scale).toFixed(1)} пм`,
    )
  }
}

// 3.4 Связь O=O рвётся ГОМОЛИТИЧЕСКИ (split = 0 — пара делится поровну).
at(MGO_TIMING.cueAt('bondBreak') + 0.5)
ok('после разрыва связь O=O гаснет', frame.bond.opacity < 0.5)
ok('разрыв симметричный: оба атома кислорода нейтральны', frame.charge.oA === 0 && frame.charge.oB === 0)
ok('к моменту разрыва пламя уже горит', frame.env.flame > 0.5)

// 3.5 Радиусы меняются РОВНО тогда, когда электроны уходят / приходят.
at(MGO_TIMING.cueAt('transfer') - 2.8)
const mgBefore = frame.radius.mg1
const oBefore = frame.radius.oA
at(MGO_TIMING.cueAt('transfer') + 0.6)
ok('Mg сжался до иона', frame.radius.mg1 < mgBefore && Math.abs(frame.radius.mg1 - MGO_GEOM.radius.mgIon) < 1e-6)
ok('O вырос до иона', frame.radius.oA > oBefore && Math.abs(frame.radius.oA - MGO_GEOM.radius.oIon) < 1e-6)
ok('Mg²⁺ получил заряд +2', Math.abs(frame.charge.mg1 - 2) < 1e-6)
ok('O²⁻ получил заряд −2', Math.abs(frame.charge.oA + 2) < 1e-6)
ok('на экране O²⁻ крупнее Mg²⁺', frame.radius.oA > frame.radius.mg1 * 1.85)

// Электронов ровно четыре: по два с каждого атома магния, и второй уходит позже первого.
{
  const [e1a, e1b, e2a, e2b] = frame.electrons
  ok('в кадре четыре электрона', frame.electrons.length === 4)
  ok('разные идентификаторы электронов', new Set([e1a.id, e1b.id, e2a.id, e2b.id]).size === 4)
  at(9.5)
  ok('первый электрон магния уже в полёте, второй ещё нет', frame.electrons[0].progress > 0 && frame.electrons[1].progress === 0)
  at(11.0)
  ok('второй электрон магния летит позже первого', frame.electrons[1].progress > 0 && frame.electrons[1].progress < 1)
}

// 3.6 Ионная пара: ровно d(Mg²⁺–O²⁻) = 210.56 пм.
at(MGO_TIMING.cueAt('contact'))
{
  const d = frame.atoms.mg1.distanceTo(frame.atoms.oA)
  ok('ионная пара сошлась на 210.6 пм', Math.abs(d - MGO_GEOM.latticeMgO) < 1e-6, d.toFixed(4))
  ok('линии поля включены на шаге притяжения', frame.field > 0.4)
}

// 3.7 Решётка: чередование зарядов, КЧ 6, 144 ребра, 64 иона.
ok('64 иона фрагмента', MGO_ATOMS.filter((a) => !a.id.startsWith('M')).length === 64)
ok('11 атомов металлического фрагмента', MGO_ATOMS.filter((a) => a.id.startsWith('M')).length === 11)
ok('144 ребра Mg²⁺–O²⁻', MGO_EDGES.length === 144)
ok('КЧ(Mg²⁺) = 6', MGO_COORDINATION_IDS.length === 6)
ok('справочное КЧ из crystalData', MGO_GEOM.data.coordination['Mg²⁺'] === 6 && MGO_GEOM.data.coordination['O²⁻'] === 6)
ok('пространственная группа Fm-3m (225)', MGO_GEOM.data.spaceGroup === 'Fm-3m' && MGO_GEOM.data.spaceGroupNo === 225)
ok('ГЦК-подрешётки, структурный тип каменной соли', MGO_GEOM.data.latticeType === 'ГЦК' && MGO_GEOM.data.structureType.startsWith('NaCl'))
ok('a = 421.12 пм, d = 210.56 пм, Z = 4', MGO_GEOM.data.cellPm === 421.12 && MGO_GEOM.data.mgOPm === 210.56 && MGO_GEOM.data.z === 4)
ok('ребро ячейки = 4 · HALF', Math.abs(MGO_GEOM.cell - MGO_GEOM.half * 4) < 1e-9)
ok('t_пл MgO = 2852 °C (тугоплавкий оксид)', MGO_GEOM.data.meltingC === 2852)
{
  // Ячейка MgO МЕНЬШЕ ячейки NaCl, хотя заряды вдвое больше — это и даёт U в пять раз выше.
  const salt = getCrystal('nacl')!
  ok('ячейка MgO меньше ячейки NaCl', MGO_GEOM.data.cellPm < salt.cellPm.a, `${MGO_GEOM.data.cellPm} против ${salt.cellPm.a}`)
}

{
  const el = new Map(MGO_ATOMS.map((a) => [a.id as string, a.el]))
  for (const [a, b] of MGO_EDGES) ok(`соседи ${a}/${b} разноимённые`, el.get(a) !== el.get(b))
}

at(MGO_TIMING.cueAt('lattice') + 0.2)
{
  const ids = MGO_ATOMS.filter((a) => !a.id.startsWith('M')).map((a) => a.id as MgoAtomId)
  for (const id of ids) ok(`ион ${id} проявлен в решётке`, frame.opacity[id] > 0.85)
  let pairs = 0
  for (const [a, b] of MGO_EDGES) {
    const d = frame.atoms[a].distanceTo(frame.atoms[b])
    ok(`ребро ${a}–${b} = 210.6 пм`, Math.abs(d - MGO_GEOM.latticeMgO) < 2e-3, d.toFixed(4))
    pairs++
  }
  ok('проверены все рёбра', pairs === 144)
  ok('металлический фрагмент уже растворился', frame.opacity.M0 < 0.01)
}

// 3.8 Финал отдаёт кадр лаборатории.
at(MGO_END)
ok('в конце кадр затемнён', frame.env.fade > 0.95)
ok('в конце пламя погасло', frame.env.flame < 0.02)

// ─────────────────────────────────────────────────────────────────────────────
// 4. Энергетика
// ─────────────────────────────────────────────────────────────────────────────

validateMgoEnergetics()
ok('семь ступеней цикла', MGO_LADDER.stages.length === 7)
ok('сумма цикла ≈ табличная ΔH°f', Math.abs(MGO_LADDER.sumKJ - MGO_DHF_TABLE_KJ) < 5, `${MGO_LADDER.sumKJ} против ${MGO_DHF_TABLE_KJ}`)
ok('ΔH°f отрицательна (реакция экзотермическая)', MGO_DHF_KJ < 0, `${MGO_DHF_KJ} кДж/моль`)
ok('ΔH°f ≈ −601 кДж/моль', MGO_DHF_KJ === -601, `${MGO_DHF_KJ}`)
ok('тепловой эффект уравнения = 2 · ΔH°f', MGO_REACTION_DH_KJ === 2 * MGO_DHF_KJ)
ok('энергия решётки отрицательна и самая большая по модулю', MGO_LATTICE_KJ < 0 && MGO_LADDER.stages.every((s) => Math.abs(s.dH) <= Math.abs(MGO_LATTICE_KJ)))
ok('без решётки процесс был бы эндотермическим', MGO_COST_BEFORE_LATTICE_KJ > 0, `${MGO_COST_BEFORE_LATTICE_KJ} кДж/моль`)
ok('решётка MgO почти в 5 раз прочнее решётки NaCl', MGO_LATTICE_RATIO >= 4.5 && MGO_LATTICE_RATIO <= 5.0, `${MGO_LATTICE_RATIO}×`)
ok('справочная U(NaCl) отрицательна', NACL_LATTICE_REF_KJ < 0)

{
  const byId = new Map(MGO_LADDER.stages.map((s) => [s.id, s.dH]))
  ok('ΔH_суб(Mg) > 0', byId.get('sublimation')! > 0)
  ok('½D(O=O) > 0', byId.get('dissociation')! > 0)
  ok('IE₁ > 0', byId.get('ionization1')! > 0)
  ok('IE₂ > 0 и больше IE₁', byId.get('ionization2')! > byId.get('ionization1')!)
  ok('EA₁(O) < 0 — первый электрон принимается с выигрышем', byId.get('affinity1')! < 0)
  ok('EA₂(O) > 0 — второй электрон принимается С ЗАТРАТОЙ', byId.get('affinity2')! > 0, `${byId.get('affinity2')}`)
  ok('EA₂ совпадает с ядром данных (OXIDE_SECOND_EA_KJ)', byId.get('affinity2')! === MGO_SECOND_EA_KJ)
  ok('U_реш < 0', byId.get('lattice')! < 0)
}

{
  const levels = ladderLevels(MGO_LADDER)
  ok('лестница начинается с нуля', levels[0] === 0)
  ok('последний уровень = сумма цикла', Math.abs(levels[levels.length - 1]! - MGO_LADDER.sumKJ) < 1e-6)
  ok('ступени идут по времени сюжета', MGO_LADDER.stages.every((s, i) => i === 0 || s.at >= MGO_LADDER.stages[i - 1]!.at))
  ok('все ступени попадают в сюжет', MGO_LADDER.stages.every((s) => s.at >= 0 && s.at <= MGO_END))
  ok('перед решёткой лестница высоко вверху', Math.max(...levels) > 3000, `${Math.max(...levels).toFixed(0)} кДж/моль`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Стехиометрия и электронный баланс
// ─────────────────────────────────────────────────────────────────────────────

/** Считает атомы в формуле вида «MgO», «O2», «H2O» (без скобок). */
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
  for (const t of MGO_REACTION.left) countAtoms(t.formula, t.coeff, left)
  for (const t of MGO_REACTION.right) countAtoms(t.formula, t.coeff, right)
  const keys = new Set([...left.keys(), ...right.keys()])
  for (const k of keys) ok(`баланс по ${k}`, left.get(k) === right.get(k), `${left.get(k)} ≠ ${right.get(k)}`)
  ok('слева есть двухатомный O₂', MGO_REACTION.left.some((t) => t.formula === 'O2'))
  ok('слева нет одиночных атомов кислорода', !MGO_REACTION.left.some((t) => t.formula === 'O'))
  ok('магний слева взят с коэффициентом 2', MGO_REACTION.left.find((t) => t.formula === 'Mg')!.coeff === 2)
}

{
  const given = MGO_HALF_REACTIONS.filter((h) => h.id === 'oxidation').reduce((s, h) => s + h.electrons * h.times, 0)
  const taken = MGO_HALF_REACTIONS.filter((h) => h.id === 'reduction').reduce((s, h) => s + h.electrons * h.times, 0)
  ok('электронный баланс полуреакций', given === taken && given === 4, `отдано ${given}, принято ${taken}`)
  const chargeLeft = MGO_HALF_REACTIONS.reduce((s, h) => s + h.chargeLeft * h.times, 0)
  const chargeRight = MGO_HALF_REACTIONS.reduce((s, h) => s + h.chargeRight * h.times, 0)
  ok('зарядовый баланс суммарного уравнения', chargeLeft === 0 && chargeRight === 0)
  for (const h of MGO_HALF_REACTIONS) {
    ok(`полуреакция ${h.id} без выдуманных частиц`, !/O²⁻²|Mg³⁺|O₂²⁻ →/.test(h.equation))
  }
  ok('окисление магния — ровно два электрона', MGO_HALF_REACTIONS.find((h) => h.id === 'oxidation')!.electrons === 2)
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Подписи в 3D и тексты ru / en / uz
// ─────────────────────────────────────────────────────────────────────────────

{
  const o2 = MGO_LABELS.find((l) => l.id === 'o2')!
  ok('подпись O₂ видна до разрыва связи', o2.windows[0]![1] <= MGO_TIMING.cueAt('bondBreak'))
  const oA = MGO_LABELS.find((l) => l.id === 'oA')!
  ok('подпись отдельного O появляется только после разрыва', oA.windows[0]![0] >= MGO_TIMING.cueAt('bondBreak'))
  const mgIon = MGO_LABELS.find((l) => l.id === 'mg1')!
  ok(
    'подпись Mg становится Mg²⁺ после перехода электронов',
    mgIon.keys.some((k) => k.text === 'Mg²⁺' && k.t >= MGO_TIMING.cueAt('transfer') - 0.5),
  )
  const oxO = MGO_LABELS.find((l) => l.id === 'oxOA')!
  ok('степень окисления кислорода становится −2', oxO.keys.some((k) => k.text === '−2'))
  ok('нет выдуманных частиц в подписях', MGO_LABELS.every((l) => l.keys.every((k) => !/Mg⁺⁺|O⁻⁻|Mg³⁺/.test(k.text))))
  for (const l of MGO_LABELS) {
    for (const w of l.windows) ok(`окно подписи ${l.id} корректно`, w[0] < w[1] && w[0] >= 0 && w[1] <= MGO_END + 1e-9)
  }

  // Подписи локализуются: раскадровка пишет токены, сцена подставляет язык.
  const known = new Set(Object.keys(SCENE_LABEL_TOKENS.ru))
  for (const token of labelTokensUsed(MGO_LABELS)) {
    ok(`токен подписи {${token}} есть в словаре кита`, known.has(token))
  }
  // Единицы и состояния НЕ зашиты по-английски мимо токенов.
  for (const l of MGO_LABELS) {
    for (const k of l.keys) {
      const bare = k.text.replace(/\{\w+\}/g, '')
      ok(
        `подпись ${l.id} без зашитой английской единицы: «${k.text}»`,
        !/\b(pm|kJ\/mol|kJ)\b/.test(bare) && !/\((s|g|l|aq)\)/.test(bare),
      )
    }
  }
  for (const locale of LOCALES) {
    const states = createLabelStates(MGO_LABELS)
    localizeSceneLabels(states, locale)
    for (const st of states) {
      ok(`[${locale}] подпись ${st.id} без нераскрытых токенов: «${st.text}»`, !/\{\w+\}/.test(st.text))
      ok(`[${locale}] подпись ${st.id} непустая`, st.text.trim().length > 0)
    }
  }
  const ru = createLabelStates(MGO_LABELS)
  const en = createLabelStates(MGO_LABELS)
  localizeSceneLabels(ru, 'ru')
  localizeSceneLabels(en, 'en')
  ok(
    'подписи ru отличаются от en (состояния и единицы переведены)',
    ru.some((s, i) => s.text !== en[i]!.text),
  )
  const ruCell = ru.find((s) => s.id === 'cell')!.text
  ok(`подпись ячейки по-русски в пикометрах: «${ruCell}»`, ruCell.includes('пм') && !ruCell.includes('pm'))

  // Подписи над кубом и под кубом не должны налезать друг на друга.
  const cell = MGO_LABELS.find((l) => l.id === 'cell')!
  const coord = MGO_LABELS.find((l) => l.id === 'coord')!
  ok(`подписи «a = …» и КЧ разведены по высоте (Δ=${(cell.dy - coord.dy).toFixed(2)})`, Math.abs(cell.dy - coord.dy) >= 0.5)
  const mgo = MGO_LABELS.find((l) => l.id === 'mgo')!
  const ulat = MGO_LABELS.find((l) => l.id === 'ulat')!
  ok(`подписи MgO и U разведены по высоте (Δ=${(mgo.dy - ulat.dy).toFixed(2)})`, Math.abs(mgo.dy - ulat.dy) >= 0.5)
  const dH = MGO_LABELS.find((l) => l.id === 'dH')!
  ok(
    'подписи U и ΔH°f стоят в одном месте, но не одновременно',
    ulat.windows[0]![1] <= dH.windows[0]![0],
    `${ulat.windows[0]![1]} ≤ ${dH.windows[0]![0]}`,
  )
}

for (const locale of LOCALES) {
  const text = getMgoMechanismText(locale)
  ok(`[${locale}] есть заголовок урока`, text.intro.title.length > 0)
  ok(`[${locale}] есть предупреждение о безопасности`, text.safety.length > 20)
  for (const id of MGO_STEP_IDS) {
    const s = text.steps[id]
    ok(`[${locale}] шаг ${id}: заголовок`, !!s && s.title.trim().length > 0)
    ok(`[${locale}] шаг ${id}: 2–4 предложения`, s.body.split(/[.!?]\s/).length >= 2, `${s.body.length} симв.`)
    ok(`[${locale}] шаг ${id}: уравнение`, s.equation.trim().length > 0)
    ok(`[${locale}] шаг ${id}: реплика`, s.speak.trim().length > 0)
  }
  ok(`[${locale}] честная пометка есть хотя бы у половины шагов`, MGO_STEP_IDS.filter((id) => text.steps[id].note).length >= 3)
  for (const s of MGO_LADDER.stages) {
    ok(`[${locale}] подпись ступени ${s.id}`, (text.energy.stages as Record<string, string>)[s.id]?.length > 0)
  }
  ok(`[${locale}] единица энергии`, text.energy.unit.length > 0)
  ok(`[${locale}] итоговая строка лестницы`, text.energy.stages.total.length > 0)
  ok(`[${locale}] aria-подпись лестницы`, text.energy.summary.includes('{dH}'))
  ok(`[${locale}] нет выдуманных частиц в текстах`, !/Mg³⁺|O³⁻/.test(JSON.stringify(text)))
  // Ключевые для урока факты обязаны быть в тексте на каждом языке.
  ok(`[${locale}] сказано про два электрона`, /2e⁻/.test(text.steps.transfer.equation))
  ok(`[${locale}] сказано про эндотермическую EA₂`, /744/.test(text.steps.transfer.body))
  ok(`[${locale}] сказано про 2852`, /2852/.test(text.steps.lattice.body))
  ok(`[${locale}] предупреждение про пламя`, text.steps.ignition.note!.length > 20)
}

console.log(`✓ mgo cinema: ${checks} проверок пройдено`)
console.log(`  шагов ${MGO_STEPS.length}, экранное время ${wall.toFixed(1)} с, сюжет ${MGO_END} с`)
console.log(`  цикл Борна — Габера: Σ = ${MGO_LADDER.sumKJ} кДж/моль (таблица ${MGO_DHF_TABLE_KJ}), EA₂ = +${MGO_SECOND_EA_KJ}`)
console.log(
  `  радиусы: Mg ${speciesRadiusPm('Mg', 0)} → Mg²⁺ ${speciesRadiusPm('Mg', 2)} пм, ` +
    `O ${speciesRadiusPm('O', 0)} → O²⁻ ${speciesRadiusPm('O', -2)} пм (O²⁻ / Mg²⁺ = ${ratio.toFixed(2)})`,
)
console.log(`  решётка: a = ${MGO_GEOM.data.cellPm} пм, d = ${MGO_GEOM.data.mgOPm} пм, U = ${MGO_LATTICE_KJ} (в ${MGO_LATTICE_RATIO} раза прочнее NaCl)`)
