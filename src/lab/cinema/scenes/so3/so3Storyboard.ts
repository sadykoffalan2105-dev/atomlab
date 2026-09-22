import * as THREE from 'three'
import { bondAngleDeg, reagentBondPm, REAGENT_GEOMETRY } from '../../../../chemistry/data'
import { smoothstep } from '../../core/easing'
import { sampleScalar, sampleVec3, type ScalarTrack, type Vec3Track } from '../../core/tracks'
import { TETRAHEDRAL_ANGLE_DEG, writeTrigonalPlanar } from '../../core/vsepr'
import { orbitTrack, sampleShot, shotTrack, type ShotTrack } from '../kit/camera'
import { bondLength, pmToScene, speciesRadius } from '../kit/cpkAtoms'
import type { SubstanceKind } from '../kit/materials'
import {
  createLabelStates,
  createSceneCamera,
  fadeTrack,
  sampleLabels,
  validateTracks,
  type SceneCamera,
  type SceneLabelDef,
  type SceneLabelState,
} from '../kit/sceneKit'
import { octetSnap } from '../kit/valence'
import { SO3_FACTS, SO3_REACTION_DH_KJ } from './so3Energetics'
import { SO3_END, SO3_FINISH, SO3_STEPS, SO3_TRANSFERS, so3CueAt } from './so3Steps'

export {
  SO3_CUES,
  SO3_END,
  SO3_FINISH,
  SO3_SEGMENTS,
  SO3_STEPS,
  SO3_STEP_IDS,
  SO3_TIMING,
  SO3_TRANSFERS,
  so3StepIndexAt,
  type So3CueId,
  type So3StepId,
} from './so3Steps'

/**
 * Раскадровка 2 SO₂ (г.) + O₂ (г.) ⇌ 2 SO₃ (г.) на V₂O₅ — ЧИСТАЯ функция времени сюжета.
 * Построена по рецепту эталона NaCl (scenes/nacl).
 *
 * Ни одного числа химии: длины — из bondData (S=O в SO₂, S=O в SO₃, O=O; S–O кольца и S=O
 * тримера — REAGENT_GEOMETRY.s3o9), углы — bondAngleDeg, радиусы — speciesRadius (Кордеро:
 * все частицы ковалентные), ΔH — formationReactionKJ через so3Energetics, степени окисления —
 * из электронейтральности (sulfurOxidationState).
 *
 * Правила эталона, выполненные по построению:
 *   • в кадре только объекты текущего шага: у каждого атома span [первый, последний шаг],
 *     вне него непрозрачность строго 0 (тест — каждую 1/60 с);
 *   • каждый видимый атом подписан (label.hosts); поверхность катализатора — схема из точек,
 *     подписанная формулой места V₂O₅ / V₂O₄ (атомов ванадия нет: их положения были бы выдумкой);
 *   • перенос атома O: в кадр transfer S⁺⁴ → S⁺⁶, материал «каркас» → «молекула», подписи
 *     SO₂ → SO₃ и V₂O₅ → V₂O₄ — одной ступенью (octetSnap); в кадр refill V₂O₄ → V₂O₅;
 *   • SO₂ — уголковая (bondData), SO₃ — плоский треугольник через core/vsepr.writeTrigonalPlanar;
 *   • O=O рвётся гомолитически на поверхности, атомы O занимают освободившиеся места;
 *   • финал без огня, ореолов и свечения внутри вещества: FX-амплитуды → 0.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия из научного ядра
// ─────────────────────────────────────────────────────────────────────────────

/** S=O в SO₂ и в SO₃, O=O — мировые единицы. */
const L2 = bondLength('S=O')
const L3 = bondLength('S=O(SO3)')
const LOO = bondLength('O=O')
/** Валентные углы O–S–O: SO₂ (уголковая) и SO₃ (D₃h), градусы. */
const A2 = bondAngleDeg('sulfurDioxide')
const A3 = bondAngleDeg('sulfurTrioxide')
/** Тример S₃O₉ (γ-SO₃, кристалл): мостиковая S–O кольца и концевая S=O. */
const LR = pmToScene(reagentBondPm('s3o9', 'S–O(кольцо)'))
const LT = pmToScene(reagentBondPm('s3o9', 'S=O(конц.)'))

const R = {
  s: speciesRadius('S', 0),
  o: speciesRadius('O', 0),
} as const

/**
 * Кратность, которую рисует полоса связи (соглашение рисунка): σ + одна π-пара,
 * делокализованная по n связям S–O → 1 + 1/n. SO₂: полоса с пунктиром ½, SO₃ — ⅓.
 * Это УПРОЩЁННЫЙ октетный счёт, а не измеряемая величина: по нему у SO₃ кратность меньше,
 * чем у SO₂, хотя связь S–O в SO₃ короче (данные ядра). Противоречие снимает текст урока
 * (product.note): длину задаёт и полярность S–O (больший δ+ на S в SO₃), порядок связи
 * зависит от модели. Тест проверяет, что это условие по данным выполняется и текст называет обе длины.
 */
const DELOCALIZED_PI_PAIRS = 1
const ORDER_SO2 = 1 + DELOCALIZED_PI_PAIRS / 2
const ORDER_SO3 = 1 + DELOCALIZED_PI_PAIRS / 3

/**
 * Ориентация молекул: локальная плоскость XZ (vsepr) → мировая XY (лицом к камере),
 * локальная +Z (третий лиганд SO₃) → мировая −Y (к поверхности катализатора).
 */
const MOL_PITCH = Math.PI / 2

// ─────────────────────────────────────────────────────────────────────────────
// Схема катализатора (параметры рисунка, не химия: структура V₂O₅ в кадре не строится)
// ─────────────────────────────────────────────────────────────────────────────

/** Плоскость поверхности катализатора (сетка точек). */
export const SO3_SURFACE_Y = -1.0
/** Два места «атом O на ванадии» — по одному на формульную единицу V₂O₅ школьной схемы. */
const SITE_DX = 0.62
/** Центр атома O катализатора: шар лежит на плоскости поверхности. */
const YC = SO3_SURFACE_Y + R.o
/** Сера в кадр переноса: ровно на S=O(SO₃) над атомом O места. */
const YS = YC + L3
const HOVER = 0.45
const SITE: readonly [readonly [number, number, number], readonly [number, number, number]] = [
  [-SITE_DX, YC, 0],
  [SITE_DX, YC, 0],
]
export const SO3_SITES = SITE
/** Сетка точек поверхности: полуширина по x и глубина по z (рисунок). */
export const SO3_SURFACE = { halfX: 1.3, halfZ: 0.5, step: 0.16 } as const

export const SO3_GEOM = {
  radius: R,
  so2: L2,
  so3: L3,
  oo: LOO,
  angleSO2: A2,
  angleSO3: A3,
  ring: LR,
  term: LT,
  orderSO2: ORDER_SO2,
  orderSO3: ORDER_SO3,
  molPitch: MOL_PITCH,
  surfaceY: SO3_SURFACE_Y,
  siteY: YC,
  sulfurAtTransferY: YS,
} as const

/** Масштаб рига камеры. */
export const SO3_RIG_SCALE = 1.1

// ─────────────────────────────────────────────────────────────────────────────
// Состав кадра
// ─────────────────────────────────────────────────────────────────────────────

export type So3Element = 'S' | 'O'
export type So3AtomKind = 'story' | 'catalyst' | 'trimer'

export type So3AtomDef = {
  id: string
  el: So3Element
  kind: So3AtomKind
  /** индексы шагов [первый, последний], на которых атом имеет право быть видимым */
  span: readonly [number, number]
}

const T = {
  collide: so3CueAt('collide'),
  a: SO3_TRANSFERS.a,
  b: SO3_TRANSFERS.b,
  brk: so3CueAt('o2Break'),
  planar: so3CueAt('planar'),
  trimer: so3CueAt('trimer'),
}

const stepFrom = (i: number) => SO3_STEPS[i]!.from
const stepTo = (i: number) => SO3_STEPS[i]!.to
const LAST_STEP = SO3_STEPS.length - 1

// ——— Тример S₃O₉: кольцо «кресло» из тетраэдров (углы — идеальный тетраэдр, схема) ———
// Схема искажает и мостиковый O: в γ-SO₃ угол S–O–S кольца заметно больше тетраэдрического,
// угол O–S–O кольца — меньше (McDonald & Cruickshank 1967). Углов кольца в ядре нет
// (REAGENT_GEOMETRY.s3o9.anglesDeg пуст), поэтому сцена строит идеальный тетраэдр и note это называет.

type V3 = readonly [number, number, number]
const TRIMER_CENTER: V3 = [0.74, -0.05, 0]

/**
 * Кольцо (–SO₂–O–)₃: шесть атомов через 60° по окружности радиуса Rr, высоты ±h чередуются.
 * Из |соседей| = LR и угла при вершине θ: Rr² = LR²·(1 − cos θ)/1,5, 4h² = LR² − Rr².
 */
function buildTrimer(): { ring: V3[]; term: V3[]; termOf: number[] } {
  const cosT = Math.cos((TETRAHEDRAL_ANGLE_DEG * Math.PI) / 180)
  const rr = LR * Math.sqrt((1 - cosT) / 1.5)
  const h = Math.sqrt(LR * LR - rr * rr) / 2
  const ring: V3[] = []
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3
    ring.push([TRIMER_CENTER[0] + rr * Math.cos(a), TRIMER_CENTER[1] + (i % 2 === 0 ? h : -h), TRIMER_CENTER[2] + rr * Math.sin(a)])
  }
  // Концевые S=O: две оставшиеся вершины тетраэдра у каждой серы (кольцо — чётные индексы).
  const term: V3[] = []
  const termOf: number[] = []
  const half = (TETRAHEDRAL_ANGLE_DEG * Math.PI) / 360
  const v = (p: V3, q: V3) => new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]).normalize()
  for (let i = 0; i < 6; i += 2) {
    const p = ring[i]!
    const u1 = v(p, ring[(i + 5) % 6]!)
    const u2 = v(p, ring[(i + 1) % 6]!)
    const s = u1.clone().add(u2).normalize()
    const n = u1.clone().cross(u2).normalize()
    for (const sign of [1, -1]) {
      const d = s.clone().multiplyScalar(-Math.cos(half)).addScaledVector(n, sign * Math.sin(half))
      term.push([p[0] + d.x * LT, p[1] + d.y * LT, p[2] + d.z * LT])
      termOf.push(i)
    }
  }
  return { ring, term, termOf }
}
const TRIMER = buildTrimer()

const STORY_ATOMS: readonly So3AtomDef[] = [
  // SO₂ (a): живёт до конца — становится продуктом крупным планом.
  { id: 'sA', el: 'S', kind: 'story', span: [0, LAST_STEP] },
  { id: 'oA1', el: 'O', kind: 'story', span: [0, LAST_STEP] },
  { id: 'oA2', el: 'O', kind: 'story', span: [0, LAST_STEP] },
  // SO₂ (b): уходит из кадра на шаге 5.
  { id: 'sB', el: 'S', kind: 'story', span: [0, 4] },
  { id: 'oB1', el: 'O', kind: 'story', span: [0, 4] },
  { id: 'oB2', el: 'O', kind: 'story', span: [0, 4] },
  // O₂: после распада — кислород катализатора, гаснет вместе с поверхностью на шаге 5.
  { id: 'o1', el: 'O', kind: 'story', span: [0, 4] },
  { id: 'o2', el: 'O', kind: 'story', span: [0, 4] },
  // Атомы O катализатора: переходят в SO₃ (a) и SO₃ (b).
  { id: 'c1', el: 'O', kind: 'catalyst', span: [2, LAST_STEP] },
  { id: 'c2', el: 'O', kind: 'catalyst', span: [2, 4] },
]

const TRIMER_ATOMS: So3AtomDef[] = [
  ...TRIMER.ring.map((_, i) => ({ id: `tr${i}`, el: (i % 2 === 0 ? 'S' : 'O') as So3Element, kind: 'trimer' as const, span: [LAST_STEP, LAST_STEP] as const })),
  ...TRIMER.term.map((_, k) => ({ id: `tt${k}`, el: 'O' as So3Element, kind: 'trimer' as const, span: [LAST_STEP, LAST_STEP] as const })),
]

export const SO3_ATOMS: readonly So3AtomDef[] = [...STORY_ATOMS, ...TRIMER_ATOMS]
export const SO3_ATOM_INDEX: ReadonlyMap<string, number> = new Map(SO3_ATOMS.map((a, i) => [a.id, i]))
const IDX = (id: string) => SO3_ATOM_INDEX.get(id)!

const I = {
  sA: IDX('sA'),
  oA1: IDX('oA1'),
  oA2: IDX('oA2'),
  sB: IDX('sB'),
  oB1: IDX('oB1'),
  oB2: IDX('oB2'),
  o1: IDX('o1'),
  o2: IDX('o2'),
  c1: IDX('c1'),
  c2: IDX('c2'),
} as const
const TRIMER_BASE = STORY_ATOMS.length
const TRIMER_IDS = TRIMER_ATOMS.map((a) => a.id)

/** Позиции тримера (мировые единицы) по id — для теста. */
export const SO3_TRIMER_POS: ReadonlyMap<string, V3> = new Map<string, V3>([
  ...TRIMER.ring.map((p, i) => [`tr${i}`, p] as [string, V3]),
  ...TRIMER.term.map((p, k) => [`tt${k}`, p] as [string, V3]),
])

// ─────────────────────────────────────────────────────────────────────────────
// Связи: слоты пула (стабильные индексы)
// ─────────────────────────────────────────────────────────────────────────────

export type So3BondKind = 'soA' | 'soB' | 'oo' | 'ring' | 'term'
export type So3BondDef = { a: string; b: string; kind: So3BondKind }

export const SO3_BONDS: readonly So3BondDef[] = [
  { a: 'sA', b: 'oA1', kind: 'soA' },
  { a: 'sA', b: 'oA2', kind: 'soA' },
  { a: 'sA', b: 'c1', kind: 'soA' },
  { a: 'sB', b: 'oB1', kind: 'soB' },
  { a: 'sB', b: 'oB2', kind: 'soB' },
  { a: 'sB', b: 'c2', kind: 'soB' },
  { a: 'o1', b: 'o2', kind: 'oo' },
  ...TRIMER.ring.map((_, i) => ({ a: `tr${i}`, b: `tr${(i + 1) % 6}`, kind: 'ring' as const })),
  ...TRIMER.term.map((_, k) => ({ a: `tr${TRIMER.termOf[k]}`, b: `tt${k}`, kind: 'term' as const })),
]
const BOND_IDX = SO3_BONDS.map((b) => [IDX(b.a), IDX(b.b)] as const)
/** Слот третьей связи S–O (атом катализатора) у молекулы a и b. */
const SLOT_CA = 2
const SLOT_CB = 5
const SLOT_OO = 6

// ─────────────────────────────────────────────────────────────────────────────
// Положения
// ─────────────────────────────────────────────────────────────────────────────

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

/** Смещение лиганда под углом φ (от локальной +Z) при исходной ориентации молекулы: (L sin φ, −L cos φ, 0). */
const ligandOffset = (phiDeg: number, len: number): V3 => {
  const p = (phiDeg * Math.PI) / 180
  return [len * Math.sin(p), -len * Math.cos(p), 0]
}

const SA0: V3 = [-1.45, 0.05, 0]
const SB0: V3 = [1.45, 0.05, 0]
const O2C0: V3 = [0.15, 0.62, 0]
const SA_UP: V3 = [-1.55, 0.55, 0]
const SB_UP: V3 = [1.55, 0.55, 0]
const SB_OUT: V3 = [2.3, 0.75, 0]
const SA_C: V3 = [0, 0.15, 0]
const SA_SIDE: V3 = [-1.45, 0.05, 0]

/**
 * Столкновение без катализатора (шаг 2): правый O молекулы SO₂ (a) подходит к левому атому O₂
 * на CONTACT и отходит назад — «соударение без реакции». CONTACT — параметр рисунка.
 */
const CONTACT = 2.4 * R.o
const O2_LEFT0: V3 = [O2C0[0] - LOO / 2, O2C0[1], O2C0[2]]
const RIGHT_O_SO2 = ligandOffset(180 - A2 / 2, L2)
const S_HIT: V3 = [O2_LEFT0[0] - CONTACT * 0.88 - RIGHT_O_SO2[0], O2_LEFT0[1] - CONTACT * 0.47 - RIGHT_O_SO2[1], 0]

const siteAbove = (k: 0 | 1, dy: number): V3 => [SITE[k][0], YS + dy, SITE[k][2]]

export const SO3_S_TRACKS: { a: Vec3Track; b: Vec3Track } = {
  a: [
    { t: 0, v: SA0 },
    { t: stepFrom(1) + 0.5, v: SA0 },
    { t: T.collide, v: S_HIT, ease: 'smooth' },
    { t: T.collide + 1.6, v: SA0, ease: 'smooth' },
    { t: stepFrom(2) + 0.8, v: SA0 },
    { t: T.a.transfer - 1.2, v: siteAbove(0, HOVER), ease: 'smooth' },
    { t: T.a.transfer, v: siteAbove(0, 0), ease: 'smooth' },
    { t: T.a.transfer + 0.4, v: siteAbove(0, 0) },
    { t: stepTo(2) - 1.0, v: SA_UP, ease: 'smooth', arc: 0.15, arcAxis: [0, 0, 1] },
    { t: stepFrom(4) + 0.3, v: SA_UP },
    { t: T.planar, v: SA_C, ease: 'smooth' },
    { t: stepFrom(5) + 0.2, v: SA_C },
    { t: stepFrom(5) + 1.4, v: SA_SIDE, ease: 'smooth' },
  ],
  b: [
    { t: 0, v: SB0 },
    { t: stepFrom(2) + 1.6, v: SB0 },
    { t: T.b.transfer - 1.4, v: siteAbove(1, HOVER), ease: 'smooth' },
    { t: T.b.transfer, v: siteAbove(1, 0), ease: 'smooth' },
    { t: T.b.transfer + 0.4, v: siteAbove(1, 0) },
    { t: stepTo(2) - 0.1, v: SB_UP, ease: 'smooth', arc: -0.15, arcAxis: [0, 0, 1] },
    { t: stepFrom(4) + 0.3, v: SB_UP },
    { t: T.planar, v: SB_OUT, ease: 'inQuad' },
  ],
}

/** O₂ опускается на поверхность, рвётся над двумя пустыми местами; атомы садятся в места. */
const O2_LOW: V3 = [0, YC + 0.42, 0]
const O2_CENTER_KEYS: readonly { t: number; v: V3; ease?: 'smooth' }[] = [
  { t: 0, v: O2C0 },
  { t: stepFrom(3) + 0.3, v: O2C0 },
  { t: stepFrom(3) + 1.5, v: O2_LOW, ease: 'smooth' },
  { t: T.brk, v: O2_LOW },
]
const o2Track = (sign: -1 | 1, site: V3, arrive: number): Vec3Track => [
  // До разрыва оба атома — одна и та же дорожка центра со сдвигом ±d(O=O)/2: длина связи точная.
  ...O2_CENTER_KEYS.map((k) => ({ t: k.t, v: add(k.v, [(sign * LOO) / 2, 0, 0]), ease: k.ease })),
  { t: arrive, v: site, ease: 'smooth' as const },
]
export const SO3_O2_TRACKS: { o1: Vec3Track; o2: Vec3Track } = {
  o1: o2Track(-1, SITE[0], T.a.refill),
  o2: o2Track(1, SITE[1], T.b.refill),
}

/** Превращение SO₂ → SO₃ после переноса: угол A2 → A3, длина S=O(SO₂) → S=O(SO₃). */
const morphTrack = (t0: number): ScalarTrack => [
  { t: t0, v: 0 },
  { t: t0 + 0.8, v: 1, ease: 'smooth' },
]
const MORPH_A = morphTrack(T.a.transfer)
const MORPH_B = morphTrack(T.b.transfer)

/** Поворот продукта вокруг вертикали (шаг 5): видно, что четыре атома в одной плоскости. */
export const SO3_YAW_A: ScalarTrack = [
  { t: 0, v: 0 },
  { t: T.planar, v: 0 },
  { t: stepTo(4) - 0.6, v: 1.2, ease: 'smooth' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Скалярные дорожки
// ─────────────────────────────────────────────────────────────────────────────

/**
 * СТУПЕНИ В КАДР ПЕРЕНОСА (octetSnap — один кадр, без промежуточных значений):
 * ox — формальная степень окисления серы (SO₂ → SO₃), site — сколько атомов O стоит на месте
 * (1 — V₂O₅, 0 — V₂O₄): 1 → 0 в кадр transfer, 0 → 1 в кадр refill.
 */
const siteTrack = (tOut: number, tIn: number): ScalarTrack => [...octetSnap(tOut, 1, 0), ...octetSnap(tIn, 0, 1)]
export const SO3_SNAP = {
  oxA: octetSnap(T.a.transfer, SO3_FACTS.oxSO2, SO3_FACTS.oxSO3),
  oxB: octetSnap(T.b.transfer, SO3_FACTS.oxSO2, SO3_FACTS.oxSO3),
  siteA: siteTrack(T.a.transfer, T.a.refill),
  siteB: siteTrack(T.b.transfer, T.b.refill),
} as const

const APPEAR: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.6, v: 1, ease: 'smooth' },
]
/** Поверхность катализатора (сетка точек) и её атомы O: шаги 3–4, гаснут в начале шага 5. */
export const SO3_SURFACE_AMOUNT: ScalarTrack = [
  { t: stepFrom(2) + 0.1, v: 0 },
  { t: stepFrom(2) + 0.9, v: 1, ease: 'smooth' },
  { t: stepFrom(4) + 0.2, v: 1 },
  { t: stepFrom(4) + 0.9, v: 0, ease: 'smooth' },
]
/**
 * Атомы O катализатора проявляются ВМЕСТЕ с сеткой поверхности как один объект: полный радиус,
 * меняется только прозрачность (никакого «роста из точки» — он читался бы как рождение атомов).
 */
const CAT_APPEAR: ScalarTrack = [
  { t: stepFrom(2) + 0.1, v: 0 },
  { t: stepFrom(2) + 0.9, v: 1, ease: 'smooth' },
]
/** O из O₂ (теперь в катализаторе) гаснут вместе с поверхностью. */
const CAT_O_FADE: ScalarTrack = [
  { t: stepFrom(4) + 0.2, v: 1 },
  { t: stepFrom(4) + 0.9, v: 0, ease: 'smooth' },
]
/** SO₃ (b) уходит из кадра и гаснет до паузы шага 5. */
const B_FADE: ScalarTrack = [
  { t: stepFrom(4) + 0.7, v: 1 },
  { t: T.planar, v: 0, ease: 'smooth' },
]
/** Связь O=O: натяжение и гомолитический разрыв на поверхности. */
const OO_STRESS: ScalarTrack = [
  { t: T.brk - 0.7, v: 0 },
  { t: T.brk, v: 1, ease: 'inQuad' },
]
const OO_THIN: ScalarTrack = [
  { t: T.brk - 0.15, v: 0 },
  { t: T.brk + 0.35, v: 1, ease: 'outCubic' },
]
const OO_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.6, v: 1, ease: 'smooth' },
  { t: T.brk, v: 1 },
  { t: T.brk + 0.5, v: 0, ease: 'smooth' },
]
/** Третья связь S–O появляется, начиная с кадра переноса. */
const BOND_FORM = 0.3

/**
 * Тример S₃O₉ — отдельный объект СРАВНЕНИЯ (не продукт этой молекулы SO₃): проявляется целиком,
 * все 12 атомов одновременно, с полным радиусом — меняется только прозрачность. Подпись S₃O₉
 * появляется вместе с ним, текст шага говорит о нём, пока он в кадре.
 */
const TRIMER_GROW = { from: stepFrom(5) + 0.5, dur: 0.7 }
const TRIMER_APPEAR: ScalarTrack = [
  { t: TRIMER_GROW.from, v: 0 },
  { t: TRIMER_GROW.from + TRIMER_GROW.dur, v: 1, ease: 'smooth' },
]

const FADE = fadeTrack(SO3_FINISH)

/** Камера: общий план, наезд на столкновение, взгляд сверху на катализатор, крупно SO₃, облёт. */
export const SO3_CAMERA: ShotTrack = shotTrack([
  { t: 0, zoom: 0.86, pitch: 0.04, target: [0, 0.2, 0] },
  { t: stepTo(0), zoom: 0.88 },
  { t: T.collide, zoom: 1.0, target: [-0.35, 0.35, 0] },
  { t: stepTo(1) - 0.6, zoom: 0.9, target: [0, 0.2, 0] },
  { t: stepFrom(2) + 0.2, zoom: 0.9 },
  { t: T.a.transfer - 1.2, zoom: 0.96, pitch: 0.3, target: [0, -0.35, 0] },
  { t: stepTo(2), zoom: 0.94 },
  { t: stepFrom(3) + 1.6, zoom: 1.04, target: [0, -0.5, 0] },
  { t: stepTo(3) - 1.3, zoom: 1.0 },
  { t: stepFrom(4) + 0.1, zoom: 0.94, pitch: 0.28, target: [0, 0, 0] },
  { t: T.planar, zoom: 1.4, pitch: 0.1, target: [SA_C[0], SA_C[1], SA_C[2]] },
  { t: stepTo(4), zoom: 1.42 },
  { t: stepFrom(5) + 1.4, zoom: 0.9, pitch: 0.22, yaw: 0, target: [-0.35, 0, 0] },
  ...orbitTrack(stepFrom(5) + 1.6, stepTo(5), 0, 0.42, 0.22, 0.9),
])

const BASE_EMISSIVE = 0.08
const BASE_BLOOM = 0.3

// ─────────────────────────────────────────────────────────────────────────────
// Подписи в 3D — только формулы, заряды, числа и символы единиц (токены)
// ─────────────────────────────────────────────────────────────────────────────

export type So3LabelDef = SceneLabelDef & {
  anchor:
    | 'molA'
    | 'molB'
    | 'belowA'
    | 'o2'
    | 'o2Above'
    | 'bondA1'
    | 'angleA'
    | 'angleTop'
    | 'oxA'
    | 'oxB'
    | 'site'
    | 'top'
    | 'trimer'
    | 'ringBond'
    | 'termBond'
    | 'atom'
  atom?: string
  site?: 0 | 1
  hosts: readonly string[]
}

/** Число ядра без лишних знаков: 143.1, 120.75, 141.98, 162 (точка → запятая — localizeSceneLabels). */
const num = (v: number) => String(Math.round(v * 100) / 100)
const signed1 = (v: number) => (v < 0 ? `−${(-v).toFixed(1)}` : `+${v.toFixed(1)}`)
const oxText = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0')

const W_SITE: readonly [number, number] = [stepFrom(2) + 0.4, stepFrom(4) + 0.6]
const W_DH_FINAL: readonly [number, number] = [stepFrom(5) + 0.6, SO3_END]
const V2O5 = 'V₂O₅ ({s})'
const V2O4 = 'V₂O₄ ({s})'

export const SO3_LABELS: readonly So3LabelDef[] = [
  // Шаг 1–2: реагенты
  { id: 'molA', kind: 'species', anchor: 'molA', dy: 0.3, keys: [{ t: 0, text: 'SO₂ ({g})' }, { t: T.a.transfer, text: 'SO₃ ({g})' }], windows: [[0.2, SO3_END]], hosts: ['sA', 'oA1', 'oA2', 'c1'] },
  { id: 'molB', kind: 'species', anchor: 'molB', dy: 0.3, keys: [{ t: 0, text: 'SO₂ ({g})' }, { t: T.b.transfer, text: 'SO₃ ({g})' }], windows: [[0.2, T.planar - 0.2]], hosts: ['sB', 'oB1', 'oB2', 'c2'] },
  { id: 'o2', kind: 'species', anchor: 'o2', dy: -0.34, keys: [{ t: 0, text: 'O₂ ({g})' }], windows: [[0.2, T.brk]], hosts: ['o1', 'o2'] },
  { id: 'dOO', kind: 'measure', anchor: 'o2Above', dy: 0.3, keys: [{ t: 0, text: `${num(SO3_FACTS.o2Pm)} {pm}` }], windows: [[0.6, stepTo(1) - 0.2]], hosts: [] },
  { id: 'dSO2', kind: 'measure', anchor: 'bondA1', dy: 0, keys: [{ t: 0, text: `${num(SO3_FACTS.so2Pm)} {pm}` }], windows: [[0.6, stepTo(1) - 0.2]], hosts: [] },
  { id: 'angSO2', kind: 'measure', anchor: 'angleA', dy: -0.2, keys: [{ t: 0, text: `${num(SO3_FACTS.so2AngleDeg)}°` }], windows: [[0.8, stepTo(1) - 0.2]], hosts: [] },
  // Шаг 2: тепловой эффект уравнения (из ядра, не строкой) — и снова на финале
  { id: 'dH', kind: 'delta', anchor: 'top', dy: 0, keys: [{ t: 0, text: `ΔH = ${signed1(SO3_REACTION_DH_KJ)} {kJ}` }], windows: [[stepFrom(1) + 0.8, stepTo(1)], W_DH_FINAL], hosts: [] },
  // Шаги 3–4: места катализатора и степени окисления серы
  { id: 'siteA', kind: 'species', anchor: 'site', site: 0, dy: -0.26, keys: [{ t: 0, text: V2O5 }, { t: T.a.transfer, text: V2O4 }, { t: T.a.refill, text: V2O5 }], windows: [W_SITE], hosts: ['c1', 'o1'] },
  { id: 'siteB', kind: 'species', anchor: 'site', site: 1, dy: -0.26, keys: [{ t: 0, text: V2O5 }, { t: T.b.transfer, text: V2O4 }, { t: T.b.refill, text: V2O5 }], windows: [W_SITE], hosts: ['c2', 'o2'] },
  { id: 'oxA', kind: 'ox', anchor: 'oxA', dy: 0, keys: [{ t: 0, text: oxText(SO3_FACTS.oxSO2) }, { t: T.a.transfer, text: oxText(SO3_FACTS.oxSO3) }], windows: [[stepFrom(2) + 0.6, stepFrom(4) + 0.3]], hosts: [] },
  { id: 'oxB', kind: 'ox', anchor: 'oxB', dy: 0, keys: [{ t: 0, text: oxText(SO3_FACTS.oxSO2) }, { t: T.b.transfer, text: oxText(SO3_FACTS.oxSO3) }], windows: [[stepFrom(2) + 0.6, stepFrom(4) + 0.3]], hosts: [] },
  { id: 'oFree1', kind: 'species', anchor: 'atom', atom: 'o1', dy: 0.14, keys: [{ t: 0, text: 'O' }], windows: [[T.brk + 0.05, T.a.refill]], hosts: ['o1'] },
  { id: 'oFree2', kind: 'species', anchor: 'atom', atom: 'o2', dy: 0.14, keys: [{ t: 0, text: 'O' }], windows: [[T.brk + 0.05, T.b.refill]], hosts: ['o2'] },
  // Шаг 5: продукт — D₃h
  { id: 'dSO3', kind: 'measure', anchor: 'bondA1', dy: 0, keys: [{ t: 0, text: `${num(SO3_FACTS.so3Pm)} {pm}` }], windows: [[T.planar - 0.4, stepTo(4) + 0.2]], hosts: [] },
  { id: 'angSO3', kind: 'measure', anchor: 'angleTop', dy: 0.14, keys: [{ t: 0, text: `${num(SO3_FACTS.so3AngleDeg)}°` }], windows: [[T.planar - 0.2, stepTo(4) + 0.2]], hosts: [] },
  { id: 'mu', kind: 'token', anchor: 'belowA', dy: -0.3, keys: [{ t: 0, text: `μ = ${num(SO3_FACTS.so3DipoleD)}` }], windows: [[T.planar + 0.2, stepTo(4) + 0.2]], hosts: [] },
  // Шаг 6: тример S₃O₉
  { id: 'trimer', kind: 'species', anchor: 'trimer', dy: 0.34, keys: [{ t: 0, text: 'S₃O₉' }], windows: [[TRIMER_GROW.from + 0.5, SO3_END]], hosts: TRIMER_IDS },
  { id: 'ring', kind: 'measure', anchor: 'ringBond', dy: 0, keys: [{ t: 0, text: `${num(SO3_FACTS.s3o9RingPm)} {pm}` }], windows: [[TRIMER_GROW.from + 1.3, SO3_END]], hosts: [] },
  { id: 'term', kind: 'measure', anchor: 'termBond', dy: 0, keys: [{ t: 0, text: `${num(SO3_FACTS.s3o9TermPm)} {pm}` }], windows: [[TRIMER_GROW.from + 1.5, SO3_END]], hosts: [] },
]

export type So3LabelState = SceneLabelState

/** Связь кольца и концевая связь для подписей: ближайшие к зрителю (наибольший z). */
const RING_LABEL_BOND = (() => {
  let best = 0
  let bz = -Infinity
  for (let i = 0; i < 6; i++) {
    const z = (TRIMER.ring[i]![2] + TRIMER.ring[(i + 1) % 6]![2]) / 2
    if (z > bz) {
      bz = z
      best = i
    }
  }
  return best
})()
const TERM_LABEL = (() => {
  let best = 0
  let by = -Infinity
  TRIMER.term.forEach((p, k) => {
    if (p[1] > by) {
      by = p[1]
      best = k
    }
  })
  return best
})()
const TRIMER_TOP = Math.max(...TRIMER.ring.map((p) => p[1]), ...TRIMER.term.map((p) => p[1]))

// ─────────────────────────────────────────────────────────────────────────────
// Кадр
// ─────────────────────────────────────────────────────────────────────────────

export type So3Frame = {
  t: number
  pos: THREE.Vector3[]
  radius: Float32Array
  opacity: Float32Array
  emissive: Float32Array
  material: SubstanceKind[]
  /** связи по слотам SO3_BONDS */
  bond: { opacity: Float32Array; order: Float32Array; stress: Float32Array; thinning: Float32Array }
  /** формальная степень окисления серы a / b */
  ox: [number, number]
  /** атомов O на месте катализатора (1 — V₂O₅, 0 — V₂O₄) */
  sites: [number, number]
  /** SO₂ → SO₃ (0…1) у молекул a / b */
  morph: [number, number]
  /** амплитуды эффектов (тест: в финале 0): сетка поверхности катализатора */
  fx: { surface: number }
  labels: So3LabelState[]
  camera: SceneCamera
  fade: number
}

export function createSo3Frame(): So3Frame {
  const n = SO3_ATOMS.length
  const nb = SO3_BONDS.length
  return {
    t: 0,
    pos: SO3_ATOMS.map(() => new THREE.Vector3()),
    radius: new Float32Array(n),
    opacity: new Float32Array(n),
    emissive: new Float32Array(n).fill(BASE_EMISSIVE),
    material: SO3_ATOMS.map(() => 'default' as SubstanceKind),
    bond: { opacity: new Float32Array(nb), order: new Float32Array(nb), stress: new Float32Array(nb), thinning: new Float32Array(nb) },
    ox: [0, 0],
    sites: [1, 1],
    morph: [0, 0],
    fx: { surface: 0 },
    labels: createLabelStates(SO3_LABELS),
    camera: createSceneCamera(),
    fade: 0,
  }
}

const _e = new THREE.Euler()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _tri = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
const _d = new THREE.Vector3()

/** Лиганд под углом φ (от локальной +Z в плоскости XZ) на расстоянии len от серы — поворот _q. */
function writeLigand(out: THREE.Vector3, s: THREE.Vector3, phiDeg: number, len: number): void {
  const p = (phiDeg * Math.PI) / 180
  out.set(Math.sin(p) * len, 0, Math.cos(p) * len).applyQuaternion(_q).add(s)
}

/**
 * Молекула SO₂ → SO₃: сера s, два «своих» O под углами 180 ∓ ∠/2, где ∠ = A2 → A3 по morph,
 * длина L2 → L3. После переноса атом O катализатора — третий лиганд (φ = 0, длина L3).
 * При morph = 1 геометрию пишет core/vsepr.writeTrigonalPlanar (D₃h по данным ядра).
 */
function writeMolecule(f: So3Frame, iS: number, iO1: number, iO2: number, iC: number, m: number, yaw: number, attached: boolean, site: V3): void {
  const s = f.pos[iS]!
  _e.set(MOL_PITCH, yaw, 0, 'YXZ')
  _q.setFromEuler(_e)
  if (attached && m >= 1) {
    writeTrigonalPlanar(_tri, s, L3, yaw, MOL_PITCH, 0)
    f.pos[iC]!.copy(_tri[0]!)
    f.pos[iO1]!.copy(_tri[1]!)
    f.pos[iO2]!.copy(_tri[2]!)
    return
  }
  const ang = A2 + (A3 - A2) * m
  const len = L2 + (L3 - L2) * m
  writeLigand(f.pos[iO1]!, s, 180 - ang / 2, len)
  writeLigand(f.pos[iO2]!, s, 180 + ang / 2, len)
  if (attached) writeLigand(f.pos[iC]!, s, 0, L3)
  else f.pos[iC]!.set(site[0], site[1], site[2])
}

/** Кадр, для которого сейчас считаются подписи (anchorLabel — модульная функция, без замыканий). */
let _cur: So3Frame | null = null

function groupTop(f: So3Frame, a: number, b: number, c: number, d: number, withD: boolean): number {
  let y = Math.max(f.pos[a]!.y, f.pos[b]!.y, f.pos[c]!.y)
  if (withD) y = Math.max(y, f.pos[d]!.y)
  return y
}

function anchorLabel(def: SceneLabelDef, st: SceneLabelState): void {
  const f = _cur!
  const d = def as So3LabelDef
  const p = f.pos
  switch (d.anchor) {
    case 'molA':
      st.pos.set(p[I.sA]!.x, groupTop(f, I.sA, I.oA1, I.oA2, I.c1, f.t >= T.a.transfer) + R.o + d.dy, p[I.sA]!.z)
      return
    case 'molB':
      st.pos.set(p[I.sB]!.x, groupTop(f, I.sB, I.oB1, I.oB2, I.c2, f.t >= T.b.transfer) + R.o + d.dy, p[I.sB]!.z)
      return
    case 'belowA': {
      const y = Math.min(p[I.sA]!.y, p[I.oA1]!.y, p[I.oA2]!.y, p[I.c1]!.y)
      st.pos.set(p[I.sA]!.x, y - R.o + d.dy, p[I.sA]!.z)
      return
    }
    case 'o2':
    case 'o2Above':
      st.pos.copy(p[I.o1]!).lerp(p[I.o2]!, 0.5)
      st.pos.y += d.dy > 0 ? R.o + d.dy : -(R.o - d.dy)
      return
    case 'bondA1': {
      // Середина связи S–O₁ молекулы a, сдвинутая наружу перпендикулярно связи (в плоскости экрана).
      const s = p[I.sA]!
      const o = p[I.oA1]!
      _d.copy(o).sub(s).normalize()
      st.pos.copy(s).lerp(o, 0.5)
      st.pos.x += _d.y * 0.3
      st.pos.y -= _d.x * 0.3
      return
    }
    case 'angleA':
      st.pos.copy(p[I.sA]!)
      st.pos.y += -(R.s - d.dy)
      return
    case 'angleTop':
      st.pos.copy(p[I.oA1]!).lerp(p[I.oA2]!, 0.5)
      st.pos.y += R.o + d.dy
      return
    case 'oxA':
      st.pos.copy(p[I.sA]!)
      st.pos.x -= R.s + 0.24
      return
    case 'oxB':
      st.pos.copy(p[I.sB]!)
      st.pos.x += R.s + 0.24
      return
    case 'site': {
      const s = SITE[d.site ?? 0]
      st.pos.set(s[0], SO3_SURFACE_Y + d.dy, s[2] + SO3_SURFACE.halfZ)
      return
    }
    case 'top':
      st.pos.set(0, 1.3 + d.dy, 0)
      return
    case 'trimer':
      st.pos.set(TRIMER_CENTER[0], TRIMER_TOP + R.o + d.dy, TRIMER_CENTER[2])
      return
    case 'ringBond': {
      const a = TRIMER.ring[RING_LABEL_BOND]!
      const b = TRIMER.ring[(RING_LABEL_BOND + 1) % 6]!
      const mx = (a[0] + b[0]) / 2
      const my = (a[1] + b[1]) / 2
      const mz = (a[2] + b[2]) / 2
      _d.set(mx - TRIMER_CENTER[0], 0, mz - TRIMER_CENTER[2]).normalize()
      st.pos.set(mx + _d.x * 0.3, my - 0.12, mz + _d.z * 0.3)
      return
    }
    case 'termBond': {
      const tpos = TRIMER.term[TERM_LABEL]!
      const spos = TRIMER.ring[TRIMER.termOf[TERM_LABEL]!]!
      _d.set(tpos[0] - spos[0], tpos[1] - spos[1], tpos[2] - spos[2]).normalize()
      st.pos.set(tpos[0] + _d.x * (R.o + 0.2), tpos[1] + _d.y * (R.o + 0.2), tpos[2] + _d.z * (R.o + 0.2))
      return
    }
    case 'atom': {
      const i = IDX(d.atom!)
      st.pos.copy(p[i]!)
      st.pos.y += R.o + d.dy
      return
    }
  }
}

/** Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций). */
export function sampleSo3Frame(t: number, frame: So3Frame): So3Frame {
  frame.t = t
  const { pos, radius, opacity, material, emissive } = frame

  for (let i = 0; i < SO3_ATOMS.length; i++) emissive[i] = BASE_EMISSIVE

  // ——— Молекулы a и b: сера по дорожке, лиганды — по геометрии ядра ———
  const attA = t >= T.a.transfer
  const attB = t >= T.b.transfer
  const mA = attA ? sampleScalar(MORPH_A, t) : 0
  const mB = attB ? sampleScalar(MORPH_B, t) : 0
  frame.morph[0] = mA
  frame.morph[1] = mB
  sampleVec3(SO3_S_TRACKS.a, t, _s)
  pos[I.sA]!.copy(_s)
  writeMolecule(frame, I.sA, I.oA1, I.oA2, I.c1, mA, sampleScalar(SO3_YAW_A, t), attA, SITE[0])
  sampleVec3(SO3_S_TRACKS.b, t, _s)
  pos[I.sB]!.copy(_s)
  writeMolecule(frame, I.sB, I.oB1, I.oB2, I.c2, mB, 0, attB, SITE[1])

  // ——— O₂ ———
  sampleVec3(SO3_O2_TRACKS.o1, t, pos[I.o1]!)
  sampleVec3(SO3_O2_TRACKS.o2, t, pos[I.o2]!)

  // ——— Тример: неподвижный объект сравнения, проявляется целиком ———
  for (let k = 0; k < TRIMER_ATOMS.length; k++) {
    const i = TRIMER_BASE + k
    const p = SO3_TRIMER_POS.get(TRIMER_ATOMS[k]!.id)!
    pos[i]!.set(p[0], p[1], p[2])
  }

  // ——— Радиусы, прозрачность, материал ———
  const appear = sampleScalar(APPEAR, t)
  const bFade = sampleScalar(B_FADE, t)
  const catFade = sampleScalar(CAT_O_FADE, t)
  const catAppear = sampleScalar(CAT_APPEAR, t)

  radius[I.sA] = R.s
  radius[I.sB] = R.s
  radius[I.oA1] = R.o
  radius[I.oA2] = R.o
  radius[I.oB1] = R.o
  radius[I.oB2] = R.o
  radius[I.o1] = R.o
  radius[I.o2] = R.o
  opacity[I.sA] = appear
  opacity[I.oA1] = appear
  opacity[I.oA2] = appear
  opacity[I.sB] = appear * bFade
  opacity[I.oB1] = appear * bFade
  opacity[I.oB2] = appear * bFade
  opacity[I.o1] = appear * catFade
  opacity[I.o2] = appear * catFade
  // Атомы O катализатора: полный ковалентный радиус (Кордеро — связи V–O в V₂O₅ во многом
  // ковалентны; тот же радиус и в SO₃ — названо в note шага catalyst), проявляются с поверхностью.
  radius[I.c1] = R.o
  radius[I.c2] = R.o
  opacity[I.c1] = catAppear
  opacity[I.c2] = catAppear * bFade

  const molA: SubstanceKind = attA ? 'covalent' : 'gas'
  const molB: SubstanceKind = attB ? 'covalent' : 'gas'
  material[I.sA] = molA
  material[I.oA1] = molA
  material[I.oA2] = molA
  material[I.sB] = molB
  material[I.oB1] = molB
  material[I.oB2] = molB
  material[I.c1] = attA ? 'covalent' : 'polar'
  material[I.c2] = attB ? 'covalent' : 'polar'
  material[I.o1] = t >= T.a.refill ? 'polar' : 'gas'
  material[I.o2] = t >= T.b.refill ? 'polar' : 'gas'

  const trimerShow = sampleScalar(TRIMER_APPEAR, t)
  for (let k = 0; k < TRIMER_ATOMS.length; k++) {
    const i = TRIMER_BASE + k
    radius[i] = TRIMER_ATOMS[k]!.el === 'S' ? R.s : R.o
    opacity[i] = trimerShow
    material[i] = 'covalent'
  }

  // ——— Ступени кадра переноса ———
  frame.ox[0] = sampleScalar(SO3_SNAP.oxA, t)
  frame.ox[1] = sampleScalar(SO3_SNAP.oxB, t)
  frame.sites[0] = sampleScalar(SO3_SNAP.siteA, t)
  frame.sites[1] = sampleScalar(SO3_SNAP.siteB, t)

  // ——— Связи ———
  const b = frame.bond
  for (let k = 0; k < SO3_BONDS.length; k++) {
    const [ia, ib] = BOND_IDX[k]!
    const vis = Math.min(opacity[ia]!, opacity[ib]!)
    const def = SO3_BONDS[k]!
    b.stress[k] = 0
    b.thinning[k] = 0
    switch (def.kind) {
      case 'soA':
      case 'soB': {
        const m = def.kind === 'soA' ? mA : mB
        const tr = def.kind === 'soA' ? T.a.transfer : T.b.transfer
        const third = k === SLOT_CA || k === SLOT_CB
        b.order[k] = third ? ORDER_SO3 : ORDER_SO2 + (ORDER_SO3 - ORDER_SO2) * m
        b.opacity[k] = third ? (t < tr ? 0 : smoothstep(tr, tr + BOND_FORM, t)) * vis : vis
        break
      }
      case 'oo':
        b.order[k] = 2
        b.opacity[k] = sampleScalar(OO_OPACITY, t) * vis
        b.stress[k] = sampleScalar(OO_STRESS, t)
        b.thinning[k] = sampleScalar(OO_THIN, t)
        break
      case 'ring':
        b.order[k] = 1
        b.opacity[k] = vis
        break
      case 'term':
        b.order[k] = 2
        b.opacity[k] = vis
        break
    }
  }

  frame.fx.surface = sampleScalar(SO3_SURFACE_AMOUNT, t)
  frame.fade = sampleScalar(FADE, t)

  // ——— Подписи ———
  _cur = frame
  sampleLabels(SO3_LABELS, frame.labels, t, anchorLabel, frame.fade)
  _cur = null

  // ——— Камера ———
  const cam = frame.camera
  sampleShot(SO3_CAMERA, t, cam)
  cam.shake = 0
  cam.bloom = BASE_BLOOM
  cam.vignette = Math.max(0.3, frame.fade)
  return frame
}

/** Слот связи O=O и третьих связей S–O — для сцены и теста. */
export const SO3_BOND_SLOTS = { ca: SLOT_CA, cb: SLOT_CB, oo: SLOT_OO } as const

/** Проверка раскадровки — в dev и в тесте сцены. */
export function validateSo3Storyboard(): void {
  validateTracks({
    'pos.sA': SO3_S_TRACKS.a,
    'pos.sB': SO3_S_TRACKS.b,
    'pos.o1': SO3_O2_TRACKS.o1,
    'pos.o2': SO3_O2_TRACKS.o2,
    'cam.offset': SO3_CAMERA.offset,
  })
  validateTracks({
    ...SO3_SNAP,
    MORPH_A,
    MORPH_B,
    SO3_YAW_A,
    APPEAR,
    CAT_APPEAR,
    TRIMER_APPEAR,
    SO3_SURFACE_AMOUNT,
    CAT_O_FADE,
    B_FADE,
    OO_STRESS,
    OO_THIN,
    OO_OPACITY,
    FADE,
    camZoom: SO3_CAMERA.zoom,
    camYaw: SO3_CAMERA.yaw,
    camPitch: SO3_CAMERA.pitch,
  })

  // Состав: 2 SO₂ + O₂ + два атома O катализатора; тример S₃O₉ — по счёту связей ядра.
  const s3o9 = REAGENT_GEOMETRY.s3o9.bondCounts
  const ring = SO3_BONDS.filter((x) => x.kind === 'ring').length
  const term = SO3_BONDS.filter((x) => x.kind === 'term').length
  if (ring !== s3o9['S–O(кольцо)'] || term !== s3o9['S=O(конц.)']) throw new Error(`so3: у тримера ${ring} + ${term} связей, в ядре ${JSON.stringify(s3o9)}`)
  const tS = TRIMER_ATOMS.filter((a) => a.el === 'S').length
  const tO = TRIMER_ATOMS.filter((a) => a.el === 'O').length
  if (tS !== 3 || tO !== 9) throw new Error(`so3: тример S${tS}O${tO}, а не S₃O₉`)

  // Сера в кадр переноса стоит ровно на S=O(SO₃) над местом (стыкуется без рывка).
  for (const [track, k, tr] of [[SO3_S_TRACKS.a, 0, T.a.transfer], [SO3_S_TRACKS.b, 1, T.b.transfer]] as const) {
    const s = sampleVec3(track, tr, new THREE.Vector3())
    const d = s.distanceTo(new THREE.Vector3(...SITE[k]))
    if (Math.abs(d - L3) > 1e-9) throw new Error(`so3: сера над местом ${k} на ${d}, а не на S=O(SO₃) ${L3}`)
  }
  // Степени окисления из электронейтральности.
  if (SO3_FACTS.oxSO3 - SO3_FACTS.oxSO2 !== 2) throw new Error('so3: сера окисляется на 2 единицы (S⁺⁴ → S⁺⁶)')
  // Никаких событий лаборатории до конца последнего шага.
  if (SO3_END <= stepTo(LAST_STEP)) throw new Error('so3: хвост сцены пустой')
}
