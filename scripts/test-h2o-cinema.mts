#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт сцены «вода: 2 H₂ (г.) + O₂ (г.) → 2 H₂O» (рецепт эталона nacl).
 *
 * Сцена проверяется ДАННЫМИ, а не строками: раскадровка — чистая функция sampleH2oFrame(t),
 * весь урок сэмплируется в Node, а каждое число сверяется с научным ядром src/chemistry/data.
 * Проверок «есть ли в тексте слово/литерал» здесь НЕТ: числа ИЗВЛЕКАЮТСЯ из текста и сверяются
 * с ядром по порядку, последовательности чисел ru / en / uz обязаны совпадать.
 *
 *   1. Хронометраж: 6 ± 1 шаг, каждый 4–7 экранных секунд, всего 26–34 с; embryo → birth → complete
 *      строго после последнего шага; события цепи — внутри своих шагов.
 *   2. Раскадровка: дорожки монотонны, ни атом, ни камера не прыгают; видимость без скачков;
 *      объекты кадра переиспользуются.
 *   3. Геометрия ↔ ядро: H–H и O=O (r_e) в смеси 2 : 1, O–H и ∠H–O–H (r₀) у воды, неподелённые пары
 *      по тетраэдру ⟂ плоскости молекулы, лёд Ih: O в узлах фрагмента ядра, H по правилам льда,
 *      O···O = cationAnionPm, КЧ = coordination, рёбра ячеек, водородные связи — пунктир.
 *   4. Кадр события: связи, число неспаренных электронов, материал и подписи меняются ступенью;
 *      Σ неспаренных электронов постоянна (кроме инициирования 0 → 2), атомы сохраняются.
 *   5. На каждом шаге видимы только объекты этого шага; на паузе каждый видимый атом подписан.
 *   6. Лёд и итог без FX: искра — только на шаге 2 и вне молекул; точек и лепестков нет.
 *   7. Энергия: лестница Гесса = ΔH°f ядра (множители), стадии цепи = REACTION_STEP_CHAINS, знаки, суммы.
 *   8. 3D-подписи: без кириллицы и фраз, единицы токенами, числа — из ядра, десятичная запятая ru/uz.
 *   9. Тексты: извлечённые числа ↔ ядро по порядку, синхронность ru/en/uz, сумма Гесса из текста.
 *
 * Запуск: npx tsx scripts/test-h2o-cinema.mts
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  ATOMIC_DATA,
  BOND_ANGLES,
  BOND_DATA,
  bondAngleDeg,
  bondEnthalpyKJ,
  bondLengthPm,
  dHfKJ,
  dipoleDebye,
  formationReactionKJ,
  getCrystal,
  getElement,
  radiusForSpecies,
  reactionEnthalpyBothKJ,
  REACTION_STEP_CHAINS,
  WATER_SEQUENTIAL_BDE_KJ,
} from '../src/chemistry/data/index.ts'
import { storyWallDuration } from '../src/lab/cinema/core/storyTime.ts'
import { TETRAHEDRAL_ANGLE_DEG } from '../src/lab/cinema/core/vsepr.ts'
import { assertCameraContinuity, sampleShot } from '../src/lab/cinema/scenes/kit/camera.ts'
import { pmToScene, SPECIES_SCALE, speciesRadius, speciesRadiusPm } from '../src/lab/cinema/scenes/kit/cpkAtoms.ts'
import { ladderLevels } from '../src/lab/cinema/scenes/kit/energyLadderData.ts'
import { latticeCaption } from '../src/lab/cinema/scenes/kit/lattice.ts'
import {
  assertNoPositionJumps,
  createLabelStates,
  createSceneCamera,
  labelTokensUsed,
  localizeSceneLabels,
  SCENE_LABEL_TOKENS,
} from '../src/lab/cinema/scenes/kit/sceneKit.ts'
import { assertSnapAt } from '../src/lab/cinema/scenes/kit/valence.ts'
import {
  createH2oFrame,
  H2_MOLECULES,
  H2O_ATOM_INDEX,
  H2O_ATOMS,
  H2O_CAMERA,
  H2O_CUES,
  H2O_DEBUG,
  H2O_EDGE_A,
  H2O_EDGE_C,
  H2O_END,
  H2O_EVENTS,
  H2O_GEOM,
  H2O_LABELS,
  H2O_SEGMENTS,
  H2O_STEP_IDS,
  H2O_STEPS,
  H2O_TIMING,
  H2O_UNPAIRED,
  ICE_CELLS,
  ICE_EDGES,
  ICE_FRAG,
  ICE_HBONDS,
  ICE_MOL_ATOMS,
  ICE_MOLECULES,
  O2_MOLECULES,
  sampleH2oFrame,
  STORY_ICE_SITE,
  STORY_OH,
  validateH2oStoryboard,
  WATER_A,
  WATER_B,
  type H2oFrame,
} from '../src/lab/cinema/scenes/h2o/h2oStoryboard.ts'
import {
  H2O_CHAIN_HESS_KJ,
  H2O_CHAIN_KJ,
  H2O_CHAIN_LINK_KJ,
  H2O_ELEMENTARY,
  H2O_LADDER,
  H2O_REACTION,
  H2O_THERMO,
  h2oStageKJ,
  validateH2oEnergetics,
} from '../src/lab/cinema/scenes/h2o/h2oEnergetics.ts'
import { getH2oMechanismText, type H2oLocale, type H2oMechanismText } from '../src/lab/cinema/scenes/h2o/h2oMechanismText.ts'
import { h2oScientificWatchdogMs } from '../src/lab/scientificSynthesis/h2oScenarioTiming.ts'

const LOCALES: H2oLocale[] = ['ru', 'en', 'uz']
const frame = createH2oFrame()
const at = (t: number): H2oFrame => sampleH2oFrame(t, frame)
const idx = (id: string) => H2O_ATOM_INDEX.get(id)!

let checks = 0
function ok(label: string, cond: boolean, detail = ''): void {
  assert.ok(cond, `${label}${detail ? ` — ${detail}` : ''}`)
  checks++
}
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol
const toPm = (scene: number) => scene / pmToScene(1)

const ICE = getCrystal('ice')!
const E = H2O_EVENTS
const STEP_PAUSE = H2O_STEPS.map((s) => s.to)
const LAST = H2O_STEPS.length - 1
const S = (id: string) => H2O_STEPS.findIndex((s) => s.id === id)
const dist = (a: string, b: string) => frame.pos[idx(a)]!.distanceTo(frame.pos[idx(b)]!)
const angleAt = (o: string, a: string, b: string) => {
  const u = frame.pos[idx(a)]!.clone().sub(frame.pos[idx(o)]!)
  const v = frame.pos[idx(b)]!.clone().sub(frame.pos[idx(o)]!)
  return (u.angleTo(v) * 180) / Math.PI
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Хронометраж и контракт лаборатории
// ─────────────────────────────────────────────────────────────────────────────

H2O_TIMING.validate()
ok('шагов 6 ± 1', H2O_STEPS.length >= 5 && H2O_STEPS.length <= 7, `${H2O_STEPS.length}`)
ok('id шагов совпадают', H2O_STEP_IDS.join(',') === H2O_STEPS.map((s) => s.id).join(','))
const wall = storyWallDuration(H2O_SEGMENTS)
ok('экранная длительность 26–34 с', wall >= 26 && wall <= 34, `${wall.toFixed(1)} с`)
ok('wallDuration kit = сумма сегментов', near(wall, H2O_TIMING.wallDuration, 1e-9))
for (const s of H2O_STEPS) ok(`шаг ${s.id}: 4–7 экранных секунд`, s.wall >= 4 && s.wall <= 7, `${s.wall}`)
const lastStepTo = H2O_STEPS[LAST]!.to
for (const id of ['embryo', 'birth', 'complete']) {
  const c = H2O_CUES.find((x) => x.id === id)!
  ok(`cue ${id} строго после последнего шага`, c.at > lastStepTo, `${c.at} ≤ ${lastStepTo}`)
}
for (const c of H2O_CUES) {
  if (['embryo', 'birth', 'complete'].includes(c.id)) continue
  ok(`cue ${c.id} внутри шагов`, c.at > 0 && c.at < lastStepTo)
}
ok('complete совпадает с концом сюжета', H2O_CUES.find((c) => c.id === 'complete')!.at === H2O_END)
ok('watchdog лаборатории положителен', h2oScientificWatchdogMs() > 0)
for (let i = 0; i < H2O_STEPS.length; i++) {
  const s = H2O_STEPS[i]!
  ok(`stepIndexAt(${s.id})`, H2O_TIMING.stepIndexAt((s.from + s.to) / 2) === i)
}
// События цепи — внутри своих шагов и в порядке механизма; все — на сетке 1/30 с дорожек.
const inStep = (t: number, id: string) => t > H2O_STEPS[S(id)]!.from && t < H2O_STEPS[S(id)]!.to
ok('искра и инициирование — на шаге 2', inStep(E.spark, 'spark') && inStep(E.init, 'spark') && E.spark < E.init)
ok('два разветвления — на шаге 3', inStep(E.branchH, 'branching') && inStep(E.branchO, 'branching') && E.branchH < E.branchO)
ok('два продолжения — на шаге 4', inStep(E.propA, 'propagation') && inStep(E.propB, 'propagation') && E.propA < E.propB)
for (const [k, t] of Object.entries(E)) ok(`событие ${k} на сетке 1/30 с`, near(t * 30, Math.round(t * 30), 1e-6))

// ─────────────────────────────────────────────────────────────────────────────
// 2. Раскадровка: дорожки, рывки атомов и камеры, ноль аллокаций
// ─────────────────────────────────────────────────────────────────────────────

validateH2oStoryboard()
{
  const scratch = createH2oFrame()
  const buf = H2O_ATOMS.map((a) => ({ id: a.id, pos: new THREE.Vector3(), opacity: 0 }))
  assertNoPositionJumps(
    (t) => {
      sampleH2oFrame(t, scratch)
      for (let i = 0; i < H2O_ATOMS.length; i++) {
        buf[i]!.pos.copy(scratch.pos[i]!)
        buf[i]!.opacity = scratch.opacity[i]!
      }
      return buf
    },
    H2O_END,
    0.09,
    1 / 30,
  )
  checks++
  const cam = createSceneCamera()
  assertCameraContinuity((t) => sampleShot(H2O_CAMERA, t, cam), H2O_END)
  checks++

  // Видимость не щёлкает: у молекул льда растёт шар (доля радиуса), у остальных — непрозрачность.
  const fullR = H2O_ATOMS.map((a) => speciesRadius(a.el, 0))
  const presence = (i: number) => (H2O_ATOMS[i]!.kind === 'ice' ? scratch.radius[i]! / fullR[i]! : scratch.opacity[i]!)
  let prev: Float32Array | null = null
  let worstVis = 0
  for (let t = 0; t <= H2O_END + 1e-9; t += 1 / 30) {
    sampleH2oFrame(t, scratch)
    const now = Float32Array.from(H2O_ATOMS, (_, i) => presence(i))
    if (prev) for (let i = 0; i < H2O_ATOMS.length; i++) worstVis = Math.max(worstVis, Math.abs(now[i]! - prev[i]!))
    prev = now
  }
  ok('видимость без скачка (≤ 0,12 за кадр 1/30 с)', worstVis <= 0.12, worstVis.toFixed(3))

  const posRefs = scratch.pos.slice()
  const labelRefs = scratch.labels.slice()
  const labelPos = scratch.labels.map((l) => l.pos)
  const dotRefs = scratch.dotDir.slice()
  for (let t = 0; t <= H2O_END; t += 0.5) sampleH2oFrame(t, scratch)
  ok('векторы позиций переиспользуются', scratch.pos.every((p, i) => p === posRefs[i]))
  ok('векторы точек переиспользуются', scratch.dotDir.every((p, i) => p === dotRefs[i]))
  ok('подписи переиспользуются', scratch.labels.every((l, i) => l === labelRefs[i] && l.pos === labelPos[i]))
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Геометрия раскадровки ↔ ядро
// ─────────────────────────────────────────────────────────────────────────────

// 3.1 Радиусы — Кордеро (ковалентные) ядра; H меньше O.
ok('H — ковалентный радиус ядра', speciesRadiusPm('H', 0) === radiusForSpecies('H', 0))
ok('O — ковалентный радиус ядра', speciesRadiusPm('O', 0) === radiusForSpecies('O', 0))
at(STEP_PAUSE[0]!)
for (const a of H2O_ATOMS.filter((x) => x.kind === 'story')) {
  ok(`атом ${a.id}: радиус = speciesRadius ядра`, near(frame.radius[idx(a.id)]!, speciesRadius(a.el, 0), 1e-6))
}

// 3.2 Шаг 1: смесь 2 : 1 — все H₂ и O₂ двухатомные, длины r_e из bondData, материал gas.
{
  ok('смесь 2 : 1 по объёму (молекул H₂ вдвое больше, чем O₂)', H2_MOLECULES.length === 2 * O2_MOLECULES.length)
  for (const m of H2_MOLECULES) {
    ok(`H₂ ${m.a}–${m.b}: d = bondLengthPm('H-H')`, near(toPm(dist(m.a, m.b)), bondLengthPm('H-H'), 1e-6))
    ok(`H₂ ${m.a}–${m.b}: σ-связь видна`, frame.h2[H2_MOLECULES.indexOf(m)]!.on && frame.h2[H2_MOLECULES.indexOf(m)]!.amount > 0.9)
  }
  for (const m of O2_MOLECULES) {
    ok(`O₂ ${m.a}–${m.b}: d = bondLengthPm('O=O')`, near(toPm(dist(m.a, m.b)), bondLengthPm('O=O'), 1e-6))
    ok(`O₂ ${m.a}–${m.b}: двойная связь видна`, frame.o2[O2_MOLECULES.indexOf(m)]!.on && frame.o2[O2_MOLECULES.indexOf(m)]!.amount > 0.9)
  }
  ok('тип длин: r_e у H–H и O=O', BOND_DATA['H-H'].lengthType === 'r_e' && BOND_DATA['O=O'].lengthType === 'r_e')
  ok('реагенты — газ', H2O_ATOMS.every((a, i) => a.kind !== 'story' || frame.material[i] === 'gas'))
  // Триплет O₂: по одной точке у каждого атома (две на молекулу), у H₂ — ни одной.
  for (const m of O2_MOLECULES) ok(`O₂ ${m.a}–${m.b}: два неспаренных электрона (триплет)`, frame.unpaired[idx(m.a)]! + frame.unpaired[idx(m.b)]! === 2)
  for (const m of H2_MOLECULES) ok(`H₂ ${m.a}–${m.b}: неспаренных нет`, frame.unpaired[idx(m.a)]! + frame.unpaired[idx(m.b)]! === 0)
}

// 3.3 События: перенос атома коллинеарен и приходит на длину O–H; в кадр рождения воды — угол ядра.
{
  const OH = bondLengthPm('O-H')
  at(E.branchH)
  ok('branchH: H· на длине O–H от атома O₂', near(toPm(dist('oA', 'h0a')), OH, 1e-6))
  at(E.branchO)
  ok('branchO: O(³P) на длине O–H от атома H₂', near(toPm(dist('oB', 'h1a')), OH, 1e-6))
  const collinear = frame.pos[idx('h1a')]!.clone().sub(frame.pos[idx('oB')]!).normalize().dot(frame.pos[idx('h1b')]!.clone().sub(frame.pos[idx('h1a')]!).normalize())
  ok('branchO: O···H–H коллинеарны (перенос атома по оси связи)', near(collinear, 1, 1e-6))
  for (const [ev, w] of [
    [E.propA, WATER_A],
    [E.propB, WATER_B],
  ] as const) {
    at(ev)
    ok(`рождение ${w[0]}: обе связи O–H = r₀ ядра`, near(toPm(dist(w[0], w[1])), OH, 1e-6) && near(toPm(dist(w[0], w[2])), OH, 1e-6))
    ok(`рождение ${w[0]}: ∠H–O–H = bondAngleDeg('water')`, near(angleAt(w[0], w[1], w[2]), bondAngleDeg('water'), 1e-6))
  }
}

// 3.4 Паузы шагов 4–5: геометрия воды, неподелённые пары, полярность, диполь.
for (const pause of [STEP_PAUSE[S('propagation')]!, STEP_PAUSE[S('molecule')]!]) {
  at(pause)
  for (const w of [WATER_A, WATER_B]) {
    ok(`t=${pause}: ${w[0]} — O–H = r₀ ядра`, near(toPm(dist(w[0], w[1])), bondLengthPm('O-H'), 1e-6) && near(toPm(dist(w[0], w[2])), bondLengthPm('O-H'), 1e-6))
    ok(`t=${pause}: ${w[0]} — ∠H–O–H ядра (r₀)`, near(angleAt(w[0], w[1], w[2]), bondAngleDeg('water'), 1e-6))
    ok(`t=${pause}: ${w[0]} — материал covalent`, w.every((id) => frame.material[idx(id)] === 'covalent'))
  }
}
ok('угол и длина — один набор r₀ (не смешаны с r_e)', BOND_ANGLES.water.angleType === 'r_0' && BOND_DATA['O-H'].lengthType === 'r_0')
{
  at(STEP_PAUSE[S('molecule')]!)
  ok('пауза шага 5: лепестки видны', frame.lobes.amount > 0.9)
  const o = frame.pos[idx('oA')]!
  const h1 = frame.pos[idx('h0a')]!.clone().sub(o).normalize()
  const h2 = frame.pos[idx('h2a')]!.clone().sub(o).normalize()
  const bis = h1.clone().add(h2).normalize()
  const nrm = h1.clone().cross(h2).normalize()
  const [a0, a1] = frame.lobes.axis
  ok('неподелённых пар ровно две, оси единичные', near(a0.length(), 1, 1e-9) && near(a1.length(), 1, 1e-9))
  ok('угол между парами — тетраэдрический (схема sp³)', near((a0.angleTo(a1) * 180) / Math.PI, TETRAHEDRAL_ANGLE_DEG, 1e-6))
  ok('пары смотрят против водородов', a0.dot(bis) < 0 && a1.dot(bis) < 0)
  ok('пары симметричны относительно плоскости H–O–H', near(a0.dot(nrm), -a1.dot(nrm), 1e-9) && Math.abs(a0.dot(nrm)) > 0.5)
  ok('лепестки — у кислорода A', frame.lobes.center.distanceTo(o) < 1e-9)
  const q = frame.charge[idx('oA')]! + frame.charge[idx('h0a')]! + frame.charge[idx('h2a')]!
  ok('δ: молекула в целом нейтральна', near(q, 0, 1e-9))
  ok('δ−(O), δ+(H)', frame.charge[idx('oA')]! < 0 && frame.charge[idx('h0a')]! > 0 && frame.charge[idx('h2a')]! > 0)
  ok('ЭО из ядра: O > H', getElement('O').electronegativity! > getElement('H').electronegativity!)
  ok('полярность O–H подчёркнута', frame.oh.every((b) => b.polarity > 0.5))
  ok('радикалы и второй O₂ ушли из кадра', H2O_DEBUG.exitIds.every((id) => frame.opacity[idx(id)] === 0))
}

// 3.5 Лёд Ih: O — узлы фрагмента ядра, H — правила льда, O···O и КЧ — ядро, рёбра ячеек.
{
  ok('фрагмент — целое число ячеек', ICE_CELLS.every((n) => Number.isInteger(n) && n >= 1) && ICE_FRAG.cells.join() === ICE_CELLS.join())
  ok('молекул льда = узлов O фрагмента = Z × число ячеек', ICE_MOLECULES.length === ICE_FRAG.sites.length && ICE_MOLECULES.length === ICE.z * ICE_CELLS[0] * ICE_CELLS[1] * ICE_CELLS[2])
  ok('в базисе ядра H нет (разупорядочены)', ICE.basisOmits?.includes('H') === true && ICE_FRAG.sites.every((s) => s.el === 'O'))
  const cn = Object.values(ICE.coordination)[0]!
  // Периодический граф: у каждого O КЧ ядра, у каждого ребра ровно один H (правило 1), у каждого O два H (правило 2).
  const deg = new Array<number>(ICE_MOLECULES.length).fill(0)
  for (const e of ICE_EDGES) {
    deg[e.i]!++
    deg[e.j]!++
    ok(`O···O ${e.i}–${e.j}: длина — первая сфера (≥ cationAnionPm ядра, ≤ +1 пм)`, e.lengthPm >= ICE.cationAnionPm - 0.1 && e.lengthPm <= ICE.cationAnionPm + 1, e.lengthPm.toFixed(2))
  }
  ok('у каждого O четыре соседа O (КЧ ядра)', deg.every((d) => d === cn))
  let hOnLine = 0
  const perEdge = new Map<string, number>()
  ICE_MOLECULES.forEach((m, i) => {
    ok(`молекула льда ${i}: ровно два H`, m.h.length === 2)
    for (const k of [0, 1] as const) {
      const o = new THREE.Vector3(...m.o)
      const h = new THREE.Vector3(...m.h[k])
      ok(`молекула льда ${i}: O–H = r₀ ядра`, near(toPm(h.distanceTo(o)), bondLengthPm('O-H'), 1e-6))
      // H на линии к соседу m.to[k]: направление совпадает с одним из рёбер графа.
      const e = ICE_EDGES.find((x) => (x.i === i && x.j === m.to[k]) || (x.j === i && x.i === m.to[k]))
      ok(`молекула льда ${i}: H лежит на линии O···O к соседу`, e != null)
      if (e) {
        hOnLine++
        const key = `${Math.min(e.i, e.j)}-${Math.max(e.i, e.j)}-${ICE_EDGES.indexOf(e)}`
        perEdge.set(key, (perEdge.get(key) ?? 0) + 1)
      }
    }
  })
  ok('H на линиях O···O: 2 × число молекул', hOnLine === 2 * ICE_MOLECULES.length)
  ok('на каждой линии O···O ровно один H (правило льда)', perEdge.size === ICE_EDGES.length && [...perEdge.values()].every((v) => v === 1))
  // Угол между двумя H одной молекулы во льду — между углом газа и тетраэдрическим с запасом (сетка O почти тетраэдр).
  for (const m of ICE_MOLECULES) {
    const o = new THREE.Vector3(...m.o)
    const a = new THREE.Vector3(...m.h[0]).sub(o)
    const b = new THREE.Vector3(...m.h[1]).sub(o)
    const ang = (a.angleTo(b) * 180) / Math.PI
    ok('угол H–O–H во льду близок к тетраэдрическому (±1°)', Math.abs(ang - TETRAHEDRAL_ANGLE_DEG) < 1, ang.toFixed(2))
  }

  at(STEP_PAUSE[S('ice')]!)
  for (let mi = 0; mi < ICE_MOLECULES.length; mi++) {
    const m = ICE_MOLECULES[mi]!
    const [o, h0, h1] = ICE_MOL_ATOMS[mi]!
    ok(`пауза льда: молекула ${mi} — O в узле ядра`, frame.pos[o]!.distanceTo(new THREE.Vector3(...m.o)) < 1e-6)
    ok(`пауза льда: молекула ${mi} — H по правилам льда`, frame.pos[h0]!.distanceTo(new THREE.Vector3(...m.h[0])) < 1e-6 && frame.pos[h1]!.distanceTo(new THREE.Vector3(...m.h[1])) < 1e-6)
    ok(`пауза льда: молекула ${mi} — видима и в полный радиус`, [o, h0, h1].every((i) => frame.opacity[i]! > 0.99 && near(frame.radius[i]!, speciesRadius(H2O_ATOMS[i]!.el, 0), 1e-6)))
  }
  ok('молекулы сюжета — водородно связанная пара узлов льда', ICE_HBONDS.some((h) => h.donor === STORY_ICE_SITE.A && h.acceptor === STORY_ICE_SITE.B))
  for (let k = 0; k < ICE_HBONDS.length; k++) {
    const h = ICE_HBONDS[k]!
    ok(`водородная связь ${k}: O···O = cationAnionPm ядра (±1 пм)`, Math.abs(h.ooPm - ICE.cationAnionPm) <= 1, h.ooPm.toFixed(2))
    ok(`водородная связь ${k}: видна на паузе`, frame.hbond[k]! > 0.99)
  }
  ok('водородных связей столько, сколько линий O···O внутри фрагмента', ICE_HBONDS.length === ICE_FRAG.bonds.length)
  ok('рёбра ячеек видны', frame.edges > 0.9)
  for (const [p, q] of [H2O_EDGE_A]) ok('ребро подписи a = a ядра', near(toPm(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])), ICE.cellPm.a, 1e-6))
  for (const [p, q] of [H2O_EDGE_C]) ok('ребро подписи c = c ядра (вертикально)', near(toPm(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])), ICE.cellPm.c!, 1e-6) && near(p[0], q[0], 1e-9) && near(p[2], q[2], 1e-9))
  ok('подпись решётки — latticeCaption ядра', latticeCaption('ice').every((c) => H2O_LABELS.some((l) => l.keys.some((k) => k.text === c))))
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Кадр события: ступень связей, неспаренных электронов, материала и подписей
// ─────────────────────────────────────────────────────────────────────────────

{
  const dt = 1 / 60
  const U = (id: string) => frame.unpaired[idx(id)]!
  const lbl = (id: string) => frame.labels.find((l) => l.id === id)!.text
  type Expect = { ids: string[]; before: number[]; after: number[] }
  const EVENTS: [keyof typeof E, Expect][] = [
    ['init', { ids: ['h0a', 'h0b'], before: [0, 0], after: [1, 1] }],
    ['branchH', { ids: ['h0a', 'oA', 'oB'], before: [1, 1, 1], after: [0, 1, 2] }],
    ['branchO', { ids: ['oB', 'h1a', 'h1b'], before: [2, 0, 0], after: [1, 0, 1] }],
    ['propA', { ids: ['oA', 'h2a', 'h2b'], before: [1, 0, 0], after: [0, 0, 1] }],
    ['propB', { ids: ['oB', 'h3a', 'h3b'], before: [1, 0, 0], after: [0, 0, 1] }],
  ]
  for (const [ev, x] of EVENTS) {
    const t = E[ev]
    x.ids.forEach((id, k) => {
      assertSnapAt(H2O_UNPAIRED[id]!, t, x.before[k]!, x.after[k]!)
      checks++
    })
    at(t - dt)
    const b = x.ids.map(U)
    at(t)
    const a = x.ids.map(U)
    ok(`${ev}: неспаренные до (${x.before}) и в кадр события (${x.after})`, b.join() === x.before.join() && a.join() === x.after.join(), `${b} → ${a}`)
  }
  // Связи: старая есть в кадре до события и нет в кадр события; новая — наоборот.
  for (const [k, m] of H2_MOLECULES.entries()) {
    at(m.breakAt - dt)
    const was = frame.h2[k]!.on
    at(m.breakAt)
    ok(`H₂ ${m.a}–${m.b}: связь рвётся ровно в кадр события`, was && !frame.h2[k]!.on)
  }
  {
    const m = O2_MOLECULES[0]!
    at(m.breakAt - dt)
    const was = frame.o2[0]!.on
    at(m.breakAt)
    ok('O=O рвётся ровно в кадр branchH', was && !frame.o2[0]!.on)
  }
  for (const [k, m] of STORY_OH.entries()) {
    at(m.formAt - dt)
    const was = frame.oh[k]!.on
    at(m.formAt)
    ok(`O–H ${m.o}–${m.h}: рождается ровно в кадр события`, !was && frame.oh[k]!.on)
  }
  // Материал gas → covalent и подпись → H₂O в кадр рождения молекулы воды.
  for (const [ev, w, label] of [
    [E.propA, WATER_A, 'ctrA'],
    [E.propB, WATER_B, 'ctrB'],
  ] as const) {
    at(ev - dt)
    const m0 = w.map((id) => frame.material[idx(id)])
    const l0 = lbl(label)
    at(ev)
    ok(`${w[0]}: материал gas → covalent в кадр рождения`, m0.every((m) => m === 'gas') && w.every((id) => frame.material[idx(id)] === 'covalent'))
    ok(`${w[0]}: подпись сменилась в кадр рождения`, l0 !== lbl(label) && lbl(label).startsWith('H₂O'))
  }
  at(E.branchO - dt)
  const oBefore = lbl('ctrB')
  at(E.branchO)
  ok('подпись O(³P) → ·OH ровно в кадр branchO', oBefore !== lbl('ctrB'))
  // Инвариант: Σ неспаренных электронов меняется только при инициировании (0 → 2), каждые 1/60 с.
  const storyIds = H2O_ATOMS.filter((a) => a.kind === 'story').map((a) => a.id)
  let worst = 0
  for (let t = 0; t <= H2O_END + 1e-9; t += dt) {
    at(t)
    const sum = storyIds.reduce((s, id) => s + U(id), 0)
    const expect = t < E.init ? 4 : 6
    worst = Math.max(worst, Math.abs(sum - expect))
  }
  ok('Σ неспаренных: 4 (два O₂) до искры, 6 после — в каждом кадре', worst === 0, `${worst}`)
  // Атом O(³P) — ДВЕ точки (не «O·»), точки лежат на разных сторонах.
  at((E.branchH + E.branchO) / 2)
  ok('O(³P): две точки неспаренных электронов', U('oB') === 2)
  ok('O(³P): точки по разные стороны', frame.dotDir[idx('oB') * 2]!.dot(frame.dotDir[idx('oB') * 2 + 1]!) < -0.99)
  ok('·OH: точка против водорода', frame.dotDir[idx('oA') * 2]!.dot(frame.pos[idx('h0a')]!.clone().sub(frame.pos[idx('oA')]!).normalize()) < -0.99)
  // Сохранение атомов: в сюжете всегда 8 H и 4 O — столько, сколько в 4 H₂ + 2 O₂.
  const story = H2O_ATOMS.filter((a) => a.kind === 'story')
  ok('в сюжете 8 H и 4 O (4 H₂ + 2 O₂)', story.filter((a) => a.el === 'H').length === 2 * H2_MOLECULES.length && story.filter((a) => a.el === 'O').length === 2 * O2_MOLECULES.length)
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Только объекты текущего шага; на паузе каждый видимый атом подписан
// ─────────────────────────────────────────────────────────────────────────────

function hostSpan(hosts: readonly string[]): number {
  let m = 0
  for (const a of hosts) for (const b of hosts) m = Math.max(m, frame.pos[idx(a)]!.distanceTo(frame.pos[idx(b)]!))
  return m
}
for (let si = 0; si < H2O_STEPS.length; si++) {
  const s = H2O_STEPS[si]!
  let foreign = 0
  let at0 = -1
  for (let t = s.from; t <= s.to + 1e-9; t += 1 / 60) {
    at(t)
    for (let i = 0; i < H2O_ATOMS.length; i++) {
      const [a, b] = H2O_ATOMS[i]!.span
      if (!(si >= a && si <= b) && frame.opacity[i]! > 0) {
        foreign++
        if (at0 < 0) at0 = t
      }
    }
  }
  ok(`шаг ${s.id}: ни одного объекта чужого шага`, foreign === 0, `первый при t=${at0.toFixed(3)}`)

  at(s.to)
  const visibleLabels = frame.labels.map((l, k) => ({ st: l, def: H2O_LABELS[k]! })).filter(({ st }) => st.opacity > 0.5)
  ok(`пауза ${s.id}: есть подписи`, visibleLabels.length > 0)
  for (let i = 0; i < H2O_ATOMS.length; i++) {
    if (frame.opacity[i]! <= 0.02) continue
    const id = H2O_ATOMS[i]!.id
    const hosts = visibleLabels.filter(({ def }) => def.hosts.includes(id))
    const close = hosts.some(({ st, def }) => st.pos.distanceTo(frame.pos[i]!) <= hostSpan(def.hosts) + 1)
    ok(`пауза ${s.id}: атом ${id} подписан`, close, `хозяев ${hosts.length}`)
    ok(`пауза ${s.id}: атом ${id} полностью проявлен`, frame.opacity[i]! > 0.99, frame.opacity[i]!.toFixed(3))
  }
  for (const { st, def } of visibleLabels) {
    if (def.hosts.length === 0) continue
    ok(`пауза ${s.id}: подпись ${def.id} подписывает видимые атомы`, def.hosts.some((h) => frame.opacity[idx(h)]! > 0.5), st.text)
  }
}
at(STEP_PAUSE[S('spark')]!)
ok('после инициирования второй H· ушёл из кадра к паузе шага', frame.opacity[idx('h0b')] === 0)

// ─────────────────────────────────────────────────────────────────────────────
// 6. FX: искра — только на шаге 2 и вне молекул; лёд и итог без эффектов
// ─────────────────────────────────────────────────────────────────────────────

{
  let sparkOutside = 0
  let sparkElsewhere = 0
  for (let t = 0; t <= H2O_END + 1e-9; t += 1 / 60) {
    at(t)
    const si = H2O_TIMING.stepIndexAt(t)
    if (frame.spark.amount > 0) {
      if (si !== S('spark')) sparkElsewhere++
      for (let i = 0; i < H2O_ATOMS.length; i++) {
        if (frame.opacity[i]! > 0.02 && frame.pos[i]!.distanceTo(frame.spark.pos) < frame.radius[i]! + 0.18) sparkOutside++
      }
    }
  }
  ok('искра — только на шаге 2', sparkElsewhere === 0, `${sparkElsewhere}`)
  ok('искра вне молекул (центр дальше радиуса атома + ореол)', sparkOutside === 0, `${sparkOutside}`)
  ok('искра подписана (есть подпись с якорем spark)', H2O_LABELS.some((l) => l.anchor === 'spark'))
  at(E.spark)
  ok('в кадр искры свечение видно', frame.spark.amount > 0.9)

  at(H2O_STEPS[0]!.from + 0.01)
  const baseEmissive = frame.emissive[0]!
  for (const id of ['ice', 'energy']) {
    const s = H2O_STEPS[S(id)]!
    for (let t = s.from; t <= s.to + 1e-9; t += 1 / 30) {
      at(t)
      const fx = frame.fx.spark + frame.fx.dots + frame.fx.lobes * (t > s.from + 0.6 ? 1 : 0)
      ok(`шаг ${id}, t=${t.toFixed(2)}: FX-амплитуды = 0`, fx === 0, `${fx}`)
      ok(`шаг ${id}, t=${t.toFixed(2)}: свечение атомов базовое`, frame.emissive.every((e) => e === baseEmissive))
      ok(`шаг ${id}, t=${t.toFixed(2)}: bloom базовый, тряски нет`, near(frame.camera.bloom, 0.3) && frame.camera.shake === 0)
    }
  }
  at(H2O_STEPS[LAST]!.to)
  ok('конец шага 7: лёд цел и виден', ICE_MOL_ATOMS.every((ids) => ids.every((i) => frame.opacity[i]! > 0.99)))
  at(H2O_END)
  ok('в конце хвоста кадр затемнён', frame.fade > 0.95)
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Энергетика: лестница и цепь = ядро
// ─────────────────────────────────────────────────────────────────────────────

validateH2oEnergetics()
{
  ok('ступень H₂ → 2 H = 2 × ΔH°f(H, г.)', near(h2oStageKJ('dissocHH'), 2 * dHfKJ('H(g)'), 0.05))
  const hh = H2O_LADDER.stages.find((s) => s.id === 'dissocHH')!
  ok('множитель ступени H₂ → 2 H: 2 × perUnit ядра', hh.multiplier === 2 && hh.perUnitKJ === dHfKJ('H(g)') && near(hh.multiplier * hh.perUnitKJ, hh.dH, 0.05))
  ok('ступень ½ O₂ → O = ΔH°f(O, г.)', h2oStageKJ('dissocOO') === dHfKJ('O(g)'))
  ok('ступень H + O → ·OH = −D(O–H в ·OH) ядра', near(h2oStageKJ('bond1'), -WATER_SEQUENTIAL_BDE_KJ.second, 0.05))
  ok('ступень H + ·OH → H₂O = −D(H–OH) ядра', near(h2oStageKJ('bond2'), -WATER_SEQUENTIAL_BDE_KJ.first, 0.05))
  ok('Σ лестницы = табличная ΔH°f(H₂O, г.) (±0,05)', near(H2O_LADDER.sumKJ, dHfKJ('H2O(g)'), 0.05), `${H2O_LADDER.sumKJ}`)
  ok('знаки: разрывы > 0, образование связей < 0', H2O_LADDER.stages.every((s) => (s.kind === 'dissociation' ? s.dH > 0 : s.dH < 0)))
  const levels = ladderLevels(H2O_LADDER)
  ok('последний уровень = сумма', near(levels[levels.length - 1]!, H2O_LADDER.sumKJ))
  ok('ступени идут по времени сюжета и внутри шагов', H2O_LADDER.stages.every((s, i) => s.at > 0 && s.at < lastStepTo && (i === 0 || s.at >= H2O_LADDER.stages[i - 1]!.at)))
  const ids = REACTION_STEP_CHAINS.h2_o2
  ok('стадии цепи = REACTION_STEP_CHAINS.h2_o2 ядра', [H2O_CHAIN_KJ.initiation, H2O_CHAIN_KJ.branchH, H2O_CHAIN_KJ.branchO, H2O_CHAIN_KJ.propagation].every((v, i) => v === formationReactionKJ(ids[i]!)))
  ok('звено цепи = branchH + branchO + 2·продолжение', near(H2O_CHAIN_LINK_KJ, H2O_CHAIN_KJ.branchH + H2O_CHAIN_KJ.branchO + 2 * H2O_CHAIN_KJ.propagation, 0.05))
  ok('цепь по закону Гесса = ΔH уравнения ядра', near(H2O_CHAIN_HESS_KJ, formationReactionKJ('h2o_formation_g'), 0.05))
  ok('ΔH уравнения = 2 · ΔH°f(г.)', near(H2O_THERMO.reaction2molKJ, 2 * dHfKJ('H2O(g)'), 0.05))
  ok('жидкость ниже пара', dHfKJ('H2O(l)') < dHfKJ('H2O(g)'))
  const both = reactionEnthalpyBothKJ('water_g_2mol')
  ok('школьный расчёт по средним связям = ядро', H2O_THERMO.fromBondsKJ === both.fromBonds && near(H2O_THERMO.bondsDeltaKJ, Math.abs(both.fromFormation - both.fromBonds), 0.05))
}
{
  // Стехиометрия уравнения и элементарных стадий: атомы, заряд (все частицы нейтральны), неспаренные e⁻.
  const count = (formula: string, coeff: number, into: Map<string, number>) => {
    for (const m of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) into.set(m[1]!, (into.get(m[1]!) ?? 0) + (m[2] ? Number(m[2]) : 1) * coeff)
  }
  const left = new Map<string, number>()
  const right = new Map<string, number>()
  for (const t of H2O_REACTION.left) count(t.formula, t.coeff, left)
  for (const t of H2O_REACTION.right) count(t.formula, t.coeff, right)
  for (const k of new Set([...left.keys(), ...right.keys()])) ok(`уравнение: баланс по ${k}`, left.get(k) === right.get(k))
  ok('водород и кислород — двухатомные молекулы', H2O_REACTION.left.every((t) => /2$/.test(t.formula)))
  for (const st of H2O_ELEMENTARY) {
    const l = new Map<string, number>()
    const r = new Map<string, number>()
    for (const x of st.left) count(x.f, x.n, l)
    for (const x of st.right) count(x.f, x.n, r)
    ok(`стадия ${st.id}: баланс атомов`, [...new Set([...l.keys(), ...r.keys()])].every((k) => l.get(k) === r.get(k)))
    const uL = st.left.reduce((s, x) => s + x.u * x.n, 0)
    const uR = st.right.reduce((s, x) => s + x.u * x.n, 0)
    if (st.id === 'init') ok('инициирование: 0 → 2 неспаренных (гомолиз)', uL === 0 && uR === 2)
    else ok(`стадия ${st.id}: неспаренные электроны сохраняются`, uL === uR, `${uL} → ${uR}`)
  }
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
  const allowed3d = [
    bondLengthPm('H-H'),
    bondLengthPm('O=O'),
    bondLengthPm('O-H'),
    bondAngleDeg('water'),
    dipoleDebye('H2O')!,
    ICE.cellPm.a,
    ICE.cellPm.c!,
    ICE.cationAnionPm,
    ...Object.values(ICE.coordination),
    H2O_CHAIN_KJ.initiation,
    H2O_CHAIN_KJ.branchH,
    H2O_CHAIN_KJ.branchO,
    H2O_CHAIN_KJ.propagation,
    dHfKJ('H2O(g)'),
    dHfKJ('H2O(l)'),
  ]
  const SG = ICE.spaceGroup
  for (const l of H2O_LABELS) {
    for (const k of l.keys) {
      const bare = k.text.replace(/\{\w+\}/g, '').replace(SG, '')
      ok(`подпись ${l.id}: без кириллицы`, !/[А-Яа-яЁё]/.test(bare), k.text)
      ok(`подпись ${l.id}: без фраз`, !/[a-z]{3,}/.test(bare), k.text)
      ok(`подпись ${l.id}: единицы только токенами`, !/\b(pm|kJ\/mol|kJ)\b/.test(bare) && !/\((s|g|l|aq)\)/.test(bare), k.text)
      if (k.text.includes(SG)) ok(`подпись ${l.id}: группа из ядра`, k.text.trim() === SG)
      // «(³P)» и «ΔH°f» — обозначения, а не числа: верхние индексы не цифры ASCII.
      for (const n of numbers(bare)) ok(`подпись ${l.id}: число ${n.raw} из ядра`, allowed3d.some((v) => matches(n, v)), k.text)
    }
  }
  const text = (id: string) => H2O_LABELS.find((l) => l.id === id)!.keys[0]!.text
  ok('подпись H–H = r_e ядра', hasValue(text('dHH'), bondLengthPm('H-H')) && numbers(text('dHH')).length === 1)
  ok('подпись O=O = r_e ядра', hasValue(text('dOO'), bondLengthPm('O=O')) && numbers(text('dOO')).length === 1)
  ok('подпись O–H = r₀ ядра', hasValue(text('dOH'), bondLengthPm('O-H')))
  ok('подпись угла = bondAngleDeg', hasValue(text('angle'), bondAngleDeg('water')))
  ok('подпись μ = dipoleDebye', hasValue(text('mu'), dipoleDebye('H2O')!))
  ok('подпись O···O = cationAnionPm льда', hasValue(text('oo'), ICE.cationAnionPm))
  const sp = numbers(text('spark'))[0]!
  ok('подпись искры = ΔH инициирования со знаком +', sp.sign === 1 && matches(sp, H2O_CHAIN_KJ.initiation))
  const pr = numbers(text('dHprop'))[0]!
  ok('подпись продолжения цепи — со знаком минус', pr.sign === -1 && matches(pr, H2O_CHAIN_KJ.propagation))
  const g = numbers(text('dHg')).find((n) => n.dec > 0)!
  const lq = numbers(text('dHl')).find((n) => n.dec > 0)!
  ok('ΔH°f пара и жидкости в 3D — из ядра, со знаком', g.sign === -1 && matches(g, dHfKJ('H2O(g)')) && lq.sign === -1 && matches(lq, dHfKJ('H2O(l)')))
  const known = new Set(Object.keys(SCENE_LABEL_TOKENS.ru))
  for (const token of labelTokensUsed(H2O_LABELS)) ok(`токен {${token}} есть в словаре`, known.has(token))
  for (const locale of LOCALES) {
    const states = createLabelStates(H2O_LABELS)
    localizeSceneLabels(states, locale)
    for (const st of states) ok(`[${locale}] подпись ${st.id} раскрыта`, !/\{\w+\}/.test(st.text) && st.text.trim().length > 0)
  }
  const ru = createLabelStates(H2O_LABELS)
  const en = createLabelStates(H2O_LABELS)
  localizeSceneLabels(ru, 'ru')
  localizeSceneLabels(en, 'en')
  ok('подписи ru отличаются от en (единицы переведены)', ru.some((s, i) => s.text !== en[i]!.text))
  for (const locale of ['ru', 'uz'] as const) {
    const st = createLabelStates(H2O_LABELS)
    localizeSceneLabels(st, locale, true)
    const t = st.find((x) => x.id === 'dHH')!.text
    ok(`[${locale}] 3D-число с десятичной запятой: «${t}»`, t.includes(String(bondLengthPm('H-H')).replace('.', ',')) && !/\d\.\d/.test(st.map((x) => x.text).join(' ')))
  }
  for (const l of H2O_LABELS) for (const w of l.windows) ok(`окно подписи ${l.id}`, w[0] < w[1] && w[0] >= 0 && w[1] <= H2O_END + 1e-9)
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Тексты урока: числа ↔ ядро по порядку, синхронность языков
// ─────────────────────────────────────────────────────────────────────────────

const abs = Math.abs
const ladder = (id: Parameters<typeof h2oStageKJ>[0]) => h2oStageKJ(id)
/** Внешние константы, которых нет в ядре: стандартная температура 25 °C. */
const EXTERNAL = [25]
const TETRA_1 = Math.round(TETRAHEDRAL_ANGLE_DEG * 10) / 10

const CORE_VALUES: number[] = [
  bondLengthPm('H-H'),
  bondLengthPm('O=O'),
  bondLengthPm('O-H'),
  BOND_DATA['O-H'].lengthRePm!,
  bondAngleDeg('water'),
  BOND_ANGLES.water.degRe!,
  bondEnthalpyKJ('H-H'),
  bondEnthalpyKJ('O=O'),
  bondEnthalpyKJ('O-H'),
  H2O_THERMO.ooFromFormation,
  H2O_THERMO.hhSpreadKJ,
  radiusForSpecies('H', 0),
  radiusForSpecies('O', 0),
  SPECIES_SCALE,
  getElement('O').electronegativity!,
  getElement('H').electronegativity!,
  dipoleDebye('H2O')!,
  TETRA_1,
  dHfKJ('H(g)'),
  dHfKJ('O(g)'),
  H2O_CHAIN_KJ.initiation,
  H2O_CHAIN_KJ.branchH,
  H2O_CHAIN_KJ.branchO,
  H2O_CHAIN_KJ.propagation,
  H2O_CHAIN_LINK_KJ,
  WATER_SEQUENTIAL_BDE_KJ.first,
  WATER_SEQUENTIAL_BDE_KJ.second,
  dHfKJ('H2O(g)'),
  dHfKJ('H2O(l)'),
  H2O_THERMO.condensationKJ,
  H2O_THERMO.reaction2molKJ,
  H2O_THERMO.fromBondsKJ,
  H2O_THERMO.bondsDeltaKJ,
  ICE.cellPm.a,
  ICE.cellPm.c!,
  ICE.cationAnionPm,
  ICE.densityGCm3,
  ICE.temperatureK!,
  ICE_MOLECULES.length,
  ...EXTERNAL,
]
ok('D(O=O) по ΔH°f ядра = 2·ΔH°f(O)', near(H2O_THERMO.ooFromFormation, 2 * dHfKJ('O(g)'), 0.05))
ok('расхождение E(H–H) и 2·ΔH°f(H) из ядра — десятые доли', H2O_THERMO.hhSpreadKJ > 0 && H2O_THERMO.hhSpreadKJ < 1)
ok('ΔH°f(ж.) − ΔH°f(г.) = теплота конденсации', near(H2O_THERMO.condensationKJ, dHfKJ('H2O(l)') - dHfKJ('H2O(g)'), 0.05))

/** Малые целые — счёт (2 H₂, Z = 4, КЧ 4, «шаги 2–4», 10²³ → 10, 1b₁, 3D). */
const isCount = (n: Num) => n.dec === 0 && n.v <= 12

const fields = (t: H2oMechanismText): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const id of H2O_STEP_IDS) {
    const s = t.steps[id]
    out[`${id}.body`] = s.body
    out[`${id}.equation`] = s.equation
    out[`${id}.note`] = s.note ?? ''
    out[`${id}.speak`] = s.speak
  }
  out.legend = t.legend.electron + ' ' + t.legend.orbitalPhase + ' ' + t.legend.water
  out.safety = t.safety
  out.energy = Object.values(t.energy.stages).join(' ') + ' ' + t.energy.caption + ' ' + t.energy.sources
  return out
}
const strip = (s: string) => s.replaceAll(ICE.spaceGroup, '')

const numbersByField: Record<H2oLocale, Record<string, string>> = { ru: {}, en: {}, uz: {} }
for (const locale of LOCALES) {
  const t = getH2oMechanismText(locale)
  ok(`[${locale}] заголовок и безопасность`, t.intro.title.length > 0 && t.safety.length > 20)
  for (const id of H2O_STEP_IDS) {
    const s = t.steps[id]
    ok(`[${locale}] ${id}: заголовок, уравнение, реплика`, s.title.trim().length > 0 && s.equation.trim().length > 0 && s.speak.trim().length > 0)
    ok(`[${locale}] ${id}: 2–4 предложения`, s.body.split(/[.!?]\s/).length >= 2)
    ok(`[${locale}] ${id}: есть note (всё схематичное названо)`, (s.note ?? '').length > 0)
  }
  ok(`[${locale}] aria-подпись лестницы`, t.energy.summary.includes('{dH}'))
  ok(`[${locale}] подписи ступеней лестницы на все ступени`, H2O_LADDER.stages.every((s) => (t.energy.stages as Record<string, string>)[s.id]!.length > 0))

  const f = fields(t)
  for (const [key, s] of Object.entries(f)) {
    for (const n of numbers(strip(s))) {
      if (isCount(n)) continue
      ok(`[${locale}] ${key}: число ${n.raw.trim()} есть в ядре`, CORE_VALUES.some((v) => matches(n, v)), s.slice(0, 80))
    }
    numbersByField[locale][key] = numbers(strip(s))
      .map((n) => n.v)
      .sort((a, b) => a - b)
      .join(' ')
  }

  // Сумма Гесса в тексте: слагаемые = ступени лестницы по порядку, итог = табличная ΔH°f.
  {
    const body = t.steps.energy.body
    const eq = body.indexOf('=')
    const terms = [...body.slice(0, eq).matchAll(/([+−-])\s?(\d+[.,]\d+)/g)].map((m) => (m[1] === '+' ? 1 : -1) * Number(m[2]!.replace(',', '.')))
    const res = /([+−-])\s?(\d+[.,]\d+)/.exec(body.slice(eq))!
    const total = (res[1] === '+' ? 1 : -1) * Number(res[2]!.replace(',', '.'))
    const steps = H2O_LADDER.stages.map((s) => s.dH)
    ok(`[${locale}] сумма в тексте: слагаемые = ступени лестницы`, terms.length === steps.length && terms.every((v, i) => near(v, steps[i]!, 0.05)), terms.join(' '))
    ok(`[${locale}] сумма в тексте сходится арифметически`, near(terms.reduce((s, v) => s + v, 0), total, 0.05))
    ok(`[${locale}] итог суммы = табличная ΔH°f(г.)`, near(total, dHfKJ('H2O(g)'), 0.05))
    const eqn = numbers(t.steps.energy.equation).find((n) => n.dec > 0)!
    ok(`[${locale}] ΔH уравнения = 2·ΔH°f, знак минус`, eqn.sign === -1 && matches(eqn, H2O_THERMO.reaction2molKJ))
    const sp = numbers(t.steps.spark.equation).find((n) => n.dec > 0)!
    ok(`[${locale}] ΔH инициирования в уравнении шага 2 — со знаком +`, sp.sign === 1 && matches(sp, H2O_CHAIN_KJ.initiation))
  }
  // Знаки стадий цепи в тексте = знаки ядра.
  {
    const br = numbers(t.steps.branching.body).filter((n) => n.dec > 0)
    ok(`[${locale}] разветвления в тексте — эндотермические, как в ядре`, br.length === 2 && br[0]!.sign === 1 && matches(br[0]!, H2O_CHAIN_KJ.branchH) && br[1]!.sign === 1 && matches(br[1]!, H2O_CHAIN_KJ.branchO))
    const pr = numbers(t.steps.propagation.body).filter((n) => n.dec > 0)
    ok(`[${locale}] продолжение и звено — экзотермические`, pr.length === 2 && pr.every((n) => n.sign === -1) && matches(pr[0]!, H2O_CHAIN_KJ.propagation) && matches(pr[1]!, H2O_CHAIN_LINK_KJ))
  }
  // Одно значение E(H–H) и одно ΔH инициирования: 435,8 — табличная энергия связи, 436,0 — 2·ΔH°f(H).
  const all = Object.values(f).join(' ')
  const hhLike = numbers(all).filter((n) => n.v >= 430 && n.v < 440)
  ok(`[${locale}] вокруг 436 — только два числа ядра (435,8 и 436,0)`, hhLike.length > 0 && hhLike.every((n) => n.dec === 1 && (matches(n, bondEnthalpyKJ('H-H')) || matches(n, H2O_CHAIN_KJ.initiation))), hhLike.map((n) => n.raw).join(' '))
}

// ─── Привязка «число ↔ величина»: ТО число на ТОМ месте (порядок в ru — из ядра) ───
{
  const seq = (s: string) => numbers(strip(s)).filter((n) => !isCount(n)).map((n) => n.v)
  const sameSeq = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => near(v, b[i]!, 1e-9))
  const T = H2O_THERMO
  const expect: Record<string, number[]> = {
    'reactants.body': [25, bondLengthPm('H-H'), bondEnthalpyKJ('H-H'), bondLengthPm('O=O'), T.ooFromFormation],
    'reactants.note': [radiusForSpecies('H', 0), radiusForSpecies('O', 0), SPECIES_SCALE],
    'spark.body': [H2O_CHAIN_KJ.initiation],
    'spark.equation': [H2O_CHAIN_KJ.initiation],
    'spark.note': [dHfKJ('H(g)'), H2O_CHAIN_KJ.initiation, bondEnthalpyKJ('H-H'), T.hhSpreadKJ],
    'branching.body': [H2O_CHAIN_KJ.branchH, H2O_CHAIN_KJ.branchO],
    'branching.note': [bondLengthPm('O-H')],
    'propagation.body': [abs(H2O_CHAIN_KJ.propagation), abs(H2O_CHAIN_LINK_KJ)],
    'molecule.body': [bondLengthPm('O-H'), bondAngleDeg('water'), BOND_DATA['O-H'].lengthRePm!, BOND_ANGLES.water.degRe!, getElement('O').electronegativity!, getElement('H').electronegativity!, dipoleDebye('H2O')!],
    'molecule.equation': [bondLengthPm('O-H'), bondAngleDeg('water'), dipoleDebye('H2O')!],
    'molecule.note': [TETRA_1],
    'ice.body': [ICE.cellPm.a, ICE.cellPm.c!, ICE.cationAnionPm, ICE.densityGCm3, ICE.temperatureK!],
    'ice.note': [ICE_MOLECULES.length, bondLengthPm('O-H'), ICE.temperatureK!],
    'energy.body': [ladder('dissocHH'), ladder('dissocOO'), abs(ladder('bond1')), abs(ladder('bond2')), abs(H2O_LADDER.sumKJ), abs(T.reaction2molKJ), abs(T.condensationKJ), abs(T.liquidKJ)],
    'energy.equation': [abs(T.reaction2molKJ)],
    'energy.note': [ladder('dissocHH'), dHfKJ('H(g)'), WATER_SEQUENTIAL_BDE_KJ.second, WATER_SEQUENTIAL_BDE_KJ.first, bondEnthalpyKJ('H-H'), bondEnthalpyKJ('O=O'), bondEnthalpyKJ('O-H'), abs(T.fromBondsKJ), T.bondsDeltaKJ],
  }
  const ru = fields(getH2oMechanismText('ru'))
  for (const [key, want] of Object.entries(expect)) {
    const got = numbers(strip(ru[key]!)).filter((n) => !isCount(n))
    ok(`[ru] ${key}: числа стоят на своих местах`, got.length === want.length && got.every((n, i) => matches(n, want[i]!)), `${got.map((n) => n.v).join(' ')} | ожидалось ${want.map((v) => v.toFixed(2)).join(' ')}`)
  }
  // Поля без чисел ядра — без чисел вовсе (кроме счёта).
  for (const [key, s] of Object.entries(ru)) {
    if (key in expect) continue
    ok(`[ru] ${key}: чисел ядра нет — только счёт`, seq(s).length === 0, seq(s).join(' '))
  }
  for (const locale of LOCALES) {
    const f = fields(getH2oMechanismText(locale))
    const z = /Z = (\d+)/.exec(f['ice.body']!)
    ok(`[${locale}] Z в тексте = ICE.z`, z != null && Number(z[1]) === ICE.z)
    const cn = /(?:КЧ|CN|KS) (\d+)/.exec(f['ice.body']!)
    ok(`[${locale}] КЧ в тексте = coordination ядра`, cn != null && Number(cn[1]) === Object.values(ICE.coordination)[0])
    const cells = /(\d)×(\d)×(\d)/.exec(f['ice.note']!)
    ok(`[${locale}] фрагмент в тексте = ICE_CELLS`, cells != null && [1, 2, 3].every((i) => Number(cells[i]) === ICE_CELLS[i - 1]))
    const mix = /(\d) H₂ \+ (\d) O₂/.exec(f['reactants.equation']!)
    ok(`[${locale}] состав кадра в тексте = раскадровке`, mix != null && Number(mix[1]) === H2_MOLECULES.length && Number(mix[2]) === O2_MOLECULES.length)
    if (locale === 'ru') continue
    for (const key of Object.keys(f)) {
      ok(`[${locale}] ${key}: порядок чисел как в ru`, sameSeq(seq(f[key]!), seq(ru[key]!)), `${seq(f[key]!).join(' ')} | ru ${seq(ru[key]!).join(' ')}`)
    }
  }
}

for (const key of Object.keys(numbersByField.ru)) {
  ok(`числа поля ${key} совпадают в ru/en`, numbersByField.ru[key] === numbersByField.en[key], `${numbersByField.ru[key]} | ${numbersByField.en[key]}`)
  ok(`числа поля ${key} совпадают в ru/uz`, numbersByField.ru[key] === numbersByField.uz[key], `${numbersByField.ru[key]} | ${numbersByField.uz[key]}`)
}

// Атомная масса нужна только для самопроверки плотности льда из ячейки (ядро: рентгеновская ρ).
{
  const N_A = 6.02214076e23
  const M = 2 * ATOMIC_DATA.H.atomicMassU + ATOMIC_DATA.O.atomicMassU
  const a = ICE.cellPm.a * 1e-10
  const c = ICE.cellPm.c! * 1e-10
  const V = (Math.sqrt(3) / 2) * a * a * c
  const rho = (ICE.z * M) / (N_A * V)
  ok('ρ(лёд) ядра = Z·M/(N_A·V) с точностью 0,5 %', Math.abs(rho - ICE.densityGCm3) / ICE.densityGCm3 < 5e-3, rho.toFixed(4))
}

console.log(`✓ h2o cinema: ${checks} проверок пройдено`)
console.log(`  шагов ${H2O_STEPS.length}, экранное время ${wall.toFixed(1)} с (${H2O_STEPS.map((s) => s.wall).join(' + ')} + хвост), сюжет ${H2O_END} с`)
console.log(`  цепь: +${H2O_CHAIN_KJ.initiation} / +${H2O_CHAIN_KJ.branchH} / +${H2O_CHAIN_KJ.branchO} / ${H2O_CHAIN_KJ.propagation}; звено ${H2O_CHAIN_LINK_KJ}; по Гессу ${H2O_CHAIN_HESS_KJ} кДж`)
console.log(`  лестница через атомы: ${H2O_LADDER.stages.map((s) => s.dH).join(' ')} = ${H2O_LADDER.sumKJ} (таблица ${H2O_LADDER.tableKJ})`)
console.log(`  лёд Ih: ${ICE_MOLECULES.length} молекул, ${ICE_HBONDS.length} водородных связей внутри фрагмента, ${ICE_FRAG.cellEdges.length} рёбер ячеек, O···O ${ICE.cationAnionPm} пм`)
console.log(`  геометрия: O–H ${H2O_GEOM.data.ohPm} пм, ∠ ${H2O_GEOM.angleDeg}°, μ ${H2O_GEOM.data.dipoleD} D`)
