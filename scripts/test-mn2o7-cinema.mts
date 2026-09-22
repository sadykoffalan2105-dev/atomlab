#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт сцены «высший оксид марганца: 2 KMnO₄ + H₂SO₄ → Mn₂O₇ + K₂SO₄ + H₂O»
 * (по образцу эталона scripts/test-nacl-cinema.mts).
 *
 * Сцена проверяется ДАННЫМИ, а не строками: раскадровка — чистая функция sampleMn2o7Frame(t),
 * весь урок сэмплируется в Node, каждое число сверяется с научным ядром src/chemistry/data.
 * Проверок «есть ли в тексте слово/литерал» здесь НЕТ: числа ИЗВЛЕКАЮТСЯ из текста и сверяются
 * с ядром, последовательности чисел ru / en / uz обязаны совпадать.
 *
 *   1. Хронометраж: 6 ± 1 шаг, каждый 4–7 экранных секунд, всего 26–34 с, cue лаборатории
 *      embryo → birth → complete строго после последнего шага.
 *   2. Раскадровка: дорожки монотонны, ни атом, ни камера не прыгают; шары не проникают друг в друга.
 *   3. Геометрия ↔ ядро: MnO₄⁻, H₂SO₄, SO₄²⁻, HMnO₄, Mn₂O₇ (концевая/мостиковая, ∠Mn–O–Mn), вода,
 *      водородные связи перед переходом протона; радиусы K⁺ (Шеннон) и атомов (Кордеро).
 *   4. Переход протона: связь O–H, заряды групп и подписи — в один кадр; Σ зарядов = 0 каждые 1/60 с;
 *      π-доли порядков связей (MnO₄⁻ ¾, сульфат ½, Mn=O 1) — из электронейтральности.
 *   5. На каждом шаге видимы только объекты этого шага; на паузе каждый видимый объект подписан.
 *   6. Финал без огня: FX = 0, свечение и bloom базовые, капля без свечения.
 *   7. Энергия: лестница Гесса = ΔH°f ядра с множителями, сумма = формула ядра, знаки, оценка.
 *   8. 3D-подписи: только формулы/числа/единицы-токены, числа — из ядра, десятичная запятая ru/uz.
 *   9. Тексты: извлечённые числа ↔ ядро, привязка «число ↔ величина», синхронность ru/en/uz.
 *
 * Запуск: npx tsx scripts/test-mn2o7-cinema.mts
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  ATOMIC_DATA,
  bondAngleDeg,
  bondLengthPm,
  dHfKJ,
  FORMATION_ENTHALPY,
  FORMATION_REACTIONS,
  formationReactionKJ,
  radiusForSpecies,
  reagentAngleDeg,
  reagentBondPm,
} from '../src/chemistry/data/index.ts'
import { storyWallDuration } from '../src/lab/cinema/core/storyTime.ts'
import { measureAngle } from '../src/lab/cinema/core/vsepr.ts'
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
import {
  createMn2o7Frame,
  MN2O7_ATOM_INDEX,
  MN2O7_ATOMS,
  MN2O7_BOND_INDEX,
  MN2O7_BONDS,
  MN2O7_CAMERA,
  MN2O7_CHARGE,
  MN2O7_CUES,
  MN2O7_DROP,
  MN2O7_END,
  MN2O7_LABELS,
  MN2O7_PRODUCT_IDS,
  MN2O7_PROTONS,
  MN2O7_SEGMENTS,
  MN2O7_STEPS,
  MN2O7_STEP_IDS,
  MN2O7_TIMING,
  MN2O7_WATER_IDS,
  MN_D_LABEL,
  MN_OX,
  mn2o7ChargeSum,
  mnOxidationState,
  oxoanionBondOrder,
  sampleMn2o7Frame,
  validateMn2o7Storyboard,
  type Mn2o7Frame,
} from '../src/lab/cinema/scenes/mn2o7/mn2o7Storyboard.ts'
import {
  MN2O7_DECOMP_COEF,
  MN2O7_DECOMP_DH_KJ,
  MN2O7_DECOMPOSITION,
  MN2O7_DHF_KJ,
  MN2O7_ESTIMATED,
  MN2O7_KHSO4_DH_KJ,
  MN2O7_LADDER,
  MN2O7_REACTION,
  MN2O7_REACTION_DH_KJ,
  mn2o7StageKJ,
  validateMn2o7Energetics,
} from '../src/lab/cinema/scenes/mn2o7/mn2o7Energetics.ts'
import { getMn2o7MechanismText, type Mn2o7Locale, type Mn2o7MechanismText } from '../src/lab/cinema/scenes/mn2o7/mn2o7MechanismText.ts'
import { mn2o7ScientificWatchdogMs } from '../src/lab/scientificSynthesis/mn2o7ScenarioTiming.ts'

const LOCALES: Mn2o7Locale[] = ['ru', 'en', 'uz']
const frame = createMn2o7Frame()
const at = (t: number): Mn2o7Frame => sampleMn2o7Frame(t, frame)
const idx = (id: string) => {
  const i = MN2O7_ATOM_INDEX.get(id)
  assert.ok(i != null, `нет атома ${id}`)
  return i
}
const P = (id: string) => frame.pos[idx(id)]!
const dist = (a: string, b: string) => P(a).distanceTo(P(b))
const angle = (a: string, c: string, b: string) => measureAngle(P(a), P(c), P(b))

let checks = 0
function ok(label: string, cond: boolean, detail = ''): void {
  assert.ok(cond, `${label}${detail ? ` — ${detail}` : ''}`)
  checks++
}
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol
const S = pmToScene
const STEP_PAUSE = MN2O7_STEPS.map((s) => s.to)
const LAST = MN2O7_STEPS.length - 1
const P1 = MN2O7_PROTONS.p1
const P2 = MN2O7_PROTONS.p2
const P3 = MN2O7_PROTONS.p3

// Числа ядра, которые проверяет тест (ни одного литерала химии).
const PM = {
  mnO4: reagentBondPm('permanganate', 'Mn–O'),
  term: bondLengthPm('Mn-O(term)'),
  bridge: bondLengthPm('Mn-O(bridge)'),
  sDouble: reagentBondPm('h2so4', 'S=O'),
  sOH: reagentBondPm('h2so4', 'S–O(H)'),
  oh: reagentBondPm('h2so4', 'O–H'),
  sulfate: reagentBondPm('sulfate', 'S–O'),
  ohWater: bondLengthPm('O-H'),
  hBond: bondLengthPm('O-H...O'),
}
const DEG = {
  mnOMn: bondAngleDeg('mn2o7MnOMn'),
  oMnO: reagentAngleDeg('permanganate', '∠O–Mn–O'),
  oSo: reagentAngleDeg('h2so4', '∠O=S=O'),
  hoSoh: reagentAngleDeg('h2so4', '∠HO–S–OH'),
  sOH: reagentAngleDeg('h2so4', '∠S–O–H'),
  sulfate: reagentAngleDeg('sulfate', '∠O–S–O'),
  water: bondAngleDeg('water'),
}
const TOL_D = 1e-5
/** Углы ядра даны с точностью 0,01°: тетраэдр writeBridged строится из угла 109,47, а не из 109,4712. */
const TOL_A = 0.01

// ─────────────────────────────────────────────────────────────────────────────
// 1. Хронометраж и контракт лаборатории
// ─────────────────────────────────────────────────────────────────────────────

MN2O7_TIMING.validate()
ok('шагов 6 ± 1', MN2O7_STEPS.length >= 5 && MN2O7_STEPS.length <= 7, `${MN2O7_STEPS.length}`)
ok('id шагов совпадают', MN2O7_STEP_IDS.join(',') === MN2O7_STEPS.map((s) => s.id).join(','))
const wall = storyWallDuration(MN2O7_SEGMENTS)
ok('экранная длительность 26–34 с', wall >= 26 && wall <= 34, `${wall.toFixed(1)} с`)
ok('wallDuration kit = сумма сегментов', near(wall, MN2O7_TIMING.wallDuration, 1e-9))
for (const s of MN2O7_STEPS) ok(`шаг ${s.id}: 4–7 экранных секунд`, s.wall >= 4 && s.wall <= 7, `${s.wall}`)
const lastStepTo = MN2O7_STEPS[LAST]!.to
for (const id of ['embryo', 'birth', 'complete']) {
  const c = MN2O7_CUES.find((x) => x.id === id)!
  ok(`cue ${id} строго после последнего шага`, c.at > lastStepTo, `${c.at} ≤ ${lastStepTo}`)
}
for (const c of MN2O7_CUES) {
  if (['embryo', 'birth', 'complete'].includes(c.id)) continue
  ok(`cue ${c.id} внутри шагов`, c.at > 0 && c.at < lastStepTo)
}
ok('complete совпадает с концом сюжета', MN2O7_CUES.find((c) => c.id === 'complete')!.at === MN2O7_END)
ok('watchdog лаборатории положителен', mn2o7ScientificWatchdogMs() > 0)
for (let i = 0; i < MN2O7_STEPS.length; i++) {
  const s = MN2O7_STEPS[i]!
  ok(`stepIndexAt(${s.id})`, MN2O7_TIMING.stepIndexAt((s.from + s.to) / 2) === i)
}
for (const p of [P1, P2, P3]) ok('протон: leave < hop < arrive', p.leave < p.hop && p.hop < p.arrive)
ok('cue protonate1/2 и condense = hop протонов', ['protonate1', 'protonate2', 'condense'].every((id, k) => near(MN2O7_CUES.find((c) => c.id === id)!.at, [P1, P2, P3][k]!.hop)))

// ─────────────────────────────────────────────────────────────────────────────
// 2. Раскадровка: дорожки, рывки, проникновение шаров, ноль аллокаций
// ─────────────────────────────────────────────────────────────────────────────

validateMn2o7Storyboard()
{
  const scratch = createMn2o7Frame()
  const buf = MN2O7_ATOMS.map((a) => ({ id: a.id, pos: new THREE.Vector3(), opacity: 0 }))
  const drop = { id: 'drop', pos: new THREE.Vector3(), opacity: 0 }
  assertNoPositionJumps(
    (t) => {
      sampleMn2o7Frame(t, scratch)
      for (let i = 0; i < MN2O7_ATOMS.length; i++) {
        buf[i]!.pos.copy(scratch.pos[i]!)
        buf[i]!.opacity = scratch.opacity[i]!
      }
      drop.pos.copy(scratch.drop.pos)
      drop.opacity = scratch.drop.opacity
      return [...buf, drop]
    },
    MN2O7_END,
    0.09,
    1 / 30,
  )
  checks++
  const cam = createSceneCamera()
  assertCameraContinuity((t) => sampleShot(MN2O7_CAMERA, t, cam), MN2O7_END)
  checks++

  // Видимость не щёлкает: у атомов — непрозрачность, у капли — доля радиуса.
  const presence = (f: Mn2o7Frame) => [...Array.from(f.opacity), f.drop.radius / MN2O7_DROP.radius]
  let prev: number[] | null = null
  for (let t = 0; t <= MN2O7_END + 1e-9; t += 1 / 30) {
    sampleMn2o7Frame(t, scratch)
    const now = presence(scratch)
    if (prev) {
      let worst = 0
      for (let i = 0; i < now.length; i++) worst = Math.max(worst, Math.abs(now[i]! - prev[i]!))
      ok(`видимость без скачка при t=${t.toFixed(2)}`, worst <= 0.12, worst.toFixed(3))
    }
    prev = now
  }

  // Шары не проникают друг в друга: у несвязанных видимых атомов d > r₁ + r₂ (связи — из MN2O7_BONDS).
  const bonded = new Set(MN2O7_BONDS.map((b) => [b.a, b.b].sort().join('|')))
  let worstRatio = Infinity
  let worstAt = ''
  for (let t = 0; t <= MN2O7_END + 1e-9; t += 1 / 30) {
    sampleMn2o7Frame(t, scratch)
    for (let i = 0; i < MN2O7_ATOMS.length; i++) {
      for (let j = i + 1; j < MN2O7_ATOMS.length; j++) {
        if (scratch.opacity[i]! < 0.05 || scratch.opacity[j]! < 0.05) continue
        if (bonded.has([MN2O7_ATOMS[i]!.id, MN2O7_ATOMS[j]!.id].sort().join('|'))) continue
        const r = scratch.pos[i]!.distanceTo(scratch.pos[j]!) / (scratch.radius[i]! + scratch.radius[j]!)
        if (r < worstRatio) {
          worstRatio = r
          worstAt = `t=${t.toFixed(2)} ${MN2O7_ATOMS[i]!.id}/${MN2O7_ATOMS[j]!.id}`
        }
      }
    }
  }
  ok('несвязанные шары не проникают друг в друга', worstRatio > 1, `${worstRatio.toFixed(3)} при ${worstAt}`)

  // Кадр пишет в заранее созданные объекты.
  const posRefs = scratch.pos.slice()
  const labelRefs = scratch.labels.slice()
  const labelPos = scratch.labels.map((l) => l.pos)
  const dropPos = scratch.drop.pos
  for (let t = 0; t <= MN2O7_END; t += 0.5) sampleMn2o7Frame(t, scratch)
  ok('векторы позиций переиспользуются', scratch.pos.every((p, i) => p === posRefs[i]) && scratch.drop.pos === dropPos)
  ok('подписи переиспользуются', scratch.labels.every((l, i) => l === labelRefs[i] && l.pos === labelPos[i]))
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Геометрия раскадровки ↔ ядро
// ─────────────────────────────────────────────────────────────────────────────

// 3.1 Радиусы: K⁺ — Шеннон, атомы ковалентных частиц — Кордеро, доля одна на всех.
for (let i = 0; i < MN2O7_ATOMS.length; i++) {
  const a = MN2O7_ATOMS[i]!
  const pm = a.el === 'K' ? radiusForSpecies('K', 1) : radiusForSpecies(a.el, 0, { model: 'covalent' })
  ok(`радиус ${a.id} = ядро (${a.el === 'K' ? 'Шеннон K⁺' : 'Кордеро'}) × доля`, near(frame.radius[i]!, S(pm) * SPECIES_SCALE, 1e-6))
}
ok('K⁺ меньше атома K (ядро)', radiusForSpecies('K', 1) < radiusForSpecies('K', 0))

// 3.2 Шаг 1: MnO₄⁻ — правильный тетраэдр ядра, H₂SO₄ — набор одного метода.
at(STEP_PAUSE[0]!)
for (const m of ['A', 'B'] as const) {
  const mn = `mn${m}`
  const os = [0, 1, 2, 3].map((k) => `o${m}${k}`)
  for (const o of os) ok(`MnO₄⁻ (${m}): d(${mn}–${o}) = Mn–O перманганата`, near(dist(mn, o), S(PM.mnO4), TOL_D), (dist(mn, o) / S(1)).toFixed(2))
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) ok(`MnO₄⁻ (${m}): ∠${os[i]}–Mn–${os[j]} = ∠O–Mn–O ядра`, near(angle(os[i]!, mn, os[j]!), DEG.oMnO, TOL_A), angle(os[i]!, mn, os[j]!).toFixed(3))
}
ok('H₂SO₄: S=O ×2 = ядро', near(dist('s', 'od1'), S(PM.sDouble), TOL_D) && near(dist('s', 'od2'), S(PM.sDouble), TOL_D))
ok('H₂SO₄: S–O(H) ×2 = ядро', near(dist('s', 'ohA'), S(PM.sOH), TOL_D) && near(dist('s', 'ohB'), S(PM.sOH), TOL_D))
ok('H₂SO₄: O–H ×2 = ядро', near(dist('ohA', 'hA'), S(PM.oh), TOL_D) && near(dist('ohB', 'hB'), S(PM.oh), TOL_D))
ok('H₂SO₄: ∠O=S=O = ядро', near(angle('od1', 's', 'od2'), DEG.oSo, TOL_A))
ok('H₂SO₄: ∠HO–S–OH = ядро', near(angle('ohA', 's', 'ohB'), DEG.hoSoh, TOL_A))
ok('H₂SO₄: ∠S–O–H ×2 = ядро', near(angle('s', 'ohA', 'hA'), DEG.sOH, TOL_A) && near(angle('s', 'ohB', 'hB'), DEG.sOH, TOL_A))
ok('шаг 1: оксоанион — π-доля = порядок − 1 из электронейтральности', near(frame.bondPi[MN2O7_BOND_INDEX.get('mnA-oA0')!]!, oxoanionBondOrder(4, -1) - 1, 1e-9))
ok('порядок связи MnO₄⁻ из валентности O: (4·2 − 1)/4', near(oxoanionBondOrder(4, -1), (4 * (8 - ATOMIC_DATA.O.valenceElectrons) - 1) / 4))
ok('ионные дуги K⁺···MnO₄⁻ видны на паузе шага 1', frame.fx.field > 0.5)

// 3.3 Водородная связь перед каждым переходом: O···O = O–H + H···O ядра, H на O–H от донора.
for (const [p, donor, acc, h] of [
  [P1, 'ohA', 'oA3', 'hA'],
  [P2, 'ohB', 'oB3', 'hB'],
] as const) {
  at(p.leave)
  ok(`${h}: перед переходом d(O···O) = O–H + H···O ядра`, near(dist(donor, acc), S(PM.oh + PM.hBond), TOL_D), (dist(donor, acc) / S(1)).toFixed(1))
  ok(`${h}: перед переходом O–H у донора = ядро`, near(dist(donor, h), S(PM.oh), TOL_D))
  ok(`${h}: водородная связь видна`, frame.bondAmount[MN2O7_BOND_INDEX.get(h === 'hA' ? 'hb1' : 'hb2')!]! > 0.9)
  at(p.arrive)
  ok(`${h}: после перехода O–H у акцептора = ядро`, near(dist(acc, h), S(PM.oh), TOL_D))
}
at(P3.leave)
ok('конденсация: d(O(H)···O(H)) = O–H + H···O ядра', near(dist('oB3', 'oA3'), S(PM.oh + PM.hBond), TOL_D), (dist('oB3', 'oA3') / S(1)).toFixed(1))
ok('конденсация: O–H у донора = ядро', near(dist('oB3', 'hB'), S(PM.oh), TOL_D))

// 3.4 Шаг 2: сульфат-ион и две HMnO₄.
at(STEP_PAUSE[1]!)
for (const o of ['ohA', 'ohB', 'od1', 'od2']) ok(`SO₄²⁻: d(S–${o}) = S–O сульфата`, near(dist('s', o), S(PM.sulfate), TOL_D))
{
  const os = ['ohA', 'ohB', 'od1', 'od2']
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) ok(`SO₄²⁻: ∠${os[i]}–S–${os[j]} = ядро`, near(angle(os[i]!, 's', os[j]!), DEG.sulfate, TOL_A))
  ok('SO₄²⁻: π-доля = порядок − 1 (из электронейтральности)', os.every((o) => near(frame.bondPi[MN2O7_BOND_INDEX.get(`s-${o}`)!]!, oxoanionBondOrder(4, -2) - 1, 1e-9)))
}
for (const m of ['A', 'B'] as const) {
  ok(`HMnO₄ (${m}): O–H = ядро`, near(dist(`o${m}3`, `h${m}`), S(PM.oh), TOL_D))
  ok(`HMnO₄ (${m}): ∠Mn–O–H = угол X–O–H кислородной кислоты ядра`, near(angle(`mn${m}`, `o${m}3`, `h${m}`), DEG.sOH, TOL_A), angle(`mn${m}`, `o${m}3`, `h${m}`).toFixed(2))
  ok(`HMnO₄ (${m}): три Mn=O (π-доля 1) и Mn–OH (0)`, [0, 1, 2].every((k) => near(frame.bondPi[MN2O7_BOND_INDEX.get(`mn${m}-o${m}${k}`)!]!, 1)) && frame.bondPi[MN2O7_BOND_INDEX.get(`mn${m}-o${m}3`)!] === 0)
}
ok('K₂SO₄: ионные дуги K⁺···SO₄²⁻ видны', frame.fx.field > 0.5)

// 3.5 Шаг 3 (пауза): Mn₂O₇ собрана, вода ещё в кадре — с геометрией ядра.
for (const pause of [STEP_PAUSE[2]!, STEP_PAUSE[3]!, STEP_PAUSE[LAST]!]) {
  at(pause)
  const term = [...[0, 1, 2].map((k) => ['mnA', `oA${k}`]), ...[0, 1, 2].map((k) => ['mnB', `oB${k}`])]
  for (const [a, b] of term) ok(`t=${pause}: Mn₂O₇ концевая ${a}–${b} = ядро`, near(dist(a!, b!), S(PM.term), TOL_D))
  ok(`t=${pause}: Mn₂O₇ мостиковые Mn–O = ядро`, near(dist('mnA', 'oB3'), S(PM.bridge), TOL_D) && near(dist('mnB', 'oB3'), S(PM.bridge), TOL_D))
  ok(`t=${pause}: ∠Mn–O–Mn = ядро`, near(angle('mnA', 'oB3', 'mnB'), DEG.mnOMn, TOL_A), angle('mnA', 'oB3', 'mnB').toFixed(3))
  for (const m of ['A', 'B'] as const) {
    const t3 = [0, 1, 2].map((k) => `o${m}${k}`)
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) ok(`t=${pause}: ∠O–Mn–O концевые (${m}) = тетраэдрический угол ядра`, near(angle(t3[i]!, `mn${m}`, t3[j]!), DEG.oMnO, TOL_A))
  }
  ok(`t=${pause}: π-доля Mn=O = 1, мостика = 0`, [0, 1, 2].every((k) => frame.bondPi[MN2O7_BOND_INDEX.get(`mnA-oA${k}`)!] === 1) && frame.bondPi[MN2O7_BOND_INDEX.get('mnB-oB3')!] === 0 && frame.bondPi[MN2O7_BOND_INDEX.get('mnA-oB3')!] === 0)
  ok(`t=${pause}: старая связь Mn(A)–O(H) разорвана, мостик Mn(A)–O(B) виден`, frame.bondAmount[MN2O7_BOND_INDEX.get('mnA-oA3')!] === 0 && frame.bondAmount[MN2O7_BOND_INDEX.get('mnA-oB3')!]! > 0.99)
}
at(STEP_PAUSE[2]!)
ok('вода: O–H ×2 = ядро', near(dist('oA3', 'hA'), S(PM.ohWater), TOL_D) && near(dist('oA3', 'hB'), S(PM.ohWater), TOL_D))
ok('вода: ∠H–O–H = ядро', near(angle('hA', 'oA3', 'hB'), DEG.water, TOL_A))
ok('степень окисления Mn одна и та же в MnO₄⁻ и Mn₂O₇ (не ОВР)', MN_OX === mnOxidationState(2, 7, 0) && MN_OX === mnOxidationState(1, 4, -1))
ok('Mn₂O₇: высшая степень окисления = число валентных электронов Mn (ядро)', MN_OX === ATOMIC_DATA.Mn.valenceElectrons)

// ─────────────────────────────────────────────────────────────────────────────
// 4. Переход протона: связь, заряды и подписи — в один кадр; заряд сохраняется
// ─────────────────────────────────────────────────────────────────────────────

{
  assertSnapAt(MN2O7_CHARGE.mnA, P1.hop, -1, 0)
  assertSnapAt(MN2O7_CHARGE.mnB, P2.hop, -1, 0)
  checks += 2
  const dt = 1 / 60
  const lbl = (id: string) => frame.labels.find((l) => l.id === id)!.text
  const amt = (id: string) => frame.bondAmount[MN2O7_BOND_INDEX.get(id)!]!
  for (const [p, grp, lab, donorBond, accBond, acidBefore, acidAfter] of [
    [P1, 'mnA', 'mnA', 'ohA-hA', 'oA3-hA', 0, -1],
    [P2, 'mnB', 'mnB', 'ohB-hB', 'oB3-hB', -1, -2],
  ] as const) {
    at(p.hop - dt)
    const b = { q: frame.groupCharge[grp], acid: frame.groupCharge.acid, l: lbl(lab), la: lbl('acid'), donor: amt(donorBond), acc: amt(accBond) }
    at(p.hop)
    ok(`${grp}: до перехода — MnO₄⁻ (−1), кислота ${acidBefore}`, b.q === -1 && b.acid === acidBefore)
    ok(`${grp}: в кадр перехода — HMnO₄ (0), кислота ${acidAfter}`, frame.groupCharge[grp] === 0 && frame.groupCharge.acid === acidAfter)
    ok(`${grp}: подписи частиц меняются в тот же кадр`, b.l !== lbl(lab) && b.la !== lbl('acid'))
    ok(`${grp}: связь O–H донора есть до перехода и рвётся в кадр перехода`, b.donor > 0 && amt(donorBond) === 0)
    ok(`${grp}: связь O–H акцептора появляется только после перехода`, b.acc === 0 && amt(accBond) === 0)
    at(p.arrive)
    ok(`${grp}: к приходу протона связь O–H акцептора видна целиком`, amt(accBond) > 0.99)
  }
  // Σ зарядов частиц = 0 в любой кадр (свободного H⁺ в кадре нет).
  let worst = 0
  for (let t = 0; t <= MN2O7_END + 1e-9; t += dt) {
    at(t)
    worst = Math.max(worst, Math.abs(mn2o7ChargeSum(frame)))
  }
  ok('заряд сохраняется в каждом кадре (Σ зарядов частиц = 0)', worst === 0, `${worst}`)
  // Конденсация: протон B уходит к O(H) молекулы A — связь переключается в кадр hop.
  at(P3.hop - dt)
  const before = { donor: amt('oB3-hB'), acc: amt('oA3-hB'), mn: lbl('mnA'), prod: frame.labels.find((l) => l.id === 'mn2o7')!.opacity }
  at(P3.hop)
  ok('конденсация: O–H донора рвётся в кадр перехода', before.donor > 0 && amt('oB3-hB') === 0)
  ok('конденсация: O–H воды появляется после перехода', before.acc === 0 && amt('oA3-hB') === 0)
  ok('конденсация: до перехода подписи продукта нет', before.prod === 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Только объекты текущего шага; на паузе каждый видимый объект подписан
// ─────────────────────────────────────────────────────────────────────────────

function hostSpan(hosts: readonly string[]): number {
  let m = 0
  for (const a of hosts) for (const b of hosts) m = Math.max(m, dist(a, b))
  return m
}
const DROP_SPAN = [4, LAST] as const

for (let si = 0; si < MN2O7_STEPS.length; si++) {
  const s = MN2O7_STEPS[si]!
  let foreign = 0
  let at0 = -1
  for (let t = s.from; t <= s.to + 1e-9; t += 1 / 60) {
    at(t)
    for (let i = 0; i < MN2O7_ATOMS.length; i++) {
      const [a, b] = MN2O7_ATOMS[i]!.span
      if (!(si >= a && si <= b) && frame.opacity[i]! > 0) {
        foreign++
        if (at0 < 0) at0 = t
      }
    }
    if (!(si >= DROP_SPAN[0] && si <= DROP_SPAN[1]) && (frame.drop.opacity > 0 || frame.drop.radius > 0)) {
      foreign++
      if (at0 < 0) at0 = t
    }
  }
  ok(`шаг ${s.id}: ни одного объекта чужого шага`, foreign === 0, `первый при t=${at0.toFixed(3)}`)

  at(s.to)
  const visibleLabels = frame.labels.map((l, k) => ({ st: l, def: MN2O7_LABELS[k]! })).filter(({ st }) => st.opacity > 0.5)
  ok(`пауза ${s.id}: есть подписи`, visibleLabels.length > 0)
  for (let i = 0; i < MN2O7_ATOMS.length; i++) {
    if (frame.opacity[i]! <= 0.02) continue
    const id = MN2O7_ATOMS[i]!.id
    const hosts = visibleLabels.filter(({ def }) => def.hosts.includes(id))
    const closeHost = hosts.some(({ st, def }) => st.pos.distanceTo(frame.pos[i]!) <= hostSpan(def.hosts) + 1)
    ok(`пауза ${s.id}: атом ${id} подписан`, closeHost, `хозяев ${hosts.length}`)
    ok(`пауза ${s.id}: атом ${id} полностью проявлен`, frame.opacity[i]! > 0.99, frame.opacity[i]!.toFixed(3))
  }
  for (const { st, def } of visibleLabels) {
    if (def.hosts.length === 0) continue
    ok(`пауза ${s.id}: подпись ${def.id} подписывает видимые атомы`, def.hosts.some((h) => frame.opacity[idx(h)]! > 0.5), st.text)
  }
  // Капля — объект без атомов: видна ⇒ видна её подпись, и она проявлена целиком.
  if (frame.drop.opacity > 0.02) {
    const dl = frame.labels.find((l) => l.id === 'drop')!
    ok(`пауза ${s.id}: капля подписана`, dl.opacity > 0.9 && dl.pos.distanceTo(frame.drop.pos) <= MN2O7_DROP.radius + 1)
    ok(`пауза ${s.id}: капля проявлена целиком`, frame.drop.opacity > 0.99 && near(frame.drop.radius, MN2O7_DROP.radius, 1e-9))
  }
}
at(STEP_PAUSE[2]!)
ok('пауза шага 3: K₂SO₄ ушёл полностью', ['kA', 'kB', 's', 'ohA', 'ohB', 'od1', 'od2'].every((id) => frame.opacity[idx(id)] === 0))
ok('пауза шага 3: вода в кадре', MN2O7_WATER_IDS.every((id) => frame.opacity[idx(id)]! > 0.99))
at(STEP_PAUSE[3]!)
ok('пауза шага 4: вода ушла полностью, в кадре только Mn₂O₇', MN2O7_ATOMS.every((a, i) => (MN2O7_PRODUCT_IDS as readonly string[]).includes(a.id) === (frame.opacity[i]! > 0)))

// ─────────────────────────────────────────────────────────────────────────────
// 6. Финал без огня: FX = 0, свечение и bloom базовые
// ─────────────────────────────────────────────────────────────────────────────

{
  const s = MN2O7_STEPS[LAST]!
  at(MN2O7_STEPS[0]!.from + 0.01)
  const baseEmissive = frame.emissive[0]!
  const baseBloom = frame.camera.bloom
  for (let t = s.from; t <= s.to + 1e-9; t += 1 / 30) {
    at(t)
    ok(`шаг 6, t=${t.toFixed(2)}: FX-амплитуды = 0`, frame.fx.field === 0 && frame.fx.hbond === 0)
    ok(`шаг 6, t=${t.toFixed(2)}: свечение атомов базовое`, Array.from(frame.emissive).every((e) => e === baseEmissive))
    ok(`шаг 6, t=${t.toFixed(2)}: bloom базовый, тряски нет`, near(frame.camera.bloom, baseBloom) && frame.camera.shake === 0)
  }
  at(s.to)
  ok('конец шага 6: молекула цела и видна', MN2O7_PRODUCT_IDS.every((id) => frame.opacity[idx(id)]! > 0.99))
  at(MN2O7_END)
  ok('в конце хвоста кадр затемнён', frame.fade > 0.95)
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Энергетика: лестница Гесса = ядро
// ─────────────────────────────────────────────────────────────────────────────

validateMn2o7Energetics()
{
  const coef = (id: string, key: string) => Math.abs(FORMATION_REACTIONS[id]!.species.find((s) => s.key === key)!.coef)
  const want: Record<string, number> = {
    kmno4: -coef('mn2o7_textbook', 'KMnO4(s)') * dHfKJ('KMnO4(s)'),
    h2so4: -coef('mn2o7_textbook', 'H2SO4(l)') * dHfKJ('H2SO4(l)'),
    k2so4: coef('mn2o7_textbook', 'K2SO4(s)') * dHfKJ('K2SO4(s)'),
    h2o: coef('mn2o7_textbook', 'H2O(l)') * dHfKJ('H2O(l)'),
    mn2o7: coef('mn2o7_textbook', 'Mn2O7(l)') * dHfKJ('Mn2O7(l)'),
  }
  ok('ступеней пять', MN2O7_LADDER.stages.length === 5)
  for (const [id, v] of Object.entries(want)) ok(`ступень ${id} = ΔH°f ядра × коэффициент`, near(mn2o7StageKJ(id as keyof typeof want & 'kmno4'), v, 1e-9))
  const k = MN2O7_LADDER.stages.find((s) => s.id === 'kmno4')!
  ok('у KMnO₄ множитель = коэффициент уравнения, на единицу = −ΔH°f', k.multiplier === coef('mn2o7_textbook', 'KMnO4(s)') && near(k.perUnitKJ!, -dHfKJ('KMnO4(s)')))
  ok('Σ лестницы = ΔH реакции ядра', near(MN2O7_LADDER.sumKJ, formationReactionKJ('mn2o7_textbook'), 1e-6) && near(MN2O7_REACTION_DH_KJ, formationReactionKJ('mn2o7_textbook')))
  ok('знаки: разложение на простые вещества > 0, образование < 0', MN2O7_LADDER.stages.every((s) => (s.kind === 'dissociation' ? s.dH > 0 : s.dH < 0)))
  ok('ΔH°f(Mn₂O₇) помечена в ядре оценкой', FORMATION_ENTHALPY['Mn2O7(l)']!.estimated === true && MN2O7_ESTIMATED)
  const levels = ladderLevels(MN2O7_LADDER)
  ok('последний уровень = сумма', near(levels[levels.length - 1]!, MN2O7_LADDER.sumKJ, 1e-9))
  ok('ступени по времени сюжета, внутри шагов', MN2O7_LADDER.stages.every((s, i) => s.at > 0 && s.at < lastStepTo && (i === 0 || s.at >= MN2O7_LADDER.stages[i - 1]!.at)))
  const khso4 = dHfKJ('Mn2O7(l)') + 2 * dHfKJ('KHSO4(s)') + dHfKJ('H2O(l)') - 2 * dHfKJ('KMnO4(s)') - 2 * dHfKJ('H2SO4(l)')
  ok('вариант с KHSO₄ = ΔH°f ядра', near(MN2O7_KHSO4_DH_KJ, khso4, 1e-6))
  ok('разложение = ΔH ядра, экзотермично', near(MN2O7_DECOMP_DH_KJ, formationReactionKJ('mn2o7_decomposition')) && MN2O7_DECOMP_DH_KJ < 0)
}

// Стехиометрия: уравнение учебника, вариант с KHSO₄ и разложение сбалансированы; электронный баланс распада.
{
  const count = (terms: readonly { formula: string; coeff: number }[]) => {
    const m = new Map<string, number>()
    for (const t of terms) for (const x of t.formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) m.set(x[1]!, (m.get(x[1]!) ?? 0) + (x[2] ? Number(x[2]) : 1) * t.coeff)
    return m
  }
  const balanced = (l: readonly { formula: string; coeff: number }[], r: readonly { formula: string; coeff: number }[]) => {
    const a = count(l)
    const b = count(r)
    return [...new Set([...a.keys(), ...b.keys()])].every((k) => a.get(k) === b.get(k))
  }
  ok('уравнение учебника сбалансировано по атомам', balanced(MN2O7_REACTION.left, MN2O7_REACTION.right))
  ok('разложение сбалансировано по атомам', balanced(MN2O7_DECOMPOSITION.left, MN2O7_DECOMPOSITION.right))
  ok(
    'вариант с KHSO₄ сбалансирован',
    balanced(
      [
        { formula: 'KMnO4', coeff: 2 },
        { formula: 'H2SO4', coeff: 2 },
      ],
      [
        { formula: 'Mn2O7', coeff: 1 },
        { formula: 'KHSO4', coeff: 2 },
        { formula: 'H2O', coeff: 1 },
      ],
    ),
  )
  // Атомы кадра = левая часть уравнения учебника.
  const left = count(MN2O7_REACTION.left)
  for (const [el, n] of left) ok(`в кадре ${n} атомов ${el} — как в уравнении`, MN2O7_ATOMS.filter((a) => a.el === el).length === n)
  const prod = count(MN2O7_REACTION.right.filter((t) => t.formula === 'Mn2O7'))
  ok('молекула продукта = Mn₂O₇ по составу', MN2O7_PRODUCT_IDS.filter((id) => id.startsWith('mn')).length === prod.get('Mn') && MN2O7_PRODUCT_IDS.filter((id) => id.startsWith('o')).length === prod.get('O'))
  // Распад: Mn +7 → +4 (MnO₂), O −2 → 0 (O₂): отдано = принято.
  const mnIV = mnOxidationState(1, 2, 0)
  const gained = MN2O7_DECOMP_COEF.mno2 * (MN_OX - mnIV)
  const oxO = 8 - ATOMIC_DATA.O.valenceElectrons
  const lost = MN2O7_DECOMP_COEF.o2 * 2 * oxO
  ok('распад Mn₂O₇: электронный баланс (Mn принимает = O отдаёт)', gained === lost, `${gained} / ${lost}`)
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
  const allowed3d = [PM.mnO4, PM.term, PM.bridge, PM.sulfate, DEG.mnOMn, MN2O7_DHF_KJ, MN2O7_DECOMP_DH_KJ, MN_OX, MN2O7_DECOMP_COEF.mn2o7, MN2O7_DECOMP_COEF.mno2, MN2O7_DECOMP_COEF.o2]
  for (const l of MN2O7_LABELS) {
    for (const k of l.keys) {
      const bare = k.text.replace(/\{\w+\}/g, '')
      ok(`подпись ${l.id}: без кириллицы`, !/[А-Яа-яЁё]/.test(bare), k.text)
      ok(`подпись ${l.id}: без фраз`, !/[a-z]{3,}/.test(bare), k.text)
      ok(`подпись ${l.id}: единицы только токенами`, !/\b(pm|kJ\/mol|kJ)\b/.test(bare) && !/\((s|g|l|aq)\)/.test(bare), k.text)
      if (l.id === 'd0') continue
      for (const n of numbers(bare)) ok(`подпись ${l.id}: число ${n.raw} из ядра`, allowed3d.some((v) => matches(n, v)), k.text)
    }
  }
  const text = (id: string) => MN2O7_LABELS.find((l) => l.id === id)!.keys[0]!.text
  ok('подпись d(MnO₄⁻) = ядро', hasValue(text('dMnO4'), PM.mnO4) && numbers(text('dMnO4')).length === 1)
  ok('подпись концевой связи = ядро', hasValue(text('dTerm'), PM.term) && numbers(text('dTerm')).length === 1)
  ok('подпись мостиковой связи = ядро', hasValue(text('dBridge'), PM.bridge) && numbers(text('dBridge')).length === 1)
  ok('подпись угла Mn–O–Mn = ядро', hasValue(text('angle'), DEG.mnOMn))
  ok('подпись S–O сульфата = ядро', hasValue(text('dSO4'), PM.sulfate))
  const dhf = numbers(text('dHf'))[0]!
  ok('подпись ΔH°f = ядро со знаком; «≈» ⇔ оценка', dhf.sign === -1 && matches(dhf, MN2O7_DHF_KJ) && text('dHf').includes('≈') === (FORMATION_ENTHALPY['Mn2O7(l)']!.estimated === true))
  const dec = numbers(text('dHdec')).find((n) => n.sign !== 0)!
  ok('подпись ΔH разложения = ядро со знаком', dec.sign === -1 && matches(dec, MN2O7_DECOMP_DH_KJ))
  ok('подпись-уравнение разложения: коэффициенты = ядро', numbers(text('decomp')).map((n) => n.v).join(',') === [MN2O7_DECOMP_COEF.mn2o7, MN2O7_DECOMP_COEF.mno2, MN2O7_DECOMP_COEF.o2].join(','))
  ok('подпись степени окисления Mn = MN_OX со знаком', numbers(text('oxA'))[0]!.sign === 1 && numbers(text('oxA'))[0]!.v === MN_OX && text('oxA') === text('oxB'))
  const shell = Number(/(\d)d/.exec(ATOMIC_DATA.Mn.configuration)![1])
  ok('подпись «3d⁰»: оболочка из конфигурации ядра, d⁰ = 7 − 7', text('d0') === `${shell}d⁰` && ATOMIC_DATA.Mn.valenceElectrons - MN_OX === 0 && MN_D_LABEL === text('d0'))

  const known = new Set(Object.keys(SCENE_LABEL_TOKENS.ru))
  for (const token of labelTokensUsed(MN2O7_LABELS)) ok(`токен {${token}} есть в словаре`, known.has(token))
  for (const locale of LOCALES) {
    const states = createLabelStates(MN2O7_LABELS)
    localizeSceneLabels(states, locale)
    for (const st of states) ok(`[${locale}] подпись ${st.id} раскрыта`, !/\{\w+\}/.test(st.text) && st.text.trim().length > 0)
  }
  const ru = createLabelStates(MN2O7_LABELS)
  const en = createLabelStates(MN2O7_LABELS)
  localizeSceneLabels(ru, 'ru')
  localizeSceneLabels(en, 'en')
  ok('подписи ru отличаются от en (единицы переведены)', ru.some((s, i) => s.text !== en[i]!.text))
  for (const locale of ['ru', 'uz'] as const) {
    const st = createLabelStates(MN2O7_LABELS)
    localizeSceneLabels(st, locale, true)
    const g = st.find((x) => x.id === 'dTerm')!.text
    ok(`[${locale}] 3D-число с десятичной запятой: «${g}»`, g.includes(String(PM.term).replace('.', ',')) && !/\d\.\d/.test(st.map((x) => x.text).join(' ')))
  }
  for (const l of MN2O7_LABELS) for (const w of l.windows) ok(`окно подписи ${l.id}`, w[0] < w[1] && w[0] >= 0 && w[1] <= MN2O7_END + 1e-9)
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Тексты урока: числа ↔ ядро, привязка, синхронность языков
// ─────────────────────────────────────────────────────────────────────────────

const stage = (id: Parameters<typeof mn2o7StageKJ>[0]) => mn2o7StageKJ(id)
const abs = Math.abs
/** Внешние константы (стандартные условия), которых нет в ядре: 25 °C. */
const EXTERNAL = [25]
const CORE_VALUES: number[] = [
  PM.mnO4,
  PM.term,
  PM.bridge,
  PM.sDouble,
  PM.sOH,
  PM.sulfate,
  PM.ohWater,
  DEG.mnOMn,
  DEG.oMnO,
  DEG.sOH,
  DEG.water,
  radiusForSpecies('K', 1),
  oxoanionBondOrder(4, -1),
  oxoanionBondOrder(4, -2),
  stage('kmno4'),
  -dHfKJ('KMnO4(s)'),
  stage('h2so4'),
  stage('k2so4'),
  stage('h2o'),
  stage('mn2o7'),
  MN2O7_LADDER.sumKJ,
  MN2O7_KHSO4_DH_KJ,
  MN2O7_DECOMP_DH_KJ,
  ...EXTERNAL,
]
/** Малые целые — счёт и коэффициенты (2 KMnO₄, КЧ 6, +7, 3d, 7/2, 7 и 9 класс). */
const isCount = (n: Num) => n.dec === 0 && n.v <= 12

const fields = (t: Mn2o7MechanismText): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const id of MN2O7_STEP_IDS) {
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

const numbersByField: Record<Mn2o7Locale, Record<string, string>> = { ru: {}, en: {}, uz: {} }
for (const locale of LOCALES) {
  const t = getMn2o7MechanismText(locale)
  ok(`[${locale}] заголовок и безопасность`, t.intro.title.length > 0 && t.safety.length > 40)
  for (const id of MN2O7_STEP_IDS) {
    const s = t.steps[id]
    ok(`[${locale}] ${id}: заголовок, уравнение, реплика`, s.title.trim().length > 0 && s.equation.trim().length > 0 && s.speak.trim().length > 0)
    ok(`[${locale}] ${id}: 2–4 предложения`, s.body.split(/[.!?]\s/).length >= 2)
    ok(`[${locale}] ${id}: есть note`, (s.note ?? '').length > 0)
  }
  ok(`[${locale}] aria-подпись лестницы`, t.energy.summary.includes('{dH}'))
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

  // Сумма Гесса в тексте: слагаемые в скобках = ступени ядра по порядку, итог = ΔH реакции ядра.
  {
    const body = t.steps.energy.body
    const terms = [...body.matchAll(/\(([+−-])(\d+(?:[.,]\d+)?)\)/g)].map((m) => (m[1] === '+' ? 1 : -1) * Number(m[2]!.replace(',', '.')))
    const lastParen = body.lastIndexOf(')', body.indexOf('='))
    const res = /=\s*([+−-])(\d+(?:[.,]\d+)?)/.exec(body.slice(lastParen))!
    const total = (res[1] === '+' ? 1 : -1) * Number(res[2]!.replace(',', '.'))
    const ladder = MN2O7_LADDER.stages.map((s) => s.dH)
    ok(`[${locale}] сумма в тексте: слагаемые = ступени ядра по порядку`, terms.length === ladder.length && terms.every((v, i) => near(v, ladder[i]!, 0.05)), terms.join(' '))
    ok(`[${locale}] сумма в тексте сходится арифметически`, near(terms.reduce((s, v) => s + v, 0), total, 0.05))
    ok(`[${locale}] итог суммы = ΔH реакции ядра со знаком`, near(total, formationReactionKJ('mn2o7_textbook'), 0.05))
    const eqn = numbers(t.steps.energy.equation).find((n) => !isCount(n))!
    ok(`[${locale}] ΔH разложения в уравнении — со знаком ядра`, eqn.sign === -1 && matches(eqn, MN2O7_DECOMP_DH_KJ))
    const kh = numbers(t.steps.energy.note).find((n) => !isCount(n))!
    ok(`[${locale}] ΔH варианта с KHSO₄ — со знаком ядра`, kh.sign === (MN2O7_KHSO4_DH_KJ < 0 ? -1 : 1) && matches(kh, MN2O7_KHSO4_DH_KJ))
    const dhf = numbers(t.steps.liquid.equation).find((n) => !isCount(n))!
    ok(`[${locale}] ΔH°f(Mn₂O₇) в уравнении шага 5 — со знаком ядра`, dhf.sign === -1 && matches(dhf, MN2O7_DHF_KJ))
  }
  // Степени окисления, названные в уравнении шага 4, — из электронейтральности Mn₂O₇.
  {
    const ox = numbers(t.steps.molecule.equation).filter((n) => n.sign !== 0)
    ok(`[${locale}] уравнение шага 4: Mn +${MN_OX}, O −(8 − 6)`, ox.length === 2 && ox[0]!.sign === 1 && ox[0]!.v === MN_OX && ox[1]!.sign === -1 && ox[1]!.v === 8 - ATOMIC_DATA.O.valenceElectrons)
    // Степени окисления пишутся знаком вплотную к числу («+7»); коэффициенты уравнения — через пробел («+ 2»).
    const redox = numbers(t.steps.energy.note).filter((n) => /^[+−-]\d/.test(n.raw) && isCount(n)).map((n) => n.sign * n.v)
    ok(`[${locale}] распад: Mn +7 → +4, O −2 → 0 (из электронейтральности)`, redox.join(',') === [MN_OX, mnOxidationState(1, 2, 0), -(8 - ATOMIC_DATA.O.valenceElectrons)].join(','))
  }
}

// ─── Привязка «число ↔ величина» (по порядку в тексте ru) и та же последовательность в en / uz ───
{
  const seq = (s: string) => numbers(s).filter((n) => !isCount(n)).map((n) => n.v)
  const sameSeq = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => near(v, b[i]!, 1e-9))
  const expect: Record<string, number[]> = {
    'reactants.body': [PM.mnO4, DEG.oMnO, PM.sDouble, PM.sOH, 25],
    'reactants.note': [radiusForSpecies('K', 1), oxoanionBondOrder(4, -1)],
    'protonation.body': [PM.sulfate],
    'protonation.note': [DEG.sOH, oxoanionBondOrder(4, -2)],
    'condensation.note': [PM.ohWater, DEG.water],
    'molecule.body': [PM.term, PM.bridge, DEG.mnOMn, PM.mnO4],
    'molecule.note': [DEG.oMnO],
    'liquid.body': [25, abs(MN2O7_DHF_KJ)],
    'liquid.equation': [abs(MN2O7_DHF_KJ)],
    'energy.body': [stage('kmno4'), stage('h2so4'), abs(stage('k2so4')), abs(stage('h2o')), abs(stage('mn2o7')), MN2O7_LADDER.sumKJ, -dHfKJ('KMnO4(s)'), abs(MN2O7_DECOMP_DH_KJ), 25],
    'energy.equation': [abs(MN2O7_DECOMP_DH_KJ)],
    'energy.note': [abs(MN2O7_KHSO4_DH_KJ)],
    legend: [oxoanionBondOrder(4, -1), oxoanionBondOrder(4, -2)],
  }
  const ru = fields(getMn2o7MechanismText('ru'))
  for (const [key, want] of Object.entries(expect)) {
    const got = numbers(ru[key]!).filter((n) => !isCount(n))
    ok(`[ru] ${key}: числа стоят на своих местах`, got.length === want.length && got.every((n, i) => matches(n, want[i]!)), `${got.map((n) => n.v).join(' ')} | ожидалось ${want.map((v) => v.toFixed(2)).join(' ')}`)
  }
  for (const locale of ['en', 'uz'] as const) {
    const f = fields(getMn2o7MechanismText(locale))
    for (const key of Object.keys(f)) ok(`[${locale}] ${key}: порядок чисел как в ru`, sameSeq(seq(f[key]!), seq(ru[key]!)), `${seq(f[key]!).join(' ')} | ru ${seq(ru[key]!).join(' ')}`)
  }
}
for (const key of Object.keys(numbersByField.ru)) {
  ok(`числа поля ${key} совпадают в ru/en`, numbersByField.ru[key] === numbersByField.en[key], `${numbersByField.ru[key]} | ${numbersByField.en[key]}`)
  ok(`числа поля ${key} совпадают в ru/uz`, numbersByField.ru[key] === numbersByField.uz[key], `${numbersByField.ru[key]} | ${numbersByField.uz[key]}`)
}

console.log(`✓ mn2o7 cinema: ${checks} проверок пройдено`)
console.log(`  шагов ${MN2O7_STEPS.length}, экранное время ${wall.toFixed(1)} с (${MN2O7_STEPS.map((s) => s.wall).join(' + ')} + хвост), сюжет ${MN2O7_END} с`)
console.log(`  Гесс: Σ = ${MN2O7_LADDER.sumKJ} кДж (ядро ${formationReactionKJ('mn2o7_textbook')}, оценка), с KHSO₄ ${MN2O7_KHSO4_DH_KJ}, распад ${MN2O7_DECOMP_DH_KJ}`)
console.log(`  Mn₂O₇: ${PM.term} / ${PM.bridge} пм, ∠Mn–O–Mn ${DEG.mnOMn}°; MnO₄⁻ ${PM.mnO4} пм`)
