#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт сцены «горение угля: C (графит) + O₂ (г.) → CO₂ (г.)» (рецепт эталона nacl).
 *
 * Сцена проверяется ДАННЫМИ, а не строками: раскадровка — чистая функция sampleCo2Frame(t),
 * весь урок сэмплируется в Node, а каждое число сверяется с научным ядром src/chemistry/data.
 * Проверок «есть ли в тексте слово/литерал» здесь НЕТ: числа ИЗВЛЕКАЮТСЯ из текста и сверяются
 * с ядром, последовательности чисел ru / en / uz обязаны совпадать.
 *
 *   1. Хронометраж: 6 ± 1 шаг, каждый 4–7 экранных секунд, всего 26–34 с, cue лаборатории
 *      embryo → birth → complete строго после последнего шага.
 *   2. Раскадровка: дорожки монотонны, ни атом, ни камера не прыгают между кадрами 1/30 с.
 *   3. Геометрия ↔ ядро: графит (узлы crystalData, C–C, c/2, укладка AB, ячейка a·a·c), O₂, C=O
 *      карбонила, C≡O, CO₂ (116,0 пм, 180°), сухой лёд (13 целых молекул, КЧ 12, Z = 1 + 12·¼, a).
 *   4. Кадры событий: O=O рвётся только при замкнутых C–O; свободного C (г.) и свободного O нет
 *      ни в один кадр; π-пара CO переходит в новую C=O (в CO₂ две π в перпендикулярных плоскостях).
 *   5. На каждом шаге видимы только объекты этого шага; на паузе каждый видимый атом подписан.
 *   6. Финал без FX: эмиссия постоянна всю сцену, bloom базовый, тряски нет, аннотации гаснут.
 *   7. Энергия: лестница = BORN_HABER.co2 с множителями, сумма = ΔH°f; механизм = FORMATION_REACTIONS.
 *   8. 3D-подписи: только формулы/числа/единицы-токены, числа — из ядра, десятичная запятая ru/uz.
 *   9. Тексты: извлечённые числа ↔ ядро, привязка «число ↔ величина», синхронность ru/en/uz.
 *
 * Запуск: npx tsx scripts/test-co2-cinema.mts
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  ATOMIC_DATA,
  BORN_HABER,
  bondAngleDeg,
  bondEnthalpyKJ,
  bondLengthPm,
  dHfKJ,
  dipoleDebye,
  formationReactionKJ,
  getCrystal,
  radiusForSpecies,
  REACTION_STEP_CHAINS,
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
import { pmToScene, speciesRadius } from '../src/lab/cinema/scenes/kit/cpkAtoms.ts'
import { ladderLevels } from '../src/lab/cinema/scenes/kit/energyLadderData.ts'
import {
  B_COA,
  B_COC,
  B_OH,
  B_OO,
  B_SURFB,
  CO2_ATOM_INDEX,
  CO2_ATOMS,
  CO2_BALL_SCALE,
  CO2_BASE_EMISSIVE,
  CO2_BONDS,
  CO2_C1_ID,
  CO2_CAMERA,
  CO2_CUES,
  CO2_END,
  CO2_GEOM,
  CO2_LABELS,
  CO2_SEGMENTS,
  CO2_STAGES,
  CO2_STEPS,
  CO2_STEP_IDS,
  CO2_TIMING,
  DRY_ARRIVAL,
  DRY_CELL_EDGES,
  DRY_SITE_OF,
  DRY_SRC,
  G_SRC,
  GRAPHITE_CELL_EDGES,
  GRAPHITE_SITE_OF,
  PI_A,
  PI_A2,
  PI_C,
  PI_O2,
  createCo2Frame,
  sampleCo2Frame,
  validateCo2Storyboard,
  type Co2Frame,
} from '../src/lab/cinema/scenes/co2/co2Storyboard.ts'
import {
  CO2_ATOMIZATION_EXCESS_KJ,
  CO2_BOND_EXACT_KJ,
  CO2_BOND_TABLE_KJ,
  CO2_DHF_KJ,
  CO2_DHF_TABLE_KJ,
  CO2_FACTS,
  CO2_HALF_REACTIONS,
  CO2_LADDER,
  CO2_MECHANISM,
  CO2_REACTIONS,
  CO_COMBUSTION_KJ,
  CO_DHF_KJ,
  CO_OH_KJ,
  co2StageKJ,
  validateCo2Energetics,
} from '../src/lab/cinema/scenes/co2/co2Energetics.ts'
import { getCo2MechanismText, type Co2Locale, type Co2MechanismText } from '../src/lab/cinema/scenes/co2/co2MechanismText.ts'
import { co2ScientificWatchdogMs } from '../src/lab/scientificSynthesis/co2ScenarioTiming.ts'

const LOCALES: Co2Locale[] = ['ru', 'en', 'uz']
const frame = createCo2Frame()
const at = (t: number): Co2Frame => sampleCo2Frame(t, frame)
const idx = (id: string) => CO2_ATOM_INDEX.get(id)!
const I = { c0: idx('c0'), oA: idx('oA'), oB: idx('oB'), oC: idx('oC'), hC: idx('hC'), c1: idx(CO2_C1_ID) }

let checks = 0
function ok(label: string, cond: boolean, detail = ''): void {
  assert.ok(cond, `${label}${detail ? ` — ${detail}` : ''}`)
  checks++
}
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol
const dist = (i: number, j: number) => frame.pos[i]!.distanceTo(frame.pos[j]!)
const PM = pmToScene(1)

const GRAPHITE = getCrystal('graphite')!
const DRY = getCrystal('dry_ice')!
const STEP_PAUSE = CO2_STEPS.map((s) => s.to)
const LAST = CO2_STEPS.length - 1
const ADS = CO2_STAGES.adsorb
const DES = CO2_STAGES.desorb
const OXI = CO2_STAGES.oxidize
const DT = 1 / 60

// ─────────────────────────────────────────────────────────────────────────────
// 1. Хронометраж и контракт лаборатории
// ─────────────────────────────────────────────────────────────────────────────

CO2_TIMING.validate()
ok('шагов 6 ± 1', CO2_STEPS.length >= 5 && CO2_STEPS.length <= 7, `${CO2_STEPS.length}`)
ok('id шагов совпадают', CO2_STEP_IDS.join(',') === CO2_STEPS.map((s) => s.id).join(','))
const wall = storyWallDuration(CO2_SEGMENTS)
ok('экранная длительность 26–34 с', wall >= 26 && wall <= 34, `${wall.toFixed(1)} с`)
ok('wallDuration kit = сумма сегментов', near(wall, CO2_TIMING.wallDuration, 1e-9))
for (const s of CO2_STEPS) ok(`шаг ${s.id}: 4–7 экранных секунд`, s.wall >= 4 && s.wall <= 7, `${s.wall}`)
const lastStepTo = CO2_STEPS[LAST]!.to
for (const id of ['embryo', 'birth', 'complete']) {
  const c = CO2_CUES.find((x) => x.id === id)!
  ok(`cue ${id} строго после последнего шага`, c.at > lastStepTo, `${c.at} ≤ ${lastStepTo}`)
}
for (const c of CO2_CUES) {
  if (['embryo', 'birth', 'complete'].includes(c.id)) continue
  ok(`cue ${c.id} внутри шагов`, c.at > 0 && c.at < lastStepTo)
}
ok('complete совпадает с концом сюжета', CO2_CUES.find((c) => c.id === 'complete')!.at === CO2_END)
ok('watchdog лаборатории положителен', co2ScientificWatchdogMs() > 0)
for (const [k, st] of Object.entries(CO2_STAGES)) {
  const cue = CO2_CUES.find((c) => c.id === k)!
  ok(`стадия ${k}: at = cue`, cue != null && near(cue.at, st.at, 1e-12) && st.start < st.at)
  const si = CO2_TIMING.stepIndexAt(st.at)
  ok(`стадия ${k} целиком внутри своего шага`, st.start > CO2_STEPS[si]!.from && st.at < CO2_STEPS[si]!.to)
}
for (let i = 0; i < CO2_STEPS.length; i++) {
  const s = CO2_STEPS[i]!
  ok(`stepIndexAt(${s.id})`, CO2_TIMING.stepIndexAt((s.from + s.to) / 2) === i)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Раскадровка: дорожки, рывки атомов и камеры, ноль аллокаций
// ─────────────────────────────────────────────────────────────────────────────

validateCo2Storyboard()
{
  const scratch = createCo2Frame()
  const buf = CO2_ATOMS.map((a) => ({ id: a.id, pos: new THREE.Vector3(), opacity: 0 }))
  assertNoPositionJumps(
    (t) => {
      sampleCo2Frame(t, scratch)
      for (let i = 0; i < CO2_ATOMS.length; i++) {
        buf[i]!.pos.copy(scratch.pos[i]!)
        buf[i]!.opacity = scratch.opacity[i]!
      }
      return buf
    },
    CO2_END,
    0.09,
    1 / 30,
  )
  checks++
  const cam = createSceneCamera()
  assertCameraContinuity((t) => sampleShot(CO2_CAMERA, t, cam), CO2_END)
  checks++

  // Видимость не щёлкает: у молекул сухого льда растёт шар (доля радиуса), у остальных — непрозрачность.
  const fullR = CO2_ATOMS.map((a) => speciesRadius(a.el, 0, CO2_BALL_SCALE))
  const presence = (i: number) => (CO2_ATOMS[i]!.kind === 'dry' ? scratch.radius[i]! / fullR[i]! : scratch.opacity[i]!)
  let prev: Float32Array | null = null
  let worst = 0
  let worstT = 0
  for (let t = 0; t <= CO2_END + 1e-9; t += 1 / 30) {
    sampleCo2Frame(t, scratch)
    const now = Float32Array.from(CO2_ATOMS, (_, i) => presence(i))
    if (prev) {
      for (let i = 0; i < CO2_ATOMS.length; i++) {
        const d = Math.abs(now[i]! - prev[i]!)
        if (d > worst) {
          worst = d
          worstT = t
        }
      }
    }
    prev = now
  }
  ok('видимость атомов без скачков (≤ 0,12 за 1/30 с)', worst <= 0.12, `${worst.toFixed(3)} при t=${worstT.toFixed(2)}`)
  // Связи тоже не моргают.
  let prevB: Float32Array | null = null
  let worstB = 0
  for (let t = 0; t <= CO2_END + 1e-9; t += 1 / 30) {
    sampleCo2Frame(t, scratch)
    const now = Float32Array.from(scratch.bond.opacity)
    if (prevB) for (let k = 0; k < now.length; k++) worstB = Math.max(worstB, Math.abs(now[k]! - prevB[k]!))
    prevB = now
  }
  ok('видимость связей без скачков (≤ 0,12 за 1/30 с)', worstB <= 0.12, worstB.toFixed(3))

  // Кадр пишет в заранее созданные объекты: ни одного нового вектора/подписи за кадр.
  const posRefs = scratch.pos.slice()
  const labelRefs = scratch.labels.slice()
  const labelPos = scratch.labels.map((l) => l.pos)
  const piRefs = scratch.pi.map((p) => p.normal)
  const bondRef = scratch.bond.opacity
  for (let t = 0; t <= CO2_END; t += 0.5) sampleCo2Frame(t, scratch)
  ok('векторы позиций переиспользуются', scratch.pos.every((p, i) => p === posRefs[i]))
  ok('подписи переиспользуются', scratch.labels.every((l, i) => l === labelRefs[i] && l.pos === labelPos[i]))
  ok('нормали π и массивы связей переиспользуются', scratch.pi.every((p, i) => p.normal === piRefs[i]) && scratch.bond.opacity === bondRef)
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Геометрия раскадровки ↔ ядро
// ─────────────────────────────────────────────────────────────────────────────

// 3.1 Радиусы — ковалентные (Кордеро) из ядра, одна доля на все атомы.
for (const el of ['C', 'O', 'H'] as const) {
  ok(`радиус ${el} = ковалентный радиус ядра × доля`, near(CO2_GEOM.radius[el], speciesRadius(el, 0, CO2_BALL_SCALE)) && radiusForSpecies(el, 0) === ATOMIC_DATA[el].covalentRadiusPm)
}

// 3.2 Шаг 1: графит — узлы crystalData, O₂ — r_e ядра.
at(STEP_PAUSE[0]!)
{
  const gIds = CO2_ATOMS.filter((a) => a.kind === 'graphite').map((a) => a.id).concat('c0')
  const shift = new THREE.Vector3().subVectors(frame.pos[I.c0]!, new THREE.Vector3(...G_SRC.sites[GRAPHITE_SITE_OF.get('c0')!]!.posScene))
  for (const id of gIds) {
    const s = G_SRC.sites[GRAPHITE_SITE_OF.get(id)!]!
    ok(`графит ${id}: в узле crystalData (общий перенос)`, frame.pos[idx(id)]!.clone().sub(shift).distanceTo(new THREE.Vector3(...s.posScene)) < 1e-9)
    ok(`графит ${id}: углерод, видим`, s.el === 'C' && frame.opacity[idx(id)]! > 0.99)
  }
  const gBonds = CO2_BONDS.filter((b) => b.kind === 'graphite' || b.kind === 'graphiteBreak')
  for (const b of gBonds) ok('C–C в слое = cationAnionPm ядра', near(dist(b.a, b.b) / PM, GRAPHITE.cationAnionPm, 0.05), (dist(b.a, b.b) / PM).toFixed(2))
  const ys = [...new Set(gIds.map((id) => frame.pos[idx(id)]!.y.toFixed(6)))].map(Number).sort((a, b) => a - b)
  ok('два слоя', ys.length === 2)
  ok('расстояние между слоями = c/2 ядра', near((ys[1]! - ys[0]!) / PM, GRAPHITE.cellPm.c! / 2, 1e-3))
  // КЧ в слое ≤ coordination; укладка AB: часть атомов нижнего слоя — точно под атомами верхнего, часть — нет.
  const deg = new Map<number, number>()
  for (const b of gBonds) {
    deg.set(b.a, (deg.get(b.a) ?? 0) + 1)
    deg.set(b.b, (deg.get(b.b) ?? 0) + 1)
  }
  ok('КЧ атомов слоя 2…КЧ ядра', [...deg.values()].every((d) => d >= 2 && d <= GRAPHITE.coordination['C (в слое)']!))
  const top = gIds.filter((id) => near(frame.pos[idx(id)]!.y, ys[1]!, 1e-6))
  const bot = gIds.filter((id) => near(frame.pos[idx(id)]!.y, ys[0]!, 1e-6))
  const under = bot.filter((b) => top.some((t) => Math.hypot(frame.pos[idx(t)]!.x - frame.pos[idx(b)]!.x, frame.pos[idx(t)]!.z - frame.pos[idx(b)]!.z) < 1e-6))
  ok('укладка AB: часть нижних атомов под верхними, часть — под центрами колец', under.length > 0 && under.length < bot.length, `${under.length}/${bot.length}`)
  // Ячейка графита: 12 рёбер, 8 длиной a и 4 длиной c.
  const lens = GRAPHITE_CELL_EDGES.map(([p, q]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) / PM)
  ok('ячейка графита: 8 рёбер = a ядра', lens.filter((l) => near(l, GRAPHITE.cellPm.a, 1e-6)).length === 8)
  ok('ячейка графита: 4 ребра = c ядра', lens.filter((l) => near(l, GRAPHITE.cellPm.c!, 1e-6)).length === 4)
  ok('рёбра ячейки графита видны', frame.edgeSet === 'graphite' && frame.edges > 0.9)
  ok('O₂: d(O=O) = bondLengthPm', near(dist(I.oA, I.oB), pmToScene(bondLengthPm('O=O')), 1e-9))
  ok('O₂: σ-трубка и π-лепестки видны', frame.bond.opacity[B_OO]! > 0.99 && frame.pi[PI_O2]!.amount > 0.99)
  ok('материалы: графит матовый слой, O₂ — газ', frame.material[I.c0] === 'polar' && frame.material[I.oA] === 'gas')
}

// 3.3 Шаг 2: две группы C(O) на соседних краевых атомах, C=O — длина карбонила из ядра.
at(STEP_PAUSE[1]!)
ok('пара реагирующих атомов связана (C–C ядра)', near(dist(I.c0, I.c1) / PM, GRAPHITE.cationAnionPm, 0.05))
ok('C(O) на c0: d = bondLengthPm("C=O")', near(dist(I.c0, I.oA), pmToScene(bondLengthPm('C=O')), 1e-9))
ok('C(O) на c1: d = bondLengthPm("C=O")', near(dist(I.c1, I.oB), pmToScene(bondLengthPm('C=O')), 1e-9))
ok('O=O разорвана, C–O замкнуты', frame.bond.opacity[B_OO] === 0 && frame.bond.opacity[B_COA]! > 0.99 && frame.bond.opacity[B_SURFB]! > 0.99)
{
  // C=O в плоскости слоя, под 120° к обеим связям C–C краевого атома (sp²).
  const cBonds = CO2_BONDS.filter((b) => b.kind === 'graphiteBreak')
  for (const b of cBonds) {
    const other = b.a === I.c0 ? b.b : b.a
    const u = frame.pos[other]!.clone().sub(frame.pos[I.c0]!).normalize()
    const v = frame.pos[I.oA]!.clone().sub(frame.pos[I.c0]!).normalize()
    ok('C=O края под 120° к C–C (sp²)', near(THREE.MathUtils.radToDeg(u.angleTo(v)), 120, 1e-6))
  }
  ok('C=O края в плоскости слоя', near(frame.pos[I.oA]!.y, frame.pos[I.c0]!.y, 1e-9))
}

// 3.4 Шаг 3: CO в газе — C≡O ядра.
at(STEP_PAUSE[2]!)
ok('CO: d(C≡O) = bondLengthPm("C#O")', near(dist(I.c0, I.oA), pmToScene(bondLengthPm('C#O')), 1e-9))
ok('CO: две π (тройная связь)', frame.pi[PI_A]!.amount > 0.99 && frame.pi[PI_A2]!.amount > 0.99)
ok('CO: связи C–C разорваны', CO2_BONDS.every((b, k) => b.kind !== 'graphiteBreak' || frame.bond.opacity[k] === 0))
ok('CO — молекула (covalent)', frame.material[I.c0] === 'covalent' && frame.material[I.oA] === 'covalent')

// 3.5 Шаги 4–5: CO₂ — длина и угол ядра, две π в перпендикулярных плоскостях.
for (const si of [3, 4]) {
  at(STEP_PAUSE[si]! - (si === 4 ? 2.4 : 0))
  const tag = `шаг ${si + 1}`
  ok(`${tag}: d(C=O) ×2 = bondLengthPm("C=O(CO2)")`, near(dist(I.c0, I.oA), pmToScene(bondLengthPm('C=O(CO2)')), 1e-9) && near(dist(I.c0, I.oC), pmToScene(bondLengthPm('C=O(CO2)')), 1e-9))
  const u = frame.pos[I.oA]!.clone().sub(frame.pos[I.c0]!)
  const v = frame.pos[I.oC]!.clone().sub(frame.pos[I.c0]!)
  ok(`${tag}: ∠O–C–O = bondAngleDeg("carbonDioxide")`, near(THREE.MathUtils.radToDeg(u.angleTo(v)), bondAngleDeg('carbonDioxide'), 1e-6))
  ok(`${tag}: π-нормали двух связей перпендикулярны друг другу и оси`, near(frame.pi[PI_A]!.normal.dot(frame.pi[PI_C]!.normal), 0, 1e-9) && near(frame.pi[PI_A]!.normal.dot(u.normalize()), 0, 1e-9) && near(frame.pi[PI_C]!.normal.dot(u), 0, 1e-9))
  ok(`${tag}: у каждой C=O одна π (вторая π CO перешла в новую связь)`, frame.pi[PI_A]!.amount > 0.99 && frame.pi[PI_C]!.amount > 0.99 && frame.pi[PI_A2]!.amount === 0)
  ok(`${tag}: H· ушёл`, frame.opacity[I.hC] === 0)
}
at(STEP_PAUSE[4]!)
ok('пауза шага 5: π свернулись в двойные полосы (кратность 2)', frame.bond.order[B_COA] === 2 && frame.bond.order[B_COC] === 2 && frame.fx.lobes === 0)
ok('пауза шага 5: векторы диполей и δ± видны', frame.fx.dipole > 0.99 && frame.charge[I.c0]! > 0 && frame.charge[I.oA]! < 0 && frame.charge[I.oC]! < 0)
ok('пауза шага 5: сумма частичных зарядов ≈ 0 не требуется, но |δ| < 1 (не ионы)', [I.c0, I.oA, I.oC].every((i) => Math.abs(frame.charge[i]!) < 1))

// 3.6 Шаг 6: сухой лёд — 13 целых молекул, КЧ 12, Z = 1 + 12·¼, a ядра.
at(STEP_PAUSE[5]!)
{
  const vis = CO2_ATOMS.map((a, i) => ({ a, i })).filter(({ i }) => frame.opacity[i]! > 0.99)
  ok('в кадре 13 молекул CO₂ = 39 атомов', vis.length === 3 * CO2_GEOM.dryMolecules && CO2_GEOM.dryMolecules === 13, `${vis.length}`)
  for (const [id, si] of DRY_SITE_OF) {
    const s = DRY_SRC.sites[si]!
    ok(`сухой лёд ${id}: в узле crystalData`, frame.pos[idx(id)]!.distanceTo(new THREE.Vector3(...s.posScene)) < 1e-9 && s.el === CO2_ATOMS[idx(id)]!.el)
  }
  const cs = vis.filter(({ a }) => a.el === 'C').map(({ i }) => i)
  const center = I.c0
  const nn = cs.filter((i) => i !== center && near(dist(i, center) / PM, DRY.cellPm.a / Math.SQRT2, 1e-6))
  ok('у центральной молекулы 12 соседей на a/√2 = КЧ ядра', nn.length === DRY.coordination['CO₂ (соседних молекул)'])
  ok('Z = 1 + 12·¼ = z ядра', 1 + nn.length / 4 === DRY.z)
  for (const i of cs) {
    // C=O в кристалле — из базиса ячейки; cationAnionPm ядра — то же значение, округлённое до 0,1 пм.
    const os = vis.filter(({ a, i: j }) => a.el === 'O' && near(dist(i, j) / PM, DRY.cationAnionPm, 0.05))
    ok('молекула решётки: 2 O на C=O кристалла (±0,05 пм округления ядра)', os.length === 2)
    if (os.length === 2) {
      const u = frame.pos[os[0]!.i]!.clone().sub(frame.pos[i]!)
      const v = frame.pos[os[1]!.i]!.clone().sub(frame.pos[i]!)
      ok('молекула решётки линейная', near(THREE.MathUtils.radToDeg(u.angleTo(v)), bondAngleDeg('carbonDioxide'), 1e-6))
    }
  }
  const lens = DRY_CELL_EDGES.map(([p, q]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) / PM)
  ok('ячейка сухого льда: 12 рёбер длиной a ядра', lens.length === 12 && lens.every((l) => near(l, DRY.cellPm.a, 1e-6)))
  ok('рёбра ячейки видны', frame.edgeSet === 'dry' && frame.edges > 0.9)
  ok('C=O в кристалле ≠ C=O в газе (ядро различает)', DRY.cationAnionPm !== bondLengthPm('C=O(CO2)'))
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Кадры событий и законы механизма (каждые 1/60 с)
// ─────────────────────────────────────────────────────────────────────────────

{
  let freeC = 0
  let freeO = 0
  let gasHomolysis = 0
  let firstBad = -1
  const bondOf = (atom: number) => CO2_BONDS.map((b, k) => ({ b, k })).filter(({ b }) => b.a === atom || b.b === atom)
  const BONDS_OF = new Map<number, { k: number }[]>([I.c0, I.oA, I.oB, I.oC].map((a) => [a, bondOf(a)]))
  for (let t = 0; t <= CO2_END + 1e-9; t += DT) {
    at(t)
    for (const a of [I.c0, I.oA, I.oB, I.oC]) {
      if (frame.opacity[a]! < 0.5) continue
      const held = BONDS_OF.get(a)!.some(({ k }) => frame.bond.opacity[k]! >= 0.5 * frame.opacity[a]!)
      if (!held) {
        if (a === I.c0) freeC++
        else freeO++
        if (firstBad < 0) firstBad = t
      }
    }
    // O=O слабеет только когда обе связи C–O уже замкнуты.
    if (frame.bond.opacity[B_OO]! < 0.99 && frame.bond.opacity[B_OO]! > 0 && t > 1) {
      if (!(frame.bond.opacity[B_COA]! > 0.99 && frame.bond.opacity[B_SURFB]! > 0.99)) gasHomolysis++
    }
  }
  ok('свободного атома C (г.) нет ни в один кадр', freeC === 0, `с t=${firstBad.toFixed(3)}`)
  ok('свободного атома O нет ни в один кадр', freeO === 0, `с t=${firstBad.toFixed(3)}`)
  ok('гомолиза O₂ в газе нет: O=O слабеет только при замкнутых C–O', gasHomolysis === 0, `${gasHomolysis}`)

  // Кадр ADS.at: до — O₂ цел, C–O замкнуты; после — O=O уходит.
  at(ADS.at - DT)
  const before = { oo: frame.bond.opacity[B_OO]!, m: frame.material[I.oA] }
  at(ADS.at)
  ok('кадр посадки: до — O=O цела, O — газ', before.oo === 1 && before.m === 'gas')
  ok('кадр посадки: O садится на край (материал слоя)', frame.material[I.oA] === 'polar' && frame.material[I.oB] === 'polar')
  // Кадр DES.at: C–C рвутся, CO становится молекулой; вторая π растёт.
  at(DES.at - DT)
  const pre = { m: frame.material[I.c0], pi2: frame.pi[PI_A2]!.amount }
  at(DES.at + 0.6)
  ok('десорбция: до кадра — атом слоя, одна π', pre.m === 'polar' && pre.pi2 === 0)
  ok('десорбция: после — CO (covalent) с двумя π', frame.material[I.c0] === 'covalent' && frame.pi[PI_A2]!.amount > 0.99)
  // Кадр OXI.at: O–H рвётся, O из ·OH — в CO₂, H· уходит свободным радикалом.
  at(OXI.at - DT)
  ok('до кадра окисления: O–H длиной ядра, O и H — газ-радикал', near(dist(I.oC, I.hC), pmToScene(bondLengthPm('O-H')), 1e-9) && frame.material[I.oC] === 'gas')
  at(OXI.at)
  ok('кадр окисления: O из ·OH — в молекуле CO₂', frame.material[I.oC] === 'covalent' && frame.bond.opacity[B_COC]! > 0.99)
  at(OXI.at + 0.6)
  ok('после окисления: O–H разорвана, H· свободен и подписан', frame.bond.opacity[B_OH] === 0 && frame.labels.find((l) => l.id === 'h')!.opacity > 0.9)
  // Атомы уравнения: C + O₂ — ровно один C и два O сюжета из O₂; ·OH — внешний радикал цепи.
  const story = CO2_ATOMS.filter((a) => a.kind === 'story')
  ok('в сюжете 1 C, 2 O из O₂, O и H радикала ·OH', story.filter((a) => a.el === 'C').length === 1 && story.filter((a) => a.el === 'O').length === 3 && story.filter((a) => a.el === 'H').length === 1)
  ok('в молекулу CO₂ входят: C графита, O из O₂ и O из ·OH', ['c0', 'oA', 'oC'].every((id) => CO2_ATOMS[idx(id)]!.kind === 'story'))
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Только объекты текущего шага; на паузе каждый видимый атом подписан
// ─────────────────────────────────────────────────────────────────────────────

function hostSpan(hosts: readonly string[]): number {
  let m = 0
  for (const a of hosts) for (const b of hosts) m = Math.max(m, frame.pos[idx(a)]!.distanceTo(frame.pos[idx(b)]!))
  return m
}

for (let si = 0; si < CO2_STEPS.length; si++) {
  const s = CO2_STEPS[si]!
  let foreign = 0
  let at0 = -1
  for (let t = s.from; t <= s.to + 1e-9; t += DT) {
    at(t)
    for (let i = 0; i < CO2_ATOMS.length; i++) {
      const [a, b] = CO2_ATOMS[i]!.span
      if (!(si >= a && si <= b) && frame.opacity[i]! > 0) {
        foreign++
        if (at0 < 0) at0 = t
      }
    }
    for (let k = 0; k < CO2_BONDS.length; k++) {
      const b = CO2_BONDS[k]!
      if (frame.bond.opacity[k]! > 0 && (frame.opacity[b.a]! === 0 || frame.opacity[b.b]! === 0)) {
        foreign++
        if (at0 < 0) at0 = t
      }
    }
  }
  ok(`шаг ${s.id}: ни одного атома или связи чужого шага`, foreign === 0, `первый при t=${at0.toFixed(3)}`)

  at(s.to)
  const visibleLabels = frame.labels.map((l, k) => ({ st: l, def: CO2_LABELS[k]! })).filter(({ st }) => st.opacity > 0.5)
  ok(`пауза ${s.id}: есть подписи`, visibleLabels.length > 0)
  for (let i = 0; i < CO2_ATOMS.length; i++) {
    if (frame.opacity[i]! <= 0.02) continue
    const id = CO2_ATOMS[i]!.id
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
// Подпись о несуществующем: на паузе шага 3 графита нет, на паузе шага 4 — H·.
at(STEP_PAUSE[2]!)
ok('пауза шага 3: графит погашен полностью', CO2_ATOMS.every((a, i) => a.kind !== 'graphite' || frame.opacity[i] === 0) && frame.opacity[I.oB] === 0)

// ─────────────────────────────────────────────────────────────────────────────
// 6. Без огня и свечения: эмиссия постоянна всю сцену, в финале аннотации погашены
// ─────────────────────────────────────────────────────────────────────────────

{
  let hot = 0
  let bloom = 0
  let shake = 0
  for (let t = 0; t <= CO2_END + 1e-9; t += 1 / 30) {
    at(t)
    for (let i = 0; i < CO2_ATOMS.length; i++) if (frame.emissive[i] !== Math.fround(CO2_BASE_EMISSIVE[CO2_ATOMS[i]!.el])) hot++
    if (!near(frame.camera.bloom, 0.3)) bloom++
    if (frame.camera.shake !== 0) shake++
  }
  ok('эмиссия каждого атома постоянна всю сцену (нет свечения внутри вещества)', hot === 0, `${hot}`)
  ok('bloom базовый всю сцену', bloom === 0)
  ok('тряски нет', shake === 0)
  const s = CO2_STEPS[LAST]!
  // Векторы диполей и δ± с паузы шага 5 гаснут за первые полсекунды шага 6; дальше — ноль.
  for (let t = s.from + 0.6; t <= s.to + 1e-9; t += 1 / 30) {
    at(t)
    ok(`шаг 6, t=${t.toFixed(2)}: аннотации = 0`, frame.fx.dipole === 0 && frame.fx.lobes === 0 && [I.c0, I.oA, I.oC].every((i) => frame.charge[i] === 0))
  }
  let prevD = Infinity
  let monotone = true
  for (let t = s.from; t <= s.from + 0.6; t += DT) {
    at(t)
    if (frame.fx.dipole > prevD + 1e-12) monotone = false
    prevD = frame.fx.dipole
  }
  ok('шаг 6: векторы диполей только гаснут', monotone)
  at(CO2_END)
  ok('в конце хвоста кадр затемнён', frame.fade > 0.95)
  ok('сухой лёд: соседи прилетают внутри шага 6 до паузы', DRY_ARRIVAL.every((a) => a.start > s.from && a.arrive < s.to))
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Энергетика: лестница = ядро, механизм = FORMATION_REACTIONS
// ─────────────────────────────────────────────────────────────────────────────

validateCo2Energetics()
{
  const cycle = BORN_HABER.co2
  ok('ступени лестницы = ступени BORN_HABER.co2', CO2_LADDER.stages.length === cycle.stages.length)
  for (const st of cycle.stages) {
    const l = CO2_LADDER.stages.find((x) => x.id === st.id)!
    ok(`ступень ${st.id} = ядро`, l.dH === st.dHKJ)
    ok(`ступень ${st.id}: множитель × perUnit = dH`, l.perUnitKJ == null || near((l.multiplier ?? 1) * l.perUnitKJ, l.dH, 1e-9))
  }
  ok('атомизация = ΔH°f(C, г.)', co2StageKJ('atomization') === dHfKJ('C(g)'))
  ok('диссоциация O₂ = 2 × ΔH°f(O, г.) с множителем 2', CO2_LADDER.stages.find((s) => s.id === 'dissociation')!.multiplier === 2 && near(co2StageKJ('dissociation'), 2 * dHfKJ('O(g)'), 1e-9))
  ok('Σ лестницы = ΔH°f(CO₂, г.) (±0,05)', near(CO2_LADDER.sumKJ, dHfKJ('CO2(g)'), 0.05))
  ok('знаки: атомизация > 0, диссоциация > 0, связи < 0, итог < 0', co2StageKJ('atomization') > 0 && co2StageKJ('dissociation') > 0 && co2StageKJ('bonds') < 0 && CO2_LADDER.sumKJ < 0)
  ok('атомизация дороже всего тепла реакции (свободного C нет)', CO2_ATOMIZATION_EXCESS_KJ > 0 && near(CO2_ATOMIZATION_EXCESS_KJ, dHfKJ('C(g)') + dHfKJ('CO2(g)'), 0.05))
  const levels = ladderLevels(CO2_LADDER)
  ok('последний уровень = сумма', near(levels[levels.length - 1]!, CO2_LADDER.sumKJ))
  ok('ступени по времени сюжета и внутри шагов', CO2_LADDER.stages.every((s, i) => s.at > 0 && s.at < lastStepTo && (i === 0 || s.at >= CO2_LADDER.stages[i - 1]!.at)))
  // Механизм: цепочка ядра, числа — formationReactionKJ.
  ok('механизм = REACTION_STEP_CHAINS.c_o2', CO2_MECHANISM.map((m) => m.id).join(',') === REACTION_STEP_CHAINS.c_o2.join(','))
  for (const m of CO2_MECHANISM) ok(`стадия ${m.id} = formationReactionKJ`, m.dH === formationReactionKJ(m.id) && m.dH < 0)
  ok('C → CO (край) = ΔH°f(CO)', near(formationReactionKJ('co_formation'), dHfKJ('CO(g)'), 1e-9) && CO_DHF_KJ === dHfKJ('CO(g)'))
  ok('C → CO → CO₂ = ΔH°f(CO₂)', near(formationReactionKJ('co_formation') + CO_COMBUSTION_KJ, CO2_DHF_TABLE_KJ, 1e-6))
  ok('CO + ·OH → CO₂ + H· по ΔH°f ядра', near(CO_OH_KJ, dHfKJ('CO2(g)') + dHfKJ('H(g)') - dHfKJ('CO(g)') - dHfKJ('OH(g)'), 1e-6))
  ok('энергия одной C=O по циклу = −связи/2', near(CO2_BOND_EXACT_KJ, -co2StageKJ('bonds') / 2, 0.05))
  ok('средняя E(C=O) в CO₂ из ядра', CO2_BOND_TABLE_KJ === bondEnthalpyKJ('C=O(CO2)'))
}
// Стехиометрия, электронный и зарядовый баланс.
{
  const count = (formula: string, coeff: number, into: Map<string, number>) => {
    for (const m of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) into.set(m[1]!, (into.get(m[1]!) ?? 0) + (m[2] ? Number(m[2]) : 1) * coeff)
  }
  for (const [name, r] of Object.entries(CO2_REACTIONS)) {
    const left = new Map<string, number>()
    const right = new Map<string, number>()
    for (const t of r.left) count(t.formula, t.coeff, left)
    for (const t of r.right) count(t.formula, t.coeff, right)
    for (const k of new Set([...left.keys(), ...right.keys()])) ok(`${name}: баланс по ${k}`, left.get(k) === right.get(k))
  }
  ok('кислород — двухатомная молекула', CO2_REACTIONS.overall.left.some((t) => t.formula === 'O2') && !CO2_REACTIONS.overall.left.some((t) => t.formula === 'O'))
  const given = CO2_HALF_REACTIONS.filter((h) => h.id === 'oxidation').reduce((s, h) => s + h.electrons * h.times, 0)
  const taken = CO2_HALF_REACTIONS.filter((h) => h.id === 'reduction').reduce((s, h) => s + h.electrons * h.times, 0)
  ok('электронный баланс', given === taken)
  ok('зарядовый баланс', CO2_HALF_REACTIONS.reduce((s, h) => s + h.chargeRight * h.times, 0) === 0)
  // Формальная с.о. углерода в CO₂ из электронейтральности: x + 2·(−2) = 0.
  ok('с.о. C в CO₂ = +4 из электронейтральности', CO2_HALF_REACTIONS[0]!.chargeRight === 2 * 2)
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
/** Символы пространственных групп — обозначения, а не числа. */
const stripGroups = (s: string) => s.replaceAll(GRAPHITE.spaceGroup, '').replaceAll(DRY.spaceGroup, '')

// ─────────────────────────────────────────────────────────────────────────────
// 8. 3D-подписи: символы и числа ядра
// ─────────────────────────────────────────────────────────────────────────────

{
  const allowed3d = [
    GRAPHITE.cellPm.a,
    GRAPHITE.cationAnionPm,
    GRAPHITE.cellPm.c! / 2,
    bondLengthPm('O=O'),
    bondLengthPm('C#O'),
    bondLengthPm('C=O(CO2)'),
    bondAngleDeg('carbonDioxide'),
    CO2_FACTS.deltaChi,
    dipoleDebye('CO2')!,
    CO_DHF_KJ,
    CO2_DHF_KJ,
    DRY.cellPm.a,
    DRY.coordination['CO₂ (соседних молекул)']!,
  ]
  for (const l of CO2_LABELS) {
    for (const k of l.keys) {
      const bare = k.text.replace(/\{\w+\}/g, '')
      ok(`подпись ${l.id}: без кириллицы`, !/[А-Яа-яЁё]/.test(bare), k.text)
      ok(`подпись ${l.id}: без фраз`, !/[a-z]{3,}/.test(stripGroups(bare)), k.text)
      ok(`подпись ${l.id}: единицы только токенами`, !/\b(pm|kJ\/mol|kJ|nm)\b/.test(bare) && !/\((s|g|l|aq)\)/.test(bare), k.text)
      for (const g of [GRAPHITE.spaceGroup, DRY.spaceGroup]) if (bare.includes(g)) ok(`подпись ${l.id}: группа из ядра`, bare.trim() === g)
      for (const n of numbers(stripGroups(bare))) ok(`подпись ${l.id}: число ${n.raw} из ядра`, allowed3d.some((v) => matches(n, v)), k.text)
    }
  }
  const text = (id: string) => CO2_LABELS.find((l) => l.id === id)!.keys[0]!.text
  ok('подпись C–C = cationAnionPm', hasValue(text('gCC'), GRAPHITE.cationAnionPm))
  ok('подпись межслоевого = c/2', hasValue(text('gLayer'), GRAPHITE.cellPm.c! / 2) && numbers(text('gLayer')).length === 1)
  ok('подпись O=O = r_e ядра', hasValue(text('oo'), bondLengthPm('O=O')))
  ok('подпись C≡O = bondLengthPm', hasValue(text('coLen'), bondLengthPm('C#O')))
  ok('подпись C=O = bondLengthPm(CO₂)', hasValue(text('coLen2'), bondLengthPm('C=O(CO2)')))
  ok('подпись угла = bondAngleDeg', hasValue(text('angle'), bondAngleDeg('carbonDioxide')))
  const dHco = numbers(text('dHco'))[0]!
  ok('подпись ΔH°f(CO) со знаком минус = ядро', dHco.sign === -1 && matches(dHco, dHfKJ('CO(g)')))
  const dH = numbers(text('dH'))[0]!
  ok('подпись ΔH°f(CO₂) = сумма лестницы со знаком', dH.sign === -1 && matches(dH, CO2_DHF_KJ) && near(CO2_DHF_KJ, CO2_LADDER.sumKJ, 0.05))
  ok('подпись a сухого льда = ядро', hasValue(text('dryA'), DRY.cellPm.a))
  ok('подпись КЧ = число соседних молекул ядра', hasValue(text('dryCn'), DRY.coordination['CO₂ (соседних молекул)']!))
  ok('подпись Σμ = μ(CO₂) ядра', hasValue(text('mu'), dipoleDebye('CO2')!))
  ok('подпись Δχ = разность χ ядра', hasValue(text('chi'), ATOMIC_DATA.O.electronegativity! - ATOMIC_DATA.C.electronegativity!))

  const known = new Set(Object.keys(SCENE_LABEL_TOKENS.ru))
  for (const token of labelTokensUsed(CO2_LABELS)) ok(`токен {${token}} есть в словаре`, known.has(token))
  for (const locale of LOCALES) {
    const states = createLabelStates(CO2_LABELS)
    localizeSceneLabels(states, locale, true)
    for (const st of states) ok(`[${locale}] подпись ${st.id} раскрыта`, !/\{\w+\}/.test(st.text) && st.text.trim().length > 0)
    if (locale !== 'en') ok(`[${locale}] 3D-числа с десятичной запятой`, !/\d\.\d/.test(states.map((x) => x.text).join(' ')))
  }
  const ru = createLabelStates(CO2_LABELS)
  const en = createLabelStates(CO2_LABELS)
  localizeSceneLabels(ru, 'ru')
  localizeSceneLabels(en, 'en')
  ok('подписи ru отличаются от en (единицы переведены)', ru.some((s, i) => s.text !== en[i]!.text))
  for (const l of CO2_LABELS) for (const w of l.windows) ok(`окно подписи ${l.id}`, w[0] < w[1] && w[0] >= 0 && w[1] <= CO2_END + 1e-9)
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Тексты урока: числа ↔ ядро, привязка, синхронность языков
// ─────────────────────────────────────────────────────────────────────────────

const ladder = co2StageKJ
const abs = Math.abs
/** Внешние константы, которых нет в ядре: стандартные условия 25 °C. */
const EXTERNAL = [25]

const CORE_VALUES: number[] = [
  GRAPHITE.cationAnionPm,
  GRAPHITE.cellPm.a,
  GRAPHITE.cellPm.c!,
  GRAPHITE.cellPm.c! / 2,
  bondLengthPm('O=O'),
  bondLengthPm('C=O'),
  bondEnthalpyKJ('C=O'),
  bondLengthPm('C#O'),
  bondEnthalpyKJ('C#O'),
  bondLengthPm('C=O(CO2)'),
  bondEnthalpyKJ('C=O(CO2)'),
  bondAngleDeg('carbonDioxide'),
  ATOMIC_DATA.O.electronegativity!,
  ATOMIC_DATA.C.electronegativity!,
  CO2_FACTS.deltaChi,
  CO2_BALL_SCALE,
  CO_DHF_KJ,
  CO_OH_KJ,
  CO_COMBUSTION_KJ,
  CO2_DHF_TABLE_KJ,
  ladder('atomization'),
  ladder('dissociation'),
  ladder('bonds'),
  CO2_ATOMIZATION_EXCESS_KJ,
  CO2_BOND_EXACT_KJ,
  DRY.cellPm.a,
  DRY.temperatureK!,
  DRY.cationAnionPm,
  DRY.densityGCm3,
  CO2_GEOM.dryMolecules,
  ...EXTERNAL,
]

/** Малые целые — счёт (2 C, 3 соседа, Z = 4, КЧ 12, +4/−2, 1 атм). */
const isCount = (n: Num) => n.dec === 0 && n.v <= 12

const fields = (t: Co2MechanismText): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const id of CO2_STEP_IDS) {
    const s = t.steps[id]
    out[`${id}.title`] = s.title
    out[`${id}.body`] = s.body
    out[`${id}.equation`] = s.equation
    out[`${id}.note`] = s.note ?? ''
    out[`${id}.speak`] = s.speak
  }
  out.intro = t.intro.title + ' ' + t.intro.speak
  out.legend = t.legend.electron + ' ' + t.legend.orbitalPhase
  out.safety = t.safety
  out.energy = Object.values(t.energy.stages).join(' ') + ' ' + t.energy.caption + ' ' + t.energy.sources
  return out
}

for (const locale of LOCALES) {
  const t = getCo2MechanismText(locale)
  ok(`[${locale}] заголовок и безопасность`, t.intro.title.length > 0 && t.safety.length > 20)
  for (const id of CO2_STEP_IDS) {
    const s = t.steps[id]
    ok(`[${locale}] ${id}: заголовок, уравнение, реплика`, s.title.trim().length > 0 && s.equation.trim().length > 0 && s.speak.trim().length > 0)
    ok(`[${locale}] ${id}: 2–4 предложения`, s.body.split(/[.!?]\s/).length >= 2)
    ok(`[${locale}] ${id}: есть note (всё схематичное названо)`, (s.note ?? '').length > 0)
  }
  ok(`[${locale}] aria-подпись лестницы`, t.energy.summary.includes('{dH}'))
  const f = fields(t)
  for (const [key, s] of Object.entries(f)) {
    for (const n of numbers(stripGroups(s))) {
      if (isCount(n)) continue
      ok(`[${locale}] ${key}: число ${n.raw.trim()} есть в ядре`, CORE_VALUES.some((v) => matches(n, v)), s.slice(0, 80))
    }
  }
  // Суммы в тексте разбираются по слагаемым: формальный путь (лестница) и реальный путь (механизм).
  const parseSum = (s: string) => {
    const eq = s.indexOf('=')
    const terms = [...s.slice(0, eq).matchAll(/([+−-])\s?\(?\s?([+−-]?)(\d+[.,]\d+)/g)].map(
      (m) => (m[1] === '+' ? 1 : -1) * (m[2] === '−' || m[2] === '-' ? -1 : 1) * Number(m[3]!.replace(',', '.')),
    )
    const res = /([+−-])\s?(\d+[.,]\d+)/.exec(s.slice(eq))!
    return { terms, total: (res[1] === '+' ? 1 : -1) * Number(res[2]!.replace(',', '.')) }
  }
  {
    const cap = t.energy.caption
    const { terms, total } = parseSum(cap)
    const cycle = BORN_HABER.co2.stages.map((s) => s.dHKJ)
    ok(`[${locale}] сумма лестницы в тексте: слагаемые = ступени ядра`, terms.length === cycle.length && terms.every((v, i) => near(v, cycle[i]!, 0.05)), terms.join(' '))
    ok(`[${locale}] сумма лестницы сходится арифметически и = ΔH°f`, near(terms.reduce((a, b) => a + b, 0), total, 0.05) && near(total, dHfKJ('CO2(g)'), 0.05))
  }
  {
    const body = t.steps.oxidation.body
    const tail = body.slice(body.lastIndexOf(':') + 1)
    const { terms, total } = parseSum(tail)
    ok(`[${locale}] реальный путь: −110,5 + (−283,0) по ядру`, terms.length === 2 && near(terms[0]!, CO_DHF_KJ, 0.05) && near(terms[1]!, CO_COMBUSTION_KJ, 0.05), terms.join(' '))
    ok(`[${locale}] реальный путь = ΔH°f(CO₂)`, near(terms.reduce((a, b) => a + b, 0), total, 0.05) && near(total, CO2_DHF_TABLE_KJ, 0.05))
  }
  // Знаки тепловых эффектов в уравнениях — как в ядре.
  const eqNum = (id: (typeof CO2_STEP_IDS)[number]) => numbers(t.steps[id].equation).find((n) => n.dec > 0)!
  ok(`[${locale}] ΔH десорбции со знаком ядра`, eqNum('desorption').sign === -1 && matches(eqNum('desorption'), CO_DHF_KJ))
  ok(`[${locale}] ΔH CO + ·OH со знаком ядра`, eqNum('oxidation').sign === -1 && matches(eqNum('oxidation'), CO_OH_KJ))
  // Счётные величины — по шаблонам, из ядра.
  const z = /Z = (\d+)/.exec(f['solid.body']!)
  ok(`[${locale}] Z в тексте = DRY.z`, z != null && Number(z[1]) === DRY.z)
  const nb = /(\d+)\s?(?:ближайших|nearest|ta eng yaqin)/.exec(f['solid.body']!)
  ok(`[${locale}] число соседей в тексте = КЧ ядра`, nb != null && Number(nb[1]) === DRY.coordination['CO₂ (соседних молекул)'])
  const cn = /(?:КЧ|CN|KS) (\d+)/.exec(f['solid.equation']!)
  ok(`[${locale}] КЧ в уравнении = ядро`, cn != null && Number(cn[1]) === DRY.coordination['CO₂ (соседних молекул)'])
  const zSum = /1 \+ (\d+)·¼ = (\d+)/.exec(f['solid.note']!)
  ok(`[${locale}] 1 + 12·¼ = Z`, zSum != null && Number(zSum[1]) === DRY.coordination['CO₂ (соседних молекул)'] && Number(zSum[2]) === DRY.z)
  const three = /(\d)\s?(?:соседа|neighbours|ta qo‘shnisi)/.exec(f['reactants.body']!)
  ok(`[${locale}] КЧ в слое графита = ядро`, three == null || Number(three[1]) === GRAPHITE.coordination['C (в слое)'])
}

// ─── Привязка «число ↔ величина»: ТО число на ТОМ месте (порядок ru), en/uz — та же последовательность ───
{
  const seq = (s: string) => numbers(stripGroups(s)).filter((n) => !isCount(n))
  const expect: Record<string, number[]> = {
    'reactants.body': [GRAPHITE.cationAnionPm, GRAPHITE.cellPm.c! / 2, GRAPHITE.cellPm.c!, bondLengthPm('O=O')],
    'reactants.note': [GRAPHITE.cellPm.a, CO2_BALL_SCALE],
    'chemisorption.body': [bondLengthPm('C=O')],
    'chemisorption.note': [bondLengthPm('C=O')],
    'desorption.body': [bondLengthPm('C#O'), bondEnthalpyKJ('C#O'), abs(CO_DHF_KJ)],
    'desorption.equation': [abs(CO_DHF_KJ)],
    'desorption.note': [ladder('atomization'), CO2_ATOMIZATION_EXCESS_KJ],
    'oxidation.body': [abs(CO_OH_KJ), abs(CO_COMBUSTION_KJ), abs(CO_DHF_KJ), abs(CO_COMBUSTION_KJ), abs(CO2_DHF_TABLE_KJ)],
    'oxidation.equation': [abs(CO_OH_KJ)],
    'structure.body': [bondAngleDeg('carbonDioxide'), bondLengthPm('C=O(CO2)'), ATOMIC_DATA.O.electronegativity!, ATOMIC_DATA.C.electronegativity!, CO2_FACTS.deltaChi],
    'structure.equation': [bondAngleDeg('carbonDioxide'), bondLengthPm('C=O(CO2)')],
    'structure.note': [bondLengthPm('C=O'), bondEnthalpyKJ('C=O'), bondEnthalpyKJ('C=O(CO2)'), CO2_BOND_EXACT_KJ],
    'solid.body': [DRY.cellPm.a, DRY.temperatureK!],
    'solid.equation': [DRY.cellPm.a],
    'solid.note': [CO2_GEOM.dryMolecules, DRY.cationAnionPm, DRY.temperatureK!, bondLengthPm('C=O(CO2)'), DRY.temperatureK!, DRY.densityGCm3, 25],
    energy: [ladder('atomization'), ladder('dissociation'), abs(ladder('bonds')), abs(CO2_DHF_TABLE_KJ)],
  }
  const byLocale = Object.fromEntries(LOCALES.map((l) => [l, fields(getCo2MechanismText(l))])) as Record<Co2Locale, Record<string, string>>
  for (const [key, want] of Object.entries(expect)) {
    const got = seq(byLocale.ru[key]!)
    ok(`[ru] ${key}: числа на своих местах`, got.length === want.length && got.every((n, i) => matches(n, want[i]!)), `${got.map((n) => n.v).join(' ')} | ожидалось ${want.map((v) => v.toFixed(2)).join(' ')}`)
  }
  // Поле без ожиданий не имеет права содержать некаунтовые числа.
  for (const key of Object.keys(byLocale.ru)) {
    if (key in expect) continue
    ok(`[ru] ${key}: без чисел величин`, seq(byLocale.ru[key]!).length === 0, byLocale.ru[key]!.slice(0, 60))
  }
  for (const locale of ['en', 'uz'] as const) {
    for (const key of Object.keys(byLocale.ru)) {
      const a = numbers(stripGroups(byLocale.ru[key]!)).map((n) => n.v)
      const b = numbers(stripGroups(byLocale[locale][key]!)).map((n) => n.v)
      ok(`[${locale}] ${key}: те же числа в том же порядке, что в ru`, a.length === b.length && a.every((v, i) => near(v, b[i]!, 1e-9)), `${b.join(' ')} | ru ${a.join(' ')}`)
    }
  }
}

console.log(`✓ co2 cinema: ${checks} проверок пройдено`)
console.log(`  шагов ${CO2_STEPS.length}, экранное время ${wall.toFixed(1)} с (${CO2_STEPS.map((s) => s.wall).join(' + ')} + хвост), сюжет ${CO2_END} с`)
console.log(`  лестница Гесса: ${CO2_LADDER.stages.map((s) => s.dH).join(' + ')} = ${CO2_LADDER.sumKJ} (таблица ${CO2_DHF_TABLE_KJ}); механизм: ${CO2_MECHANISM.map((m) => `${m.id} ${m.dH}`).join(', ')}`)
console.log(`  графит: ${CO2_GEOM.flakeCount} атомов в двух слоях, сухой лёд: ${CO2_GEOM.dryMolecules} молекул, ${DRY_CELL_EDGES.length} рёбер ячейки ${DRY.spaceGroup}`)
