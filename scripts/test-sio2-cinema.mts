#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт сцены «атомный кристалл: Si (тв.) + O₂ (г.) → SiO₂ (тв.)».
 * Построен по образцу эталона (scripts/test-nacl-cinema.mts).
 *
 * Сцена проверяется ДАННЫМИ, а не строками: раскадровка — чистая функция sampleSio2Frame(t),
 * весь урок сэмплируется в Node, а каждое число сверяется с научным ядром src/chemistry/data.
 * Проверок «есть ли в тексте слово/литерал» здесь НЕТ: числа ИЗВЛЕКАЮТСЯ из текста и сверяются
 * с ядром, последовательности чисел ru / en / uz обязаны совпадать.
 *
 *   1. Хронометраж: 6 ± 1 шаг, каждый 4–7 экранных секунд, всего 26–34 с, cue лаборатории
 *      embryo → birth → complete строго после последнего шага.
 *   2. Раскадровка: дорожки монотонны, ни атом, ни камера не прыгают между кадрами 1/30 с.
 *   3. Геометрия ↔ ядро: ячейка Si (Fd-3m, Si–Si, КЧ 4, 12 рёбер длиной a), O=O, тетраэдр SiO₄
 *      (Si–O, ∠O–Si–O, ∠Si–O–Si), фрагмент α-кварца 2×2×2 (узлы, КЧ 4:2, только связи Si–O,
 *      рёбра a и c), радиусы Кордеро, спираль вокруг винтовой оси.
 *   4. Кадр встраивания: материал, валентные точки O (6 → 4), подпись O → Oᵟ⁻, связи — в один кадр;
 *      электронный счёт: у мостикового O точек = валентные − связи Si–O.
 *   5. На каждом шаге видимы только объекты этого шага; на паузе каждый видимый атом подписан.
 *   6. Финал без огня: FX = 0, свечение и bloom базовые, тряски нет, валентных точек нет.
 *   7. Энергия: лестница = ядро (ΔH°f(Si, г.), 2·ΔH°f(O, г.), 4·E(Si–O)), знаки, сумма ≈ ΔH°f.
 *   8. 3D-подписи: только формулы/числа/единицы-токены, числа — из ядра, запятая на ru/uz.
 *   9. Тексты: извлечённые числа ↔ ядро, привязка «число ↔ величина», синхронность ru/en/uz.
 *
 * Запуск: npx tsx scripts/test-sio2-cinema.mts
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  ATOMIC_DATA,
  bondAngleDeg,
  bondEnthalpyKJ,
  bondLengthPm,
  BOND_DATA,
  dHfKJ,
  formationReactionKJ,
  getCrystal,
  NATIVE_OXIDE_FILMS,
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
import { pmToScene, SPECIES_SCALE } from '../src/lab/cinema/scenes/kit/cpkAtoms.ts'
import { ladderLevels } from '../src/lab/cinema/scenes/kit/energyLadderData.ts'
import { assertSnapAt } from '../src/lab/cinema/scenes/kit/valence.ts'
import { coordinationShell } from '../src/lab/cinema/scenes/kit/lattice.ts'
import {
  BRIDGE_BONDS,
  GROWTH_ARRIVAL,
  HELIX_ATOMS,
  HELIX_SITES,
  QUARTZ_FRAG,
  QUARTZ_SITE_OF,
  SI_CELL_EDGES,
  SI_FRAG,
  SIO2_ATOM_INDEX,
  SIO2_ATOMS,
  SIO2_BONDS,
  SIO2_BREAKS,
  SIO2_CAMERA,
  SIO2_CUES,
  SIO2_EDGE_A,
  SIO2_END,
  SIO2_GEOM,
  SIO2_INSERTIONS,
  SIO2_LABELS,
  SIO2_SEGMENTS,
  SIO2_SNAP,
  SIO2_STEPS,
  SIO2_STEP_IDS,
  SIO2_TIMING,
  createSio2Frame,
  radiusCovalentPm,
  sampleSio2Frame,
  validateSio2Storyboard,
  type Sio2Frame,
} from '../src/lab/cinema/scenes/sio2/sio2Storyboard.ts'
import {
  SIO2_BOND_COMPARISON,
  SIO2_BONDS_PER_UNIT,
  SIO2_COST_KJ,
  SIO2_DHF_SUM_KJ,
  SIO2_DHF_TABLE_KJ,
  SIO2_HALF_REACTIONS,
  SIO2_LADDER,
  SIO2_O_PER_UNIT,
  SIO2_REACTION,
  SIO2_REACTION_DH_KJ,
  SIO2_RESIDUAL_KJ,
  sio2StageKJ,
  validateSio2Energetics,
} from '../src/lab/cinema/scenes/sio2/sio2Energetics.ts'
import { getSio2MechanismText, type Sio2Locale, type Sio2MechanismText } from '../src/lab/cinema/scenes/sio2/sio2MechanismText.ts'
import { sio2ScientificWatchdogMs } from '../src/lab/scientificSynthesis/sio2ScenarioTiming.ts'

const LOCALES: Sio2Locale[] = ['ru', 'en', 'uz']
const frame = createSio2Frame()
const at = (t: number): Sio2Frame => sampleSio2Frame(t, frame)
const idx = (id: string) => SIO2_ATOM_INDEX.get(id)!

let checks = 0
function ok(label: string, cond: boolean, detail = ''): void {
  assert.ok(cond, `${label}${detail ? ` — ${detail}` : ''}`)
  checks++
}
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol
const PM = pmToScene(1)
const toPm = (d: number) => d / PM
const angleDeg = (a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3) => {
  const u = a.clone().sub(c)
  const v = b.clone().sub(c)
  return (Math.acos(Math.max(-1, Math.min(1, u.dot(v) / (u.length() * v.length())))) * 180) / Math.PI
}

const SI = getCrystal('si')!
const QZ = getCrystal('quartz')!
const STEP_PAUSE = SIO2_STEPS.map((s) => s.to)
const LAST = SIO2_STEPS.length - 1
const SIO_LENGTHS = BOND_DATA['Si-O'].lengthsPm ?? []
const O_IDS = ['o0', 'o1', 'o2', 'o3']
const N_IDS = ['n0', 'n1', 'n2', 'n3']

// ─────────────────────────────────────────────────────────────────────────────
// 1. Хронометраж и контракт лаборатории
// ─────────────────────────────────────────────────────────────────────────────

SIO2_TIMING.validate()
ok('шагов 6 ± 1', SIO2_STEPS.length >= 5 && SIO2_STEPS.length <= 7, `${SIO2_STEPS.length}`)
ok('id шагов совпадают', SIO2_STEP_IDS.join(',') === SIO2_STEPS.map((s) => s.id).join(','))
const wall = storyWallDuration(SIO2_SEGMENTS)
ok('экранная длительность 26–34 с', wall >= 26 && wall <= 34, `${wall.toFixed(1)} с`)
ok('wallDuration kit = сумма сегментов', near(wall, SIO2_TIMING.wallDuration, 1e-9))
for (const s of SIO2_STEPS) ok(`шаг ${s.id}: 4–7 экранных секунд`, s.wall >= 4 && s.wall <= 7, `${s.wall}`)
const lastStepTo = SIO2_STEPS[LAST]!.to
for (const id of ['embryo', 'birth', 'complete']) {
  const c = SIO2_CUES.find((x) => x.id === id)!
  ok(`cue ${id} строго после последнего шага`, c.at > lastStepTo, `${c.at} ≤ ${lastStepTo}`)
}
for (const c of SIO2_CUES) {
  if (['embryo', 'birth', 'complete'].includes(c.id)) continue
  ok(`cue ${c.id} внутри шагов`, c.at > 0 && c.at < lastStepTo)
}
ok('complete совпадает с концом сюжета', SIO2_CUES.find((c) => c.id === 'complete')!.at === SIO2_END)
ok('watchdog лаборатории положителен', sio2ScientificWatchdogMs() > 0)
for (let i = 0; i < SIO2_STEPS.length; i++) {
  const s = SIO2_STEPS[i]!
  ok(`stepIndexAt(${s.id})`, SIO2_TIMING.stepIndexAt((s.from + s.to) / 2) === i)
}
ok('встраивания — внутри шага 3', SIO2_INSERTIONS.every((x) => x.at > SIO2_STEPS[2]!.from && x.at < SIO2_STEPS[2]!.to))
ok('разрывы O=O — внутри шага 2', [SIO2_BREAKS.a, SIO2_BREAKS.b].every((t) => t > SIO2_STEPS[1]!.from && t < SIO2_STEPS[1]!.to))

// ─────────────────────────────────────────────────────────────────────────────
// 2. Раскадровка: дорожки, рывки атомов и камеры, ноль аллокаций
// ─────────────────────────────────────────────────────────────────────────────

validateSio2Storyboard()
{
  const scratch = createSio2Frame()
  const buf = SIO2_ATOMS.map((a) => ({ id: a.id, pos: new THREE.Vector3(), opacity: 0 }))
  assertNoPositionJumps(
    (t) => {
      sampleSio2Frame(t, scratch)
      for (let i = 0; i < SIO2_ATOMS.length; i++) {
        buf[i]!.pos.copy(scratch.pos[i]!)
        buf[i]!.opacity = scratch.opacity[i]!
      }
      return buf
    },
    SIO2_END,
    0.09,
    1 / 30,
  )
  checks++
  const cam = createSceneCamera()
  assertCameraContinuity((t) => sampleShot(SIO2_CAMERA, t, cam), SIO2_END)
  checks++

  // Видимость не щёлкает: у растущих атомов каркаса — доля радиуса, у остальных — непрозрачность.
  const fullR = SIO2_ATOMS.map((a) => pmToScene(radiusCovalentPm(a.el)) * SPECIES_SCALE)
  const grows = (i: number) => SIO2_ATOMS[i]!.kind === 'vertex' || SIO2_ATOMS[i]!.kind === 'quartz'
  const presence = (i: number) => (grows(i) ? scratch.radius[i]! / fullR[i]! : scratch.opacity[i]!)
  let prev: Float32Array | null = null
  let worst = 0
  let worstT = 0
  for (let t = 0; t <= SIO2_END + 1e-9; t += 1 / 30) {
    sampleSio2Frame(t, scratch)
    const now = Float32Array.from(SIO2_ATOMS, (_, i) => presence(i))
    if (prev) {
      for (let i = 0; i < SIO2_ATOMS.length; i++) {
        const d = Math.abs(now[i]! - prev[i]!)
        if (d > worst) {
          worst = d
          worstT = t
        }
      }
    }
    prev = now
  }
  ok('видимость без скачков (≤ 0,12 за 1/30 с)', worst <= 0.12, `${worst.toFixed(3)} при t=${worstT.toFixed(2)}`)
  // Связи тоже появляются и гаснут плавно.
  let prevB: Float32Array | null = null
  let worstB = 0
  for (let t = 0; t <= SIO2_END + 1e-9; t += 1 / 30) {
    sampleSio2Frame(t, scratch)
    if (prevB) for (let s = 0; s < SIO2_BONDS.length; s++) worstB = Math.max(worstB, Math.abs(scratch.bond[s]! - prevB[s]!))
    prevB = scratch.bond.slice()
  }
  ok('связи без скачков (≤ 0,12 за 1/30 с)', worstB <= 0.12, worstB.toFixed(3))

  const posRefs = scratch.pos.slice()
  const labelRefs = scratch.labels.slice()
  const labelPos = scratch.labels.map((l) => l.pos)
  const bondRef = scratch.bond
  for (let t = 0; t <= SIO2_END; t += 0.5) sampleSio2Frame(t, scratch)
  ok('векторы позиций переиспользуются', scratch.pos.every((p, i) => p === posRefs[i]))
  ok('подписи переиспользуются', scratch.labels.every((l, i) => l === labelRefs[i] && l.pos === labelPos[i]))
  ok('буфер связей переиспользуется', scratch.bond === bondRef)
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Геометрия раскадровки ↔ ядро
// ─────────────────────────────────────────────────────────────────────────────

// 3.1 Радиусы — Кордеро (ковалентные) из ядра, одна доля на все атомы; ионных радиусов нет.
for (const el of ['Si', 'O', 'C'] as const) {
  ok(`${el}: ковалентный радиус Кордеро ядра`, radiusCovalentPm(el) === ATOMIC_DATA[el].covalentRadiusPm && radiusCovalentPm(el) === radiusForSpecies(el, 0, { model: 'covalent' }))
}
at(STEP_PAUSE[2]!)
ok('на экране r(Si)/r(O) = отношению Кордеро', near(frame.radius[idx('si0')]! / frame.radius[idx('o0')]!, radiusCovalentPm('Si') / radiusCovalentPm('O'), 1e-6))
ok('радиус Si — не ионный Si⁴⁺ Шеннона', !near(frame.radius[idx('si0')]!, pmToScene(radiusForSpecies('Si', 4, { cn: 4 })) * SPECIES_SCALE, 1e-3))

// 3.2 Шаг 1: ячейка кремния (Fd-3m) и молекулы O₂.
at(STEP_PAUSE[0]!)
{
  ok('ячейка Si: 18 атомов', SI_FRAG.sites.length === 18)
  const siIds = SIO2_ATOMS.filter((a) => a.kind === 'silicon' || a.id === 'si0' || N_IDS.includes(a.id)).map((a) => a.id)
  ok('все 18 атомов ячейки в кадре и видимы', siIds.length === 18 && siIds.every((id) => frame.opacity[idx(id)]! > 0.99))
  const siSi = SIO2_BONDS.filter((b) => b.group === 'siSi')
  ok('связей Si–Si в ячейке = связям фрагмента', siSi.length === SI_FRAG.bonds.length)
  for (const b of siSi) {
    const d = toPm(frame.pos[b.a]!.distanceTo(frame.pos[b.b]!))
    ok('связь Si–Si = bondLengthPm(Si-Si) = cationAnionPm ячейки (±0,1)', near(d, bondLengthPm('Si-Si'), 0.1) && near(d, SI.cationAnionPm, 0.1), d.toFixed(2))
    ok('связь Si–Si видна', frame.bond[SIO2_BONDS.indexOf(b)]! > 0.9)
  }
  const c = idx('si0')
  const nb = N_IDS.map((id) => frame.pos[idx(id)]!)
  ok('центральный Si: КЧ = coordination ядра', nb.length === SI.coordination.Si && nb.every((p) => near(toPm(p.distanceTo(frame.pos[c]!)), bondLengthPm('Si-Si'), 0.1)))
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) ok('связи центрального Si — тетраэдр (109,47°)', near(angleDeg(nb[i]!, frame.pos[c]!, nb[j]!), (Math.acos(-1 / 3) * 180) / Math.PI, 0.01))
  ok('рёбер ячейки Si 12', SI_CELL_EDGES.length === 12)
  for (const [p, q] of SI_CELL_EDGES) ok('ребро ячейки Si = a ядра (поворот сохраняет длины)', near(toPm(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])), SI.cellPm.a, 0.01))
  ok('рёбра ячейки кремния видны', frame.edgeSet === 'si' && frame.edges > 0.9)
  const m = SIO2_GEOM.rotation
  const det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  ok('поворот ячейки собственный (det = +1)', near(det, 1, 1e-9))
  ok('связи Si совмещены с вершинами тетраэдра кварца (ошибка < 5° на связь)', SIO2_GEOM.alignErrorRad / 4 < (5 * Math.PI) / 180, `${((SIO2_GEOM.alignErrorRad * 180) / Math.PI).toFixed(2)}°`)
  for (const [a, b] of [['o0', 'o1'], ['o2', 'o3']] as const) {
    ok(`O₂ ${a}–${b}: d = bondLengthPm(O=O)`, near(toPm(frame.pos[idx(a)]!.distanceTo(frame.pos[idx(b)]!)), bondLengthPm('O=O'), 1e-4))
    ok(`O₂ ${a}: газ`, frame.material[idx(a)] === 'gas')
  }
  ok('O=O — двойные связи, обе видны', SIO2_BONDS.filter((b) => b.group === 'oo').every((b) => b.kind === 'double' && frame.bond[SIO2_BONDS.indexOf(b)]! > 0.9))
  ok('Si ячейки — ковалентный материал', frame.material[idx('si0')] === 'covalent')
}

// 3.3 Пауза шага 3: тетраэдр SiO₄ с мостиками Si–O–Si — числа ядра.
at(STEP_PAUSE[2]!)
{
  const c = frame.pos[idx('si0')]!
  const os = O_IDS.map((id) => frame.pos[idx(id)]!)
  let sum = 0
  for (const o of os) {
    const d = toPm(o.distanceTo(c))
    sum += d
    ok('Si–O тетраэдра — одно из значений ядра (±0,1 пм)', SIO_LENGTHS.some((v) => near(d, v, 0.1)), d.toFixed(2))
  }
  ok('средняя Si–O = bondLengthPm(Si-O) (±0,1)', near(sum / 4, bondLengthPm('Si-O'), 0.1), (sum / 4).toFixed(2))
  let angSum = 0
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const a = angleDeg(os[i]!, c, os[j]!)
      angSum += a
      ok('∠O–Si–O в пределах 1,1° от среднего ядра (в кварце 108,8–110,5°)', near(a, bondAngleDeg('quartzOSiO'), 1.1), a.toFixed(2))
    }
  }
  ok('средний ∠O–Si–O = ядро (±0,1°)', near(angSum / 6, bondAngleDeg('quartzOSiO'), 0.1), (angSum / 6).toFixed(2))
  for (const b of SIO2_BONDS.filter((x) => x.group === 'story')) {
    ok('мостик: связь Si–O видна и длина из ядра', frame.bond[SIO2_BONDS.indexOf(b)]! > 0.99 && SIO_LENGTHS.some((v) => near(toPm(frame.pos[b.a]!.distanceTo(frame.pos[b.b]!)), v, 0.1)))
  }
  for (const id of O_IDS) {
    const o = frame.pos[idx(id)]!
    const pair = SIO2_BONDS.filter((b) => b.group === 'story' && b.b === idx(id)).map((b) => frame.pos[b.a]!)
    ok(`${id}: мостик между двумя Si`, pair.length === BRIDGE_BONDS)
    ok(`${id}: ∠Si–O–Si = ядро (±0,2°)`, near(angleDeg(pair[0]!, o, pair[1]!), bondAngleDeg('quartzSiOSi'), 0.2), angleDeg(pair[0]!, o, pair[1]!).toFixed(2))
  }
  ok('связи Si–Si центрального атома погашены', SIO2_BONDS.filter((b) => b.group === 'siSi' && b.k != null).every((b) => frame.bond[SIO2_BONDS.indexOf(b)] === 0))
  ok('сюжетные атомы — полярный каркас', ['si0', ...N_IDS, ...O_IDS].every((id) => frame.material[idx(id)] === 'polar'))
  ok('знаки δ: Si +, O −', frame.delta[idx('si0')] === 1 && O_IDS.every((id) => frame.delta[idx(id)] === -1))
  // Полярность по ядру: O электроотрицательнее Si.
  ok('χ(O) > χ(Si) — δ− на кислороде', ATOMIC_DATA.O.electronegativity > ATOMIC_DATA.Si.electronegativity)
}

// 3.4 Пауза шага 5: фрагмент α-кварца 2×2×2 из базиса ядра.
at(STEP_PAUSE[4]!)
{
  const vis = SIO2_ATOMS.map((a, i) => ({ a, i })).filter(({ a }) => QUARTZ_SITE_OF.has(a.id))
  ok('фрагмент — все узлы в кадре', vis.length === QUARTZ_FRAG.sites.length)
  ok('все узлы фрагмента видимы', vis.every(({ i }) => frame.opacity[i]! > 0.99))
  for (const { a, i } of vis) {
    const s = QUARTZ_FRAG.sites[QUARTZ_SITE_OF.get(a.id)!]!
    ok(`атом ${a.id} в своём узле`, frame.pos[i]!.distanceTo(new THREE.Vector3(...s.posScene)) < 1e-6)
    ok(`атом ${a.id}: элемент узла`, s.el === a.el)
    ok(`атом ${a.id}: радиус Кордеро × доля`, near(frame.radius[i]!, pmToScene(radiusCovalentPm(a.el)) * SPECIES_SCALE, 1e-6))
    ok(`атом ${a.id}: полярный материал`, frame.material[i] === 'polar')
  }
  // Ближайшие соседи — только атомы другого элемента; КЧ внутренних = coordination ядра.
  let interior = 0
  for (const { a, i } of vis) {
    const p = frame.pos[i]!
    let dmin = Infinity
    for (const { i: j } of vis) if (j !== i) dmin = Math.min(dmin, frame.pos[j]!.distanceTo(p))
    const closest = vis.filter(({ i: j }) => j !== i && frame.pos[j]!.distanceTo(p) < dmin + 1e-6)
    ok(`атом ${a.id}: ближайший сосед — другой элемент`, closest.every(({ a: b }) => b.el !== a.el))
    const bonded = SIO2_BONDS.filter((b) => (b.group === 'quartz' || b.group === 'story') && (b.a === i || b.b === i))
    const site = QUARTZ_FRAG.sites[QUARTZ_SITE_OF.get(a.id)!]!
    if (bonded.length === site.cn) interior++
    ok(`атом ${a.id}: КЧ узла = coordination ядра`, site.cn === QZ.coordination[a.el]!)
  }
  ok('есть узлы с полным окружением', interior > 10)
  for (const b of SIO2_BONDS.filter((x) => x.group === 'quartz' || x.group === 'story')) {
    ok('связь каркаса Si–O (A — Si, B — O)', SIO2_ATOMS[b.a]!.el === 'Si' && SIO2_ATOMS[b.b]!.el === 'O')
    ok('длина связи каркаса — значение ядра', SIO_LENGTHS.some((v) => near(toPm(frame.pos[b.a]!.distanceTo(frame.pos[b.b]!)), v, 0.1)))
    ok('связь каркаса видна', frame.bond[SIO2_BONDS.indexOf(b)]! > 0.99)
  }
  const q0 = SIO2_GEOM.q0
  const shell = coordinationShell(QUARTZ_FRAG, q0)
  ok('координационный многогранник Si — тетраэдр (4 соседа, 6 рёбер)', shell.neighbors.length === 4 && shell.edges.length === 6)
  ok('рёбер ячеек 54', QUARTZ_FRAG.cellEdges.length === 54)
  for (const [p, q] of QUARTZ_FRAG.cellEdges) {
    const d = toPm(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]))
    ok('ребро ячейки кварца = a или c ядра', near(d, QZ.cellPm.a, 0.01) || near(d, QZ.cellPm.c!, 0.01), d.toFixed(2))
  }
  ok('рёбра ячеек кварца видны', frame.edgeSet === 'quartz' && frame.edges > 0.9)
  const eA = toPm(Math.hypot(SIO2_EDGE_A[0][0] - SIO2_EDGE_A[1][0], SIO2_EDGE_A[0][1] - SIO2_EDGE_A[1][1], SIO2_EDGE_A[0][2] - SIO2_EDGE_A[1][2]))
  ok('подпись a стоит у ребра длиной a', near(eA, QZ.cellPm.a, 0.01))
  // Спираль: каждый шаг — Si–O–Si, подъём на c/3, через три шага — трансляция c.
  ok('спираль проходит через тетраэдр сюжета', HELIX_SITES.includes(q0) && HELIX_ATOMS.includes(idx('si0')))
  for (let k = 1; k < HELIX_ATOMS.length; k++) {
    const dy = toPm(frame.pos[HELIX_ATOMS[k]!]!.y - frame.pos[HELIX_ATOMS[k - 1]!]!.y)
    ok('спираль: подъём на c/3', near(dy, QZ.cellPm.c! / 3, 0.01), dy.toFixed(2))
  }
  for (let k = 3; k < HELIX_ATOMS.length; k++) {
    const d = toPm(frame.pos[HELIX_ATOMS[k]!]!.distanceTo(frame.pos[HELIX_ATOMS[k - 3]!]!))
    ok('спираль: через три звена — трансляция c', near(d, QZ.cellPm.c!, 0.01))
  }
  ok('спираль видна', frame.guides.helix > 0.9)
  ok('ячейки кремния и O₂ давно нет', SIO2_ATOMS.every((a, i) => a.kind !== 'silicon' || frame.opacity[i] === 0))
}

// 3.5 Шаг 4: CO₂ сравнения — линейная, C=O из ядра, двойные связи.
at(STEP_PAUSE[3]!)
{
  const c = frame.pos[idx('cC')]!
  const o1 = frame.pos[idx('cO1')]!
  const o2 = frame.pos[idx('cO2')]!
  ok('CO₂: d(C=O) = bondLengthPm(C=O(CO2))', near(toPm(c.distanceTo(o1)), bondLengthPm('C=O(CO2)'), 1e-4) && near(toPm(c.distanceTo(o2)), bondLengthPm('C=O(CO2)'), 1e-4))
  ok('CO₂: линейная (180°)', near(angleDeg(o1, c, o2), 180, 1e-6))
  ok('CO₂: две двойные связи видны', SIO2_BONDS.filter((b) => b.group === 'co2').every((b) => b.kind === 'double' && frame.bond[SIO2_BONDS.indexOf(b)]! > 0.99))
  ok('рёбра тетраэдра видны', frame.guides.tetra > 0.9)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Кадр встраивания: материал, точки, подписи, связи — в один кадр
// ─────────────────────────────────────────────────────────────────────────────

{
  const dt = 1 / 60
  const lbl = (id: string) => frame.labels.find((l) => l.id === id)!.text
  const O_VAL = ATOMIC_DATA.O.valenceElectrons
  for (let j = 0; j < 4; j++) assertSnapAt(SIO2_SNAP.valenceO[j]!, SIO2_SNAP.valenceO[j]![1]!.t, O_VAL, O_VAL - BRIDGE_BONDS)
  checks += 4
  for (let j = 0; j < 4; j++) {
    const id = O_IDS[j]!
    const tIns = SIO2_SNAP.polarO[j]![1]!.t
    ok(`${id}: момент встраивания — одно из SIO2_INSERTIONS`, SIO2_INSERTIONS.some((x) => x.at === tIns))
    at(tIns - dt)
    const b = { m: frame.material[idx(id)], n: frame.valence[j]!.count, l: lbl(id), d: frame.delta[idx(id)] }
    at(tIns)
    ok(`${id}: до встраивания — газ, 6 точек (O(³P)), подпись O`, b.m === 'gas' && b.n === O_VAL && b.l === 'O' && b.d === 0)
    ok(`${id}: в кадр встраивания — polar, δ−, подпись Oᵟ⁻`, frame.material[idx(id)] === 'polar' && frame.delta[idx(id)] === -1 && lbl(id) === 'Oᵟ⁻')
    ok(`${id}: в тот же кадр точек = валентные − связи Si–O`, frame.valence[j]!.count === O_VAL - BRIDGE_BONDS)
    // Электронный счёт: связь Si–Si (2 e⁻) + два неспаренных e⁻ кислорода = две связи Si–O (4 e⁻).
    ok(`${id}: электроны сходятся (2 + 2 = 2 × 2)`, 2 + (O_VAL - 4) === 2 * BRIDGE_BONDS)
  }
  for (let k = 0; k < 4; k++) {
    const tIns = SIO2_INSERTIONS[k]!.at
    at(tIns - dt)
    const before = frame.material[idx(N_IDS[k]!)]
    at(tIns)
    ok(`n${k}: сосед становится частью каркаса в кадр встраивания`, before === 'covalent' && frame.material[idx(N_IDS[k]!)] === 'polar')
    const sio = SIO2_BONDS.filter((b) => b.group === 'story' && b.k === k)
    ok(`связь ${k}: две связи Si–O начинаются в кадр встраивания`, sio.length === 2 && sio.every((b) => frame.bond[SIO2_BONDS.indexOf(b)] === 0))
    at(tIns + 0.6)
    ok(`связь ${k}: через 0,6 с связи Si–O видны, Si–Si погашена`, sio.every((b) => frame.bond[SIO2_BONDS.indexOf(b)]! > 0.99) && SIO2_BONDS.filter((b) => b.group === 'siSi' && b.k === k).every((b) => frame.bond[SIO2_BONDS.indexOf(b)] === 0))
  }
  at(SIO2_INSERTIONS[0]!.at - dt)
  const s0 = lbl('si0')
  at(SIO2_INSERTIONS[0]!.at)
  ok('центральный Si: Si → Siᵟ⁺ в кадр первого встраивания', s0 === 'Si' && lbl('si0') === 'Siᵟ⁺' && frame.material[idx('si0')] === 'polar')
  // Пауза шага 2 держит «до»: у атомов O шесть точек; пауза шага 3 — «после»: четыре.
  at(STEP_PAUSE[1]!)
  ok('пауза шага 2: у каждого O шесть валентных точек', frame.valence.every((v) => v.count === O_VAL && v.amount > 0.9))
  ok('пауза шага 2: O=O разорваны', SIO2_BONDS.filter((b) => b.group === 'oo').every((b) => frame.bond[SIO2_BONDS.indexOf(b)] === 0))
  at(STEP_PAUSE[2]!)
  ok('пауза шага 3: у каждого O четыре точки (две пары)', frame.valence.every((v) => v.count === O_VAL - BRIDGE_BONDS && v.amount > 0.9))
  // Атомы сохраняются: в сюжете один Si строит SiO₄/₂ — на формулу 1 Si и 2 O (4 O × ½).
  ok('в сюжете 4 O-мостика на один Si: 4 × ½ = SIO2_O_PER_UNIT', (O_IDS.length * 1) / BRIDGE_BONDS === SIO2_O_PER_UNIT)
  ok('связей Si–O на формульную единицу = КЧ Si ядра', SIO2_BONDS_PER_UNIT === QZ.coordination.Si)
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Только объекты текущего шага; на паузе каждый видимый атом подписан
// ─────────────────────────────────────────────────────────────────────────────

function hostSpan(hosts: readonly string[]): number {
  let m = 0
  for (const a of hosts) for (const b of hosts) m = Math.max(m, frame.pos[idx(a)]!.distanceTo(frame.pos[idx(b)]!))
  return m
}

for (let si = 0; si < SIO2_STEPS.length; si++) {
  const s = SIO2_STEPS[si]!
  let foreign = 0
  let at0 = -1
  for (let t = s.from; t <= s.to + 1e-9; t += 1 / 60) {
    at(t)
    for (let i = 0; i < SIO2_ATOMS.length; i++) {
      const [a, b] = SIO2_ATOMS[i]!.span
      if (!(si >= a && si <= b) && frame.opacity[i]! > 0) {
        foreign++
        if (at0 < 0) at0 = t
      }
    }
  }
  ok(`шаг ${s.id}: ни одного объекта чужого шага`, foreign === 0, `первый при t=${at0.toFixed(3)}`)

  at(s.to)
  const visibleLabels = frame.labels.map((l, k) => ({ st: l, def: SIO2_LABELS[k]! })).filter(({ st }) => st.opacity > 0.5)
  ok(`пауза ${s.id}: есть подписи`, visibleLabels.length > 0)
  for (let i = 0; i < SIO2_ATOMS.length; i++) {
    if (frame.opacity[i]! <= 0.02) continue
    const id = SIO2_ATOMS[i]!.id
    const hosts = visibleLabels.filter(({ def }) => def.hosts.includes(id))
    const closeHost = hosts.some(({ st, def }) => st.pos.distanceTo(frame.pos[i]!) <= hostSpan(def.hosts) + 1)
    ok(`пауза ${s.id}: атом ${id} подписан`, closeHost, `хозяев ${hosts.length}`)
    ok(`пауза ${s.id}: атом ${id} полностью проявлен`, frame.opacity[i]! > 0.99, frame.opacity[i]!.toFixed(3))
  }
  for (const { st, def } of visibleLabels) {
    if (def.hosts.length === 0) continue
    ok(`пауза ${s.id}: подпись ${def.id} подписывает видимые атомы`, def.hosts.some((h) => frame.opacity[idx(h)]! > 0.5), st.text)
  }
  // Связь видна только между видимыми атомами.
  for (let b = 0; b < SIO2_BONDS.length; b++) {
    const bd = SIO2_BONDS[b]!
    if (frame.bond[b]! > 0.01) ok(`пауза ${s.id}: связь ${b} между видимыми атомами`, frame.opacity[bd.a]! > 0.5 && frame.opacity[bd.b]! > 0.5)
  }
}
at(STEP_PAUSE[1]!)
ok('после шага 2 остального кремния нет', SIO2_ATOMS.every((a, i) => a.kind !== 'silicon' || frame.opacity[i] === 0))
{
  const lbl = (id: string) => frame.labels.find((l) => l.id === id)!.opacity
  at(STEP_PAUSE[3]!)
  ok('пауза шага 4: CO₂ и его подписи видны, каркаса кварца нет', lbl('co2') > 0.9 && lbl('co2Double') > 0.9 && lbl('quartz') === 0)
  at(STEP_PAUSE[4]!)
  ok('пауза шага 5: CO₂ и его подписей нет', lbl('co2') === 0 && lbl('co2Double') === 0 && ['cC', 'cO1', 'cO2'].every((id) => frame.opacity[idx(id)] === 0))
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Финал без огня: все FX = 0 на всём шаге 6
// ─────────────────────────────────────────────────────────────────────────────

{
  const s = SIO2_STEPS[LAST]!
  at(SIO2_STEPS[0]!.from + 0.01)
  const baseEmissive = frame.emissive[0]!
  const baseBloom = frame.camera.bloom
  for (let t = s.from; t <= s.to + 1e-9; t += 1 / 30) {
    at(t)
    const fx = frame.fx.glow + frame.valence.reduce((m, v) => m + v.amount, 0)
    ok(`шаг 6, t=${t.toFixed(2)}: FX-амплитуды = 0`, fx === 0, `${fx}`)
    let hot = 0
    for (let i = 0; i < SIO2_ATOMS.length; i++) if (frame.emissive[i] !== baseEmissive) hot++
    ok(`шаг 6, t=${t.toFixed(2)}: свечение атомов базовое`, hot === 0, `${hot}`)
    ok(`шаг 6, t=${t.toFixed(2)}: bloom базовый, тряски нет`, near(frame.camera.bloom, baseBloom) && frame.camera.shake === 0)
  }
  at(s.to)
  ok('конец шага 6: каркас цел и виден', QUARTZ_FRAG.sites.length === SIO2_ATOMS.filter((a, i) => QUARTZ_SITE_OF.has(a.id) && frame.opacity[i]! > 0.99).length)
  ok('конец шага 6: выделенный тетраэдр виден', frame.guides.tetra > 0.9 && frame.labels.find((l) => l.id === 'sio4')!.opacity > 0.9)
  at(SIO2_END)
  ok('в конце хвоста кадр затемнён', frame.fade > 0.95)
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Энергетика: лестница = ядро
// ─────────────────────────────────────────────────────────────────────────────

validateSio2Energetics()
{
  ok('ступеней три', SIO2_LADDER.stages.length === 3)
  ok('атомизация = ΔH°f(Si, г.) ядра', sio2StageKJ('atomization') === dHfKJ('Si(g)'))
  ok('диссоциация = 2 × ΔH°f(O, г.) ядра', near(sio2StageKJ('dissociation'), 2 * dHfKJ('O(g)'), 1e-9))
  ok('связи = −4 × E(Si–O) ядра', near(sio2StageKJ('bonds'), -4 * bondEnthalpyKJ('Si-O'), 1e-9))
  const byId = Object.fromEntries(SIO2_LADDER.stages.map((s) => [s.id, s]))
  ok('множители: 2 O, 4 связи Si–O', byId.dissociation!.multiplier === SIO2_O_PER_UNIT && byId.bonds!.multiplier === SIO2_BONDS_PER_UNIT)
  ok('perUnit = числа ядра', byId.dissociation!.perUnitKJ === dHfKJ('O(g)') && byId.bonds!.perUnitKJ === -bondEnthalpyKJ('Si-O') && byId.atomization!.perUnitKJ === dHfKJ('Si(g)'))
  for (const st of SIO2_LADDER.stages) ok(`ступень ${st.id}: dH = множитель × perUnit`, near((st.multiplier ?? 1) * st.perUnitKJ!, st.dH, 1e-9))
  ok('знаки: атомизация > 0, диссоциация > 0, связи < 0', sio2StageKJ('atomization') > 0 && sio2StageKJ('dissociation') > 0 && sio2StageKJ('bonds') < 0)
  ok('таблица лестницы = ΔH°f(SiO₂) ядра', SIO2_DHF_TABLE_KJ === dHfKJ('SiO2(s)'))
  ok('ΔH уравнения = formationReactionKJ(sio2_formation) = ΔH°f', SIO2_REACTION_DH_KJ === formationReactionKJ('sio2_formation') && near(SIO2_REACTION_DH_KJ, dHfKJ('SiO2(s)'), 1e-9))
  ok('Σ цикла ≈ ΔH°f (±0,15 — округление E(Si–O))', near(SIO2_LADDER.sumKJ, dHfKJ('SiO2(s)'), 0.15), `${SIO2_LADDER.sumKJ}`)
  ok('расхождение названо числом и > 0', SIO2_RESIDUAL_KJ > 0 && near(SIO2_RESIDUAL_KJ, Math.abs(SIO2_LADDER.sumKJ - dHfKJ('SiO2(s)')), 0.05))
  const levels = ladderLevels(SIO2_LADDER)
  ok('последний уровень = сумма цикла', near(levels[levels.length - 1]!, SIO2_LADDER.sumKJ))
  ok('ступени идут по времени сюжета и внутри шагов', SIO2_LADDER.stages.every((s, i) => s.at > 0 && s.at < lastStepTo && (i === 0 || s.at >= SIO2_LADDER.stages[i - 1]!.at)))
  // E(Si–O) в ядре выведена из атомизации кварца — сверим независимо.
  const atomization = dHfKJ('Si(g)') + 2 * dHfKJ('O(g)') - dHfKJ('SiO2(s)')
  ok('4·E(Si–O) ≈ атомизация кварца (±0,5)', near(4 * bondEnthalpyKJ('Si-O'), atomization, 0.5))
}
{
  const count = (formula: string, coeff: number, into: Map<string, number>) => {
    for (const m of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) into.set(m[1]!, (into.get(m[1]!) ?? 0) + (m[2] ? Number(m[2]) : 1) * coeff)
  }
  const left = new Map<string, number>()
  const right = new Map<string, number>()
  for (const t of SIO2_REACTION.left) count(t.formula, t.coeff, left)
  for (const t of SIO2_REACTION.right) count(t.formula, t.coeff, right)
  for (const k of new Set([...left.keys(), ...right.keys()])) ok(`баланс по ${k}`, left.get(k) === right.get(k))
  ok('кислород — двухатомная молекула', SIO2_REACTION.left.some((t) => t.formula === 'O2') && !SIO2_REACTION.left.some((t) => t.formula === 'O'))
  const given = SIO2_HALF_REACTIONS.filter((h) => h.id === 'oxidation').reduce((s, h) => s + h.electrons * h.times, 0)
  const taken = SIO2_HALF_REACTIONS.filter((h) => h.id === 'reduction').reduce((s, h) => s + h.electrons * h.times, 0)
  ok('формальный электронный баланс', given === taken)
  ok('сумма степеней окисления: 0 → 0', SIO2_HALF_REACTIONS.reduce((s, h) => s + h.oxLeft, 0) === 0 && SIO2_HALF_REACTIONS.reduce((s, h) => s + h.oxRight, 0) === 0)
  // Атомы сюжета: 2 O₂ = 4 O — все четыре встроились.
  ok('в сюжете две молекулы O₂ — четыре атома O', SIO2_ATOMS.filter((a) => a.kind === 'story' && a.el === 'O').length === 4 && SIO2_BONDS.filter((b) => b.group === 'oo').length === 2)
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

const C = SIO2_BOND_COMPARISON
{
  const allowed3d = [
    SI.cellPm.a,
    bondLengthPm('Si-Si'),
    bondLengthPm('O=O'),
    ...SIO_LENGTHS,
    bondAngleDeg('quartzOSiO'),
    bondAngleDeg('quartzSiOSi'),
    C.fourSiO,
    C.twoCdoubleO,
    C.fourCO,
    QZ.cellPm.a,
    QZ.cellPm.c!,
    dHfKJ('SiO2(s)'),
    ...Object.values(SI.coordination),
    ...Object.values(QZ.coordination),
  ]
  const groups = [SI.spaceGroup, QZ.spaceGroup]
  const counts = new Set([SIO2_BONDS_PER_UNIT, 2, 3]) // «4 Si–O», «2 C=O», «3₂»
  for (const l of SIO2_LABELS) {
    for (const k of l.keys) {
      const bare = k.text.replace(/\{\w+\}/g, '')
      ok(`подпись ${l.id}: без кириллицы (слова — в панели)`, !/[А-Яа-яЁё]/.test(bare), k.text)
      ok(`подпись ${l.id}: без фраз`, !/[a-z]{3,}/.test(bare), k.text)
      ok(`подпись ${l.id}: единицы только токенами`, !/\b(pm|nm|kJ\/mol|kJ)\b/.test(bare) && !/\((s|g|l|aq)\)/.test(bare), k.text)
      let rest = bare
      for (const g of groups) if (rest.includes(g)) {
        ok(`подпись ${l.id}: группа из ядра`, rest.trim() === g)
        rest = rest.replace(g, '')
      }
      for (const n of numbers(rest)) {
        const isCount = n.dec === 0 && counts.has(n.v) && !allowed3d.includes(n.v)
        ok(`подпись ${l.id}: число ${n.raw} из ядра`, isCount || allowed3d.some((v) => matches(n, v)), k.text)
      }
    }
  }
  const text = (id: string) => SIO2_LABELS.find((l) => l.id === id)!.keys[0]!.text
  ok('подпись Si–Si = bondLengthPm', hasValue(text('siBond'), bondLengthPm('Si-Si')) && numbers(text('siBond')).length === 1)
  ok('подпись O=O = bondLengthPm (две десятых — r_e)', hasValue(text('ooBond'), bondLengthPm('O=O')) && numbers(text('ooBond'))[0]!.dec === 2)
  ok('подпись Si–O — одно из значений ядра', SIO_LENGTHS.some((v) => hasValue(text('sio'), v)))
  ok('подписи углов = ядро', hasValue(text('angOSiO'), bondAngleDeg('quartzOSiO')) && hasValue(text('angSiOSi'), bondAngleDeg('quartzSiOSi')))
  ok('подпись 4 Si–O = 4·E(Si–O)', hasValue(text('sum4'), 4 * bondEnthalpyKJ('Si-O')))
  ok('подпись 2 C=O = 2·E(C=O в CO₂)', hasValue(text('co2Double'), 2 * bondEnthalpyKJ('C=O(CO2)')))
  ok('подпись 4 C–O = 4·E(C–O)', hasValue(text('co2Single'), 4 * bondEnthalpyKJ('C-O')))
  ok('подпись a кварца / ячейки Si = ядро', hasValue(text('qA'), QZ.cellPm.a) && hasValue(text('qC'), QZ.cellPm.c!) && hasValue(text('siA'), SI.cellPm.a))
  const dH = numbers(text('dH'))[0]!
  ok('подпись ΔH°f = табличная, со знаком минус', dH.sign === -1 && matches(dH, dHfKJ('SiO2(s)')))
  ok('δ-подписи — частичные заряды, не ионы', !SIO2_LABELS.some((l) => l.keys.some((k) => /Si⁴⁺|O²⁻/.test(k.text))))

  const known = new Set(Object.keys(SCENE_LABEL_TOKENS.ru))
  for (const token of labelTokensUsed(SIO2_LABELS)) ok(`токен {${token}} есть в словаре`, known.has(token))
  for (const locale of LOCALES) {
    const states = createLabelStates(SIO2_LABELS)
    localizeSceneLabels(states, locale)
    for (const st of states) ok(`[${locale}] подпись ${st.id} раскрыта`, !/\{\w+\}/.test(st.text) && st.text.trim().length > 0)
  }
  const ru = createLabelStates(SIO2_LABELS)
  const en = createLabelStates(SIO2_LABELS)
  localizeSceneLabels(ru, 'ru')
  localizeSceneLabels(en, 'en')
  ok('подписи ru отличаются от en (единицы переведены)', ru.some((s, i) => s.text !== en[i]!.text))
  for (const locale of ['ru', 'uz'] as const) {
    const st = createLabelStates(SIO2_LABELS)
    localizeSceneLabels(st, locale, true)
    const g = st.find((x) => x.id === 'siBond')!.text
    ok(`[${locale}] 3D-число с десятичной запятой: «${g}»`, g.includes(String(bondLengthPm('Si-Si')).replace('.', ',')) && !/\d\.\d/.test(st.map((x) => x.text).join(' ')))
  }
  for (const l of SIO2_LABELS) for (const w of l.windows) ok(`окно подписи ${l.id}`, w[0] < w[1] && w[0] >= 0 && w[1] <= SIO2_END + 1e-9)
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Тексты урока: числа ↔ ядро, привязка, синхронность языков
// ─────────────────────────────────────────────────────────────────────────────

const FILM = NATIVE_OXIDE_FILMS.si
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d
const chiSi = ATOMIC_DATA.Si.electronegativity
const chiO = ATOMIC_DATA.O.electronegativity
/** Внешние константы, которых нет в ядре: стандартные условия 25 °C. */
const EXTERNAL = [25]

const CORE_VALUES: number[] = [
  SI.cellPm.a,
  SI.cellPm.a / 1000, // ячейка в нм — рядом с толщиной плёнки
  bondLengthPm('Si-Si'),
  bondLengthPm('O=O'),
  radiusCovalentPm('Si'),
  radiusCovalentPm('O'),
  SPECIES_SCALE,
  dHfKJ('O(g)'),
  2 * dHfKJ('O(g)'),
  dHfKJ('Si(g)'),
  bondLengthPm('Si-O'),
  ...SIO_LENGTHS,
  chiO,
  chiSi,
  round(chiO - chiSi, 2),
  C.siOoverSiSi,
  C.siO,
  C.siSi,
  bondAngleDeg('quartzOSiO'),
  bondAngleDeg('quartzSiOSi'),
  C.cDoubleO,
  C.twoCdoubleO,
  C.cO,
  C.fourCO,
  C.fourSiO,
  QZ.cellPm.a,
  QZ.cellPm.c!,
  QZ.densityGCm3,
  QUARTZ_FRAG.sites.length,
  SIO2_LADDER.sumKJ,
  dHfKJ('SiO2(s)'),
  SIO2_COST_KJ,
  SIO2_RESIDUAL_KJ,
  FILM.min,
  FILM.max,
  ...EXTERNAL,
]
ok('плёнка на Si в ядре — нм, и толще ячейки', FILM.unit === 'нм' && FILM.min > SI.cellPm.a / 1000)
ok('χ(O) − χ(Si) в ядре', near(round(chiO - chiSi, 2), 1.54, 1e-9) || chiO - chiSi > 0)
ok('Si–O прочнее Si–Si (отношение из ядра > 1)', C.siOoverSiSi > 1)
ok('у углерода 2 C=O > 4 C–O, у кремния 4 Si–O > 2 C=O (данные ядра)', C.twoCdoubleO > C.fourCO && C.fourSiO > C.twoCdoubleO)

/** Малые целые — счёт (4 соседа, 2 O, Z = 3, 3p, ×4, 1–2 нм). */
const isCount = (n: Num) => n.dec === 0 && n.v <= 12

const fields = (t: Sio2MechanismText): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const id of SIO2_STEP_IDS) {
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
const strip = (s: string) => s.replaceAll(SI.spaceGroup, '').replaceAll(QZ.spaceGroup, '')

const numbersByField: Record<Sio2Locale, Record<string, string>> = { ru: {}, en: {}, uz: {} }
for (const locale of LOCALES) {
  const t = getSio2MechanismText(locale)
  ok(`[${locale}] заголовок и безопасность`, t.intro.title.length > 0 && t.safety.length > 20)
  for (const id of SIO2_STEP_IDS) {
    const s = t.steps[id]
    ok(`[${locale}] ${id}: заголовок, уравнение, реплика`, s.title.trim().length > 0 && s.equation.trim().length > 0 && s.speak.trim().length > 0)
    ok(`[${locale}] ${id}: не меньше двух предложений`, s.body.split(/[.!?]\s/).length >= 2)
    ok(`[${locale}] ${id}: есть note (всё схематичное названо)`, (s.note ?? '').length > 0)
  }
  ok(`[${locale}] aria-подпись лестницы`, t.energy.summary.includes('{dH}'))
  ok(`[${locale}] подписи лестницы для всех ступеней`, SIO2_LADDER.stages.every((s) => (t.energy.stages as Record<string, string>)[s.id]!.length > 0))

  const f = fields(t)
  for (const [key, s] of Object.entries(f)) {
    for (const n of numbers(strip(s))) {
      if (isCount(n)) continue
      ok(`[${locale}] ${key}: число ${n.raw.trim()} есть в ядре`, CORE_VALUES.some((v) => matches(n, v)), s.slice(0, 80))
    }
    numbersByField[locale][key] = numbers(strip(s))
      .map((n) => n.v)
      .join(' ')
  }

  // Сумма цикла в тексте: слагаемые = ступени ядра по порядку, итог = сумма, рядом — табличная ΔH°f.
  {
    const body = t.steps.energy.body
    const eq = body.indexOf('=')
    const terms = [...body.slice(0, eq).matchAll(/([+−-])\s?(\d+[.,]\d+)/g)].map((m) => (m[1] === '+' ? 1 : -1) * Number(m[2]!.replace(',', '.')))
    const tail = [...body.slice(eq).matchAll(/([+−-])\s?(\d+[.,]\d+)/g)].map((m) => (m[1] === '+' ? 1 : -1) * Number(m[2]!.replace(',', '.')))
    const cycle = SIO2_LADDER.stages.map((s) => s.dH)
    ok(`[${locale}] сумма в тексте: слагаемые = ступени ядра`, terms.length === cycle.length && terms.every((v, i) => near(v, cycle[i]!, 0.05)), terms.join(' '))
    ok(`[${locale}] сумма в тексте сходится арифметически`, near(terms.reduce((s, v) => s + v, 0), tail[0]!, 0.05))
    ok(`[${locale}] итог суммы = Σ ядра, следом — табличная ΔH°f`, near(tail[0]!, SIO2_DHF_SUM_KJ, 0.05) && near(tail[1]!, dHfKJ('SiO2(s)'), 0.05))
    const eqn = numbers(t.steps.energy.equation).find((n) => n.dec > 0)!
    ok(`[${locale}] ΔH уравнения = ΔH°f со знаком минус`, eqn.sign === -1 && matches(eqn, SIO2_REACTION_DH_KJ))
  }
  // Толщина плёнки — диапазон ядра «min–max нм» в шаге 2 (тело и note).
  for (const key of ['surface.body', 'surface.note']) {
    const m = /(\d+)[–-](\d+)\s?(нм|nm)/.exec(f[key]!)
    ok(`[${locale}] ${key}: плёнка = NATIVE_OXIDE_FILMS.si`, m != null && Number(m[1]) === FILM.min && Number(m[2]) === FILM.max)
  }
  // Счётные величины — по шаблонам, из ядра: Z, КЧ, число ячеек фрагмента.
  const z = /Z = (\d+)/.exec(f['quartz.body']!)
  ok(`[${locale}] Z в тексте = QZ.z`, z != null && Number(z[1]) === QZ.z)
  const cn = /(\d+):(\d+)/.exec(f['quartz.body']!)
  ok(`[${locale}] КЧ в тексте = QZ.coordination`, cn != null && Number(cn[1]) === QZ.coordination.Si && Number(cn[2]) === QZ.coordination.O)
  const cells = /(\d)×(\d)×(\d)/.exec(f['quartz.note']!)
  ok(`[${locale}] фрагмент в тексте = QUARTZ_FRAG.cells`, cells != null && [1, 2, 3].every((i) => Number(cells[i]) === QUARTZ_FRAG.cells[i - 1]))
  // Сравнение связей: «k × E = сумма» — множитель и слагаемое из ядра, сумма пересчитывается.
  for (const m of f['tetrahedra.body']!.matchAll(/(\d) × (\d+(?:[.,]\d+)?) = (\d+(?:[.,]\d+)?)/g)) {
    const k = Number(m[1])
    const e = Number(m[2]!.replace(',', '.'))
    const total = Number(m[3]!.replace(',', '.'))
    ok(`[${locale}] ${m[0]}: арифметика`, near(k * e, total, 0.05))
    ok(`[${locale}] ${m[0]}: энергия связи из ядра`, [C.cDoubleO, C.cO, C.siO].includes(e))
  }
  ok(`[${locale}] три произведения энергий связей в шаге 4`, [...f['tetrahedra.body']!.matchAll(/(\d) × (\d+(?:[.,]\d+)?) = /g)].length === 3)
  // Диссоциация: 2 × ΔH°f(O, г.) = ступень.
  const dis = /(\d) × (\d+[.,]\d+) = (\d+[.,]\d+)/.exec(f['surface.body']!)
  ok(`[${locale}] шаг 2: 2 × ΔH°f(O) = ступень ядра`, dis != null && Number(dis[1]) === SIO2_O_PER_UNIT && near(Number(dis[2]!.replace(',', '.')), dHfKJ('O(g)'), 1e-9) && near(Number(dis[3]!.replace(',', '.')), sio2StageKJ('dissociation'), 0.05))
}

// ─── Привязка «число ↔ величина»: ТО число на ТОМ месте (порядок ru) ───
{
  const ru = fields(getSio2MechanismText('ru'))
  const expect: Record<string, number[]> = {
    'reactants.body': [SI.cellPm.a, bondLengthPm('Si-Si'), bondLengthPm('O=O'), 25],
    'reactants.note': [radiusCovalentPm('Si'), radiusCovalentPm('O'), SPECIES_SCALE],
    'surface.body': [25, dHfKJ('O(g)'), 2 * dHfKJ('O(g)')],
    'surface.note': [SI.cellPm.a / 1000],
    'insertion.body': [bondLengthPm('Si-O'), ...SIO_LENGTHS, chiO, chiSi, round(chiO - chiSi, 2), C.siOoverSiSi, C.siO, C.siSi],
    'tetrahedra.body': [bondAngleDeg('quartzOSiO'), bondAngleDeg('quartzSiOSi'), C.cDoubleO, C.twoCdoubleO, C.cO, C.fourCO, C.siO, C.fourSiO],
    'quartz.body': [25, QZ.cellPm.a, QZ.cellPm.c!, QZ.densityGCm3],
    'quartz.note': [QUARTZ_FRAG.sites.length],
    'energy.body': [dHfKJ('Si(g)'), 2 * dHfKJ('O(g)'), C.fourSiO, Math.abs(SIO2_LADDER.sumKJ), Math.abs(dHfKJ('SiO2(s)')), SIO2_COST_KJ],
    'energy.note': [dHfKJ('Si(g)'), SIO2_RESIDUAL_KJ, C.siO, SPECIES_SCALE],
    'energy.equation': [Math.abs(dHfKJ('SiO2(s)'))],
  }
  for (const [key, want] of Object.entries(expect)) {
    const got = numbers(strip(ru[key]!)).filter((n) => !isCount(n))
    ok(`[ru] ${key}: числа стоят на своих местах`, got.length === want.length && got.every((n, i) => matches(n, want[i]!)), `${got.map((n) => n.v).join(' ')} | ожидалось ${want.map((v) => v.toFixed(2)).join(' ')}`)
  }
}

// ru / en / uz: последовательность чисел каждого поля совпадает (порядок = привязка).
for (const key of Object.keys(numbersByField.ru)) {
  ok(`числа поля ${key} совпадают в ru/en`, numbersByField.ru[key] === numbersByField.en[key], `${numbersByField.ru[key]} | ${numbersByField.en[key]}`)
  ok(`числа поля ${key} совпадают в ru/uz`, numbersByField.ru[key] === numbersByField.uz[key], `${numbersByField.ru[key]} | ${numbersByField.uz[key]}`)
}
// Рост каркаса: у каждого растущего атома есть время прибытия внутри своего span.
for (const a of SIO2_ATOMS) {
  const g = GROWTH_ARRIVAL.get(a.id)
  if (!g) continue
  const [s0, s1] = a.span
  ok(`рост ${a.id} внутри своих шагов`, g.start >= SIO2_STEPS[s0]!.from && g.arrive <= SIO2_STEPS[s1]!.to)
}

console.log(`✓ sio2 cinema: ${checks} проверок пройдено`)
console.log(`  шагов ${SIO2_STEPS.length}, экранное время ${wall.toFixed(1)} с (${SIO2_STEPS.map((s) => s.wall).join(' + ')} + хвост), сюжет ${SIO2_END} с`)
console.log(`  цикл Гесса: ${SIO2_LADDER.stages.map((s) => s.dH).join(' / ')} → Σ = ${SIO2_LADDER.sumKJ} кДж/моль (таблица ${SIO2_DHF_TABLE_KJ}, расхождение ${SIO2_RESIDUAL_KJ})`)
console.log(`  связи: 4 Si–O = ${C.fourSiO}; 2 C=O = ${C.twoCdoubleO} против 4 C–O = ${C.fourCO}; Si–O / Si–Si = ${C.siOoverSiSi}`)
console.log(`  кварц: ${QUARTZ_FRAG.sites.length} атомов, ${QUARTZ_FRAG.cellEdges.length} рёбер, ${QZ.spaceGroup}, КЧ ${Object.values(QZ.coordination).join(':')}; спираль ${HELIX_ATOMS.length} Si`)
