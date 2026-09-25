#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт сцены «ионная связь: 2 Na (тв.) + Cl₂ (г.) → 2 NaCl (тв.)».
 *
 * Сцена — фреймворк-независимый класс NaClReactionScene; её кадр — чистая функция времени
 * sampleNaclState(t) (naclModel). Всё проверяется в Node без WebGL: чистые функции геометрии и
 * таймлайна и состояние класса на заданном времени (seek). Каждое число сверяется с научным
 * ядром src/chemistry/data; проверок «есть ли в тексте слово» нет — числа ИЗВЛЕКАЮТСЯ из текста.
 *
 *   1. Хронометраж: 6 шагов по 4–7 с, всего 26–34 с, cue лаборатории после последнего шага.
 *   2. Размеры: нейтральный Na (металлический 186) крупнее Cl (ковалентного 102); после переноса
 *      Na⁺ = 102, Cl⁻ = 181 пм (ядро); в решётке Cl⁻/Na⁺ = 181/102 (±1 %).
 *   3. Cl₂: порядок связи 1 (один цилиндр) и 2 общих электрона; d(Cl–Cl) = bondLengthPm.
 *   4. Электрон: кубическая Безье с концами у Na и у Cl, контрольные точки над линией Na–Cl;
 *      смена Na → Na⁺ и Cl → Cl⁻ начинается в один кадр (кадр поглощения) и длится одинаково;
 *      заряд сохраняется каждые 1/60 с.
 *   5. Решётка 3×3×3 = 343 иона (= герой продукта), заряды чередуются, у внутреннего иона 6
 *      противоионов на cationAnionPm, октаэдры КЧ из 6 противоположных, ребро = a, газовая пара
 *      на bondLengthPm('Na-Cl').
 *   6. Нет объектов вне своего шага (непрозрачность/масштаб 0) — по классу, каждые 1/60 с.
 *   7. Энергия: лестница = BORN_HABER.nacl, сумма = dHfKJ('NaCl(s)'), U = −787,0.
 *   8. 3D-подписи и тексты ru/en/uz: числа — из ядра, наборы чисел синхронны.
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
import { heroSpecFor } from '../src/chemistry/data/heroStructures.ts'
import { storyWallDuration } from '../src/lab/cinema/core/storyTime.ts'
import { assertNoPositionJumps, labelTokensUsed, localizeLabelText, SCENE_LABEL_TOKENS } from '../src/lab/cinema/scenes/kit/sceneKit.ts'
import { LATTICE_BALL_SCALE, pmToScene, SPECIES_SCALE } from '../src/lab/cinema/scenes/kit/cpkAtoms.ts'
import { ladderLevels } from '../src/lab/cinema/scenes/kit/energyLadderData.ts'
import {
  createNaclState,
  I_CLA,
  I_CLB,
  I_NA1,
  I_NA2,
  NACL_METAL_REST,
  METAL_FRAG,
  NaClReactionScene,
  naclDepthPushAt,
  naclElectronPoint,
  naclGridOf,
  naclExtentAt,
  naclInstantExtent,
  naclMetalPos,
  naclMorphAt,
  naclStepInfo,
  NACL_CUES,
  NACL_D_GAS,
  NACL_DOT_GAP,
  NACL_ELECTRON_CURVES,
  NACL_ELECTRONS,
  NACL_END,
  NACL_FREE,
  NACL_H,
  NACL_LABELS,
  NACL_LATTICE_CELLS,
  NACL_LATTICE_R,
  NACL_MORPH_S,
  NACL_OCTA,
  NACL_OCTA_SHELLS,
  NACL_PAIRS,
  NACL_R,
  NACL_RADIUS_PM,
  NACL_STEPS,
  NACL_STEP_EXTENT,
  NACL_STEP_IDS,
  NACL_T,
  NACL_TIMING,
  SALT_FRAG,
  sampleNaclState,
  validateNaclModel,
  type NaclState,
  type NaclStepInfo,
} from '../src/lab/cinema/scenes/nacl/NaClReactionScene.ts'
import { NACL_SEGMENTS } from '../src/lab/cinema/scenes/nacl/naclSteps.ts'
import { coordinationShell } from '../src/lab/cinema/scenes/kit/lattice.ts'
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
const state = createNaclState()
const at = (t: number): NaclState => sampleNaclState(t, state)

let checks = 0
/** Все расхождения собираются и печатаются разом (NACL_FAIL_FAST=1 — падать на первом). */
const failures: string[] = []
function ok(label: string, cond: boolean, detail = ''): void {
  checks++
  if (cond) return
  const msg = `${label}${detail ? ` — ${detail}` : ''}`
  if (process.env.NACL_FAIL_FAST === '1') assert.ok(cond, msg)
  failures.push(msg)
}
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol
/** Масштаб инстанса по длине столбца: decompose у вырожденной матрицы (масштаб 0) отдаёт 1. */
const _col = new THREE.Vector3()
const colLen = (m: THREE.Matrix4) => _col.setFromMatrixColumn(m, 0).length()

const SALT = getCrystal('nacl')!
const METAL = getCrystal('na_metal')!
const PM = pmToScene(1)
const LAST = NACL_STEPS.length - 1
const lastStepTo = NACL_STEPS[LAST]!.to
const FRAME = 1 / 60
/** Сетка кадров 1/60 с по всей сцене. */
const frames: number[] = []
for (let i = 0; i * FRAME <= NACL_END + 1e-9; i++) frames.push(i * FRAME)

validateNaclModel()
validateNaclEnergetics()

// ─────────────────────────────────────────────────────────────────────────────
// 1. Хронометраж и контракт лаборатории
// ─────────────────────────────────────────────────────────────────────────────

NACL_TIMING.validate()
ok('шагов 6', NACL_STEPS.length === 6)
ok('id шагов — как у лаборатории и lessons.ts', NACL_STEP_IDS.join(',') === 'reactants,sublimation,transfer,attraction,lattice,energy')
const wall = storyWallDuration(NACL_SEGMENTS)
ok('экранная длительность 26–34 с', wall >= 26 && wall <= 34, `${wall.toFixed(1)} с`)
for (const s of NACL_STEPS) {
  ok(`шаг ${s.id}: 4–7 экранных секунд`, s.wall >= 4 && s.wall <= 7, `${s.wall}`)
  ok(`шаг ${s.id}: время сюжета = экранному (0,5 с раскадровки — 0,5 с на экране)`, near(s.to - s.from, s.wall) && s.ease === 'none')
}
for (const id of ['embryo', 'birth', 'complete']) {
  const c = NACL_CUES.find((x) => x.id === id)!
  ok(`cue ${id} строго после последнего шага`, c.at > lastStepTo, `${c.at} ≤ ${lastStepTo}`)
}
ok('complete — в конце сцены', NACL_CUES.find((c) => c.id === 'complete')!.at === NACL_END)
for (const c of NACL_CUES) if (!['embryo', 'birth', 'complete'].includes(c.id)) ok(`cue ${c.id} внутри шагов`, c.at > 0 && c.at < lastStepTo)
ok('watchdog лаборатории положителен', naclScientificWatchdogMs() > 0)

// ─────────────────────────────────────────────────────────────────────────────
// 2. Размеры частиц ↔ ядро
// ─────────────────────────────────────────────────────────────────────────────

const rNaIon = radiusForSpecies('Na', 1)
const rClIon = radiusForSpecies('Cl', -1)
ok('Na⁰ — металлический радиус ядра', NACL_RADIUS_PM.na === radiusForSpecies('Na', 0, { model: 'metallic' }))
ok('Cl⁰ — ковалентный радиус ядра', NACL_RADIUS_PM.cl === radiusForSpecies('Cl', 0, { model: 'covalent' }))
ok('нейтральный Na крупнее нейтрального Cl (ядро)', NACL_RADIUS_PM.na > NACL_RADIUS_PM.cl)
at(NACL_STEPS[0]!.to)
ok('нейтральный Na крупнее нейтрального Cl (кадр шага 1)', state.radius[I_NA1]! > state.radius[I_CLA]! && near(state.radius[I_NA1]! / state.radius[I_CLA]!, NACL_RADIUS_PM.na / NACL_RADIUS_PM.cl, 1e-5))
ok('кадр шага 1: радиусы = ядро × SPECIES_SCALE', near(state.radius[I_NA1]! / (PM * SPECIES_SCALE), NACL_RADIUS_PM.na, 1e-3) && near(state.radius[I_CLA]! / (PM * SPECIES_SCALE), NACL_RADIUS_PM.cl, 1e-3))
at(NACL_STEPS[2]!.to)
for (const [na, cl] of NACL_PAIRS) {
  ok(`после переноса Na⁺ = ${rNaIon} пм (ядро)`, near(state.radius[na]! / (PM * SPECIES_SCALE * state.drawScale), rNaIon, 1e-3))
  ok(`после переноса Cl⁻ = ${rClIon} пм (ядро)`, near(state.radius[cl]! / (PM * SPECIES_SCALE * state.drawScale), rClIon, 1e-3))
  ok('после переноса заряды +1 / −1', state.charge[na] === 1 && state.charge[cl] === -1)
}
ok('катион меньше атома, анион больше', NACL_R.naIon < NACL_R.na && NACL_R.clIon > NACL_R.cl)
{
  const ratio = NACL_LATTICE_R.clIon / NACL_LATTICE_R.naIon
  ok('решётка: Cl⁻/Na⁺ = 181/102 (±1 %)', Math.abs(ratio / (rClIon / rNaIon) - 1) < 0.01, ratio.toFixed(4))
  ok('решётка: Cl⁻ значительно крупнее Na⁺', ratio > 1.7)
  ok('решётка: один общий коэффициент (LATTICE_BALL_SCALE)', near(NACL_LATTICE_R.naIon / (PM * rNaIon), LATTICE_BALL_SCALE) && near(NACL_LATTICE_R.clIon / (PM * rClIon), LATTICE_BALL_SCALE))
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Cl₂: одинарная связь и общая пара
// ─────────────────────────────────────────────────────────────────────────────

const scene = new NaClReactionScene({ locale: 'ru' })
const obj = (name: string) => {
  const list: THREE.Object3D[] = []
  scene.root.traverse((o) => {
    if (o.name === name) list.push(o)
  })
  return list
}
{
  scene.seek(NACL_STEPS[0]!.to)
  const bonds = obj('nacl-cl-cl')
  ok('Cl₂: ровно один цилиндр связи (порядок 1)', bonds.length === 1 && (bonds[0] as THREE.Mesh).isMesh === true)
  ok('Cl₂: связь видна на шаге 1', bonds[0]!.visible)
  at(NACL_STEPS[0]!.to)
  ok('Cl₂: d(Cl–Cl) = bondLengthPm', near(state.pos[I_CLA]!.distanceTo(state.pos[I_CLB]!), pmToScene(bondLengthPm('Cl-Cl')), 1e-6))
  // Общая пара: по одному электрону от каждого Cl (одиночные точки) — посередине связи.
  const dots = obj('nacl-valence')[0] as THREE.InstancedMesh
  const m = new THREE.Matrix4()
  const p = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  const mid = state.pos[I_CLA]!.clone().add(state.pos[I_CLB]!).multiplyScalar(0.5)
  let shared = 0
  let lone = 0
  for (let k = 0; k < dots.count; k++) {
    dots.getMatrixAt(k, m)
    m.decompose(p, q, s)
    s.setScalar(colLen(m))
    if (s.x < 1e-6) continue
    if (p.distanceTo(mid) < 0.12) shared++
    else lone++
  }
  ok('Cl₂: 2 общих электрона между атомами', shared === 2, `${shared}`)
  ok('Cl₂ на шаге 1: неподелённые пары не рисуются (только общая пара)', lone === 0)
  // Шаг 2: гомолиз — по одному электрону каждому Cl.
  at(NACL_T.brk + 0.7)
  ok('гомолиз завершён (split = 1)', state.split === 1)
  ok('связь Cl–Cl погашена после гомолиза', at(NACL_T.brk + 0.5).bond.opacity === 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Электрон: кривая Безье, одновременная смена, сохранение заряда
// ─────────────────────────────────────────────────────────────────────────────

for (const k of [0, 1] as const) {
  const curve = NACL_ELECTRON_CURVES[k]
  ok(`e${k + 1}: траектория — THREE.CubicBezierCurve3`, curve instanceof THREE.CubicBezierCurve3)
  const [di, ai] = NACL_PAIRS[k]!
  const na = new THREE.Vector3(...NACL_FREE[di]!)
  const cl = new THREE.Vector3(...NACL_FREE[ai]!)
  ok(`e${k + 1}: начало — на внешнем уровне Na`, near(curve.v0.distanceTo(na), NACL_R.na + NACL_DOT_GAP, 1e-6))
  ok(`e${k + 1}: конец — на валентной оболочке Cl`, near(curve.v3.distanceTo(cl), NACL_R.cl + NACL_DOT_GAP, 1e-6))
  const lineY = (x: number) => na.y + ((cl.y - na.y) * (x - na.x)) / (cl.x - na.x)
  ok(`e${k + 1}: контрольные точки над линией Na–Cl`, curve.v1.y > lineY(curve.v1.x) && curve.v2.y > lineY(curve.v2.x))
  const e = NACL_ELECTRONS[k === 0 ? 'e1' : 'e2']
  const mid = (e.leave + e.arrive) / 2
  at(mid)
  const el = state.electrons[k]
  const want = naclElectronPoint(k, el.u, new THREE.Vector3())
  ok(`e${k + 1}: в полёте лежит на кривой`, el.phase === 'flying' && el.pos.distanceTo(want) < 1e-9 && el.glow === 1)
  at(e.leave - 0.01)
  ok(`e${k + 1}: до вылета — валентная точка Na в начале кривой`, state.electrons[k].pos.distanceTo(curve.v0) < 1e-6)
  at(e.arrive)
  ok(`e${k + 1}: в кадр поглощения — в конце кривой`, state.electrons[k].pos.distanceTo(curve.v3) < 1e-6)

  // Смена размеров Na и Cl: первый кадр изменения и длительность совпадают.
  const rNa0 = at(0).radius[di]!
  let firstNa = -1
  let firstCl = -1
  let lastNa = -1
  let lastCl = -1
  let prevNa = 0
  let prevCl = 0
  const t0 = NACL_STEPS[2]!.from
  const t1 = NACL_STEPS[2]!.to
  for (let t = t0; t <= t1 + 1e-9; t += FRAME) {
    at(t)
    const ds = state.drawScale
    const n = state.radius[di]! / ds
    const c = state.radius[ai]! / ds
    if (t > t0) {
      if (Math.abs(n - prevNa) > 1e-9) {
        if (firstNa < 0) firstNa = t
        lastNa = t
      }
      if (Math.abs(c - prevCl) > 1e-9) {
        if (firstCl < 0) firstCl = t
        lastCl = t
      }
    }
    prevNa = n
    prevCl = c
  }
  void rNa0
  ok(`пара ${k + 1}: смена Na и Cl начинается в один кадр`, firstNa > 0 && Math.abs(firstNa - firstCl) < 1e-9, `${firstNa} / ${firstCl}`)
  ok(`пара ${k + 1}: кадр начала смены — первый кадр после поглощения`, firstNa >= e.arrive - 1e-9 && firstNa < e.arrive + FRAME + 1e-9)
  ok(`пара ${k + 1}: смена длится одинаково`, Math.abs(lastNa - firstNa - (lastCl - firstCl)) < 1e-9)
  ok(`пара ${k + 1}: смена 0,4–0,6 с`, NACL_MORPH_S >= 0.4 && NACL_MORPH_S <= 0.6 && lastNa - firstNa <= NACL_MORPH_S + 1e-9 && lastNa - firstNa >= NACL_MORPH_S - 2 * FRAME)
  ok(`пара ${k + 1}: одна функция смены у донора и акцептора`, Math.fround(naclMorphAt(k, e.arrive + 0.2)) === at(e.arrive + 0.2).morph[di] && state.morph[di] === state.morph[ai])
}
{
  let bad = 0
  let worst = ''
  for (const t of frames) {
    at(t)
    if (state.chargeSum !== 0) {
      bad++
      worst = `t=${t.toFixed(3)} Σ=${state.chargeSum}`
    }
  }
  ok('заряд сохраняется каждые 1/60 с (Σ частиц + летящие e⁻ = 0)', bad === 0, worst)
  // Итог: 2 Na⁺ + 2 Cl⁻.
  at(NACL_END)
  ok('в конце 2 Na⁺ и 2 Cl⁻', state.charge[I_NA1] === 1 && state.charge[I_NA2] === 1 && state.charge[I_CLA] === -1 && state.charge[I_CLB] === -1)
}
{
  // Позиции частиц сюжета не прыгают (1/30 с, 0,09 мира).
  const buf = [0, 1, 2, 3].map((i) => ({ id: `s${i}`, pos: new THREE.Vector3(), opacity: 1 }))
  assertNoPositionJumps(
    (t) => {
      at(t)
      for (let i = 0; i < 4; i++) {
        buf[i]!.pos.copy(state.pos[i]!)
        buf[i]!.opacity = state.storyOn ? state.appear : 0
      }
      return buf
    },
    NACL_END,
    0.09,
    1 / 30,
  )
  checks++
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Решётка ↔ ядро
// ─────────────────────────────────────────────────────────────────────────────

{
  const n = NACL_LATTICE_CELLS[0] * 2 + 1
  // Школьная версия: 2×2×2 ячейки — 5 ионов по ребру, как на рисунке учебника; соседи иона легко пересчитать.
  ok('решётка 2×2×2 ячейки', NACL_LATTICE_CELLS.join('×') === '2×2×2')
  ok('решётка = герой продукта (heroStructures.cells)', (heroSpecFor('nacl') as { cells: readonly number[] }).cells.join('×') === NACL_LATTICE_CELLS.join('×'))
  ok('2×2×2 ячейки = 125 ионов (5 по ребру)', SALT_FRAG.sites.length === n ** 3 && n === 5)
  const na = SALT_FRAG.sites.filter((s) => s.el === 'Na').length
  const cl = SALT_FRAG.sites.filter((s) => s.el === 'Cl').length
  ok('Na⁺ и Cl⁻ поровну с точностью до узла', na + cl === SALT_FRAG.sites.length && Math.abs(na - cl) === 1)
  const lat = obj('nacl-lattice-na')[0] as THREE.InstancedMesh
  const latCl = obj('nacl-lattice-cl')[0] as THREE.InstancedMesh
  ok('решётка — два InstancedMesh с общей геометрией', lat.isInstancedMesh && latCl.isInstancedMesh && lat.geometry === latCl.geometry && lat.count + latCl.count === SALT_FRAG.sites.length)
  // Заряды чередуются: соседи по осям на a/2 — противоположного знака.
  const D = pmToScene(SALT.cationAnionPm)
  // Чередование относительно узла 0: какой ион в центре фрагмента, зависит от числа ячеек.
  let alternate = true
  const g0 = naclGridOf(0)
  const par0 = (g0[0] + g0[1] + g0[2]) & 1
  for (let i = 0; i < SALT_FRAG.sites.length; i++) {
    const g = naclGridOf(i)
    const par = (g[0] + g[1] + g[2]) & 1
    if ((SALT_FRAG.sites[i]!.el === SALT_FRAG.sites[0]!.el) !== (par === par0)) alternate = false
  }
  ok('заряды чередуются по узлам (чётность суммы координат)', alternate)
  // Каждый внутренний ион — 6 противоионов на cationAnionPm.
  let interior = 0
  for (let i = 0; i < SALT_FRAG.sites.length; i++) {
    const g = naclGridOf(i)
    if (g.some((c) => Math.abs(c) >= NACL_LATTICE_CELLS[0])) continue
    interior++
    const sh = coordinationShell(SALT_FRAG, i)
    const el = SALT_FRAG.sites[i]!.el
    const ok6 = sh.neighbors.length === SALT.coordination[el === 'Na' ? 'Na⁺' : 'Cl⁻'] && sh.neighbors.every((j) => SALT_FRAG.sites[j]!.el !== el) && sh.distancesPm.every((d) => near(d, SALT.cationAnionPm, 0.02))
    if (!ok6) ok(`внутренний ион ${i}: 6 противоионов на cationAnionPm`, false)
  }
  ok(`все внутренние ионы (${(n - 2) ** 3}): 6 противоионов на cationAnionPm`, interior === (n - 2) ** 3)
  checks++
  ok('шаг узлов = a/2 ядра', near(NACL_H, D, 1e-12))
  // Октаэдры КЧ 6:6 у выделенных ионов.
  NACL_OCTA.forEach((o, k) => {
    const sh = NACL_OCTA_SHELLS[k]!
    ok(`октаэдр ${o.el}: центр — ${o.el}`, SALT_FRAG.sites[o.center]!.el === o.el)
    ok(`октаэдр ${o.el}: 6 вершин противоположного знака`, sh.neighbors.length === 6 && sh.neighbors.every((j) => SALT_FRAG.sites[j]!.el !== o.el))
    ok(`октаэдр ${o.el}: 12 рёбер многогранника`, sh.edges.length === 12)
  })
  ok('есть октаэдр и у Na⁺, и у Cl⁻ (КЧ 6:6)', new Set(NACL_OCTA.map((o) => o.el)).size === 2)
  // Рёбра ячеек: длина каждого = a, число 3·3·4·4 = 144.
  const c = NACL_LATTICE_CELLS[0]
  ok(`рёбер ячеек ${3 * c * (c + 1) ** 2}`, SALT_FRAG.cellEdges.length === 3 * c * (c + 1) ** 2)
  ok('каждое ребро = a ядра', SALT_FRAG.cellEdges.every(([p, q]) => near(Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]), pmToScene(SALT.cellPm.a), 1e-9)))
  // Газовая пара и пара в решётке.
  at(NACL_STEPS[3]!.to)
  for (const [a, b] of NACL_PAIRS) ok("газовая пара на bondLengthPm('Na-Cl')", near(state.pos[a]!.distanceTo(state.pos[b]!), pmToScene(bondLengthPm('Na-Cl')), 1e-6))
  // Пара рисуется в 0,88 радиуса Шеннона (иначе заслоняла кадр), но отношение Na⁺ : Cl⁻ = 102 : 181 точное,
  // а сумма нарисованных радиусов (249 пм) по-прежнему больше rₑ = 236,1 пм — перекрытие оболочек видно.
  ok('газовая пара: отношение радиусов Шеннона 102 : 181 сохранено', near(state.radius[I_NA1]! / state.radius[I_CLA]!, rNaIon / rClIon, 1e-3))
  ok('газовая пара: нарисованные радиусы 0,88 Шеннона, сферы перекрываются (249 > 236,1)', near(state.radius[I_NA1]! / PM, 0.88 * rNaIon, 1e-3) && state.radius[I_NA1]! + state.radius[I_CLA]! > NACL_D_GAS)
  at(NACL_STEPS[4]!.to)
  for (const [a, b] of NACL_PAIRS) ok('пара в решётке на cationAnionPm', near(state.pos[a]!.distanceTo(state.pos[b]!), D, 1e-6))
  // Все ионы решётки выросли и стоят в узлах (класс).
  scene.seek(NACL_STEPS[4]!.to)
  const m = new THREE.Matrix4()
  const p = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  let placed = 0
  for (const [mesh, r] of [[lat, NACL_LATTICE_R.naIon], [latCl, NACL_LATTICE_R.clIon]] as const) {
    for (let k = 0; k < mesh.count; k++) {
      mesh.getMatrixAt(k, m)
      m.decompose(p, q, s)
    s.setScalar(colLen(m))
      if (near(s.x, r, 1e-6)) placed++
    }
  }
  ok(`к паузе шага 5 все ${SALT_FRAG.sites.length} ионов на местах и в полный размер решётки`, placed === SALT_FRAG.sites.length, `${placed}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 5а. Кадрирование: габарит шага держит всю композицию этого шага
// ─────────────────────────────────────────────────────────────────────────────

{
  // Габарит считается по раскадровке; здесь проверяем независимо: каждая ВИДИМАЯ частица шага
  // и каждый якорь подписи этого шага влезают в его габарит (иначе объект ушёл бы под панель).
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const v = new THREE.Vector3()
  const st2 = createNaclState()
  let worst = 0
  const ext = { w: 0, h: 0, cx: 0, cy: 0 }
  for (let i = 0; i < NACL_STEPS.length; i++) {
    const step = NACL_STEPS[i]!
    ok(`габарит шага ${step.id} положителен`, NACL_STEP_EXTENT[i]!.w > 0.5 && NACL_STEP_EXTENT[i]!.h > 0.5, `${NACL_STEP_EXTENT[i]!.w} × ${NACL_STEP_EXTENT[i]!.h}`)
    for (let t = step.from; t <= Math.min(step.to, NACL_STEPS[NACL_STEPS.length - 1]!.to) + 1e-6; t += 1 / 30) {
      naclExtentAt(t, ext)
      const f = sampleNaclState(t, st2)
      e.set(f.shot.pitch, f.shot.yaw, 0, 'YXZ')
      q.setFromEuler(e)
      if (!f.storyOn) continue
      for (let k = 0; k < 4; k++) {
        const r = f.radius[k]! * f.appear
        if (r < 1e-3) continue
        v.copy(f.pos[k]!).sub(f.shot.target).applyQuaternion(q).multiplyScalar(f.shot.zoom)
        const dx = (Math.abs(v.x - ext.cx) + r * f.shot.zoom) / (ext.w / 2)
        const dy = (Math.abs(v.y - ext.cy) + r * f.shot.zoom) / (ext.h / 2)
        worst = Math.max(worst, dx, dy)
      }
    }
  }
  ok('частицы сюжета не выходят за габарит кадра', worst <= 1.005, `${worst.toFixed(3)}`)
  // Камера не дёргается: габарит между соседними кадрами меняется плавно.
  const a = { w: 0, h: 0, cx: 0, cy: 0 }
  const b = { w: 0, h: 0, cx: 0, cy: 0 }
  let jump = 0
  for (let t = 0; t + FRAME <= NACL_END; t += FRAME) {
    naclExtentAt(t, a)
    naclExtentAt(t + FRAME, b)
    jump = Math.max(jump, Math.abs(b.w / a.w - 1), Math.abs(b.h / a.h - 1))
  }
  ok('габарит кадра меняется плавно (< 6 % за кадр)', jump < 0.06, `${(jump * 100).toFixed(1)} %`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Нет объектов вне своего шага
// ─────────────────────────────────────────────────────────────────────────────

{
  const stepOf = (t: number) => NACL_STEPS.findIndex((s) => t < s.to - 1e-9)
  const metal = obj('nacl-metal')[0]!
  const bond = obj('nacl-cl-cl')[0]!
  const octa = scene.root.getObjectByName('nacl-lattice')!
  const lat = obj('nacl-lattice-na')[0] as THREE.InstancedMesh
  const m = new THREE.Matrix4()
  const sc = new THREE.Vector3()
  const pp = new THREE.Vector3()
  const qq = new THREE.Quaternion()
  let fail = ''
  for (const t of frames) {
    scene.seek(t)
    const st = at(t)
    const step = stepOf(t) < 0 ? LAST + 1 : stepOf(t)
    if (step >= 2 && (metal.visible || st.metal.opacity > 0)) fail ||= `металл виден на шаге ${step + 1} (t=${t.toFixed(2)})`
    if (step >= 2 && (bond.visible || st.bond.opacity > 0)) fail ||= `связь Cl–Cl видна на шаге ${step + 1}`
    if (step <= 1 && (st.electrons[0].glow > 0 || st.electrons[1].glow > 0)) fail ||= `летящий электрон до шага 3 (t=${t.toFixed(2)})`
    if (step !== 3 && step !== 4 && st.field > 0) fail ||= `линии поля вне шагов 4–5 (t=${t.toFixed(2)})`
    if (step < 4) {
      lat.getMatrixAt(0, m)
      m.decompose(pp, qq, sc)
      sc.setScalar(colLen(m))
      if (sc.x > 0 || st.saltEdges > 0 || st.octa > 0) fail ||= `решётка видна до шага 5 (t=${t.toFixed(2)})`
    }
    if (step >= 4 && st.valence > 0) fail ||= `валентные точки на шаге ${step + 1}`
    if (t >= NACL_T.handover && obj('nacl-na1')[0]!.visible) fail ||= 'частица сюжета после передачи узлов решётке'
    if (step <= 1 && st.labelOpacity[NACL_LABELS.findIndex((l) => l.id === 'octaNa')]! > 0) fail ||= 'подпись окружения до шага 5'
  }
  ok('каждые 1/60 с: объекты видны только на своих шагах', fail === '', fail)
  void octa
  // Финал без огня: электроны и поле погашены, свечение кромки — базовое.
  const fin = at(NACL_END)
  ok('финал без огня и свечения внутри решётки', fin.electrons.every((e) => e.glow === 0 && e.amount === 0) && fin.field === 0 && fin.flash.every((f) => f === 0))
  ok('в финале решётка на месте героя (передача = 1), сценический свет погашен', fin.handoff === 1 && fin.light === 0)
  ok('в финале все подписи погашены (подписи — у героя)', fin.labelOpacity.every((o) => o === 0))
}

// ─────────────────────────────────────────────────────────────────────────────
// 6а. Машина состояний и колбэки класса
// ─────────────────────────────────────────────────────────────────────────────

{
  const cues: string[] = []
  const steps: NaclStepInfo[] = []
  const sc = new NaClReactionScene({ locale: 'en', onCue: (id) => cues.push(id), onStep: (info) => steps.push(info) })
  const cam = new THREE.PerspectiveCamera()
  void sc.goToStep(2, { instant: true })
  ok('goToStep(instant) встаёт на конец шага и паузу', near(sc.time, NACL_STEPS[2]!.to) && sc.getState().status === 'paused' && sc.getState().step === 2)
  sc.update(1 / 60, cam)
  ok('cue шагов 1–3 выстрелили при переходе вперёд', ['sublimate', 'bondBreak', 'transfer'].every((c) => cues.includes(c)) && !cues.includes('embryo'))
  ok('onStep: тексты локали и заголовок шага', steps[0]!.id === 'transfer' && steps[0]!.title === getNaclMechanismText('en').steps.transfer.title)
  sc.seek(NACL_END)
  sc.update(1 / 60, cam)
  ok('контракт лаборатории по порядку в хвосте', cues.slice(-3).join(',') === 'embryo,birth,complete')
  sc.dispose()
  const last = naclStepInfo(5, 'ru')
  ok('onStep шага 6: накопленная ΔH = ΔH°f ядра', near(last.dH.cumulativeKJ, dHfKJ('NaCl(s)'), 0.05))
  ok('onStep: latticeU = −787,0 (ядро)', last.latticeU === LATTICE_ENTHALPY_KJ['NaCl(s)'] && last.latticeU === -787)
  ok('onStep шага 6: есть предупреждение о безопасности', (last.safety ?? '').length > 20)
  ok('onStep шага 5: ступень решётки', near(naclStepInfo(4, 'ru').dH.stageKJ, NACL_LATTICE_KJ, 0.05))
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Энергия
// ─────────────────────────────────────────────────────────────────────────────

{
  const cycle = BORN_HABER.nacl
  ok('лестница = BORN_HABER.nacl', NACL_LADDER.stages.length === cycle.stages.length && NACL_LADDER.stages.every((s, i) => s.dH === cycle.stages[i]!.dHKJ))
  ok('½D = ΔH°f(Cl, г.) ядра', naclStageKJ('dissociation') === dHfKJ('Cl(g)'))
  ok('сублимация = ΔH°f(Na, г.) ядра', naclStageKJ('sublimation') === dHfKJ('Na(g)'))
  ok('U цикла = LATTICE_ENTHALPY_KJ = −787,0 (решение владельца)', NACL_LATTICE_KJ === LATTICE_ENTHALPY_KJ['NaCl(s)'] && NACL_LATTICE_KJ === -787)
  ok('Σ цикла = dHfKJ(NaCl(s)) (±0,05)', near(NACL_LADDER.sumKJ, dHfKJ('NaCl(s)'), 0.05), `${NACL_LADDER.sumKJ}`)
  ok('таблица лестницы = ядро', NACL_DHF_TABLE_KJ === dHfKJ('NaCl(s)'))
  ok('без решётки процесс эндотермический', NACL_COST_BEFORE_LATTICE_KJ > 0)
  ok('ΔH реакции = 2 · ΔH°f', near(NACL_REACTION_DH_KJ, 2 * dHfKJ('NaCl(s)'), 0.05))
  const levels = ladderLevels(NACL_LADDER)
  ok('последний уровень = сумма цикла', near(levels[levels.length - 1]!, NACL_LADDER.sumKJ))
  ok('ступени идут по времени сюжета и внутри шагов', NACL_LADDER.stages.every((s, i) => s.at > 0 && s.at < lastStepTo && (i === 0 || s.at >= NACL_LADDER.stages[i - 1]!.at)))
  const count = (formula: string, coeff: number, into: Map<string, number>) => {
    for (const m of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) into.set(m[1]!, (into.get(m[1]!) ?? 0) + (m[2] ? Number(m[2]) : 1) * coeff)
  }
  const left = new Map<string, number>()
  const right = new Map<string, number>()
  for (const t of NACL_REACTION.left) count(t.formula, t.coeff, left)
  for (const t of NACL_REACTION.right) count(t.formula, t.coeff, right)
  for (const k of new Set([...left.keys(), ...right.keys()])) ok(`баланс по ${k}`, left.get(k) === right.get(k))
  const given = NACL_HALF_REACTIONS.filter((h) => h.id === 'oxidation').reduce((s, h) => s + h.electrons * h.times, 0)
  const taken = NACL_HALF_REACTIONS.filter((h) => h.id === 'reduction').reduce((s, h) => s + h.electrons * h.times, 0)
  ok('электронный баланс', given === taken)
  ok('в сюжете 2 Na и 2 Cl — как в уравнении', left.get('Na') === 2 && left.get('Cl') === 2 && [I_NA1, I_NA2].length === 2 && [I_CLA, I_CLB].length === 2)
  ok('ячейка металла — 9 атомов ОЦК', METAL_FRAG.sites.length === 9)
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
// 8. 3D-подписи
// ─────────────────────────────────────────────────────────────────────────────

{
  const allowed3d = [SALT.cellPm.a, METAL.cellPm.a, bondLengthPm('Cl-Cl'), bondLengthPm('Na-Cl'), SALT.cationAnionPm, NACL_LADDER.sumKJ, NACL_LATTICE_KJ, SALT.densityGCm3, SALT.z, ...Object.values(SALT.coordination)]
  for (const l of NACL_LABELS) {
    for (const k of l.keys) {
      const bare = k.text.replace(/\{\w+\}/g, '').replaceAll(SALT.spaceGroup, '')
      ok(`подпись ${l.id}: без кириллицы (слова — в панели)`, !/[А-Яа-яЁё]/.test(bare), k.text)
      ok(`подпись ${l.id}: без фраз`, !/[a-z]{3,}/.test(bare), k.text)
      ok(`подпись ${l.id}: единицы только токенами`, !/\b(pm|kJ\/mol|kJ)\b/.test(bare) && !/\((s|g|l|aq)\)/.test(bare), k.text)
      for (const n of numbers(bare)) ok(`подпись ${l.id}: число ${n.raw} из ядра`, allowed3d.some((v) => matches(n, v)), k.text)
    }
  }
  // Школьная версия (8 класс): символ элемента/иона ВНУТРИ шара, без размерных линий и энергетики.
  const byId = (id: string) => NACL_LABELS.find((l) => l.id === id)
  for (const [id, idx, first, second] of [['na1', I_NA1, 'Na', 'Na⁺'], ['na2', I_NA2, 'Na', 'Na⁺'], ['clA', I_CLA, 'Cl', 'Cl⁻'], ['clB', I_CLB, 'Cl', 'Cl⁻']] as const) {
    const l = byId(id)!
    const an = l.anchor as { kind: string; index: number }
    ok(`символ ${id} — внутри своего шара`, l.kind === 'atom' && an.kind === 'inside' && an.index === idx)
    ok(`символ ${id}: ${first} → ${second}`, l.keys.length === 2 && l.keys[0]!.text === first && l.keys[1]!.text === second)
  }
  const metalAtoms = NACL_LABELS.filter((l) => l.anchor.kind === 'metalAtom')
  ok('в каждом атоме ячейки металла — символ Na', metalAtoms.length === NACL_METAL_REST.length && metalAtoms.every((l) => l.kind === 'atom' && l.keys[0]!.text === 'Na'))
  ok('нет размерных и энергетических подписей (не школьный материал)', !NACL_LABELS.some((l) => l.keys.some((k) => /\{(pm|kJmol|gcm3)\}|Δ|U =|Z =/.test(k.text))))
  ok('размерные линии не показываются', [0, 8, 18, 22, 26, 30].every((t) => at(t).dimGas === 0 && at(t).dimA === 0))
  const known = new Set(Object.keys(SCENE_LABEL_TOKENS.ru))
  for (const token of labelTokensUsed(NACL_LABELS.map((l) => ({ ...l, dy: 0 })) as never)) ok(`токен {${token}} есть в словаре`, known.has(token))
  for (const locale of LOCALES) {
    for (const l of NACL_LABELS) for (const k of l.keys) ok(`[${locale}] подпись ${l.id} раскрыта`, !/\{\w+\}/.test(localizeLabelText(k.text, locale, true)))
  }
  const sceneRu = new NaClReactionScene({ locale: 'ru' })
  sceneRu.seek(NACL_STEPS[5]!.to)
  const lname = sceneRu.labels.find((l) => l.id === 'nacl-nacl')!
  ok('класс: над решёткой — название вещества на ru', lname.text === 'NaCl (тв.)' && lname.opacity > 0.99, lname.text)
  sceneRu.dispose()
  for (const l of NACL_LABELS) for (const w of l.windows) ok(`окно подписи ${l.id}`, w[0] < w[1] && w[0] >= 0 && w[1] <= NACL_END + 1e-9)
}

// ─────────────────────────────────────────────────────────────────────────────
// 8а. Подписи решётки СНАРУЖИ её силуэта, окружение читаемо, ячейка металла — куб
// ─────────────────────────────────────────────────────────────────────────────

{
  // Подпись донора и знак его заряда согласованы в каждом кадре: «пока электрон летит, в кадре
  // Na⁺ + e⁻ + Cl» — приёмка ловила ровно это расхождение (заряд +1 с ухода, подпись — с поглощения).
  const idx = (id: string) => NACL_LABELS.findIndex((l) => l.id === id)
  let mismatch = ''
  for (const t of frames) {
    at(t)
    for (const [k, id, di] of [[0, 'na1', I_NA1], [1, 'na2', I_NA2]] as const) {
      void k
      const shown = state.labelText[idx(id)]!
      const charged = state.charge[di] === 1
      if (charged !== (shown === 'Na⁺')) mismatch ||= `t=${t.toFixed(3)} ${id}: заряд ${state.charge[di]}, подпись «${shown}»`
    }
  }
  ok('подпись донора и знак его заряда согласованы каждые 1/60 с', mismatch === '', mismatch)
  ok('подпись Na⁺ появляется в кадр ухода электрона', NACL_LABELS[idx('na1')]!.keys[1]!.t === NACL_ELECTRONS.e1.leave && NACL_LABELS[idx('na2')]!.keys[1]!.t === NACL_ELECTRONS.e2.leave)

  // Окружение: подписи октаэдров называют КЧ ядра и стоят у своих фигур.
  for (const [id, el] of [['octaNa', 'Na'], ['octaCl', 'Cl']] as const) {
    const def = NACL_LABELS.find((l) => l.id === id)!
    const an = def.anchor as { kind: string; index: number }
    ok(`подпись ${id} привязана к своему октаэдру`, an.kind === 'octa' && NACL_OCTA[an.index]!.el === el)
    const n = numbers(def.keys[0]!.text)[0]!
    ok(`подпись ${id}: число соседей из coordination ядра`, n.v === SALT.coordination[el === 'Na' ? 'Na⁺' : 'Cl⁻'])
  }

  // Каждая подпись шага 5–6, привязанная к решётке, обязана выноситься за её силуэт.
  for (const id of ['nacl']) {
    ok(`подпись ${id} вынесена за силуэт решётки`, NACL_LABELS.find((l) => l.id === id)!.outside != null)
  }

  // Геометрическая проверка на КЛАССЕ: кадрируем сцену как адаптер (root повёрнут по камере) и
  // требуем, чтобы центр каждой такой подписи лежал ВНЕ экранной рамки ионов решётки.
  const sc = new NaClReactionScene({ locale: 'ru' })
  const cam = new THREE.PerspectiveCamera(46, 1.6, 0.1, 100)
  cam.position.set(0, 0, 3.6)
  cam.lookAt(0, 0, 0)
  cam.updateMatrixWorld(true)
  sc.root.position.set(0, 0, 0)
  sc.root.quaternion.copy(cam.quaternion)
  sc.root.scale.setScalar(0.55)
  sc.setViewport(800, 46)
  const ndc = new THREE.Vector3()
  const mm = new THREE.Matrix4()
  const ionBox = (): { x0: number; x1: number; y0: number; y1: number } => {
    const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }
    for (const name of ['nacl-lattice-na', 'nacl-lattice-cl']) {
      const mesh = sc.root.getObjectByName(name) as THREE.InstancedMesh
      mesh.updateWorldMatrix(true, false)
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, mm)
        const r = colLen(mm)
        if (r < 1e-6) continue
        ndc.setFromMatrixPosition(mm).applyMatrix4(mesh.matrixWorld).project(cam)
        b.x0 = Math.min(b.x0, ndc.x)
        b.x1 = Math.max(b.x1, ndc.x)
        b.y0 = Math.min(b.y0, ndc.y)
        b.y1 = Math.max(b.y1, ndc.y)
      }
    }
    return b
  }
  let inside = ''
  for (const t of [NACL_STEPS[4]!.to - 0.6, NACL_STEPS[4]!.to, NACL_STEPS[5]!.from + 1.6, NACL_STEPS[5]!.to - 0.2, NACL_STEPS[5]!.to]) {
    sc.seek(t)
    sc.update(1 / 60, cam)
    sc.root.updateMatrixWorld(true)
    const b = ionBox()
    for (const def of NACL_LABELS) {
      if (!def.outside) continue
      const l = sc.labels.find((x) => x.id === `nacl-${def.id}`)!
      if (l.opacity <= 0.05) continue
      ndc.copy(l.pos).applyMatrix4(sc.root.matrixWorld).project(cam)
      if (ndc.x > b.x0 && ndc.x < b.x1 && ndc.y > b.y0 && ndc.y < b.y1) inside ||= `t=${t.toFixed(2)} ${def.id}: (${ndc.x.toFixed(3)}, ${ndc.y.toFixed(3)}) внутри [${b.x0.toFixed(3)}…${b.x1.toFixed(3)}] × [${b.y0.toFixed(3)}…${b.y1.toFixed(3)}]`
    }
  }
  ok('подписи решётки не ложатся на ионы ни в одном кадре шагов 5–6', inside === '', inside)

  // Октаэдр читается: грани залиты заметнее контура, остальные ионы приглушены.
  sc.seek(NACL_STEPS[4]!.to)
  sc.update(1 / 60, cam)
  const naMesh = sc.root.getObjectByName('nacl-lattice-na') as THREE.InstancedMesh
  const clMesh = sc.root.getObjectByName('nacl-lattice-cl') as THREE.InstancedMesh
  ok('у решётки есть яркость инстансов (приглушение вне октаэдров)', naMesh.instanceColor != null && clMesh.instanceColor != null)
  const focus = new Set<number>([...NACL_OCTA.map((o) => o.center), ...NACL_OCTA_SHELLS.flatMap((s) => s.neighbors)])
  const tintOf = (site: number): number => {
    const el = SALT_FRAG.sites[site]!.el
    const mesh = el === 'Na' ? naMesh : clMesh
    let k = 0
    for (let i = 0; i < site; i++) if (SALT_FRAG.sites[i]!.el === el) k++
    return (mesh.instanceColor!.array as Float32Array)[k * 3]!
  }
  let bright = 0
  let dim = 0
  for (let i = 0; i < SALT_FRAG.sites.length; i++) {
    const v = tintOf(i)
    if (focus.has(i)) bright += v > 0.99 ? 1 : 0
    else dim += v < 0.35 ? 1 : 0
  }
  ok('на показе октаэдров: 14 выделенных ионов в полную яркость', bright === focus.size, `${bright} из ${focus.size}`)
  ok('на показе октаэдров: остальные ионы приглушены', dim === SALT_FRAG.sites.length - focus.size, `${dim}`)
  ok('выноски от октаэдров к подписям видны', (sc.root.getObjectByName('nacl-octa-callout') as THREE.LineSegments).visible)
  ok('рёбра ячеек на показе октаэдров приглушены', (sc.root.getObjectByName('nacl-cell-edges') as THREE.LineSegments & { material: THREE.Material & { opacity: number } }).material.opacity < 0.2)

  // Ячейка металла развёрнута: 9 атомов ОЦК дают 9 РАЗНЫХ точек на экране (фронтальный куб
  // вырождался в квадрат — задние вершины прятались за передними).
  let minSep = Infinity
  const pts = METAL_FRAG.sites.map((_, i) => naclMetalPos(i))
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) minSep = Math.min(minSep, Math.hypot(pts[i]![0] - pts[j]![0], pts[i]![1] - pts[j]![1]))
  ok('ячейка металла в трёхчетвертном ракурсе: вершины не совпадают на экране', minSep > NACL_R.na, minSep.toFixed(3))

  // Длиннофокусная перспектива на шагах 1–4 и обычная на 5–6.
  for (let i = 0; i < 4; i++) ok(`шаг ${i + 1}: длиннофокусная перспектива`, naclDepthPushAt(NACL_STEPS[i]!.from + 0.1) > 1.5)
  ok('шаги 5–6: перспектива обычная', naclDepthPushAt(NACL_STEPS[4]!.from) === 1 && naclDepthPushAt(NACL_END) === 1)

  // Габарит на ПАУЗЕ — по тому, что реально в кадре, а не по самому широкому моменту шага:
  // раньше решётка шага 5 вписывалась в рамку газовых пар начала того же шага и занимала треть
  // отведённого ей места, а на 390 px шаг 1 оставлял сверху пустую полосу.
  const ex = { w: 0, h: 0, cx: 0, cy: 0 }
  const inst = { w: 0, h: 0, cx: 0, cy: 0 }
  for (let i = 0; i < NACL_STEPS.length; i++) {
    const t = Math.min(NACL_STEPS[i]!.to, lastStepTo)
    naclExtentAt(t, ex)
    naclInstantExtent(t, inst)
    const slack = Math.max(ex.w / inst.w, ex.h / inst.h)
    ok(`пауза шага ${i + 1}: кадр не шире композиции более чем на 20 %`, slack <= 1.2, `${slack.toFixed(2)} (${ex.w.toFixed(2)}×${ex.h.toFixed(2)} при ${inst.w.toFixed(2)}×${inst.h.toFixed(2)})`)
    ok(`пауза шага ${i + 1}: композиция целиком в кадре`, ex.w >= inst.w - 1e-5 && ex.h >= inst.h - 1e-5)
  }
  // Кадр нигде не режет то, что в нём стоит. Допуск 3 % — ровно предел скорости изменения
  // огибающей за шаг её таблицы (EXTENT_RATE): на спаде, когда уходящая ячейка металла гаснет и
  // уезжает влево, кадр сжимается не мгновенно, а этим темпом.
  let crop = ''
  for (let t = 0; t <= NACL_END; t += 1 / 120) {
    naclExtentAt(t, ex)
    naclInstantExtent(t, inst)
    if (ex.w < inst.w * 0.97 || ex.h < inst.h * 0.97) crop ||= `t=${t.toFixed(3)}: кадр ${ex.w.toFixed(2)}×${ex.h.toFixed(2)} < композиции ${inst.w.toFixed(2)}×${inst.h.toFixed(2)}`
  }
  ok('кадр нигде не режет композицию (допуск 3 %)', crop === '', crop)
  sc.dispose()
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Тексты урока: числа ↔ ядро, синхронность языков
// ─────────────────────────────────────────────────────────────────────────────

const ladder = (kind: Parameters<typeof naclStageKJ>[0]) => naclStageKJ(kind)
const radiiSum = rNaIon + rClIon
const SCHOOL_D = bondEnthalpyKJ('Cl-Cl')
const SCHOOL_HALF_D = SCHOOL_D / 2
const SCHOOL_SUM = NACL_LADDER.sumKJ - ladder('dissociation') + SCHOOL_HALF_D
/** Справочный разброс энергии решётки, который называет текст рядом с −787,0 (решение владельца). */
const U_SPREAD = [786, 788] as const
/** Внешние константы: 25 °C / 298 K и D-линия натрия 589 нм. */
const EXTERNAL = [25, 298, 589]
const CORE_VALUES: number[] = [
  ATOMIC_DATA.Na.z,
  ATOMIC_DATA.Cl.z,
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
  2 * rNaIon,
  SPECIES_SCALE,
  SALT.cationAnionPm,
  SALT.cellPm.a,
  SALT.densityGCm3,
  SALT.z,
  SALT_FRAG.sites.length,
  NACL_LATTICE_CELLS[0] * 2 + 1,
  SCHOOL_D,
  SCHOOL_HALF_D,
  SCHOOL_SUM,
  ...U_SPREAD,
  LATTICE_BALL_SCALE,
  ...EXTERNAL,
]
ok('школьное ½D отличается от ступени ядра', Math.abs(SCHOOL_HALF_D - ladder('dissociation')) > 0.05)
{
  // Глубина погружения Na⁺ в сферу Cl⁻ — ЧЕТВЕРТЬ диаметра, а не половина (приёмка: текст обещал
  // «наполовину утоплен», а по числам ядра заходит 46,9 пм из 204).
  const sunkFrac = (radiiSum - bondLengthPm('Na-Cl')) / (2 * rNaIon)
  ok('Na⁺ утоплен в Cl⁻ примерно на четверть диаметра (по ядру)', sunkFrac > 0.18 && sunkFrac < 0.32, sunkFrac.toFixed(3))
  const half = /наполовину|полностью|half sunk|yarmigacha/i.test(JSON.stringify(getNaclMechanismText('ru')) + JSON.stringify(getNaclMechanismText('en')) + JSON.stringify(getNaclMechanismText('uz')))
  ok('ни один язык не обещает «наполовину утоплен»', !half)
}
ok('справочный разброс U охватывает значение ядра', U_SPREAD[0] < Math.abs(NACL_LATTICE_KJ) && Math.abs(NACL_LATTICE_KJ) < U_SPREAD[1])
{
  const N_A = 6.02214076e23
  const M = ATOMIC_DATA.Na.atomicMassU + ATOMIC_DATA.Cl.atomicMassU
  const rhoX = (SALT.z * M) / (N_A * (SALT.cellPm.a * 1e-10) ** 3)
  ok('ρ(NaCl) ядра = Z·M/(N_A·a³) с точностью 0,1 %', Math.abs(rhoX - SALT.densityGCm3) / SALT.densityGCm3 < 1e-3)
}

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
  for (const id of NACL_STEP_IDS) {
    const s = t.steps[id]
    ok(`[${locale}] ${id}: заголовок, уравнение, реплика`, s.title.trim().length > 0 && s.equation.trim().length > 0 && s.speak.trim().length > 0)
    ok(`[${locale}] ${id}: есть note (всё схематичное названо)`, (s.note ?? '').length > 0)
  }
  ok(`[${locale}] нет частицы Cl²⁻`, !JSON.stringify(t).includes('Cl²⁻'))
  ok(`[${locale}] нигде нет двойной связи у Cl₂`, !/Cl=Cl|двойн|double bond|qoʻsh bogʻ/i.test(JSON.stringify(t)))
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
  {
    // Школьная версия (Kimyo 8): шаги без энергетики; строение уровней и заряды ядер — из ядра данных.
    ok(`[${locale}] в шагах нет энергетики (кДж, ΔH, цикл Борна — Габера)`, !/кДж|kJ|ΔH|Борн|Born|Габер|Haber/i.test(JSON.stringify(t.steps)))
    const eq = t.steps.sublimation.equation
    ok(`[${locale}] схема уровней: Na 2, 8, 1 и Cl 2, 8, 7 с зарядами ядер из ядра`, eq.includes(`+${ATOMIC_DATA.Na.z}): 2, 8, 1`) && eq.includes(`+${ATOMIC_DATA.Cl.z}): 2, 8, 7`))
    ok(`[${locale}] уравнение итога — 2Na + Cl₂ → 2NaCl`, t.steps.energy.equation === '2Na + Cl₂ → 2NaCl')
    ok(`[${locale}] ионы после перехода: Na⁺ (2, 8) и Cl⁻ (2, 8, 8)`, t.steps.transfer.body.includes('(2, 8)') && t.steps.transfer.body.includes('(2, 8, 8)'))
  }
  const all = Object.values(f).join(' ')
  // 343 — число ионов решётки (целое), не энтальпия: исключаем только его.
  const eaLike = numbers(all).filter((n) => n.v >= 340 && n.v <= 360 && !(n.dec === 0 && n.v === SALT_FRAG.sites.length))
  ok(`[${locale}] Δ_eg H хлора везде одним числом ядра`, eaLike.every((n) => n.dec === 1 && matches(n, ladder('affinity'))))
  // Решётка в тексте = решётка в кадре: «по 5 ионов на ребре».
  ok(`[${locale}] фрагмент в тексте = решётка сцены (ионов по ребру)`, numbers(f['lattice.note']!).some((x) => x.dec === 0 && x.v === NACL_LATTICE_CELLS[0] * 2 + 1))
}
{
  // Привязка «число ↔ величина» (ru): числа стоят на своих местах.
  const strip = (s: string) => s.replaceAll(SALT.spaceGroup, '').replaceAll(METAL.spaceGroup, '')
  const abs = Math.abs
  // Школьная версия: из «больших» чисел (не счётных) в тексте только заряд ядра хлора +17.
  const expect: Record<string, number[]> = {
    'reactants.body': [],
    'sublimation.body': [ATOMIC_DATA.Cl.z],
    'sublimation.equation': [ATOMIC_DATA.Cl.z],
    'transfer.body': [],
    'attraction.body': [],
    'lattice.body': [],
    'lattice.note': [],
    'energy.body': [],
  }
  const ru = fields(getNaclMechanismText('ru'))
  for (const [key, want] of Object.entries(expect)) {
    const got = numbers(strip(ru[key]!)).filter((n) => !isCount(n))
    ok(`[ru] ${key}: числа на своих местах`, got.length === want.length && got.every((n, i) => matches(n, want[i]!)), `${got.map((n) => n.v).join(' ')} | ожидалось ${want.map((v) => v.toFixed(2)).join(' ')}`)
  }
  const seq = (s: string) => numbers(strip(s)).filter((n) => !isCount(n)).map((n) => n.v)
  for (const locale of ['en', 'uz'] as const) {
    const f = fields(getNaclMechanismText(locale))
    for (const key of Object.keys(f)) {
      const a = seq(f[key]!)
      const b = seq(ru[key]!)
      ok(`[${locale}] ${key}: порядок чисел как в ru`, a.length === b.length && a.every((v, i) => near(v, b[i]!, 1e-9)), `${a.join(' ')} | ru ${b.join(' ')}`)
    }
  }
}
for (const key of Object.keys(numbersByField.ru)) {
  ok(`числа поля ${key} совпадают в ru/en`, numbersByField.ru[key] === numbersByField.en[key], `${numbersByField.ru[key]} | ${numbersByField.en[key]}`)
  ok(`числа поля ${key} совпадают в ru/uz`, numbersByField.ru[key] === numbersByField.uz[key], `${numbersByField.ru[key]} | ${numbersByField.uz[key]}`)
}
scene.dispose()

if (failures.length > 0) {
  console.error(`✗ nacl cinema: ${failures.length} из ${checks} проверок не прошли:`)
  for (const m of failures) console.error(`  ✗ ${m}`)
  process.exit(1)
}
console.log(`✓ nacl cinema: ${checks} проверок пройдено`)
console.log(`  шагов ${NACL_STEPS.length}, экранное время ${wall.toFixed(1)} с (${NACL_STEPS.map((s) => s.wall).join(' + ')} + хвост), сюжет ${NACL_END} с`)
console.log(`  перенос e⁻: Безье, смена размеров ${NACL_MORPH_S} с с кадра поглощения; Na ${NACL_RADIUS_PM.na} → ${rNaIon}, Cl ${NACL_RADIUS_PM.cl} → ${rClIon} пм`)
console.log(`  решётка ${NACL_LATTICE_CELLS.join('×')}: ${SALT_FRAG.sites.length} ионов, ${SALT_FRAG.cellEdges.length} рёбер, Cl⁻/Na⁺ = ${(NACL_LATTICE_R.clIon / NACL_LATTICE_R.naIon).toFixed(3)}`)
console.log(`  цикл Борна — Габера: Σ = ${NACL_LADDER.sumKJ} кДж/моль, U = ${NACL_LATTICE_KJ}`)
process.exit(0)
