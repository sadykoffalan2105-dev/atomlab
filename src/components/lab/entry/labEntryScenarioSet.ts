/**
 * Набор сценариев экрана входа — «здесь делают вещества», а не одна гифка.
 *
 * Пять секунд одной и той же воды читаются как заставка; четыре разных синтеза
 * подряд читаются как лаборатория. Поэтому петля героя переключается по кругу:
 *   вода          2 H₂ + O₂ → 2 H₂O
 *   аммиак        N₂ + 3 H₂ → 2 NH₃
 *   углекислый газ C + O₂ → CO₂
 *   поваренная соль 2 Na + Cl₂ → 2 NaCl
 *
 * Все четыре описываются ОДНИМ скелетом, поэтому сэмплер в `labEntryScenario.ts`
 * остаётся один и не ветвится по названию вещества:
 *   • 1 или 2 молекулы продукта, в каждой центр + 1..3 лиганда;
 *   • реагенты — это те же атомы, собранные в «единицы полёта»: двухатомная
 *     молекула (O₂, N₂, Cl₂, H₂) или одиночный атом (C, Na).
 * Перестройка связей — это переезд атомов из контактных поз реагентов в позы
 * продукта; какой атом куда едет, задаётся раскладкой слотов, а не кодом сцены.
 *
 * Химия буквальная: ни одной длины и ни одного угла константой — всё приходит
 * из `src/chemistry/data` и переводится пм → Å → мировые единицы. Радиусы
 * ван-дер-ваальсовы (ball-and-stick), а у соли РАЗНЫЕ на входе и на выходе:
 * нейтральный Na (227 пм) сжимается в Na⁺ (102 пм), а Cl (175 пм) разбухает
 * в Cl⁻ (181 пм) — перенос электрона видно глазом, без единой подписи.
 *
 * Модуль не импортирует ни three, ни React: только числа, читается в Node
 * (`scripts/test-lab-entry-scenario.mts`).
 */
import { ATOMIC_DATA, bondAngleDeg, bondLengthPm, ionicRadiusPm, type ElementSymbol } from '../../../chemistry/data'
import { pmToAngstrom, SCENE_PER_ANGSTROM } from '../../../lab/cinema/core/atoms'
import type { MessageKey } from '../../../i18n/messagesRu'

const DEG = Math.PI / 180

/** пм → мировые единицы сцены. */
export function entryScene(pm: number): number {
  return pmToAngstrom(pm) * SCENE_PER_ANGSTROM
}

/**
 * Доля ван-дер-ваальсова радиуса (ball-and-stick): пропорции элементов
 * настоящие, но сферы не слипаются в сплошной ком.
 */
const VDW_SHARE = 0.27
/**
 * Доля ионного радиуса. Больше вдв-доли не случайно: ионный радиус — это уже
 * «сжатый» размер, и при одинаковой доле Na⁺ оказался бы мельче водорода.
 */
const ION_SHARE = 0.42

function rVdw(s: ElementSymbol): number {
  return entryScene(ATOMIC_DATA[s].vdwRadiusPm) * VDW_SHARE
}

function rIon(s: ElementSymbol, charge: number): number {
  const pm = ionicRadiusPm(s, charge)
  return pm == null ? rVdw(s) : entryScene(pm) * ION_SHARE
}

// --- векторы (всё считается один раз на загрузке модуля) ---------------------

export type Vec = readonly [number, number, number]

function vlen(a: Vec): number {
  return Math.hypot(a[0], a[1], a[2])
}

function vunit(x: number, y: number, z: number): Vec {
  const l = Math.hypot(x, y, z) || 1
  return [x / l, y / l, z / l]
}

function vcross(a: Vec, b: Vec): Vec {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

/** Составляющая s, ортогональная b, нормированная. */
function ortho(s: Vec, b: Vec): Vec {
  const d = s[0] * b[0] + s[1] * b[1] + s[2] * b[2]
  return vunit(s[0] - b[0] * d, s[1] - b[1] * d, s[2] - b[2] * d)
}

/** Ориентация молекулы продукта: b — ось связей, s и u — её поперечник. */
export type EntryFrame = { readonly b: Vec; readonly s: Vec; readonly u: Vec }

function frameOf(b: Vec, sHint: Vec): EntryFrame {
  const s = ortho(sHint, b)
  return { b, s, u: vcross(b, s) }
}

/**
 * Две ориентации продукта, зеркальные друг другу: молекулы смотрят в разные
 * стороны и не читаются как копипаста. Для одиночного продукта берётся первая.
 */
export const ENTRY_FRAMES: readonly EntryFrame[] = [
  frameOf(vunit(-0.3, 0.93, 0.21), vunit(0.93, 0.34, 0.12)),
  frameOf(vunit(0.3, -0.93, -0.21), vunit(0.93, -0.34, -0.12)),
]

/**
 * Направления связей продукта в локальном базисе рамки, в зависимости от
 * раскрытия. Пишет ligands×3 единичных векторов в `out`, ничего не аллоцируя.
 *
 * 1 лиганд  — вдоль оси;
 * 2 лиганда — угол в плоскости b×s (у воды — угол из ядра, у CO₂ 180° = прямая);
 * 3 лиганда — тригональная пирамида: связи под полярным углом φ к оси,
 *             cos θ = cos²φ − ½ sin²φ (θ — валентный угол H–N–H).
 */
export function entryBondDirs(out: Float32Array, frame: EntryFrame, ligands: number, angleDeg: number): void {
  const { b, s, u } = frame
  if (ligands === 1) {
    out[0] = b[0]
    out[1] = b[1]
    out[2] = b[2]
    return
  }
  if (ligands === 2) {
    const half = angleDeg * 0.5 * DEG
    const kb = Math.cos(half)
    const ks = Math.sin(half)
    out[0] = b[0] * kb + s[0] * ks
    out[1] = b[1] * kb + s[1] * ks
    out[2] = b[2] * kb + s[2] * ks
    out[3] = b[0] * kb - s[0] * ks
    out[4] = b[1] * kb - s[1] * ks
    out[5] = b[2] * kb - s[2] * ks
    return
  }
  const theta = angleDeg * DEG
  const cosPhi = Math.sqrt(Math.max(0, (Math.cos(theta) + 0.5) / 1.5))
  const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi))
  for (let k = 0; k < 3; k++) {
    const az = (k / 3) * Math.PI * 2 + 0.4
    const ca = Math.cos(az) * sinPhi
    const sa = Math.sin(az) * sinPhi
    const o = k * 3
    out[o] = b[0] * cosPhi + s[0] * ca + u[0] * sa
    out[o + 1] = b[1] * cosPhi + s[1] * ca + u[1] * sa
    out[o + 2] = b[2] * cosPhi + s[2] * ca + u[2] * sa
  }
}

// --- описание сценария -------------------------------------------------------

/** Поза «единицы полёта»: центр молекулы и её ось (для одиночного атома ось не важна). */
export type EntryPose = { readonly c: Vec; readonly axis: Vec }

/** Единица полёта реагента: пара слотов атомов (b = −1 — одиночный атом). */
export type EntryUnit = { readonly a: number; readonly b: number; readonly d: number }

export type EntryScenarioSpec = {
  readonly id: string
  /** id вещества для каталога и реактора */
  readonly productId: string
  /** уравнение: нотация, мимо i18n */
  readonly equation: string
  /** ключ названия продукта («Вода», «Аммиак», …) */
  readonly nameKey: MessageKey
  /** формула продукта для подписи */
  readonly formula: string
  readonly products: number
  readonly ligands: number
  readonly atomCount: number
  readonly bondCount: number
  readonly centerCpk: number
  readonly ligandCpk: number
  /** радиус центра: [реагент, продукт] — у соли они разные */
  readonly centerR: readonly [number, number]
  readonly ligandR: readonly [number, number]
  /** длина связи центр–лиганд, мировые единицы */
  readonly dCL: number
  readonly angleStartDeg: number
  readonly angleEndDeg: number
  readonly productOrder: number
  readonly productPolarity: number
  readonly chargeCenter: number
  readonly chargeLigand: number
  /** связь между центрами в реагенте (O=O, N≡N, Cl–Cl); null — центр одиночный */
  readonly centerBond: { readonly order: number; readonly d: number } | null
  /** пары лигандов, связанные в реагенте (H₂, O₂); индексы среди лигандов */
  readonly ligandPairs: readonly (readonly [number, number])[]
  readonly ligandBond: { readonly order: number; readonly d: number } | null
  /** центры заготовок сразу после вспышки */
  readonly protoC: readonly Vec[]
  /** центры разошедшихся продуктов в фазе показа */
  readonly spreadC: readonly Vec[]
  readonly units: readonly EntryUnit[]
  readonly far: readonly EntryPose[]
  readonly mid: readonly EntryPose[]
  readonly hit: readonly EntryPose[]
  /** габариты вещества в кадре: по ним сцена подбирает масштаб героя */
  readonly fit: EntryScenarioFit
}

/**
 * Габариты сценария в плоскости кадра, разложенные на сжимаемую и жёсткую часть.
 *
 * Сцена обязана уметь ответить на вопрос «влезет ли вещество в этот экран», и
 * ответ у каждого вещества свой: у воды связь O–H — 0.96 Å, у поваренной соли
 * Na–Cl — 2.36 Å, то есть соль вдвое шире воды при том же положении центров.
 * Один масштаб на все четыре вещества означал бы либо обрезанную соль, либо
 * мелкую воду — поэтому масштаб подбирается на каждую петлю отдельно.
 *
 * Разложение на две части нужно потому, что `centerSpread()` сжимает ТОЛЬКО
 * положения центров молекул: межатомные расстояния — это химия, они не
 * сжимаются никогда. Отсюда:
 *   полуразмер по X = centerX · ws + armX
 * где ws — сжатие кадра, а armX — вылет самого дальнего атома от центра своей
 * молекулы ПО ОСИ X, уже с его радиусом. Оси считаются раздельно: кадр
 * не квадратный, а молекулы продукта разложены вдоль X, и общий радиус
 * (гипотенуза) завысил бы высоту почти вдвое.
 */
export type EntryScenarioFit = {
  /** максимальное |x| центра молекулы продукта */
  readonly productCX: number
  readonly productCY: number
  /** максимальное |x| центра единицы полёта реагента (позы mid и hit) */
  readonly reagentCX: number
  readonly reagentCY: number
  /** вылет атома от центра своей молекулы по X, с радиусом атома */
  readonly armX: number
  readonly armY: number
}

type ScenarioDraft = {
  id: string
  productId: string
  equation: string
  nameKey: MessageKey
  formula: string
  center: ElementSymbol
  ligand: ElementSymbol
  centerR?: readonly [number, number]
  ligandR?: readonly [number, number]
  products: number
  ligands: number
  bondKey: Parameters<typeof bondLengthPm>[0]
  angleStartDeg: number
  angleEndDeg: number
  productOrder: number
  productPolarity: number
  chargeCenter: number
  chargeLigand: number
  centerBond: { order: number; key: Parameters<typeof bondLengthPm>[0] } | null
  ligandPairs: readonly (readonly [number, number])[]
  ligandBond: { order: number; key: Parameters<typeof bondLengthPm>[0] } | null
  protoC: readonly Vec[]
  spreadC: readonly Vec[]
  /** ручная раскадровка полёта (вода): far/mid/hit по единицам */
  poses?: { far: readonly EntryPose[]; mid: readonly EntryPose[]; hit: readonly EntryPose[] }
}

/** Радиус, с которого реагенты влетают, и радиус середины подлёта. */
const FAR_R = 2.05
const MID_R = 0.82

const _dirs = new Float32Array(9)

/**
 * Достраивает сценарий: раскладку слотов, число связей и, если её не задали
 * руками, траекторию подлёта реагентов.
 *
 * Контактные позы (hit) НЕ выдумываются: единица полёта ставится ровно туда,
 * откуда её атомам ближе всего доехать до своих мест в продукте — в середину
 * между будущими положениями, осью вдоль них. Поэтому перестройка связей под
 * вспышкой выглядит переездом на полшага, а не телепортацией.
 */
function defineScenario(d: ScenarioDraft): EntryScenarioSpec {
  const nLig = d.products * d.ligands
  const atomCount = d.products + nLig
  const dCL = entryScene(bondLengthPm(d.bondKey))
  const centerBond = d.centerBond ? { order: d.centerBond.order, d: entryScene(bondLengthPm(d.centerBond.key)) } : null
  const ligandBond = d.ligandBond ? { order: d.ligandBond.order, d: entryScene(bondLengthPm(d.ligandBond.key)) } : null

  // Единицы полёта: центры (одной молекулой или одиночным атомом), затем пары
  // лигандов, затем свободные лиганды.
  const units: EntryUnit[] = []
  if (d.products === 2 && centerBond) units.push({ a: 0, b: 1, d: centerBond.d })
  else for (let p = 0; p < d.products; p++) units.push({ a: p, b: -1, d: 0 })
  const paired = new Set<number>()
  for (const pair of d.ligandPairs) {
    paired.add(pair[0])
    paired.add(pair[1])
    units.push({ a: d.products + pair[0], b: d.products + pair[1], d: ligandBond ? ligandBond.d : 0 })
  }
  for (let l = 0; l < nLig; l++) {
    if (!paired.has(l)) units.push({ a: d.products + l, b: -1, d: 0 })
  }

  const bondCount = (centerBond ? 1 : 0) + d.ligandPairs.length + nLig

  let far = d.poses?.far
  let mid = d.poses?.mid
  let hit = d.poses?.hit
  if (!far || !mid || !hit) {
    // Положения атомов в готовом продукте (в позах заготовок): откуда и берутся
    // контактные позы единиц полёта.
    const dest: Vec[] = []
    for (let p = 0; p < d.products; p++) dest.push(d.protoC[p] ?? [0, 0, 0])
    for (let p = 0; p < d.products; p++) {
      const c = d.protoC[p] ?? [0, 0, 0]
      entryBondDirs(_dirs, ENTRY_FRAMES[p % ENTRY_FRAMES.length]!, d.ligands, d.angleEndDeg)
      for (let k = 0; k < d.ligands; k++) {
        const o = k * 3
        dest.push([c[0] + _dirs[o]! * dCL, c[1] + _dirs[o + 1]! * dCL, c[2] + _dirs[o + 2]! * dCL])
      }
    }
    const h: EntryPose[] = []
    const m: EntryPose[] = []
    const f: EntryPose[] = []
    units.forEach((unit, i) => {
      const pa = dest[unit.a] ?? [0, 0, 0]
      const pb = unit.b >= 0 ? (dest[unit.b] ?? pa) : pa
      const c: Vec = [(pa[0] + pb[0]) * 0.5, (pa[1] + pb[1]) * 0.5, (pa[2] + pb[2]) * 0.5]
      const axis =
        unit.b >= 0 && vlen([pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]]) > 1e-4
          ? vunit(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2])
          : ENTRY_FRAMES[i % ENTRY_FRAMES.length]!.s
      h.push({ c, axis })
      // Направление подлёта: наружу от центра кадра. Единица, стоящая в самом
      // центре (одиночный C, пара центров), улетать «от себя» не может —
      // ей назначается своё направление по золотому углу.
      const len = vlen(c)
      const golden = i * Math.PI * (3 - Math.sqrt(5))
      const dir: Vec =
        len > 0.06
          ? [c[0] / len, c[1] / len, c[2] / len]
          : vunit(Math.cos(golden) * 0.92, Math.sin(golden) * 0.86, Math.sin(golden * 1.7) * 0.34)
      // Ось на подлёте развёрнута: молекула прилетает кувыркаясь, а не боком.
      const perp = vunit(...(vcross(axis, [0.17, 0.83, 0.53]) as [number, number, number]))
      const turn = (k: number): Vec => vunit(axis[0] + perp[0] * k, axis[1] + perp[1] * k, axis[2] + perp[2] * k)
      m.push({ c: [dir[0] * MID_R, dir[1] * MID_R, dir[2] * MID_R], axis: turn(0.5) })
      f.push({
        c: [dir[0] * FAR_R + perp[0] * 0.22, dir[1] * FAR_R + perp[1] * 0.22, dir[2] * FAR_R + perp[2] * 0.26],
        axis: turn(1.15),
      })
    })
    hit = h
    mid = m
    far = f
  }

  const centerR = d.centerR ?? ([rVdw(d.center), rVdw(d.center)] as const)
  const ligandR = d.ligandR ?? ([rVdw(d.ligand), rVdw(d.ligand)] as const)
  const rCenter = Math.max(centerR[0], centerR[1])
  const rLigand = Math.max(ligandR[0], ligandR[1])

  // --- габариты в кадре: по НАСТОЯЩИМ положениям атомов, не по радиусу сферы ---
  let armX = rCenter
  let armY = rCenter
  // Раскрытие продукта проходит от начального угла к конечному, поэтому вылет
  // лиганда берётся по обоим краям: у воды 180° шире, чем итоговый угол воды.
  for (const ang of [d.angleStartDeg, d.angleEndDeg]) {
    for (let p = 0; p < d.products; p++) {
      entryBondDirs(_dirs, ENTRY_FRAMES[p % ENTRY_FRAMES.length]!, d.ligands, ang)
      for (let k = 0; k < d.ligands; k++) {
        const o = k * 3
        armX = Math.max(armX, Math.abs(_dirs[o]!) * dCL + rLigand)
        armY = Math.max(armY, Math.abs(_dirs[o + 1]!) * dCL + rLigand)
      }
    }
  }
  // Реагентная пара вылетает вдоль своей оси на половину длины связи.
  for (let i = 0; i < units.length; i++) {
    const u = units[i]!
    if (u.b < 0) continue
    const h = u.d * 0.5
    const r = Math.max(rCenter, rLigand)
    for (const pose of [mid[i], hit[i]]) {
      if (!pose) continue
      armX = Math.max(armX, Math.abs(pose.axis[0]) * h + r)
      armY = Math.max(armY, Math.abs(pose.axis[1]) * h + r)
    }
  }

  let productCX = 0
  let productCY = 0
  for (const set of [d.protoC, d.spreadC]) {
    for (const c of set) {
      productCX = Math.max(productCX, Math.abs(c[0]))
      productCY = Math.max(productCY, Math.abs(c[1]))
    }
  }
  // Поза far — это влёт из-за края кадра, она в габариты не входит намеренно:
  // реагенты там ещё проявляются и обрезка края читается как «прилетели извне».
  let reagentCX = 0
  let reagentCY = 0
  for (const set of [mid, hit]) {
    for (const pose of set) {
      reagentCX = Math.max(reagentCX, Math.abs(pose.c[0]))
      reagentCY = Math.max(reagentCY, Math.abs(pose.c[1]))
    }
  }

  return {
    id: d.id,
    productId: d.productId,
    equation: d.equation,
    nameKey: d.nameKey,
    formula: d.formula,
    products: d.products,
    ligands: d.ligands,
    atomCount,
    bondCount,
    centerCpk: ATOMIC_DATA[d.center].cpk,
    ligandCpk: ATOMIC_DATA[d.ligand].cpk,
    centerR,
    ligandR,
    dCL,
    angleStartDeg: d.angleStartDeg,
    angleEndDeg: d.angleEndDeg,
    productOrder: d.productOrder,
    productPolarity: d.productPolarity,
    chargeCenter: d.chargeCenter,
    chargeLigand: d.chargeLigand,
    centerBond,
    ligandPairs: d.ligandPairs,
    ligandBond,
    protoC: d.protoC,
    spreadC: d.spreadC,
    units,
    far,
    mid,
    hit,
    fit: { productCX, productCY, reagentCX, reagentCY, armX, armY },
  }
}

// --- вода: раскадровка полёта выставлена руками ------------------------------

/**
 * Позы воды не выводятся из геометрии, а оставлены ровно теми, что были
 * отрисованы и приняты: это флагманский сценарий первого экрана, и менять его
 * картинку ради единообразия кода нельзя.
 */
const WATER_POSES = {
  far: [
    { c: [-1.72, 0.86, -0.34], axis: vunit(0.86, 0.34, 0.38) },
    { c: [1.58, 1.02, 0.12], axis: vunit(0.22, -0.94, 0.26) },
    { c: [0.34, -1.62, 0.22], axis: vunit(0.9, 0.3, -0.32) },
  ],
  mid: [
    { c: [-0.66, 0.3, -0.12], axis: vunit(0.9, 0.3, 0.3) },
    { c: [0.6, 0.46, 0.08], axis: vunit(0.4, -0.86, 0.3) },
    { c: [0.12, -0.64, 0.14], axis: vunit(0.92, 0.3, -0.24) },
  ],
  hit: [
    { c: [0, 0, 0], axis: vunit(1, 0, 0) },
    { c: [-0.3, 0.27, 0.05], axis: vunit(0.94, 0.34, 0) },
    { c: [0.3, -0.27, -0.05], axis: vunit(0.94, 0.34, 0) },
  ],
} as const satisfies { far: readonly EntryPose[]; mid: readonly EntryPose[]; hit: readonly EntryPose[] }

// --- сами сценарии -----------------------------------------------------------

export const ENTRY_SCENARIOS: readonly EntryScenarioSpec[] = [
  defineScenario({
    id: 'h2o',
    productId: 'H2O',
    equation: '2 H₂ + O₂ → 2 H₂O',
    nameKey: 'lab.entry.name.H2O',
    formula: 'H₂O',
    center: 'O',
    ligand: 'H',
    products: 2,
    ligands: 2,
    bondKey: 'O-H',
    angleStartDeg: 180,
    angleEndDeg: bondAngleDeg('water'),
    productOrder: 1,
    productPolarity: -0.68,
    chargeCenter: -0.62,
    chargeLigand: 0.31,
    centerBond: { order: 2, key: 'O=O' },
    ligandPairs: [
      [0, 1],
      [2, 3],
    ],
    ligandBond: { order: 1, key: 'H-H' },
    protoC: [
      [-0.24, 0.1, 0.02],
      [0.24, -0.1, -0.02],
    ],
    spreadC: [
      [-0.55, 0.22, 0.05],
      [0.55, -0.22, -0.05],
    ],
    poses: WATER_POSES,
  }),
  defineScenario({
    id: 'nh3',
    productId: 'NH3',
    equation: 'N₂ + 3 H₂ → 2 NH₃',
    nameKey: 'lab.entry.name.NH3',
    formula: 'NH₃',
    center: 'N',
    ligand: 'H',
    products: 2,
    ligands: 3,
    bondKey: 'N-H',
    // Заготовка плоская (120°), затем «зонтик» складывается в пирамиду 106.7°.
    angleStartDeg: 120,
    angleEndDeg: bondAngleDeg('ammonia'),
    productOrder: 1,
    productPolarity: -0.6,
    chargeCenter: -0.58,
    chargeLigand: 0.19,
    centerBond: { order: 3, key: 'N#N' },
    // Каждая молекула H₂ отдаёт по атому в РАЗНЫЕ молекулы аммиака: связь H–H
    // рвётся, и это видно — половинки расходятся в стороны.
    ligandPairs: [
      [0, 3],
      [1, 4],
      [2, 5],
    ],
    ligandBond: { order: 1, key: 'H-H' },
    protoC: [
      [-0.3, 0.12, 0.02],
      [0.3, -0.12, -0.02],
    ],
    spreadC: [
      [-0.66, 0.26, 0.06],
      [0.66, -0.26, -0.06],
    ],
  }),
  defineScenario({
    id: 'co2',
    productId: 'CO2',
    equation: 'C + O₂ → CO₂',
    nameKey: 'lab.entry.name.CO2',
    formula: 'CO₂',
    center: 'C',
    ligand: 'O',
    products: 1,
    ligands: 2,
    bondKey: 'C=O(CO2)',
    // Заготовка согнута, затем распрямляется в настоящую линейную молекулу.
    angleStartDeg: 138,
    angleEndDeg: bondAngleDeg('carbonDioxide'),
    productOrder: 2,
    productPolarity: 0.5,
    chargeCenter: 0.44,
    chargeLigand: -0.22,
    centerBond: null,
    ligandPairs: [[0, 1]],
    ligandBond: { order: 2, key: 'O=O' },
    protoC: [[0, 0, 0]],
    spreadC: [[0, 0, 0]],
  }),
  defineScenario({
    id: 'nacl',
    productId: 'NaCl',
    equation: '2 Na + Cl₂ → 2 NaCl',
    nameKey: 'lab.entry.name.NaCl',
    formula: 'NaCl',
    center: 'Cl',
    ligand: 'Na',
    // Перенос электрона размером: Na → Na⁺ сжимается, Cl → Cl⁻ разбухает.
    centerR: [rVdw('Cl'), rIon('Cl', -1)],
    ligandR: [rVdw('Na'), rIon('Na', 1)],
    products: 2,
    ligands: 1,
    bondKey: 'Na-Cl',
    angleStartDeg: 180,
    angleEndDeg: 180,
    productOrder: 1,
    productPolarity: -0.92,
    chargeCenter: -1,
    chargeLigand: 1,
    centerBond: { order: 1, key: 'Cl-Cl' },
    // Натрий прилетает одиночными атомами — металл, молекул Na₂ в кадре нет.
    ligandPairs: [],
    ligandBond: null,
    protoC: [
      [-0.42, 0.16, 0.03],
      [0.42, -0.16, -0.03],
    ],
    spreadC: [
      [-0.78, 0.28, 0.07],
      [0.78, -0.28, -0.07],
    ],
  }),
]

/** Сценарий по умолчанию — вода: с него открывается лаборатория. */
export const ENTRY_DEFAULT_SCENARIO = ENTRY_SCENARIOS[0]!

/** Наибольшее число атомов и связей среди сценариев — под них заводятся пулы. */
export const ENTRY_MAX_ATOMS = ENTRY_SCENARIOS.reduce((m, s) => Math.max(m, s.atomCount), 0)
export const ENTRY_MAX_BONDS = ENTRY_SCENARIOS.reduce((m, s) => Math.max(m, s.bondCount), 0)

/** Сценарий по кругу: номер петли → описание. */
export function entryScenarioAt(loop: number): EntryScenarioSpec {
  const n = ENTRY_SCENARIOS.length
  const i = ((loop % n) + n) % n
  return ENTRY_SCENARIOS[i]!
}
