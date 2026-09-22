#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт сцены «контактный способ: 2 SO₂ (г.) + O₂ (г.) ⇌ 2 SO₃ (г.) на V₂O₅».
 * Построен по образцу эталона scripts/test-nacl-cinema.mts.
 *
 * Сцена проверяется ДАННЫМИ, а не строками: раскадровка — чистая функция sampleSo3Frame(t),
 * весь урок сэмплируется в Node, а каждое число сверяется с научным ядром src/chemistry/data.
 * Проверок «есть ли в тексте слово/литерал» здесь НЕТ: числа ИЗВЛЕКАЮТСЯ из текста и сверяются
 * с ядром, последовательности чисел ru / en / uz обязаны совпадать.
 *
 *   1. Хронометраж: 6 ± 1 шаг, каждый 4–7 экранных секунд, всего 26–34 с, cue лаборатории
 *      embryo → birth → complete строго после последнего шага.
 *   2. Раскадровка: дорожки монотонны, ни атом, ни камера не прыгают между кадрами 1/30 с.
 *   3. Геометрия ↔ ядро: SO₂ (S=O, угол), O₂ (O=O), SO₃ — плоский треугольник D₃h через
 *      writeTrigonalPlanar (S=O(SO₃), 120°, μ = 0), тример S₃O₉ (REAGENT_GEOMETRY.s3o9), радиусы.
 *   4. Кадр переноса атома O: S⁺⁴ → S⁺⁶, материал, подписи SO₂ → SO₃ и V₂O₅ → V₂O₄ — в один кадр;
 *      возврат O: V₂O₄ → V₂O₅; электронный баланс «сера ↔ катализатор ↔ O₂» каждые 1/60 с.
 *   5. На каждом шаге видимы только объекты этого шага; на паузе каждый видимый атом подписан.
 *   6. Финал без огня: FX (сетка катализатора) = 0, свечение и bloom базовые.
 *   7. Энергия: лестница = formationReactionKJ стадий × 2, сумма = so3_contact, знаки.
 *   8. 3D-подписи: только формулы/числа/единицы-токены, числа — из ядра.
 *   9. Тексты: извлечённые числа ↔ ядро, привязка к величинам (по единице, по порядку, по форме
 *      γ/β/α, степени окисления — sulfurOxidationState), синхронность ru/en/uz; числа вне ядра —
 *      только оговорённые внешние константы с источниками (EXT), 98 % — из note ядра so3_hydration.
 *  10. Приёмка профессора: нет «роста атомов из точки», O катализатора — радиус ядра, кратность
 *      рисунка против длин названа, тип геометрии (rₑ) в тексте = тип в ядре.
 *
 * Запуск: npx tsx scripts/test-so3-cinema.mts
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  ATOMIC_DATA,
  BOND_ANGLES,
  BOND_DATA,
  FORMATION_REACTIONS,
  bondAngleDeg,
  bondLengthPm,
  covalentRadiusPm,
  dHfKJ,
  dipoleDebye,
  formationReactionKJ,
  REACTION_STEP_CHAINS,
  REAGENT_GEOMETRY,
  radiusForSpecies,
  reagentBondPm,
} from '../src/chemistry/data/index.ts'
import { storyWallDuration } from '../src/lab/cinema/core/storyTime.ts'
import { measureAngle, TETRAHEDRAL_ANGLE_DEG, writeTrigonalPlanar } from '../src/lab/cinema/core/vsepr.ts'
import { assertCameraContinuity, sampleShot } from '../src/lab/cinema/scenes/kit/camera.ts'
import {
  assertNoPositionJumps,
  createLabelStates,
  createSceneCamera,
  labelTokensUsed,
  localizeSceneLabels,
  SCENE_LABEL_TOKENS,
} from '../src/lab/cinema/scenes/kit/sceneKit.ts'
import { bondLength, pmToScene, speciesRadius, speciesRadiusPm } from '../src/lab/cinema/scenes/kit/cpkAtoms.ts'
import { ladderLevels } from '../src/lab/cinema/scenes/kit/energyLadderData.ts'
import { assertSnapAt } from '../src/lab/cinema/scenes/kit/valence.ts'
import {
  createSo3Frame,
  sampleSo3Frame,
  SO3_ATOM_INDEX,
  SO3_ATOMS,
  SO3_BOND_SLOTS,
  SO3_BONDS,
  SO3_CAMERA,
  SO3_CUES,
  SO3_END,
  SO3_GEOM,
  SO3_LABELS,
  SO3_SEGMENTS,
  SO3_SITES,
  SO3_SNAP,
  SO3_STEPS,
  SO3_STEP_IDS,
  SO3_TIMING,
  SO3_TRANSFERS,
  SO3_TRIMER_POS,
  SO3_YAW_A,
  validateSo3Storyboard,
  type So3Frame,
} from '../src/lab/cinema/scenes/so3/so3Storyboard.ts'
import {
  SO2_DHF_KJ,
  SO3_CHAIN,
  SO3_DH_PER_MOL_KJ,
  SO3_DHF_KJ,
  SO3_FACTS,
  SO3_HALF_REACTIONS,
  SO3_HYDRATION_KJ,
  SO3_LADDER,
  SO3_REACTION,
  SO3_REACTION_DH_KJ,
  SO3_STAGE_MULTIPLIER,
  SO3_STAGE_REACTIONS,
  so3StageKJ,
  sulfurOxidationState,
  validateSo3Energetics,
} from '../src/lab/cinema/scenes/so3/so3Energetics.ts'
import { getSo3MechanismText, type So3Locale, type So3MechanismText } from '../src/lab/cinema/scenes/so3/so3MechanismText.ts'
import { so3ScientificWatchdogMs } from '../src/lab/scientificSynthesis/so3ScenarioTiming.ts'
import { sampleScalar } from '../src/lab/cinema/core/tracks.ts'

const LOCALES: So3Locale[] = ['ru', 'en', 'uz']
const frame = createSo3Frame()
const at = (t: number): So3Frame => sampleSo3Frame(t, frame)
const idx = (id: string) => SO3_ATOM_INDEX.get(id)!

let checks = 0
function ok(label: string, cond: boolean, detail = ''): void {
  assert.ok(cond, `${label}${detail ? ` — ${detail}` : ''}`)
  checks++
}
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol

const STEP_PAUSE = SO3_STEPS.map((s) => s.to)
const LAST = SO3_STEPS.length - 1
const lastStepTo = SO3_STEPS[LAST]!.to
const dist = (a: string, b: string) => frame.pos[idx(a)]!.distanceTo(frame.pos[idx(b)]!)
const angle = (a: string, c: string, b: string) => measureAngle(frame.pos[idx(a)]!, frame.pos[idx(c)]!, frame.pos[idx(b)]!)
const labelOf = (id: string) => frame.labels.find((l) => l.id === id)!
const bondSlot = (a: string, b: string) => SO3_BONDS.findIndex((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))

const L2 = bondLength('S=O')
const L3 = bondLength('S=O(SO3)')
const LOO = bondLength('O=O')

// ─────────────────────────────────────────────────────────────────────────────
// 1. Хронометраж и контракт лаборатории
// ─────────────────────────────────────────────────────────────────────────────

SO3_TIMING.validate()
ok('шагов 6 ± 1', SO3_STEPS.length >= 5 && SO3_STEPS.length <= 7, `${SO3_STEPS.length}`)
ok('id шагов совпадают', SO3_STEP_IDS.join(',') === SO3_STEPS.map((s) => s.id).join(','))
const wall = storyWallDuration(SO3_SEGMENTS)
ok('экранная длительность 26–34 с', wall >= 26 && wall <= 34, `${wall.toFixed(1)} с`)
ok('wallDuration kit = сумма сегментов', near(wall, SO3_TIMING.wallDuration, 1e-9))
for (const s of SO3_STEPS) ok(`шаг ${s.id}: 4–7 экранных секунд`, s.wall >= 4 && s.wall <= 7, `${s.wall}`)
for (const id of ['embryo', 'birth', 'complete']) {
  const c = SO3_CUES.find((x) => x.id === id)!
  ok(`cue ${id} строго после последнего шага`, c.at > lastStepTo, `${c.at} ≤ ${lastStepTo}`)
}
for (const c of SO3_CUES) {
  if (['embryo', 'birth', 'complete'].includes(c.id)) continue
  ok(`cue ${c.id} внутри шагов`, c.at > 0 && c.at < lastStepTo)
}
ok('complete совпадает с концом сюжета', SO3_CUES.find((c) => c.id === 'complete')!.at === SO3_END)
ok('watchdog лаборатории положителен', so3ScientificWatchdogMs() > 0)
for (let i = 0; i < SO3_STEPS.length; i++) {
  const s = SO3_STEPS[i]!
  ok(`stepIndexAt(${s.id})`, SO3_TIMING.stepIndexAt((s.from + s.to) / 2) === i)
}
// Переносы кислорода — внутри «своих» шагов (стадия 1 — шаг 3, стадия 2 — шаг 4).
for (const k of ['a', 'b'] as const) {
  const tr = SO3_TRANSFERS[k]
  ok(`перенос ${k} — внутри шага catalyst`, SO3_TIMING.stepIndexAt(tr.transfer) === SO3_STEP_IDS.indexOf('catalyst'))
  ok(`возврат ${k} — внутри шага reoxidation`, SO3_TIMING.stepIndexAt(tr.refill) === SO3_STEP_IDS.indexOf('reoxidation'))
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Раскадровка: дорожки, рывки атомов и камеры, ноль аллокаций
// ─────────────────────────────────────────────────────────────────────────────

validateSo3Storyboard()
{
  const scratch = createSo3Frame()
  const buf = SO3_ATOMS.map((a) => ({ id: a.id, pos: new THREE.Vector3(), opacity: 0 }))
  assertNoPositionJumps(
    (t) => {
      sampleSo3Frame(t, scratch)
      for (let i = 0; i < SO3_ATOMS.length; i++) {
        buf[i]!.pos.copy(scratch.pos[i]!)
        buf[i]!.opacity = scratch.opacity[i]!
      }
      return buf
    },
    SO3_END,
    0.09,
    1 / 30,
  )
  checks++
  const cam = createSceneCamera()
  assertCameraContinuity((t) => sampleShot(SO3_CAMERA, t, cam), SO3_END)
  checks++

  // Видимость не щёлкает: «присутствие» = min(прозрачность, доля полного радиуса) — растущий атом
  // вырастает из точки, уходящий гаснет; скачок за кадр 1/30 с не больше 0,12.
  const fullR = SO3_ATOMS.map((a) => speciesRadius(a.el, 0))
  const presence = (i: number) => Math.min(scratch.opacity[i]!, scratch.radius[i]! / fullR[i]!)
  let prev: Float32Array | null = null
  for (let t = 0; t <= SO3_END + 1e-9; t += 1 / 30) {
    sampleSo3Frame(t, scratch)
    const now = Float32Array.from(SO3_ATOMS, (_, i) => presence(i))
    if (prev) {
      let worst = 0
      for (let i = 0; i < SO3_ATOMS.length; i++) worst = Math.max(worst, Math.abs(now[i]! - prev[i]!))
      ok(`видимость без скачка при t=${t.toFixed(2)}`, worst <= 0.12, worst.toFixed(3))
    }
    prev = now
  }

  // Кадр пишет в заранее созданные объекты.
  const posRefs = scratch.pos.slice()
  const labelRefs = scratch.labels.slice()
  const labelPos = scratch.labels.map((l) => l.pos)
  for (let t = 0; t <= SO3_END; t += 0.5) sampleSo3Frame(t, scratch)
  ok('векторы позиций переиспользуются', scratch.pos.every((p, i) => p === posRefs[i]))
  ok('подписи переиспользуются', scratch.labels.every((l, i) => l === labelRefs[i] && l.pos === labelPos[i]))
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Геометрия раскадровки ↔ ядро
// ─────────────────────────────────────────────────────────────────────────────

// 3.1 Радиусы: все частицы ковалентные — радиус Кордеро из ядра, одна доля на всю сцену.
for (const el of ['S', 'O'] as const) {
  ok(`${el}⁰ — ковалентный радиус ядра (Кордеро)`, speciesRadiusPm(el, 0) === covalentRadiusPm(el) && radiusForSpecies(el, 0) === covalentRadiusPm(el))
}

// 3.2 Шаг 1: две уголковые SO₂ и O₂ из bondData.
at(STEP_PAUSE[0]!)
for (const [s, o1, o2] of [['sA', 'oA1', 'oA2'], ['sB', 'oB1', 'oB2']] as const) {
  ok(`${s}: d(S=O) = bondLengthPm('S=O')`, near(dist(s, o1), L2) && near(dist(s, o2), L2), `${dist(s, o1)}`)
  ok(`${s}: ∠O–S–O = bondAngleDeg('sulfurDioxide')`, near(angle(o1, s, o2), bondAngleDeg('sulfurDioxide'), 1e-6), angle(o1, s, o2).toFixed(4))
  // Полярность: сумма единичных векторов S→O ≠ 0 (уголковая) — согласуется с μ(SO₂) ядра > 0.
  const u = frame.pos[idx(o1)]!.clone().sub(frame.pos[idx(s)]!).normalize().add(frame.pos[idx(o2)]!.clone().sub(frame.pos[idx(s)]!).normalize())
  ok(`${s}: векторы связей не гасятся — μ(SO₂) ядра > 0`, u.length() > 0.5 && dipoleDebye('SO2')! > 0)
  ok(`${s}: материал газа`, frame.material[idx(s)] === 'gas' && frame.material[idx(o1)] === 'gas')
  for (const o of [o1, o2]) {
    const k = bondSlot(s, o)
    ok(`${s}–${o}: полоса SO₂ — σ + ½ π (делокализация)`, near(frame.bond.order[k]!, SO3_GEOM.orderSO2) && frame.bond.opacity[k]! > 0.99)
  }
}
ok('O₂: d(O=O) = bondLengthPm', near(dist('o1', 'o2'), LOO), `${dist('o1', 'o2')}`)
ok('O₂: двойная связь видна, материал газа', frame.bond.order[SO3_BOND_SLOTS.oo] === 2 && frame.bond.opacity[SO3_BOND_SLOTS.oo]! > 0.99 && frame.material[idx('o1')] === 'gas')
ok('кислород — двухатомная молекула в уравнении', SO3_REACTION.left.some((t) => t.formula === 'O2') && !SO3_REACTION.left.some((t) => t.formula === 'O'))
ok('катализатора на шаге 1 нет', frame.opacity[idx('c1')] === 0 && frame.opacity[idx('c2')] === 0 && frame.fx.surface === 0)
ok('радиусы сцены = speciesRadius ядра', near(frame.radius[idx('sA')]!, speciesRadius('S', 0)) && near(frame.radius[idx('oA1')]!, speciesRadius('O', 0)))

// 3.3 Шаг 2: столкновение без реакции — молекулы касаются и возвращаются, геометрия цела.
{
  const tc = SO3_TIMING.cueAt('collide')
  at(tc)
  ok('столкновение: SO₂ цела (S=O, угол)', near(dist('sA', 'oA1'), L2) && near(angle('oA1', 'sA', 'oA2'), bondAngleDeg('sulfurDioxide'), 1e-6))
  ok('столкновение: O₂ цела', near(dist('o1', 'o2'), LOO))
  const rO = speciesRadius('O', 0)
  const gap = dist('oA1', 'o1')
  ok('столкновение: атомы не проходят друг сквозь друга', gap > 2 * rO, `${gap.toFixed(3)}`)
  at(STEP_PAUSE[1]!)
  ok('пауза шага 2: реагенты те же — S⁺⁴ и никакой третьей связи', frame.ox[0] === SO3_FACTS.oxSO2 && frame.bond.opacity[SO3_BOND_SLOTS.ca] === 0)
}

// 3.4 Шаг 3: в конце — две SO₃ и два пустых места катализатора.
at(STEP_PAUSE[2]!)
for (const [s, o1, o2, c] of [['sA', 'oA1', 'oA2', 'c1'], ['sB', 'oB1', 'oB2', 'c2']] as const) {
  for (const o of [o1, o2, c]) ok(`пауза шага 3: ${s}–${o} = S=O(SO₃)`, near(dist(s, o), L3), `${dist(s, o)}`)
  ok(`пауза шага 3: ${s} — углы 120° по ядру`, [angle(o1, s, o2), angle(o2, s, c), angle(c, s, o1)].every((a) => near(a, bondAngleDeg('sulfurTrioxide'), 1e-6)))
}
ok('пауза шага 3: оба места пусты (V₂O₄)', frame.sites[0] === 0 && frame.sites[1] === 0)
ok('пауза шага 3: O₂ ещё цела', near(dist('o1', 'o2'), LOO) && frame.bond.opacity[SO3_BOND_SLOTS.oo]! > 0.99)

// 3.5 Шаг 4: атомы O₂ — в местах катализатора.
at(STEP_PAUSE[3]!)
ok('пауза шага 4: O₂ распалась, связь погашена', frame.bond.opacity[SO3_BOND_SLOTS.oo] === 0)
ok('пауза шага 4: o1 и o2 стоят в местах катализатора', frame.pos[idx('o1')]!.distanceTo(new THREE.Vector3(...SO3_SITES[0])) < 1e-9 && frame.pos[idx('o2')]!.distanceTo(new THREE.Vector3(...SO3_SITES[1])) < 1e-9)
ok('пауза шага 4: катализатор восстановлен (V₂O₅)', frame.sites[0] === 1 && frame.sites[1] === 1)
ok('пауза шага 4: атом O места лежит на поверхности', near(SO3_SITES[0][1] - SO3_GEOM.surfaceY, speciesRadius('O', 0)))

// 3.6 Шаг 5: продукт — D₃h по writeTrigonalPlanar, данные ядра.
at(STEP_PAUSE[4]!)
{
  const S = frame.pos[idx('sA')]!
  const tri = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  writeTrigonalPlanar(tri, S, L3, sampleScalar(SO3_YAW_A, STEP_PAUSE[4]!), SO3_GEOM.molPitch, 0)
  ok('SO₃ = writeTrigonalPlanar(S, S=O(SO₃)) — core/vsepr', ['c1', 'oA1', 'oA2'].every((id, k) => frame.pos[idx(id)]!.distanceTo(tri[k]!) < 1e-9))
  for (const o of ['c1', 'oA1', 'oA2']) ok(`SO₃: S–${o} = bondLengthPm('S=O(SO3)')`, near(dist('sA', o) / pmToScene(1), bondLengthPm('S=O(SO3)'), 1e-6))
  const angles = [angle('oA1', 'sA', 'oA2'), angle('oA2', 'sA', 'c1'), angle('c1', 'sA', 'oA1')]
  ok('SO₃: три угла = bondAngleDeg(sulfurTrioxide)', angles.every((a) => near(a, bondAngleDeg('sulfurTrioxide'), 1e-6)), angles.map((a) => a.toFixed(3)).join(' '))
  ok('SO₃: плоская (сумма углов 360°)', near(angles.reduce((s, a) => s + a, 0), 360, 1e-6))
  const n = frame.pos[idx('oA1')]!.clone().sub(S).cross(frame.pos[idx('oA2')]!.clone().sub(S)).normalize()
  ok('SO₃: сера в плоскости трёх O', Math.abs(frame.pos[idx('c1')]!.clone().sub(S).dot(n)) < 1e-9)
  const sum = new THREE.Vector3()
  for (const o of ['c1', 'oA1', 'oA2']) sum.add(frame.pos[idx(o)]!.clone().sub(S).normalize())
  ok('SO₃: векторы связей гасятся ⇔ μ(SO₃) ядра = 0', sum.length() < 1e-9 && dipoleDebye('SO3') === 0)
  for (const o of ['c1', 'oA1', 'oA2']) {
    const k = bondSlot('sA', o)
    ok(`SO₃: связь S–${o} — σ + ⅓ π (три равные)`, near(frame.bond.order[k]!, SO3_GEOM.orderSO3) && frame.bond.opacity[k]! > 0.99)
  }
  ok('SO₃: материал молекулы', ['sA', 'oA1', 'oA2', 'c1'].every((id) => frame.material[idx(id)] === 'covalent'))
  ok('SO₃ повёрнута (видна плоскость, а не только фас)', sampleScalar(SO3_YAW_A, STEP_PAUSE[4]!) > 0.5)
  ok('катализатор и SO₃ (b) погашены', ['c2', 'sB', 'oB1', 'oB2', 'o1', 'o2'].every((id) => frame.opacity[idx(id)] === 0) && frame.fx.surface === 0)
}

// 3.7 Шаг 6: тример S₃O₉ — длины REAGENT_GEOMETRY.s3o9, тетраэдры по идеальному углу (схема ядра).
at(STEP_PAUSE[5]!)
{
  const g = REAGENT_GEOMETRY.s3o9
  const ringB = SO3_BONDS.filter((b) => b.kind === 'ring')
  const termB = SO3_BONDS.filter((b) => b.kind === 'term')
  ok('S₃O₉: число связей кольца = bondCounts ядра', ringB.length === g.bondCounts['S–O(кольцо)'])
  ok('S₃O₉: число концевых связей = bondCounts ядра', termB.length === g.bondCounts['S=O(конц.)'])
  const tr = SO3_ATOMS.filter((a) => a.kind === 'trimer')
  ok('S₃O₉: состав 3 S + 9 O', tr.filter((a) => a.el === 'S').length === 3 && tr.filter((a) => a.el === 'O').length === 9)
  for (const b of ringB) ok(`S₃O₉: ${b.a}–${b.b} = S–O(кольцо) ядра`, near(dist(b.a, b.b) / pmToScene(1), reagentBondPm('s3o9', 'S–O(кольцо)'), 1e-6))
  for (const b of termB) ok(`S₃O₉: ${b.a}–${b.b} = S=O(конц.) ядра`, near(dist(b.a, b.b) / pmToScene(1), reagentBondPm('s3o9', 'S=O(конц.)'), 1e-6))
  ok('S₃O₉: кольцо S–O чередуется', ringB.every((b) => SO3_ATOMS[idx(b.a)]!.el !== SO3_ATOMS[idx(b.b)]!.el))
  // У каждой серы четыре лиганда — все шесть углов тетраэдрические.
  for (const sId of tr.filter((a) => a.el === 'S').map((a) => a.id)) {
    const lig = SO3_BONDS.filter((b) => b.a === sId || b.b === sId).map((b) => (b.a === sId ? b.b : b.a))
    ok(`S₃O₉: у ${sId} четыре лиганда (тетраэдр SO₄)`, lig.length === 4)
    for (let i = 0; i < lig.length; i++) {
      for (let j = i + 1; j < lig.length; j++) {
        ok(`S₃O₉: ∠${lig[i]}–${sId}–${lig[j]} = идеальный тетраэдр`, near(angle(lig[i]!, sId, lig[j]!), TETRAHEDRAL_ANGLE_DEG, 1e-6))
      }
    }
  }
  ok('S₃O₉: все атомы видимы и на местах', tr.every((a) => frame.opacity[idx(a.id)]! > 0.99 && frame.pos[idx(a.id)]!.distanceTo(new THREE.Vector3(...SO3_TRIMER_POS.get(a.id)!)) < 1e-12))
  // Несвязанные атомы тримера не налезают друг на друга сильнее, чем связанные.
  let minNon = Infinity
  for (let i = 0; i < tr.length; i++) {
    for (let j = i + 1; j < tr.length; j++) {
      if (bondSlot(tr[i]!.id, tr[j]!.id) >= 0) continue
      minNon = Math.min(minNon, dist(tr[i]!.id, tr[j]!.id))
    }
  }
  ok('S₃O₉: несвязанные атомы дальше самой длинной связи', minNon > pmToScene(reagentBondPm('s3o9', 'S–O(кольцо)')), minNon.toFixed(3))
  ok('рядом — SO₃ (a) для сравнения, не пересекается с тримером', tr.every((a) => frame.pos[idx(a.id)]!.distanceTo(frame.pos[idx('sA')]!) > 1))
}

let contradiction = false
// 3.8 Приёмка: ни один атом не «растёт из точки» (это читалось бы как рождение вещества).
{
  const cat = SO3_ATOMS.map((a, i) => ({ a, i })).filter(({ a }) => a.kind === 'catalyst')
  const tri = SO3_ATOMS.map((a, i) => ({ a, i })).filter(({ a }) => a.kind === 'trimer')
  const tr0 = SO3_TRANSFERS.a.transfer
  for (let t = 0; t <= SO3_END + 1e-9; t += 1 / 60) {
    at(t)
    for (let i = 0; i < SO3_ATOMS.length; i++) {
      if (frame.opacity[i]! > 0) ok(`t=${t.toFixed(2)}: ${SO3_ATOMS[i]!.id} виден с полным радиусом ядра`, near(frame.radius[i]!, speciesRadius(SO3_ATOMS[i]!.el, 0), 1e-5))
    }
    // Тример — один объект сравнения: все 12 атомов проявляются одновременно.
    ok(`t=${t.toFixed(2)}: тример проявляется целиком`, tri.every(({ i }) => frame.opacity[i] === frame.opacity[tri[0]!.i]))
    // O катализатора — часть схемы поверхности: до первого переноса прозрачность = сетке.
    if (t < tr0) ok(`t=${t.toFixed(2)}: O катализатора проявляется вместе с сеткой`, cat.every(({ i }) => near(frame.opacity[i]!, frame.fx.surface, 1e-6)))
  }
  // Радиус O катализатора = радиус O в SO₃ = Кордеро ядра (названо в note шага catalyst).
  at(STEP_PAUSE[2]!)
  ok('O катализатора и O в SO₃ — один ковалентный радиус ядра', near(frame.radius[idx('c1')]!, frame.radius[idx('oA1')]!) && speciesRadiusPm('O', 0) === covalentRadiusPm('O'))
  // Кратность рисунка (упрощённый счёт 1 + 1/n) у SO₃ меньше, а связь по ядру короче —
  // противоречие обязано быть названо: product.body называет обе длины, product.note — сравнение с SO₂.
  contradiction = SO3_GEOM.orderSO3 < SO3_GEOM.orderSO2 && bondLengthPm('S=O(SO3)') < bondLengthPm('S=O')
  ok('кратность рисунка SO₃ < SO₂ при более короткой связи (условие ядра)', contradiction)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Кадр переноса / возврата атома O; электронный баланс
// ─────────────────────────────────────────────────────────────────────────────

{
  assertSnapAt(SO3_SNAP.oxA, SO3_TRANSFERS.a.transfer, SO3_FACTS.oxSO2, SO3_FACTS.oxSO3)
  assertSnapAt(SO3_SNAP.oxB, SO3_TRANSFERS.b.transfer, SO3_FACTS.oxSO2, SO3_FACTS.oxSO3)
  assertSnapAt(SO3_SNAP.siteA, SO3_TRANSFERS.a.transfer, 1, 0)
  assertSnapAt(SO3_SNAP.siteB, SO3_TRANSFERS.b.transfer, 1, 0)
  assertSnapAt(SO3_SNAP.siteA, SO3_TRANSFERS.a.refill, 0, 1)
  assertSnapAt(SO3_SNAP.siteB, SO3_TRANSFERS.b.refill, 0, 1)
  checks += 6
  ok('степени окисления из электронейтральности: SO₂ → +4, SO₃ → +6', SO3_FACTS.oxSO2 === 2 * (8 - ATOMIC_DATA.O.valenceElectrons) && SO3_FACTS.oxSO3 === 3 * (8 - ATOMIC_DATA.O.valenceElectrons))
  const dt = 1 / 60
  const lbl = (id: string) => labelOf(id).text
  for (const [k, s, o1, c, mol, site, slot] of [
    ['a', 'sA', 'oA1', 'c1', 'molA', 'siteA', SO3_BOND_SLOTS.ca],
    ['b', 'sB', 'oB1', 'c2', 'molB', 'siteB', SO3_BOND_SLOTS.cb],
  ] as const) {
    const tr = SO3_TRANSFERS[k].transfer
    const ki = k === 'a' ? 0 : 1
    at(tr - dt)
    const before = { ox: frame.ox[ki]!, mc: frame.material[idx(c)], ms: frame.material[idx(s)], lm: lbl(mol), ls: lbl(site), bond: frame.bond.opacity[slot]!, pc: frame.pos[idx(c)]!.clone() }
    at(tr)
    ok(`${k}: до переноса S⁺⁴, O катализатора «каркас», SO₂ газ, третьей связи нет`, before.ox === SO3_FACTS.oxSO2 && before.mc === 'polar' && before.ms === 'gas' && before.bond === 0)
    ok(`${k}: в кадр переноса S⁺⁶, O — в молекуле, материал молекулы`, frame.ox[ki] === SO3_FACTS.oxSO3 && frame.material[idx(c)] === 'covalent' && frame.material[idx(s)] === 'covalent' && frame.material[idx(o1)] === 'covalent')
    ok(`${k}: подпись SO₂ → SO₃ в кадр переноса`, before.lm !== lbl(mol) && lbl(mol).startsWith('SO₃') && before.lm.startsWith('SO₂'))
    ok(`${k}: подпись места V₂O₅ → V₂O₄ в кадр переноса`, before.ls.startsWith('V₂O₅') && lbl(site).startsWith('V₂O₄'))
    ok(`${k}: в кадр переноса S стоит ровно на S=O(SO₃) от атома O места`, near(dist(s, c), L3, 1e-9))
    ok(`${k}: атом O не прыгает в кадр переноса`, before.pc.distanceTo(frame.pos[idx(c)]!) < 1e-9)
    at(tr + 0.4)
    ok(`${k}: третья связь S–O проявилась`, frame.bond.opacity[slot]! > 0.99)
    const rf = SO3_TRANSFERS[k].refill
    const oAtom = k === 'a' ? 'o1' : 'o2'
    at(rf - dt)
    const b2 = { ls: lbl(site), m: frame.material[idx(oAtom)], site: frame.sites[ki] }
    at(rf)
    ok(`${k}: до возврата — V₂O₄, атом O из O₂ ещё газ`, b2.ls.startsWith('V₂O₄') && b2.m === 'gas' && b2.site === 0)
    ok(`${k}: в кадр возврата — V₂O₅, атом O в месте, материал каркаса`, lbl(site).startsWith('V₂O₅') && frame.material[idx(oAtom)] === 'polar' && frame.sites[ki] === 1)
    ok(`${k}: в кадр возврата атом O ровно в месте`, frame.pos[idx(oAtom)]!.distanceTo(new THREE.Vector3(...SO3_SITES[ki])) < 1e-9)
  }

  // Электронный баланс каждые 1/60 с шагов 3–4 (формальные степени окисления):
  // отдано серой Σ(ox − 4) = в «запасе» катализатора 2·Σ(1 − site) + принято атомами O из O₂ 2·(сколько сели).
  const from = SO3_STEPS[2]!.from
  const to = SO3_STEPS[3]!.to
  let worst = 0
  let worstComp = 0
  for (let t = from; t <= to + 1e-9; t += dt) {
    at(t)
    const given = frame.ox[0]! - SO3_FACTS.oxSO2 + (frame.ox[1]! - SO3_FACTS.oxSO2)
    const settled = (t >= SO3_TRANSFERS.a.refill ? 1 : 0) + (t >= SO3_TRANSFERS.b.refill ? 1 : 0)
    const stored = 2 * (1 - frame.sites[0]!) + 2 * (1 - frame.sites[1]!)
    worst = Math.max(worst, Math.abs(given - stored - 2 * settled))
    // Степень окисления серы = электронейтральность по числу присоединённых O.
    for (const [ki, c, tr] of [[0, 'c1', SO3_TRANSFERS.a.transfer], [1, 'c2', SO3_TRANSFERS.b.transfer]] as const) {
      const n = 2 + (t >= tr ? 1 : 0)
      worstComp = Math.max(worstComp, Math.abs(frame.ox[ki]! - sulfurOxidationState(n)))
      void c
    }
  }
  ok('электронный баланс «S ↔ V ↔ O₂» в каждом кадре шагов 3–4', worst === 0, `${worst}`)
  ok('степень окисления S = электронейтральность по числу атомов O в каждом кадре', worstComp === 0)
  const redox = (role: 'oxidation' | 'reduction') => SO3_HALF_REACTIONS.filter((h) => h.role === role).reduce((s, h) => s + h.electrons * h.times, 0)
  ok('полуреакции на уравнение: отдано = принято', redox('oxidation') === redox('reduction'), `${redox('oxidation')} / ${redox('reduction')}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Только объекты текущего шага; на паузе каждый видимый атом подписан
// ─────────────────────────────────────────────────────────────────────────────

function hostSpan(hosts: readonly string[]): number {
  let m = 0
  for (const a of hosts) for (const b of hosts) m = Math.max(m, dist(a, b))
  return m
}

for (let si = 0; si < SO3_STEPS.length; si++) {
  const s = SO3_STEPS[si]!
  let foreign = 0
  let at0 = -1
  for (let t = s.from; t <= s.to + 1e-9; t += 1 / 60) {
    at(t)
    for (let i = 0; i < SO3_ATOMS.length; i++) {
      const [a, b] = SO3_ATOMS[i]!.span
      const own = si >= a && si <= b
      if (!own && frame.opacity[i]! > 0) {
        foreign++
        if (at0 < 0) at0 = t
      }
    }
    // Сетка катализатора — объект шагов 3–4 (и начала шага 5, пока гаснет вместе с атомами места).
    if ((si < 2 || si > 4) && frame.fx.surface > 0) {
      foreign++
      if (at0 < 0) at0 = t
    }
  }
  ok(`шаг ${s.id}: ни одного объекта чужого шага`, foreign === 0, `первый при t=${at0.toFixed(3)}`)

  at(s.to)
  const visibleLabels = frame.labels.map((l, k) => ({ st: l, def: SO3_LABELS[k]! })).filter(({ st }) => st.opacity > 0.5)
  ok(`пауза ${s.id}: есть подписи`, visibleLabels.length > 0)
  for (let i = 0; i < SO3_ATOMS.length; i++) {
    if (frame.opacity[i]! <= 0.02) continue
    const id = SO3_ATOMS[i]!.id
    const hosts = visibleLabels.filter(({ def }) => def.hosts.includes(id))
    const closeHost = hosts.some(({ st, def }) => st.pos.distanceTo(frame.pos[i]!) <= hostSpan(def.hosts) + 1)
    ok(`пауза ${s.id}: атом ${id} подписан`, closeHost, `хозяев ${hosts.length}`)
    ok(`пауза ${s.id}: атом ${id} полностью проявлен`, frame.opacity[i]! > 0.99, frame.opacity[i]!.toFixed(3))
  }
  for (const { st, def } of visibleLabels) {
    if (def.hosts.length === 0) continue
    ok(`пауза ${s.id}: подпись ${def.id} подписывает видимые атомы`, def.hosts.some((h) => frame.opacity[idx(h)]! > 0.5), st.text)
  }
  // Подпись молекулы говорит правду о составе: SO₂ ↔ 2 атома O, SO₃ ↔ 3.
  for (const [mol, s0, c, tr] of [['molA', 'sA', 'c1', SO3_TRANSFERS.a.transfer], ['molB', 'sB', 'c2', SO3_TRANSFERS.b.transfer]] as const) {
    const l = labelOf(mol)
    if (l.opacity <= 0.5) continue
    const n = s.to >= tr ? 3 : 2
    ok(`пауза ${s.id}: подпись ${mol} = состав (${n} атома O)`, l.text.startsWith(n === 3 ? 'SO₃' : 'SO₂') && (n === 2 || near(dist(s0, c), L3)))
  }
  // Сетка катализатора на паузе подписана формулой места.
  if (frame.fx.surface > 0.5) ok(`пауза ${s.id}: сетка катализатора подписана`, labelOf('siteA').opacity > 0.9 && labelOf('siteB').opacity > 0.9)
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Финал без огня
// ─────────────────────────────────────────────────────────────────────────────

{
  const s = SO3_STEPS[LAST]!
  at(SO3_STEPS[0]!.from + 0.01)
  const baseEmissive = frame.emissive[0]!
  const baseBloom = frame.camera.bloom
  for (let t = s.from; t <= s.to + 1e-9; t += 1 / 30) {
    at(t)
    ok(`шаг 6, t=${t.toFixed(2)}: FX-амплитуды = 0`, frame.fx.surface === 0)
    let hot = 0
    for (let i = 0; i < SO3_ATOMS.length; i++) if (frame.emissive[i] !== baseEmissive) hot++
    ok(`шаг 6, t=${t.toFixed(2)}: свечение атомов базовое`, hot === 0, `${hot}`)
    ok(`шаг 6, t=${t.toFixed(2)}: bloom базовый, тряски нет`, near(frame.camera.bloom, baseBloom) && frame.camera.shake === 0)
  }
  at(SO3_END)
  ok('в конце хвоста кадр затемнён', frame.fade > 0.95)
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Энергетика: лестница = ядро
// ─────────────────────────────────────────────────────────────────────────────

validateSo3Energetics()
{
  const chain = REACTION_STEP_CHAINS.so2_v2o5
  ok('стадии лестницы = REACTION_STEP_CHAINS.so2_v2o5', SO3_CHAIN === chain && SO3_LADDER.stages.length === chain.length)
  SO3_LADDER.stages.forEach((st, i) => {
    const per = formationReactionKJ(chain[i]!)
    ok(`ступень ${st.id}: perUnit = formationReactionKJ(${chain[i]})`, st.perUnitKJ === per)
    ok(`ступень ${st.id}: dH = ${SO3_STAGE_MULTIPLIER} × perUnit`, st.multiplier === SO3_STAGE_MULTIPLIER && near(st.dH, SO3_STAGE_MULTIPLIER * per, 1e-9))
  })
  ok('знаки: стадия 1 > 0, стадия 2 < 0, итог < 0', so3StageKJ('reduction') > 0 && so3StageKJ('reoxidation') < 0 && SO3_LADDER.sumKJ < 0)
  ok('Σ лестницы = ΔH(so3_contact) (катализатор не меняет ΔH)', near(SO3_LADDER.sumKJ, formationReactionKJ('so3_contact'), 1e-6), `${SO3_LADDER.sumKJ}`)
  ok('ΔH(so3_contact) = 2·ΔH°f(SO₃) − 2·ΔH°f(SO₂)', near(SO3_REACTION_DH_KJ, 2 * dHfKJ('SO3(g)') - 2 * dHfKJ('SO2(g)'), 1e-6))
  ok('ΔH°f реагента и продукта = ядро', SO2_DHF_KJ === dHfKJ('SO2(g)') && SO3_DHF_KJ === dHfKJ('SO3(g)'))
  ok('стадии на один оборот = ½ прямой реакции', near(so3StageKJ('reduction') + so3StageKJ('reoxidation'), SO3_REACTION_DH_KJ / 2, 1e-6))
  ok('ΔH на моль SO₃ = ½ уравнения', near(SO3_DH_PER_MOL_KJ, SO3_REACTION_DH_KJ / 2, 1e-9))
  ok('гидратация SO₃ экзотермична (ядро)', SO3_HYDRATION_KJ === formationReactionKJ('so3_hydration') && SO3_HYDRATION_KJ < 0)
  const levels = ladderLevels(SO3_LADDER)
  ok('последний уровень = сумма', near(levels[levels.length - 1]!, SO3_LADDER.sumKJ))
  ok('ступени идут по времени сюжета и внутри шагов', SO3_LADDER.stages.every((s, i) => s.at > 0 && s.at < lastStepTo && (i === 0 || s.at >= SO3_LADDER.stages[i - 1]!.at)))
  ok('ступень 1 — в кадр второго переноса, ступень 2 — в кадр второго возврата', SO3_LADDER.stages[0]!.at === SO3_TRANSFERS.b.transfer && SO3_LADDER.stages[1]!.at === SO3_TRANSFERS.b.refill)
}

// Стехиометрия: уравнение и обе стадии сбалансированы по атомам; атомы кадра = уравнение.
{
  type Term = { readonly formula: string; readonly coeff: number }
  const count = (terms: readonly Term[]) => {
    const m = new Map<string, number>()
    for (const t of terms) for (const g of t.formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) m.set(g[1]!, (m.get(g[1]!) ?? 0) + (g[2] ? Number(g[2]) : 1) * t.coeff)
    return m
  }
  const balanced = (name: string, l: readonly Term[], r: readonly Term[]) => {
    const a = count(l)
    const b = count(r)
    for (const k of new Set([...a.keys(), ...b.keys()])) ok(`${name}: баланс по ${k}`, a.get(k) === b.get(k))
  }
  balanced('2 SO₂ + O₂ → 2 SO₃', SO3_REACTION.left, SO3_REACTION.right)
  balanced('V₂O₅ + SO₂ → V₂O₄ + SO₃', SO3_STAGE_REACTIONS.reduction.left, SO3_STAGE_REACTIONS.reduction.right)
  balanced('V₂O₄ + O → V₂O₅', SO3_STAGE_REACTIONS.reoxidation.left, SO3_STAGE_REACTIONS.reoxidation.right)
  const left = count(SO3_REACTION.left)
  const story = SO3_ATOMS.filter((a) => a.kind === 'story')
  ok('в сюжете 2 S — как в уравнении', story.filter((a) => a.el === 'S').length === left.get('S'))
  ok('в сюжете O реагентов (SO₂ + O₂) — как в уравнении', story.filter((a) => a.el === 'O').length === left.get('O'))
  ok('атомов O катализатора — по одному на оборот (две молекулы SO₂)', SO3_ATOMS.filter((a) => a.kind === 'catalyst').length === SO3_STAGE_MULTIPLIER)
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
for (const locale of LOCALES) {
  const t = getSo3MechanismText(locale).steps.product
  ok(`[${locale}] product: обе длины названы, note сравнивает счёт кратности с SO₂`, !contradiction || (hasValue(t.body, SO3_FACTS.so3Pm) && hasValue(t.body, SO3_FACTS.so2Pm) && t.note!.includes('SO₂')))
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. 3D-подписи: символы и числа ядра
// ─────────────────────────────────────────────────────────────────────────────

{
  const allowed3d = [
    SO3_FACTS.so2Pm,
    SO3_FACTS.so2AngleDeg,
    SO3_FACTS.o2Pm,
    SO3_FACTS.so3Pm,
    SO3_FACTS.so3AngleDeg,
    SO3_FACTS.so3DipoleD,
    SO3_FACTS.s3o9RingPm,
    SO3_FACTS.s3o9TermPm,
    SO3_REACTION_DH_KJ,
    SO3_FACTS.oxSO2,
    SO3_FACTS.oxSO3,
  ]
  for (const l of SO3_LABELS) {
    for (const k of l.keys) {
      const bare = k.text.replace(/\{\w+\}/g, '')
      ok(`подпись ${l.id}: без кириллицы (слова — в панели)`, !/[А-Яа-яЁё]/.test(bare), k.text)
      ok(`подпись ${l.id}: без фраз`, !/[a-z]{3,}/i.test(bare), k.text)
      ok(`подпись ${l.id}: единицы только токенами`, !/\b(pm|kJ\/mol|kJ)\b/.test(bare) && !/\((s|g|l|aq)\)/.test(bare), k.text)
      for (const n of numbers(bare)) ok(`подпись ${l.id}: число ${n.raw} из ядра`, allowed3d.some((v) => matches(n, v)), k.text)
    }
  }
  const text = (id: string, i = 0) => SO3_LABELS.find((l) => l.id === id)!.keys[i]!.text
  const one = (id: string, v: number) => ok(`подпись ${id} = ядро`, hasValue(text(id), v) && numbers(text(id)).length === 1, text(id))
  one('dSO2', bondLengthPm('S=O'))
  one('angSO2', bondAngleDeg('sulfurDioxide'))
  one('dOO', bondLengthPm('O=O'))
  one('dSO3', bondLengthPm('S=O(SO3)'))
  one('angSO3', bondAngleDeg('sulfurTrioxide'))
  one('mu', dipoleDebye('SO3')!)
  one('ring', reagentBondPm('s3o9', 'S–O(кольцо)'))
  one('term', reagentBondPm('s3o9', 'S=O(конц.)'))
  const dH = numbers(text('dH'))[0]!
  ok('подпись ΔH = ΔH(so3_contact) со знаком минус', dH.sign === -1 && matches(dH, SO3_REACTION_DH_KJ))
  for (const id of ['oxA', 'oxB']) {
    const [a, b] = [numbers(text(id, 0))[0]!, numbers(text(id, 1))[0]!]
    ok(`подпись ${id}: +4 → +6 из электронейтральности`, a.sign === 1 && a.v === SO3_FACTS.oxSO2 && b.sign === 1 && b.v === SO3_FACTS.oxSO3)
  }

  const known = new Set(Object.keys(SCENE_LABEL_TOKENS.ru))
  for (const token of labelTokensUsed(SO3_LABELS)) ok(`токен {${token}} есть в словаре`, known.has(token))
  for (const locale of LOCALES) {
    const states = createLabelStates(SO3_LABELS)
    localizeSceneLabels(states, locale)
    for (const st of states) ok(`[${locale}] подпись ${st.id} раскрыта`, !/\{\w+\}/.test(st.text) && st.text.trim().length > 0)
  }
  const ru = createLabelStates(SO3_LABELS)
  const en = createLabelStates(SO3_LABELS)
  localizeSceneLabels(ru, 'ru')
  localizeSceneLabels(en, 'en')
  ok('подписи ru отличаются от en (единицы переведены)', ru.some((s, i) => s.text !== en[i]!.text))
  // Решение 8: числа 3D по локали — десятичная запятая на ru/uz.
  for (const locale of ['ru', 'uz'] as const) {
    const st = createLabelStates(SO3_LABELS)
    localizeSceneLabels(st, locale, true)
    const g = st.find((x) => x.id === 'dSO3')!.text
    ok(`[${locale}] 3D-число с десятичной запятой: «${g}»`, g.includes(String(bondLengthPm('S=O(SO3)')).replace('.', ',')) && !/\d\.\d/.test(st.map((x) => x.text).join(' ')))
  }
  for (const l of SO3_LABELS) for (const w of l.windows) ok(`окно подписи ${l.id}`, w[0] < w[1] && w[0] >= 0 && w[1] <= SO3_END + 1e-9)
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Тексты урока: числа ↔ ядро, синхронность языков
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Внешние константы, которых нет в ядре (оговорены здесь, с источниками; их место — ядро,
 * см. отчёт исполнителя):
 *   25 °C / 298 K — стандартные условия;
 *   400 °C — нижняя граница активности («зажигания») ванадиевого катализатора V₂O₅/K₂S₂O₇ —
 *            Ullmann's Encyclopedia, «Sulfuric Acid and Sulfur Trioxide»;
 *   400–450 °C — окно контактного процесса (там же; Greenwood & Earnshaw, 2nd ed., §15.3.4;
 *            docs/prompts/OPUS-3D-FORMATION-11.md, раздел 8);
 *   γ-SO₃: т. пл. 16,8 °C, т. кип. 44,8 °C; β: т. пл. 32,5 °C; α: т. пл. 62,3 °C —
 *            CRC Handbook 97th, Physical Constants of Inorganic Compounds; Greenwood & Earnshaw §15.2.5.
 */
const EXT = {
  standardC: 25,
  standardK: 298,
  catalystOnC: 400,
  windowLowC: 400,
  windowHighC: 450,
  gammaMpC: 16.8,
  gammaBpC: 44.8,
  betaMpC: 32.5,
  alphaMpC: 62.3,
} as const
const EXTERNAL = Object.values(EXT)
/** Концентрация кислоты-поглотителя — из ядра (note реакции so3_hydration), а не строкой теста. */
const ABSORBER_PCT = (() => {
  const m = /(\d+)\s?%\s?H₂SO₄/.exec(FORMATION_REACTIONS.so3_hydration!.note ?? '')
  assert.ok(m, 'ядро: в note so3_hydration нет концентрации кислоты-поглотителя')
  return Number(m[1])
})()
// Согласованность внешних констант между собой и с утверждениями текста.
ok('EXT: нижняя граница окна = порог активности катализатора', EXT.windowLowC === EXT.catalystOnC && EXT.windowLowC < EXT.windowHighC)
ok('EXT: γ-SO₃ при 25 °C — жидкость (т. пл. < 25 < т. кип.)', EXT.gammaMpC < EXT.standardC && EXT.standardC < EXT.gammaBpC)
ok('EXT: β и α при 25 °C — твёрдые, т. пл. γ < β < α', EXT.standardC < EXT.betaMpC && EXT.gammaMpC < EXT.betaMpC && EXT.betaMpC < EXT.alphaMpC)
ok('EXT: 298 K = 25 °C', Math.round(EXT.standardC + 273.15) === EXT.standardK)
ok('ядро: кислота-поглотитель концентрированная (> 90 %)', ABSORBER_PCT > 90 && ABSORBER_PCT < 100, `${ABSORBER_PCT}`)
const CORE_VALUES: number[] = [
  SO3_FACTS.so2Pm,
  SO3_FACTS.so2AngleDeg,
  SO3_FACTS.so2DipoleD,
  SO3_FACTS.o2Pm,
  SO3_FACTS.so3Pm,
  SO3_FACTS.so3AngleDeg,
  SO3_FACTS.s3o9RingPm,
  SO3_FACTS.s3o9TermPm,
  SO2_DHF_KJ,
  SO3_DHF_KJ,
  SO3_REACTION_DH_KJ,
  SO3_DH_PER_MOL_KJ,
  so3StageKJ('reduction'),
  so3StageKJ('reoxidation'),
  SO3_HYDRATION_KJ,
  TETRAHEDRAL_ANGLE_DEG,
  ABSORBER_PCT,
  ...EXTERNAL,
]
/**
 * Привязка «число ↔ величина» по единице: число перед пм/°/кДж/D/°C/%/K может быть только
 * величиной своего рода (162 пм не пройдёт как «162 °C», 140 — как угол). Диапазон «400–450 °C»
 * отдаёт единицу обоим концам.
 */
const abs = Math.abs
const BY_UNIT: Record<string, number[]> = {
  pm: [SO3_FACTS.so2Pm, SO3_FACTS.o2Pm, SO3_FACTS.so3Pm, SO3_FACTS.s3o9RingPm, SO3_FACTS.s3o9TermPm],
  deg: [SO3_FACTS.so2AngleDeg, SO3_FACTS.so3AngleDeg, TETRAHEDRAL_ANGLE_DEG],
  kJ: [SO2_DHF_KJ, SO3_DHF_KJ, SO3_REACTION_DH_KJ, SO3_DH_PER_MOL_KJ, so3StageKJ('reduction'), so3StageKJ('reoxidation'), SO3_HYDRATION_KJ].map(abs),
  D: [SO3_FACTS.so2DipoleD, SO3_FACTS.so3DipoleD],
  C: [EXT.standardC, EXT.catalystOnC, EXT.windowLowC, EXT.windowHighC, EXT.gammaMpC, EXT.gammaBpC, EXT.betaMpC, EXT.alphaMpC],
  pct: [ABSORBER_PCT],
  K: [EXT.standardK],
}
const UNIT_RE = /(\d+(?:[.,]\d+)?)(?:\s?–\s?(\d+(?:[.,]\d+)?))?\s?(пм|pm|°C|°|кДж|kJ|D(?![\w₀-₉])|%|K(?![\w₀-₉]))/g
const unitOf = (u: string) => (u === 'пм' || u === 'pm' ? 'pm' : u === '°C' ? 'C' : u === '°' ? 'deg' : u === 'кДж' || u === 'kJ' ? 'kJ' : u === '%' ? 'pct' : u)
function unitNumbers(s: string): { v: Num; unit: string }[] {
  const out: { v: Num; unit: string }[] = []
  for (const m of s.matchAll(UNIT_RE)) {
    for (const raw of [m[1], m[2]]) {
      if (!raw) continue
      const body = raw.replace(',', '.')
      out.push({ v: { v: Number(body), dec: body.includes('.') ? body.split('.')[1]!.length : 0, sign: 0, raw }, unit: unitOf(m[3]!) })
    }
  }
  return out
}
/** Формальные степени окисления в тексте: «+N» вплотную, не множитель «+ 2 ×» и не энтальпия «+24,9». */
const OX_RE = /(?<![\d.,])\+(\d+)(?!\d|[.,]\d|\s?[×·])/g
const oxInText = (s: string) => [...s.matchAll(OX_RE)].map((m) => Number(m[1]))
const OX_O = 8 - ATOMIC_DATA.O.valenceElectrons
const OX_ALLOWED = new Set([sulfurOxidationState(2), sulfurOxidationState(3), (5 * OX_O) / 2, (4 * OX_O) / 2])
/** Тип геометрии величины (пм) по ядру — для сверки пометки rₑ в тексте. */
const PM_TYPE = new Map<number, string | undefined>([
  [SO3_FACTS.so2Pm, BOND_DATA['S=O'].lengthType],
  [SO3_FACTS.o2Pm, BOND_DATA['O=O'].lengthType],
  [SO3_FACTS.so3Pm, BOND_DATA['S=O(SO3)'].lengthType],
  [SO3_FACTS.s3o9RingPm, REAGENT_GEOMETRY.s3o9.lengthType],
  [SO3_FACTS.s3o9TermPm, REAGENT_GEOMETRY.s3o9.lengthType],
])
const DEG_TYPE = new Map<number, string | undefined>([
  [SO3_FACTS.so2AngleDeg, BOND_ANGLES.sulfurDioxide.angleType],
  [SO3_FACTS.so3AngleDeg, BOND_ANGLES.sulfurTrioxide.angleType ?? (BOND_DATA['S=O(SO3)'].lengthType === 'r_e' ? 'r_e' : undefined)],
])
/** Малые целые — счёт (2 SO₂, ×2, +4 → +6, μ = 0). */
const isCount = (n: Num) => n.dec === 0 && n.v <= 12

const fields = (t: So3MechanismText): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const id of SO3_STEP_IDS) {
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

const numbersByField: Record<So3Locale, Record<string, string>> = { ru: {}, en: {}, uz: {} }
for (const locale of LOCALES) {
  const t = getSo3MechanismText(locale)
  ok(`[${locale}] заголовок и безопасность`, t.intro.title.length > 0 && t.safety.length > 20)
  for (const id of SO3_STEP_IDS) {
    const s = t.steps[id]
    ok(`[${locale}] ${id}: заголовок, уравнение, реплика`, s.title.trim().length > 0 && s.equation.trim().length > 0 && s.speak.trim().length > 0)
    ok(`[${locale}] ${id}: 2–4 предложения`, s.body.split(/[.!?]\s/).length >= 2)
    ok(`[${locale}] ${id}: есть note (всё схематичное названо)`, (s.note ?? '').length > 0)
  }
  ok(`[${locale}] aria-подпись лестницы`, t.energy.summary.includes('{dH}'))
  ok(`[${locale}] подписи ступеней лестницы по id`, SO3_LADDER.stages.every((s) => (t.energy.stages as Record<string, string>)[s.id]!.length > 0))

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

  const need = (key: string, vals: number[]) => {
    for (const v of vals) ok(`[${locale}] ${key} называет ${v}`, hasValue(f[key]!, v), f[key]!.slice(0, 60))
  }
  need('reactants.body', [SO3_FACTS.so2AngleDeg, SO3_FACTS.so2Pm, SO3_FACTS.so2DipoleD, SO3_FACTS.o2Pm, SO3_FACTS.oxSO2, SO3_FACTS.oxSO3])
  need('equilibrium.body', [SO3_DHF_KJ, SO2_DHF_KJ, SO3_REACTION_DH_KJ, SO3_DH_PER_MOL_KJ])
  need('equilibrium.equation', [SO3_REACTION_DH_KJ])
  need('catalyst.body', [so3StageKJ('reduction'), SO3_FACTS.oxSO2, SO3_FACTS.oxSO3])
  need('reoxidation.body', [so3StageKJ('reoxidation')])
  need('reoxidation.note', [so3StageKJ('reduction'), so3StageKJ('reoxidation'), SO3_REACTION_DH_KJ, SO3_STAGE_MULTIPLIER])
  need('product.body', [SO3_FACTS.so3Pm, SO3_FACTS.so3AngleDeg, SO3_FACTS.so3DipoleD, SO3_FACTS.so2DipoleD, SO3_FACTS.so2Pm])
  need('product.equation', [SO3_FACTS.so3Pm, SO3_FACTS.so3AngleDeg, SO3_FACTS.so3DipoleD])
  need('reactants.note', [SO3_FACTS.so2AngleDeg, SO3_FACTS.so2Pm])
  need('equilibrium.body', [EXT.catalystOnC, EXT.windowLowC, EXT.windowHighC])
  need('equilibrium.equation', [EXT.windowLowC, EXT.windowHighC])
  need('condensed.body', [SO3_HYDRATION_KJ, ABSORBER_PCT, EXT.gammaMpC, EXT.gammaBpC, EXT.betaMpC, EXT.alphaMpC, EXT.standardC])
  need('condensed.equation', [SO3_HYDRATION_KJ])
  need('condensed.note', [SO3_FACTS.s3o9TermPm, SO3_FACTS.s3o9RingPm, TETRAHEDRAL_ANGLE_DEG])

  // Привязка по единице: число перед единицей — величина своего рода из ядра / EXT.
  for (const [key, s] of Object.entries(f)) {
    for (const { v, unit } of unitNumbers(s)) {
      const pool = BY_UNIT[unit]!
      ok(`[${locale}] ${key}: ${v.raw} (${unit}) — величина этого рода`, pool.some((x) => matches(v, x)), `${s.slice(0, 70)} | ${pool.join(' ')}`)
    }
    // Степени окисления: только из электронейтральности (S в SO₂/SO₃, V в V₂O₅/V₂O₄).
    for (const n of oxInText(s)) ok(`[${locale}] ${key}: степень окисления +${n} из электронейтральности`, OX_ALLOWED.has(n), s.slice(0, 70))
    // Пометка rₑ: в одном предложении с числом — только величина, у которой в ядре тип r_e.
    for (const sentence of s.split(/(?<=[.;])\s/)) {
      if (!/rₑ|r_e/.test(sentence)) continue
      for (const { v, unit } of unitNumbers(sentence)) {
        const type = unit === 'pm' ? [...PM_TYPE].find(([x]) => matches(v, x))?.[1] : unit === 'deg' ? [...DEG_TYPE].find(([x]) => matches(v, x))?.[1] : 'r_e'
        ok(`[${locale}] ${key}: «rₑ» рядом с ${v.raw} — в ядре тип r_e`, type === 'r_e', `${sentence.slice(0, 70)} | тип ${type}`)
      }
    }
  }
  ok(`[${locale}] reactants.body: степени окисления серы = sulfurOxidationState(2), (3)`, oxInText(f['reactants.body']!).join(' ') === [sulfurOxidationState(2), sulfurOxidationState(3)].join(' '))
  ok(`[${locale}] legend: степени окисления серы = sulfurOxidationState(2), (3)`, oxInText(f.legend!).join(' ') === [sulfurOxidationState(2), sulfurOxidationState(3)].join(' '))
  // SO₂: тип угла/длины в ядре не указан — текст обязан назвать это в note (оба числа в note шага 1).
  if (BOND_ANGLES.sulfurDioxide.angleType !== 'r_e' || BOND_DATA['S=O'].lengthType !== 'r_e') {
    ok(`[${locale}] reactants.note называет угол и длину SO₂ без типа rₑ`, hasValue(f['reactants.note']!, SO3_FACTS.so2AngleDeg) && hasValue(f['reactants.note']!, SO3_FACTS.so2Pm))
  }
  // Формы SO₃: у γ — т. пл. и т. кип., у β и α — т. пл.; сегмент формы — до следующей формы.
  {
    const body = f['condensed.body']!
    const marks = ['γ —', 'β —', 'α —'].map((m) => body.indexOf(m))
    ok(`[${locale}] condensed.body: три твёрдые формы γ, β, α по порядку`, marks.every((x, i) => x >= 0 && (i === 0 || x > marks[i - 1]!)), marks.join(' '))
    const seg = (i: number) => body.slice(marks[i]!, i + 1 < marks.length ? marks[i + 1]! : body.indexOf(')', marks[i]!) + 1)
    const temps = (i: number) => unitNumbers(seg(i)).filter((x) => x.unit === 'C').map((x) => x.v)
    const want = [[EXT.gammaMpC, EXT.gammaBpC], [EXT.betaMpC], [EXT.alphaMpC]]
    want.forEach((w, i) => {
      const got = temps(i)
      ok(`[${locale}] condensed.body: форма ${'γβα'[i]} — свои температуры`, got.length === w.length && got.every((n, j) => matches(n, w[j]!)), got.map((n) => n.v).join(' '))
    })
  }

  // Энтальпии со знаком: экзо — минус, эндо — плюс (как в ядре).
  const signOf = (s: string, v: number) => numbers(s).filter((n) => n.dec > 0 && matches(n, v))
  ok(`[${locale}] ΔH реакции везде со знаком минус`, Object.values(f).every((s) => signOf(s, SO3_REACTION_DH_KJ).every((n) => n.sign === -1)))
  ok(`[${locale}] стадия 1 со знаком плюс`, Object.values(f).every((s) => signOf(s, so3StageKJ('reduction')).every((n) => n.sign === 1)))
  ok(`[${locale}] стадия 2 и гидратация со знаком минус`, Object.values(f).every((s) => [...signOf(s, so3StageKJ('reoxidation')), ...signOf(s, SO3_HYDRATION_KJ)].every((n) => n.sign === -1)))

  // Закон Гесса в тексте шага 2: 2·(ΔH°f SO₃) − 2·(ΔH°f SO₂) = ΔH — слагаемые и итог из ядра.
  {
    const body = f['equilibrium.body']!
    const m = /(\d+)·\(([+−-])(\d+[.,]\d+)\)\s*([+−-])\s*(\d+)·\(([+−-])(\d+[.,]\d+)\)\s*=\s*([+−-])(\d+[.,]\d+)/.exec(body)
    ok(`[${locale}] шаг 2: запись закона Гесса разбирается`, m != null)
    if (m) {
      const val = (sg: string, v: string) => (sg === '+' ? 1 : -1) * Number(v.replace(',', '.'))
      const a = Number(m[1]) * val(m[2]!, m[3]!)
      const b = (m[4] === '+' ? 1 : -1) * Number(m[5]) * val(m[6]!, m[7]!)
      const total = val(m[8]!, m[9]!)
      ok(`[${locale}] шаг 2: слагаемые = ΔH°f ядра × 2`, near(val(m[2]!, m[3]!), SO3_DHF_KJ, 0.05) && near(val(m[6]!, m[7]!), SO2_DHF_KJ, 0.05) && Number(m[1]) === 2 && Number(m[5]) === 2)
      ok(`[${locale}] шаг 2: арифметика сходится`, near(a + b, total, 0.05))
      ok(`[${locale}] шаг 2: итог = so3_contact`, near(total, SO3_REACTION_DH_KJ, 0.05))
    }
  }
  // Сумма стадий в note шага 4: множитель × ступень ядра, итог = so3_contact.
  {
    const note = f['reoxidation.note']!
    const eq = note.indexOf('=')
    const terms = [...note.slice(0, eq).matchAll(/(\d+)\s?×\s?\(([+−-])(\d+[.,]\d+)\)/g)].map((g) => ({ k: Number(g[1]), v: (g[2] === '+' ? 1 : -1) * Number(g[3]!.replace(',', '.')) }))
    const res = /([+−-])(\d+[.,]\d+)/.exec(note.slice(eq))!
    const total = (res[1] === '+' ? 1 : -1) * Number(res[2]!.replace(',', '.'))
    ok(`[${locale}] шаг 4: слагаемые = ступени ядра с множителями`, terms.length === SO3_LADDER.stages.length && terms.every((x, i) => x.k === SO3_LADDER.stages[i]!.multiplier && near(x.v, SO3_LADDER.stages[i]!.perUnitKJ!, 0.05)), JSON.stringify(terms))
    ok(`[${locale}] шаг 4: сумма сходится арифметически`, near(terms.reduce((s, x) => s + x.k * x.v, 0), total, 0.05))
    ok(`[${locale}] шаг 4: итог = ΔH прямой реакции`, near(total, SO3_REACTION_DH_KJ, 0.05))
  }
  // Степени окисления в теле шага 3 — пары «от … до …»: +4 → +6 (сера), +5 → +4 (ванадий по схеме).
  {
    const ox = numbers(f['catalyst.body']!).filter((n) => n.sign === 1 && n.dec === 0).map((n) => n.v)
    const oxO = 8 - ATOMIC_DATA.O.valenceElectrons
    const vHigh = (5 * oxO) / 2 // V₂O₅: электронейтральность, 5 атомов O на 2 атома V
    const vLow = (4 * oxO) / 2 // V₂O₄
    ok(`[${locale}] шаг 3: степени окисления = электронейтральность`, ox.join(' ') === [SO3_FACTS.oxSO2, SO3_FACTS.oxSO3, vHigh, vLow].join(' '), ox.join(' '))
  }
}

// Привязка «число ↔ величина» (ru, по порядку) и порядок чисел en/uz = ru.
{
  const seq = (s: string) => numbers(s).filter((n) => !isCount(n)).map((n) => n.v)
  const sameSeq = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => near(v, b[i]!, 1e-9))
  const expect: Record<string, number[]> = {
    'reactants.body': [SO3_FACTS.so2AngleDeg, SO3_FACTS.so2Pm, SO3_FACTS.so2DipoleD, SO3_FACTS.o2Pm],
    'reactants.note': [SO3_FACTS.so2AngleDeg, SO3_FACTS.so2Pm],
    'equilibrium.body': [abs(SO3_DHF_KJ), abs(SO2_DHF_KJ), abs(SO3_REACTION_DH_KJ), abs(SO3_DH_PER_MOL_KJ), EXT.catalystOnC, EXT.windowLowC, EXT.windowHighC],
    'equilibrium.equation': [EXT.windowLowC, EXT.windowHighC, abs(SO3_REACTION_DH_KJ)],
    'equilibrium.note': [25],
    'catalyst.body': [so3StageKJ('reduction')],
    'catalyst.note': [],
    'product.note': [],
    'reoxidation.body': [abs(so3StageKJ('reoxidation'))],
    'reoxidation.note': [so3StageKJ('reduction'), abs(so3StageKJ('reoxidation')), abs(SO3_REACTION_DH_KJ)],
    'product.body': [SO3_FACTS.so3Pm, SO3_FACTS.so3AngleDeg, SO3_FACTS.so2DipoleD, SO3_FACTS.so2Pm],
    'product.equation': [SO3_FACTS.so3Pm, SO3_FACTS.so3AngleDeg],
    'condensed.body': [abs(SO3_HYDRATION_KJ), ABSORBER_PCT, ABSORBER_PCT, EXT.gammaMpC, EXT.gammaBpC, EXT.betaMpC, EXT.alphaMpC, EXT.standardC],
    'condensed.equation': [abs(SO3_HYDRATION_KJ)],
    'condensed.note': [SO3_FACTS.s3o9TermPm, SO3_FACTS.s3o9RingPm, TETRAHEDRAL_ANGLE_DEG],
    energy: [298],
  }
  const ru = fields(getSo3MechanismText('ru'))
  for (const [key, want] of Object.entries(expect)) {
    const got = numbers(ru[key]!).filter((n) => !isCount(n))
    ok(`[ru] ${key}: числа стоят на своих местах (привязка к величинам ядра)`, got.length === want.length && got.every((n, i) => matches(n, want[i]!)), `${got.map((n) => n.v).join(' ')} | ожидалось ${want.map((v) => v.toFixed(2)).join(' ')}`)
  }
  for (const locale of ['en', 'uz'] as const) {
    const f = fields(getSo3MechanismText(locale))
    for (const key of Object.keys(f)) {
      ok(`[${locale}] ${key}: порядок чисел как в ru`, sameSeq(seq(f[key]!), seq(ru[key]!)), `${seq(f[key]!).join(' ')} | ru ${seq(ru[key]!).join(' ')}`)
    }
  }
}

for (const key of Object.keys(numbersByField.ru)) {
  ok(`числа поля ${key} совпадают в ru/en`, numbersByField.ru[key] === numbersByField.en[key], `${numbersByField.ru[key]} | ${numbersByField.en[key]}`)
  ok(`числа поля ${key} совпадают в ru/uz`, numbersByField.ru[key] === numbersByField.uz[key], `${numbersByField.ru[key]} | ${numbersByField.uz[key]}`)
}

console.log(`✓ so3 cinema: ${checks} проверок пройдено`)
console.log(`  шагов ${SO3_STEPS.length}, экранное время ${wall.toFixed(1)} с (${SO3_STEPS.map((s) => s.wall).join(' + ')} + хвост), сюжет ${SO3_END} с`)
console.log(`  ΔH: 2 × (${so3StageKJ('reduction')}) + 2 × (${so3StageKJ('reoxidation')}) = ${SO3_LADDER.sumKJ} кДж = so3_contact ${SO3_REACTION_DH_KJ}`)
console.log(`  SO₂: ${bondLengthPm('S=O')} пм, ${bondAngleDeg('sulfurDioxide')}° → SO₃: ${bondLengthPm('S=O(SO3)')} пм, ${bondAngleDeg('sulfurTrioxide')}°, μ = ${dipoleDebye('SO3')}`)
console.log(`  S₃O₉: S–O кольца ${reagentBondPm('s3o9', 'S–O(кольцо)')} пм, S=O ${reagentBondPm('s3o9', 'S=O(конц.)')} пм; атомов в кадре ${SO3_ATOMS.length}`)
