#!/usr/bin/env node
/**
 * ATOMLAB — школьная сцена «обмен в растворе»: BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl (scenes/school/solution,
 * scenes/baso4). Модель кадра sampleSolutionState проверяется на всём сюжете с шагом 1/60 с.
 *
 *   1. Время: шесть шагов SOLUTION_STEP_IDS подряд, 26–34 с; в хвосте embryo → birth → complete.
 *   2. Частицы = уравнению: 1 Ba²⁺, 2 Cl⁻ | 2 H₃O⁺, 1 SO₄²⁻ (H₂SO₄ + 2H₂O); сумма зарядов видимых частиц = 0
 *      в каждом кадре; число атомов каждого элемента постоянно.
 *   3. Размеры = ядру: шар иона = радиус Шеннона × ballScale (Ba²⁺ КЧ 8 в воде → КЧ 12 в кристалле, смена —
 *      один раз, в кадр посадки; Cl⁻ 181); SO₄ жёсткий (S–O 147 ± 0,5 пм, ∠O–S–O 109,47 ± 0,5°) в каждом кадре;
 *      H₃O⁺ и вода — длины и углы ядра.
 *   4. Кристалл: узлы Ba и S = решётке барита ядра (Hill 1977) ± 0,5 пм, в конце шага «кристаллик» все узлы
 *      заняты; Ba–O ≥ кратчайшего в барите − 0,5 пм; наблюдатели H₃O⁺ и Cl⁻ в кристалл не садятся.
 *   5. Осадок: муть ∈ [0, 1], образовавшийся осадок и слой на дне не убывают; частицы мути после сливания
 *      движутся только вниз (или лежат на слое осадка).
 *   6. Плавность: видимые атомы не прыгают между кадрами (≤ 40 пм за 1/60 с).
 *   7. Подключение: сигнатура {BaCl₂, H₂SO₄} (не Ba(OH)₂ + H₂SO₄ и не CuSO₄ + BaCl₂), реактор, банк 7–9 кл.
 *      без нагрева, карточка BaSO₄ → сцена, ссылка учебника 7 кл. с. 67 и 8 кл. с. 139, урок панели, герой.
 *
 * Запуск: npx tsx scripts/test-solution-scene.mts
 */
import { readFileSync } from 'node:fs'
import { CRYSTAL_DATA, ionicRadiusPm, reagentAngleDeg, reagentBondPm, bondLengthPm, bondAngleDeg } from '../src/chemistry/data/index.ts'
import { getSchoolReaction } from '../src/chemistry/schoolReactionBank.ts'
import { latticeGroupedFragment } from '../src/lab/cinema/scenes/kit/lattice.ts'
import { buildSolutionModel, createSolutionState, sampleSolutionState, solutionMoments, SOLUTION_DRAW } from '../src/lab/cinema/scenes/school/solution/solutionModel.ts'
import { BASO4_SOLUTION_SPEC } from '../src/lab/cinema/scenes/school/solution/solutionSpec.ts'
import { SOLUTION_STEP_IDS } from '../src/lab/cinema/scenes/school/specs/types.ts'
import { BASO4_SPEC } from '../src/lab/cinema/scenes/school/specs/baso4.ts'
import { resolveReactorEquation } from '../src/lab/reactorDeepLink.ts'
import { effectiveLabNeeds } from '../src/lab/reactionLabNeeds.ts'
import { reactorLinkHasScene, schoolSceneLinkForCompound, SOLUTION_SCENE_REACTIONS } from '../src/lab/schoolSceneLinks.ts'
import { scientificSceneFor } from '../src/lab/scientificSynthesis/sceneSignatures.ts'
import { getCinemaLesson } from '../src/lab/cinema/scenes/lessons.ts'
import { buildHeroModel } from '../src/components/lab/hero/heroGeometry.ts'
import { pmToScene } from '../src/lab/cinema/scenes/kit/cpkAtoms.ts'

let checks = 0
const failures: string[] = []
function ok(name: string, cond: boolean, detail?: unknown): void {
  checks++
  if (!cond && failures.length < 400) failures.push(detail === undefined ? name : `${name} — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol

const m = buildSolutionModel(BASO4_SOLUTION_SPEC)
const T = solutionMoments(m)
const s = createSolutionState(m)
const P = (i: number): [number, number, number] => [s.atomPos[i * 3]!, s.atomPos[i * 3 + 1]!, s.atomPos[i * 3 + 2]!]
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!)
const angle = (a: readonly number[], c: readonly number[], b: readonly number[]) => {
  const u = [a[0]! - c[0]!, a[1]! - c[1]!, a[2]! - c[2]!]
  const v = [b[0]! - c[0]!, b[1]! - c[1]!, b[2]! - c[2]!]
  return (Math.acos((u[0]! * v[0]! + u[1]! * v[1]! + u[2]! * v[2]!) / (Math.hypot(...u) * Math.hypot(...v))) * 180) / Math.PI
}

// ─── 1. Время ────────────────────────────────────────────────────────────────
{
  const st = m.timing.steps
  ok('шесть шагов обмена в растворе по порядку', st.map((x) => x.id).join() === SOLUTION_STEP_IDS.join())
  ok('шаги сплошные', st.every((x, i) => i === 0 || x.from === st[i - 1]!.to) && st[0]!.from === 0)
  const total = st[st.length - 1]!.to
  ok('всего 26–34 с', total >= 26 && total <= 34, total)
  const at = (id: string) => m.timing.cues.find((c) => c.id === id)?.at ?? NaN
  ok('хвост: embryo → birth → complete после последнего шага', at('embryo') >= total && at('embryo') <= at('birth') && at('birth') < at('complete'))
  m.timing.validate()
}

// ─── 2. Частицы = уравнению ─────────────────────────────────────────────────
const R = m.roles
const body = (i: number) => m.bodies[i]!
{
  ok('катион — один Ba²⁺', body(R.cation).formula === 'Ba²⁺' && body(R.cation).charge === 2)
  ok('два Cl⁻', R.anions.length === 2 && R.anions.every((i) => body(i).formula === 'Cl⁻' && body(i).charge === -1))
  ok('два H₃O⁺', R.protons.length === 2 && R.protons.every((i) => body(i).formula === 'H₃O⁺' && body(i).charge === 1))
  ok('один SO₄²⁻ (S и 4 O)', body(R.group).formula === 'SO₄²⁻' && body(R.group).charge === -2 && body(R.group).atoms.map((a) => m.atoms[a]!.el).join() === 'S,O,O,O,O')
  // Уравнение спецификации: BaCl₂ → Ba²⁺ + 2Cl⁻; H₂SO₄ + 2H₂O → 2H₃O⁺ + SO₄²⁻
  const want = { Ba: 1, Cl: 2, H3O: 2, SO4: 1 }
  const r = BASO4_SPEC.reaction
  const got: Record<string, number> = {}
  for (const t of r.reactants) for (const x of t.particles) got[x.particle] = (got[x.particle] ?? 0) + x.count * t.coef
  ok('реагенты спецификации = частицам сцены', JSON.stringify(got) === JSON.stringify(want), got)
  const prod: Record<string, number> = {}
  for (const t of r.products) for (const x of t.particles) prod[x.particle] = (prod[x.particle] ?? 0) + x.count * t.coef
  ok('продукты: 1 BaSO₄ (осадок) + 2 H₃O⁺ + 2 Cl⁻ (соляная кислота)', prod.BaSO4 === 1 && prod.H3O === 2 && prod.Cl === 2)
  ok('наблюдатели не садятся в кристалл', [...R.anions, ...R.protons].every((i) => !body(i).land))
  ok('катион и группа садятся в одну посадку', body(R.cation).land?.t === body(R.group).land?.t)
  ok('кристалл: зародыш + наша пара + следующие = целые ячейки', (R.lattice.length / 2 + 1 + R.later.length / 2) === CRYSTAL_DATA.barite!.z * BASO4_SOLUTION_SPEC.crystalCells.reduce((a, b) => a * b, 1))
}

// ─── 3–6. По кадрам ──────────────────────────────────────────────────────────
const core = m.core
const SO = reagentBondPm('sulfate', 'S–O')
const OSO = reagentAngleDeg('sulfate', '∠O–S–O')
ok('ядро: Ba²⁺ КЧ 8 = 142, КЧ 12 = 161 (Шеннон)', ionicRadiusPm('Ba', 2, 8) === 142 && ionicRadiusPm('Ba', 2, 12) === 161)
ok('ядро: радиусы сцены = ядру', core.baWater === 142 && core.baCrystal === 161 && core.cl === ionicRadiusPm('Cl', -1))
const counts0: Record<string, number> = {}
for (const a of m.atoms) counts0[a.el] = (counts0[a.el] ?? 0) + 1
const radiusChanges = new Map<number, number>()
const prevR = new Float32Array(m.atoms.length).fill(-1)
const prevPos = new Float32Array(m.atoms.length * 3)
let prevVisible = new Uint8Array(m.atoms.length)
let prevFormed = -1
let prevSed = -1
const prevTurb = new Float32Array(m.turbidPoints)
let minSpectatorToNode = Infinity
let maxJump = 0
let jumpAt = ''
const end = m.timing.end
const dt = 1 / 60
const sulfates = m.bodies.map((b, i) => ({ b, i })).filter((x) => x.b.formula === 'SO₄²⁻')
const hydroniums = m.bodies.map((b, i) => ({ b, i })).filter((x) => x.b.formula === 'H₃O⁺')
const waters = m.bodies.map((b, i) => ({ b, i })).filter((x) => x.b.formula === 'H₂O')
for (let k = 0; k * dt <= end + 1e-9; k++) {
  const t = Math.min(end, k * dt)
  sampleSolutionState(m, t, s)
  const micro = s.microAlpha > 0.01
  // заряды видимых частиц
  if (micro) {
    let q = 0
    m.bodies.forEach((b, i) => {
      if (s.bodyAppear[i]! > 0.001) q += b.charge
    })
    ok(`t=${t.toFixed(3)}: сумма зарядов видимых частиц = 0`, q === 0, q)
  }
  // радиусы ионов
  for (let i = 0; i < m.atoms.length; i++) {
    const a = m.atoms[i]!
    const b = m.bodies[a.body]!
    const ap = s.bodyAppear[a.body]!
    if (ap <= 0.001) continue
    const rPm = s.atomR[i]! / SOLUTION_DRAW.ballScale / ap
    if (a.el === 'Ba') {
      const expect = b.land ? (t >= b.land.t ? 161 : 142) : 161
      ok(`t=${t.toFixed(3)} ${b.id}: радиус Ba²⁺ = Шеннону (${expect})`, near(rPm, expect, 0.5), rPm)
      if (prevR[i]! >= 0 && Math.abs(prevR[i]! - rPm) > 0.5) radiusChanges.set(i, (radiusChanges.get(i) ?? 0) + 1)
      prevR[i] = rPm
    }
    if (a.el === 'Cl') ok(`t=${t.toFixed(3)} ${b.id}: Cl⁻ = 181`, near(rPm, 181, 0.5), rPm)
  }
  // жёсткий SO₄
  for (const { b, i } of sulfates) {
    if (s.bodyAppear[i]! <= 0.001) continue
    const [S0, ...Os] = b.atoms
    for (const o of Os) ok(`t=${t.toFixed(3)} ${b.id}: S–O = ${SO}`, near(dist(P(S0!), P(o)), SO, 0.5), dist(P(S0!), P(o)))
    for (let x = 0; x < 4; x++) for (let y = x + 1; y < 4; y++) ok(`t=${t.toFixed(3)} ${b.id}: ∠O–S–O = ${OSO}`, near(angle(P(Os[x]!), P(S0!), P(Os[y]!)), OSO, 0.5))
  }
  if (k % 6 === 0) {
    for (const { b } of hydroniums) {
      const [O, ...H] = b.atoms
      for (const h of H) ok(`t=${t.toFixed(3)} ${b.id}: O–H (H₃O⁺)`, near(dist(P(O!), P(h)), core.h3oOH, 0.5))
      ok(`t=${t.toFixed(3)} ${b.id}: ∠H–O–H (H₃O⁺)`, near(angle(P(H[0]!), P(O!), P(H[1]!)), core.h3oHOH, 0.5))
    }
    for (const { b } of waters) {
      const [O, H1, H2] = b.atoms
      ok(`t=${t.toFixed(3)} ${b.id}: O–H воды`, near(dist(P(O!), P(H1!)), bondLengthPm('O-H'), 0.5) && near(dist(P(O!), P(H2!)), bondLengthPm('O-H'), 0.5))
      ok(`t=${t.toFixed(3)} ${b.id}: угол воды`, near(angle(P(H1!), P(O!), P(H2!)), bondAngleDeg('water'), 0.5))
    }
  }
  // наблюдатели далеко от узлов кристалла
  if (micro && s.crystal.alpha > 0.5) {
    // узлы, уже занятые в кристалле: зародыш и севшие пары (идущие к кристаллу ионы — ещё в растворе)
    const seated = (i: number) => s.bodyAppear[i]! > 0.5 && (!m.bodies[i]!.land || t >= m.bodies[i]!.land!.t)
    const nodes = [...R.lattice, R.cation, R.group, ...R.later].filter(seated).map((i) => P(m.bodies[i]!.atoms[0]!))
    for (const sp of [...R.anions, ...R.protons]) for (const a of m.bodies[sp]!.atoms) for (const n of nodes) minSpectatorToNode = Math.min(minSpectatorToNode, dist(P(a), n))
  }
  // осадок
  ok(`t=${t.toFixed(3)}: муть в [0, 1]`, s.turbidity >= 0 && s.turbidity <= 1)
  ok(`t=${t.toFixed(3)}: осадка образуется всё больше`, s.formed >= prevFormed - 1e-9)
  ok(`t=${t.toFixed(3)}: слой на дне не убывает`, s.sediment >= prevSed - 1e-9)
  const sedTop = m.tube.r * 0.25 + s.sediment * m.tube.h
  if (t > T.pour1 + 1e-6) {
    for (let i = 0; i < m.turbidPoints; i++) {
      const y = s.turbidPos[i * 3 + 1]!
      if (prevTurb[i]! > 0 && y > sedTop + 0.01) ok(`t=${t.toFixed(3)}: частица мути ${i} не поднимается`, y <= prevTurb[i]! + 0.01)
    }
  }
  for (let i = 0; i < m.turbidPoints; i++) prevTurb[i] = s.turbidPos[i * 3 + 1]!
  prevFormed = s.formed
  prevSed = s.sediment
  // плавность видимых атомов
  const vis = new Uint8Array(m.atoms.length)
  for (let i = 0; i < m.atoms.length; i++) vis[i] = micro && s.atomR[i]! > 0 ? 1 : 0
  if (k > 0) {
    for (let i = 0; i < m.atoms.length; i++) {
      if (!vis[i] || !prevVisible[i]) continue
      const d = Math.hypot(s.atomPos[i * 3]! - prevPos[i * 3]!, s.atomPos[i * 3 + 1]! - prevPos[i * 3 + 1]!, s.atomPos[i * 3 + 2]! - prevPos[i * 3 + 2]!)
      if (d > maxJump) {
        maxJump = d
        jumpAt = `${m.bodies[m.atoms[i]!.body]!.id} t=${t.toFixed(3)}`
      }
    }
  }
  prevPos.set(s.atomPos)
  prevVisible = vis
}
ok('видимые атомы не прыгают (≤ 40 пм за 1/60 с)', maxJump <= 40, `${maxJump.toFixed(1)} пм (${jumpAt})`)
ok('радиус Ba²⁺ меняется ровно один раз — в кадр посадки', [m.bodies[R.cation]!.atoms[0]!].every((a) => radiusChanges.get(a) === 1), [...radiusChanges.entries()])
for (const i of R.later) if (m.bodies[i]!.formula === 'Ba²⁺') ok(`${m.bodies[i]!.id}: радиус меняется один раз`, radiusChanges.get(m.bodies[i]!.atoms[0]!) === 1)
ok('наблюдатели H₃O⁺ и Cl⁻ не ближе 300 пм к узлам кристалла', minSpectatorToNode >= 300, minSpectatorToNode.toFixed(1))
{
  const counts: Record<string, number> = {}
  for (const a of m.atoms) counts[a.el] = (counts[a.el] ?? 0) + 1
  ok('число атомов каждого элемента постоянно', JSON.stringify(counts) === JSON.stringify(counts0))
}

// ─── 8. Макро: физика пробирок, струя, без провалов ──────────────────────────
// Пробирка — тело вращения: дно-полусфера радиуса R, стенка R, у устья отогнутый край 1,1R (+ толщина).
// Стенки не пересекаются ни в одном кадре: точки поверхности одной пробирки лежат вне тела другой.
{
  const { r: TR, h: TH } = m.tube
  const outerR = (h: number) => (h > TH - 0.15 * TR ? 1.15 * TR : 1.02 * TR)
  /** Расстояние со знаком от точки (система пробирки: ось y от дна-кончика) до тела пробирки. */
  const sdTube = (x: number, y: number, z: number) => {
    const rho = Math.hypot(x, z)
    const top = TH + 0.05 * TR
    if (y > top) return Math.hypot(Math.max(0, rho - 1.15 * TR), y - top)
    if (y >= TR) return rho - outerR(y)
    return Math.hypot(rho, y - TR) - 1.02 * TR
  }
  const surface: [number, number, number][] = []
  for (let h = 0; h <= TH; h += 18) {
    const rho = h < TR ? Math.sqrt(Math.max(0, TR * TR - (TR - h) ** 2)) : TR
    for (let k = 0; k < 24; k++) surface.push([rho * Math.cos((k * Math.PI) / 12), h, rho * Math.sin((k * Math.PI) / 12)])
  }
  for (let k = 0; k < 36; k++) {
    const a = (k * Math.PI) / 18
    for (const rr of [1.055 * TR, 1.145 * TR]) surface.push([rr * Math.cos(a), TH, rr * Math.sin(a)])
    surface.push([1.1 * TR * Math.cos(a), TH - 0.045 * TR, 1.1 * TR * Math.sin(a)])
  }
  const toWorld = (p: readonly number[], x0: number, y0: number, rot: number) => [x0 + p[0]! * Math.cos(rot) - p[1]! * Math.sin(rot), y0 + p[0]! * Math.sin(rot) + p[1]! * Math.cos(rot), p[2]!]
  const toLocal = (w: readonly number[], x0: number, y0: number, rot: number) => {
    const dx = w[0]! - x0
    const dy = w[1]! - y0
    return [dx * Math.cos(rot) + dy * Math.sin(rot), -dx * Math.sin(rot) + dy * Math.cos(rot), w[2]!]
  }
  let minGap = Infinity
  let gapAt = ''
  let streamBad = 0
  let streamFrames = 0
  let maxTubeJump = 0
  let prevB: number[] | null = null
  for (let k = 0; k * dt <= m.step.tubes.to + 0.6; k++) {
    const t = k * dt
    sampleSolutionState(m, t, s)
    const A = s.tubeA
    const B = s.tubeB
    if (B.alpha > 0.01 && s.macroAlpha > 0.01) {
      let g = Infinity
      for (const p of surface) {
        const w = toWorld(p, B.x, B.y, B.rot)
        const l = toLocal(w, A.x, A.y, A.rot)
        g = Math.min(g, sdTube(l[0]!, l[1]!, l[2]!))
        const w2 = toWorld(p, A.x, A.y, A.rot)
        const l2 = toLocal(w2, B.x, B.y, B.rot)
        g = Math.min(g, sdTube(l2[0]!, l2[1]!, l2[2]!))
      }
      if (g < minGap) {
        minGap = g
        gapAt = `t=${t.toFixed(3)}`
      }
      if (prevB) maxTubeJump = Math.max(maxTubeJump, Math.hypot(B.x - prevB[0]!, B.y - prevB[1]!), Math.abs(B.rot - prevB[2]!) * TH)
      prevB = [B.x, B.y, B.rot]
    }
    // струя: ниже кромки A — внутри устья (не задевает стекло), кончается на поверхности жидкости A
    if (s.stream.alpha > 0.01) {
      streamFrames++
      const topA = A.y + TH
      for (let i = 0; i < 18; i++) {
        const x = s.stream.pts[i * 3]!
        const y = s.stream.pts[i * 3 + 1]!
        const r = s.stream.rad[i]!
        if (y <= topA + 1 && Math.abs(x - A.x) + r > 0.9 * TR) streamBad++
        if (y < A.surface - 0.5) streamBad++
      }
    }
  }
  ok('стенки пробирок не пересекаются ни в одном кадре (зазор > 0)', minGap > 0, `${minGap.toFixed(1)} пм (${gapAt})`)
  ok('струя течёт в устье A и кончается на поверхности жидкости', streamFrames > 30 && streamBad === 0, { streamFrames, streamBad })
  ok('пробирка B движется плавно (≤ 60 пм за 1/60 с)', maxTubeJump <= 60, maxTubeJump.toFixed(1))
}
{
  // В каждый момент хотя бы один слой — макро или микро — виден; на паузе между шагами кадр целиком в одном слое.
  let worst = Infinity
  let worstAt = ''
  const lastTo = m.timing.steps[m.timing.steps.length - 1]!.to
  for (let k = 0; k * dt <= lastTo + 1e-9; k++) {
    const t = Math.min(lastTo, k * dt)
    sampleSolutionState(m, t, s)
    const v = Math.max(s.macroAlpha, s.microAlpha)
    if (v < worst) {
      worst = v
      worstAt = `t=${t.toFixed(3)}`
    }
  }
  ok('нет «провалов»: хотя бы один слой виден ≥ 0,5 в каждом кадре', worst >= 0.5, `${worst.toFixed(3)} (${worstAt})`)
  for (const st of m.timing.steps) {
    sampleSolutionState(m, st.to, s)
    ok(`пауза после шага «${st.id}»: кадр целиком в одном слое`, Math.max(s.macroAlpha, s.microAlpha) >= 0.98 && Math.min(s.macroAlpha, s.microAlpha) <= 0.02, [s.macroAlpha, s.microAlpha])
  }
  // шаг «осадок»: одна пробирка (вторая убрана), выноски видны
  sampleSolutionState(m, m.step.settle.to - 0.05, s)
  ok('шаг «осадок»: в кадре одна пробирка', s.tubeB.alpha === 0 && s.macroAlpha > 0.98)
  ok('шаг «осадок»: выноски к осадку и к раствору', s.calloutAlpha[0]! > 0.9 && s.calloutAlpha[1]! > 0.9)
  ok('шаг «осадок»: цель выноски осадка — в слое на дне', s.callouts[1]! <= s.tubeA.y + m.tube.r * 0.25 + s.sediment * m.tube.h + 1)
  ok('шаг «осадок»: цель выноски раствора — в жидкости над осадком', s.callouts[7]! > s.tubeA.y + m.tube.r * 0.25 + s.sediment * m.tube.h && s.callouts[7]! < s.tubeA.surface)
  // HNO₃: капли падают в раствор, осадок после них не убывает
  const T8 = solutionMoments(m)
  sampleSolutionState(m, T8.drop0 - 0.05, s)
  const sedBefore = s.sediment
  let dropsSeen = 0
  for (let t = T8.drop0; t < T8.drop0 + 1.4; t += dt) {
    sampleSolutionState(m, t, s)
    for (let d = 0; d < 3; d++) if (s.drops[d * 4 + 3]! > 0 && s.drops[d * 4 + 1]! < s.tubeA.y + m.tube.h) dropsSeen |= 1 << d
  }
  ok('HNO₃: три капли падают в пробирку', dropsSeen === 7, dropsSeen)
  sampleSolutionState(m, m.step.settle.to, s)
  ok('HNO₃: осадок не растворяется (слой не убывает)', s.sediment >= sedBefore - 1e-9)
}

// ─── 4. Кристалл = решётке барита ────────────────────────────────────────────
{
  const frag = latticeGroupedFragment('barite', [...BASO4_SOLUTION_SPEC.crystalCells] as [number, number, number], [{ center: 'S', ligand: 'O', ligands: 4 }])
  const latticeNodes = frag.sites.filter((x) => x.role !== 'ligand')
  for (const site of m.sites) {
    const hit = latticeNodes.some((n) => n.el === site.el && dist(n.posPm, site.pos) <= 0.5)
    ok(`узел ${site.el} (${site.pos.map((v) => v.toFixed(0)).join(', ')}) — узел решётки барита`, hit)
  }
  ok('все узлы ячеек заняты', m.sites.length === latticeNodes.length, `${m.sites.length} / ${latticeNodes.length}`)
  // в конце шага «кристаллик» и на итоге: каждый узел занят своей частицей (в системе кристалла ± 0,5 пм)
  for (const t of [m.step.nucleus.to - 0.01, m.step.result.to - 0.01]) {
    sampleSolutionState(m, t, s)
    const c = s.crystal.c
    const yaw = s.crystal.yaw
    const toLocal = (p: readonly number[]) => {
      const x = p[0]! - c[0]
      const y = p[1]! - c[1]
      const z = p[2]! - c[2]
      // обратный поворот вокруг y на −yaw
      return [x * Math.cos(yaw) - z * Math.sin(yaw), y, x * Math.sin(yaw) + z * Math.cos(yaw)]
    }
    const placed = [...R.lattice, R.cation, R.group, ...R.later]
    let bad = 0
    for (const i of placed) {
      const b = m.bodies[i]!
      const local = toLocal(P(b.atoms[0]!))
      const site = m.sites.find((x) => x.el === m.atoms[b.atoms[0]!]!.el && dist(x.pos, local) <= 0.5)
      if (!site) bad++
    }
    ok(`t=${t.toFixed(2)}: все частицы кристалла — в узлах барита ± 0,5 пм`, bad === 0, bad)
    // Ba–O ≥ кратчайшего в барите − 0,5
    let minBaO = Infinity
    const bas = placed.filter((i) => m.bodies[i]!.formula === 'Ba²⁺').map((i) => P(m.bodies[i]!.atoms[0]!))
    const os = placed.filter((i) => m.bodies[i]!.formula === 'SO₄²⁻').flatMap((i) => m.bodies[i]!.atoms.slice(1).map((a) => P(a)))
    for (const b of bas) for (const o of os) minBaO = Math.min(minBaO, dist(b, o))
    ok(`t=${t.toFixed(2)}: Ba–O ≥ кратчайшего в барите − 0,5 (${m.shortestCationO.toFixed(1)})`, minBaO >= m.shortestCationO - 0.5, minBaO.toFixed(2))
  }
  ok('кратчайшее Ba–O барита = 276,6 пм (Hill 1977)', near(m.shortestCationO, 276.6, 0.1), m.shortestCationO)
}

// ─── 7. Тексты и подключение ────────────────────────────────────────────────
{
  for (const loc of ['ru', 'en', 'uz'] as const) {
    for (const st of BASO4_SPEC.steps) ok(`${st.id} [${loc}]: без энергетики`, !/кДж|kJ|ΔH/.test(JSON.stringify(st.text[loc])))
  }
  const BA = { compoundId: 'salt_ba_cl' }
  const ACID = { compoundId: 'h2so4' }
  ok('сигнатура: BaCl₂ + H₂SO₄ → сцена BaSO₄', scientificSceneFor('salt_ba_so4', [BA, ACID]) === 'salt_ba_so4')
  ok('сигнатура: Ba(OH)₂ + H₂SO₄ — не эта сцена', scientificSceneFor('salt_ba_so4', [{ compoundId: 'ba_oh_2' }, ACID]) === null)
  ok('сигнатура: CuSO₄ + BaCl₂ — не эта сцена', scientificSceneFor('salt_ba_so4', [{ compoundId: 'salt_cu_so4' }, BA]) === null)
  ok('сигнатура: BaCl₂ + Na₂SO₄ — пока не эта сцена', scientificSceneFor('salt_ba_so4', [BA, { compoundId: 'salt_na_so4' }]) === null)
  const bank = getSchoolReaction('bacl2-h2so4')
  ok('банк bacl2-h2so4: 7, 8 и 9 классы', Boolean(bank && [7, 8, 9].every((g) => bank.grades.includes(g as never))))
  ok('банк bacl2-h2so4: без нагрева (labNeeds {})', Boolean(bank?.labNeeds) && Object.keys(bank!.labNeeds!).length === 0)
  ok('условия реактора для BaSO₄ по реакции банка — пустые', Object.keys(effectiveLabNeeds({ needsHeat: true }, 'salt_ba_so4', 'bacl2-h2so4') ?? {}).length === 0)
  const r = resolveReactorEquation({ reactionId: 'bacl2-h2so4', main: 'salt_ba_so4' })
  ok('реактор собирает bacl2-h2so4, главный — BaSO₄, синтез запускается', r.ok && r.stageOnly == null && r.productCompoundId === 'salt_ba_so4')
  ok('ссылка реактора открывает сцену', reactorLinkHasScene({ reactionId: 'bacl2-h2so4', main: 'salt_ba_so4' }))
  const link = schoolSceneLinkForCompound('salt_ba_so4')
  ok('карточка BaSO₄ → bacl2-h2so4 со сценой', link?.bankId === 'bacl2-h2so4' && link.hasScene === true && link.href.includes('main=salt_ba_so4'), link)
  ok('таблица карточек = спецификации', SOLUTION_SCENE_REACTIONS.salt_ba_so4?.bankId === BASO4_SPEC.reaction.bankId)
  // Учебник: 7 кл. с. 67 (r1) и 8 кл. с. 139 (r10) ведут на ту же реакцию банка
  type Row = { id: string; page: number; equation: string; bankId: string | null }
  const book = (g: number) => (JSON.parse(readFileSync(new URL(`../src/data/textbook/equations-g${g}.json`, import.meta.url), 'utf8')) as { units: { unitId: string; reactions: Row[] }[] }).units
  const g7 = book(7).flatMap((u) => u.reactions.map((x) => ({ ...x, unit: u.unitId }))).find((x) => x.page === 67 && x.equation.startsWith('BaCl₂ + H₂SO₄'))
  ok('7 кл. с. 67: реакция размечена и ведёт на банк bacl2-h2so4', g7?.bankId === 'bacl2-h2so4', g7)
  {
    // ссылка «в лабораторию» из учебника: ?reactor=1&reaction=…&src=… (без main) — главный продукт BaSO₄, сцена играет
    const href = (g7 as unknown as { lab?: { href?: string } })?.lab?.href ?? ''
    const q = new URLSearchParams(href.split('?')[1] ?? '')
    const spec = { reactionId: q.get('reaction') ?? undefined, main: q.get('main') ?? undefined }
    const rr = resolveReactorEquation(spec)
    ok('учебник 7 кл. r1: ссылка в реактор с bacl2-h2so4', q.get('reactor') === '1' && spec.reactionId === 'bacl2-h2so4', href)
    ok('учебник 7 кл. r1: реактор → BaSO₄ и школьная сцена', rr.ok && rr.productCompoundId === 'salt_ba_so4' && reactorLinkHasScene(spec))
  }
  const g8 = book(8).flatMap((u) => u.reactions).find((x) => x.page === 139 && x.equation.startsWith('H₂SO₄ + BaCl₂'))
  ok('8 кл. § 32 с. 139: реакция ведёт на банк bacl2-h2so4', g8?.bankId === 'bacl2-h2so4', g8)
  const lesson = getCinemaLesson('baso4')
  ok('урок панели baso4: свои шаги, школьный', lesson.id === 'baso4' && lesson.stepIds.join() === SOLUTION_STEP_IDS.join() && lesson.school === true)
  for (const loc of ['ru', 'en', 'uz'] as const) {
    const tx = lesson.getText(loc)
    ok(`урок baso4 [${loc}]: тексты шести шагов и легенда`, SOLUTION_STEP_IDS.every((id) => (tx.steps[id]?.title.length ?? 0) > 0) && Boolean(tx.legend.ion && tx.legend.water && tx.legend.precipitate))
  }
  // Герой после сцены: барит — ионы Ba²⁺ (Шеннон, КЧ 12) и целые SO₄²⁻
  const hero = buildHeroModel('salt_ba_so4')
  ok('герой salt_ba_so4 построен', Boolean(hero))
  if (hero) {
    const els = hero.atoms.reduce<Record<string, number>>((a, x) => ((a[x.el] = (a[x.el] ?? 0) + 1), a), {})
    ok('герой: ячейка барита — 4 Ba, 4 S, 16 O', els.Ba === 4 && els.S === 4 && els.O === 16, els)
    ok('герой: Ba²⁺ — радиус Шеннона при КЧ 12', hero.atoms.filter((a) => a.el === 'Ba').every((a) => a.radiusPm === 161 && a.charge === 2))
    const PM = pmToScene(1)
    ok('герой: 16 палочек S–O внутри групп, 145–149 пм', hero.bonds.length === 16 && hero.bonds.every((b) => b.lengthPm > 145 && b.lengthPm < 149 && hero.atoms[b.a]!.el === 'S' && hero.atoms[b.b]!.el === 'O'))
    ok('герой: связей Ba–O нет', hero.bonds.every((b) => hero.atoms[b.a]!.el !== 'Ba' && hero.atoms[b.b]!.el !== 'Ba'))
    ok('герой: подписи Ba²⁺ и SO₄²⁻', hero.labels.map((l) => l.text).sort().join() === ['Ba²⁺', 'SO₄²⁻'].sort().join(), hero.labels.map((l) => l.text))
    ok('герой: масштаб pmToScene', PM > 0)
  }
}

if (failures.length > 0) {
  console.error(`✗ solution scene: ${failures.length} из ${checks} проверок не прошли:`)
  for (const f of failures.slice(0, 60)) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`✓ solution scene (BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl): ${checks} проверок пройдено; скачок ≤ ${maxJump.toFixed(1)} пм/кадр, наблюдатели ≥ ${minSpectatorToNode.toFixed(0)} пм от узлов`)
process.exit(0)
