#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт урока «смесь или соединение: Fe (тв.) + S (тв.) → FeS (тв.)».
 *
 * Сцена проверяется ДАННЫМИ, а не глазами: раскадровка — чистая функция
 * sampleFesFrame(t), поэтому весь урок сэмплируется в Node.
 *
 * Что доказывает этот тест:
 *   • хронометраж: 6 шагов, 26–34 экранных секунды, cue'ы по возрастанию,
 *     контракт лаборатории embryo → birth → complete на месте;
 *   • раскадровка: дорожки монотонны, ни один видимый атом не прыгает
 *     больше чем на 0.09 ед. между кадрами 1/30 с;
 *   • химия: сера стартует КОРОНОЙ S₈ (8 атомов, 8 связей, d и угол из
 *     справочника), железо — ОЦК-фрагментом с КЧ 8; радиусы Fe 126→78 пм
 *     и S 105→184 пм меняются ровно при переходе электронов; S²⁻ ≈ 2,36 · Fe²⁺;
 *   • решётка: тип NiAs, КЧ(Fe²⁺) = 6 (октаэдр из S²⁻), сорта чередуются,
 *     нарисованное d(Fe–S) не расходится с троилитом больше чем на 1,5 %;
 *   • энергия: сумма лестницы Гесса = табличная ΔH°f(FeS) = −100,0 кДж/моль,
 *     знаки физичны, выигрыш больше затрат (иначе смесь не горела бы сама);
 *   • стехиометрия показанных уравнений (реакция и проба на H₂S) и
 *     электронный/зарядовый баланс полуреакций;
 *   • опыт «магнит»: железо на шаге 1 поднимается, кристалл на шаге 5 — нет;
 *   • тексты есть в ru / en / uz для каждого шага, подписи локализуются.
 *
 * Запуск: npx tsx scripts/test-fes-cinema.mts
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
import { assertIonSizeOrder, speciesRadiusPm, SPECIES_SCALE } from '../src/lab/cinema/scenes/kit/cpkAtoms.ts'
import { ladderLevels } from '../src/lab/cinema/scenes/kit/energyLadderData.ts'
import {
  FES_ATOMS,
  FES_COORDINATION_IDS,
  FES_CUES,
  FES_EDGES,
  FES_END,
  FES_GEOM,
  FES_LABELS,
  FES_SEGMENTS,
  FES_SLAB_SIZE,
  FES_STEPS,
  FES_STEP_IDS,
  FES_TIMING,
  IRON_ATOMS,
  IRON_BONDS,
  RING_BONDS,
  RING_ORDER,
  createFesFrame,
  sampleFesFrame,
  validateFesStoryboard,
  type FesAtomId,
} from '../src/lab/cinema/scenes/fes/fesStoryboard.ts'
import {
  FES_ACID_TEST,
  FES_ATOM_FE_KJ,
  FES_ATOM_S_KJ,
  FES_COST_KJ,
  FES_CRYSTAL,
  FES_CRYSTAL_KJ,
  FES_DHF_KJ,
  FES_DHF_TABLE_KJ,
  FES_HALF_REACTIONS,
  FES_LADDER,
  FES_REACTION,
  validateFesEnergetics,
} from '../src/lab/cinema/scenes/fes/fesEnergetics.ts'
import { getFesMechanismText, type FesLocale } from '../src/lab/cinema/scenes/fes/fesMechanismText.ts'

const LOCALES: FesLocale[] = ['ru', 'en', 'uz']
const frame = createFesFrame()
const at = (t: number) => sampleFesFrame(t, frame)

let checks = 0
function ok(label: string, cond: boolean, detail = ''): void {
  assert.ok(cond, `${label}${detail ? ` — ${detail}` : ''}`)
  checks++
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Хронометраж и контракт лаборатории
// ─────────────────────────────────────────────────────────────────────────────

FES_TIMING.validate()
ok('шагов 6 ± 1', FES_STEPS.length >= 5 && FES_STEPS.length <= 7, `${FES_STEPS.length}`)
ok('id шагов совпадают', FES_STEP_IDS.join(',') === FES_STEPS.map((s) => s.id).join(','))

let prevTo = 0
for (const s of FES_STEPS) {
  ok(`шаг «${s.id}» продолжает предыдущий`, s.from === prevTo, `from=${s.from}, ожидалось ${prevTo}`)
  ok(`шаг «${s.id}»: to > from`, s.to > s.from)
  ok(`шаг «${s.id}»: wall > 0`, s.wall > 0)
  prevTo = s.to
}

const wall = storyWallDuration(FES_SEGMENTS)
ok('экранная длительность 26–34 с', wall >= 26 && wall <= 34, `${wall.toFixed(1)} с`)
ok('wallDuration совпадает с сегментами', Math.abs(FES_TIMING.wallDuration - wall) < 1e-9)

let lastCue = -Infinity
for (const c of FES_CUES) {
  ok(`событие «${c.id}» внутри сюжета`, c.at >= 0 && c.at <= FES_END, `${c.at} вне [0, ${FES_END}]`)
  ok(`события по возрастанию: «${c.id}»`, c.at >= lastCue)
  lastCue = c.at
}
const cueIds = FES_CUES.map((c) => c.id)
for (const id of ['embryo', 'birth', 'complete'] as const) {
  ok(`контракт лаборатории: есть «${id}»`, cueIds.includes(id))
}
ok(
  'порядок embryo → birth → complete',
  cueIds.indexOf('embryo') < cueIds.indexOf('birth') && cueIds.indexOf('birth') < cueIds.indexOf('complete'),
)
ok('сюжетные события урока на месте', ['magnet', 'separate', 'ignite', 'transfer', 'lattice', 'magnetFail', 'exo'].every((id) => cueIds.includes(id as never)))

// ─────────────────────────────────────────────────────────────────────────────
// 2. Раскадровка: дорожки и плавность
// ─────────────────────────────────────────────────────────────────────────────

validateFesStoryboard()
checks++

const parts = FES_ATOMS.map((a) => ({ id: a.id, pos: new THREE.Vector3(), opacity: 0 }))
assertNoPositionJumps((t) => {
  at(t)
  for (const p of parts) {
    p.pos.copy(frame.atoms[p.id])
    p.opacity = frame.opacity[p.id]
  }
  return parts
}, FES_END)
checks++

// Кадр обязан быть конечным в каждый момент сюжета.
for (let t = 0; t <= FES_END + 1e-9; t += 1 / 30) {
  at(t)
  for (const a of FES_ATOMS) {
    const p = frame.atoms[a.id]
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      assert.fail(`fes: «${a.id}» без координат при t=${t.toFixed(2)}`)
    }
    if (!(frame.radius[a.id] > 0)) assert.fail(`fes: «${a.id}» без радиуса при t=${t.toFixed(2)}`)
    if (frame.opacity[a.id] < -1e-6 || frame.opacity[a.id] > 1 + 1e-6) {
      assert.fail(`fes: «${a.id}» с прозрачностью ${frame.opacity[a.id]} при t=${t.toFixed(2)}`)
    }
    checks += 3
  }
  if (!(frame.camera.zoom > 0)) assert.fail(`fes: зум ${frame.camera.zoom} при t=${t.toFixed(2)}`)
  checks++
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Исходные вещества: железо ОЦК и КОРОНА S₈
// ─────────────────────────────────────────────────────────────────────────────

const pmOf = (scene: number) => (scene / FES_GEOM.feSPair) * FES_CRYSTAL.cationAnionPm
/** Шары рисуются долей SPECIES_SCALE от настоящего радиуса — возвращаем настоящий. */
const radiusPm = (scene: number) => pmOf(scene) / SPECIES_SCALE

at(1.0)
ok('сера стартует короной S₈: восемь атомов', RING_ORDER.length === 8, `${RING_ORDER.length}`)
ok('корона замкнута: восемь связей S–S', RING_BONDS.length === 8, `${RING_BONDS.length}`)
ok('в короне нет ни одного атома железа', RING_ORDER.every((id) => FES_ATOMS.find((a) => a.id === id)!.el === 'S'))
for (const [a, b] of RING_BONDS) {
  const d = pmOf(frame.atoms[a].distanceTo(frame.atoms[b]))
  ok(`связь S–S короны ${a}–${b}`, Math.abs(d - FES_GEOM.data.s8.bondPm) < 0.5, `${d.toFixed(1)} пм вместо ${FES_GEOM.data.s8.bondPm}`)
}
// Угол S–S–S короны: считаем прямо по нарисованным точкам.
for (let k = 0; k < 8; k++) {
  const prev = frame.atoms[RING_ORDER[(k + 7) % 8]!]
  const cur = frame.atoms[RING_ORDER[k]!]
  const next = frame.atoms[RING_ORDER[(k + 1) % 8]!]
  const v1 = new THREE.Vector3().subVectors(prev, cur).normalize()
  const v2 = new THREE.Vector3().subVectors(next, cur).normalize()
  const deg = (Math.acos(Math.max(-1, Math.min(1, v1.dot(v2)))) * 180) / Math.PI
  ok(`угол S–S–S у атома ${k}`, Math.abs(deg - FES_GEOM.data.s8.angleDeg) < 0.5, `${deg.toFixed(1)}° вместо ${FES_GEOM.data.s8.angleDeg}°`)
}
ok('корона гофрированная (D4d), а не плоское кольцо', FES_GEOM.data.s8.puckerPm > 20, `гофр ${FES_GEOM.data.s8.puckerPm.toFixed(1)} пм`)

ok('железо — фрагмент ОЦК с КЧ 8', IRON_BONDS.length === 8, `${IRON_BONDS.length}`)
ok('в ОЦК-фрагменте 8 атомов кроме героя', IRON_ATOMS.length === 8, `${IRON_ATOMS.length}`)
for (const [a, b] of IRON_BONDS) {
  const d = pmOf(frame.atoms[a].distanceTo(frame.atoms[b]))
  ok(`d(Fe–Fe) в ОЦК ${a}–${b}`, Math.abs(d - FES_GEOM.data.metal.nearestPm) < 1.0, `${d.toFixed(1)} пм вместо ${FES_GEOM.data.metal.nearestPm}`)
}
ok('в металле нет ни одного атома серы', IRON_ATOMS.every((m) => FES_ATOMS.find((a) => a.id === m.id)!.el === 'Fe'))
ok('решётка железа — ОЦК Im-3m', FES_GEOM.data.metal.spaceGroup === 'Im-3m', FES_GEOM.data.metal.spaceGroup)

// ─────────────────────────────────────────────────────────────────────────────
// 4. Опыт с магнитом: смесь разделяется, соединение — нет
// ─────────────────────────────────────────────────────────────────────────────

at(0.5)
const ironY0 = frame.atoms[IRON_ATOMS[0]!.id].y
const sulfurY0 = frame.atoms[RING_ORDER[0] === 's1' ? RING_ORDER[1]! : RING_ORDER[0]!].y
at(FES_TIMING.cueAt('separate'))
const ironY1 = frame.atoms[IRON_ATOMS[0]!.id].y
const sulfurY1 = frame.atoms[RING_ORDER[0] === 's1' ? RING_ORDER[1]! : RING_ORDER[0]!].y
ok('шаг 1: магнит поднимает железо', ironY1 - ironY0 > 0.2, `подъём ${(ironY1 - ironY0).toFixed(2)} ед.`)
ok('шаг 1: сера остаётся на месте', Math.abs(sulfurY1 - sulfurY0) < 1e-6, `сместилась на ${(sulfurY1 - sulfurY0).toFixed(3)}`)
ok('шаг 1: магнит виден', frame.magnet.opacity > 0.5, `${frame.magnet.opacity.toFixed(2)}`)

const tFail = FES_TIMING.cueAt('magnetFail')
at(tFail - 1.2)
const crystalBefore = frame.atoms.fe1.clone()
at(tFail)
ok('шаг 5: магнит снова в кадре', frame.magnet.opacity > 0.5, `${frame.magnet.opacity.toFixed(2)}`)
ok('шаг 5: магнит помечен как бессильный', frame.magnet.fail > 0.3, `${frame.magnet.fail.toFixed(2)}`)
ok('шаг 5: кристалл НЕ сдвинулся', frame.atoms.fe1.distanceTo(crystalBefore) < 1e-6)
at(tFail + 1.0)
ok('шаг 5: кристалл стоит и дальше', frame.atoms.fe1.distanceTo(crystalBefore) < 1e-6)

// ─────────────────────────────────────────────────────────────────────────────
// 5. Переход электронов: радиусы и заряды
// ─────────────────────────────────────────────────────────────────────────────

assertIonSizeOrder('Fe', 2)
assertIonSizeOrder('S', -2)
checks += 2

const rFe0 = speciesRadiusPm('Fe', 0)
const rFe2 = speciesRadiusPm('Fe', 2)
const rS0 = speciesRadiusPm('S', 0)
const rS2 = speciesRadiusPm('S', -2)
ok('Fe⁰ = 126 пм (металлический)', rFe0 === 126, `${rFe0}`)
ok('Fe²⁺ = 78 пм (Shannon, высокоспиновый)', rFe2 === 78, `${rFe2}`)
ok('S⁰ = 105 пм (ковалентный)', rS0 === 105, `${rS0}`)
ok('S²⁻ = 184 пм (Shannon)', rS2 === 184, `${rS2}`)
const ratio = rS2 / rFe2
ok('S²⁻ / Fe²⁺ ≈ 2,36', ratio > 2.2 && ratio < 2.5, ratio.toFixed(2))

const tTransfer = FES_TIMING.cueAt('transfer')
at(8.5)
const feBefore = frame.radius.fe1
const sBefore = frame.radius.s1
ok('до перехода железо — АТОМ', Math.abs(radiusPm(feBefore) - rFe0) < 1, `${radiusPm(feBefore).toFixed(1)} пм`)
ok('до перехода сера — АТОМ', Math.abs(radiusPm(sBefore) - rS0) < 1, `${radiusPm(sBefore).toFixed(1)} пм`)
ok('до перехода заряды нулевые', Math.abs(frame.charge.fe1) < 1e-6 && Math.abs(frame.charge.s1) < 1e-6)

at(tTransfer + 1.0)
ok('после перехода железо — КАТИОН Fe²⁺', Math.abs(radiusPm(frame.radius.fe1) - rFe2) < 1, `${radiusPm(frame.radius.fe1).toFixed(1)} пм`)
ok('после перехода сера — АНИОН S²⁻', Math.abs(radiusPm(frame.radius.s1) - rS2) < 1, `${radiusPm(frame.radius.s1).toFixed(1)} пм`)
ok('заряд железа +2', Math.abs(frame.charge.fe1 - 2) < 1e-6, `${frame.charge.fe1}`)
ok('заряд серы −2', Math.abs(frame.charge.s1 + 2) < 1e-6, `${frame.charge.s1}`)
ok('катион на экране меньше своего атома', frame.radius.fe1 < feBefore)
ok('анион на экране больше своего атома', frame.radius.s1 > sBefore)

// Радиус меняется МОНОТОННО и ровно в окне перехода, а не рывком.
let prevFe = Infinity
let prevS = -Infinity
for (let t = 8.5; t <= tTransfer + 1.2; t += 1 / 30) {
  at(t)
  ok('радиус Fe только убывает', frame.radius.fe1 <= prevFe + 1e-9)
  ok('радиус S только растёт', frame.radius.s1 >= prevS - 1e-9)
  prevFe = frame.radius.fe1
  prevS = frame.radius.s1
}

// Электроны: их ровно два и оба доходят до серы.
at(FES_TIMING.cueAt('transfer') + 0.05)
ok('электронов ровно два', frame.electrons.length === 2)
for (const e of frame.electrons) {
  ok(`электрон «${e.id}» дошёл до акцептора`, e.progress > 0.9, `progress=${e.progress.toFixed(2)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Решётка типа NiAs
// ─────────────────────────────────────────────────────────────────────────────

ok('продукт — троилит, тип NiAs', FES_CRYSTAL.structureType.includes('NiAs'), FES_CRYSTAL.structureType)
ok('пространственная группа P-62c (190)', FES_CRYSTAL.spaceGroup === 'P-62c' && FES_CRYSTAL.spaceGroupNo === 190)
ok('решётка гексагональная', FES_CRYSTAL.latticeType === 'гексагональная', FES_CRYSTAL.latticeType)
ok('КЧ 6/6 в справочнике', Object.values(FES_CRYSTAL.coordination).every((n) => n === 6))
ok('КЧ(Fe²⁺) на экране = 6', FES_COORDINATION_IDS.length === 6, `${FES_COORDINATION_IDS.length}`)
ok('октаэдр вокруг Fe²⁺ собран только из серы', FES_COORDINATION_IDS.every((id) => FES_ATOMS.find((a) => a.id === id)!.el === 'S'))
ok('фрагмент решётки не пустой', FES_SLAB_SIZE >= 24, `${FES_SLAB_SIZE} ионов`)
ok('рёбра решётки найдены', FES_EDGES.length > 0, `${FES_EDGES.length}`)

const elById = new Map<FesAtomId, 'Fe' | 'S'>(FES_ATOMS.map((a) => [a.id, a.el]))
for (const [a, b] of FES_EDGES) {
  ok(`ребро ${a}–${b} соединяет разные сорта`, elById.get(a) !== elById.get(b))
}
ok(
  'нарисованное d(Fe–S) близко к троилиту',
  Math.abs(FES_GEOM.data.feSIdealPm - FES_CRYSTAL.cationAnionPm) / FES_CRYSTAL.cationAnionPm < 0.015,
  `${FES_GEOM.data.feSIdealPm.toFixed(1)} пм против ${FES_CRYSTAL.cationAnionPm}`,
)
ok(
  'подъячейка NiAs получена из троилита: a = a₀/√3',
  Math.abs(FES_GEOM.data.subCellPm.a * Math.sqrt(3) - FES_CRYSTAL.cellPm.a) < 1e-6,
)
ok(
  'подъячейка NiAs получена из троилита: c = c₀/2',
  Math.abs(FES_GEOM.data.subCellPm.c * 2 - (FES_CRYSTAL.cellPm.c ?? 0)) < 1e-6,
)

// Готовый кристалл: расстояния между соседями стабильны, ионы разошлись по местам.
at(FES_TIMING.cueAt('lattice') + 1.0)
for (const [a, b] of FES_EDGES) {
  const d = pmOf(frame.atoms[a].distanceTo(frame.atoms[b]))
  ok(`в собранном фрагменте ребро ${a}–${b}`, Math.abs(d - FES_GEOM.data.feSIdealPm) < 1.0, `${d.toFixed(1)} пм`)
}
// Одноимённые ионы нигде не оказываются ближе, чем разноимённые.
const lattice = FES_ATOMS.filter((a) => frame.opacity[a.id] > 0.9 && a.id !== 'fe1' && a.id !== 's1')
let minSame = Infinity
for (let i = 0; i < lattice.length; i++) {
  for (let j = i + 1; j < lattice.length; j++) {
    if (lattice[i]!.el !== lattice[j]!.el) continue
    minSame = Math.min(minSame, frame.atoms[lattice[i]!.id].distanceTo(frame.atoms[lattice[j]!.id]))
  }
}
ok(
  'ближайший сосед иона — всегда противоион',
  minSame > FES_GEOM.feSIdeal + 1e-6,
  `минимум ${pmOf(minSame).toFixed(1)} пм против d(Fe–S) ${FES_GEOM.data.feSIdealPm.toFixed(1)} пм`,
)

// НО: шахматного правила каменной соли в типе NiAs нет. Октаэдры FeS₆ делят
// грани, поэтому железо стоит КОЛОНКАМИ вдоль оси c с шагом c_sub/2. Это не
// артефакт раскадровки, а определяющая черта структурного типа — сцена и текст
// урока обязаны говорить об этом одно и то же.
ok(
  'Fe–Fe колонки выведены из ячейки троилита: c₀/4',
  Math.abs(FES_GEOM.data.feFeColumnPm * 4 - (FES_CRYSTAL.cellPm.c ?? 0)) < 1e-6,
  `${FES_GEOM.data.feFeColumnPm.toFixed(2)} пм`,
)
const ironSites = lattice.filter((a) => a.el === 'Fe')
let minFeFe = Infinity
for (let i = 0; i < ironSites.length; i++) {
  for (let j = i + 1; j < ironSites.length; j++) {
    minFeFe = Math.min(minFeFe, frame.atoms[ironSites[i]!.id].distanceTo(frame.atoms[ironSites[j]!.id]))
  }
}
ok(
  'в кадре действительно есть прямые контакты Fe–Fe вдоль оси c',
  Math.abs(pmOf(minFeFe) - FES_GEOM.data.feFeColumnPm) < 1.0,
  `${pmOf(minFeFe).toFixed(1)} пм против c_sub/2 = ${FES_GEOM.data.feFeColumnPm.toFixed(1)} пм`,
)
ok(
  'контакт Fe–Fe дальше связи Fe–S, но ближе второй координационной сферы NaCl',
  pmOf(minFeFe) > FES_GEOM.data.feSIdealPm && pmOf(minFeFe) < FES_GEOM.data.feSIdealPm * Math.SQRT2,
  `${pmOf(minFeFe).toFixed(1)} пм`,
)

// Ионная пара шага 4 стоит ровно на справочном расстоянии.
at(14.5)
const pairPm = pmOf(frame.atoms.fe1.distanceTo(frame.atoms.s1))
ok('ионная пара на d(Fe²⁺–S²⁻) из справочника', Math.abs(pairPm - FES_CRYSTAL.cationAnionPm) < 0.2, `${pairPm.toFixed(1)} пм`)

// ─────────────────────────────────────────────────────────────────────────────
// 7. Энергия: лестница Гесса
// ─────────────────────────────────────────────────────────────────────────────

validateFesEnergetics()
checks++

ok('ступеней в лестнице три', FES_LADDER.stages.length === 3, `${FES_LADDER.stages.length}`)
ok('табличная ΔH°f(FeS) = −100,0', FES_DHF_TABLE_KJ === -100, `${FES_DHF_TABLE_KJ}`)
ok('сумма лестницы = табличная ΔH°f', Math.abs(FES_LADDER.sumKJ - FES_DHF_TABLE_KJ) < 0.5, `${FES_LADDER.sumKJ}`)
ok('подпись ΔH°f округлена до −100', FES_DHF_KJ === -100, `${FES_DHF_KJ}`)
ok('атомизация железа > 0', FES_ATOM_FE_KJ > 0, `${FES_ATOM_FE_KJ}`)
ok('атомизация серы > 0', FES_ATOM_S_KJ > 0, `${FES_ATOM_S_KJ}`)
ok('сборка кристалла < 0', FES_CRYSTAL_KJ < 0, `${FES_CRYSTAL_KJ}`)
ok('затраты = сумма двух атомизаций', Math.abs(FES_COST_KJ - (FES_ATOM_FE_KJ + FES_ATOM_S_KJ)) < 1e-9)
ok('выигрыш больше затрат — реакция идёт сама', Math.abs(FES_CRYSTAL_KJ) > FES_COST_KJ)
ok('реакция экзотермическая', FES_LADDER.sumKJ < 0)

const levels = ladderLevels(FES_LADDER)
ok('уровней на один больше, чем ступеней', levels.length === FES_LADDER.stages.length + 1)
ok('лестница стартует с нуля', levels[0] === 0)
ok('последний уровень = ΔH°f', Math.abs(levels[levels.length - 1]! - FES_LADDER.sumKJ) < 1e-9)
ok('максимум лестницы — после двух атомизаций', Math.max(...levels) === levels[2])

let lastAt = -Infinity
for (const s of FES_LADDER.stages) {
  ok(`ступень «${s.id}» внутри сюжета`, s.at >= 0 && s.at <= FES_END, `${s.at}`)
  ok(`ступени идут по времени: «${s.id}»`, s.at >= lastAt)
  lastAt = s.at
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Стехиометрия и баланс полуреакций
// ─────────────────────────────────────────────────────────────────────────────

const ATOM_RE = /([A-Z][a-z]?)(\d*)/g
function countAtoms(side: readonly { formula: string; coeff: number }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const term of side) {
    for (const m of term.formula.matchAll(ATOM_RE)) {
      const el = m[1]!
      const n = m[2] ? Number(m[2]) : 1
      out[el] = (out[el] ?? 0) + n * term.coeff
    }
  }
  return out
}

for (const [name, eq] of [
  ['Fe + S → FeS', FES_REACTION],
  ['проба на H₂S', FES_ACID_TEST],
] as const) {
  const left = countAtoms(eq.left)
  const right = countAtoms(eq.right)
  const elements = new Set([...Object.keys(left), ...Object.keys(right)])
  for (const el of elements) {
    ok(`${name}: баланс по ${el}`, (left[el] ?? 0) === (right[el] ?? 0), `${left[el] ?? 0} ≠ ${right[el] ?? 0}`)
  }
}

const given = FES_HALF_REACTIONS.find((h) => h.id === 'oxidation')!
const taken = FES_HALF_REACTIONS.find((h) => h.id === 'reduction')!
ok('электронный баланс: отдано = принято', given.electrons * given.times === taken.electrons * taken.times)
ok('железо окисляется до +2', given.chargeRight === 2)
ok('сера восстанавливается до −2', taken.chargeRight === -2)
ok('суммарный заряд слева 0', given.chargeLeft + taken.chargeLeft === 0)
ok('суммарный заряд справа 0', given.chargeRight + taken.chargeRight === 0)
ok('полуреакции без выдуманных частиц', FES_HALF_REACTIONS.every((h) => !/S²⁺|Fe²⁻|S⁰⁻/.test(h.equation)))

// ─────────────────────────────────────────────────────────────────────────────
// 9. Тексты и подписи: ru / en / uz
// ─────────────────────────────────────────────────────────────────────────────

const seen = new Map<string, Set<string>>()
for (const locale of LOCALES) {
  const text = getFesMechanismText(locale)
  ok(`${locale}: есть заголовок урока`, text.intro.title.length > 3)
  ok(`${locale}: есть вводная реплика`, text.intro.speak.length > 10)
  ok(`${locale}: есть предупреждение о безопасности`, text.safety.length > 30)
  ok(`${locale}: есть легенда электрона`, text.legend.electron.length > 10)
  ok(`${locale}: есть оговорка про оболочку`, text.legend.orbitalPhase.length > 10)
  ok(`${locale}: есть легенда магнита`, text.legend.magnet.length > 10)
  ok(`${locale}: единица энергии на месте`, text.energy.unit.length > 2)
  ok(`${locale}: сводка лестницы содержит {dH}`, text.energy.summary.includes('{dH}'))
  for (const id of FES_STEP_IDS) {
    const s = text.steps[id]
    ok(`${locale}/${id}: есть заголовок`, Boolean(s?.title && s.title.length > 3))
    ok(`${locale}/${id}: есть 2–4 предложения`, (s.body.match(/[.!?]\s|[.!?]$/g) ?? []).length >= 2, s.body.slice(0, 40))
    ok(`${locale}/${id}: есть уравнение стадии`, Boolean(s.equation && s.equation.length > 3))
    ok(`${locale}/${id}: есть реплика преподавателя`, Boolean(s.speak && s.speak.length > 10))
    const key = `${id}.title`
    const bag = seen.get(key) ?? new Set<string>()
    bag.add(s.title)
    seen.set(key, bag)
  }
  for (const id of ['atomFe', 'atomS', 'crystal', 'total'] as const) {
    ok(`${locale}: подпись ступени «${id}»`, text.energy.stages[id].length > 2)
  }
}
for (const [key, bag] of seen) ok(`переводы различаются: ${key}`, bag.size === LOCALES.length, `${bag.size} из ${LOCALES.length}`)

// Схематичное названо схематичным: у шагов с условной картинкой есть пометка note
// во всех трёх локалях (что именно сказано — дело урока, а не теста).
for (const locale of LOCALES) {
  const t = getFesMechanismText(locale)
  for (const id of ['lattice', 'transfer', 'mixture'] as const) {
    ok(`${locale}/${id}: есть пометка note о схематичном`, (t.steps[id].note ?? '').length > 20)
  }
}

// Разбор замечания: тип NiAs — не каменная соль. Текст урока не должен обещать,
// что одноимённые ионы нигде не соприкасаются, и обязан назвать Fe–Fee ≈ 294 пм.
const FE_FE_TEXT_PM = FES_GEOM.data.feFeColumnPm.toFixed(1).replace('.', ',')
const FE_FE_TEXT_PM_EN = FES_GEOM.data.feFeColumnPm.toFixed(1)
/** Опровергнутое собственной сценой утверждение — в трёх локалях сразу. */
const CHESSBOARD_CLAIM =
  /одноимённые заряды нигде не соприкасаются|like charges never touch|bir xil zaryadlar hech qayerda tegmaydi/i
for (const locale of LOCALES) {
  const text = getFesMechanismText(locale)
  const body = text.steps.lattice.body
  ok(`${locale}: снято ложное правило «одноимённые нигде не соприкасаются»`, !CHESSBOARD_CLAIM.test(body), body.slice(0, 60))
  ok(
    `${locale}: назван шаг колонки Fe–Fe (${FE_FE_TEXT_PM} пм)`,
    body.includes(FE_FE_TEXT_PM) || body.includes(FE_FE_TEXT_PM_EN),
    body.slice(0, 80),
  )
  // Плотность троилита в тексте обязана совпадать с ядром: если ядро поправят,
  // тест заставит поправить и урок на всех трёх языках.
  const dens = FES_GEOM.data.densityGCm3
  ok(
    `${locale}: плотность троилита в тексте взята из ядра (${dens})`,
    text.steps.lattice.note!.includes(String(dens).replace('.', ',')) || text.steps.lattice.note!.includes(String(dens)),
    text.steps.lattice.note!.slice(-60),
  )
}

// Подписи в 3D: токены существуют и после локализации фигурных скобок не остаётся.
for (const token of labelTokensUsed(FES_LABELS)) {
  ok(`токен подписи «${token}» есть в словаре ru`, token in SCENE_LABEL_TOKENS.ru)
}
const rendered: Record<string, string[]> = {}
for (const locale of LOCALES) {
  const states = createLabelStates(FES_LABELS)
  localizeSceneLabels(states, locale)
  for (const st of states) {
    ok(`${locale}: подпись «${st.id}» без незакрытых токенов`, !/\{\w+\}/.test(st.text), st.text)
  }
  rendered[locale] = states.map((s) => s.text)
}
ok('ru и en подписи различаются (состояния переведены)', rendered.ru!.join('|') !== rendered.en!.join('|'))

// Подписи не показываются раньше времени и не остаются после конца.
at(0)
for (const l of frame.labels) ok(`в нулевой момент подпись «${l.id}» скрыта`, l.opacity < 0.3, `${l.opacity.toFixed(2)}`)
at(FES_END)
for (const l of frame.labels) ok(`в конце сцены подпись «${l.id}» погашена`, l.opacity < 0.3, `${l.opacity.toFixed(2)}`)

console.log(`test-fes-cinema: OK, проверок ${checks}, экранное время ${wall.toFixed(1)} с, шагов ${FES_STEPS.length}`)
