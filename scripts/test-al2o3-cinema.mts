#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт сцены «горение алюминия: 4 Al (тв.) + 3 O₂ (г.) → 2 Al₂O₃ (тв., корунд)».
 * Построен по образцу эталона scripts/test-nacl-cinema.mts.
 *
 * Сцена проверяется ДАННЫМИ, а не строками: раскадровка — чистая функция sampleAl2o3Frame(t),
 * весь урок сэмплируется в Node, а каждое число сверяется с научным ядром src/chemistry/data.
 * Проверок «есть ли в тексте слово/литерал» здесь НЕТ: числа ИЗВЛЕКАЮТСЯ из текста и сверяются
 * с ядром, наборы и порядок чисел ru / en / uz обязаны совпадать.
 *
 *   1. Хронометраж: 6 ± 1 шаг, каждый 4–7 экранных секунд, всего 26–34 с, cue лаборатории
 *      embryo → birth → complete строго после последнего шага.
 *   2. Раскадровка: дорожки монотонны, ни атом, ни камера не прыгают между кадрами 1/30 с.
 *   3. Геометрия ↔ ядро: O=O, ГЦК алюминия (КЧ 12), аморфная плёнка (толщина, состав, расстояния),
 *      корунд 2×2×1 — узлы, радиусы Шеннона при КЧ узла, противоионы, рёбра a и c, плотность,
 *      октаэдр AlO₆ с двумя длинами Al–O и тетраэдр OAl₄.
 *   4. Заряд Al — в кадр ухода каждого электрона, O — в кадр прихода; радиус — в кадр появления
 *      Al³⁺ и O²⁻; сумма зарядов (с летящими e⁻) = 0 каждые 1/60 с; валентные точки.
 *   5. На каждом шаге видимы только объекты этого шага; на паузе каждый видимый атом подписан.
 *   6. Финал без огня: все FX-амплитуды = 0, свечение атомов базовое.
 *   7. Энергия: лестница = BORN_HABER.al2o3 с множителями, сумма = табличная ΔH°f, знаки.
 *   8. 3D-подписи: только формулы/числа/единицы-токены, числа — из ядра.
 *   9. Тексты: извлечённые числа ↔ ядро, привязка чисел к местам, синхронность ru/en/uz.
 *
 * Запуск: npx tsx scripts/test-al2o3-cinema.mts
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  ATOMIC_DATA,
  BORN_HABER,
  bondLengthPm,
  dHfKJ,
  getCrystal,
  LATTICE_ENTHALPY_KJ,
  NATIVE_OXIDE_FILMS,
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
import { assertIonSizeOrder, bondLength, LATTICE_BALL_SCALE, pmToScene, SPECIES_SCALE } from '../src/lab/cinema/scenes/kit/cpkAtoms.ts'
import { ladderLevels } from '../src/lab/cinema/scenes/kit/energyLadderData.ts'
import { assertSnapAt } from '../src/lab/cinema/scenes/kit/valence.ts'
import { coordinationShell, FIRST_SHELL_RATIO, periodicNeighbors } from '../src/lab/cinema/scenes/kit/lattice.ts'
import {
  AL2O3_ATOM_INDEX,
  AL2O3_ATOMS,
  AL2O3_CAMERA,
  AL2O3_CUES,
  AL2O3_DETACH,
  AL2O3_DIM_DROP,
  AL2O3_EDGE_A,
  AL2O3_EDGE_C,
  AL2O3_ELECTRON_LEAD,
  AL2O3_ELECTRONS,
  AL2O3_END,
  AL2O3_FIRST_ARRIVE,
  AL2O3_FIRST_LEAVE,
  AL2O3_GEOM,
  AL2O3_JUMPS,
  AL2O3_LABELS,
  AL2O3_METAL_OFFSET,
  AL2O3_SEGMENTS,
  AL2O3_SNAP,
  AL2O3_STEPS,
  AL2O3_STEP_IDS,
  AL2O3_TIMING,
  CORUNDUM_FRAG,
  CORUNDUM_SITE_OF,
  FILM_DIM,
  FILM_SITES,
  METAL_BONDS,
  METAL_FRAG,
  METAL_SITE_OF,
  O2_MOLECULES,
  OCTA,
  createAl2o3Frame,
  sampleAl2o3Frame,
  validateAl2o3Storyboard,
  type Al2o3Frame,
} from '../src/lab/cinema/scenes/al2o3/al2o3Storyboard.ts'
import {
  AL_IE_KJ,
  AL_IE_SUM_KJ,
  AL2O3_COST_BEFORE_LATTICE_KJ,
  AL2O3_DHF_KJ,
  AL2O3_DHF_TABLE_KJ,
  AL2O3_HALF_REACTIONS,
  AL2O3_LADDER,
  AL2O3_LATTICE_KJ,
  AL2O3_REACTION,
  AL2O3_REACTION_DH_KJ,
  AL2O3_U_RANGE_KJ,
  MGO_LATTICE_KJ,
  O_EA1_KJ,
  O_EA2_KJ,
  O_EA2_MAX_KJ,
  THERMITE_DH_KJ,
  THERMITE_REACTION,
  al2o3StageKJ,
  al2o3StageMultiplier,
  al2o3StagePerUnitKJ,
  validateAl2o3Energetics,
  type Al2o3StageId,
} from '../src/lab/cinema/scenes/al2o3/al2o3Energetics.ts'
import { getAl2o3MechanismText, type Al2o3Locale, type Al2o3MechanismText } from '../src/lab/cinema/scenes/al2o3/al2o3MechanismText.ts'
import { al2o3ScientificWatchdogMs } from '../src/lab/scientificSynthesis/al2o3ScenarioTiming.ts'

const LOCALES: Al2o3Locale[] = ['ru', 'en', 'uz']
const frame = createAl2o3Frame()
const at = (t: number): Al2o3Frame => sampleAl2o3Frame(t, frame)
const idx = (id: string) => AL2O3_ATOM_INDEX.get(id)!

let checks = 0
function ok(label: string, cond: boolean, detail = ''): void {
  assert.ok(cond, `${label}${detail ? ` — ${detail}` : ''}`)
  checks++
}
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol

const COR = getCrystal('corundum')!
const METAL = getCrystal('al_metal')!
const FILM = NATIVE_OXIDE_FILMS.al
const STEP_PAUSE = AL2O3_STEPS.map((s) => s.to)
const LAST = AL2O3_STEPS.length - 1
const STORY_AL = ['alA1', 'alA2', 'alB1', 'alB2']
const STORY_O = ['oA1', 'oA2', 'oA3', 'oB1', 'oB2', 'oB3']
const STORY = [...STORY_AL, ...STORY_O]
const CN_AL = COR.coordination['Al³⁺']!
const CN_O = COR.coordination['O²⁻']!
/** Радиус Шеннона при КЧ в мировых единицах с долей scale. */
const shannon = (el: 'Al' | 'O', charge: number, cn: number, scale: number) => pmToScene(radiusForSpecies(el, charge, { cn })) * scale
const sceneToPm = (d: number) => d / pmToScene(1)
const dist3 = (p: readonly number[], q: readonly number[]) => Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!)

// ─────────────────────────────────────────────────────────────────────────────
// 1. Хронометраж и контракт лаборатории
// ─────────────────────────────────────────────────────────────────────────────

AL2O3_TIMING.validate()
ok('шагов 6 ± 1', AL2O3_STEPS.length >= 5 && AL2O3_STEPS.length <= 7, `${AL2O3_STEPS.length}`)
ok('id шагов совпадают', AL2O3_STEP_IDS.join(',') === AL2O3_STEPS.map((s) => s.id).join(','))
const wall = storyWallDuration(AL2O3_SEGMENTS)
ok('экранная длительность 26–34 с', wall >= 26 && wall <= 34, `${wall.toFixed(1)} с`)
ok('wallDuration kit = сумма сегментов', near(wall, AL2O3_TIMING.wallDuration, 1e-9))
for (const s of AL2O3_STEPS) ok(`шаг ${s.id}: 4–7 экранных секунд`, s.wall >= 4 && s.wall <= 7, `${s.wall}`)
const lastStepTo = AL2O3_STEPS[LAST]!.to
for (const id of ['embryo', 'birth', 'complete']) {
  const c = AL2O3_CUES.find((x) => x.id === id)!
  ok(`cue ${id} строго после последнего шага`, c.at > lastStepTo, `${c.at} ≤ ${lastStepTo}`)
}
for (const c of AL2O3_CUES) {
  if (['embryo', 'birth', 'complete'].includes(c.id)) continue
  ok(`cue ${c.id} внутри шагов`, c.at > 0 && c.at < lastStepTo)
}
ok('complete совпадает с концом сюжета', AL2O3_CUES.find((c) => c.id === 'complete')!.at === AL2O3_END)
ok('watchdog лаборатории положителен', al2o3ScientificWatchdogMs() > 0)
for (let i = 0; i < AL2O3_STEPS.length; i++) {
  const s = AL2O3_STEPS[i]!
  ok(`stepIndexAt(${s.id})`, AL2O3_TIMING.stepIndexAt((s.from + s.to) / 2) === i)
}
// Все двенадцать переходов — внутри шага переноса, последний приход = cue 'transfer'.
{
  const tr = AL2O3_STEPS.find((s) => s.id === 'transfer')!
  ok('переходы электронов внутри шага 3', AL2O3_ELECTRONS.every((e) => e.leave - AL2O3_ELECTRON_LEAD > tr.from && e.arrive < tr.to && e.arrive > e.leave))
  ok('последний приход = cue transfer', near(Math.max(...AL2O3_ELECTRONS.map((e) => e.arrive)), AL2O3_CUES.find((c) => c.id === 'transfer')!.at, 1e-9))
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Раскадровка: дорожки, рывки атомов и камеры, ноль аллокаций
// ─────────────────────────────────────────────────────────────────────────────

validateAl2o3Storyboard()
{
  const scratch = createAl2o3Frame()
  const buf = AL2O3_ATOMS.map((a) => ({ id: a.id, pos: new THREE.Vector3(), opacity: 0 }))
  assertNoPositionJumps(
    (t) => {
      sampleAl2o3Frame(t, scratch)
      for (let i = 0; i < AL2O3_ATOMS.length; i++) {
        buf[i]!.pos.copy(scratch.pos[i]!)
        buf[i]!.opacity = scratch.opacity[i]!
      }
      return buf
    },
    AL2O3_END,
    0.09,
    1 / 30,
  )
  checks++
  const cam = createSceneCamera()
  assertCameraContinuity((t) => sampleShot(AL2O3_CAMERA, t, cam), AL2O3_END)
  checks++

  // Видимость не щёлкает: у растущего иона решётки — доля радиуса, у остальных — непрозрачность.
  const fullR = AL2O3_ATOMS.map((a) => (a.kind === 'lattice' ? shannon(a.el, a.el === 'Al' ? 3 : -2, a.el === 'Al' ? CN_AL : CN_O, LATTICE_BALL_SCALE) : 0))
  const presence = (i: number) => (AL2O3_ATOMS[i]!.kind === 'lattice' ? scratch.radius[i]! / fullR[i]! : scratch.opacity[i]!)
  let prev: Float32Array | null = null
  let worst = 0
  let worstT = 0
  for (let t = 0; t <= AL2O3_END + 1e-9; t += 1 / 30) {
    sampleAl2o3Frame(t, scratch)
    const now = Float32Array.from(AL2O3_ATOMS, (_, i) => presence(i))
    if (prev) {
      for (let i = 0; i < AL2O3_ATOMS.length; i++) {
        const d = Math.abs(now[i]! - prev[i]!)
        if (d > worst) {
          worst = d
          worstT = t
        }
      }
    }
    prev = now
  }
  ok('видимость без скачка (≤ 0,12 за 1/30 с)', worst <= 0.12, `${worst.toFixed(3)} при t=${worstT.toFixed(2)}`)

  const posRefs = scratch.pos.slice()
  const labelRefs = scratch.labels.slice()
  const labelPos = scratch.labels.map((l) => l.pos)
  const elRefs = scratch.electrons.slice()
  for (let t = 0; t <= AL2O3_END; t += 0.5) sampleAl2o3Frame(t, scratch)
  ok('векторы позиций переиспользуются', scratch.pos.every((p, i) => p === posRefs[i]))
  ok('подписи переиспользуются', scratch.labels.every((l, i) => l === labelRefs[i] && l.pos === labelPos[i]))
  ok('электроны переиспользуются', scratch.electrons.every((e, i) => e === elRefs[i]))
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Геометрия раскадровки ↔ ядро
// ─────────────────────────────────────────────────────────────────────────────

// 3.1 Радиусы: катион меньше атома, анион больше; ионы — Шеннон при фактическом КЧ корунда.
assertIonSizeOrder('Al', 3)
assertIonSizeOrder('O', -2)
checks += 2
{
  const R = AL2O3_GEOM.radius
  ok('Al⁰ — металлический радиус ядра', near(R.al, pmToScene(radiusForSpecies('Al', 0)) * SPECIES_SCALE))
  ok('O⁰ — ковалентный радиус ядра', near(R.o, pmToScene(radiusForSpecies('O', 0)) * SPECIES_SCALE))
  ok('Al³⁺ — Шеннон при КЧ корунда', near(R.alIon, shannon('Al', 3, CN_AL, SPECIES_SCALE)))
  ok('O²⁻ — Шеннон при КЧ корунда', near(R.oIon, shannon('O', -2, CN_O, SPECIES_SCALE)))
  ok('КЧ плёнки — КЧ, для которого в ядре есть радиус Al³⁺', ATOMIC_DATA.Al.ionicRadiiByCnPm!['+3']![String(AL2O3_GEOM.cn.alFilm)] != null)
  ok('Al³⁺ плёнки — Шеннон при КЧ плёнки', near(R.filmAl, shannon('Al', 3, AL2O3_GEOM.cn.alFilm, SPECIES_SCALE)))
  ok('отношение O²⁻ / Al³⁺ на экране = данным', near(R.oIon / R.alIon, radiusForSpecies('O', -2, { cn: CN_O }) / radiusForSpecies('Al', 3, { cn: CN_AL }), 1e-9))
}

// 3.2 Шаг 1: O₂ из bondData, металл — ГЦК из crystalData, плёнка — толщина из phenomenaData.
at(STEP_PAUSE[0]!)
for (const m of O2_MOLECULES) {
  ok(`O₂ ${m.a}–${m.b}: d(O=O) = bondLength`, near(frame.pos[idx(m.a)]!.distanceTo(frame.pos[idx(m.b)]!), bondLength('O=O')))
  ok(`O₂ ${m.a}: газ`, frame.material[idx(m.a)] === 'gas' && frame.material[idx(m.b)] === 'gas')
}
ok('O=O: связи видны', frame.bond.opacity > 0.9)
ok('атомы Al сюжета — металл', STORY_AL.every((id) => frame.material[idx(id)] === 'metal'))
ok('ГЦК: все узлы фрагмента в кадре', METAL_SITE_OF.size === METAL_FRAG.sites.length)
for (const [id, si] of METAL_SITE_OF) {
  const want = new THREE.Vector3(...METAL_FRAG.sites[si]!.posScene).add(new THREE.Vector3(...AL2O3_METAL_OFFSET))
  ok(`металл ${id} в своём узле`, frame.pos[idx(id)]!.distanceTo(want) < 1e-6)
  ok(`металл ${id}: КЧ узла = coordination ядра`, METAL_FRAG.sites[si]!.cn === METAL.coordination.Al)
}
for (const [a, b] of METAL_BONDS) {
  const d = sceneToPm(frame.pos[idx(a)]!.distanceTo(frame.pos[idx(b)]!))
  ok(`металл ${a}–${b} = d(Al–Al) ядра (±0,05 пм — округление ядра)`, near(d, METAL.cationAnionPm, 0.05), d.toFixed(2))
}
ok('рёбра ячейки металла видны', frame.edgeSet === 'metal' && frame.edges > 0.9)
{
  ok('толщина плёнки на рисунке = нижняя граница ядра', near(FILM_DIM.y1 - FILM_DIM.y0, pmToScene(FILM.min * 1000), 1e-9) && near(AL2O3_GEOM.filmThickness, pmToScene(FILM.min * 1000), 1e-9))
  ok('плёнка лежит на металле', near(FILM_DIM.y0, AL2O3_GEOM.metalTop, 1e-9))
  const minPm = AL2O3_GEOM.corundumMinPm
  ok('кратчайшие расстояния корунда = периодическое окружение ядра', near(minPm.AlO, Math.min(...periodicNeighbors('corundum').map((x) => x.minPm)), 0.01))
  const nAl = FILM_SITES.filter((f) => f.el === 'Al').length
  const nO = FILM_SITES.length - nAl
  ok('плёнка: состав Al : O = 2 : 3', nAl > 0 && nAl * 3 === nO * 2, `${nAl} : ${nO}`)
  let tooClose = 0
  for (let i = 0; i < FILM_SITES.length; i++) {
    const p = FILM_SITES[i]!
    ok(`плёнка ${i}: внутри слоя`, p.pos[1] >= AL2O3_GEOM.filmY[0] - 1e-9 && p.pos[1] <= AL2O3_GEOM.filmY[1] + 1e-9)
    for (let j = i + 1; j < FILM_SITES.length; j++) {
      const q = FILM_SITES[j]!
      const d = sceneToPm(dist3(p.pos, q.pos))
      const lim = p.el !== q.el ? minPm.AlO : p.el === 'O' ? minPm.OO : minPm.AlAl
      if (d < lim - 1e-6) tooClose++
    }
    const i0 = idx(`F${i}`)
    const want = p.el === 'Al' ? AL2O3_GEOM.radius.filmAl : AL2O3_GEOM.radius.filmO
    ok(`плёнка F${i}: радиус и заряд иона`, near(frame.radius[i0]!, want) && frame.charge[i0] === (p.el === 'Al' ? 3 : -2) && frame.material[i0] === 'ion')
  }
  ok('плёнка: нет пар ближе кратчайших расстояний корунда', tooClose === 0, `${tooClose}`)
  // Молекулы O₂ лежат НА плёнке, а не в ней.
  const filmTop = Math.max(...FILM_SITES.map((f) => f.pos[1]))
  const o2Low = Math.min(...STORY_O.map((id) => frame.pos[idx(id)]!.y))
  ok('O₂ над плёнкой', o2Low - filmTop >= AL2O3_GEOM.radius.filmO + AL2O3_GEOM.radius.o - 1e-9, `${(o2Low - filmTop).toFixed(3)}`)
  ok('размерная линия плёнки видна', frame.dims.film > 0.9)
}

// 3.3 Шаг 4: корунд 2×2×1 из базиса ядра.
at(STEP_PAUSE[3]!)
{
  const D1 = pmToScene(COR.cationAnionPm)
  const limit = D1 * FIRST_SHELL_RATIO
  const vis = AL2O3_ATOMS.map((a, i) => ({ a, i })).filter(({ a }) => CORUNDUM_SITE_OF.has(a.id))
  ok('все узлы фрагмента в кадре и видимы', vis.length === CORUNDUM_FRAG.sites.length && vis.every(({ i }) => frame.opacity[i]! > 0.99))
  ok('фрагмент — целое число ячеек', CORUNDUM_FRAG.cells.every((n) => Number.isInteger(n) && n >= 1))
  for (const { a, i } of vis) {
    const s = CORUNDUM_FRAG.sites[CORUNDUM_SITE_OF.get(a.id)!]!
    ok(`ион ${a.id} в своём узле`, frame.pos[i]!.distanceTo(new THREE.Vector3(...s.posScene)) < 1e-6)
    ok(`ион ${a.id}: элемент узла`, s.el === a.el)
    ok(`ион ${a.id}: КЧ узла = coordination ядра`, s.cn === (a.el === 'Al' ? CN_AL : CN_O))
    ok(`ион ${a.id}: радиус Шеннона при КЧ узла (доля решётки)`, near(frame.radius[i]!, shannon(a.el, a.el === 'Al' ? 3 : -2, s.cn, LATTICE_BALL_SCALE), 1e-6))
    ok(`ион ${a.id}: заряд и материал`, frame.charge[i] === (a.el === 'Al' ? 3 : -2) && frame.material[i] === 'ion')
    const p = frame.pos[i]!
    const first = vis.filter(({ i: j }) => j !== i && frame.pos[j]!.distanceTo(p) <= limit + 1e-6)
    ok(`ион ${a.id}: в первой сфере только противоионы`, first.every(({ a: b }) => b.el !== a.el))
    ok(`ион ${a.id}: никого ближе d(Al–O)`, vis.every(({ i: j }) => j === i || frame.pos[j]!.distanceTo(p) >= D1 - 1e-4))
  }
  // Рёбра ячеек: по a и b — длина a, по c — длина c.
  const nx = CORUNDUM_FRAG.cells[0]
  const ny = CORUNDUM_FRAG.cells[1]
  const nz = CORUNDUM_FRAG.cells[2]
  ok('число рёбер ячеек = сетке ячеек', CORUNDUM_FRAG.cellEdges.length === nx * (ny + 1) * (nz + 1) + (nx + 1) * ny * (nz + 1) + (nx + 1) * (ny + 1) * nz)
  for (const [p, q] of CORUNDUM_FRAG.cellEdges) {
    const d = sceneToPm(dist3(p, q))
    ok('ребро ячейки = a или c ядра', near(d, COR.cellPm.a, 1e-6) || near(d, COR.cellPm.c!, 1e-6), d.toFixed(2))
  }
  ok('рёбра ячеек корунда видны', frame.edgeSet === 'corundum' && frame.edges > 0.9)
  ok('подпись a стоит у ребра длиной a', near(sceneToPm(dist3(AL2O3_EDGE_A[0], AL2O3_EDGE_A[1])), COR.cellPm.a, 1e-6))
  ok('подпись c стоит у ребра длиной c', near(sceneToPm(dist3(AL2O3_EDGE_C[0], AL2O3_EDGE_C[1])), COR.cellPm.c!, 1e-6))
  ok('размерные линии вне сфер', AL2O3_DIM_DROP > AL2O3_GEOM.latticeRadius.oIon)
  ok('размерные линии видны на паузе шага 4', frame.dims.edgeA > 0.9 && frame.dims.edgeC > 0.9)
  ok('металл и плёнка давно погашены', AL2O3_ATOMS.every((a, i) => (a.kind !== 'metal' && a.kind !== 'film') || frame.opacity[i] === 0))
  // Состав фрагмента не обязан быть стехиометричным (граница), а ячейка — обязана: Z формульных единиц.
  const basis = COR.basis!
  ok('ячейка: 2Z Al и 3Z O', basis.filter((b) => b.el === 'Al').length === 2 * COR.z && basis.filter((b) => b.el === 'O').length === 3 * COR.z)
  const N_A = 6.02214076e23
  const M = 2 * ATOMIC_DATA.Al.atomicMassU + 3 * ATOMIC_DATA.O.atomicMassU
  const V = (Math.sqrt(3) / 2) * (COR.cellPm.a * 1e-10) ** 2 * (COR.cellPm.c! * 1e-10)
  const rhoX = (COR.z * M) / (N_A * V)
  ok('ρ(корунд) ядра = Z·M/(N_A·V) с точностью 0,3 %', Math.abs(rhoX - COR.densityGCm3) / COR.densityGCm3 < 3e-3, `${rhoX.toFixed(4)} против ${COR.densityGCm3}`)
}

// 3.4 Шаг 5: октаэдр AlO₆ и тетраэдр OAl₄ из связей фрагмента.
{
  const sh = coordinationShell(CORUNDUM_FRAG, OCTA.al)
  const pn = periodicNeighbors('corundum')[CORUNDUM_FRAG.sites[OCTA.al]!.basisIndex]!
  ok('октаэдр: 6 соседей, все O', sh.neighbors.length === CN_AL && sh.neighbors.every((j) => CORUNDUM_FRAG.sites[j]!.el === 'O'))
  ok('октаэдр: 12 рёбер', sh.edges.length === 12)
  ok('октаэдр: расстояния = периодическое окружение ядра', sh.distancesPm.every((d, k) => near(d, pn.shellPm[k]!, 1e-6)))
  const short = sh.distancesPm.filter((d) => d < (OCTA.shortPm + OCTA.longPm) / 2)
  ok('две длины Al–O: 3 короткие и 3 длинные', short.length === 3 && sh.distancesPm.length - short.length === 3)
  ok('короткая Al–O = cationAnionPm ядра', near(OCTA.shortPm, COR.cationAnionPm, 0.05))
  ok('длинная больше короткой', OCTA.longPm - OCTA.shortPm > 5)
  const tet = coordinationShell(CORUNDUM_FRAG, OCTA.o)
  ok('тетраэдр: 4 соседа, все Al', tet.neighbors.length === CN_O && tet.neighbors.every((j) => CORUNDUM_FRAG.sites[j]!.el === 'Al'))
  ok('тетраэдр: 6 рёбер', tet.edges.length === 6)
  ok('выделенный O — сосед выделенного Al', sh.neighbors.includes(OCTA.o))
  ok('размерные линии длин — к соседям нужной длины', near(sceneToPm(dist3(CORUNDUM_FRAG.sites[OCTA.al]!.posScene, CORUNDUM_FRAG.sites[OCTA.short]!.posScene)), OCTA.shortPm, 1e-6) && near(sceneToPm(dist3(CORUNDUM_FRAG.sites[OCTA.al]!.posScene, CORUNDUM_FRAG.sites[OCTA.long]!.posScene)), OCTA.longPm, 1e-6))
  at(STEP_PAUSE[4]!)
  ok('пауза шага 5: многогранники видны', frame.dims.poly > 0.9)
  at(STEP_PAUSE[3]!)
  ok('пауза шага 4: многогранников ещё нет', frame.dims.poly === 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Переходы электронов: заряд — в кадр ухода/прихода, радиус — в кадр Al³⁺ / O²⁻
// ─────────────────────────────────────────────────────────────────────────────

{
  const R = AL2O3_GEOM.radius
  const dt = 1 / 60
  const lbl = (id: string) => frame.labels.find((l) => l.id === id)!.text
  const valenceOf = (id: string) => frame.valence[STORY.indexOf(id)]!
  const inLead = (id: string, t: number) => AL2O3_JUMPS.filter((j) => j.donor === id && t >= j.leave - AL2O3_ELECTRON_LEAD && t < j.leave).length
  const AL_LABELS = ['Al ({g})', 'Al⁺', 'Al²⁺', 'Al³⁺']
  const O_LABELS = ['O ({g})', 'O⁻', 'O²⁻']
  ok('прыжков 12 = 4 Al × 3 = 6 O × 2', AL2O3_JUMPS.length === 12 && STORY_AL.length * 3 === 12 && STORY_O.length * 2 === 12)
  for (const id of STORY_AL) {
    const js = AL2O3_JUMPS.filter((j) => j.donor === id).sort((a, b) => a.leave - b.leave)
    ok(`${id}: отдаёт ровно valenceElectrons ядра`, js.length === ATOMIC_DATA.Al.valenceElectrons)
    assertSnapAt(AL2O3_SNAP[`radius.${id}`]!, js[2]!.leave, R.al, R.alIon)
    checks++
    js.forEach((j, n) => {
      at(j.leave - dt)
      const b = { q: frame.charge[idx(id)]!, r: frame.radius[idx(id)]!, l: lbl(id), m: frame.material[idx(id)] }
      at(j.leave)
      ok(`${id}: заряд +${n} → +${n + 1} в кадр ухода e⁻ №${n + 1}`, b.q === n && frame.charge[idx(id)] === n + 1)
      ok(`${id}: подпись ${AL_LABELS[n]} → ${AL_LABELS[n + 1]} в тот же кадр`, b.l === AL_LABELS[n] && lbl(id) === AL_LABELS[n + 1])
      if (n === 0) ok(`${id}: газ → ion в кадр первого ухода`, b.m === 'gas' && frame.material[idx(id)] === 'ion')
      if (n < 2) ok(`${id}: радиус атома до появления Al³⁺`, near(frame.radius[idx(id)]!, R.al))
      else ok(`${id}: радиус Al³⁺ в кадр третьего ухода`, near(b.r, R.al) && near(frame.radius[idx(id)]!, R.alIon))
    })
  }
  for (const id of STORY_O) {
    const js = AL2O3_JUMPS.filter((j) => j.acceptor === id).sort((a, b) => a.arrive - b.arrive)
    ok(`${id}: принимает два электрона (октет ядра: 8 − valenceElectrons)`, js.length === 8 - ATOMIC_DATA.O.valenceElectrons)
    ok(`${id}: электроны от двух разных атомов Al`, js[0]!.donor !== js[1]!.donor)
    assertSnapAt(AL2O3_SNAP[`radius.${id}`]!, js[1]!.arrive, R.o, R.oIon)
    checks++
    js.forEach((j, n) => {
      const k = AL2O3_JUMPS.indexOf(j)
      at(j.arrive - dt)
      const b = { q: frame.charge[idx(id)]!, l: lbl(id), m: frame.material[idx(id)], dots: valenceOf(id).count, arrived: frame.electrons[k]!.arrived }
      at(j.arrive)
      ok(`${id}: заряд −${n} → −${n + 1} в кадр прихода`, b.q === -n && frame.charge[idx(id)] === -(n + 1))
      ok(`${id}: электрон пришёл в этот кадр`, !b.arrived && frame.electrons[k]!.arrived)
      ok(`${id}: подпись ${O_LABELS[n]} → ${O_LABELS[n + 1]}`, b.l === O_LABELS[n] && lbl(id) === O_LABELS[n + 1])
      ok(`${id}: точек ${6 + n} → ${7 + n} (valenceElectrons − заряд)`, b.dots === ATOMIC_DATA.O.valenceElectrons + n && valenceOf(id).count === ATOMIC_DATA.O.valenceElectrons + n + 1)
      ok(`${id}: новая точка подсвечена`, valenceOf(id).highlight === valenceOf(id).count - 1)
      if (n === 0) ok(`${id}: газ → ion в кадр первого прихода, радиус ещё атомный`, b.m === 'gas' && frame.material[idx(id)] === 'ion' && near(frame.radius[idx(id)]!, R.o))
      else ok(`${id}: радиус O²⁻ в кадр второго прихода`, near(frame.radius[idx(id)]!, R.oIon))
    })
  }
  // Сохранение заряда и счёт точек донора каждые 1/60 с шага 3.
  const s3 = AL2O3_STEPS.find((s) => s.id === 'transfer')!
  let worstQ = 0
  let badDots = 0
  for (let t = s3.from; t <= s3.to + 1e-9; t += dt) {
    at(t)
    let q = 0
    for (const id of STORY) q += frame.charge[idx(id)]!
    for (const j of AL2O3_JUMPS) if (t >= j.leave && t < j.arrive) q -= 1
    worstQ = Math.max(worstQ, Math.abs(q))
    for (const id of STORY_AL) {
      const want = ATOMIC_DATA.Al.valenceElectrons - frame.charge[idx(id)]! - inLead(id, t)
      if (valenceOf(id).count !== Math.max(0, want)) badDots++
    }
  }
  ok('шаг 3: заряд сохраняется в каждом кадре (Σq + летящие e⁻ = 0)', worstQ === 0, `${worstQ}`)
  ok('шаг 3: у Al точек = 3 − заряд − электрон на оболочке', badDots === 0, `${badDots}`)
  const ion = AL2O3_LADDER.stages.find((st) => st.id === 'ionization')!
  ok('ступень ионизации лестницы = кадр первого ухода e⁻ (Al⁺ в 3D)', near(ion.at, Math.min(...Object.values(AL2O3_FIRST_LEAVE)), 1e-9))
  const ea1 = AL2O3_LADDER.stages.find((st) => st.id === 'affinity1')!
  const ea2 = AL2O3_LADDER.stages.find((st) => st.id === 'affinity2')!
  ok('ступень EA₁ = когда все шесть O стали O⁻', near(ea1.at, Math.max(...Object.values(AL2O3_FIRST_ARRIVE)), 1e-9))
  ok('ступень EA₂ = последний приход', near(ea2.at, Math.max(...AL2O3_JUMPS.map((j) => j.arrive)), 1e-9))
  // Пауза шага 2 — «до»: у Al три точки, у O шесть.
  at(STEP_PAUSE[1]!)
  for (const id of STORY_AL) ok(`пауза шага 2: у ${id} три точки (ядро)`, valenceOf(id).count === ATOMIC_DATA.Al.valenceElectrons && valenceOf(id).amount > 0.9)
  for (const id of STORY_O) ok(`пауза шага 2: у ${id} шесть точек (ядро)`, valenceOf(id).count === ATOMIC_DATA.O.valenceElectrons && valenceOf(id).amount > 0.9)
  // Пауза шага 3 — «после»: Al³⁺ без точек, O²⁻ — октет.
  at(STEP_PAUSE[2]!)
  for (const id of STORY_AL) ok(`пауза шага 3: ${id} — Al³⁺, точек нет`, frame.charge[idx(id)] === 3 && valenceOf(id).count === 0)
  for (const id of STORY_O) ok(`пауза шага 3: ${id} — O²⁻, октет`, frame.charge[idx(id)] === -2 && valenceOf(id).count === 8)
  // Отрыв от металла: материал metal → gas в момент начала движения.
  for (const id of STORY_AL) {
    at(AL2O3_DETACH[id]! - 0.3 - dt)
    const m0 = frame.material[idx(id)]
    at(AL2O3_DETACH[id]! - 0.3)
    ok(`${id}: metal → gas в кадр отрыва`, m0 === 'metal' && frame.material[idx(id)] === 'gas')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Только объекты текущего шага; на паузе каждый видимый атом подписан
// ─────────────────────────────────────────────────────────────────────────────

function hostSpan(hosts: readonly string[]): number {
  let m = 0
  for (const a of hosts) for (const b of hosts) m = Math.max(m, frame.pos[idx(a)]!.distanceTo(frame.pos[idx(b)]!))
  return m
}

for (let si = 0; si < AL2O3_STEPS.length; si++) {
  const s = AL2O3_STEPS[si]!
  let foreign = 0
  let at0 = -1
  for (let t = s.from; t <= s.to + 1e-9; t += 1 / 60) {
    at(t)
    for (let i = 0; i < AL2O3_ATOMS.length; i++) {
      const [a, b] = AL2O3_ATOMS[i]!.span
      if (!(si >= a && si <= b) && frame.opacity[i]! > 0) {
        foreign++
        if (at0 < 0) at0 = t
      }
    }
  }
  ok(`шаг ${s.id}: ни одного объекта чужого шага`, foreign === 0, `первый при t=${at0.toFixed(3)}`)

  at(s.to)
  const visibleLabels = frame.labels.map((l, k) => ({ st: l, def: AL2O3_LABELS[k]! })).filter(({ st }) => st.opacity > 0.5)
  ok(`пауза ${s.id}: есть подписи`, visibleLabels.length > 0)
  for (let i = 0; i < AL2O3_ATOMS.length; i++) {
    if (frame.opacity[i]! <= 0.02) continue
    const id = AL2O3_ATOMS[i]!.id
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
at(STEP_PAUSE[1]!)
ok('после трещины ни одного атома металла и плёнки', AL2O3_ATOMS.every((a, i) => (a.kind !== 'metal' && a.kind !== 'film') || frame.opacity[i] === 0))
ok('на паузе шага 2 рёбер металла нет', frame.edges === 0)
at(STEP_PAUSE[2]!)
ok('на паузе шага 3 решётки ещё нет', AL2O3_ATOMS.every((a, i) => a.kind !== 'lattice' || frame.opacity[i] === 0))

// ─────────────────────────────────────────────────────────────────────────────
// 6. Финал без огня: все FX = 0 на всём шаге 6
// ─────────────────────────────────────────────────────────────────────────────

{
  const s = AL2O3_STEPS[LAST]!
  at(AL2O3_STEPS[0]!.from + 0.01)
  const baseEmissive = frame.emissive[0]!
  const baseBloom = frame.camera.bloom
  for (let t = s.from; t <= s.to + 1e-9; t += 1 / 30) {
    at(t)
    const fx = frame.fx.electrons + frame.valence.reduce((m, v) => m + v.amount, 0)
    ok(`шаг 6, t=${t.toFixed(2)}: FX-амплитуды = 0`, fx === 0, `${fx}`)
    let hot = 0
    for (let i = 0; i < AL2O3_ATOMS.length; i++) if (frame.emissive[i] !== baseEmissive) hot++
    ok(`шаг 6, t=${t.toFixed(2)}: свечение атомов базовое`, hot === 0, `${hot}`)
    ok(`шаг 6, t=${t.toFixed(2)}: bloom базовый, тряски нет`, near(frame.camera.bloom, baseBloom) && frame.camera.shake === 0)
  }
  at(s.to)
  ok('конец шага 6: кристалл цел и виден', CORUNDUM_FRAG.sites.length === AL2O3_ATOMS.filter((a, i) => CORUNDUM_SITE_OF.has(a.id) && frame.opacity[i]! > 0.99).length)
  at(AL2O3_END)
  ok('в конце хвоста кадр затемнён', frame.fade > 0.95)
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Энергетика: лестница = ядро, множители, знаки
// ─────────────────────────────────────────────────────────────────────────────

validateAl2o3Energetics()
{
  const cycle = BORN_HABER.al2o3
  ok('ступени лестницы = ступени BORN_HABER.al2o3', AL2O3_LADDER.stages.length === cycle.stages.length)
  for (const st of cycle.stages) {
    const l = AL2O3_LADDER.stages.find((x) => x.id === st.id)!
    ok(`ступень ${st.id} = ядро`, l.dH === st.dHKJ)
    ok(`ступень ${st.id}: множитель × на частицу = ступень`, near((l.multiplier ?? 1) * (l.perUnitKJ ?? l.dH), l.dH, 0.05))
  }
  const mult = (id: Al2o3StageId) => al2o3StageMultiplier(id)
  ok('множители: 2 Al (субл., ионизация), 3 O (диссоциация, EA₁, EA₂)', mult('sublimation') === 2 && mult('ionization') === 2 && mult('dissociation') === 3 && mult('affinity1') === 3 && mult('affinity2') === 3)
  ok('сублимация на атом = ΔH°f(Al, г.)', al2o3StagePerUnitKJ('sublimation') === dHfKJ('Al(g)'))
  ok('диссоциация на атом = ΔH°f(O, г.)', al2o3StagePerUnitKJ('dissociation') === dHfKJ('O(g)'))
  ok('ионизация на атом = IE₁ + IE₂ + IE₃ ядра', near(al2o3StagePerUnitKJ('ionization'), AL_IE_KJ[0] + AL_IE_KJ[1] + AL_IE_KJ[2], 0.05) && near(AL_IE_SUM_KJ, al2o3StagePerUnitKJ('ionization'), 0.05))
  ok('EA₁ на атом = ядро', al2o3StagePerUnitKJ('affinity1') === ATOMIC_DATA.O.electronAffinityKJ && O_EA1_KJ === ATOMIC_DATA.O.electronAffinityKJ)
  ok('EA₂ на атом = OXIDE_SECOND_EA_KJ', al2o3StagePerUnitKJ('affinity2') === OXIDE_SECOND_EA_KJ && O_EA2_KJ === OXIDE_SECOND_EA_KJ)
  ok('третий электрон дороже первых двух вместе', AL_IE_KJ[2] > AL_IE_KJ[0] + AL_IE_KJ[1])
  ok('U цикла = LATTICE_ENTHALPY_KJ', AL2O3_LATTICE_KJ === LATTICE_ENTHALPY_KJ['Al2O3(s)'])
  ok('U внутри литературного разброса ядра', AL2O3_U_RANGE_KJ[0] < -AL2O3_LATTICE_KJ && -AL2O3_LATTICE_KJ < AL2O3_U_RANGE_KJ[1])
  ok('EA₂ max из ядра больше EA₂', O_EA2_MAX_KJ > O_EA2_KJ)
  ok('Σ цикла = табличная ΔH°f (±0,05)', near(AL2O3_LADDER.sumKJ, dHfKJ('Al2O3(s)'), 0.05), `${AL2O3_LADDER.sumKJ}`)
  ok('таблица лестницы = ядро', AL2O3_DHF_TABLE_KJ === dHfKJ('Al2O3(s)'))
  ok('без решётки процесс сильно эндотермический', AL2O3_COST_BEFORE_LATTICE_KJ > 0 && near(AL2O3_COST_BEFORE_LATTICE_KJ, dHfKJ('Al2O3(s)') - AL2O3_LATTICE_KJ, 0.05))
  ok('ΔH реакции = 2 · ΔH°f', near(AL2O3_REACTION_DH_KJ, 2 * dHfKJ('Al2O3(s)'), 0.05))
  ok('термит = ΔH°f(Al₂O₃) − ΔH°f(Fe₂O₃)', near(THERMITE_DH_KJ, dHfKJ('Al2O3(s)') - dHfKJ('Fe2O3(s)'), 0.05))
  ok('U(Al₂O₃) / U(MgO) ≈ 4 («примерно вчетверо»)', Math.abs(AL2O3_LATTICE_KJ / MGO_LATTICE_KJ - 4) < 0.1)
  const byId = (id: Al2o3StageId) => al2o3StageKJ(id)
  ok('знаки: субл. > 0, IE > 0, D > 0, EA₁ < 0, EA₂ > 0, U < 0', byId('sublimation') > 0 && byId('ionization') > 0 && byId('dissociation') > 0 && byId('affinity1') < 0 && byId('affinity2') > 0 && byId('lattice') < 0)
  const levels = ladderLevels(AL2O3_LADDER)
  ok('последний уровень = сумма цикла', near(levels[levels.length - 1]!, AL2O3_LADDER.sumKJ))
  ok('ступени идут по времени сюжета и внутри шагов', AL2O3_LADDER.stages.every((s, i) => s.at > 0 && s.at < lastStepTo && (i === 0 || s.at >= AL2O3_LADDER.stages[i - 1]!.at)))
  ok('ΔH°f подписи = сумма цикла', near(AL2O3_DHF_KJ, AL2O3_LADDER.sumKJ, 0.05))
}

// Стехиометрия и электронный баланс.
{
  const count = (formula: string, coeff: number, into: Map<string, number>) => {
    for (const m of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) into.set(m[1]!, (into.get(m[1]!) ?? 0) + (m[2] ? Number(m[2]) : 1) * coeff)
  }
  for (const [name, r] of [
    ['горение', AL2O3_REACTION],
    ['термит', THERMITE_REACTION],
  ] as const) {
    const left = new Map<string, number>()
    const right = new Map<string, number>()
    for (const t of r.left) count(t.formula, t.coeff, left)
    for (const t of r.right) count(t.formula, t.coeff, right)
    for (const k of new Set([...left.keys(), ...right.keys()])) ok(`${name}: баланс по ${k}`, left.get(k) === right.get(k))
  }
  ok('кислород — двухатомная молекула', AL2O3_REACTION.left.some((t) => t.formula === 'O2') && !AL2O3_REACTION.left.some((t) => t.formula === 'O'))
  const given = AL2O3_HALF_REACTIONS.filter((h) => h.id === 'oxidation').reduce((s, h) => s + h.electrons * h.times, 0)
  const taken = AL2O3_HALF_REACTIONS.filter((h) => h.id === 'reduction').reduce((s, h) => s + h.electrons * h.times, 0)
  ok('электронный баланс', given === taken && given === AL2O3_JUMPS.length)
  ok('зарядовый баланс', AL2O3_HALF_REACTIONS.reduce((s, h) => s + h.chargeLeft * h.times, 0) === 0 && AL2O3_HALF_REACTIONS.reduce((s, h) => s + h.chargeRight * h.times, 0) === 0)
  const left = new Map<string, number>()
  for (const t of AL2O3_REACTION.left) count(t.formula, t.coeff, left)
  ok('в сюжете 4 Al и 6 O — как в уравнении', STORY_AL.length === left.get('Al') && STORY_O.length === left.get('O'))
  ok('в сюжете три молекулы O₂', O2_MOLECULES.length * 2 === left.get('O'))
}

// ─────────────────────────────────────────────────────────────────────────────
// Извлечение чисел из текста (тысячи — через U+202F / U+00A0)
// ─────────────────────────────────────────────────────────────────────────────

type Num = { v: number; dec: number; sign: -1 | 0 | 1; raw: string }
const NUM_RE = /([+−-]?)\s?(\d{1,3}(?:[\u00a0\u202f]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)/g
function numbers(s: string): Num[] {
  const out: Num[] = []
  for (const m of s.matchAll(NUM_RE)) {
    const body = m[2]!.replace(/[\u00a0\u202f]/g, '').replace(',', '.')
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
    METAL.cellPm.a,
    bondLengthPm('O=O'),
    FILM.min,
    FILM.max,
    COR.cellPm.a,
    COR.cellPm.c!,
    OCTA.shortPm,
    OCTA.longPm,
    AL2O3_LADDER.sumKJ,
    ...Object.values(COR.coordination),
  ]
  for (const l of AL2O3_LABELS) {
    for (const k of l.keys) {
      const bare = k.text.replace(/\{\w+\}/g, '')
      ok(`подпись ${l.id}: без кириллицы (слова — в панели)`, !/[А-Яа-яЁё]/.test(bare), k.text)
      ok(`подпись ${l.id}: без фраз`, !/[a-z]{3,}/.test(bare), k.text)
      ok(`подпись ${l.id}: единицы только токенами`, !/\b(pm|nm|kJ\/mol|kJ)\b/.test(bare) && !/\((s|g|l|aq)\)/.test(bare), k.text)
      if (bare.includes(COR.spaceGroup)) ok(`подпись ${l.id}: группа из ядра`, bare.trim() === COR.spaceGroup)
      for (const n of numbers(bare.replace(COR.spaceGroup, ''))) {
        ok(`подпись ${l.id}: число ${n.raw} из ядра`, allowed3d.some((v) => matches(n, v)), k.text)
      }
    }
  }
  const text = (id: string) => AL2O3_LABELS.find((l) => l.id === id)!.keys[0]!.text
  ok('подпись O=O = bondLengthPm', hasValue(text('o2Bond'), bondLengthPm('O=O')) && numbers(text('o2Bond')).length === 1)
  const ft = numbers(text('filmT'))
  ok('подпись толщины плёнки = диапазон ядра', ft.length === 2 && ft[0]!.v === FILM.min && ft[1]!.v === FILM.max)
  ok('подпись a металла = параметр ячейки', hasValue(text('metalA'), METAL.cellPm.a))
  ok('подпись a корунда = параметр ячейки', hasValue(text('cellA'), COR.cellPm.a))
  ok('подпись c корунда = параметр ячейки', hasValue(text('cellC'), COR.cellPm.c!))
  ok('подписи двух длин Al–O = расстояния из базиса', hasValue(text('dShort'), OCTA.shortPm) && hasValue(text('dLong'), OCTA.longPm))
  const cn = numbers(text('cn'))
  ok('подпись КЧ = coordination ядра', cn.length === 2 && cn[0]!.v === CN_AL && cn[1]!.v === CN_O)
  const dH = numbers(text('dH'))[0]!
  ok('подпись ΔH°f = сумма цикла со знаком', dH.sign === -1 && matches(dH, AL2O3_DHF_KJ))
  // Заряды в подписях — из ядра: Al³⁺ = +valenceElectrons, O²⁻ = −(8 − valenceElectrons).
  const sup = (q: number) => (Math.abs(q) === 1 ? '' : ({ 2: '²', 3: '³' } as Record<number, string>)[Math.abs(q)]!) + (q > 0 ? '⁺' : '⁻')
  ok('подпись Al³⁺ — заряд из ядра', text('alStar') === `Al${sup(ATOMIC_DATA.Al.valenceElectrons)}`)
  ok('подпись O²⁻ — заряд из ядра', text('oStar') === `O${sup(-(8 - ATOMIC_DATA.O.valenceElectrons))}`)

  const known = new Set(Object.keys(SCENE_LABEL_TOKENS.ru))
  for (const token of labelTokensUsed(AL2O3_LABELS)) ok(`токен {${token}} есть в словаре`, known.has(token))
  for (const locale of LOCALES) {
    const states = createLabelStates(AL2O3_LABELS)
    localizeSceneLabels(states, locale)
    for (const st of states) ok(`[${locale}] подпись ${st.id} раскрыта`, !/\{\w+\}/.test(st.text) && st.text.trim().length > 0)
  }
  const ru = createLabelStates(AL2O3_LABELS)
  const en = createLabelStates(AL2O3_LABELS)
  localizeSceneLabels(ru, 'ru')
  localizeSceneLabels(en, 'en')
  ok('подписи ru отличаются от en (единицы переведены)', ru.some((s, i) => s.text !== en[i]!.text))
  // Решение 8: числа в 3D по локали — десятичная запятая на ru/uz.
  for (const locale of ['ru', 'uz'] as const) {
    const st = createLabelStates(AL2O3_LABELS)
    localizeSceneLabels(st, locale, true)
    const g = st.find((x) => x.id === 'o2Bond')!.text
    ok(`[${locale}] 3D-число с десятичной запятой: «${g}»`, g.includes(String(bondLengthPm('O=O')).replace('.', ',')) && !/\d\.\d/.test(st.map((x) => x.text).join(' ')))
  }
  for (const l of AL2O3_LABELS) for (const w of l.windows) ok(`окно подписи ${l.id}`, w[0] < w[1] && w[0] >= 0 && w[1] <= AL2O3_END + 1e-9)
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Тексты урока: числа ↔ ядро, синхронность языков
// ─────────────────────────────────────────────────────────────────────────────

const st = (id: Al2o3StageId) => al2o3StageKJ(id)
const pu = (id: Al2o3StageId) => al2o3StagePerUnitKJ(id)
const abs = Math.abs
const rAl0 = radiusForSpecies('Al', 0)
const rO0 = radiusForSpecies('O', 0)
const rAl3 = radiusForSpecies('Al', 3, { cn: CN_AL })
const rO2 = radiusForSpecies('O', -2, { cn: CN_O })
const rAlFilm = radiusForSpecies('Al', 3, { cn: AL2O3_GEOM.cn.alFilm })
const radiiSum = rAl3 + rO2
/** Температура кристаллизации корунда при прокаливании — число из пояснения ядра (NATIVE_OXIDE_FILMS.al.note). */
const CORUNDUM_ANNEAL_C = Number(/(\d+)\s*°C/.exec(FILM.note ?? '')![1])
/** Внешние константы, которых нет в ядре: стандартные условия 25 °C / 298 K. */
const EXTERNAL = [25, 298]

const CORE_VALUES: number[] = [
  METAL.cellPm.a,
  METAL.cationAnionPm,
  METAL.meltingC!,
  rAl0,
  rO0,
  rAl3,
  rO2,
  rAlFilm,
  bondLengthPm('O=O'),
  SPECIES_SCALE,
  LATTICE_BALL_SCALE,
  COR.meltingC!,
  THERMITE_DH_KJ,
  pu('sublimation'),
  pu('dissociation'),
  st('sublimation'),
  st('dissociation'),
  st('ionization'),
  st('affinity1'),
  st('affinity2'),
  st('lattice'),
  ...AL_IE_KJ,
  AL_IE_SUM_KJ,
  O_EA1_KJ,
  O_EA2_KJ,
  O_EA2_MAX_KJ,
  COR.cellPm.a,
  COR.cellPm.c!,
  COR.densityGCm3,
  CORUNDUM_FRAG.sites.length,
  OCTA.shortPm,
  OCTA.longPm,
  radiiSum,
  AL2O3_LADDER.sumKJ,
  AL2O3_COST_BEFORE_LATTICE_KJ,
  MGO_LATTICE_KJ,
  AL2O3_REACTION_DH_KJ,
  ...AL2O3_U_RANGE_KJ,
  CORUNDUM_ANNEAL_C,
  ...EXTERNAL,
]
ok('сумма радиусов Шеннона лежит между двумя длинами Al–O', OCTA.shortPm < radiiSum && radiiSum < OCTA.longPm)

/** Малые целые — счёт (4 Al, 12 соседей, Z = 6, 3s², ×3, «2×2×1», 10²³ → 10). */
const isCount = (n: Num) => n.dec === 0 && n.v <= 12

const fields = (t: Al2o3MechanismText): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const id of AL2O3_STEP_IDS) {
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
const strip = (s: string) => s.replaceAll(COR.spaceGroup, '').replaceAll(METAL.spaceGroup, '')

const numbersByField: Record<Al2o3Locale, Record<string, string>> = { ru: {}, en: {}, uz: {} }
for (const locale of LOCALES) {
  const t = getAl2o3MechanismText(locale)
  ok(`[${locale}] заголовок и безопасность`, t.intro.title.length > 0 && t.safety.length > 20)
  for (const id of AL2O3_STEP_IDS) {
    const s = t.steps[id]
    ok(`[${locale}] ${id}: заголовок, уравнение, реплика`, s.title.trim().length > 0 && s.equation.trim().length > 0 && s.speak.trim().length > 0)
    ok(`[${locale}] ${id}: 2–4 предложения`, s.body.split(/[.!?]\s/).length >= 2)
    ok(`[${locale}] ${id}: есть note (всё схематичное названо)`, (s.note ?? '').length > 0)
  }
  ok(`[${locale}] aria-подпись лестницы`, t.energy.summary.includes('{dH}'))
  ok(`[${locale}] подписи всех ступеней лестницы`, AL2O3_LADDER.stages.every((s) => (t.energy.stages as Record<string, string>)[s.id]!.length > 0))

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

  const need = (key: string, vals: number[]) => {
    for (const v of vals) ok(`[${locale}] ${key} называет ${v}`, hasValue(strip(f[key]!), v), f[key]!.slice(0, 60))
  }
  need('reactants.body', [METAL.cellPm.a, METAL.cationAnionPm, rAl0, bondLengthPm('O=O')])
  need('reactants.note', [rAlFilm, rO2, SPECIES_SCALE])
  need('release.body', [METAL.meltingC!, COR.meltingC!, THERMITE_DH_KJ, pu('sublimation'), st('sublimation'), pu('dissociation'), st('dissociation')])
  need('transfer.body', [...AL_IE_KJ, AL_IE_SUM_KJ, st('ionization'), rAl0, rAl3, O_EA1_KJ, O_EA2_KJ, rO0, rO2])
  need('transfer.note', [O_EA1_KJ, O_EA2_KJ, O_EA2_MAX_KJ])
  need('lattice.body', [COR.cellPm.a, COR.cellPm.c!, COR.densityGCm3, Math.round(abs(st('lattice')))])
  need('lattice.equation', [Math.round(abs(st('lattice')))])
  need('lattice.note', [CORUNDUM_FRAG.sites.length, LATTICE_BALL_SCALE, CORUNDUM_ANNEAL_C])
  need('octahedron.body', [OCTA.shortPm, OCTA.longPm, rAl3, rO2, radiiSum])
  need('energy.body', [AL2O3_COST_BEFORE_LATTICE_KJ, MGO_LATTICE_KJ, AL2O3_REACTION_DH_KJ])
  need('energy.note', [st('lattice'), O_EA2_KJ, MGO_LATTICE_KJ, O_EA2_MAX_KJ, ...AL2O3_U_RANGE_KJ])

  // Толщина плёнки — диапазон ядра; «в 5–10 рёбер» — отношение толщины к a металла; «до 5 нм» — extendedMax.
  {
    const ranges = [...f['reactants.body']!.matchAll(/(\d+)–(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const)
    ok(`[${locale}] толщина плёнки в тексте = диапазон ядра`, ranges[0] != null && ranges[0][0] === FILM.min && ranges[0][1] === FILM.max)
    const k0 = Math.round((FILM.min * 1000) / METAL.cellPm.a)
    const k1 = Math.round((FILM.max * 1000) / METAL.cellPm.a)
    ok(`[${locale}] «рёбер ячейки» = толщина / a ядра`, ranges[1] != null && ranges[1][0] === k0 && ranges[1][1] === k1, `${ranges[1]} против ${k0}–${k1}`)
    const ext = /(\d+)\s*(нм|nm)/.exec(f['reactants.note']!)
    ok(`[${locale}] верхняя граница при старении = extendedMax ядра`, ext != null && Number(ext[1]) === FILM.extendedMax)
    const cnFilm = /(КЧ|CN|KS) (\d+)/.exec(f['reactants.note']!)
    ok(`[${locale}] КЧ плёнки в тексте = модели сцены`, cnFilm != null && Number(cnFilm[2]) === AL2O3_GEOM.cn.alFilm)
  }

  // Сумма цикла в тексте: слагаемые = ступени ядра по порядку, итог = табличная ΔH°f.
  {
    const body = t.steps.energy.body
    const eq = body.indexOf('=')
    const TERM = /([+−-])\s?(\d{1,3}(?:[\u00a0\u202f]\d{3})+[.,]\d+|\d+[.,]\d+)/g
    const val = (m: RegExpMatchArray) => (m[1] === '+' ? 1 : -1) * Number(m[2]!.replace(/[\u00a0\u202f]/g, '').replace(',', '.'))
    const terms = [...body.slice(0, eq).matchAll(TERM)].map(val)
    const res = [...body.slice(eq).matchAll(TERM)][0]!
    const total = val(res)
    const cycle = BORN_HABER.al2o3.stages.map((s) => s.dHKJ)
    ok(`[${locale}] сумма в тексте: слагаемые = ступени ядра`, terms.length === cycle.length && terms.every((v, i) => near(v, cycle[i]!, 0.05)), terms.join(' '))
    ok(`[${locale}] сумма в тексте сходится арифметически`, near(terms.reduce((s, v) => s + v, 0), total, 0.05))
    ok(`[${locale}] итог суммы = табличная ΔH°f`, near(total, dHfKJ('Al2O3(s)'), 0.05))
    const eqn = numbers(t.steps.energy.equation).find((n) => n.dec > 0)!
    ok(`[${locale}] ΔH уравнения = 2·ΔH°f со знаком минус`, eqn.sign === -1 && matches(eqn, 2 * dHfKJ('Al2O3(s)')))
    const ueq = numbers(t.steps.lattice.equation).find((n) => n.v > 1000)!
    ok(`[${locale}] U в уравнении шага 4 — отрицательное, как в ядре`, ueq.sign === -1 && matches(ueq, st('lattice')))
    // Сложение IE в тексте шага 3: слагаемые = IE₁, IE₂, IE₃ ядра, сумма пересчитывается.
    const ie = /(\d+[.,]\d+)\s*\+\s*(\d+[.,]\d+)\s*\+\s*(\d+[.,]\d+)\s*=\s*(\d+[.,]\d+)/.exec(t.steps.transfer.body)!
    const iv = ie.slice(1).map((x) => Number(x.replace(',', '.')))
    ok(`[${locale}] IE₁ + IE₂ + IE₃ в тексте = ядро и сходится`, iv.slice(0, 3).every((v, i) => near(v, AL_IE_KJ[i]!, 0.05)) && near(iv[0]! + iv[1]! + iv[2]!, iv[3]!, 0.05))
    // Сумма радиусов шага 5 пересчитывается.
    const rs = /(\d+[.,]\d+)\s*\+\s*(\d+)\s*=\s*(\d+[.,]\d+)/.exec(t.steps.octahedron.body)!
    ok(`[${locale}] сумма радиусов в тексте сходится`, near(Number(rs[1]!.replace(',', '.')) + Number(rs[2]), Number(rs[3]!.replace(',', '.')), 0.05))
  }

  // Одно значение EA₁ кислорода везде (141,0); знак IUPAC «+» назван ровно один раз.
  const all = Object.values(f).join(' ')
  const eaLike = numbers(all).filter((n) => n.v >= 140 && n.v <= 142)
  ok(`[${locale}] EA₁ кислорода везде одним числом ядра`, eaLike.length > 0 && eaLike.every((n) => n.dec === 1 && matches(n, O_EA1_KJ)), eaLike.map((n) => n.raw).join(' '))
  ok(`[${locale}] конвенция IUPAC (+сродство) названа ровно один раз`, eaLike.filter((n) => n.sign === 1).length === 1)
  ok(`[${locale}] Δ_eg H со знаком минус есть`, eaLike.some((n) => n.sign === -1))
  const ea2Like = numbers(all).filter((n) => matches(n, O_EA2_KJ) && n.dec === 0)
  ok(`[${locale}] EA₂ везде со знаком «+»`, ea2Like.length > 0 && ea2Like.every((n) => n.sign === 1))
}

// ─── Привязка «число ↔ величина»: ТО число на ТОМ месте (порядок в ru) ───
{
  const seq = (s: string) => numbers(strip(s)).filter((n) => !isCount(n)).map((n) => n.v)
  const sameSeq = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => near(v, b[i]!, 1e-9))
  const expect: Record<string, number[]> = {
    'reactants.body': [METAL.cellPm.a, METAL.cationAnionPm, rAl0, bondLengthPm('O=O')],
    'reactants.note': [rAlFilm, rO2, 25, SPECIES_SCALE],
    'release.body': [METAL.meltingC!, COR.meltingC!, abs(THERMITE_DH_KJ), pu('sublimation'), st('sublimation'), pu('dissociation'), st('dissociation')],
    'transfer.body': [...AL_IE_KJ, AL_IE_SUM_KJ, st('ionization'), rAl0, rAl3, abs(O_EA1_KJ), O_EA2_KJ, rO0, rO2],
    'transfer.note': [abs(O_EA1_KJ), O_EA2_KJ, O_EA2_MAX_KJ],
    'lattice.body': [COR.cellPm.a, COR.cellPm.c!, COR.densityGCm3, abs(st('lattice'))],
    'lattice.note': [CORUNDUM_FRAG.sites.length, LATTICE_BALL_SCALE, CORUNDUM_ANNEAL_C],
    'octahedron.body': [OCTA.shortPm, OCTA.longPm, rAl3, rO2, radiiSum],
    'energy.body': [st('sublimation'), st('ionization'), st('dissociation'), abs(st('affinity1')), st('affinity2'), abs(st('lattice')), abs(AL2O3_LADDER.sumKJ), AL2O3_COST_BEFORE_LATTICE_KJ, abs(MGO_LATTICE_KJ), abs(AL2O3_REACTION_DH_KJ)],
    'energy.note': [abs(st('lattice')), O_EA2_KJ, abs(MGO_LATTICE_KJ), O_EA2_MAX_KJ, ...AL2O3_U_RANGE_KJ, 298],
  }
  const ru = fields(getAl2o3MechanismText('ru'))
  for (const [key, want] of Object.entries(expect)) {
    const got = numbers(strip(ru[key]!)).filter((n) => !isCount(n))
    ok(`[ru] ${key}: числа стоят на своих местах (привязка к величинам ядра)`, got.length === want.length && got.every((n, i) => matches(n, want[i]!)), `${got.map((n) => n.v).join(' ')} | ожидалось ${want.map((v) => v.toFixed(2)).join(' ')}`)
  }
  for (const locale of LOCALES) {
    const f = fields(getAl2o3MechanismText(locale))
    const z = /Z = (\d+)/.exec(f['lattice.body']!)
    ok(`[${locale}] Z в тексте = COR.z`, z != null && Number(z[1]) === COR.z)
    const cn = /(\d+):(\d+)/.exec(f['lattice.body']!)
    ok(`[${locale}] КЧ в тексте = coordination ядра`, cn != null && Number(cn[1]) === CN_AL && Number(cn[2]) === CN_O)
    const frac = /(\d)\/(\d)/.exec(f['lattice.body']!)
    ok(`[${locale}] доля занятых октаэдрических пустот = 2 Al на 3 O (одна пустота на O)`, frac != null && Number(frac[1]) * COR.basis!.filter((b) => b.el === 'O').length === Number(frac[2]) * COR.basis!.filter((b) => b.el === 'Al').length)
    const cells = /(\d)×(\d)×(\d)/.exec(f['lattice.note']!)
    ok(`[${locale}] фрагмент в тексте = CORUNDUM_FRAG.cells`, cells != null && [1, 2, 3].every((i) => Number(cells[i]) === CORUNDUM_FRAG.cells[i - 1]))
    const cnMetal = /(\d+) [^\d]{0,24}286/.exec(f['reactants.body']!)
    ok(`[${locale}] число соседей в металле = coordination ядра`, cnMetal != null && Number(cnMetal[1]) === METAL.coordination.Al)
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

console.log(`✓ al2o3 cinema: ${checks} проверок пройдено`)
console.log(`  шагов ${AL2O3_STEPS.length}, экранное время ${wall.toFixed(1)} с (${AL2O3_STEPS.map((s) => s.wall).join(' + ')} + хвост), сюжет ${AL2O3_END} с`)
console.log(`  цикл Борна — Габера: Σ = ${AL2O3_LADDER.sumKJ} кДж/моль (таблица ${AL2O3_DHF_TABLE_KJ}), без решётки ${AL2O3_COST_BEFORE_LATTICE_KJ}, U = ${AL2O3_LATTICE_KJ}`)
console.log(`  плёнка: ${FILM_SITES.length} ионов, ${FILM.min}–${FILM.max} ${FILM.unit}; корунд: ${CORUNDUM_FRAG.sites.length} ионов, ${CORUNDUM_FRAG.cellEdges.length} рёбер, ${COR.spaceGroup}, Al–O ${OCTA.shortPm.toFixed(1)} / ${OCTA.longPm.toFixed(1)} пм`)
