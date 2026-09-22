#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт ЭТАЛОННОЙ сцены «ионная связь: 2 Na (тв.) + Cl₂ (г.) → 2 NaCl (тв.)».
 *
 * Сцена проверяется ДАННЫМИ, а не строками: раскадровка — чистая функция sampleNaclFrame(t),
 * весь урок сэмплируется в Node, а каждое число сверяется с научным ядром src/chemistry/data.
 * Проверок «есть ли в тексте слово/литерал» здесь НЕТ: числа ИЗВЛЕКАЮТСЯ из текста и сверяются
 * с ядром, наборы чисел ru / en / uz обязаны совпадать.
 *
 *   1. Хронометраж: 6 ± 1 шаг, каждый 4–7 экранных секунд, всего 26–34 с, cue лаборатории
 *      embryo → birth → complete строго после последнего шага.
 *   2. Раскадровка: дорожки монотонны, ни атом, ни камера не прыгают между кадрами 1/30 с.
 *   3. Геометрия ↔ ядро: Cl–Cl, ОЦК натрия (КЧ 8), газовая пара на r_e(NaCl, г.), решётка
 *      2×2×2 — 125 ионов, 5 по ребру, d = cationAnionPm, КЧ 6 у внутренних, заряды чередуются,
 *      54 ребра ячеек длиной a.
 *   4. Na → Na⁺ в кадр УХОДА электрона, Cl → Cl⁻ в кадр ПРИХОДА; сумма зарядов в кадре
 *      (с летящими e⁻) = 0 каждые 1/60 с; газовая пара — полные сферы Шеннона с перекрытием.
 *   5. На каждом шаге видимы только объекты этого шага; на паузе каждый видимый атом подписан.
 *   6. Финал без огня: все FX-амплитуды ≈ 0, свечение атомов решётки — базовое.
 *   7. Энергия: лестница = BORN_HABER.nacl, сумма = табличная ΔH°f, знаки.
 *   8. 3D-подписи: только формулы/числа/единицы-токены, числа — из ядра.
 *   9. Тексты: извлечённые числа ↔ ядро, синхронность ru/en/uz, одно значение Δ_eg H.
 *
 * Запуск: npx tsx scripts/test-nacl-cinema.mts
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  ATOMIC_DATA,
  BORN_HABER,
  bondEnthalpyKJ,
  bondLengthPm,
  dHfKJ,
  getCrystal,
  LATTICE_ENTHALPY_KJ,
  radiusForSpecies,
} from '../src/chemistry/data/index.ts'
import { storyWallDuration } from '../src/lab/cinema/core/storyTime.ts'
import { sampleShot } from '../src/lab/cinema/scenes/kit/camera.ts'
import { assertCameraContinuity } from '../src/lab/cinema/scenes/kit/camera.ts'
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
  NACL_ATOM_INDEX,
  NACL_ATOMS,
  NACL_CAMERA,
  NACL_CUES,
  NACL_DIM_A_DROP,
  NACL_EDGE_A,
  NACL_ELECTRONS,
  NACL_END,
  NACL_GEOM,
  NACL_LABELS,
  NACL_SEGMENTS,
  NACL_SNAP,
  NACL_STEPS,
  NACL_STEP_IDS,
  NACL_TIMING,
  SALT_FRAG,
  SALT_SITE_OF,
  createNaclFrame,
  sampleNaclFrame,
  validateNaclStoryboard,
  type NaclFrame,
} from '../src/lab/cinema/scenes/nacl/naclStoryboard.ts'
import {
  NACL_COST_BEFORE_LATTICE_KJ,
  NACL_DHF_KJ,
  NACL_DHF_TABLE_KJ,
  NACL_HALF_REACTIONS,
  NACL_LADDER,
  NACL_LATTICE_KJ,
  NACL_REACTION,
  NACL_REACTION_DH_KJ,
  naclStageKJ,
  validateNaclEnergetics,
} from '../src/lab/cinema/scenes/nacl/naclEnergetics.ts'
import { getNaclMechanismText, type NaclLocale, type NaclMechanismText } from '../src/lab/cinema/scenes/nacl/naclMechanismText.ts'
import { naclScientificWatchdogMs } from '../src/lab/scientificSynthesis/naclScenarioTiming.ts'

const LOCALES: NaclLocale[] = ['ru', 'en', 'uz']
const frame = createNaclFrame()
const at = (t: number): NaclFrame => sampleNaclFrame(t, frame)
const idx = (id: string) => NACL_ATOM_INDEX.get(id)!

let checks = 0
function ok(label: string, cond: boolean, detail = ''): void {
  assert.ok(cond, `${label}${detail ? ` — ${detail}` : ''}`)
  checks++
}
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol

const SALT = getCrystal('nacl')!
const METAL = getCrystal('na_metal')!
const D_LATTICE = pmToScene(SALT.cationAnionPm)
const D_GAS = pmToScene(bondLengthPm('Na-Cl'))
const STEP_PAUSE = NACL_STEPS.map((s) => s.to)
const LAST = NACL_STEPS.length - 1

// ─────────────────────────────────────────────────────────────────────────────
// 1. Хронометраж и контракт лаборатории
// ─────────────────────────────────────────────────────────────────────────────

NACL_TIMING.validate()
ok('шагов 6 ± 1', NACL_STEPS.length >= 5 && NACL_STEPS.length <= 7, `${NACL_STEPS.length}`)
ok('id шагов совпадают', NACL_STEP_IDS.join(',') === NACL_STEPS.map((s) => s.id).join(','))
const wall = storyWallDuration(NACL_SEGMENTS)
ok('экранная длительность 26–34 с', wall >= 26 && wall <= 34, `${wall.toFixed(1)} с`)
ok('wallDuration kit = сумма сегментов', near(wall, NACL_TIMING.wallDuration, 1e-9))
for (const s of NACL_STEPS) ok(`шаг ${s.id}: 4–7 экранных секунд`, s.wall >= 4 && s.wall <= 7, `${s.wall}`)
const lastStepTo = NACL_STEPS[LAST]!.to
for (const id of ['embryo', 'birth', 'complete']) {
  const c = NACL_CUES.find((x) => x.id === id)!
  ok(`cue ${id} строго после последнего шага`, c.at > lastStepTo, `${c.at} ≤ ${lastStepTo}`)
}
for (const c of NACL_CUES) {
  if (['embryo', 'birth', 'complete'].includes(c.id)) continue
  ok(`cue ${c.id} внутри шагов`, c.at > 0 && c.at < lastStepTo)
}
ok('complete совпадает с концом сюжета', NACL_CUES.find((c) => c.id === 'complete')!.at === NACL_END)
ok('watchdog лаборатории положителен', naclScientificWatchdogMs() > 0)
for (let i = 0; i < NACL_STEPS.length; i++) {
  const s = NACL_STEPS[i]!
  ok(`stepIndexAt(${s.id})`, NACL_TIMING.stepIndexAt((s.from + s.to) / 2) === i)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Раскадровка: дорожки, рывки атомов и камеры, ноль аллокаций
// ─────────────────────────────────────────────────────────────────────────────

validateNaclStoryboard()
{
  const scratch = createNaclFrame()
  const buf = NACL_ATOMS.map((a) => ({ id: a.id, pos: new THREE.Vector3(), opacity: 0 }))
  assertNoPositionJumps(
    (t) => {
      sampleNaclFrame(t, scratch)
      for (let i = 0; i < NACL_ATOMS.length; i++) {
        buf[i]!.pos.copy(scratch.pos[i]!)
        buf[i]!.opacity = scratch.opacity[i]!
      }
      return buf
    },
    NACL_END,
    0.09,
    1 / 30,
  )
  checks++
  const cam = createSceneCamera()
  assertCameraContinuity((t) => sampleShot(NACL_CAMERA, t, cam), NACL_END)
  checks++

  // Видимость не щёлкает: у проявляющегося иона решётки растёт шар (доля радиуса), у остальных —
  // непрозрачность; радиус ионов сюжета щёлкает ТОЛЬКО в кадр прихода — это проверяет раздел 4.
  const fullR = NACL_ATOMS.map((a) => (a.kind === 'lattice' ? speciesRadius(a.el, a.el === 'Na' ? 1 : -1, LATTICE_BALL_SCALE) : 0))
  const presence = (i: number) => (NACL_ATOMS[i]!.kind === 'lattice' ? scratch.radius[i]! / fullR[i]! : scratch.opacity[i]!)
  let prev: Float32Array | null = null
  for (let t = 0; t <= NACL_END + 1e-9; t += 1 / 30) {
    sampleNaclFrame(t, scratch)
    const now = Float32Array.from(NACL_ATOMS, (_, i) => presence(i))
    if (prev) {
      let worst = 0
      for (let i = 0; i < NACL_ATOMS.length; i++) worst = Math.max(worst, Math.abs(now[i]! - prev[i]!))
      ok(`видимость без скачка при t=${t.toFixed(2)}`, worst <= 0.12, worst.toFixed(3))
    }
    prev = now
  }

  // Кадр пишет в заранее созданные объекты: ни одного нового вектора/подписи за кадр.
  const posRefs = scratch.pos.slice()
  const labelRefs = scratch.labels.slice()
  const labelPos = scratch.labels.map((l) => l.pos)
  for (let t = 0; t <= NACL_END; t += 0.5) sampleNaclFrame(t, scratch)
  ok('векторы позиций переиспользуются', scratch.pos.every((p, i) => p === posRefs[i]))
  ok('подписи переиспользуются', scratch.labels.every((l, i) => l === labelRefs[i] && l.pos === labelPos[i]))
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Геометрия раскадровки ↔ ядро
// ─────────────────────────────────────────────────────────────────────────────

// 3.1 Радиусы: катион меньше атома, анион больше; все — из ядра.
assertIonSizeOrder('Na', 1)
assertIonSizeOrder('Cl', -1)
ok('Na⁰ — металлический радиус ядра', speciesRadiusPm('Na', 0) === radiusForSpecies('Na', 0))
ok('Na⁺ — радиус Шеннона ядра', speciesRadiusPm('Na', 1) === radiusForSpecies('Na', 1))
ok('Cl⁻ — радиус Шеннона ядра', speciesRadiusPm('Cl', -1) === radiusForSpecies('Cl', -1))

// 3.2 Шаг 1: Cl₂ — молекула с длиной связи из bondData; натрий — ячейка ОЦК из crystalData.
at(STEP_PAUSE[0]!)
ok('Cl₂: d(Cl–Cl) = bondLengthPm', near(frame.pos[idx('clA')]!.distanceTo(frame.pos[idx('clB')]!), pmToScene(bondLengthPm('Cl-Cl'))))
ok('Cl₂: σ-связь видна', frame.bond.opacity > 0.9)
ok('Cl — газ, Na — металл (материалы)', frame.material[idx('clA')] === 'gas' && frame.material[idx('na1')] === 'metal')
ok('ячейка Na: 9 атомов', METAL_FRAG.sites.length === 9)
ok('ячейка Na: связей у центра = КЧ ядра', METAL_BONDS.length === METAL.coordination.Na)
for (const [a, b] of METAL_BONDS) {
  const d = frame.pos[idx(a)]!.distanceTo(frame.pos[idx(b)]!)
  ok(`металл ${a}–${b} = d(Na–Na) ядра (±0,05 пм — округление ядра)`, near(d / pmToScene(1), METAL.cationAnionPm, 0.05), (d / pmToScene(1)).toFixed(2))
}
ok('рёбра ячейки металла видны', frame.edgeSet === 'metal' && frame.edges > 0.9)

// 3.3 Шаг 4: газовые пары на r_e(NaCl, г.) из bondData, а НЕ на кристаллическом расстоянии.
at(STEP_PAUSE[3]!)
for (const [na, cl] of [['na1', 'clA'], ['na2', 'clB']] as const) {
  const d = frame.pos[idx(na)]!.distanceTo(frame.pos[idx(cl)]!)
  ok(`газовая пара ${na}/${cl}: d = bondLengthPm('Na-Cl')`, near(d, D_GAS, 1e-5), `${d.toFixed(4)} против ${D_GAS.toFixed(4)}`)
  // Полные сферы Шеннона (доля 1): d / (r₊ + r₋) на экране = r_e / (102 + 181) по данным — перекрытие честное.
  ok(`газовая пара ${na}/${cl}: полные радиусы Шеннона`, near(frame.radius[idx(na)]!, speciesRadius('Na', 1, 1), 1e-6) && near(frame.radius[idx(cl)]!, speciesRadius('Cl', -1, 1), 1e-6))
  const ratioScreen = d / (frame.radius[idx(na)]! + frame.radius[idx(cl)]!)
  const ratioData = bondLengthPm('Na-Cl') / (radiusForSpecies('Na', 1) + radiusForSpecies('Cl', -1))
  ok(`газовая пара ${na}/${cl}: d/(r₊+r₋) экрана = данным (перекрытие видно)`, near(ratioScreen, ratioData, 1e-6) && ratioScreen < 1, `${ratioScreen.toFixed(4)} против ${ratioData.toFixed(4)}`)
}
ok('газовое и кристаллическое расстояния различаются (ядро)', SALT.cationAnionPm - bondLengthPm('Na-Cl') > 40)
ok('линии поля видны на паузе шага 4', frame.fx.field > 0.5)
ok('ионная пара без «палочки»: σ-связь Cl–Cl давно погашена', frame.bond.opacity === 0)

// 3.4 Шаг 5: решётка 2×2×2 из базиса ядра.
at(STEP_PAUSE[4]!)
{
  ok('фрагмент — 125 ионов', SALT_FRAG.sites.length === 125)
  const vis = NACL_ATOMS.map((a, i) => ({ a, i })).filter(({ a }) => SALT_SITE_OF.has(a.id))
  ok('все 125 ионов фрагмента в кадре и видимы', vis.length === 125 && vis.every(({ i }) => frame.opacity[i]! > 0.99))
  // Позиции кадра = узлы фрагмента.
  for (const { a, i } of vis) {
    const s = SALT_FRAG.sites[SALT_SITE_OF.get(a.id)!]!
    ok(`ион ${a.id} в своём узле`, frame.pos[i]!.distanceTo(new THREE.Vector3(...s.posScene)) < 1e-6)
    ok(`ион ${a.id}: элемент узла`, s.el === a.el)
    ok(`ион ${a.id}: радиус иона (доля решётки)`, near(frame.radius[i]!, speciesRadius(a.el, a.el === 'Na' ? 1 : -1, LATTICE_BALL_SCALE), 1e-6))
    ok(`ион ${a.id}: материал ion`, frame.material[i] === 'ion')
  }
  // По ребру 5 ионов, КЧ 6 у внутренних, соседи противоположного знака на d = cationAnionPm.
  const xs = new Set(vis.map(({ i }) => Math.round(frame.pos[i]!.x / D_LATTICE)))
  ok('по ребру 5 ионов', xs.size === 5)
  let interior = 0
  for (const { a, i } of vis) {
    const p = frame.pos[i]!
    const nb = vis.filter(({ i: j }) => j !== i && Math.abs(frame.pos[j]!.distanceTo(p) - D_LATTICE) < 1e-4)
    ok(`ион ${a.id}: ближайшие соседи — противоионы`, nb.every(({ a: b }) => b.el !== a.el))
    const closer = vis.filter(({ i: j }) => j !== i && frame.pos[j]!.distanceTo(p) < D_LATTICE - 1e-4)
    ok(`ион ${a.id}: никого ближе a/2`, closer.length === 0)
    const inside = [p.x, p.y, p.z].every((c) => Math.abs(c) < 2 * D_LATTICE - 1e-6)
    if (inside) {
      interior++
      ok(`внутренний ион ${a.id}: КЧ = coordination ядра`, nb.length === SALT.coordination[a.el === 'Na' ? 'Na⁺' : 'Cl⁻'])
    }
  }
  ok('внутренних ионов 27', interior === 27)
  const center = SALT_FRAG.sites.findIndex((s) => s.posScene.every((c) => Math.abs(c) < 1e-9))
  const shell = coordinationShell(SALT_FRAG, center)
  ok('координационный многогранник центра — октаэдр (6 соседей, 12 рёбер)', shell.neighbors.length === 6 && shell.edges.length === 12)
  // Рёбра ячеек: 54 уникальных, каждое длиной a.
  ok('рёбер ячеек 54', SALT_FRAG.cellEdges.length === 54)
  for (const [p, q] of SALT_FRAG.cellEdges) {
    const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
    ok('ребро ячейки = a ядра', near(d, pmToScene(SALT.cellPm.a), 1e-5), d.toFixed(4))
  }
  ok('рёбра ячеек соли видны', frame.edgeSet === 'salt' && frame.edges > 0.9)
  const eA = Math.hypot(NACL_EDGE_A[0][0] - NACL_EDGE_A[1][0], NACL_EDGE_A[0][1] - NACL_EDGE_A[1][1], NACL_EDGE_A[0][2] - NACL_EDGE_A[1][2])
  ok('подпись a стоит у ребра длиной a', near(eA, pmToScene(SALT.cellPm.a), 1e-5))
  const lA = frame.labels.find((l) => l.id === 'cellA')!
  const mid = new THREE.Vector3((NACL_EDGE_A[0][0] + NACL_EDGE_A[1][0]) / 2, (NACL_EDGE_A[0][1] + NACL_EDGE_A[1][1]) / 2, (NACL_EDGE_A[0][2] + NACL_EDGE_A[1][2]) / 2)
  // Подпись a — под размерной линией нижнего переднего ребра, СНАРУЖИ сфер нижнего ряда (не на ионах).
  const rMaxLattice = speciesRadius('Cl', -1, LATTICE_BALL_SCALE)
  const bottomY = SALT_FRAG.boundsScene.min[1]
  ok('ребро подписи a — нижнее переднее', near(mid.y, bottomY, 1e-6) && near(mid.z, SALT_FRAG.boundsScene.max[2], 1e-6))
  ok('размерная линия a вне сфер', NACL_DIM_A_DROP > rMaxLattice)
  ok('подпись a под ребром, снаружи силуэта, по центру ребра', lA.pos.y < bottomY - rMaxLattice && near(lA.pos.x, mid.x, 1e-6) && lA.opacity > 0.9)
  ok('размерные линии видны на паузе шага 5', frame.dims.pair > 0.9 && frame.dims.edgeA > 0.9)
  // Пара сюжета в решётке — на cationAnionPm.
  ok('пара na1/clA в решётке на d = cationAnionPm', near(frame.pos[idx('na1')]!.distanceTo(frame.pos[idx('clA')]!), D_LATTICE, 1e-5))
  ok('металл давно погашен', NACL_ATOMS.every((a, i) => a.kind !== 'metal' || frame.opacity[i] === 0))
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Переход электрона: Na → Na⁺ в кадр ухода, Cl → Cl⁻ в кадр прихода, заряд сохраняется
// ─────────────────────────────────────────────────────────────────────────────

{
  const R = NACL_GEOM.radius
  assertSnapAt(NACL_SNAP.radiusNa1, NACL_ELECTRONS.e1.leave, R.na, R.naIon)
  assertSnapAt(NACL_SNAP.radiusClA, NACL_ELECTRONS.e1.arrive, R.cl, R.clIon)
  assertSnapAt(NACL_SNAP.radiusNa2, NACL_ELECTRONS.e2.leave, R.na, R.naIon)
  assertSnapAt(NACL_SNAP.radiusClB, NACL_ELECTRONS.e2.arrive, R.cl, R.clIon)
  checks += 4
  const dt = 1 / 60
  const lbl = (id: string) => frame.labels.find((l) => l.id === id)!.text
  for (const [na, cl, e, k] of [
    ['na1', 'clA', NACL_ELECTRONS.e1, 0],
    ['na2', 'clB', NACL_ELECTRONS.e2, 1],
  ] as const) {
    // Донор: кадр до ухода — атом; кадр ухода — катион (радиус, заряд, материал, подпись, 0 точек).
    at(e.leave - dt)
    const b = { r: frame.radius[idx(na)]!, q: frame.charge[idx(na)]!, m: frame.material[idx(na)], l: lbl(na) }
    at(e.leave)
    ok(`${na}: до ухода e⁻ — атом Na (радиус, заряд 0, газ)`, near(b.r, R.na) && b.q === 0 && b.m === 'gas')
    ok(`${na}: в кадр ухода e⁻ — Na⁺ (радиус, заряд +1, ion)`, near(frame.radius[idx(na)]!, R.naIon) && frame.charge[idx(na)] === 1 && frame.material[idx(na)] === 'ion')
    ok(`${na}: подпись Na → Na⁺ в кадр ухода`, b.l !== lbl(na) && lbl(na) === 'Na⁺')
    ok(`${na}: у Na⁺ ноль валентных точек`, frame.valence[k]!.count === 0)
    ok(`${cl}: в кадр ухода акцептор ещё атом`, frame.charge[idx(cl)] === 0 && near(frame.radius[idx(cl)]!, R.cl))
    // Акцептор: кадр до прихода — атом с семью точками; кадр прихода — анион, октет.
    at(e.arrive - dt)
    const c = { r: frame.radius[idx(cl)]!, q: frame.charge[idx(cl)]!, m: frame.material[idx(cl)], n: frame.valence[k + 2]!.count, arrived: frame.electrons[k]!.arrived, l: lbl(cl) }
    at(e.arrive)
    ok(`${cl}: до прихода — атом, 7 точек, газ`, near(c.r, R.cl) && c.q === 0 && c.m === 'gas' && c.n === 7 && !c.arrived)
    ok(`${cl}: электрон пришёл в этот кадр`, frame.electrons[k]!.arrived)
    ok(`${cl}: в тот же кадр — Cl⁻ (радиус, заряд −1, ion, октет)`, near(frame.radius[idx(cl)]!, R.clIon) && frame.charge[idx(cl)] === -1 && frame.material[idx(cl)] === 'ion' && frame.valence[k + 2]!.count === 8)
    ok(`${cl}: подпись Cl → Cl⁻ в тот же кадр`, c.l !== lbl(cl) && lbl(cl) === 'Cl⁻')
  }
  // Закон сохранения заряда: каждые 1/60 с шага 3 Σ зарядов частиц + (−1)·(летящие e⁻) = 0.
  const s3 = NACL_STEPS[2]!
  let worst = 0
  for (let t = s3.from; t <= s3.to + 1e-9; t += dt) {
    at(t)
    let q = 0
    for (const id of ['na1', 'na2', 'clA', 'clB']) q += frame.charge[idx(id)]!
    for (const e of [NACL_ELECTRONS.e1, NACL_ELECTRONS.e2]) if (t >= e.leave && t < e.arrive) q -= 1
    worst = Math.max(worst, Math.abs(q))
  }
  ok('шаг 3: заряд сохраняется в каждом кадре (Σq + летящие e⁻ = 0)', worst === 0, `${worst}`)
  // Лестница ставит ионизацию на уход электрона — 3D показывает Na⁺ в тот же момент.
  const ion = NACL_LADDER.stages.find((st) => st.kind === 'ionization')!
  ok('ступень ионизации лестницы = кадр ухода e⁻ (Na⁺ в 3D)', near(ion.at, NACL_ELECTRONS.e1.leave, 1e-9))
  // Пауза шага 2 держит «до»: у Na одна точка, у Cl семь (видны на паузе).
  at(STEP_PAUSE[1]!)
  ok('пауза шага 2: у Na одна валентная точка', frame.valence[0]!.count === 1 && frame.valence[0]!.amount > 0.9)
  ok('пауза шага 2: у Cl семь валентных точек', frame.valence[2]!.count === 7 && frame.valence[2]!.amount > 0.9)
  at(NACL_ELECTRONS.e1.leave - 1.0)
  ok('у Na одна валентная точка', frame.valence[0]!.count === 1 && frame.valence[0]!.amount > 0.5)
  ok('у Cl семь валентных точек', frame.valence[2]!.count === 7 && frame.valence[2]!.amount > 0.5)
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Только объекты текущего шага; на паузе каждый видимый атом подписан
// ─────────────────────────────────────────────────────────────────────────────

/** Размах группы атомов-хозяев подписи в текущем кадре (для одиночного атома — 0). */
function hostSpan(hosts: readonly string[]): number {
  let m = 0
  for (const a of hosts) for (const b of hosts) m = Math.max(m, frame.pos[idx(a)]!.distanceTo(frame.pos[idx(b)]!))
  return m
}

for (let si = 0; si < NACL_STEPS.length; si++) {
  const s = NACL_STEPS[si]!
  // (а) каждые 1/60 с: атомы чужих шагов строго невидимы
  let foreign = 0
  let at0 = -1
  for (let t = s.from; t <= s.to + 1e-9; t += 1 / 60) {
    at(t)
    for (let i = 0; i < NACL_ATOMS.length; i++) {
      const [a, b] = NACL_ATOMS[i]!.span
      const own = si >= a && si <= b
      if (!own && frame.opacity[i]! > 0) {
        foreign++
        if (at0 < 0) at0 = t
      }
    }
  }
  ok(`шаг ${s.id}: ни одного объекта чужого шага`, foreign === 0, `первый при t=${at0.toFixed(3)}`)

  // (б) пауза шага: видимый атом — видимая подпись-хозяин рядом
  at(s.to)
  const visibleLabels = frame.labels.map((l, k) => ({ st: l, def: NACL_LABELS[k]! })).filter(({ st }) => st.opacity > 0.5)
  ok(`пауза ${s.id}: есть подписи`, visibleLabels.length > 0)
  for (let i = 0; i < NACL_ATOMS.length; i++) {
    if (frame.opacity[i]! <= 0.02) continue
    const id = NACL_ATOMS[i]!.id
    const hosts = visibleLabels.filter(({ def }) => def.hosts.includes(id))
    // «Рядом»: не дальше размаха группы, которую подпись подписывает, плюс одна единица сцены.
    const closeHost = hosts.some(({ st, def }) => st.pos.distanceTo(frame.pos[i]!) <= hostSpan(def.hosts) + 1)
    ok(`пауза ${s.id}: атом ${id} подписан`, closeHost, `хозяев ${hosts.length}`)
    ok(`пауза ${s.id}: атом ${id} полностью проявлен (не полупрозрачный призрак)`, frame.opacity[i]! > 0.99, frame.opacity[i]!.toFixed(3))
  }
  // Подпись «ни о чём» тоже запрещена: у подписи-хозяина есть видимые атомы.
  for (const { st, def } of visibleLabels) {
    if (def.hosts.length === 0) continue
    ok(`пауза ${s.id}: подпись ${def.id} подписывает видимые атомы`, def.hosts.some((h) => frame.opacity[idx(h)]! > 0.5), st.text)
  }
}
// Атомы, ушедшие из кадра, гаснут полностью уже к паузе шага 2.
at(STEP_PAUSE[1]!)
ok('после сублимации ни одного атома металла', NACL_ATOMS.every((a, i) => a.kind !== 'metal' || frame.opacity[i] === 0))
// На паузе шага 4 решётки ещё нет, на паузе шага 5 газового расстояния уже нет.
{
  at(STEP_PAUSE[3]!)
  const lbl = (id: string) => frame.labels.find((l) => l.id === id)!.opacity
  ok('пауза шага 4: подпись газовой пары видна, решёточной нет', lbl('dGas') > 0.9 && lbl('dCrystal') === 0)
  at(STEP_PAUSE[4]!)
  ok('пауза шага 5: решёточная подпись видна, газовой нет', lbl('dCrystal') > 0.9 && lbl('dGas') === 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Финал без огня: все FX ≈ 0 внутри фрагмента на всём шаге 6
// ─────────────────────────────────────────────────────────────────────────────

{
  const s = NACL_STEPS[LAST]!
  at(NACL_STEPS[0]!.from + 0.01)
  const baseEmissive = frame.emissive[0]!
  const baseBloom = frame.camera.bloom
  for (let t = s.from; t <= s.to + 1e-9; t += 1 / 30) {
    at(t)
    const fx = frame.fx.electron1 + frame.fx.electron2 + frame.fx.field + frame.valence.reduce((m, v) => m + v.amount, 0)
    ok(`шаг 6, t=${t.toFixed(2)}: FX-амплитуды = 0`, fx === 0, `${fx}`)
    let hot = 0
    for (let i = 0; i < NACL_ATOMS.length; i++) if (frame.emissive[i] !== baseEmissive) hot++
    ok(`шаг 6, t=${t.toFixed(2)}: свечение атомов базовое`, hot === 0, `${hot} атомов светятся`)
    ok(`шаг 6, t=${t.toFixed(2)}: bloom базовый, тряски нет`, near(frame.camera.bloom, baseBloom) && frame.camera.shake === 0)
  }
  at(s.to)
  ok('конец шага 6: кристалл цел и виден', SALT_FRAG.sites.length === NACL_ATOMS.filter((_, i) => frame.opacity[i]! > 0.99).length)
  at(NACL_END)
  ok('в конце хвоста кадр затемнён', frame.fade > 0.95)
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Энергетика: лестница = ядро
// ─────────────────────────────────────────────────────────────────────────────

validateNaclEnergetics()
{
  const cycle = BORN_HABER.nacl
  ok('ступени лестницы = ступени BORN_HABER.nacl', NACL_LADDER.stages.length === cycle.stages.length)
  for (const st of cycle.stages) {
    const l = NACL_LADDER.stages.find((x) => x.id === st.id)!
    ok(`ступень ${st.id} = ядро`, l.dH === st.dHKJ)
    ok(`ступень ${st.id}: множитель 1 × perUnit`, (l.multiplier ?? 1) === 1 && (l.perUnitKJ == null || l.perUnitKJ === st.dHKJ))
  }
  ok('½D = ΔH°f(Cl, г.) ядра', naclStageKJ('dissociation') === dHfKJ('Cl(g)'))
  ok('сублимация = ΔH°f(Na, г.) ядра', naclStageKJ('sublimation') === dHfKJ('Na(g)'))
  ok('U цикла = LATTICE_ENTHALPY_KJ', NACL_LATTICE_KJ === LATTICE_ENTHALPY_KJ['NaCl(s)'])
  ok('Σ цикла = табличная ΔH°f (±0,05)', near(NACL_LADDER.sumKJ, dHfKJ('NaCl(s)'), 0.05), `${NACL_LADDER.sumKJ}`)
  ok('таблица лестницы = ядро', NACL_DHF_TABLE_KJ === dHfKJ('NaCl(s)'))
  ok('без решётки процесс эндотермический', NACL_COST_BEFORE_LATTICE_KJ > 0)
  ok('ΔH реакции = 2 · ΔH°f', near(NACL_REACTION_DH_KJ, 2 * dHfKJ('NaCl(s)'), 0.05))
  const byKind = Object.fromEntries(NACL_LADDER.stages.map((s) => [s.kind, s.dH]))
  ok('знаки: субл. > 0, ½D > 0, IE > 0, Δ_eg H < 0, U < 0', byKind.sublimation! > 0 && byKind.dissociation! > 0 && byKind.ionization! > 0 && byKind.affinity! < 0 && byKind.lattice! < 0)
  const levels = ladderLevels(NACL_LADDER)
  ok('последний уровень = сумма цикла', near(levels[levels.length - 1]!, NACL_LADDER.sumKJ))
  ok('ступени идут по времени сюжета и внутри шагов', NACL_LADDER.stages.every((s, i) => s.at > 0 && s.at < lastStepTo && (i === 0 || s.at >= NACL_LADDER.stages[i - 1]!.at)))
}

// Стехиометрия и электронный баланс.
{
  const count = (formula: string, coeff: number, into: Map<string, number>) => {
    for (const m of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) into.set(m[1]!, (into.get(m[1]!) ?? 0) + (m[2] ? Number(m[2]) : 1) * coeff)
  }
  const left = new Map<string, number>()
  const right = new Map<string, number>()
  for (const t of NACL_REACTION.left) count(t.formula, t.coeff, left)
  for (const t of NACL_REACTION.right) count(t.formula, t.coeff, right)
  for (const k of new Set([...left.keys(), ...right.keys()])) ok(`баланс по ${k}`, left.get(k) === right.get(k))
  ok('хлор — двухатомная молекула', NACL_REACTION.left.some((t) => t.formula === 'Cl2') && !NACL_REACTION.left.some((t) => t.formula === 'Cl'))
  const given = NACL_HALF_REACTIONS.filter((h) => h.id === 'oxidation').reduce((s, h) => s + h.electrons * h.times, 0)
  const taken = NACL_HALF_REACTIONS.filter((h) => h.id === 'reduction').reduce((s, h) => s + h.electrons * h.times, 0)
  ok('электронный баланс', given === taken)
  ok('зарядовый баланс', NACL_HALF_REACTIONS.reduce((s, h) => s + h.chargeLeft * h.times, 0) === 0 && NACL_HALF_REACTIONS.reduce((s, h) => s + h.chargeRight * h.times, 0) === 0)
  // Атомы в кадре: 2 Na + 2 Cl сюжета — ровно столько, сколько в уравнении.
  const story = NACL_ATOMS.filter((a) => a.kind === 'story')
  ok('в сюжете 2 Na и 2 Cl — как в уравнении', story.filter((a) => a.el === 'Na').length === left.get('Na') && story.filter((a) => a.el === 'Cl').length === left.get('Cl'))
}

// ─────────────────────────────────────────────────────────────────────────────
// Извлечение чисел из текста
// ─────────────────────────────────────────────────────────────────────────────

type Num = { v: number; dec: number; sign: -1 | 0 | 1; raw: string }
/** Все числа строки: «−348,6», «+107,3», «564.0», «2×2×2» → 2, 2, 2. Знак — только если стоит вплотную или через пробел перед числом. */
function numbers(s: string): Num[] {
  const out: Num[] = []
  for (const m of s.matchAll(/([+−-]?)\s?(\d+(?:[.,]\d+)?)/g)) {
    const body = m[2]!.replace(',', '.')
    const dec = body.includes('.') ? body.split('.')[1]!.length : 0
    out.push({ v: Number(body), dec, sign: m[1] === '+' ? 1 : m[1] ? -1 : 0, raw: m[0] })
  }
  return out
}
/** Совпадает ли число текста со значением ядра с точностью показанных знаков. */
const matches = (n: Num, v: number) => Math.abs(n.v - Math.round(Math.abs(v) * 10 ** n.dec) / 10 ** n.dec) < 1e-9
const hasValue = (s: string, v: number) => numbers(s).some((n) => matches(n, v))

// ─────────────────────────────────────────────────────────────────────────────
// 8. 3D-подписи: символы и числа ядра
// ─────────────────────────────────────────────────────────────────────────────

{
  const allowed3d = [SALT.cellPm.a, METAL.cellPm.a, bondLengthPm('Cl-Cl'), bondLengthPm('Na-Cl'), SALT.cationAnionPm, NACL_LADDER.sumKJ, ...Object.values(SALT.coordination)]
  for (const l of NACL_LABELS) {
    for (const k of l.keys) {
      const bare = k.text.replace(/\{\w+\}/g, '')
      ok(`подпись ${l.id}: без кириллицы (слова — в панели)`, !/[А-Яа-яЁё]/.test(bare), k.text)
      ok(`подпись ${l.id}: без фраз`, !/[a-z]{3,}/.test(bare), k.text)
      ok(`подпись ${l.id}: единицы только токенами`, !/\b(pm|kJ\/mol|kJ)\b/.test(bare) && !/\((s|g|l|aq)\)/.test(bare), k.text)
      // Символ пространственной группы (Fm-3m) — обозначение, а не число: сверяется целиком.
      if (bare.includes(SALT.spaceGroup)) ok(`подпись ${l.id}: группа из ядра`, bare.trim() === SALT.spaceGroup)
      for (const n of numbers(bare.replace(SALT.spaceGroup, ''))) {
        ok(`подпись ${l.id}: число ${n.raw} из ядра`, allowed3d.some((v) => matches(n, v)), k.text)
      }
    }
  }
  const text = (id: string) => NACL_LABELS.find((l) => l.id === id)!.keys[0]!.text
  ok('подпись газовой пары = r_e(NaCl, г.)', hasValue(text('dGas'), bondLengthPm('Na-Cl')) && numbers(text('dGas')).length === 1)
  ok('подпись пары в решётке = cationAnionPm', hasValue(text('dCrystal'), SALT.cationAnionPm) && numbers(text('dCrystal')).length === 1)
  ok('подпись a = параметр ячейки', hasValue(text('cellA'), SALT.cellPm.a))
  const dH = numbers(text('dH'))[0]!
  ok('подпись ΔH°f = сумма цикла со знаком', dH.sign === -1 && matches(dH, NACL_DHF_KJ) && near(NACL_DHF_KJ, NACL_LADDER.sumKJ, 0.05))
  ok('подпись Cl–Cl = bondLengthPm', hasValue(text('clBond'), bondLengthPm('Cl-Cl')))

  const known = new Set(Object.keys(SCENE_LABEL_TOKENS.ru))
  for (const token of labelTokensUsed(NACL_LABELS)) ok(`токен {${token}} есть в словаре`, known.has(token))
  for (const locale of LOCALES) {
    const states = createLabelStates(NACL_LABELS)
    localizeSceneLabels(states, locale)
    for (const st of states) ok(`[${locale}] подпись ${st.id} раскрыта`, !/\{\w+\}/.test(st.text) && st.text.trim().length > 0)
  }
  const ru = createLabelStates(NACL_LABELS)
  const en = createLabelStates(NACL_LABELS)
  localizeSceneLabels(ru, 'ru')
  localizeSceneLabels(en, 'en')
  ok('подписи ru отличаются от en (единицы переведены)', ru.some((s, i) => s.text !== en[i]!.text))
  // Решение 8: числа в 3D по локали — сцена NaCl включает десятичную запятую на ru/uz.
  for (const locale of ['ru', 'uz'] as const) {
    const st = createLabelStates(NACL_LABELS)
    localizeSceneLabels(st, locale, true)
    const g = st.find((x) => x.id === 'dGas')!.text
    ok(`[${locale}] 3D-число с десятичной запятой: «${g}»`, g.includes(String(bondLengthPm('Na-Cl')).replace('.', ',')) && !/\d\.\d/.test(st.map((x) => x.text).join(' ')))
  }
  for (const l of NACL_LABELS) for (const w of l.windows) ok(`окно подписи ${l.id}`, w[0] < w[1] && w[0] >= 0 && w[1] <= NACL_END + 1e-9)
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Тексты урока: числа ↔ ядро, синхронность языков
// ─────────────────────────────────────────────────────────────────────────────

const ladder = (kind: Parameters<typeof naclStageKJ>[0]) => naclStageKJ(kind)
const rNaIon = radiusForSpecies('Na', 1)
const rClIon = radiusForSpecies('Cl', -1)
const radiiSum = rNaIon + rClIon
/** Школьное ½D(Cl–Cl) = половина табличной энергии связи Cl–Cl ядра и его следствие для суммы цикла. */
const SCHOOL_D = bondEnthalpyKJ('Cl-Cl')
const SCHOOL_HALF_D = SCHOOL_D / 2
const SCHOOL_SUM = NACL_LADDER.sumKJ - ladder('dissociation') + SCHOOL_HALF_D
/** Справочное U, которое называется рядом с −787 (отличие от ядра — не больше 1 кДж). */
const U_REF_ALT = 786
/**
 * Внешние константы, которых нет в ядре (см. notes): стандартные условия 25 °C / 298 K и
 * D-линия натрия 589 нм (NIST ASD: 588,995 / 589,592 нм).
 */
const EXTERNAL = [25, 298, 589]

/** Все значения ядра, которые имеет право назвать текст урока. */
const CORE_VALUES: number[] = [
  METAL.cellPm.a,
  METAL.cationAnionPm,
  bondLengthPm('Cl-Cl'),
  bondLengthPm('Cl-Cl') / 2,
  radiusForSpecies('Na', 0),
  radiusForSpecies('Cl', 0),
  rNaIon,
  rClIon,
  rClIon / rNaIon,
  ladder('sublimation'),
  ladder('dissociation'),
  ladder('ionization'),
  ladder('affinity'),
  ladder('lattice'),
  NACL_LADDER.sumKJ,
  NACL_COST_BEFORE_LATTICE_KJ,
  2 * dHfKJ('NaCl(s)'),
  bondLengthPm('Na-Cl'),
  radiiSum,
  radiiSum - bondLengthPm('Na-Cl'),
  SPECIES_SCALE,
  SALT.cationAnionPm,
  SALT.cellPm.a,
  SALT.densityGCm3,
  SALT.z,
  SALT_FRAG.sites.length,
  SALT_FRAG.cells[0] * 2 + 1,
  SCHOOL_D,
  SCHOOL_HALF_D,
  SCHOOL_SUM,
  U_REF_ALT,
  LATTICE_BALL_SCALE,
  ...EXTERNAL,
]
ok('школьное ½D отличается от ступени ядра (иначе оговорка шага 6 пустая)', Math.abs(SCHOOL_HALF_D - ladder('dissociation')) > 0.05)
ok('справочное U отличается от ядра не больше чем на 1 кДж', Math.abs(U_REF_ALT - Math.abs(NACL_LATTICE_KJ)) <= 1 && U_REF_ALT !== Math.abs(NACL_LATTICE_KJ))
ok('по ребру фрагмента 5 ионов (из ячеек)', SALT_FRAG.cells[0] * 2 + 1 === 5)
{
  // Плотность в тексте — справочная; рентгеновская ρ = Z·M / (N_A·a³) из ячейки ядра сходится с ней ≤ 0,1 %.
  const N_A = 6.02214076e23
  const M = ATOMIC_DATA.Na.atomicMassU + ATOMIC_DATA.Cl.atomicMassU
  const aCm = SALT.cellPm.a * 1e-10
  const rhoX = (SALT.z * M) / (N_A * aCm ** 3)
  ok('ρ(NaCl) ядра = Z·M/(N_A·a³) с точностью 0,1 %', Math.abs(rhoX - SALT.densityGCm3) / SALT.densityGCm3 < 1e-3, `${rhoX.toFixed(4)} против ${SALT.densityGCm3}`)
}

/** Малые целые — счёт (2 Na, 6 соседей, Z = 4, 3s¹, ×2, «шаг 5», 10²³ → 10). */
const isCount = (n: Num) => n.dec === 0 && n.v <= 12

const fields = (t: NaclMechanismText): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const id of NACL_STEP_IDS) {
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

const numbersByField: Record<NaclLocale, Record<string, string>> = { ru: {}, en: {}, uz: {} }
for (const locale of LOCALES) {
  const t = getNaclMechanismText(locale)
  ok(`[${locale}] заголовок и безопасность`, t.intro.title.length > 0 && t.safety.length > 20)
  for (const id of NACL_STEP_IDS) {
    const s = t.steps[id]
    ok(`[${locale}] ${id}: заголовок, уравнение, реплика`, s.title.trim().length > 0 && s.equation.trim().length > 0 && s.speak.trim().length > 0)
    ok(`[${locale}] ${id}: 2–4 предложения`, s.body.split(/[.!?]\s/).length >= 2)
    ok(`[${locale}] ${id}: есть note (всё схематичное названо)`, (s.note ?? '').length > 0)
  }
  ok(`[${locale}] aria-подпись лестницы`, t.energy.summary.includes('{dH}'))
  ok(`[${locale}] нет частицы Cl²⁻`, !JSON.stringify(t).includes('Cl²⁻'))

  const f = fields(t)
  for (const [key, s] of Object.entries(f)) {
    for (const n of numbers(s)) {
      if (isCount(n)) continue
      ok(`[${locale}] ${key}: число ${n.raw.trim()} есть в ядре`, CORE_VALUES.some((v) => matches(n, v)), s.slice(0, 80))
    }
    numbersByField[locale][key] = numbers(s)
      .map((n) => n.v)
      .sort((a, b) => a - b)
      .join(' ')
  }

  // Обязательные утверждения каждого шага — числа ядра в своём поле.
  const need = (key: string, vals: number[]) => {
    for (const v of vals) ok(`[${locale}] ${key} называет ${v}`, hasValue(f[key]!, v), f[key]!.slice(0, 60))
  }
  need('reactants.body', [METAL.cellPm.a, METAL.cationAnionPm, bondLengthPm('Cl-Cl'), radiusForSpecies('Na', 0), radiusForSpecies('Cl', 0)])
  need('sublimation.body', [ladder('sublimation'), ladder('dissociation')])
  need('transfer.body', [ladder('ionization'), ladder('affinity'), rNaIon, rClIon])
  need('attraction.body', [bondLengthPm('Na-Cl')])
  need('attraction.equation', [bondLengthPm('Na-Cl')])
  need('attraction.note', [radiiSum, radiiSum - bondLengthPm('Na-Cl'), bondLengthPm('Na-Cl'), SALT.cationAnionPm, SPECIES_SCALE])
  need('lattice.body', [SALT.cellPm.a, SALT.densityGCm3, Math.abs(ladder('lattice')), SALT.cationAnionPm, bondLengthPm('Na-Cl')])
  need('lattice.equation', [ladder('lattice')])
  need('lattice.note', [SALT_FRAG.sites.length, LATTICE_BALL_SCALE, radiiSum, SALT.cationAnionPm])
  need('energy.note', [ladder('dissociation'), SCHOOL_D, SCHOOL_HALF_D, SCHOOL_SUM, ladder('lattice'), U_REF_ALT])
  need('energy.body', [NACL_COST_BEFORE_LATTICE_KJ, 2 * dHfKJ('NaCl(s)')])

  // Шаг 4 показывает газовую пару: кристаллическое расстояние в теле и уравнении шага не звучит.
  ok(`[${locale}] шаг 4: в теле и уравнении нет кристаллического d`, !hasValue(f['attraction.body']! + ' ' + f['attraction.equation']!, SALT.cationAnionPm))

  // Сумма цикла в тексте: слагаемые = ступени ядра по порядку, итог = табличная ΔH°f.
  {
    const body = t.steps.energy.body
    const eq = body.indexOf('=')
    const terms = [...body.slice(0, eq).matchAll(/([+−-])\s?(\d+[.,]\d+)/g)].map((m) => (m[1] === '+' ? 1 : -1) * Number(m[2]!.replace(',', '.')))
    const res = /([+−-])\s?(\d+[.,]\d+)/.exec(body.slice(eq))!
    const total = (res[1] === '+' ? 1 : -1) * Number(res[2]!.replace(',', '.'))
    const cycle = BORN_HABER.nacl.stages.map((s) => s.dHKJ)
    ok(`[${locale}] сумма в тексте: слагаемые = ступени ядра`, terms.length === cycle.length && terms.every((v, i) => near(v, cycle[i]!, 0.05)), terms.join(' '))
    ok(`[${locale}] сумма в тексте сходится арифметически`, near(terms.reduce((s, v) => s + v, 0), total, 0.05))
    ok(`[${locale}] итог суммы = табличная ΔH°f`, near(total, dHfKJ('NaCl(s)'), 0.05))
    const eqn = numbers(t.steps.energy.equation).find((n) => n.dec > 0)!
    ok(`[${locale}] ΔH уравнения = 2·ΔH°f со знаком минус`, eqn.sign === -1 && matches(eqn, 2 * dHfKJ('NaCl(s)')))
    const ueq = numbers(t.steps.lattice.equation).find((n) => n.dec > 0)!
    ok(`[${locale}] U в уравнении шага 5 — отрицательное, как в ядре`, ueq.sign === -1 && matches(ueq, ladder('lattice')))
  }

  // Одно значение энтальпии присоединения электрона везде (348,6, а не 349); знак IUPAC назван один раз.
  const all = Object.values(f).join(' ')
  const eaLike = numbers(all).filter((n) => n.v >= 340 && n.v <= 360)
  ok(`[${locale}] Δ_eg H хлора везде одним числом ядра`, eaLike.length > 0 && eaLike.every((n) => n.dec === 1 && matches(n, ladder('affinity'))), eaLike.map((n) => n.raw).join(' '))
  ok(`[${locale}] конвенция IUPAC (+сродство) названа ровно один раз`, eaLike.filter((n) => n.sign === 1).length === 1)
  ok(`[${locale}] Δ_eg H со знаком минус есть`, eaLike.some((n) => n.sign === -1))
  // Школьное 121,7 — только в оговорке шага 6, ступень цикла везде 121,3.
  for (const [key, s] of Object.entries(f)) {
    if (key === 'energy.note') continue
    ok(`[${locale}] ${key}: школьное ½D не подменяет ступень ядра`, !hasValue(s, SCHOOL_HALF_D) || numbers(s).every((n) => n.dec !== 1 || !matches(n, SCHOOL_HALF_D)))
  }
}
// ─── Привязка «число ↔ величина»: не просто «число из набора ядра», а ТО число на ТОМ месте ───
{
  const strip = (s: string) => s.replaceAll(SALT.spaceGroup, '').replaceAll(METAL.spaceGroup, '')
  const seq = (s: string) => numbers(strip(s)).filter((n) => !isCount(n)).map((n) => n.v)
  const sameSeq = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => near(v, b[i]!, 1e-9))
  const abs = Math.abs
  // Ожидаемые последовательности (по порядку в тексте ru) — из ядра.
  const expect: Record<string, number[]> = {
    'reactants.body': [METAL.cellPm.a, METAL.cationAnionPm, bondLengthPm('Cl-Cl'), radiusForSpecies('Na', 0), radiusForSpecies('Cl', 0), bondLengthPm('Cl-Cl') / 2, 25],
    'sublimation.body': [ladder('sublimation'), ladder('dissociation'), 298],
    'transfer.body': [ladder('ionization'), radiusForSpecies('Na', 0), rNaIon, radiusForSpecies('Cl', 0), rClIon, rClIon / rNaIon, abs(ladder('affinity')), abs(ladder('affinity'))],
    'attraction.body': [bondLengthPm('Na-Cl')],
    'attraction.note': [rNaIon, rClIon, radiiSum, bondLengthPm('Na-Cl'), radiiSum - bondLengthPm('Na-Cl'), SPECIES_SCALE, SALT.cationAnionPm],
    'lattice.body': [SALT.cellPm.a, SALT.densityGCm3, SALT.cationAnionPm, bondLengthPm('Na-Cl'), abs(ladder('lattice'))],
    'lattice.note': [SALT_FRAG.sites.length, LATTICE_BALL_SCALE, rNaIon, rClIon, radiiSum, SALT.cationAnionPm],
    'energy.body': [ladder('sublimation'), ladder('dissociation'), ladder('ionization'), abs(ladder('affinity')), abs(ladder('lattice')), abs(NACL_LADDER.sumKJ), NACL_COST_BEFORE_LATTICE_KJ, abs(2 * dHfKJ('NaCl(s)'))],
    'energy.note': [ladder('dissociation'), 298, SCHOOL_D, SCHOOL_HALF_D, abs(SCHOOL_SUM), abs(ladder('lattice')), U_REF_ALT, 298, 589],
  }
  const ru = fields(getNaclMechanismText('ru'))
  for (const [key, want] of Object.entries(expect)) {
    const got = numbers(strip(ru[key]!)).filter((n) => !isCount(n))
    ok(`[ru] ${key}: числа стоят на своих местах (привязка к величинам ядра)`, got.length === want.length && got.every((n, i) => matches(n, want[i]!)), `${got.map((n) => n.v).join(' ')} | ожидалось ${want.map((v) => v.toFixed(2)).join(' ')}`)
  }
  // Счётные величины — по шаблонам, из ядра: Z, КЧ, число ячеек фрагмента.
  for (const locale of LOCALES) {
    const f = fields(getNaclMechanismText(locale))
    const z = /Z = (\d+)/.exec(f['lattice.body']!)
    ok(`[${locale}] Z в тексте = SALT.z`, z != null && Number(z[1]) === SALT.z)
    const cn = /(\d+):(\d+)/.exec(f['lattice.body']!)
    ok(`[${locale}] КЧ в тексте = SALT.coordination`, cn != null && Number(cn[1]) === SALT.coordination['Na⁺'] && Number(cn[2]) === SALT.coordination['Cl⁻'])
    const cells = /(\d)×(\d)×(\d)/.exec(f['lattice.note']!)
    ok(`[${locale}] фрагмент в тексте = SALT_FRAG.cells`, cells != null && [1, 2, 3].every((i) => Number(cells[i]) === SALT_FRAG.cells[i - 1]))
    // en / uz: та же последовательность чисел в каждом поле, что и в ru (порядок = привязка).
    if (locale === 'ru') continue
    for (const key of Object.keys(f)) {
      ok(`[${locale}] ${key}: порядок чисел как в ru`, sameSeq(seq(f[key]!), seq(ru[key]!)), `${seq(f[key]!).join(' ')} | ru ${seq(ru[key]!).join(' ')}`)
    }
  }
}

// ru / en / uz синхронны по каждому числу каждого поля.
for (const key of Object.keys(numbersByField.ru)) {
  ok(`числа поля ${key} совпадают в ru/en`, numbersByField.ru[key] === numbersByField.en[key], `${numbersByField.ru[key]} | ${numbersByField.en[key]}`)
  ok(`числа поля ${key} совпадают в ru/uz`, numbersByField.ru[key] === numbersByField.uz[key], `${numbersByField.ru[key]} | ${numbersByField.uz[key]}`)
}

console.log(`✓ nacl cinema (эталон): ${checks} проверок пройдено`)
console.log(`  шагов ${NACL_STEPS.length}, экранное время ${wall.toFixed(1)} с (${NACL_STEPS.map((s) => s.wall).join(' + ')} + хвост), сюжет ${NACL_END} с`)
console.log(`  цикл Борна — Габера: Σ = ${NACL_LADDER.sumKJ} кДж/моль (таблица ${NACL_DHF_TABLE_KJ}), школьное ½D = ${SCHOOL_HALF_D} → ${SCHOOL_SUM.toFixed(1)}`)
console.log(`  пара: газ ${bondLengthPm('Na-Cl')} пм → решётка ${SALT.cationAnionPm} пм; перекрытие полных сфер ${(radiiSum - bondLengthPm('Na-Cl')).toFixed(1)} пм`)
console.log(`  решётка: ${SALT_FRAG.sites.length} ионов, ${SALT_FRAG.cellEdges.length} рёбер ячеек, ${SALT.spaceGroup}, КЧ ${Object.values(SALT.coordination).join(':')}`)
