/**
 * Геометрия героя продукта — чистый модуль (three.Vector3 без рендера), считается один раз на вещество.
 *
 * Кристалл: фрагмент из целых ячеек генератором kit/lattice (базис ядра), радиусы — Шеннон при
 * фактическом КЧ узла (ионные) или Кордеро (ковалентный каркас), рёбра ячеек, подпись a / группа / КЧ.
 * Молекула: длины, углы и двугранный угол из bondData через core/vsepr; у воды — соседи
 * на водородных связях. Ни одного числа химии: только ключи из heroStructures и данные ядра.
 *
 * Все координаты — в мировых единицах кино-ядра (pmToScene), без нормировки: компонент героя сам
 * масштабирует модель под кадр (одним множителем — отношения размеров честные).
 */
import * as THREE from 'three'
import {
  ATOMIC_DATA,
  bondAngleDeg,
  bondLengthPm,
  dihedralAngleDeg,
  getCrystal,
  radiusForSpecies,
  type ElementSymbol,
} from '../../../chemistry/data'
import { heroSpecFor, type CrystalHeroSpec, type HeroSpec, type MoleculeHeroSpec } from '../../../chemistry/data/heroStructures'
import {
  createBentFrame,
  createBridgedFrame,
  writeBent,
  writeBridged,
  writeDihedral,
  writeLinear,
  writeTrigonalPlanar,
} from '../../../lab/cinema/core/vsepr'
import { LATTICE_BALL_SCALE, pmToScene, SPECIES_SCALE, speciesLabel } from '../../../lab/cinema/scenes/kit/cpkAtoms'
import { latticeCaption, latticeFragment, type LatticeSegment, type Vec3 } from '../../../lab/cinema/scenes/kit/lattice'
import type { SubstanceKind } from '../../../lab/cinema/scenes/kit/materials'

export type HeroAtom = {
  el: ElementSymbol
  /** заряд иона (ионная решётка) или 0 */
  charge: number
  /** КЧ, при котором взят радиус (0 — молекула или ковалентный радиус) */
  cn: number
  pos: Vec3
  /** радиус частицы, пм (Шеннон при КЧ / Кордеро) */
  radiusPm: number
  /** радиус шара в мире (доля SPECIES_SCALE от настоящего, как во всех сценах) */
  radius: number
  surface: SubstanceKind
  /** true — атом соседней молекулы (контекст), false — главная молекула / кристалл */
  neighbor: boolean
}

export type HeroBondKind = 'sigma' | 'multiple' | 'hbond'

export type HeroBond = {
  a: number
  b: number
  order: number
  kind: HeroBondKind
  /** длина, пм — для теста и подписей */
  lengthPm: number
}

export type HeroLabel = {
  /** индекс атома, у которого подпись, или -1 — подпись под моделью */
  atom: number
  /** только формулы, заряды, числа и токены единиц ({pm}, {cn}) — решение 8 */
  text: string
  kind: 'species' | 'ox' | 'token'
  /**
   * Кристалл: все узлы этого сорта на верхнем слое. Герой в кадре переносит подпись на того из них,
   * кто при облёте ДАЛЬШЕ всех от зрителя: над ним нет чужих сфер, и подпись не ложится на соседний
   * ион (приёмка: «Na⁺» висела над передним Cl⁻).
   */
  candidates?: number[]
}

export type HeroModel = {
  compoundId: string
  spec: HeroSpec
  atoms: HeroAtom[]
  bonds: HeroBond[]
  /** рёбра ячеек (только у кристалла), мир */
  cellEdges: LatticeSegment[]
  /** радиус описанной сферы вокруг начала координат, включая радиусы шаров, мир */
  radius: number
  labels: HeroLabel[]
  /** подпись под моделью (строки через localizeLabelText) */
  caption: string[]
  /** у кристалла — число ячеек */
  cells?: Vec3
}

const PM = pmToScene(1)

function ballRadius(pm: number, scale = SPECIES_SCALE): number {
  return pm * PM * scale
}

/**
 * Доля радиуса для шаров КРИСТАЛЛА: меньше, чем у сцен (SPECIES_SCALE), чтобы сквозь фрагмент
 * читались рёбра ячеек и дальние слои. Доля одна на все ионы фрагмента — отношения размеров
 * (Na⁺ : Cl⁻ = 102 : 181) остаются честными.
 */
const CRYSTAL_BALL_SCALE = LATTICE_BALL_SCALE

function boundsRadius(atoms: readonly HeroAtom[], edges: readonly LatticeSegment[]): number {
  let r = 0
  for (const a of atoms) r = Math.max(r, Math.hypot(a.pos[0], a.pos[1], a.pos[2]) + a.radius)
  for (const [p, q] of edges) r = Math.max(r, Math.hypot(p[0], p[1], p[2]), Math.hypot(q[0], q[1], q[2]))
  return r
}

// ─── Кристалл ────────────────────────────────────────────────────────────────

function buildCrystal(compoundId: string, spec: CrystalHeroSpec): HeroModel {
  const frag = latticeFragment(spec.crystalId, [spec.cells[0], spec.cells[1], spec.cells[2]])
  const surface: SubstanceKind = spec.radiusModel === 'covalent' ? 'polar' : 'ion'
  const atoms: HeroAtom[] = frag.sites.map((s) => {
    const charge = spec.radiusModel === 'ionic' ? s.charge : 0
    const radiusPm =
      spec.radiusModel === 'ionic'
        ? radiusForSpecies(s.el, s.charge, { cn: s.cn, model: 'ionic' })
        : radiusForSpecies(s.el, 0, { model: 'covalent' })
    return {
      el: s.el,
      charge,
      cn: spec.radiusModel === 'ionic' ? s.cn : 0,
      pos: [s.posScene[0], s.posScene[1], s.posScene[2]],
      radiusPm,
      radius: ballRadius(radiusPm, CRYSTAL_BALL_SCALE),
      surface,
      neighbor: false,
    }
  })
  const bonds: HeroBond[] = spec.drawBonds
    ? frag.bonds.map(([a, b, len]) => ({ a, b, order: 1, kind: 'sigma' as const, lengthPm: len }))
    : []
  // Подписи частиц: по одной на сорт — на ВЕРХНЕМ слое фрагмента. Модель наклонена верхом к зрителю
  // и облетается вокруг вертикали, поэтому верхняя грань видна всегда, а атом у оси облёта не уезжает
  // за кристалл: подпись над ним никогда не ложится на чужую сферу при скрытом якоре (приёмка: «Na⁺»
  // висела над передним Cl⁻). Первый сорт — узел, ближайший к оси; следующие — дальше от уже
  // подписанных, со штрафом за удаление от оси (чтобы подпись не уходила на край при облёте).
  const labels: HeroLabel[] = []
  const kinds: string[] = []
  for (const a of atoms) {
    const key = `${a.el}${a.charge}`
    if (!kinds.includes(key)) kinds.push(key)
  }
  for (const key of kinds) {
    const ofKind = atoms.map((_, i) => i).filter((i) => `${atoms[i]!.el}${atoms[i]!.charge}` === key)
    const yTop = Math.max(...ofKind.map((i) => atoms[i]!.pos[1]))
    const top = ofKind.filter((i) => atoms[i]!.pos[1] >= yTop - 1e-3)
    let best = -1
    let bestScore = -Infinity
    for (const i of top) {
      const a = atoms[i]!
      const axis = Math.hypot(a.pos[0], a.pos[2])
      let sep = Infinity
      for (const l of labels) {
        const b = atoms[l.atom]!
        sep = Math.min(sep, Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2]))
      }
      const score = labels.length === 0 ? -axis : sep - 0.5 * axis
      if (score > bestScore + 1e-9) {
        bestScore = score
        best = i
      }
    }
    if (best < 0) continue
    const a = atoms[best]!
    labels.push({ atom: best, text: spec.radiusModel === 'ionic' ? speciesLabel(a.el, a.charge) : a.el, kind: 'species', candidates: top })
  }
  if (spec.radiusModel === 'covalent') {
    // Полярно-ковалентный каркас: частичные заряды δ+/δ− по электроотрицательности, без «Si⁴⁺ и O²⁻».
    for (const l of labels) {
      const el = atoms[l.atom]!.el
      const others = atoms.filter((x) => x.el !== el)
      if (others.length === 0) continue
      const chiSelf = ATOMIC_DATA[el].electronegativity
      const chiOther = ATOMIC_DATA[others[0]!.el].electronegativity
      l.text = `${el} ${(chiSelf ?? 0) < (chiOther ?? 0) ? 'δ+' : 'δ−'}`
    }
  }
  const edges = frag.cellEdges
  return {
    compoundId,
    spec,
    atoms,
    bonds,
    cellEdges: edges,
    radius: boundsRadius(atoms, edges),
    labels,
    caption: latticeCaption(spec.crystalId),
    cells: frag.cells,
  }
}

// ─── Молекула ────────────────────────────────────────────────────────────────

const _o = new THREE.Vector3()
const V = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z]

function covalentAtom(el: ElementSymbol, pos: THREE.Vector3, surface: SubstanceKind, neighbor = false): HeroAtom {
  const radiusPm = radiusForSpecies(el, 0, { model: 'covalent' })
  return { el, charge: 0, cn: 0, pos: V(pos), radiusPm, radius: ballRadius(radiusPm), surface, neighbor }
}

/** Главная молекула: атомы и связи в мире, центр масс геометрии — в начале координат. */
function buildMolecule(compoundId: string, spec: MoleculeHeroSpec): HeroModel {
  const g = spec.geometry
  const surface: SubstanceKind = spec.phase === 'gas' ? 'gas' : 'covalent'
  const atoms: HeroAtom[] = []
  const bonds: HeroBond[] = []
  const bond = (a: number, b: number, order: number, lengthPm: number) =>
    bonds.push({ a, b, order, kind: order > 1 ? 'multiple' : 'sigma', lengthPm })

  if (g.shape === 'bent') {
    const len = bondLengthPm(g.bond)
    const f = createBentFrame()
    // Биссектриса угла — вниз по экрану (−Y), плоскость молекулы — к зрителю.
    writeBent(f, _o.set(0, 0, 0), bondAngleDeg(g.angle), len * PM, 0, Math.PI / 2, 0)
    atoms.push(covalentAtom(g.center, f.center, surface))
    atoms.push(covalentAtom(g.ligand, f.l0, surface))
    atoms.push(covalentAtom(g.ligand, f.l1, surface))
    bond(0, 1, g.order, len)
    bond(0, 2, g.order, len)
  } else if (g.shape === 'linear') {
    const len = bondLengthPm(g.bond)
    const f = createBentFrame()
    writeLinear(f, _o.set(0, 0, 0), len * PM, 0, 0)
    // Ось молекулы — вертикально: облёт идёт вокруг вертикали, и линейная молекула всегда видна сбоку,
    // а не «с торца» (при горизонтальной оси она раз в полоборота схлопывается в один шар).
    for (const p of [f.l0, f.l1]) p.set(-p.y, p.x, p.z)
    atoms.push(covalentAtom(g.center, f.center, surface))
    atoms.push(covalentAtom(g.ligand, f.l0, surface))
    atoms.push(covalentAtom(g.ligand, f.l1, surface))
    bond(0, 1, g.order, len)
    bond(0, 2, g.order, len)
  } else if (g.shape === 'trigonalPlanar') {
    const len = bondLengthPm(g.bond)
    const out = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
    // Плоскость треугольника развёрнута к зрителю, чтобы три равные связи читались сразу.
    writeTrigonalPlanar(out, _o.set(0, 0, 0), len * PM, 0, Math.PI / 2 - 0.35, 0)
    atoms.push(covalentAtom(g.center, _o, surface))
    for (const p of out) {
      atoms.push(covalentAtom(g.ligand, p, surface))
      bond(0, atoms.length - 1, g.order, len)
    }
  } else if (g.shape === 'peroxide') {
    const oo = bondLengthPm(g.oo)
    const oh = bondLengthPm(g.oh)
    const ang = bondAngleDeg(g.angle)
    const dih = dihedralAngleDeg(g.dihedral)
    const o1 = new THREE.Vector3(-oo * PM * 0.5, 0, 0)
    const o2 = new THREE.Vector3(oo * PM * 0.5, 0, 0)
    // Первый H — в плоскости xy под углом O–O–H к связи O–O; второй — writeDihedral с диэдром из ядра.
    const th = (ang * Math.PI) / 180
    const h1 = new THREE.Vector3(o1.x + Math.cos(th) * oh * PM, Math.sin(th) * oh * PM, 0)
    const h2 = writeDihedral(h1, o1, o2, new THREE.Vector3(), oh * PM, ang, dih)
    atoms.push(covalentAtom('O', o1, surface), covalentAtom('O', o2, surface), covalentAtom('H', h1, surface), covalentAtom('H', h2, surface))
    bond(0, 1, 1, oo)
    bond(0, 2, 1, oh)
    bond(1, 3, 1, oh)
  } else {
    const lb = bondLengthPm(g.bridge)
    const lt = bondLengthPm(g.term)
    const f = createBridgedFrame(3)
    writeBridged(f, _o.set(0, 0, 0), lb * PM, bondAngleDeg(g.bridgeAngle), lt * PM, bondAngleDeg(g.termAngle), 0)
    atoms.push(covalentAtom('O', f.bridge, surface))
    atoms.push(covalentAtom(g.center, f.x0, surface))
    atoms.push(covalentAtom(g.center, f.x1, surface))
    bond(0, 1, 1, lb)
    bond(0, 2, 1, lb)
    for (const [side, list] of [[1, f.t0], [2, f.t1]] as const) {
      for (const p of list) {
        atoms.push(covalentAtom('O', p, surface))
        bond(side, atoms.length - 1, g.termOrder, lt)
      }
    }
  }

  // Центр геометрии молекулы — в начало координат (кадр вращается вокруг молекулы).
  const c = [0, 0, 0]
  for (const a of atoms) {
    c[0] += a.pos[0]
    c[1] += a.pos[1]
    c[2] += a.pos[2]
  }
  for (const a of atoms) {
    a.pos[0] -= c[0]! / atoms.length
    a.pos[1] -= c[1]! / atoms.length
    a.pos[2] -= c[2]! / atoms.length
  }

  const mainCount = atoms.length
  if (spec.neighbors === 'hbond-water' && g.shape === 'bent') addWaterNeighbors(atoms, bonds, g.bond, g.angle)

  // Подписи: один символ на сорт атома главной молекулы.
  const labels: HeroLabel[] = []
  const seen = new Set<string>()
  for (let i = 0; i < mainCount; i++) {
    const el = atoms[i]!.el
    if (seen.has(el)) continue
    seen.add(el)
    labels.push({ atom: i, text: el, kind: 'species' })
  }
  return { compoundId, spec, atoms, bonds, cellEdges: [], radius: boundsRadius(atoms, []), labels, caption: [] }
}

/**
 * Четыре соседа воды на водородных связях: два принимают протоны центральной молекулы (O···H–O
 * вдоль её связей O–H), два отдают свой протон её неподелённым парам (тетраэдрические направления,
 * школьная схема sp³). Расстояния: O–H из bondData + H···O из 'O-H...O' — O···O получается честным.
 */
function addWaterNeighbors(atoms: HeroAtom[], bonds: HeroBond[], ohKey: 'O-H' | string, angleKey: Parameters<typeof bondAngleDeg>[0]): void {
  const oh = bondLengthPm(ohKey as 'O-H')
  const hb = bondLengthPm('O-H...O')
  const angle = bondAngleDeg(angleKey)
  const O = new THREE.Vector3(...atoms[0]!.pos)
  const H1 = new THREE.Vector3(...atoms[1]!.pos)
  const H2 = new THREE.Vector3(...atoms[2]!.pos)
  const u1 = H1.clone().sub(O).normalize()
  const u2 = H2.clone().sub(O).normalize()
  // Направления неподелённых пар: тетраэдр, дополняющий две связи O–H (школьная схема sp³).
  const bis = u1.clone().add(u2).normalize()
  const perp = u1.clone().cross(u2).normalize()
  const tet = Math.acos(-1 / 3) / 2
  const lp1 = bis.clone().multiplyScalar(-Math.cos(tet)).addScaledVector(perp, Math.sin(tet)).normalize()
  const lp2 = bis.clone().multiplyScalar(-Math.cos(tet)).addScaledVector(perp, -Math.sin(tet)).normalize()
  const surface = atoms[0]!.surface

  /** Молекула воды с атомом O в точке o; один её H смотрит вдоль dirH (или от центра). */
  const addWater = (o: THREE.Vector3, dirH: THREE.Vector3, spin: number): { oi: number; h0: number } => {
    const d = dirH.clone().normalize()
    const side = new THREE.Vector3(0, 1, 0).cross(d)
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0).cross(d)
    side.normalize().applyAxisAngle(d, spin)
    const th = (angle * Math.PI) / 180
    const h0 = o.clone().addScaledVector(d, oh * PM)
    const d2 = d.clone().multiplyScalar(Math.cos(th)).addScaledVector(side, Math.sin(th))
    const h1 = o.clone().addScaledVector(d2, oh * PM)
    const oi = atoms.length
    atoms.push(covalentAtom('O', o, surface, true), covalentAtom('H', h0, surface, true), covalentAtom('H', h1, surface, true))
    bonds.push({ a: oi, b: oi + 1, order: 1, kind: 'sigma', lengthPm: oh }, { a: oi, b: oi + 2, order: 1, kind: 'sigma', lengthPm: oh })
    return { oi, h0: oi + 1 }
  }

  // Акцепторы: O соседа на продолжении O–H центральной молекулы, O···O = O–H + H···O.
  for (const [hIdx, u] of [[1, u1], [2, u2]] as const) {
    const o = O.clone().addScaledVector(u, (oh + hb) * PM)
    // Протоны акцептора смотрят ОТ центральной молекулы
    const { oi } = addWater(o, u, hIdx === 1 ? 0.9 : -0.9)
    bonds.push({ a: hIdx, b: oi, order: 1, kind: 'hbond', lengthPm: hb })
  }
  // Доноры: их O–H направлена на неподелённую пару центрального O.
  for (const [k, lp] of [[0, lp1], [1, lp2]] as const) {
    const o = O.clone().addScaledVector(lp, (oh + hb) * PM)
    const { h0 } = addWater(o, lp.clone().negate(), k === 0 ? 0.6 : -0.6)
    bonds.push({ a: h0, b: 0, order: 1, kind: 'hbond', lengthPm: hb })
  }
}

// ─── Вход ────────────────────────────────────────────────────────────────────

const cache = new Map<string, HeroModel | null>()

/** Модель героя по id вещества или null — вещество показывается каталожной моделью. */
export function buildHeroModel(compoundId: string): HeroModel | null {
  const hit = cache.get(compoundId)
  if (hit !== undefined) return hit
  const spec = heroSpecFor(compoundId)
  let model: HeroModel | null = null
  if (spec?.kind === 'crystal' && getCrystal(spec.crystalId)?.basis) model = buildCrystal(compoundId, spec)
  else if (spec?.kind === 'molecule') model = buildMolecule(compoundId, spec)
  cache.set(compoundId, model)
  return model
}
