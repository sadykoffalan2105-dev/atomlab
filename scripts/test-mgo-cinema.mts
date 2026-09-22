#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт сцены «горение магния: 2 Mg (тв.) + O₂ (г.) → 2 MgO (тв.)».
 * Построен по образцу эталона scripts/test-nacl-cinema.mts (разделы 1–9).
 *
 * Сцена проверяется ДАННЫМИ, а не строками: раскадровка — чистая функция sampleMgoFrame(t),
 * весь урок сэмплируется в Node, а каждое число сверяется с научным ядром src/chemistry/data.
 * Проверок «есть ли в тексте слово/литерал» здесь НЕТ: числа ИЗВЛЕКАЮТСЯ из текста и сверяются
 * с ядром по порядку, последовательности чисел ru / en / uz обязаны совпадать.
 *
 *   1. Хронометраж: 6 ± 1 шаг, каждый 4–7 экранных секунд, всего 26–34 с, cue лаборатории
 *      embryo → birth → complete строго после последнего шага.
 *   2. Раскадровка: ни атом, ни камера не прыгают между кадрами 1/30 с, видимость без скачков.
 *   3. Геометрия ↔ ядро: O=O, ГПУ магния, газовая пара на r_e(MgO, г.) с перекрытием сфер,
 *      решётка 2×2×2 — 125 ионов, 5 по ребру, d = cationAnionPm, КЧ 6, 54 ребра длиной a.
 *   4. Электроны: заряд донора — в кадр ухода, акцептора — в кадр прихода (0 → ±1 → ±2);
 *      радиусы Mg²⁺ / O²⁻ — в кадр второго ухода/прихода; Σq + летящие e⁻ = 0 каждые 1/60 с.
 *   5. На каждом шаге видимы только объекты этого шага; на паузе каждый видимый атом подписан.
 *   6. Финал без огня: все FX-амплитуды = 0, свечение и bloom базовые.
 *   7. Энергия: лестница = BORN_HABER.mgo, знаки, сумма ≈ табличная ΔH°f в пределах разброса.
 *   8. 3D-подписи: только формулы/числа/единицы-токены, числа — из ядра, запятая на ru/uz.
 *   9. Тексты: извлечённые числа ↔ ядро по местам, синхронность ru/en/uz.
 *  10. Научная приёмка: газовая MgO — не пара ±2 (диполь), цикл назван мысленным путём
 *      (парофазное горение по Глассману), т. пл. в K — из JANAF, объяснение 5,4 → 4,8 через EA₂,
 *      сохранение атомов и заряд вырезки, число атомов в ленте, безопасность (CO₂), Fm3̄m.
 *
 * Запуск: npx tsx scripts/test-mgo-cinema.mts
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  ATOMIC_DATA,
  BORN_HABER,
  bondLengthPm,
  dHfKJ,
  FLAME_TEMPERATURES,
  getCrystal,
  LATTICE_ENTHALPY_KJ,
  OXIDE_SECOND_EA_KJ,
  radiusForSpecies,
} from '../src/chemistry/data/index.ts'
import { storyWallDuration } from '../src/lab/cinema/core/storyTime.ts'
import { assertCameraContinuity, sampleShot } from '../src/lab/cinema/scenes/kit/camera.ts'
import {
  assertNoPositionJumps,
  createLabelStates,
  createSceneCamera,
  labelTokensUsed,
  localizeSceneLabels,
  SCENE_LABEL_TOKENS,
} from '../src/lab/cinema/scenes/kit/sceneKit.ts'
import { assertIonSizeOrder, LATTICE_BALL_SCALE, pmToScene, speciesRadius, speciesRadiusPm, SPECIES_SCALE } from '../src/lab/cinema/scenes/kit/cpkAtoms.ts'
import { ladderLevels } from '../src/lab/cinema/scenes/kit/energyLadderData.ts'
import { assertSnapAt } from '../src/lab/cinema/scenes/kit/valence.ts'
import { coordinationShell } from '../src/lab/cinema/scenes/kit/lattice.ts'
import {
  METAL_BONDS,
  METAL_FRAG,
  METAL_SITE_OF,
  MGO_ATOM_INDEX,
  MGO_ATOMS,
  MGO_CAMERA,
  MGO_CUES,
  MGO_DIM_A_DROP,
  MGO_EDGE_A,
  MGO_ELECTRON_ROUTES,
  MGO_ELECTRONS,
  MGO_END,
  MGO_GEOM,
  MGO_LABELS,
  MGO_METAL_OFFSET,
  MGO_SEGMENTS,
  MGO_SNAP,
  MGO_STEPS,
  MGO_STEP_IDS,
  MGO_TIMING,
  SALT_FRAG,
  SALT_SG_DISPLAY,
  SALT_SITE_OF,
  createMgoFrame,
  hermannMauguinDisplay,
  sampleMgoFrame,
  validateMgoStoryboard,
  type MgoFrame,
} from '../src/lab/cinema/scenes/mgo/mgoStoryboard.ts'
import {
  MGO_COST_BEFORE_LATTICE_KJ,
  MGO_COULOMB_CHARGE_FACTOR,
  MGO_COULOMB_RATIO,
  MGO_DHF_TABLE_KJ,
  MGO_HALF_REACTIONS,
  MGO_LADDER,
  MGO_LATTICE_KJ,
  MGO_LATTICE_RATIO,
  MGO_REACTION,
  MGO_REACTION_DH_KJ,
  MGO_RESIDUAL_KJ,
  MGO_SUM_KJ,
  mgoStageKJ,
  NACL_LATTICE_REF_KJ,
  validateMgoEnergetics,
  type MgoStageId,
} from '../src/lab/cinema/scenes/mgo/mgoEnergetics.ts'
import { getMgoMechanismText, type MgoLocale, type MgoMechanismText } from '../src/lab/cinema/scenes/mgo/mgoMechanismText.ts'
import { mgoScientificWatchdogMs } from '../src/lab/scientificSynthesis/mgoScenarioTiming.ts'

const LOCALES: MgoLocale[] = ['ru', 'en', 'uz']
const frame = createMgoFrame()
const at = (t: number): MgoFrame => sampleMgoFrame(t, frame)
const idx = (id: string) => MGO_ATOM_INDEX.get(id)!

let checks = 0
function ok(label: string, cond: boolean, detail = ''): void {
  assert.ok(cond, `${label}${detail ? ` — ${detail}` : ''}`)
  checks++
}
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol

const SALT = getCrystal('mgo')!
const METAL = getCrystal('mg_metal')!
const NACL = getCrystal('nacl')!
const D_LATTICE = pmToScene(SALT.cationAnionPm)
const D_GAS = pmToScene(bondLengthPm('Mg-O'))
const STEP_PAUSE = MGO_STEPS.map((s) => s.to)
const LAST = MGO_STEPS.length - 1
const S = Object.fromEntries(MGO_STEP_IDS.map((id, i) => [id, i])) as Record<(typeof MGO_STEP_IDS)[number], number>
const E_LIST = [MGO_ELECTRONS.e1, MGO_ELECTRONS.e2, MGO_ELECTRONS.e3, MGO_ELECTRONS.e4] as const

// ─────────────────────────────────────────────────────────────────────────────
// 1. Хронометраж и контракт лаборатории
// ─────────────────────────────────────────────────────────────────────────────

MGO_TIMING.validate()
ok('шагов 6 ± 1', MGO_STEPS.length >= 5 && MGO_STEPS.length <= 7, `${MGO_STEPS.length}`)
ok('id шагов совпадают', MGO_STEP_IDS.join(',') === MGO_STEPS.map((s) => s.id).join(','))
const wall = storyWallDuration(MGO_SEGMENTS)
ok('экранная длительность 26–34 с', wall >= 26 && wall <= 34, `${wall.toFixed(1)} с`)
ok('wallDuration kit = сумма сегментов', near(wall, MGO_TIMING.wallDuration, 1e-9))
for (const s of MGO_STEPS) ok(`шаг ${s.id}: 4–7 экранных секунд`, s.wall >= 4 && s.wall <= 7, `${s.wall}`)
const lastStepTo = MGO_STEPS[LAST]!.to
for (const id of ['embryo', 'birth', 'complete']) {
  const c = MGO_CUES.find((x) => x.id === id)!
  ok(`cue ${id} строго после последнего шага`, c.at > lastStepTo, `${c.at} ≤ ${lastStepTo}`)
}
for (const c of MGO_CUES) {
  if (['embryo', 'birth', 'complete'].includes(c.id)) continue
  ok(`cue ${c.id} внутри шагов`, c.at > 0 && c.at < lastStepTo)
}
ok('complete совпадает с концом сюжета', MGO_CUES.find((c) => c.id === 'complete')!.at === MGO_END)
ok('watchdog лаборатории положителен', mgoScientificWatchdogMs() > 0)
for (let i = 0; i < MGO_STEPS.length; i++) {
  const s = MGO_STEPS[i]!
  ok(`stepIndexAt(${s.id})`, MGO_TIMING.stepIndexAt((s.from + s.to) / 2) === i)
}
// Первые электроны — в шаге «первый электрон», вторые — в шаге «второй электрон».
for (const [k, step] of [[0, S.transfer], [1, S.transfer], [2, S.second], [3, S.second]] as const) {
  const e = E_LIST[k]!
  const s = MGO_STEPS[step]!
  ok(`e${k + 1}: уход и приход внутри шага ${s.id}`, e.leave > s.from && e.arrive < s.to && e.leave < e.arrive)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Раскадровка: рывки атомов и камеры, видимость, ноль аллокаций
// ─────────────────────────────────────────────────────────────────────────────

validateMgoStoryboard()
{
  const scratch = createMgoFrame()
  const buf = MGO_ATOMS.map((a) => ({ id: a.id, pos: new THREE.Vector3(), opacity: 0 }))
  assertNoPositionJumps(
    (t) => {
      sampleMgoFrame(t, scratch)
      for (let i = 0; i < MGO_ATOMS.length; i++) {
        buf[i]!.pos.copy(scratch.pos[i]!)
        buf[i]!.opacity = scratch.opacity[i]!
      }
      return buf
    },
    MGO_END,
    0.09,
    1 / 30,
  )
  checks++
  const cam = createSceneCamera()
  assertCameraContinuity((t) => sampleShot(MGO_CAMERA, t, cam), MGO_END)
  checks++

  // Видимость не щёлкает: у проявляющегося иона решётки растёт шар (доля радиуса), у остальных — непрозрачность.
  const fullR = MGO_ATOMS.map((a) => (a.kind === 'lattice' ? speciesRadius(a.el, a.el === 'Mg' ? 2 : -2, LATTICE_BALL_SCALE) : 0))
  const presence = (i: number) => (MGO_ATOMS[i]!.kind === 'lattice' ? scratch.radius[i]! / fullR[i]! : scratch.opacity[i]!)
  let prev: Float32Array | null = null
  let worst = 0
  let worstT = 0
  for (let t = 0; t <= MGO_END + 1e-9; t += 1 / 30) {
    sampleMgoFrame(t, scratch)
    const now = Float32Array.from(MGO_ATOMS, (_, i) => presence(i))
    if (prev) {
      for (let i = 0; i < MGO_ATOMS.length; i++) {
        const d = Math.abs(now[i]! - prev[i]!)
        if (d > worst) {
          worst = d
          worstT = t
        }
      }
    }
    prev = now
  }
  ok('видимость без скачков (≤ 0,12 за кадр 1/30 с)', worst <= 0.12, `${worst.toFixed(3)} при t=${worstT.toFixed(2)}`)

  const posRefs = scratch.pos.slice()
  const labelRefs = scratch.labels.slice()
  const labelPos = scratch.labels.map((l) => l.pos)
  for (let t = 0; t <= MGO_END; t += 0.5) sampleMgoFrame(t, scratch)
  ok('векторы позиций переиспользуются', scratch.pos.every((p, i) => p === posRefs[i]))
  ok('подписи переиспользуются', scratch.labels.every((l, i) => l === labelRefs[i] && l.pos === labelPos[i]))
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Геометрия раскадровки ↔ ядро
// ─────────────────────────────────────────────────────────────────────────────

assertIonSizeOrder('Mg', 2)
assertIonSizeOrder('O', -2)
checks += 2
ok('Mg⁰ — металлический радиус ядра', speciesRadiusPm('Mg', 0) === ATOMIC_DATA.Mg.metallicRadiusPm)
ok('O⁰ — ковалентный радиус ядра', speciesRadiusPm('O', 0) === ATOMIC_DATA.O.covalentRadiusPm)
ok('Mg²⁺ — радиус Шеннона при КЧ решётки', speciesRadiusPm('Mg', 2) === radiusForSpecies('Mg', 2, { cn: SALT.coordination['Mg²⁺'] }))
ok('O²⁻ — радиус Шеннона при КЧ решётки', speciesRadiusPm('O', -2) === radiusForSpecies('O', -2, { cn: SALT.coordination['O²⁻'] }))

// 3.1 Шаг 1: O₂ — двухатомная молекула с r_e из bondData; магний — фрагмент ГПУ из crystalData.
at(STEP_PAUSE[S.reactants]!)
ok('O₂: d(O=O) = bondLengthPm', near(frame.pos[idx('oA')]!.distanceTo(frame.pos[idx('oB')]!), pmToScene(bondLengthPm('O=O'))))
ok('O₂: σ и π видны', frame.bond.opacity > 0.9 && frame.bond.pi > 0.9)
ok('O — газ, Mg — металл (материалы)', frame.material[idx('oA')] === 'gas' && frame.material[idx('mg1')] === 'metal')
ok('фрагмент металла — целое число ячеек ГПУ', METAL_FRAG.cells.every((n) => Number.isInteger(n) && n >= 1) && METAL.spaceGroup === 'P6₃/mmc')
for (const [id, si] of METAL_SITE_OF) {
  const want = new THREE.Vector3(...METAL_FRAG.sites[si]!.posScene).add(new THREE.Vector3(...MGO_METAL_OFFSET))
  ok(`атом металла ${id} в узле ГПУ`, frame.pos[idx(id)]!.distanceTo(want) < 1e-6)
  ok(`атом металла ${id}: металлический радиус`, near(frame.radius[idx(id)]!, speciesRadius('Mg', 0)))
}
{
  const allowed = [METAL.cationAnionPm, METAL.cellPm.a]
  for (const [a, b] of METAL_BONDS) {
    const d = frame.pos[idx(a)]!.distanceTo(frame.pos[idx(b)]!) / pmToScene(1)
    ok(`металл ${a}–${b} = соседи ГПУ ядра (±0,05 пм)`, allowed.some((v) => near(d, v, 0.05)), d.toFixed(2))
  }
  // Никакие два атома металла не ближе кратчайшего расстояния ГПУ.
  const ids = [...METAL_SITE_OF.keys()]
  let minD = Infinity
  for (const a of ids) for (const b of ids) if (a < b) minD = Math.min(minD, frame.pos[idx(a)]!.distanceTo(frame.pos[idx(b)]!) / pmToScene(1))
  ok('ближайшие соседи в металле = cationAnionPm ядра', near(minD, METAL.cationAnionPm, 0.05), minD.toFixed(2))
}
ok('рёбра ячеек металла видны', frame.edgeSet === 'metal' && frame.edges > 0.9)
for (const [p, q] of METAL_FRAG.cellEdges) {
  const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
  ok('ребро ячейки ГПУ = a или c ядра', near(d, pmToScene(METAL.cellPm.a), 1e-5) || near(d, pmToScene(METAL.cellPm.c!), 1e-5), d.toFixed(4))
}

// 3.2 Шаг 5: газовые пары на r_e(MgO, г.), полные сферы Шеннона перекрываются.
at(STEP_PAUSE[S.attraction]!)
for (const [mg, o] of [['mg1', 'oA'], ['mg2', 'oB']] as const) {
  const d = frame.pos[idx(mg)]!.distanceTo(frame.pos[idx(o)]!)
  ok(`газовая пара ${mg}/${o}: d = bondLengthPm('Mg-O')`, near(d, D_GAS, 1e-5), `${d.toFixed(4)} против ${D_GAS.toFixed(4)}`)
  ok(`газовая пара ${mg}/${o}: полные радиусы Шеннона`, near(frame.radius[idx(mg)]!, speciesRadius('Mg', 2, 1), 1e-6) && near(frame.radius[idx(o)]!, speciesRadius('O', -2, 1), 1e-6))
  const ratioScreen = d / (frame.radius[idx(mg)]! + frame.radius[idx(o)]!)
  const ratioData = bondLengthPm('Mg-O') / (radiusForSpecies('Mg', 2) + radiusForSpecies('O', -2))
  ok(`газовая пара ${mg}/${o}: d/(r₊+r₋) экрана = данным (перекрытие видно)`, near(ratioScreen, ratioData, 1e-6) && ratioScreen < 1, `${ratioScreen.toFixed(4)}`)
}
ok('газовое и кристаллическое расстояния различаются (ядро)', SALT.cationAnionPm - bondLengthPm('Mg-O') > 30)
ok('линии поля видны на паузе шага 5', frame.fx.field > 0.5)
ok('ионная пара без «палочки»: связь O=O давно погашена', frame.bond.opacity === 0 && frame.bond.pi === 0)

// 3.3 Шаг 6: решётка 2×2×2 из базиса ядра.
at(STEP_PAUSE[S.lattice]!)
{
  ok('фрагмент — 125 ионов', SALT_FRAG.sites.length === 125)
  const vis = MGO_ATOMS.map((a, i) => ({ a, i })).filter(({ a }) => SALT_SITE_OF.has(a.id))
  ok('все 125 ионов фрагмента в кадре и видимы', vis.length === 125 && vis.every(({ i }) => frame.opacity[i]! > 0.99))
  for (const { a, i } of vis) {
    const s = SALT_FRAG.sites[SALT_SITE_OF.get(a.id)!]!
    ok(`ион ${a.id} в своём узле`, frame.pos[i]!.distanceTo(new THREE.Vector3(...s.posScene)) < 1e-6)
    ok(`ион ${a.id}: элемент узла`, s.el === a.el)
    ok(`ион ${a.id}: радиус иона (доля решётки)`, near(frame.radius[i]!, speciesRadius(a.el, a.el === 'Mg' ? 2 : -2, LATTICE_BALL_SCALE), 1e-6))
    ok(`ион ${a.id}: заряд узла ядра`, frame.charge[i] === s.charge)
    ok(`ион ${a.id}: материал ion`, frame.material[i] === 'ion')
  }
  const xs = new Set(vis.map(({ i }) => Math.round(frame.pos[i]!.x / D_LATTICE)))
  ok('по ребру 5 ионов', xs.size === 2 * SALT_FRAG.cells[0] + 1)
  let interior = 0
  for (const { a, i } of vis) {
    const p = frame.pos[i]!
    const nb = vis.filter(({ i: j }) => j !== i && Math.abs(frame.pos[j]!.distanceTo(p) - D_LATTICE) < 1e-4)
    ok(`ион ${a.id}: ближайшие соседи — противоионы`, nb.every(({ a: b }) => b.el !== a.el))
    const closer = vis.filter(({ i: j }) => j !== i && frame.pos[j]!.distanceTo(p) < D_LATTICE - 1e-4)
    ok(`ион ${a.id}: никого ближе a/2`, closer.length === 0)
    if ([p.x, p.y, p.z].every((c) => Math.abs(c) < 2 * D_LATTICE - 1e-6)) {
      interior++
      ok(`внутренний ион ${a.id}: КЧ = coordination ядра`, nb.length === SALT.coordination[a.el === 'Mg' ? 'Mg²⁺' : 'O²⁻'])
    }
  }
  ok('внутренних ионов 27', interior === 27)
  const center = SALT_FRAG.sites.findIndex((s) => s.posScene.every((c) => Math.abs(c) < 1e-9))
  const shell = coordinationShell(SALT_FRAG, center)
  ok('координационный многогранник центра — октаэдр (6 соседей, 12 рёбер)', shell.neighbors.length === 6 && shell.edges.length === 12)
  ok('рёбер ячеек 54', SALT_FRAG.cellEdges.length === 54)
  for (const [p, q] of SALT_FRAG.cellEdges) {
    const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
    ok('ребро ячейки = a ядра', near(d, pmToScene(SALT.cellPm.a), 1e-5), d.toFixed(4))
  }
  ok('рёбра ячеек MgO видны', frame.edgeSet === 'salt' && frame.edges > 0.9)
  const eA = Math.hypot(MGO_EDGE_A[0][0] - MGO_EDGE_A[1][0], MGO_EDGE_A[0][1] - MGO_EDGE_A[1][1], MGO_EDGE_A[0][2] - MGO_EDGE_A[1][2])
  ok('подпись a стоит у ребра длиной a', near(eA, pmToScene(SALT.cellPm.a), 1e-5))
  const lA = frame.labels.find((l) => l.id === 'cellA')!
  const mid = new THREE.Vector3((MGO_EDGE_A[0][0] + MGO_EDGE_A[1][0]) / 2, (MGO_EDGE_A[0][1] + MGO_EDGE_A[1][1]) / 2, (MGO_EDGE_A[0][2] + MGO_EDGE_A[1][2]) / 2)
  const rMaxLattice = speciesRadius('O', -2, LATTICE_BALL_SCALE)
  const bottomY = SALT_FRAG.boundsScene.min[1]
  ok('ребро подписи a — нижнее переднее', near(mid.y, bottomY, 1e-6) && near(mid.z, SALT_FRAG.boundsScene.max[2], 1e-6))
  ok('размерная линия a вне сфер', MGO_DIM_A_DROP > rMaxLattice)
  ok('подпись a под ребром, снаружи силуэта', lA.pos.y < bottomY - rMaxLattice && near(lA.pos.x, mid.x, 1e-6) && lA.opacity > 0.9)
  ok('размерные линии видны на паузе шага 6', frame.dims.pair > 0.9 && frame.dims.edgeA > 0.9)
  ok('пара mg1/oA в решётке на d = cationAnionPm', near(frame.pos[idx('mg1')]!.distanceTo(frame.pos[idx('oA')]!), D_LATTICE, 1e-5))
  ok('металл давно погашен', MGO_ATOMS.every((a, i) => a.kind !== 'metal' || frame.opacity[i] === 0))
  // Плотность ядра = рентгеновская ρ = Z·M / (N_A·a³) из ячейки ядра (±0,3 %).
  const N_A = 6.02214076e23
  const M = ATOMIC_DATA.Mg.atomicMassU + ATOMIC_DATA.O.atomicMassU
  const rhoX = (SALT.z * M) / (N_A * (SALT.cellPm.a * 1e-10) ** 3)
  ok('ρ(MgO) ядра = Z·M/(N_A·a³) с точностью 0,3 %', Math.abs(rhoX - SALT.densityGCm3) / SALT.densityGCm3 < 3e-3, `${rhoX.toFixed(4)} против ${SALT.densityGCm3}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Электроны: заряд донора — в кадр ухода, акцептора — в кадр прихода
// ─────────────────────────────────────────────────────────────────────────────

{
  const R = MGO_GEOM.radius
  const E = MGO_ELECTRONS
  assertSnapAt(MGO_SNAP.radiusMg1, E.e3.leave, R.mg, R.mgIon)
  assertSnapAt(MGO_SNAP.radiusMg2, E.e4.leave, R.mg, R.mgIon)
  assertSnapAt(MGO_SNAP.radiusOA, E.e3.arrive, R.o, R.oIon)
  assertSnapAt(MGO_SNAP.radiusOB, E.e4.arrive, R.o, R.oIon)
  assertSnapAt(MGO_SNAP.chargeMg1, E.e1.leave, 0, 1)
  assertSnapAt(MGO_SNAP.chargeMg1, E.e3.leave, 1, 2)
  assertSnapAt(MGO_SNAP.chargeMg2, E.e2.leave, 0, 1)
  assertSnapAt(MGO_SNAP.chargeMg2, E.e4.leave, 1, 2)
  assertSnapAt(MGO_SNAP.chargeOA, E.e1.arrive, 0, -1)
  assertSnapAt(MGO_SNAP.chargeOA, E.e3.arrive, -1, -2)
  assertSnapAt(MGO_SNAP.chargeOB, E.e2.arrive, 0, -1)
  assertSnapAt(MGO_SNAP.chargeOB, E.e4.arrive, -1, -2)
  checks += 12
  const dt = 1 / 60
  const lbl = (id: string) => frame.labels.find((l) => l.id === id)!.text
  const vi = (id: string) => ['mg1', 'mg2', 'oA', 'oB'].indexOf(id)
  for (let k = 0; k < 4; k++) {
    const route = MGO_ELECTRON_ROUTES[k]!
    const e = E_LIST[k]!
    const second = route.order === 2
    const [d, a] = [route.donor, route.acceptor]
    // Донор: кадр до ухода и кадр ухода.
    at(e.leave - dt)
    const b = { r: frame.radius[idx(d)]!, q: frame.charge[idx(d)]!, n: frame.valence[vi(d)]!.count, l: lbl(d) }
    at(e.leave)
    ok(`${route.id}: до ухода у ${d} заряд ${second ? 1 : 0}`, b.q === (second ? 1 : 0))
    ok(`${route.id}: в кадр ухода у ${d} заряд ${second ? 2 : 1}`, frame.charge[idx(d)] === (second ? 2 : 1))
    ok(`${route.id}: подпись ${d} меняется в кадр ухода`, b.l !== lbl(d) && lbl(d) === (second ? 'Mg²⁺' : 'Mg⁺'))
    ok(`${route.id}: валентных точек у ${d} на одну меньше`, frame.valence[vi(d)]!.count === b.n - 1 && frame.valence[vi(d)]!.count === ATOMIC_DATA.Mg.valenceElectrons - (second ? 2 : 1))
    ok(
      `${route.id}: радиус ${d} — ${second ? 'Mg²⁺ в кадр второго ухода' : 'прежний (у Mg⁺ нет радиуса Шеннона)'}`,
      near(b.r, R.mg) && near(frame.radius[idx(d)]!, second ? R.mgIon : R.mg),
    )
    ok(`${route.id}: материал ${d} — ion с первого ухода`, frame.material[idx(d)] === 'ion')
    ok(`${route.id}: в кадр ухода акцептор ${a} ещё с прежним зарядом`, frame.charge[idx(a)] === (second ? -1 : 0))
    // Акцептор: кадр до прихода и кадр прихода.
    at(e.arrive - dt)
    const c = { r: frame.radius[idx(a)]!, q: frame.charge[idx(a)]!, n: frame.valence[vi(a)]!.count, arrived: frame.electrons[k]!.arrived, l: lbl(a) }
    at(e.arrive)
    ok(`${route.id}: до прихода электрон в пути`, !c.arrived && frame.electrons[k]!.arrived)
    ok(`${route.id}: в кадр прихода у ${a} заряд ${second ? -2 : -1}`, c.q === (second ? -1 : 0) && frame.charge[idx(a)] === (second ? -2 : -1))
    ok(`${route.id}: точек у ${a} ${ATOMIC_DATA.O.valenceElectrons + (second ? 1 : 0)} → ${ATOMIC_DATA.O.valenceElectrons + (second ? 2 : 1)}`, c.n === ATOMIC_DATA.O.valenceElectrons + (second ? 1 : 0) && frame.valence[vi(a)]!.count === c.n + 1)
    ok(`${route.id}: подпись ${a} меняется в кадр прихода`, c.l !== lbl(a) && lbl(a) === (second ? 'O²⁻' : 'O⁻'))
    ok(`${route.id}: радиус ${a} — ${second ? 'O²⁻ в кадр второго прихода' : 'прежний (у O⁻ нет радиуса Шеннона)'}`, near(c.r, R.o) && near(frame.radius[idx(a)]!, second ? R.oIon : R.o))
    ok(`${route.id}: материал ${a} — ion`, frame.material[idx(a)] === 'ion')
    ok(`${route.id}: новая точка подсвечена`, frame.valence[vi(a)]!.highlight === frame.valence[vi(a)]!.count - 1)
  }
  // Закон сохранения заряда: каждые 1/60 с шагов 3–4 Σ зарядов частиц + (−1)·(летящие e⁻) = 0.
  let worst = 0
  for (let t = MGO_STEPS[S.transfer]!.from; t <= MGO_STEPS[S.second]!.to + 1e-9; t += dt) {
    at(t)
    let q = 0
    for (const id of ['mg1', 'mg2', 'oA', 'oB']) q += frame.charge[idx(id)]!
    for (const e of E_LIST) if (t >= e.leave && t < e.arrive) q -= 1
    worst = Math.max(worst, Math.abs(q))
  }
  ok('шаги 3–4: заряд сохраняется в каждом кадре (Σq + летящие e⁻ = 0)', worst === 0, `${worst}`)
  // Лестница ставит ионизацию на уход электрона, сродство — на приход.
  const st = (id: MgoStageId) => MGO_LADDER.stages.find((s) => s.id === id)!.at
  ok('IE₁ = уход e1, EA₁ = приход e1', near(st('ionization1'), E.e1.leave, 1e-9) && near(st('affinity1'), E.e1.arrive, 1e-9))
  ok('IE₂ = уход e3, EA₂ = приход e3', near(st('ionization2'), E.e3.leave, 1e-9) && near(st('affinity2'), E.e3.arrive, 1e-9))
  // Паузы держат состояния «до», «после первого», «после второго».
  const dots = (k: number) => frame.valence[k]!
  at(STEP_PAUSE[S.ignition]!)
  ok('пауза шага 2: у Mg две точки, у O шесть (видны)', dots(0).count === ATOMIC_DATA.Mg.valenceElectrons && dots(2).count === ATOMIC_DATA.O.valenceElectrons && dots(0).amount > 0.9 && dots(2).amount > 0.9)
  ok('пауза шага 2: частицы нейтральны', ['mg1', 'mg2', 'oA', 'oB'].every((id) => frame.charge[idx(id)] === 0))
  at(STEP_PAUSE[S.transfer]!)
  ok('пауза шага 3: Mg⁺ с одной точкой, O⁻ с семью', dots(0).count === 1 && dots(1).count === 1 && dots(2).count === 7 && dots(3).count === 7 && dots(0).amount > 0.9 && dots(2).amount > 0.9)
  ok('пауза шага 3: заряды +1 / −1', frame.charge[idx('mg1')] === 1 && frame.charge[idx('oB')] === -1)
  at(STEP_PAUSE[S.second]!)
  ok('пауза шага 4: у Mg²⁺ точек нет, у O²⁻ октет', dots(0).count === 0 && dots(0).amount === 0 && dots(2).count === 8 && dots(3).count === 8 && dots(2).amount > 0.9)
  ok('пауза шага 4: заряды +2 / −2 и радиусы ионов', frame.charge[idx('mg2')] === 2 && frame.charge[idx('oA')] === -2 && near(frame.radius[idx('mg1')]!, R.mgIon) && near(frame.radius[idx('oB')]!, R.oIon))
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Только объекты текущего шага; на паузе каждый видимый атом подписан
// ─────────────────────────────────────────────────────────────────────────────

function hostSpan(hosts: readonly string[]): number {
  let m = 0
  for (const a of hosts) for (const b of hosts) m = Math.max(m, frame.pos[idx(a)]!.distanceTo(frame.pos[idx(b)]!))
  return m
}

for (let si = 0; si < MGO_STEPS.length; si++) {
  const s = MGO_STEPS[si]!
  let foreign = 0
  let at0 = -1
  for (let t = s.from; t <= s.to + 1e-9; t += 1 / 60) {
    at(t)
    for (let i = 0; i < MGO_ATOMS.length; i++) {
      const [a, b] = MGO_ATOMS[i]!.span
      if (!(si >= a && si <= b) && frame.opacity[i]! > 0) {
        foreign++
        if (at0 < 0) at0 = t
      }
    }
  }
  ok(`шаг ${s.id}: ни одного объекта чужого шага`, foreign === 0, `первый при t=${at0.toFixed(3)}`)

  at(s.to)
  const visibleLabels = frame.labels.map((l, k) => ({ st: l, def: MGO_LABELS[k]! })).filter(({ st }) => st.opacity > 0.5)
  ok(`пауза ${s.id}: есть подписи`, visibleLabels.length > 0)
  for (let i = 0; i < MGO_ATOMS.length; i++) {
    if (frame.opacity[i]! <= 0.02) continue
    const id = MGO_ATOMS[i]!.id
    const hosts = visibleLabels.filter(({ def }) => def.hosts.includes(id))
    const closeHost = hosts.some(({ st, def }) => st.pos.distanceTo(frame.pos[i]!) <= hostSpan(def.hosts) + 1)
    ok(`пауза ${s.id}: атом ${id} подписан`, closeHost, `хозяев ${hosts.length}`)
    ok(`пауза ${s.id}: атом ${id} полностью проявлен`, frame.opacity[i]! > 0.99, frame.opacity[i]!.toFixed(3))
  }
  for (const { st, def } of visibleLabels) {
    if (def.hosts.length === 0) continue
    ok(`пауза ${s.id}: подпись ${def.id} подписывает видимые атомы`, def.hosts.some((h) => frame.opacity[idx(h)]! > 0.5), st.text)
  }
}
at(STEP_PAUSE[S.ignition]!)
ok('после сублимации ни одного атома металла', MGO_ATOMS.every((a, i) => a.kind !== 'metal' || frame.opacity[i] === 0))
{
  const lbl = (id: string) => frame.labels.find((l) => l.id === id)!.opacity
  at(STEP_PAUSE[S.attraction]!)
  ok('пауза шага 5: подпись газовой пары видна, решёточной нет', lbl('dGas') > 0.9 && lbl('dCrystal') === 0)
  ok('пауза шага 5: решётки ещё нет', MGO_ATOMS.every((a, i) => a.kind !== 'lattice' || frame.opacity[i] === 0))
  at(STEP_PAUSE[S.lattice]!)
  ok('пауза шага 6: решёточная подпись видна, газовой нет', lbl('dCrystal') > 0.9 && lbl('dGas') === 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Финал без огня: все FX = 0 на всём последнем шаге
// ─────────────────────────────────────────────────────────────────────────────

{
  const s = MGO_STEPS[LAST]!
  at(MGO_STEPS[0]!.from + 0.01)
  const baseEmissive = frame.emissive[0]!
  const baseBloom = frame.camera.bloom
  let fxWorst = 0
  let hotWorst = 0
  let bloomBad = 0
  for (let t = s.from; t <= s.to + 1e-9; t += 1 / 30) {
    at(t)
    const fx = frame.fx.electrons.reduce((m, v) => m + v, 0) + frame.fx.field + frame.valence.reduce((m, v) => m + v.amount, 0)
    fxWorst = Math.max(fxWorst, fx)
    let hot = 0
    for (let i = 0; i < MGO_ATOMS.length; i++) if (frame.emissive[i] !== baseEmissive) hot++
    hotWorst = Math.max(hotWorst, hot)
    if (!near(frame.camera.bloom, baseBloom) || frame.camera.shake !== 0) bloomBad++
  }
  ok('последний шаг: FX-амплитуды = 0 в каждом кадре', fxWorst === 0, `${fxWorst}`)
  ok('последний шаг: свечение атомов базовое в каждом кадре', hotWorst === 0, `${hotWorst}`)
  ok('последний шаг: bloom базовый, тряски нет', bloomBad === 0, `${bloomBad}`)
  at(s.to)
  ok('конец последнего шага: кристалл цел и виден', SALT_FRAG.sites.length === MGO_ATOMS.filter((_, i) => frame.opacity[i]! > 0.99).length)
  at(MGO_END)
  ok('в конце хвоста кадр затемнён', frame.fade > 0.95)
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Энергетика: лестница = ядро
// ─────────────────────────────────────────────────────────────────────────────

validateMgoEnergetics()
{
  const cycle = BORN_HABER.mgo
  ok('ступени лестницы = ступени BORN_HABER.mgo', MGO_LADDER.stages.length === cycle.stages.length)
  for (const st of cycle.stages) {
    const l = MGO_LADDER.stages.find((x) => x.id === st.id)!
    ok(`ступень ${st.id} = ядро`, l.dH === st.dHKJ)
    ok(`ступень ${st.id}: множитель 1`, (l.multiplier ?? 1) === 1 && (l.perUnitKJ == null || l.perUnitKJ === st.dHKJ))
  }
  ok('сублимация = ΔH°f(Mg, г.)', mgoStageKJ('sublimation') === dHfKJ('Mg(g)'))
  ok('½D = ΔH°f(O, г.)', mgoStageKJ('dissociation') === dHfKJ('O(g)'))
  ok('IE₁, IE₂ = atomicData', mgoStageKJ('ionization1') === ATOMIC_DATA.Mg.ie1KJ && mgoStageKJ('ionization2') === ATOMIC_DATA.Mg.ie2KJ)
  ok('EA₁ = atomicData', mgoStageKJ('affinity1') === ATOMIC_DATA.O.electronAffinityKJ)
  ok('EA₂ = OXIDE_SECOND_EA_KJ (> 0)', mgoStageKJ('affinity2') === OXIDE_SECOND_EA_KJ && OXIDE_SECOND_EA_KJ > 0)
  ok('U цикла = LATTICE_ENTHALPY_KJ', MGO_LATTICE_KJ === LATTICE_ENTHALPY_KJ['MgO(s)'])
  ok('Σ цикла ≈ табличная ΔH°f (≤ 0,5)', near(MGO_LADDER.sumKJ, dHfKJ('MgO(s)'), 0.5), `${MGO_LADDER.sumKJ}`)
  ok('расхождение суммы и таблицы ненулевое (его называет урок)', Math.abs(MGO_RESIDUAL_KJ) > 0.05 && near(MGO_RESIDUAL_KJ, MGO_SUM_KJ - dHfKJ('MgO(s)'), 0.051))
  ok('таблица лестницы = ядро', MGO_DHF_TABLE_KJ === dHfKJ('MgO(s)'))
  ok('без решётки процесс эндотермический', MGO_COST_BEFORE_LATTICE_KJ > 0)
  ok('ΔH реакции = 2 · ΔH°f', near(MGO_REACTION_DH_KJ, 2 * dHfKJ('MgO(s)'), 0.05))
  const k = (id: MgoStageId) => mgoStageKJ(id)
  ok('знаки: субл. > 0, ½D > 0, IE > 0, EA₁ < 0, EA₂ > 0, U < 0', k('sublimation') > 0 && k('dissociation') > 0 && k('ionization1') > 0 && k('ionization2') > k('ionization1') && k('affinity1') < 0 && k('affinity2') > 0 && k('lattice') < 0)
  const levels = ladderLevels(MGO_LADDER)
  ok('последний уровень = сумма цикла', near(levels[levels.length - 1]!, MGO_LADDER.sumKJ))
  ok('ступени идут по времени сюжета и внутри шагов', MGO_LADDER.stages.every((s, i) => s.at > 0 && s.at < lastStepTo && (i === 0 || s.at >= MGO_LADDER.stages[i - 1]!.at)))
  // «Почему не ровно вчетверо»: Кулон для энергии ∝ q₁q₂/r, цикл — меньше.
  ok('множитель зарядов = 4 из базисов решёток', MGO_COULOMB_CHARGE_FACTOR === 4)
  ok('оценка Кулона = 4·d(NaCl)/d(MgO)', near(MGO_COULOMB_RATIO, Math.round((4 * NACL.cationAnionPm) / SALT.cationAnionPm * 10) / 10))
  ok('отношение по циклам = U(MgO)/U(NaCl)', near(MGO_LATTICE_RATIO, Math.round((MGO_LATTICE_KJ / NACL_LATTICE_REF_KJ) * 10) / 10))
  ok('реальное отношение меньше модели точечных зарядов, но больше 4', MGO_LATTICE_RATIO < MGO_COULOMB_RATIO && MGO_LATTICE_RATIO > MGO_COULOMB_CHARGE_FACTOR)
}

// Стехиометрия и электронный баланс.
{
  const count = (formula: string, coeff: number, into: Map<string, number>) => {
    for (const m of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) into.set(m[1]!, (into.get(m[1]!) ?? 0) + (m[2] ? Number(m[2]) : 1) * coeff)
  }
  const left = new Map<string, number>()
  const right = new Map<string, number>()
  for (const t of MGO_REACTION.left) count(t.formula, t.coeff, left)
  for (const t of MGO_REACTION.right) count(t.formula, t.coeff, right)
  for (const k of new Set([...left.keys(), ...right.keys()])) ok(`баланс по ${k}`, left.get(k) === right.get(k))
  ok('кислород — двухатомная молекула', MGO_REACTION.left.some((t) => t.formula === 'O2') && !MGO_REACTION.left.some((t) => t.formula === 'O'))
  const given = MGO_HALF_REACTIONS.filter((h) => h.id === 'oxidation').reduce((s, h) => s + h.electrons * h.times, 0)
  const taken = MGO_HALF_REACTIONS.filter((h) => h.id === 'reduction').reduce((s, h) => s + h.electrons * h.times, 0)
  ok('электронный баланс', given === taken && given === MGO_ELECTRON_ROUTES.length)
  ok('зарядовый баланс', MGO_HALF_REACTIONS.reduce((s, h) => s + h.chargeLeft * h.times, 0) === 0 && MGO_HALF_REACTIONS.reduce((s, h) => s + h.chargeRight * h.times, 0) === 0)
  const story = MGO_ATOMS.filter((a) => a.kind === 'story')
  ok('в сюжете 2 Mg и 2 O — как в уравнении', story.filter((a) => a.el === 'Mg').length === left.get('Mg') && story.filter((a) => a.el === 'O').length === left.get('O'))
  ok('каждый Mg отдаёт valenceElectrons электронов', ['mg1', 'mg2'].every((d) => MGO_ELECTRON_ROUTES.filter((r) => r.donor === d).length === ATOMIC_DATA.Mg.valenceElectrons))
}

// ─────────────────────────────────────────────────────────────────────────────
// Извлечение чисел из текста
// ─────────────────────────────────────────────────────────────────────────────

type Num = { v: number; dec: number; sign: -1 | 0 | 1; raw: string }
function numbers(s: string): Num[] {
  const out: Num[] = []
  for (const m of s.matchAll(/([+−-]?)\s?(\d+(?:[.,]\d+)?)/g)) {
    const body = m[2]!.replace(',', '.')
    const dec = body.includes('.') ? body.split('.')[1]!.length : 0
    out.push({ v: Number(body), dec, sign: m[1] === '+' ? 1 : m[1] ? -1 : 0, raw: m[0] })
  }
  return out
}
const matches = (n: Num, v: number) => Math.abs(n.v - Math.round(Math.abs(v) * 10 ** n.dec) / 10 ** n.dec) < 1e-9
const hasValue = (s: string, v: number) => numbers(s).some((n) => matches(n, v))

// ─────────────────────────────────────────────────────────────────────────────
// 8. 3D-подписи: символы и числа ядра
// ─────────────────────────────────────────────────────────────────────────────

{
  const allowed3d = [SALT.cellPm.a, METAL.cellPm.a, METAL.cellPm.c!, bondLengthPm('O=O'), bondLengthPm('Mg-O'), SALT.cationAnionPm, dHfKJ('MgO(s)'), ...Object.values(SALT.coordination), ...Object.values(METAL.coordination)]
  for (const l of MGO_LABELS) {
    for (const k of l.keys) {
      const bare = k.text.replace(/\{\w+\}/g, '')
      ok(`подпись ${l.id}: без кириллицы`, !/[А-Яа-яЁё]/.test(bare), k.text)
      ok(`подпись ${l.id}: без фраз`, !/[a-z]{3,}/.test(bare.replace(METAL.spaceGroup, '').replace(SALT_SG_DISPLAY, '')), k.text)
      ok(`подпись ${l.id}: нет ASCII-записи группы «${SALT.spaceGroup}»`, !bare.includes(SALT.spaceGroup), k.text)
      ok(`подпись ${l.id}: единицы только токенами`, !/\b(pm|kJ\/mol|kJ)\b/.test(bare) && !/\((s|g|l|aq)\)/.test(bare), k.text)
      if (bare.includes(SALT_SG_DISPLAY)) ok(`подпись ${l.id}: группа из ядра`, bare.trim() === hermannMauguinDisplay(SALT.spaceGroup))
      for (const n of numbers(bare.replace(SALT_SG_DISPLAY, '').replace(METAL.spaceGroup, ''))) {
        ok(`подпись ${l.id}: число ${n.raw} из ядра`, allowed3d.some((v) => matches(n, v)), k.text)
      }
    }
  }
  const text = (id: string) => MGO_LABELS.find((l) => l.id === id)!.keys[0]!.text
  // Символ Германа — Могена: «-3» ядра → 3̄ (U+0304) в кадре; группа № 225 — та, что в ядре.
  ok('подпись sg = Fm3̄m из ядра (надчёркнутая 3, не «-3»)', text('sg') === SALT.spaceGroup.replace(/-(\d)/g, '$1\u0304') && !text('sg').includes('-') && SALT.spaceGroupNo === 225, text('sg'))
  const exact = (s: string, v: number) => numbers(s).length === 1 && hasValue(s, v)
  ok('подпись газовой пары = r_e(MgO, г.) со всеми знаками ядра', exact(text('dGas'), bondLengthPm('Mg-O')) && numbers(text('dGas'))[0]!.v === bondLengthPm('Mg-O'))
  ok('подпись O=O = r_e ядра со всеми знаками', exact(text('oBond'), bondLengthPm('O=O')) && numbers(text('oBond'))[0]!.v === bondLengthPm('O=O'))
  ok('подпись пары в решётке = cationAnionPm', exact(text('dCrystal'), SALT.cationAnionPm))
  ok('подпись a = параметр ячейки MgO', hasValue(text('cellA'), SALT.cellPm.a))
  ok('подпись a металла = параметр ячейки ГПУ', hasValue(text('metalA'), METAL.cellPm.a))
  const dH = numbers(text('dH'))[0]!
  ok('подпись ΔH°f = табличная ΔH°f со знаком', dH.sign === -1 && matches(dH, dHfKJ('MgO(s)')))
  // Подписи зарядов частиц сюжета = заряды кадра после каждого переноса.
  const lastKey = (id: string) => MGO_LABELS.find((l) => l.id === id)!.keys.at(-1)!.text
  ok('последние подписи сюжета — Mg²⁺ и O²⁻', ['mg1', 'mg2'].every((id) => lastKey(id) === 'Mg²⁺') && ['oA', 'oB'].every((id) => lastKey(id) === 'O²⁻'))

  const known = new Set(Object.keys(SCENE_LABEL_TOKENS.ru))
  for (const token of labelTokensUsed(MGO_LABELS)) ok(`токен {${token}} есть в словаре`, known.has(token))
  for (const locale of LOCALES) {
    const states = createLabelStates(MGO_LABELS)
    localizeSceneLabels(states, locale)
    for (const st of states) ok(`[${locale}] подпись ${st.id} раскрыта`, !/\{\w+\}/.test(st.text) && st.text.trim().length > 0)
  }
  const ru = createLabelStates(MGO_LABELS)
  const en = createLabelStates(MGO_LABELS)
  localizeSceneLabels(ru, 'ru')
  localizeSceneLabels(en, 'en')
  ok('подписи ru отличаются от en (единицы переведены)', ru.some((s, i) => s.text !== en[i]!.text))
  for (const locale of ['ru', 'uz'] as const) {
    const st = createLabelStates(MGO_LABELS)
    localizeSceneLabels(st, locale, true)
    const g = st.find((x) => x.id === 'dGas')!.text
    ok(`[${locale}] 3D-число с десятичной запятой: «${g}»`, g.includes(String(bondLengthPm('Mg-O')).replace('.', ',')) && !/\d\.\d/.test(st.map((x) => x.text).join(' ')))
  }
  for (const l of MGO_LABELS) for (const w of l.windows) ok(`окно подписи ${l.id}`, w[0] < w[1] && w[0] >= 0 && w[1] <= MGO_END + 1e-9)
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Тексты урока: числа ↔ ядро по местам, синхронность языков
// ─────────────────────────────────────────────────────────────────────────────

const st = (id: MgoStageId) => mgoStageKJ(id)
const abs = Math.abs
const rMg0 = radiusForSpecies('Mg', 0)
const rO0 = radiusForSpecies('O', 0)
const rMgIon = radiusForSpecies('Mg', 2)
const rOIon = radiusForSpecies('O', -2)
const radiiSum = rMgIon + rOIon
const dGas = bondLengthPm('Mg-O')
const dO2 = 2 * dHfKJ('O(g)')
const FLAME = FLAME_TEMPERATURES.mg_ribbon_air
/** Шкала Кельвина: T(K) = t(°C) + 273,15 — внешняя константа (определение шкалы, не данные вещества). */
const KELVIN_OFFSET = 273.15
const meltK = SALT.meltingC! + KELVIN_OFFSET
const volC = SALT.volatilizationK! - KELVIN_OFFSET
/**
 * Внешние справочные значения, которых нет в ядре и которые урок называет ТОЛЬКО как разброс
 * (решение владельца 6 и раздел «Законы»): CRC Handbook U(MgO) = −3791 и верхняя граница
 * литературного разброса EA₂(O) = +844. Сверяются с ядром по порядку величины ниже.
 */
const U_REF_CRC = 3791
const EA2_REF_MAX = 844
const U_DIFF_PCT = ((U_REF_CRC - abs(MGO_LATTICE_KJ)) / abs(MGO_LATTICE_KJ)) * 100
/** Стандартные условия: 25 °C / 298 K. */
const EXTERNAL = [25, 298]
/**
 * Внешние справочные значения научной приёмки (в ядре их нет, каждое проверяется ниже по смыслу):
 *   • μ(MgO, г., X¹Σ⁺) ≈ 6,2 Д — Büsener, Heinrich, Hese, Chem. Phys. 112 (1987) 139 (молекулярный пучок);
 *   • т. пл. Mg 650 °C, т. кип. Mg 1090 °C, т. кип. MgO ≈ 3600 °C (с разложением) — CRC 97th;
 *   • т. пл. MgO 3105 K — NIST-JANAF (так в комментарии crystalData.mgo); разброс 2825–2852 °C — там же;
 *   • масса школьной ленты 0,1–1 г — порядок величины для оценки числа атомов.
 * Физические константы (определения СИ): e = 1,602176634·10⁻¹⁹ Кл, 1 Д = 3,33564·10⁻³⁰ Кл·м.
 */
const MGO_DIPOLE_D = 6.2
const MG_MELT_C = 650
const MG_BOIL_C = 1090
const MGO_BOIL_C = 3600
const MGO_MELT_K_JANAF = 3105
const MGO_MELT_RANGE_C = [2825, 2852] as const
const RIBBON_MASS_G = [0.1, 1] as const
const E_CHARGE = 1.602176634e-19
const DEBYE = 3.33564e-30
/** Диполь точечных зарядов ±q на r_e(MgO, г.), Д. */
const muPoint = (q: number) => (q * E_CHARGE * dGas * 1e-12) / DEBYE
const MU_PC2 = muPoint(2)
const MU_PC1 = muPoint(1)
/** Насколько верх измеренного диапазона пламени ниже потолка Глассмана, K. */
const FLAME_GAP_K = SALT.volatilizationK! - (FLAME.max + KELVIN_OFFSET)
/** U(MgO), согласованная с EA₂ = +844 при той же сумме цикла, и её отношение к U(NaCl). */
const RATIO_AT_EA2_MAX = Math.round(((abs(MGO_LATTICE_KJ) + (EA2_REF_MAX - OXIDE_SECOND_EA_KJ)) / abs(NACL_LATTICE_REF_KJ)) * 10) / 10
const FRAG_MG = SALT_FRAG.sites.filter((x) => x.el === 'Mg').length
const FRAG_O = SALT_FRAG.sites.filter((x) => x.el === 'O').length
const FRAG_CHARGE = SALT_FRAG.sites.reduce((q, x) => q + (x.charge ?? 0), 0)
const LATTICE_NEW = MGO_ATOMS.filter((a) => a.kind === 'lattice').length
const METAL_LEFT = MGO_ATOMS.filter((a) => a.kind === 'metal').length
const STORY_MG = MGO_ATOMS.filter((a) => a.kind === 'story' && a.el === 'Mg').length
const N_AVOGADRO = 6.02214076e23
const ribbonExp = RIBBON_MASS_G.map((m) => Math.floor(Math.log10((m / ATOMIC_DATA.Mg.atomicMassU) * N_AVOGADRO)))

// [major 1] Газовая MgO — не пара ±2: измеренный диполь меньше даже диполя зарядов ±1.
ok('диполь точечных ±2 на r_e ≈ 16,8 Д, ±1 ≈ 8,4 Д', Math.round(MU_PC2 * 10) / 10 === 16.8 && Math.round(MU_PC1 * 10) / 10 === 8.4, `${MU_PC2.toFixed(2)} / ${MU_PC1.toFixed(2)}`)
ok('μ(MgO, г.) < μ(±1) < μ(±2): эффективный заряд ≲ 1', MGO_DIPOLE_D < MU_PC1 && MGO_DIPOLE_D / MU_PC2 < 0.5)
// [major 2] Критерий Глассмана: металл кипит ниже улетучивания оксида → парофазное горение.
ok('т. кип. Mg ниже потолка улетучивания MgO (Mg — парофазный металл)', MG_BOIL_C + KELVIN_OFFSET < SALT.volatilizationK! && MG_MELT_C < MG_BOIL_C)
// [minor 4] т. пл. в K — JANAF 3105, а не обратный пересчёт 2830 + 273,15.
ok('JANAF 3105 K округляется к т. пл. ядра (±5 °C)', Math.abs(MGO_MELT_K_JANAF - KELVIN_OFFSET - SALT.meltingC!) <= 5 && Math.round(meltK) !== MGO_MELT_K_JANAF)
ok('разброс т. пл. MgO содержит значение ядра; кипение выше плавления и потолка', MGO_MELT_RANGE_C[0] <= SALT.meltingC! && SALT.meltingC! <= MGO_MELT_RANGE_C[1] && MGO_BOIL_C > volC)
// [minor 5] Верх диапазона пламени практически у потолка — «азот» тут ни при чём.
ok('верх измеренного пламени ниже потолка меньше чем на 100 K', FLAME_GAP_K > 0 && FLAME_GAP_K < 100, FLAME_GAP_K.toFixed(2))
// [minor 3] Отношение U сильно зависит от EA₂: при +844 оно ближе к Кулону, но ниже его.
ok('отношение при EA₂ = +844 между реальным и кулоновским', RATIO_AT_EA2_MAX > MGO_LATTICE_RATIO && RATIO_AT_EA2_MAX < MGO_COULOMB_RATIO, `${RATIO_AT_EA2_MAX}`)
// [minor 8] Вырезка заряжена: ионов одного знака на один больше.
ok('во фрагменте Mg²⁺ на один больше O²⁻, заряд вырезки +2', FRAG_MG - FRAG_O === 1 && FRAG_CHARGE === 2 && FRAG_MG + FRAG_O === SALT_FRAG.sites.length)
ok('новых ионов решётки = фрагмент − 4 иона сюжета', LATTICE_NEW === SALT_FRAG.sites.length - MGO_ATOMS.filter((a) => a.kind === 'story').length)
ok('атомов металла уходит = кусочек − Mg сюжета', METAL_LEFT === METAL_FRAG.sites.length - STORY_MG)
// [minor 9] Лента 0,1–1 г: 10²¹–10²² атомов, а не 10²³.
ok('лента 0,1–1 г → порядки 10²¹ и 10²²', ribbonExp[0] === 21 && ribbonExp[1] === 22, ribbonExp.join(','))
// [minor 11] Поправки 5/2 RT сокращаются: электронов ушло столько же, сколько пришло.
ok('ступеней ионизации столько же, сколько ступеней сродства (±5/2 RT сокращаются)', MGO_LADDER.stages.filter((x) => x.id.startsWith('ionization')).length === MGO_LADDER.stages.filter((x) => x.id.startsWith('affinity')).length)

ok('CRC U отличается от ядра меньше чем на 0,1 %', U_DIFF_PCT > 0 && U_DIFF_PCT < 0.1, U_DIFF_PCT.toFixed(3))
ok('верхняя граница EA₂ больше значения ядра и в пределах 15 %', EA2_REF_MAX > OXIDE_SECOND_EA_KJ && EA2_REF_MAX < OXIDE_SECOND_EA_KJ * 1.15)
ok('потолок Глассмана выше плавления и выше реального пламени', SALT.volatilizationK! > meltK && volC > FLAME.max)
ok('D(O=O) = 2·ΔH°f(O, г.) округляется к энергии связи ядра', near(Math.round(dO2), 498, 0.5))
ok('по ребру фрагмента 5 ионов (из ячеек)', SALT_FRAG.cells[0] * 2 + 1 === 5)

const CORE_VALUES: number[] = [
  METAL.cellPm.a,
  METAL.cellPm.c!,
  METAL.cationAnionPm,
  bondLengthPm('O=O'),
  dO2,
  rMg0,
  rO0,
  rMgIon,
  rOIon,
  rOIon / rMgIon,
  ...MGO_LADDER.stages.map((s) => s.dH),
  MGO_SUM_KJ,
  MGO_DHF_TABLE_KJ,
  MGO_RESIDUAL_KJ,
  MGO_COST_BEFORE_LATTICE_KJ,
  MGO_REACTION_DH_KJ,
  dGas,
  radiiSum,
  radiiSum - dGas,
  SPECIES_SCALE,
  LATTICE_BALL_SCALE,
  SALT.cationAnionPm,
  SALT.cellPm.a,
  SALT.densityGCm3,
  SALT_FRAG.sites.length,
  NACL.cationAnionPm,
  NACL_LATTICE_REF_KJ,
  NACL.meltingC!,
  MGO_LATTICE_RATIO,
  MGO_COULOMB_RATIO,
  SALT.meltingC!,
  SALT.volatilizationK!,
  volC,
  FLAME.min,
  FLAME.max,
  U_REF_CRC,
  U_DIFF_PCT,
  EA2_REF_MAX,
  ...EXTERNAL,
  MGO_DIPOLE_D,
  MU_PC2,
  MU_PC1,
  MG_MELT_C,
  MG_BOIL_C,
  MGO_BOIL_C,
  MGO_MELT_K_JANAF,
  ...MGO_MELT_RANGE_C,
  RIBBON_MASS_G[0],
  FLAME_GAP_K,
  RATIO_AT_EA2_MAX,
  FRAG_MG,
  FRAG_O,
  LATTICE_NEW,
]

/** Малые целые — счёт (2 Mg, 6 соседей, Z = 4, 3s², ×2, «шаг 5», 10²³ → 10, КЧ 12). */
const isCount = (n: Num) => n.dec === 0 && n.v <= 12

const fields = (t: MgoMechanismText): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const id of MGO_STEP_IDS) {
    const s = t.steps[id]
    out[`${id}.body`] = s.body
    out[`${id}.equation`] = s.equation
    out[`${id}.note`] = s.note ?? ''
    out[`${id}.speak`] = s.speak
  }
  out.legend = t.legend.electron + ' ' + t.legend.orbitalPhase
  out.safety = t.safety
  out.energy = Object.values(t.energy.stages).join(' ') + ' ' + t.energy.caption + ' ' + t.energy.sources
  return out
}
const strip = (s: string) => s.replaceAll(SALT.spaceGroup, '').replaceAll(SALT_SG_DISPLAY, '').replaceAll(METAL.spaceGroup, '')

for (const locale of LOCALES) {
  const t = getMgoMechanismText(locale)
  ok(`[${locale}] заголовок и безопасность`, t.intro.title.length > 0 && t.safety.length > 20)
  for (const id of MGO_STEP_IDS) {
    const s = t.steps[id]
    ok(`[${locale}] ${id}: заголовок, уравнение, реплика`, s.title.trim().length > 0 && s.equation.trim().length > 0 && s.speak.trim().length > 0)
    ok(`[${locale}] ${id}: 2–4 предложения`, s.body.split(/[.!?]\s/).length >= 2)
    ok(`[${locale}] ${id}: есть note (всё схематичное названо)`, (s.note ?? '').length > 0)
  }
  ok(`[${locale}] aria-подпись лестницы`, t.energy.summary.includes('{dH}'))

  const f = fields(t)
  for (const [key, s] of Object.entries(f)) {
    for (const n of numbers(strip(s))) {
      if (isCount(n)) continue
      ok(`[${locale}] ${key}: число ${n.raw.trim()} есть в ядре`, CORE_VALUES.some((v) => matches(n, v)), s.slice(0, 80))
    }
  }
  const all = strip(Object.values(f).join(' '))
  // Температура плавления MgO — число ядра; справочный разброс — только парой границ.
  const meltLike = numbers(all).filter((n) => n.v >= 2800 && n.v <= 2870)
  ok(`[${locale}] т. пл. MgO — число ядра или границы разброса`, meltLike.length > 0 && meltLike.every((n) => n.dec === 0 && (n.v === SALT.meltingC || MGO_MELT_RANGE_C.includes(n.v as 2825))), meltLike.map((n) => n.raw).join(' '))
  ok(`[${locale}] границы разброса т. пл. идут парой`, meltLike.filter((n) => n.v === MGO_MELT_RANGE_C[0]).length === meltLike.filter((n) => n.v === MGO_MELT_RANGE_C[1]).length)
  ok(`[${locale}] нет обратного пересчёта т. пл. в K (${meltK.toFixed(2)})`, !numbers(all).some((n) => n.dec === 0 && n.v === Math.round(meltK)))
  // [major 1] Газовая молекула не записана как ионная пара ±2 ни в теле, ни в уравнении шага 5.
  ok(`[${locale}] шаг 5: газовая MgO не записана как Mg²⁺O²⁻`, !/Mg²⁺\s?O²⁻/.test(f['attraction.body']! + f['attraction.equation']!))
  // [minor 12] В тексте — учебная запись группы.
  ok(`[${locale}] группа MgO в тексте — Fm3̄m, не «${SALT.spaceGroup}»`, !all.includes(SALT.spaceGroup) && Object.values(f).join(' ').includes(SALT_SG_DISPLAY))
  // [minor 9] Порядки числа атомов в ленте — из массы ленты.
  {
    const SUP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }
    const exps = [...f['reactants.note']!.matchAll(/10([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g)].map((m) => Number([...m[1]!].map((c) => SUP[c]).join('')))
    ok(`[${locale}] порядки атомов в ленте = log₁₀(m/M·N_A)`, exps.length === ribbonExp.length && exps.every((e, i) => e === ribbonExp[i]), exps.join(','))
    const cnt = numbers(f['reactants.note']!).filter(isCount).map((n) => n.v)
    ok(`[${locale}] note шага 1: ${STORY_MG} Mg в сюжете и ${METAL_LEFT} уходящих атомов`, cnt.includes(STORY_MG) && cnt.includes(METAL_LEFT))
    const q = numbers(f['lattice.note']!).find((n) => n.sign === 1 && n.dec === 0 && n.v < 10)
    ok(`[${locale}] заряд вырезки в note = заряд фрагмента ядра`, q != null && q.v === FRAG_CHARGE)
  }
  // [minor 6] Безопасность: уравнение горения Mg в CO₂ сбалансировано.
  {
    const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
    const eqm = /\(([^()]*→[^()]*)\)/.exec(t.safety)
    ok(`[${locale}] безопасность: есть уравнение горения Mg в CO₂`, eqm != null && /CO₂/.test(eqm[1]!.split('→')[0]!))
    const side = (x: string) => {
      const m = new Map<string, number>()
      for (const term of x.split('+')) {
        const tm = /^\s*(\d*)\s*(\S+)\s*$/.exec(term)!
        const k = tm[1] ? Number(tm[1]) : 1
        const formula = [...tm[2]!].map((c) => SUB[c] ?? c).join('')
        for (const e of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) m.set(e[1]!, (m.get(e[1]!) ?? 0) + k * (e[2] ? Number(e[2]) : 1))
      }
      return m
    }
    const [L, Rr] = eqm![1]!.split('→').map(side) as [Map<string, number>, Map<string, number>]
    ok(`[${locale}] безопасность: 2 Mg + CO₂ → 2 MgO + C сбалансировано`, [...new Set([...L.keys(), ...Rr.keys()])].every((k) => L.get(k) === Rr.get(k)))
  }
  // Верхняя граница измеренного пламени идёт только в паре с нижней (диапазон), а не как «потолок».
  for (const m of all.matchAll(new RegExp(`(\\d+)\\s?–\\s?${FLAME.max}`, 'g'))) ok(`[${locale}] ${FLAME.max} — верх диапазона пламени`, Number(m[1]) === FLAME.min)
  ok(`[${locale}] ${FLAME.max} встречается только в диапазоне пламени`, numbers(all).filter((n) => n.v === FLAME.max).length === [...all.matchAll(new RegExp(`${FLAME.min}\\s?–\\s?${FLAME.max}`, 'g'))].length)
  // EA₁ кислорода — одно значение ядра (−141,0), знак IUPAC «+» назван ровно один раз.
  const ea1 = numbers(all).filter((n) => n.v >= 140.5 && n.v <= 141.5)
  ok(`[${locale}] EA₁ кислорода везде одним числом ядра`, ea1.length > 0 && ea1.every((n) => n.dec === 1 && matches(n, st('affinity1'))), ea1.map((n) => n.raw).join(' '))
  ok(`[${locale}] конвенция IUPAC (+сродство) названа ровно один раз`, ea1.filter((n) => n.sign === 1).length === 1)
  // EA₂ — всегда со знаком «+» (эндотермична).
  const ea2 = numbers(all).filter((n) => near(n.v, OXIDE_SECOND_EA_KJ, 0.5))
  ok(`[${locale}] EA₂ = +${OXIDE_SECOND_EA_KJ} и нигде не отрицательна`, ea2.length > 0 && ea2.every((n) => n.sign !== -1))
  // Шаг 5 показывает газовую пару: кристаллическое расстояние в теле и уравнении шага не звучит.
  ok(`[${locale}] шаг 5: в теле и уравнении нет кристаллического d`, !hasValue(f['attraction.body']! + ' ' + f['attraction.equation']!, SALT.cationAnionPm))

  // Сумма цикла в тексте: слагаемые = ступени ядра по порядку, итог = сумма, рядом — таблица и расхождение.
  {
    const body = t.steps.energy.body
    const eq = body.indexOf('=')
    const terms = [...body.slice(0, eq).matchAll(/([+−-])\s?(\d+[.,]\d+)/g)].map((m) => (m[1] === '+' ? 1 : -1) * Number(m[2]!.replace(',', '.')))
    const res = /([+−-])\s?(\d+[.,]\d+)/.exec(body.slice(eq))!
    const total = (res[1] === '+' ? 1 : -1) * Number(res[2]!.replace(',', '.'))
    const cycle = BORN_HABER.mgo.stages.map((s) => s.dHKJ)
    ok(`[${locale}] сумма в тексте: слагаемые = ступени ядра`, terms.length === cycle.length && terms.every((v, i) => near(v, cycle[i]!, 0.05)), terms.join(' '))
    ok(`[${locale}] сумма в тексте сходится арифметически`, near(terms.reduce((s, v) => s + v, 0), total, 0.05))
    ok(`[${locale}] итог суммы = сумма цикла ядра`, near(total, MGO_SUM_KJ, 0.05))
    const eqn = numbers(t.steps.energy.equation).find((n) => n.dec > 0)!
    ok(`[${locale}] ΔH уравнения = 2·ΔH°f со знаком минус`, eqn.sign === -1 && matches(eqn, 2 * dHfKJ('MgO(s)')))
    const ueq = numbers(t.steps.lattice.equation).find((n) => n.v > 1000)!
    ok(`[${locale}] U в уравнении шага 6 — отрицательное, как в ядре`, ueq.sign === -1 && matches(ueq, MGO_LATTICE_KJ))
  }
}

// ─── Привязка «число ↔ величина»: ТО число на ТОМ месте ───
{
  const seq = (s: string) => numbers(strip(s)).filter((n) => !isCount(n)).map((n) => n.v)
  const sameSeq = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => near(v, b[i]!, 1e-9))
  const expect: Record<string, number[]> = {
    'reactants.body': [METAL.cellPm.a, METAL.cellPm.c!, METAL.cellPm.a, METAL.cationAnionPm, bondLengthPm('O=O'), dO2, rMg0, rO0, 25, MG_MELT_C],
    'reactants.note': [RIBBON_MASS_G[0]],
    'ignition.body': [st('sublimation'), st('dissociation')],
    'ignition.note': [MG_BOIL_C, SALT.volatilizationK!, volC, FLAME.min, FLAME.max, FLAME_GAP_K, MGO_MELT_K_JANAF, SALT.meltingC!],
    'transfer.body': [st('ionization1'), abs(st('affinity1')), abs(st('affinity1'))],
    'second.body': [st('ionization2'), rMg0, rMgIon, st('affinity2'), rO0, rOIon, rOIon / rMgIon],
    'second.note': [OXIDE_SECOND_EA_KJ, EA2_REF_MAX, OXIDE_SECOND_EA_KJ, abs(MGO_LATTICE_KJ)],
    'attraction.body': [dGas],
    'attraction.equation': [dGas],
    'attraction.note': [MGO_DIPOLE_D, dGas, MU_PC2, MU_PC1, dGas, rMgIon, rOIon, radiiSum, dGas, radiiSum - dGas, SPECIES_SCALE, SALT.cationAnionPm],
    'lattice.body': [
      SALT.cellPm.a,
      SALT.densityGCm3,
      SALT.cationAnionPm,
      dGas,
      abs(MGO_LATTICE_KJ),
      MGO_LATTICE_RATIO,
      abs(NACL_LATTICE_REF_KJ),
      NACL.cationAnionPm,
      SALT.cationAnionPm,
      MGO_COULOMB_RATIO,
      MGO_LATTICE_RATIO,
      EA2_REF_MAX,
      OXIDE_SECOND_EA_KJ,
      RATIO_AT_EA2_MAX,
      SALT.meltingC!,
      NACL.meltingC!,
    ],
    'lattice.equation': [abs(MGO_LATTICE_KJ)],
    'lattice.note': [SALT_FRAG.sites.length, LATTICE_NEW, FRAG_MG, FRAG_O, LATTICE_BALL_SCALE, rMgIon, rOIon, radiiSum, SALT.cationAnionPm, ...MGO_MELT_RANGE_C, SALT.meltingC!, MGO_BOIL_C, abs(MGO_LATTICE_KJ), OXIDE_SECOND_EA_KJ, U_REF_CRC, U_DIFF_PCT],
    'energy.body': [
      st('sublimation'),
      st('dissociation'),
      st('ionization1'),
      st('ionization2'),
      abs(st('affinity1')),
      st('affinity2'),
      abs(st('lattice')),
      abs(MGO_SUM_KJ),
      abs(MGO_DHF_TABLE_KJ),
      abs(MGO_RESIDUAL_KJ),
      MGO_COST_BEFORE_LATTICE_KJ,
      abs(MGO_REACTION_DH_KJ),
    ],
    'energy.equation': [abs(MGO_REACTION_DH_KJ)],
    'energy.note': [st('dissociation'), 298, dO2, 298, 298, abs(MGO_DHF_TABLE_KJ), abs(MGO_SUM_KJ)],
  }
  const ru = fields(getMgoMechanismText('ru'))
  for (const [key, want] of Object.entries(expect)) {
    const got = numbers(strip(ru[key]!)).filter((n) => !isCount(n))
    ok(`[ru] ${key}: числа стоят на своих местах`, got.length === want.length && got.every((n, i) => matches(n, want[i]!)), `${got.map((n) => n.v).join(' ')} | ожидалось ${want.map((v) => v.toFixed(2)).join(' ')}`)
  }
  for (const locale of LOCALES) {
    const f = fields(getMgoMechanismText(locale))
    const z = /Z = (\d+)/.exec(f['lattice.body']!)
    ok(`[${locale}] Z в тексте = SALT.z`, z != null && Number(z[1]) === SALT.z)
    const cn = /(\d+):(\d+)/.exec(f['lattice.body']!)
    ok(`[${locale}] КЧ в тексте = SALT.coordination`, cn != null && Number(cn[1]) === SALT.coordination['Mg²⁺'] && Number(cn[2]) === SALT.coordination['O²⁻'])
    const cells = /(\d)×(\d)×(\d)/.exec(f['lattice.note']!)
    ok(`[${locale}] фрагмент в тексте = SALT_FRAG.cells`, cells != null && [1, 2, 3].every((i) => Number(cells[i]) === SALT_FRAG.cells[i - 1]))
    const mcells = /(\d)×(\d)×(\d)/.exec(f['reactants.body']!)
    ok(`[${locale}] кусочек металла в тексте = METAL_FRAG.cells`, mcells != null && [1, 2, 3].every((i) => Number(mcells[i]) === METAL_FRAG.cells[i - 1]))
    const nMetal = numbers(f['reactants.note']!).find((n) => n.v === METAL_FRAG.sites.length)
    ok(`[${locale}] число атомов металла в note = фрагмент`, nMetal != null)
    if (locale === 'ru') continue
    for (const key of Object.keys(f)) {
      ok(`[${locale}] ${key}: порядок чисел как в ru`, sameSeq(seq(f[key]!), seq(ru[key]!)), `${seq(f[key]!).join(' ')} | ru ${seq(ru[key]!).join(' ')}`)
    }
  }
}

console.log(`✓ mgo cinema: ${checks} проверок пройдено`)
console.log(`  шагов ${MGO_STEPS.length}, экранное время ${wall.toFixed(1)} с (${MGO_STEPS.map((s) => s.wall).join(' + ')} + хвост), сюжет ${MGO_END} с`)
console.log(`  цикл Борна — Габера: Σ = ${MGO_SUM_KJ} кДж/моль (таблица ${MGO_DHF_TABLE_KJ}, расхождение ${MGO_RESIDUAL_KJ}); U ${MGO_LATTICE_KJ} (CRC −${U_REF_CRC}, ${U_DIFF_PCT.toFixed(3)} %)`)
console.log(`  U(MgO)/U(NaCl) = ${MGO_LATTICE_RATIO}; Кулон q₁q₂/r: ${MGO_COULOMB_CHARGE_FACTOR}·${NACL.cationAnionPm}/${SALT.cationAnionPm} ≈ ${MGO_COULOMB_RATIO}`)
console.log(`  пара: газ ${dGas} пм → решётка ${SALT.cationAnionPm} пм; перекрытие полных сфер ${(radiiSum - dGas).toFixed(1)} пм`)
console.log(`  решётка: ${SALT_FRAG.sites.length} ионов, ${SALT_FRAG.cellEdges.length} рёбер; металл: ${METAL_FRAG.sites.length} атомов ГПУ, ${METAL_FRAG.cellEdges.length} рёбер`)
console.log(`  пламя: потолок Глассмана ${SALT.volatilizationK} K, т. пл. ${SALT.meltingC} °C (NIST-JANAF ${MGO_MELT_K_JANAF} K), лента ${FLAME.min}–${FLAME.max} °C`)
