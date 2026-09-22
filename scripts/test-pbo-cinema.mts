#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт сцены «оксид свинца(II): 2 Pb (тв.) + O₂ (г.) → 2 PbO (тв.)»
 * (по образцу эталона scripts/test-nacl-cinema.mts, разделы 1–9).
 *
 * Сцена проверяется ДАННЫМИ, а не строками: раскадровка — чистая функция samplePboFrame(t),
 * весь урок сэмплируется в Node, каждое число сверяется с научным ядром src/chemistry/data.
 * Проверок «есть ли в тексте слово/литерал» здесь НЕТ: числа ИЗВЛЕКАЮТСЯ из текста и сверяются
 * с ядром, последовательности чисел ru / en / uz обязаны совпадать.
 *
 *   1. Хронометраж: 6 ± 1 шаг, каждый 4–7 экранных секунд, всего 26–34 с, cue лаборатории
 *      embryo → birth → complete строго после последнего шага.
 *   2. Раскадровка: дорожки монотонны, ни атом, ни камера не прыгают между кадрами 1/30 с.
 *   3. Геометрия ↔ ядро: O=O, ГЦК свинца (a/√2), массикот и глёт 2×2×2 из базиса ядра,
 *      радиусы Шеннона при фактическом КЧ 4, пирамида PbO₄, пары 6s² — в щель, щель Pb···Pb.
 *   4. Заряд донора — в кадр ухода каждого e⁻, акцептора — в кадр прихода; радиус — когда ион готов;
 *      сумма зарядов с летящими e⁻ = 0 каждые 1/60 с; валентные точки = valenceElectrons − заряд.
 *   5. На каждом шаге видимы только объекты этого шага; на паузе каждый видимый атом подписан.
 *   6. Финал без огня: FX-амплитуды = 0, свечение и bloom базовые.
 *   7. Энергия: лестница = BORN_HABER.pbo (формальный цикл), сумма = табличная ΔH°f, знаки.
 *   8. 3D-подписи: только формулы/числа/единицы-токены, числа — из ядра.
 *   9. Тексты: извлечённые числа ↔ ядро, синхронность ru/en/uz, сумма цикла по слагаемым.
 *
 * Запуск: npx tsx scripts/test-pbo-cinema.mts
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  ATOMIC_DATA,
  BORN_HABER,
  bondLengthPm,
  dHfKJ,
  formationReactionKJ,
  getCrystal,
  ionicRadiusPm,
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
import { assertIonSizeOrder, cpkHex, LATTICE_BALL_SCALE, pmToScene, speciesRadius, SPECIES_SCALE } from '../src/lab/cinema/scenes/kit/cpkAtoms.ts'
import { ladderLevels } from '../src/lab/cinema/scenes/kit/energyLadderData.ts'
import { assertSnapAt } from '../src/lab/cinema/scenes/kit/valence.ts'
import { coordinationShell, type LatticeFragment } from '../src/lab/cinema/scenes/kit/lattice.ts'
import {
  LITH_CAPTION,
  LITH_FRAG,
  LITH_SITE_OF,
  MASS_FRAG,
  MASS_SITE_OF,
  METAL_BONDS,
  METAL_FRAG,
  PB_S_PAIR,
  PBO_ATOM_INDEX,
  PBO_ATOMS,
  PBO_CAMERA,
  PBO_CUES,
  PBO_DIM_A_DROP,
  PBO_EDGE_A,
  PBO_EDGE_C,
  PBO_ELECTRONS,
  PBO_END,
  PBO_GAP,
  PBO_GEOM,
  PBO_ION_RADIUS_PM,
  PBO_LABELS,
  PBO_LATTICE_FX_WIN,
  PBO_LONE_DIR,
  PBO_PHASE_TINT,
  PBO_PYRAMID,
  PBO_SEGMENTS,
  PBO_SNAP,
  PBO_STEPS,
  PBO_STEP_IDS,
  PBO_TIMING,
  PBO_TINT_BOX,
  createPboFrame,
  samplePboFrame,
  validatePboStoryboard,
  type PboFrame,
} from '../src/lab/cinema/scenes/pbo/pboStoryboard.ts'
import {
  PBO_COST_BEFORE_LATTICE_KJ,
  PBO_CYCLE_IS_FORMAL,
  PBO_DHF_KJ,
  PBO_DHF_LITHARGE_KJ,
  PBO_DHF_MASSICOT_KJ,
  PBO_DHF_TABLE_KJ,
  PBO_HALF_REACTIONS,
  PBO_LADDER,
  PBO_LATTICE_IS_ESTIMATED,
  PBO_LATTICE_KJ,
  PBO_MASSICOT_EXCESS_KJ,
  PBO_REACTION,
  PBO_REACTION_DH_KJ,
  PBO_TEXTBOOK_ROUTE_DH_KJ,
  pboStageKJ,
  validatePboEnergetics,
} from '../src/lab/cinema/scenes/pbo/pboEnergetics.ts'
import { getPboMechanismText, type PboLocale, type PboMechanismText } from '../src/lab/cinema/scenes/pbo/pboMechanismText.ts'
import { pboScientificWatchdogMs } from '../src/lab/scientificSynthesis/pboScenarioTiming.ts'

const LOCALES: PboLocale[] = ['ru', 'en', 'uz']
const frame = createPboFrame()
const at = (t: number): PboFrame => samplePboFrame(t, frame)
const idx = (id: string) => PBO_ATOM_INDEX.get(id)!

let checks = 0
function ok(label: string, cond: boolean, detail = ''): void {
  assert.ok(cond, `${label}${detail ? ` — ${detail}` : ''}`)
  checks++
}
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol

const METAL = getCrystal('pb_metal')!
const MASS = getCrystal('massicot')!
const LITH = getCrystal('litharge')!
const STEP_PAUSE = PBO_STEPS.map((s) => s.to)
const LAST = PBO_STEPS.length - 1
const S = Object.fromEntries(PBO_STEPS.map((s, i) => [s.id, i])) as Record<(typeof PBO_STEP_IDS)[number], number>
const STORY = ['pb1', 'pb2', 'oA', 'oB'] as const
const PM = pmToScene(1)

// ─────────────────────────────────────────────────────────────────────────────
// 1. Хронометраж и контракт лаборатории
// ─────────────────────────────────────────────────────────────────────────────

PBO_TIMING.validate()
ok('шагов 6 ± 1', PBO_STEPS.length >= 5 && PBO_STEPS.length <= 7, `${PBO_STEPS.length}`)
ok('id шагов совпадают', PBO_STEP_IDS.join(',') === PBO_STEPS.map((s) => s.id).join(','))
const wall = storyWallDuration(PBO_SEGMENTS)
ok('экранная длительность 26–34 с', wall >= 26 && wall <= 34, `${wall.toFixed(2)} с`)
ok('wallDuration kit = сумма сегментов', near(wall, PBO_TIMING.wallDuration, 1e-9))
for (const s of PBO_STEPS) ok(`шаг ${s.id}: 4–7 экранных секунд`, s.wall >= 4 && s.wall <= 7, `${s.wall}`)
const lastStepTo = PBO_STEPS[LAST]!.to
for (const id of ['embryo', 'birth', 'complete']) {
  const c = PBO_CUES.find((x) => x.id === id)!
  ok(`cue ${id} строго после последнего шага`, c.at > lastStepTo, `${c.at} ≤ ${lastStepTo}`)
}
for (const c of PBO_CUES) {
  if (['embryo', 'birth', 'complete'].includes(c.id)) continue
  ok(`cue ${c.id} внутри шагов`, c.at > 0 && c.at < lastStepTo)
}
ok('complete совпадает с концом сюжета', PBO_CUES.find((c) => c.id === 'complete')!.at === PBO_END)
ok('watchdog лаборатории положителен', pboScientificWatchdogMs() > 0)
for (let i = 0; i < PBO_STEPS.length; i++) {
  const s = PBO_STEPS[i]!
  ok(`stepIndexAt(${s.id})`, PBO_TIMING.stepIndexAt((s.from + s.to) / 2) === i)
}
// Электроны — внутри шага переноса; последний приход = cue 'transfer'.
{
  const tr = PBO_STEPS[S.transfer]!
  for (const [k, e] of Object.entries(PBO_ELECTRONS)) ok(`электрон ${k} внутри шага переноса`, e.leave > tr.from && e.arrive < tr.to && e.arrive > e.leave)
  const lastArrive = Math.max(...Object.values(PBO_ELECTRONS).map((e) => e.arrive))
  ok('cue transfer = последний приход электрона', PBO_CUES.find((c) => c.id === 'transfer')!.at === lastArrive)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Раскадровка: дорожки, рывки атомов и камеры, ноль аллокаций
// ─────────────────────────────────────────────────────────────────────────────

validatePboStoryboard()
{
  const scratch = createPboFrame()
  const buf = PBO_ATOMS.map((a) => ({ id: a.id, pos: new THREE.Vector3(), opacity: 0 }))
  assertNoPositionJumps(
    (t) => {
      samplePboFrame(t, scratch)
      for (let i = 0; i < PBO_ATOMS.length; i++) {
        buf[i]!.pos.copy(scratch.pos[i]!)
        buf[i]!.opacity = scratch.opacity[i]!
      }
      return buf
    },
    PBO_END,
    0.09,
    1 / 30,
  )
  checks++
  const cam = createSceneCamera()
  assertCameraContinuity((t) => sampleShot(PBO_CAMERA, t, cam), PBO_END)
  checks++

  // Видимость не щёлкает: у ионов фрагментов — доля радиуса (растут из точки), у остальных — непрозрачность.
  const isFrag = (i: number) => PBO_ATOMS[i]!.kind === 'massicot' || PBO_ATOMS[i]!.kind === 'litharge'
  const fullR = PBO_ATOMS.map((a) => pmToScene(a.el === 'Pb' ? PBO_ION_RADIUS_PM.pb : PBO_ION_RADIUS_PM.o) * LATTICE_BALL_SCALE)
  const presence = (i: number) => (isFrag(i) ? scratch.radius[i]! / fullR[i]! : scratch.opacity[i]!)
  let prev: Float32Array | null = null
  let worst = 0
  let worstT = 0
  for (let t = 0; t <= PBO_END + 1e-9; t += 1 / 30) {
    samplePboFrame(t, scratch)
    const now = Float32Array.from(PBO_ATOMS, (_, i) => presence(i))
    if (prev) {
      for (let i = 0; i < PBO_ATOMS.length; i++) {
        const d = Math.abs(now[i]! - prev[i]!)
        if (d > worst) {
          worst = d
          worstT = t
        }
      }
    }
    prev = now
  }
  ok('видимость без скачка (≤ 0,12 за кадр 1/30 с)', worst <= 0.12, `${worst.toFixed(3)} при t=${worstT.toFixed(2)}`)

  const posRefs = scratch.pos.slice()
  const labelRefs = scratch.labels.slice()
  const labelPos = scratch.labels.map((l) => l.pos)
  for (let t = 0; t <= PBO_END; t += 0.5) samplePboFrame(t, scratch)
  ok('векторы позиций переиспользуются', scratch.pos.every((p, i) => p === posRefs[i]))
  ok('подписи переиспользуются', scratch.labels.every((l, i) => l === labelRefs[i] && l.pos === labelPos[i]))
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Геометрия раскадровки ↔ ядро
// ─────────────────────────────────────────────────────────────────────────────

// 3.1 Радиусы: катион меньше атома, анион больше; ионы — Шеннон при ФАКТИЧЕСКОМ КЧ структуры.
assertIonSizeOrder('Pb', 2)
assertIonSizeOrder('O', -2)
checks += 2
const CN_PB = LITH.coordination['Pb²⁺']!
const CN_O = LITH.coordination['O²⁻']!
const rPb0 = radiusForSpecies('Pb', 0)
const rO0 = radiusForSpecies('O', 0)
const rPb2 = radiusForSpecies('Pb', 2, { cn: CN_PB })
const rO2 = radiusForSpecies('O', -2, { cn: CN_O })
const rPb2cn6 = ionicRadiusPm('Pb', 2)!
ok('Pb⁰ — металлический радиус ядра', rPb0 === ATOMIC_DATA.Pb.metallicRadiusPm)
ok('O⁰ — ковалентный радиус ядра (Кордеро)', rO0 === ATOMIC_DATA.O.covalentRadiusPm)
ok('Pb²⁺ — Шеннон при КЧ глёта', PBO_ION_RADIUS_PM.pb === ionicRadiusPm('Pb', 2, CN_PB) && rPb2 === PBO_ION_RADIUS_PM.pb)
ok('O²⁻ — Шеннон при КЧ глёта', PBO_ION_RADIUS_PM.o === ionicRadiusPm('O', -2, CN_O) && rO2 === PBO_ION_RADIUS_PM.o)
ok('радиус Pb²⁺ при КЧ 4 отличается от КЧ 6 (иначе оговорка пустая)', rPb2 < rPb2cn6)
ok('КЧ массикота = КЧ глёта (один набор радиусов)', MASS.coordination['Pb²⁺'] === CN_PB && MASS.coordination['O²⁻'] === CN_O)
ok('радиусы кадра сюжета — из ядра', near(PBO_GEOM.radius.pb, speciesRadius('Pb', 0)) && near(PBO_GEOM.radius.pbIon, pmToScene(rPb2) * SPECIES_SCALE) && near(PBO_GEOM.radius.o, speciesRadius('O', 0)) && near(PBO_GEOM.radius.oIon, pmToScene(rO2) * SPECIES_SCALE))
ok('пара ns² Pb из конфигурации ядра', /6s²/.test(ATOMIC_DATA.Pb.configuration) && PB_S_PAIR === 2)

// 3.2 Шаг 1: O₂ — молекула с длиной связи из bondData; свинец — ячейка ГЦК из crystalData.
at(STEP_PAUSE[0]!)
ok('O₂: d(O=O) = bondLengthPm', near(frame.pos[idx('oA')]!.distanceTo(frame.pos[idx('oB')]!), pmToScene(bondLengthPm('O=O'))))
ok('O₂: связь видна', frame.bond.opacity > 0.9 && frame.bond.stress === 0)
ok('O — газ, Pb — металл (материалы)', frame.material[idx('oA')] === 'gas' && frame.material[idx('pb1')] === 'metal')
ok('ячейка Pb: 14 атомов (8 вершин + 6 граней)', METAL_FRAG.sites.length === 14)
ok('в кадре весь металл ячейки', PBO_ATOMS.filter((a) => a.kind === 'metal').length + 2 === METAL_FRAG.sites.length)
for (const [a, b] of METAL_BONDS) {
  const d = frame.pos[idx(a)]!.distanceTo(frame.pos[idx(b)]!) / PM
  ok(`металл ${a}–${b} = d(Pb–Pb) ядра (±0,05 пм)`, near(d, METAL.cationAnionPm, 0.05), d.toFixed(2))
}
ok('d(Pb–Pb) = a/√2 ядра', near(METAL.cellPm.a / Math.SQRT2, METAL.cationAnionPm, 0.05))
ok('рёбра ячейки металла видны', frame.edgeSet === 'metal' && frame.edges > 0.9)
for (const id of STORY) ok(`${id}: заряд 0 на шаге 1`, frame.charge[idx(id)] === 0)

/** Проверки фрагмента: узлы, радиусы, противоионы в первой сфере, КЧ. */
function checkFragment(name: string, frag: LatticeFragment, siteOf: ReadonlyMap<string, number>, cr: typeof LITH): void {
  const vis = PBO_ATOMS.map((a, i) => ({ a, i })).filter(({ a }) => siteOf.has(a.id))
  ok(`${name}: все ${frag.sites.length} ионов фрагмента в кадре и видимы`, vis.length === frag.sites.length && vis.every(({ i }) => frame.opacity[i]! > 0.99))
  for (const { a, i } of vis) {
    const si = siteOf.get(a.id)!
    const s = frag.sites[si]!
    ok(`${name}: ${a.id} в своём узле`, frame.pos[i]!.distanceTo(new THREE.Vector3(...s.posScene)) < 1e-6)
    ok(`${name}: ${a.id} — элемент узла`, s.el === a.el)
    const want = pmToScene(a.el === 'Pb' ? rPb2 : rO2) * LATTICE_BALL_SCALE
    ok(`${name}: ${a.id} — радиус иона при КЧ ${s.cn} (доля решётки)`, near(frame.radius[i]!, want, 1e-6))
    ok(`${name}: ${a.id} — заряд иона узла`, frame.charge[i] === s.charge && frame.material[i] === 'ion')
  }
  let full = 0
  for (let si = 0; si < frag.sites.length; si++) {
    const sh = coordinationShell(frag, si)
    const s = frag.sites[si]!
    ok(`${name}: у узла ${si} в первой сфере только противоионы`, sh.neighbors.every((j) => frag.sites[j]!.el !== s.el))
    ok(`${name}: КЧ узла ${si} = coordination ядра`, s.cn === cr.coordination[s.el === 'Pb' ? 'Pb²⁺' : 'O²⁻'])
    if (sh.neighbors.length === s.cn) full++
  }
  ok(`${name}: есть узлы с полной сферой`, full > 0)
}

// 3.3 Шаг 4: массикот 2×2×2.
at(STEP_PAUSE[S.massicot]!)
{
  checkFragment('массикот', MASS_FRAG, MASS_SITE_OF, MASS)
  const shortest = Math.min(...MASS_FRAG.bonds.map((b) => b[2]))
  ok('массикот: кратчайшее Pb–O = cationAnionPm ядра (±0,05)', near(shortest, MASS.cationAnionPm, 0.05), shortest.toFixed(2))
  ok('рёбер ячеек массикота 54', MASS_FRAG.cellEdges.length === 54)
  const lens = [MASS.cellPm.a, MASS.cellPm.b!, MASS.cellPm.c!].map((v) => pmToScene(v))
  for (const [p, q] of MASS_FRAG.cellEdges) {
    const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
    ok('ребро массикота = a, b или c ядра', lens.some((l) => near(d, l, 1e-5)))
  }
  ok('рёбра массикота видны', frame.edgeSet === 'massicot' && frame.edges > 0.9)
  ok('глёта ещё нет', PBO_ATOMS.every((a, i) => a.kind !== 'litharge' || frame.opacity[i] === 0))
  for (const id of STORY) ok(`${id} уже ион в узле массикота`, Math.abs(frame.charge[idx(id)]!) === 2)
}

// 3.4 Шаг 5: глёт 2×2×2, пирамида PbO₄, пары 6s², щель.
at(STEP_PAUSE[S.litharge]!)
{
  checkFragment('глёт', LITH_FRAG, LITH_SITE_OF, LITH)
  ok('массикот погашен полностью', PBO_ATOMS.every((a, i) => a.kind !== 'massicot' || frame.opacity[i] === 0))
  ok('рёбер ячеек глёта 54', LITH_FRAG.cellEdges.length === 54)
  for (const [p, q] of LITH_FRAG.cellEdges) {
    const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
    ok('ребро глёта = a или c ядра', near(d, pmToScene(LITH.cellPm.a), 1e-5) || near(d, pmToScene(LITH.cellPm.c!), 1e-5))
  }
  ok('рёбра глёта видны', frame.edgeSet === 'litharge' && frame.edges > 0.9)
  // Все Pb–O первой сферы = одна длина ядра (четыре равные связи пирамиды).
  for (const [i, j, d] of LITH_FRAG.bonds) {
    ok(`глёт: связь ${i}–${j} Pb–O`, LITH_FRAG.sites[i]!.el !== LITH_FRAG.sites[j]!.el)
    ok(`глёт: d(Pb–O) = cationAnionPm = bondLengthPm('Pb-O') (±0,05)`, near(d, LITH.cationAnionPm, 0.05) && LITH.cationAnionPm === bondLengthPm('Pb-O'), d.toFixed(2))
  }
  // Пирамида, а не октаэдр: у каждого Pb с полной сферой четыре O по одну сторону, в одной плоскости.
  for (let si = 0; si < LITH_FRAG.sites.length; si++) {
    const s = LITH_FRAG.sites[si]!
    const sh = coordinationShell(LITH_FRAG, si)
    if (sh.neighbors.length !== s.cn) continue
    const ys = sh.neighbors.map((j) => LITH_FRAG.sites[j]!.posScene[1])
    const coplanar = ys.every((y) => near(y, ys[0]!, 1e-6))
    const oneSide = ys.every((y) => y > s.posScene[1]) || ys.every((y) => y < s.posScene[1])
    if (s.el === 'Pb') {
      ok(`глёт: Pb ${si} — вершина квадратной пирамиды (4 O в плоскости, по одну сторону)`, coplanar && oneSide && sh.edges.length === 4)
    } else {
      ok(`глёт: O ${si} — в тетраэдре из четырёх Pb (два выше, два ниже)`, ys.filter((y) => y > s.posScene[1]).length === 2 && sh.edges.length === 6)
    }
  }
  // Пирамида pb1: вершина — pb1, основание — его четыре O; расстояния — ядро.
  ok('пирамида pb1: четыре O = КЧ', PBO_PYRAMID.base.length === CN_PB && PBO_PYRAMID.baseEdges.length === 4)
  for (const id of PBO_PYRAMID.base) {
    const d = frame.pos[idx('pb1')]!.distanceTo(frame.pos[idx(id)]!) / PM
    ok(`пирамида pb1: d(Pb–${id}) = cationAnionPm (±0,05)`, near(d, LITH.cationAnionPm, 0.05), d.toFixed(2))
  }
  ok('партнёр oA — в пирамиде pb1', PBO_PYRAMID.base.includes('oA'))
  // Пары 6s²: у каждого Pb глёта — ±Y, ОТ своих O (в щель между слоями).
  let pairs = 0
  for (let i = 0; i < PBO_ATOMS.length; i++) {
    const si = LITH_SITE_OF.get(PBO_ATOMS[i]!.id)
    const isPb = si != null && LITH_FRAG.sites[si]!.el === 'Pb'
    ok(`пара 6s² только у Pb²⁺ глёта (${PBO_ATOMS[i]!.id})`, isPb === (PBO_LONE_DIR[i] !== 0))
    if (!isPb) continue
    pairs++
    const sh = coordinationShell(LITH_FRAG, si)
    const yo = sh.neighbors.reduce((s, j) => s + LITH_FRAG.sites[j]!.posScene[1], 0) / sh.neighbors.length
    ok(`пара 6s² у ${PBO_ATOMS[i]!.id} смотрит от своих O`, Math.sign(frame.pos[i]!.y - yo) === PBO_LONE_DIR[i])
  }
  ok('пары 6s² у всех Pb²⁺ глёта', pairs === LITH_FRAG.sites.filter((s) => s.el === 'Pb').length)
  ok('пары, пирамида и щель видны на паузе шага 5', frame.fx.lonePairs > 0.9 && frame.fx.pyramid > 0.9 && frame.fx.gap > 0.9)
  // Щель Pb···Pb: из ячейки и z(Pb) базиса ядра — √(2·(a/2)² + ((1 − 2z)·c)²).
  const zPb = LITH.basis!.find((b) => b.el === 'Pb')!.frac[2]
  const gapPm = Math.hypot(LITH.cellPm.a / 2, LITH.cellPm.a / 2, (1 - 2 * zPb) * LITH.cellPm.c!)
  ok('щель Pb···Pb = расчёт из ячейки и z(Pb) ядра', near(PBO_GAP.pm, gapPm, 1e-6), `${PBO_GAP.pm.toFixed(2)} против ${gapPm.toFixed(2)}`)
  ok('щель Pb···Pb в кадре = та же величина', near(frame.pos[idx(PBO_GAP.a)]!.distanceTo(frame.pos[idx(PBO_GAP.b)]!) / PM, gapPm, 1e-4))
  ok('щель: пары двух Pb смотрят друг на друга', PBO_LONE_DIR[idx(PBO_GAP.a)] === 1 && PBO_LONE_DIR[idx(PBO_GAP.b)] === -1 && frame.pos[idx(PBO_GAP.b)]!.y > frame.pos[idx(PBO_GAP.a)]!.y)
  ok('щель больше связи Pb–O (слои не связаны)', gapPm > LITH.cationAnionPm)
  // Подписи ячейки у рёбер длиной a и c.
  const len = (e: typeof PBO_EDGE_A) => Math.hypot(e[0][0] - e[1][0], e[0][1] - e[1][1], e[0][2] - e[1][2])
  ok('подпись a стоит у ребра длиной a', near(len(PBO_EDGE_A), pmToScene(LITH.cellPm.a), 1e-5))
  ok('подпись c стоит у ребра длиной c', near(len(PBO_EDGE_C), pmToScene(LITH.cellPm.c!), 1e-5))
  ok('размерная линия a вне сфер', PBO_DIM_A_DROP > pmToScene(rO2) * LATTICE_BALL_SCALE)
  // Пары сюжета — в узлах глёта, соседи Pb–O.
  for (const [pb, o] of [['pb1', 'oA'], ['pb2', 'oB']] as const) {
    ok(`пара ${pb}/${o} в глёте на d(Pb–O) ядра`, near(frame.pos[idx(pb)]!.distanceTo(frame.pos[idx(o)]!) / PM, LITH.cationAnionPm, 0.05))
  }
  ok('металл давно погашен', PBO_ATOMS.every((a, i) => a.kind !== 'metal' || frame.opacity[i] === 0))
}

// 3.5 Цвет вещества (не CPK): рамка модификации. Оттенок сверяется с nameRu ядра (жёлтый / красный).
{
  const rgb = (h: number) => [(h >> 16) & 255, (h >> 8) & 255, h & 255] as const
  const hue = (h: number): 'yellow' | 'red' | 'other' => {
    const [r, g, b] = rgb(h)
    if (r > 150 && g > 150 && b < g * 0.6) return 'yellow'
    if (r > 150 && g < r * 0.5 && b < r * 0.5) return 'red'
    return 'other'
  }
  const coreHue = (name: string) => (/жёлт/.test(name) ? 'yellow' : /красн/.test(name) ? 'red' : 'other')
  ok('цвет массикота в ядре назван', coreHue(MASS.nameRu) !== 'other')
  ok('цвет глёта в ядре назван', coreHue(LITH.nameRu) !== 'other')
  ok('рамка массикота = цвет вещества из ядра', hue(PBO_PHASE_TINT.massicot) === coreHue(MASS.nameRu))
  ok('рамка глёта = цвет вещества из ядра', hue(PBO_PHASE_TINT.litharge) === coreHue(LITH.nameRu))
  ok('рамки двух модификаций различимы', hue(PBO_PHASE_TINT.massicot) !== hue(PBO_PHASE_TINT.litharge))
  ok('рамка глёта не совпадает с CPK-цветом O', PBO_PHASE_TINT.litharge !== cpkHex('O'))
  for (const [ph, fr] of [['massicot', MASS_FRAG], ['litharge', LITH_FRAG]] as const) {
    const box = PBO_TINT_BOX[ph]
    ok(`рамка ${ph} охватывает все ионы фрагмента`, fr.sites.every((si) => si.posScene.every((v, k) => v >= box.min[k]! - 1e-6 && v <= box.max[k]! + 1e-6)))
  }
  at(STEP_PAUSE[S.massicot]!)
  ok('пауза шага 4: видна рамка массикота', frame.tint.phase === 'massicot' && frame.tint.amount > 0.9)
  at(STEP_PAUSE[S.litharge]!)
  ok('пауза шага 5: видна рамка глёта', frame.tint.phase === 'litharge' && frame.tint.amount > 0.9)
  at(STEP_PAUSE[S.reactants]!)
  ok('шаг 1: у металла рамки цвета нет', frame.tint.phase === 'none' && frame.tint.amount === 0)
  at(PBO_STEPS[LAST]!.to)
  ok('конец шага 6: глёт остаётся в своём цвете', frame.tint.phase === 'litharge' && frame.tint.amount > 0.9)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Перенос электронов: заряды — в кадры ухода/прихода, радиусы — когда ион готов
// ─────────────────────────────────────────────────────────────────────────────

{
  const R = PBO_GEOM.radius
  const E = PBO_ELECTRONS
  assertSnapAt(PBO_SNAP.radiusPb1, E.e2.leave, R.pb, R.pbIon)
  assertSnapAt(PBO_SNAP.radiusPb2, E.e4.leave, R.pb, R.pbIon)
  assertSnapAt(PBO_SNAP.radiusOA, E.e2.arrive, R.o, R.oIon)
  assertSnapAt(PBO_SNAP.radiusOB, E.e4.arrive, R.o, R.oIon)
  checks += 4
  const dt = 1 / 60
  const lbl = (id: string) => frame.labels.find((l) => l.id === id)!.text
  const pairs = [
    { pb: 'pb1', o: 'oA', first: E.e1, second: E.e2, k1: 0, k2: 1, vPb: 0, vO: 2 },
    { pb: 'pb2', o: 'oB', first: E.e3, second: E.e4, k1: 2, k2: 3, vPb: 1, vO: 3 },
  ] as const
  const valence = (el: 'Pb' | 'O') => ATOMIC_DATA[el].valenceElectrons
  for (const p of pairs) {
    // Донор: заряд +1 в кадр ухода первого e⁻, +2 — второго; радиус — со вторым.
    at(p.first.leave - dt)
    ok(`${p.pb}: до ухода первого e⁻ — атом (заряд 0, газ)`, frame.charge[idx(p.pb)] === 0 && frame.material[idx(p.pb)] === 'gas' && near(frame.radius[idx(p.pb)]!, R.pb))
    at(p.first.leave)
    ok(`${p.pb}: в кадр ухода первого e⁻ — Pb⁺ (заряд +1, ion, подпись)`, frame.charge[idx(p.pb)] === 1 && frame.material[idx(p.pb)] === 'ion' && lbl(p.pb) === 'Pb⁺')
    ok(`${p.pb}: радиус Pb⁺ не выдуман (прежний)`, near(frame.radius[idx(p.pb)]!, R.pb))
    at(p.second.leave - dt)
    const before = { r: frame.radius[idx(p.pb)]!, q: frame.charge[idx(p.pb)]!, l: lbl(p.pb) }
    at(p.second.leave)
    ok(`${p.pb}: до ухода второго e⁻ — Pb⁺`, before.q === 1 && near(before.r, R.pb) && before.l === 'Pb⁺')
    ok(`${p.pb}: в кадр ухода второго e⁻ — Pb²⁺ (радиус Шеннона КЧ 4, заряд +2, подпись)`, frame.charge[idx(p.pb)] === 2 && near(frame.radius[idx(p.pb)]!, R.pbIon) && lbl(p.pb) === 'Pb²⁺')
    ok(`${p.pb}: у Pb²⁺ осталась пара 6s² (точек = valence − 2 = ${PB_S_PAIR})`, frame.valence[p.vPb]!.count === valence('Pb') - 2 && frame.valence[p.vPb]!.count === frame.valence[p.vPb]!.sPair)
    // Акцептор: −1 в кадр прихода первого, −2 — второго (радиус и октет — со вторым).
    at(p.first.arrive - dt)
    const o1 = { q: frame.charge[idx(p.o)]!, n: frame.valence[p.vO]!.count, arrived: frame.electrons[p.k1]!.arrived, m: frame.material[idx(p.o)] }
    at(p.first.arrive)
    ok(`${p.o}: до первого прихода — атом, ${valence('O')} точек, газ`, o1.q === 0 && o1.n === valence('O') && !o1.arrived && o1.m === 'gas')
    ok(`${p.o}: в кадр первого прихода — O⁻ (заряд −1, ${valence('O') + 1} точек, подпись)`, frame.electrons[p.k1]!.arrived && frame.charge[idx(p.o)] === -1 && frame.valence[p.vO]!.count === valence('O') + 1 && lbl(p.o) === 'O⁻')
    ok(`${p.o}: радиус O⁻ не выдуман (прежний)`, near(frame.radius[idx(p.o)]!, R.o))
    at(p.second.arrive - dt)
    const o2 = { r: frame.radius[idx(p.o)]!, q: frame.charge[idx(p.o)]! }
    at(p.second.arrive)
    ok(`${p.o}: до второго прихода — O⁻`, o2.q === -1 && near(o2.r, R.o))
    ok(`${p.o}: в кадр второго прихода — O²⁻ (радиус Шеннона КЧ 4, октет, подпись)`, frame.electrons[p.k2]!.arrived && frame.charge[idx(p.o)] === -2 && near(frame.radius[idx(p.o)]!, R.oIon) && frame.valence[p.vO]!.count === 8 && lbl(p.o) === 'O²⁻')
    ok(`${p.o}: новая точка подсвечена`, frame.valence[p.vO]!.highlight === frame.valence[p.vO]!.count - 1)
  }
  // Закон сохранения заряда: каждые 1/60 с шага 3 Σq + (−1)·(летящие e⁻) = 0.
  const s3 = PBO_STEPS[S.transfer]!
  let worst = 0
  for (let t = s3.from; t <= s3.to + 1e-9; t += dt) {
    at(t)
    let q = 0
    for (const id of STORY) q += frame.charge[idx(id)]!
    for (const e of Object.values(E)) if (t >= e.leave && t < e.arrive) q -= 1
    worst = Math.max(worst, Math.abs(q))
  }
  ok('шаг 3: заряд сохраняется в каждом кадре (Σq + летящие e⁻ = 0)', worst === 0, `${worst}`)
  // Лестница ставит ионизацию на уход электрона, сродство — на приход.
  const st = (id: string) => PBO_LADDER.stages.find((s) => s.id === id)!.at
  ok('IE₁ лестницы = уход e1, EA₁ = приход e1', near(st('ionization1'), E.e1.leave) && near(st('affinity1'), E.e1.arrive))
  ok('IE₂ лестницы = уход e2, EA₂ = приход e2', near(st('ionization2'), E.e2.leave) && near(st('affinity2'), E.e2.arrive))
  // Пауза шага 2 держит «до»: у Pb четыре точки (пара s² + два p), у O шесть.
  at(STEP_PAUSE[S.sublimation]!)
  ok('пауза шага 2: у Pb valenceElectrons точек, из них пара s²', frame.valence[0]!.count === valence('Pb') && frame.valence[0]!.sPair === PB_S_PAIR && frame.valence[0]!.amount > 0.9)
  ok('пауза шага 2: у O valenceElectrons точек', frame.valence[2]!.count === valence('O') && frame.valence[2]!.amount > 0.9)
  // Пауза шага 3 держит «после»: Pb²⁺ — пара 6s², O²⁻ — октет.
  at(STEP_PAUSE[S.transfer]!)
  for (const [k, n] of [
    [0, valence('Pb') - 2],
    [1, valence('Pb') - 2],
    [2, 8],
    [3, 8],
  ] as const) {
    ok(`пауза шага 3: облако ${k} — ${n} точек, видно`, frame.valence[k]!.count === n && frame.valence[k]!.amount > 0.9)
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

for (let si = 0; si < PBO_STEPS.length; si++) {
  const s = PBO_STEPS[si]!
  let foreign = 0
  let at0 = -1
  for (let t = s.from; t <= s.to + 1e-9; t += 1 / 60) {
    at(t)
    for (let i = 0; i < PBO_ATOMS.length; i++) {
      const [a, b] = PBO_ATOMS[i]!.span
      if (!(si >= a && si <= b) && frame.opacity[i]! > 0) {
        foreign++
        if (at0 < 0) at0 = t
      }
    }
  }
  ok(`шаг ${s.id}: ни одного объекта чужого шага`, foreign === 0, `первый при t=${at0.toFixed(3)}`)

  at(s.to)
  const visibleLabels = frame.labels.map((l, k) => ({ st: l, def: PBO_LABELS[k]! })).filter(({ st }) => st.opacity > 0.5)
  ok(`пауза ${s.id}: есть подписи`, visibleLabels.length > 0)
  for (let i = 0; i < PBO_ATOMS.length; i++) {
    if (frame.opacity[i]! <= 0.02) continue
    const id = PBO_ATOMS[i]!.id
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
at(STEP_PAUSE[S.sublimation]!)
ok('после сублимации ни одного атома металла', PBO_ATOMS.every((a, i) => a.kind !== 'metal' || frame.opacity[i] === 0))
{
  const lo = (id: string) => frame.labels.find((l) => l.id === id)!.opacity
  at(STEP_PAUSE[S.massicot]!)
  ok('пауза шага 4: подпись массикота видна, глёта нет', lo('massicot') > 0.9 && lo('litharge') === 0 && lo('lithSg') === 0)
  at(STEP_PAUSE[S.litharge]!)
  ok('пауза шага 5: подпись глёта видна, массикота нет', lo('litharge') > 0.9 && lo('massicot') === 0 && lo('massSg') === 0)
  ok('пауза шага 5: пирамида, пара 6s² и щель подписаны', lo('pyramid') > 0.9 && lo('lonePair') > 0.9 && lo('gap') > 0.9 && lo('dPbO') > 0.9)
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Финал без огня
// ─────────────────────────────────────────────────────────────────────────────

{
  const s = PBO_STEPS[LAST]!
  at(PBO_STEPS[0]!.from + 0.01)
  const baseEmissive = frame.emissive[0]!
  const baseBloom = frame.camera.bloom
  // Пары 6s², пирамида и щель видны на паузе шага 5 и гаснут в первые доли секунды шага 6 (монотонно).
  const clear = PBO_LATTICE_FX_WIN[1]
  ok('эффекты глёта гаснут в начале шага 6 (не позже 0,6 с)', clear > s.from && clear - s.from <= 0.6)
  let prevFx = Infinity
  for (let t = s.from; t <= s.to + 1e-9; t += 1 / 30) {
    at(t)
    const latticeFx = frame.fx.lonePairs + frame.fx.pyramid + frame.fx.gap
    const fx = frame.fx.electrons + latticeFx + frame.valence.reduce((m, v) => m + v.amount, 0)
    if (t < clear) {
      ok(`шаг 6, t=${t.toFixed(2)}: эффекты глёта только гаснут`, latticeFx <= prevFx + 1e-9 && frame.fx.electrons === 0)
      prevFx = latticeFx
    } else {
      ok(`шаг 6, t=${t.toFixed(2)}: FX-амплитуды = 0`, fx === 0, `${fx}`)
    }
    let hot = 0
    for (let i = 0; i < PBO_ATOMS.length; i++) if (frame.emissive[i] !== baseEmissive) hot++
    ok(`шаг 6, t=${t.toFixed(2)}: свечение атомов базовое`, hot === 0, `${hot} атомов светятся`)
    ok(`шаг 6, t=${t.toFixed(2)}: bloom базовый, тряски нет`, near(frame.camera.bloom, baseBloom) && frame.camera.shake === 0)
  }
  at(s.to)
  ok('конец шага 6: кристалл цел и виден', LITH_FRAG.sites.length === PBO_ATOMS.filter((_, i) => frame.opacity[i]! > 0.99).length)
  at(PBO_END)
  ok('в конце хвоста кадр затемнён', frame.fade > 0.95)
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Энергетика: лестница = ядро (формальный цикл)
// ─────────────────────────────────────────────────────────────────────────────

validatePboEnergetics()
{
  const cycle = BORN_HABER.pbo!
  ok('ступени лестницы = ступени BORN_HABER.pbo', PBO_LADDER.stages.length === cycle.stages.length)
  for (const st of cycle.stages) {
    const l = PBO_LADDER.stages.find((x) => x.id === st.id)!
    ok(`ступень ${st.id} = ядро`, l.dH === st.dHKJ)
    ok(`ступень ${st.id}: множитель 1`, (l.multiplier ?? 1) === 1 && (l.perUnitKJ == null || l.perUnitKJ === st.dHKJ))
  }
  ok('сублимация = ΔH°f(Pb, г.)', pboStageKJ('sublimation') === dHfKJ('Pb(g)'))
  ok('½D = ΔH°f(O, г.)', pboStageKJ('dissociation') === dHfKJ('O(g)'))
  ok('IE₁, IE₂ = ядро', pboStageKJ('ionization1') === ATOMIC_DATA.Pb.ie1KJ && pboStageKJ('ionization2') === ATOMIC_DATA.Pb.ie2KJ)
  ok('EA₁ = ядро, EA₂ = OXIDE_SECOND_EA_KJ', pboStageKJ('affinity1') === ATOMIC_DATA.O.electronAffinityKJ && pboStageKJ('affinity2') === OXIDE_SECOND_EA_KJ)
  ok('U цикла = LATTICE_ENTHALPY_KJ', PBO_LATTICE_KJ === LATTICE_ENTHALPY_KJ['PbO(litharge)'])
  ok('Σ цикла = табличная ΔH°f глёта (±0,05)', near(PBO_LADDER.sumKJ, dHfKJ('PbO(litharge)'), 0.05), `${PBO_LADDER.sumKJ}`)
  ok('таблица лестницы = ядро', PBO_DHF_TABLE_KJ === dHfKJ('PbO(litharge)') && PBO_DHF_LITHARGE_KJ === PBO_DHF_TABLE_KJ)
  ok('цикл помечен формальным, U — выведенной', PBO_CYCLE_IS_FORMAL && PBO_LATTICE_IS_ESTIMATED)
  ok('без решётки процесс эндотермический', PBO_COST_BEFORE_LATTICE_KJ > 0)
  ok('ΔH реакции = 2 · ΔH°f', near(PBO_REACTION_DH_KJ, 2 * dHfKJ('PbO(litharge)'), 0.05))
  ok('массикот выше глёта = разность ΔH°f ядра', near(PBO_MASSICOT_EXCESS_KJ, dHfKJ('PbO(massicot)') - dHfKJ('PbO(litharge)'), 0.05) && PBO_MASSICOT_EXCESS_KJ > 0)
  ok('способ учебника эндотермичен', PBO_TEXTBOOK_ROUTE_DH_KJ > 0 && PBO_TEXTBOOK_ROUTE_DH_KJ === formationReactionKJ('pbno3_decomposition'))
  const byId = Object.fromEntries(PBO_LADDER.stages.map((s) => [s.id, s.dH]))
  ok('знаки: субл., ½D, IE₁, IE₂ > 0; EA₁ < 0; EA₂ > 0; U < 0', byId.sublimation! > 0 && byId.dissociation! > 0 && byId.ionization1! > 0 && byId.ionization2! > 0 && byId.affinity1! < 0 && byId.affinity2! > 0 && byId.lattice! < 0)
  const levels = ladderLevels(PBO_LADDER)
  ok('последний уровень = сумма цикла', near(levels[levels.length - 1]!, PBO_LADDER.sumKJ))
  ok('ступени идут по времени сюжета и внутри шагов', PBO_LADDER.stages.every((s, i) => s.at > 0 && s.at < lastStepTo && (i === 0 || s.at >= PBO_LADDER.stages[i - 1]!.at)))
  ok('решёточная ступень — после сборки глёта', PBO_LADDER.stages.find((s) => s.id === 'lattice')!.at === PBO_CUES.find((c) => c.id === 'lattice')!.at)
}

// Стехиометрия и электронный баланс.
{
  const count = (formula: string, coeff: number, into: Map<string, number>) => {
    for (const m of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) into.set(m[1]!, (into.get(m[1]!) ?? 0) + (m[2] ? Number(m[2]) : 1) * coeff)
  }
  const left = new Map<string, number>()
  const right = new Map<string, number>()
  for (const t of PBO_REACTION.left) count(t.formula, t.coeff, left)
  for (const t of PBO_REACTION.right) count(t.formula, t.coeff, right)
  for (const k of new Set([...left.keys(), ...right.keys()])) ok(`баланс по ${k}`, left.get(k) === right.get(k))
  ok('кислород — двухатомная молекула', PBO_REACTION.left.some((t) => t.formula === 'O2') && !PBO_REACTION.left.some((t) => t.formula === 'O'))
  const given = PBO_HALF_REACTIONS.filter((h) => h.id === 'oxidation').reduce((s, h) => s + h.electrons * h.times, 0)
  const taken = PBO_HALF_REACTIONS.filter((h) => h.id === 'reduction').reduce((s, h) => s + h.electrons * h.times, 0)
  ok('электронный баланс', given === taken && given === Object.keys(PBO_ELECTRONS).length)
  ok('зарядовый баланс', PBO_HALF_REACTIONS.reduce((s, h) => s + h.chargeLeft * h.times, 0) === 0 && PBO_HALF_REACTIONS.reduce((s, h) => s + h.chargeRight * h.times, 0) === 0)
  const story = PBO_ATOMS.filter((a) => a.kind === 'story')
  ok('в сюжете 2 Pb и 2 O — как в уравнении', story.filter((a) => a.el === 'Pb').length === left.get('Pb') && story.filter((a) => a.el === 'O').length === left.get('O'))
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
const SPACE_GROUPS = [METAL.spaceGroup, MASS.spaceGroup, LITH.spaceGroup]
const strip = (s: string) => SPACE_GROUPS.reduce((acc, g) => acc.replaceAll(g, ''), s)

// ─────────────────────────────────────────────────────────────────────────────
// 8. 3D-подписи: символы и числа ядра
// ─────────────────────────────────────────────────────────────────────────────

/** Главное квантовое число пары ns² — из конфигурации ядра (подпись «6s²»). */
const S_SHELL_N = Number(/(\d)s[¹²](?!.*\ds[¹²])/.exec(ATOMIC_DATA.Pb.configuration)![1])
{
  const allowed3d = [
    METAL.cellPm.a,
    bondLengthPm('O=O'),
    LITH.cellPm.a,
    LITH.cellPm.c!,
    LITH.cationAnionPm,
    PBO_GAP.pm,
    PBO_LADDER.sumKJ,
    S_SHELL_N,
    ...Object.values(METAL.coordination),
    ...Object.values(MASS.coordination),
    ...Object.values(LITH.coordination),
  ]
  for (const l of PBO_LABELS) {
    for (const k of l.keys) {
      const bare = k.text.replace(/\{\w+\}/g, '')
      ok(`подпись ${l.id}: без кириллицы`, !/[А-Яа-яЁё]/.test(bare), k.text)
      ok(`подпись ${l.id}: без фраз (символ группы — обозначение)`, !/[a-z]{3,}/.test(strip(bare)), k.text)
      ok(`подпись ${l.id}: единицы только токенами`, !/\b(pm|kJ\/mol|kJ)\b/.test(bare) && !/\((s|g|l|aq)\)/.test(bare), k.text)
      for (const g of SPACE_GROUPS) if (bare.includes(g)) ok(`подпись ${l.id}: группа из ядра целиком`, bare.trim() === g)
      for (const n of numbers(strip(bare))) ok(`подпись ${l.id}: число ${n.raw} из ядра`, allowed3d.some((v) => matches(n, v)), k.text)
    }
  }
  const text = (id: string) => PBO_LABELS.find((l) => l.id === id)!.keys[0]!.text
  ok('подпись O=O = bondLengthPm', hasValue(text('ooBond'), bondLengthPm('O=O')) && numbers(text('ooBond')).length === 1)
  ok('подпись a ячейки свинца = ядро', hasValue(text('metalA'), METAL.cellPm.a))
  ok('подпись a глёта = ядро', hasValue(text('cellA'), LITH.cellPm.a) && text('cellA') === LITH_CAPTION[0])
  ok('подпись c глёта = ядро', hasValue(text('cellC'), LITH.cellPm.c!) && text('cellC') === LITH_CAPTION[1])
  ok('подпись Pb–O = cationAnionPm глёта', hasValue(text('dPbO'), LITH.cationAnionPm) && numbers(text('dPbO')).length === 1)
  ok('подпись щели = расчёт из ячейки', hasValue(text('gap'), PBO_GAP.pm) && numbers(text('gap')).length === 1)
  ok('подпись пары = ns² из конфигурации', text('lonePair') === `${S_SHELL_N}s²`)
  ok('подписи групп = ядро', text('massSg') === MASS.spaceGroup && text('lithSg') === LITH.spaceGroup)
  const dH = numbers(text('dH'))[0]!
  ok('подпись ΔH°f = сумма цикла со знаком', dH.sign === -1 && matches(dH, PBO_DHF_KJ) && near(PBO_DHF_KJ, PBO_LADDER.sumKJ, 0.05))
  for (const id of ['massCn', 'lithCn']) {
    const cn = numbers(text(id)).map((n) => n.v)
    ok(`подпись ${id}: КЧ = coordination ядра`, cn.length === 2 && cn[0] === CN_PB && cn[1] === CN_O)
  }

  const known = new Set(Object.keys(SCENE_LABEL_TOKENS.ru))
  for (const token of labelTokensUsed(PBO_LABELS)) ok(`токен {${token}} есть в словаре`, known.has(token))
  for (const locale of LOCALES) {
    const states = createLabelStates(PBO_LABELS)
    localizeSceneLabels(states, locale)
    for (const st of states) ok(`[${locale}] подпись ${st.id} раскрыта`, !/\{\w+\}/.test(st.text) && st.text.trim().length > 0)
  }
  const ru = createLabelStates(PBO_LABELS)
  const en = createLabelStates(PBO_LABELS)
  localizeSceneLabels(ru, 'ru')
  localizeSceneLabels(en, 'en')
  ok('подписи ru отличаются от en (единицы переведены)', ru.some((s, i) => s.text !== en[i]!.text))
  // Решение 8: числа в 3D по локали — десятичная запятая на ru/uz.
  for (const locale of ['ru', 'uz'] as const) {
    const st = createLabelStates(PBO_LABELS)
    localizeSceneLabels(st, locale, true)
    const g = st.find((x) => x.id === 'dPbO')!.text
    ok(`[${locale}] 3D-число с десятичной запятой: «${g}»`, g.includes(String(LITH.cationAnionPm).replace('.', ',')) && !/\d\.\d/.test(st.map((x) => x.text).join(' ')))
  }
  for (const l of PBO_LABELS) for (const w of l.windows) ok(`окно подписи ${l.id}`, w[0] < w[1] && w[0] >= 0 && w[1] <= PBO_END + 1e-9)
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Тексты урока: числа ↔ ядро, синхронность языков
// ─────────────────────────────────────────────────────────────────────────────

const st = (id: Parameters<typeof pboStageKJ>[0]) => pboStageKJ(id)
const abs = Math.abs
/**
 * Температура перехода глёт ⇄ массикот. Структурного поля в ядре нет (нужно phaseTransitionC в crystalData —
 * вне зоны сцены), поэтому число берётся НЕ «первым в note», а по смыслу: массикот — «выше N °C»,
 * глёт — «ниже N °C»; оба обязаны найтись ровно по одному разу и совпасть.
 */
const tAnchored = (id: string, word: string) => [...(getCrystal(id)!.note ?? '').matchAll(new RegExp(`${word} (\\d+) °C`, 'g'))].map((m) => Number(m[1]))
const T_MASS = tAnchored('massicot', 'выше')
const T_LITH = tAnchored('litharge', 'ниже')
const PHASE_T_C = T_MASS[0]!
ok('температура перехода: одна в note массикота («выше») и одна в note глёта («ниже»), равны', T_MASS.length === 1 && T_LITH.length === 1 && T_MASS[0] === T_LITH[0])
ok('переход ниже плавления PbO и выше плавления Pb (свинец при синтезе жидкий)', PHASE_T_C < MASS.meltingC! && PHASE_T_C > METAL.meltingC!)
const O_COUNT = LITH_FRAG.sites.filter((s) => s.el === 'O').length
const PB_COUNT = LITH_FRAG.sites.filter((s) => s.el === 'Pb').length
/**
 * Внешние константы, которых нет в ядре: стандартные условия 25 °C / 298 K и годы публикаций
 * (Walsh et al. 2011; Wyckoff 1963 — глёт; Hill 1985 и Kay 1961 — массикот) — библиографические ссылки,
 * а не числа химии; стоят позиционно (см. привязку ниже).
 */
const EXTERNAL = [25, 298, 2011, 1963, 1985, 1961]

const CORE_VALUES: number[] = [
  METAL.cellPm.a,
  METAL.cationAnionPm,
  METAL.meltingC!,
  bondLengthPm('O=O'),
  rPb0,
  rO0,
  rPb2,
  rO2,
  rPb2cn6,
  st('sublimation'),
  st('dissociation'),
  2 * st('dissociation'),
  st('ionization1'),
  st('ionization2'),
  st('affinity1'),
  st('affinity2'),
  st('lattice'),
  PBO_LADDER.sumKJ,
  PBO_COST_BEFORE_LATTICE_KJ,
  PBO_REACTION_DH_KJ,
  PBO_TEXTBOOK_ROUTE_DH_KJ,
  MASS.cellPm.a,
  MASS.cellPm.b!,
  MASS.cellPm.c!,
  MASS.densityGCm3,
  MASS.cationAnionPm,
  MASS.meltingC!,
  PHASE_T_C,
  LITH.cellPm.a,
  LITH.cellPm.c!,
  LITH.densityGCm3,
  LITH.cationAnionPm,
  PBO_GAP.pm,
  PBO_DHF_LITHARGE_KJ,
  PBO_DHF_MASSICOT_KJ,
  PBO_MASSICOT_EXCESS_KJ,
  MASS_FRAG.sites.length,
  LITH_FRAG.sites.length,
  O_COUNT,
  PB_COUNT,
  LATTICE_BALL_SCALE,
  ...EXTERNAL,
]
ok('в глёте-фрагменте O больше, чем Pb (оговорка note не пустая)', O_COUNT > PB_COUNT)
{
  // Плотности ядра = Z·M / (N_A·V) ячейки с точностью 0,5 % (справочная и рентгеновская).
  const N_A = 6.02214076e23
  const M = ATOMIC_DATA.Pb.atomicMassU + ATOMIC_DATA.O.atomicMassU
  for (const cr of [MASS, LITH]) {
    const v = cr.cellPm.a * (cr.cellPm.b ?? cr.cellPm.a) * cr.cellPm.c! * 1e-30
    const rho = (cr.z * M) / (N_A * v)
    ok(`ρ(${cr.id}) ядра = Z·M/(N_A·V) (0,5 %)`, abs(rho - cr.densityGCm3) / cr.densityGCm3 < 5e-3, `${rho.toFixed(3)} против ${cr.densityGCm3}`)
  }
}

/**
 * Малые целые (≤ 12) в общей сверке пропускаются как счёт (2 Pb, ×2, 10²³ → 10, 2×2×2), НО там, где их
 * смысл известен (Z, КЧ, 12 соседей, 6s², коэффициенты уравнения), они сверяются позиционно — см. SMALL.
 */
const isCount = (n: Num) => n.dec === 0 && n.v <= 12

const fields = (t: PboMechanismText): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const id of PBO_STEP_IDS) {
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

for (const locale of LOCALES) {
  const t = getPboMechanismText(locale)
  ok(`[${locale}] заголовок и безопасность`, t.intro.title.length > 0 && t.safety.length > 20)
  for (const id of PBO_STEP_IDS) {
    const s = t.steps[id]
    ok(`[${locale}] ${id}: заголовок, уравнение, реплика`, s.title.trim().length > 0 && s.equation.trim().length > 0 && s.speak.trim().length > 0)
    ok(`[${locale}] ${id}: 2–4 предложения`, s.body.split(/[.!?]\s/).length >= 2)
    ok(`[${locale}] ${id}: есть note (всё схематичное названо)`, (s.note ?? '').length > 0)
    ok(`[${locale}] ${id}: в реплике нет цифр (озвучивается словами)`, !/\d/.test(s.speak))
  }
  ok(`[${locale}] aria-подпись лестницы`, t.energy.summary.includes('{dH}'))
  ok(`[${locale}] подписи всех ступеней лестницы`, PBO_LADDER.stages.every((s) => (t.energy.stages as Record<string, string>)[s.id]!.length > 0))
  ok(`[${locale}] нет частиц O²⁻ «на старте» и Pb⁴⁺`, !JSON.stringify(t).includes('Pb⁴⁺'))

  const f = fields(t)
  for (const [key, s] of Object.entries(f)) {
    for (const n of numbers(strip(s))) {
      if (isCount(n)) continue
      ok(`[${locale}] ${key}: число ${n.raw.trim()} есть в ядре`, CORE_VALUES.some((v) => matches(n, v)), s.slice(0, 80))
    }
  }

  // Сумма цикла в тексте: слагаемые = ступени ядра по порядку, итог = табличная ΔH°f.
  {
    const body = t.steps.energy.body
    const eq = body.indexOf('=')
    const terms = [...body.slice(0, eq).matchAll(/([+−-])\s?(\d+[.,]\d+)/g)].map((m) => (m[1] === '+' ? 1 : -1) * Number(m[2]!.replace(',', '.')))
    const res = /([+−-])\s?(\d+[.,]\d+)/.exec(body.slice(eq))!
    const total = (res[1] === '+' ? 1 : -1) * Number(res[2]!.replace(',', '.'))
    const cycle = BORN_HABER.pbo!.stages.map((s) => s.dHKJ)
    ok(`[${locale}] сумма в тексте: слагаемые = ступени ядра`, terms.length === cycle.length && terms.every((v, i) => near(v, cycle[i]!, 0.05)), terms.join(' '))
    ok(`[${locale}] сумма в тексте сходится арифметически`, near(terms.reduce((s, v) => s + v, 0), total, 0.05))
    ok(`[${locale}] итог суммы = табличная ΔH°f`, near(total, dHfKJ('PbO(litharge)'), 0.05))
    const eqn = numbers(t.steps.energy.equation).find((n) => n.dec > 0)!
    ok(`[${locale}] ΔH уравнения = 2·ΔH°f со знаком минус`, eqn.sign === -1 && matches(eqn, PBO_REACTION_DH_KJ))
    const tr = numbers(t.steps.litharge.equation).find((n) => n.dec > 0)!
    ok(`[${locale}] ΔH перехода β → α = −(массикот − глёт)`, tr.sign === -1 && matches(tr, PBO_MASSICOT_EXCESS_KJ))
    const ea = numbers(t.steps.transfer.body).filter((n) => matches(n, st('affinity1')) || matches(n, st('affinity2')))
    ok(`[${locale}] EA₁ со знаком минус, EA₂ со знаком плюс`, ea.some((n) => n.sign === -1 && matches(n, st('affinity1'))) && ea.some((n) => n.sign === 1 && matches(n, st('affinity2'))))
    const route = numbers(t.steps.energy.note).find((n) => n.dec > 0 && matches(n, PBO_TEXTBOOK_ROUTE_DH_KJ))
    ok(`[${locale}] способ учебника со знаком плюс`, route != null && route.sign === 1)
  }
}

// ─── Привязка «число ↔ величина»: ТО число на ТОМ месте (ru), en/uz — та же последовательность ───
{
  const seq = (s: string) => numbers(strip(s)).filter((n) => !isCount(n)).map((n) => n.v)
  const sameSeq = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => near(v, b[i]!, 1e-9))
  const expect: Record<string, number[]> = {
    'reactants.body': [METAL.cellPm.a, METAL.cationAnionPm, bondLengthPm('O=O'), rPb0, rO0, 25, METAL.meltingC!],
    'reactants.note': [25, PHASE_T_C, METAL.meltingC!],
    'sublimation.body': [st('sublimation'), st('dissociation'), 298, 2 * st('dissociation')],
    'transfer.body': [st('ionization1'), st('ionization2'), abs(st('affinity1')), st('affinity2'), rPb0, rPb2, rO0, rO2],
    'transfer.note': [rPb2cn6, rPb0, rO0, rPb2, rO2],
    'massicot.body': [METAL.meltingC!, PHASE_T_C, MASS.cellPm.a, MASS.cellPm.b!, MASS.cellPm.c!, MASS.densityGCm3, MASS.cationAnionPm, PHASE_T_C, MASS.meltingC!],
    'massicot.equation': [PHASE_T_C],
    'massicot.note': [MASS_FRAG.sites.length, LATTICE_BALL_SCALE, 1985, 1961],
    'litharge.body': [25, LITH.cellPm.a, LITH.cellPm.c!, LITH.densityGCm3, LITH.cationAnionPm, PBO_GAP.pm, abs(PBO_DHF_LITHARGE_KJ), abs(PBO_DHF_MASSICOT_KJ), 25, PBO_MASSICOT_EXCESS_KJ],
    'litharge.equation': [PBO_MASSICOT_EXCESS_KJ],
    'litharge.note': [LITH_FRAG.sites.length, O_COUNT, PB_COUNT, 2011, 1963, PBO_GAP.pm],
    'energy.body': [st('sublimation'), st('dissociation'), st('ionization1'), st('ionization2'), abs(st('affinity1')), st('affinity2'), abs(st('lattice')), abs(PBO_LADDER.sumKJ), PBO_COST_BEFORE_LATTICE_KJ, abs(PBO_REACTION_DH_KJ)],
    'energy.equation': [abs(PBO_REACTION_DH_KJ)],
    'energy.note': [abs(st('lattice')), st('affinity2'), 298, PHASE_T_C, 298, PBO_TEXTBOOK_ROUTE_DH_KJ],
  }
  const ru = fields(getPboMechanismText('ru'))
  for (const [key, want] of Object.entries(expect)) {
    const got = numbers(strip(ru[key]!)).filter((n) => !isCount(n))
    ok(`[ru] ${key}: числа стоят на своих местах (привязка к величинам ядра)`, got.length === want.length && got.every((n, i) => matches(n, want[i]!)), `${got.map((n) => n.v).join(' ')} | ожидалось ${want.map((v) => v.toFixed(2)).join(' ')}`)
  }
  for (const locale of LOCALES) {
    const f = fields(getPboMechanismText(locale))
    const z = [...f['massicot.body']!.matchAll(/Z = (\d+)/g), ...f['litharge.body']!.matchAll(/Z = (\d+)/g)].map((m) => Number(m[1]))
    ok(`[${locale}] Z в тексте = ядро (массикот, глёт)`, z.length === 2 && z[0] === MASS.z && z[1] === LITH.z)
    const cn = /(\d+):(\d+)/.exec(f['massicot.body']!)
    ok(`[${locale}] КЧ в тексте = coordination ядра`, cn != null && Number(cn[1]) === CN_PB && Number(cn[2]) === CN_O)
    for (const key of ['massicot.note', 'litharge.note']) {
      const cells = /(\d)×(\d)×(\d)/.exec(f[key]!)
      const frag = key.startsWith('massicot') ? MASS_FRAG : LITH_FRAG
      ok(`[${locale}] ${key}: фрагмент = cells`, cells != null && [1, 2, 3].every((i) => Number(cells[i]) === frag.cells[i - 1]))
    }
    // Малые целые со смыслом — позиционно, из ядра (порча «Z = 3», «КЧ 4:6», «11 соседей» ловится).
    const coeffs = [...PBO_REACTION.left, ...PBO_REACTION.right].map((x) => x.coeff as number).filter((c) => c !== 1)
    const SMALL: Record<string, number[]> = {
      'reactants.body': [METAL.coordination.Pb!],
      'massicot.body': [MASS.z, CN_PB, CN_O],
      'litharge.body': [LITH.z, S_SHELL_N],
      'massicot.equation': coeffs,
      'energy.equation': coeffs,
    }
    for (const [key, want] of Object.entries(SMALL)) {
      const got = numbers(strip(f[key]!)).filter(isCount).map((n) => n.v)
      ok(`[${locale}] ${key}: малые целые = ядро (${want.join(', ')})`, got.length === want.length && got.every((v, i) => v === want[i]), got.join(' '))
    }
    // Условия: термохимия — 298 K, твёрдый свинец; синтез массикота — выше перехода, где свинец жидкий.
    const STATE = { ru: { s: '(тв.)', l: '(ж.)' }, en: { s: '(s)', l: '(l)' }, uz: { s: '(qat.)', l: '(suyuq.)' } }[locale]
    const pbState = (eq: string) => (eq.includes(`Pb ${STATE.l}`) ? 'l' : eq.includes(`Pb ${STATE.s}`) ? 's' : '?')
    const stateAt = (tC: number) => (tC > METAL.meltingC! ? 'l' : 's')
    ok(`[${locale}] шаг 1: свинец в стандартном состоянии при 25 °C (${stateAt(25)})`, pbState(f['reactants.equation']!) === stateAt(25))
    ok(`[${locale}] шаг 6: ΔH при 298 K — свинец ${stateAt(25)}`, pbState(f['energy.equation']!) === stateAt(25))
    ok(`[${locale}] шаг 4: синтез массикота выше ${PHASE_T_C} °C — свинец ${stateAt(PHASE_T_C)}`, pbState(f['massicot.equation']!) === stateAt(PHASE_T_C))
    ok(`[${locale}] шаг 4: уравнение стадии — реальная реакция, не газовые ионы`, !/Pb²⁺ \+ O²⁻/.test(f['massicot.equation']!))
    // Цикл формальный (ядро: PBO_CYCLE_IS_FORMAL) ⇒ «мысленный путь» назван уже в шагах 2–4, а не только в 6.
    const IMAGINARY = { ru: /мысленн|воображаем/i, en: /imaginary/i, uz: /xayoliy|xayolan/i }[locale]
    for (const key of ['sublimation.body', 'sublimation.note', 'transfer.note', 'massicot.note']) {
      ok(`[${locale}] ${key}: путь через газ назван мысленным`, !PBO_CYCLE_IS_FORMAL || IMAGINARY.test(f[key]!))
    }
    ok(`[${locale}] energy.note: названа справочная энергия решётки (CRC), U — выведенная`, !PBO_LATTICE_IS_ESTIMATED || /CRC/.test(f['energy.note']!))
    const cnNote = [...f['transfer.note']!.matchAll(/(?:КЧ|CN|KS) (\d+)/g)].map((m) => Number(m[1]))
    ok(`[${locale}] transfer.note: КЧ 4 (структура) и 6 (сравнение 119)`, cnNote.length === 2 && cnNote[0] === CN_PB && ionicRadiusPm('Pb', 2, cnNote[1]) === rPb2cn6)
    if (locale === 'ru') continue
    for (const key of Object.keys(f)) {
      ok(`[${locale}] ${key}: порядок чисел как в ru`, sameSeq(seq(f[key]!), seq(ru[key]!)), `${seq(f[key]!).join(' ')} | ru ${seq(ru[key]!).join(' ')}`)
      const all = (s: string) => numbers(strip(s)).map((n) => n.v).sort((a, b) => a - b).join(' ')
      ok(`[${locale}] ${key}: полный набор чисел как в ru (со счётными)`, all(f[key]!) === all(ru[key]!), `${all(f[key]!)} | ru ${all(ru[key]!)}`)
    }
  }
}

console.log(`✓ pbo cinema: ${checks} проверок пройдено`)
console.log(`  шагов ${PBO_STEPS.length}, экранное время ${wall.toFixed(1)} с (${PBO_STEPS.map((s) => s.wall).join(' + ')} + хвост), сюжет ${PBO_END} с`)
console.log(`  формальный цикл: Σ = ${PBO_LADDER.sumKJ} кДж/моль (таблица ${PBO_DHF_TABLE_KJ}), U = ${PBO_LATTICE_KJ}, до решётки +${PBO_COST_BEFORE_LATTICE_KJ}`)
console.log(`  радиусы: Pb ${rPb0} → Pb²⁺ ${rPb2} (КЧ ${CN_PB}; при КЧ 6 — ${rPb2cn6}), O ${rO0} → O²⁻ ${rO2} пм`)
console.log(`  массикот ${MASS_FRAG.sites.length} ионов (${MASS.spaceGroup}), глёт ${LITH_FRAG.sites.length} ионов (${LITH.spaceGroup}), Pb–O ${LITH.cationAnionPm}, щель Pb···Pb ${PBO_GAP.pm.toFixed(1)} пм, переход ${PHASE_T_C} °C`)
