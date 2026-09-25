/**
 * Геометрия частиц реактора, которых нет в каталоге: ионы (SO₄²⁻, NO₃⁻, NH₄⁺, H₃O⁺ …),
 * органика школьных уравнений (CH₄, C₂H₅OH, C₃H₈, C₆H₁₂O₆, HCHO, CH₃OH, C₂H₂),
 * простые вещества в роли продукта (H₂, O₂, N₂, Cl₂ …).
 *
 * Координаты — в ангстремах. Длины связей и валентные углы — из научного ядра
 * (src/chemistry/data/bondData.ts), а где там такой связи нет — справочные значения
 * с источником прямо в комментарии. Построение — Z-матрица (алгоритм NeRF):
 * атом задаётся длиной связи, валентным и двугранным углом, поэтому углы в модели
 * ровно те, что записаны, а не «на глаз».
 *
 * Модуль без three/React — его читают реактор, раскладка сцены и тесты в Node.
 */
import { bondAngleDeg, bondLengthPm } from './data'
import type { Atom3D, Vec3 } from '../types/chemistry'

export type LabGeometry = { atoms: Atom3D[]; bonds: [number, number][] }

type V = [number, number, number]

const pm = (key: Parameters<typeof bondLengthPm>[0]) => bondLengthPm(key) / 100
const DEG = Math.PI / 180
/** Идеальный тетраэдр, arccos(−1/3) = 109.47° (ядро: BOND_ANGLES.tetrahedral). */
const TETRA = bondAngleDeg('tetrahedral')

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const subV = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: V): V => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/**
 * Z-матрица. Каждый атом: символ, к какому атому привязан (r, Å), с каким образует
 * валентный угол (°) и двугранный угол (°). Первые три атома — упрощённо.
 */
export type ZRow = {
  sym: string
  /** индекс атома, с которым связь */
  b?: number
  r?: number
  /** индекс атома для валентного угла (this–b–a) */
  a?: number
  ang?: number
  /** индекс атома для двугранного угла (this–b–a–d) */
  d?: number
  dih?: number
  /** Связь рисуется (по умолчанию да, если задан b). */
  bond?: boolean
}

/** NeRF: новый атом D, связанный с C, угол B–C–D, двугранный A–B–C–D. */
function place(A: V, B: V, C: V, r: number, angDeg: number, dihDeg: number): V {
  const bc = norm(subV(C, B))
  const n = norm(cross(subV(B, A), bc))
  const m = cross(n, bc)
  const t = angDeg * DEG
  const p = dihDeg * DEG
  const d2: V = [-r * Math.cos(t), r * Math.sin(t) * Math.cos(p), r * Math.sin(t) * Math.sin(p)]
  return add(C, add(add(mul(bc, d2[0]), mul(m, d2[1])), mul(n, d2[2])))
}

export function buildZMatrix(rows: readonly ZRow[]): LabGeometry {
  const pos: V[] = []
  const bonds: [number, number][] = []
  rows.forEach((row, i) => {
    let p: V
    if (i === 0 || row.b == null) {
      p = [0, 0, 0]
    } else if (i === 1 || row.a == null) {
      p = add(pos[row.b]!, [row.r ?? 1, 0, 0])
    } else if (i === 2 || row.d == null) {
      // третий атом — в плоскости xy
      const C = pos[row.b]!
      const B = pos[row.a]!
      const fakeA: V = add(B, [0, 1, 0])
      const alt: V = Math.abs(dot(norm(subV(C, B)), [0, 1, 0])) > 0.99 ? add(B, [0, 0, 1]) : fakeA
      p = place(alt, B, C, row.r ?? 1, row.ang ?? 109.47, row.dih ?? 0)
    } else {
      p = place(pos[row.d]!, pos[row.a]!, pos[row.b]!, row.r ?? 1, row.ang ?? 109.47, row.dih ?? 0)
    }
    pos.push(p)
    if (row.b != null && row.bond !== false) bonds.push([row.b, i])
  })
  return { atoms: rows.map((r, i) => ({ symbol: r.sym, pos: pos[i]! as Vec3 })), bonds }
}

// ── центральный атом + лиганды (VSEPR) ─────────────────────────────────────

/** 4 направления правильного тетраэдра. */
function tetraDirs(): V[] {
  return ([
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ] as V[]).map(norm)
}

/**
 * n лигандов, симметрично вокруг оси −z с попарным углом alpha:
 * n = 3, alpha = 120° — плоский треугольник; alpha < 120° — пирамида (неподелённая пара вверх).
 */
function coneDirs(n: number, alphaDeg: number): V[] {
  // cos α = cos²β + sin²β·cos(2π/n) → cos²β = (cos α − cos(2π/n)) / (1 − cos(2π/n))
  const c = Math.cos((2 * Math.PI) / n)
  const cos2b = Math.max(0, Math.min(1, (Math.cos(alphaDeg * DEG) - c) / (1 - c)))
  const cb = Math.sqrt(cos2b)
  const sb = Math.sqrt(1 - cos2b)
  return Array.from({ length: n }, (_, k) => {
    const phi = (2 * Math.PI * k) / n + Math.PI / 2
    return [sb * Math.cos(phi), sb * Math.sin(phi), -cb] as V
  })
}

type Ligand = {
  sym: string
  /** длина связи центр–лиганд, Å */
  r: number
  /** атом H на лиганде (гидроксил): длина O–H и угол X–O–H */
  h?: { r: number; ang: number }
}

/**
 * Центр + лиганды по направлениям; водороды гидроксилов разворачиваются «наружу»
 * и в сторону от соседнего лиганда (двугранный 180° к первому соседу).
 */
function centered(center: string, dirs: readonly V[], ligands: readonly Ligand[]): LabGeometry {
  const atoms: Atom3D[] = [{ symbol: center, pos: [0, 0, 0] }]
  const bonds: [number, number][] = []
  const ligPos: V[] = []
  ligands.forEach((l, i) => {
    const p = mul(dirs[i]!, l.r)
    ligPos.push(p)
    atoms.push({ symbol: l.sym, pos: p })
    bonds.push([0, atoms.length - 1])
  })
  ligands.forEach((l, i) => {
    if (!l.h) return
    // сосед для двугранного угла — ближайший лиганд без водорода (иначе любой другой)
    const other = ligands.findIndex((m, j) => j !== i && !m.h)
    const refIdx = other >= 0 ? other : (i + 1) % ligands.length
    const ref = ligPos[refIdx] ?? ([0, 0, 1] as V)
    const hp = place(ref, [0, 0, 0], ligPos[i]!, l.h.r, l.h.ang, 180)
    atoms.push({ symbol: 'H', pos: hp })
    bonds.push([i + 1, atoms.length - 1])
  })
  return { atoms, bonds }
}

// ── справочные длины (там, где в ядре нет записи) ─────────────────────────

/**
 * Длины связей в ионах, Å. Источники: кристаллоструктурные средние
 * (Allen F. H. et al., «Tables of bond lengths determined by X-ray and neutron diffraction»,
 * J. Chem. Soc. Perkin Trans. 2 (1987) S1; International Tables for Crystallography, vol. C, 9.5)
 * и газофазные данные NIST CCCBDB для OH⁻, H₃O⁺, NH₄⁺.
 */
export const ION_BOND_A = {
  /** S–O в сульфат-ионе SO₄²⁻ (кристаллы сульфатов, среднее) */
  SO_sulfate: 1.473,
  /** HSO₄⁻: S=O 1.45 и S–OH 1.56 (KHSO₄, нейтронография) */
  SO_hso4_term: 1.45,
  SO_hso4_oh: 1.56,
  /** N–O в нитрат-ионе NO₃⁻ */
  NO_nitrate: 1.25,
  /** P–O в фосфат-ионе PO₄³⁻ */
  PO_phosphate: 1.537,
  /** P–O / P–OH в HPO₄²⁻ и H₂PO₄⁻ */
  PO_term: 1.51,
  PO_oh: 1.57,
  /** C–O / C–OH в HCO₃⁻ (NaHCO₃) */
  CO_hco3_term: 1.26,
  CO_hco3_oh: 1.34,
  /** N–H в NH₄⁺ (кристаллы солей аммония, нейтронография) */
  NH_ammonium: 1.03,
  /** O–H в H₃O⁺ (газ, ИК-спектроскопия) */
  OH_hydronium: 0.976,
  /** O–H в OH⁻ (газ, NIST CCCBDB) */
  OH_hydroxide: 0.964,
  /** Cl–O в ClO₃⁻ (KClO₃) */
  ClO_chlorate: 1.49,
  /** I–O в IO₃⁻ (KIO₃) */
  IO_iodate: 1.81,
  /** Cr–O в CrO₄²⁻ (K₂CrO₄) */
  CrO_chromate: 1.65,
  /** Si–O концевые в цепочечном метасиликате (Na₂SiO₃) */
  SiO_metasilicate: 1.60,
  /** Al–O(H) в гидроксоаквакомплексе алюминия */
  AlO_hydroxo: 1.83,
} as const

/** Валентные углы ионов, °, из тех же источников. */
export const ION_ANGLE_DEG = {
  /** H–O–H в H₃O⁺ (газ) */
  hydronium: 111.3,
  /** O–Cl–O в ClO₃⁻ */
  chlorate: 106.7,
  /** O–I–O в IO₃⁻ */
  iodate: 99.0,
  /** X–O–H у гидроксилов оксоанионов (HSO₄⁻, H₂PO₄⁻, HCO₃⁻) */
  xoh: 110,
} as const

const OH = () => pm('O-H')

// ── ионы ────────────────────────────────────────────────────────────────────

export function ionGeometry(key: string): LabGeometry | null {
  const T = tetraDirs()
  const tri = coneDirs(3, 120)
  switch (key) {
    case 'OH':
      return buildZMatrix([{ sym: 'O' }, { sym: 'H', b: 0, r: ION_BOND_A.OH_hydroxide }])
    case 'H3O': {
      const d = coneDirs(3, ION_ANGLE_DEG.hydronium)
      return centered('O', d, [0, 1, 2].map(() => ({ sym: 'H', r: ION_BOND_A.OH_hydronium })))
    }
    case 'NH4':
      return centered('N', T, [0, 1, 2, 3].map(() => ({ sym: 'H', r: ION_BOND_A.NH_ammonium })))
    case 'SO4':
      return centered('S', T, [0, 1, 2, 3].map(() => ({ sym: 'O', r: ION_BOND_A.SO_sulfate })))
    case 'HSO4':
      return centered('S', T, [
        { sym: 'O', r: ION_BOND_A.SO_hso4_oh, h: { r: OH(), ang: ION_ANGLE_DEG.xoh } },
        { sym: 'O', r: ION_BOND_A.SO_hso4_term },
        { sym: 'O', r: ION_BOND_A.SO_hso4_term },
        { sym: 'O', r: ION_BOND_A.SO_hso4_term },
      ])
    case 'PO4':
      return centered('P', T, [0, 1, 2, 3].map(() => ({ sym: 'O', r: ION_BOND_A.PO_phosphate })))
    case 'HPO4':
      return centered('P', T, [
        { sym: 'O', r: ION_BOND_A.PO_oh, h: { r: OH(), ang: ION_ANGLE_DEG.xoh } },
        { sym: 'O', r: ION_BOND_A.PO_term },
        { sym: 'O', r: ION_BOND_A.PO_term },
        { sym: 'O', r: ION_BOND_A.PO_term },
      ])
    case 'H2PO4':
      return centered('P', T, [
        { sym: 'O', r: ION_BOND_A.PO_oh, h: { r: OH(), ang: ION_ANGLE_DEG.xoh } },
        { sym: 'O', r: ION_BOND_A.PO_oh, h: { r: OH(), ang: ION_ANGLE_DEG.xoh } },
        { sym: 'O', r: ION_BOND_A.PO_term },
        { sym: 'O', r: ION_BOND_A.PO_term },
      ])
    case 'CrO4':
      return centered('Cr', T, [0, 1, 2, 3].map(() => ({ sym: 'O', r: ION_BOND_A.CrO_chromate })))
    case 'CO3':
      // ядро: C–O в карбонат-ионе 128.4 пм, O–C–O 120°
      return centered('C', coneDirs(3, bondAngleDeg('carbonate')), [0, 1, 2].map(() => ({ sym: 'O', r: pm('C-O(CO3)') })))
    case 'HCO3':
      return centered('C', tri, [
        { sym: 'O', r: ION_BOND_A.CO_hco3_oh, h: { r: OH(), ang: ION_ANGLE_DEG.xoh } },
        { sym: 'O', r: ION_BOND_A.CO_hco3_term },
        { sym: 'O', r: ION_BOND_A.CO_hco3_term },
      ])
    case 'NO3':
      return centered('N', tri, [0, 1, 2].map(() => ({ sym: 'O', r: ION_BOND_A.NO_nitrate })))
    case 'SiO3':
      // Школьная запись SiO₃²⁻: в силикатах это цепочка тетраэдров; здесь — формульная единица
      // из трёх атомов O у Si (плоский треугольник, как у изоэлектронного CO₃²⁻).
      return centered('Si', tri, [0, 1, 2].map(() => ({ sym: 'O', r: ION_BOND_A.SiO_metasilicate })))
    case 'ClO3':
      return centered('Cl', coneDirs(3, ION_ANGLE_DEG.chlorate), [0, 1, 2].map(() => ({ sym: 'O', r: ION_BOND_A.ClO_chlorate })))
    case 'IO3':
      return centered('I', coneDirs(3, ION_ANGLE_DEG.iodate), [0, 1, 2].map(() => ({ sym: 'O', r: ION_BOND_A.IO_iodate })))
    case 'AlOH':
      // Школьная запись AlOH²⁺ (в растворе — [Al(H₂O)₅OH]²⁺): Al–O–H, угол как у гидроксила.
      return buildZMatrix([
        { sym: 'Al' },
        { sym: 'O', b: 0, r: ION_BOND_A.AlO_hydroxo },
        { sym: 'H', b: 1, r: OH(), a: 0, ang: 120 },
      ])
    default:
      return null
  }
}

// ── органика (газовая фаза, NIST CCCBDB; C–H, C–C, C–O, C=O, C≡C, O–H — из ядра) ──

/** Тетраэдрический угол при sp³-углероде. */
const SP3 = TETRA

export function organicGeometry(key: string): LabGeometry | null {
  const CH = pm('C-H')
  const CC = pm('C-C')
  const CO = pm('C-O')
  switch (key) {
    case 'CH4':
      return centered('C', tetraDirs(), [0, 1, 2, 3].map(() => ({ sym: 'H', r: CH })))
    case 'CH3OH':
      // C–O–H 108.5° (CCCBDB), водороды метила — заторможенная конформация
      return buildZMatrix([
        { sym: 'C' },
        { sym: 'O', b: 0, r: CO },
        { sym: 'H', b: 1, r: OH(), a: 0, ang: 108.5 },
        { sym: 'H', b: 0, r: CH, a: 1, ang: SP3, d: 2, dih: 180 },
        { sym: 'H', b: 0, r: CH, a: 1, ang: SP3, d: 2, dih: 60 },
        { sym: 'H', b: 0, r: CH, a: 1, ang: SP3, d: 2, dih: -60 },
      ])
    case 'C2H5OH':
      // анти-конформер: C–C–O 107.8°, C–O–H 108.5°, H–O–C–C 180°
      return buildZMatrix([
        { sym: 'C' },
        { sym: 'C', b: 0, r: CC },
        { sym: 'O', b: 1, r: CO, a: 0, ang: 107.8 },
        { sym: 'H', b: 2, r: OH(), a: 1, ang: 108.5, d: 0, dih: 180 },
        { sym: 'H', b: 0, r: CH, a: 1, ang: SP3, d: 2, dih: 180 },
        { sym: 'H', b: 0, r: CH, a: 1, ang: SP3, d: 2, dih: 60 },
        { sym: 'H', b: 0, r: CH, a: 1, ang: SP3, d: 2, dih: -60 },
        { sym: 'H', b: 1, r: CH, a: 0, ang: SP3, d: 2, dih: 120 },
        { sym: 'H', b: 1, r: CH, a: 0, ang: SP3, d: 2, dih: -120 },
      ])
    case 'C3H8':
      // C–C–C 112.4° (CCCBDB), концевые метилы заторможены
      return buildZMatrix([
        { sym: 'C' },
        { sym: 'C', b: 0, r: CC },
        { sym: 'C', b: 1, r: CC, a: 0, ang: 112.4 },
        { sym: 'H', b: 0, r: CH, a: 1, ang: SP3, d: 2, dih: 180 },
        { sym: 'H', b: 0, r: CH, a: 1, ang: SP3, d: 2, dih: 60 },
        { sym: 'H', b: 0, r: CH, a: 1, ang: SP3, d: 2, dih: -60 },
        { sym: 'H', b: 1, r: CH, a: 0, ang: SP3, d: 2, dih: 121 },
        { sym: 'H', b: 1, r: CH, a: 0, ang: SP3, d: 2, dih: -121 },
        { sym: 'H', b: 2, r: CH, a: 1, ang: SP3, d: 0, dih: 180 },
        { sym: 'H', b: 2, r: CH, a: 1, ang: SP3, d: 0, dih: 60 },
        { sym: 'H', b: 2, r: CH, a: 1, ang: SP3, d: 0, dih: -60 },
      ])
    case 'HCHO':
      // плоская молекула: C=O 120.5 пм, C–H 111.1 пм, H–C–H 116.1° (CCCBDB)
      return buildZMatrix([
        { sym: 'C' },
        { sym: 'O', b: 0, r: 1.205 },
        { sym: 'H', b: 0, r: 1.111, a: 1, ang: 180 - 116.1 / 2 },
        { sym: 'H', b: 0, r: 1.111, a: 1, ang: 180 - 116.1 / 2, d: 2, dih: 180 },
      ])
    case 'C2H2':
      // линейная: C≡C из ядра (120.3 пм), C–H 106.3 пм (CCCBDB)
      return {
        atoms: [
          { symbol: 'C', pos: [-pm('C#C') / 2, 0, 0] },
          { symbol: 'C', pos: [pm('C#C') / 2, 0, 0] },
          { symbol: 'H', pos: [-pm('C#C') / 2 - 1.063, 0, 0] },
          { symbol: 'H', pos: [pm('C#C') / 2 + 1.063, 0, 0] },
        ],
        bonds: [
          [0, 1],
          [0, 2],
          [1, 3],
        ],
      }
    case 'C6H12O6':
      return glucoseGeometry()
    default:
      return null
  }
}

/**
 * β-D-глюкопираноза, кресло ⁴C₁: все заместители (OH при C1–C4 и CH₂OH при C5) экваториальные.
 * Кольцо: C–C 152 пм, C–O 143 пм, углы 110.5°, торсионы ±57° (кристалл β-D-глюкозы,
 * Chu & Jeffrey, Acta Cryst. B24 (1968) 830 — средние значения). Абсолютная конфигурация
 * (D, C5 — R) проверяется знаком смешанного произведения; при ошибке — зеркало.
 */
function glucoseGeometry(): LabGeometry {
  const CC = 1.52
  const CO_RING = 1.43
  const CO_OH = 1.42
  const CH = pm('C-H')
  const OHr = OH()
  // Кольцо C1, C2, C3, C4, C5, O5 (индексы 0..5). Валентный угол 108.2° и торсион кресла ±60.05°
  // подобраны перебором (шаг 0.05°) так, что кольцо замыкается связью O5–C1 = 1.430 Å, а углы на
  // замыкании остаются тетраэдрическими: C5–O5–C1 113.1°, O5–C1–C2 108.2° (проверяет test-lab-species).
  const RING_ANG = 108.2
  const TORS = 60.05
  const ring = buildZMatrix([
    { sym: 'C' },
    { sym: 'C', b: 0, r: CC },
    { sym: 'C', b: 1, r: CC, a: 0, ang: RING_ANG },
    { sym: 'C', b: 2, r: CC, a: 1, ang: RING_ANG, d: 0, dih: -TORS },
    { sym: 'C', b: 3, r: CC, a: 2, ang: RING_ANG, d: 1, dih: TORS },
    { sym: 'O', b: 4, r: CO_RING, a: 3, ang: RING_ANG, d: 2, dih: -TORS },
  ])
  const P: V[] = ring.atoms.map((a) => [...a.pos] as V)
  const syms: string[] = ring.atoms.map((a) => a.symbol)
  const bonds: [number, number][] = [...ring.bonds, [5, 0]]
  const push = (sym: string, p: V, bondTo: number) => {
    P.push(p)
    syms.push(sym)
    bonds.push([bondTo, P.length - 1])
    return P.length - 1
  }
  // нормаль средней плоскости кольца
  const centroid = mul(P.slice(0, 6).reduce((s, p) => add(s, p), [0, 0, 0] as V), 1 / 6)
  let axis: V = [0, 0, 0]
  for (let i = 0; i < 6; i++) axis = add(axis, cross(subV(P[i]!, centroid), subV(P[(i + 1) % 6]!, centroid)))
  axis = norm(axis)
  /** Две свободные тетраэдрические вакансии у атома кольца: [экваториальная, аксиальная]. */
  const vacancies = (i: number): [V, V] => {
    const a = P[(i + 5) % 6]!
    const b = P[(i + 1) % 6]!
    const c = P[i]!
    const u = norm(add(norm(subV(c, a)), norm(subV(c, b))))
    const n = norm(cross(subV(a, c), subV(b, c)))
    const half = (SP3 / 2) * DEG
    const d1 = norm(add(mul(u, Math.cos(half)), mul(n, Math.sin(half))))
    const d2 = norm(add(mul(u, Math.cos(half)), mul(n, -Math.sin(half))))
    return Math.abs(dot(d1, axis)) < Math.abs(dot(d2, axis)) ? [d1, d2] : [d2, d1]
  }
  const oxygens: { o: number; c: number; ref: number }[] = []
  // C1..C4: OH экваториально, H аксиально
  for (let i = 0; i < 4; i++) {
    const [eq, ax] = vacancies(i)
    const o = push('O', add(P[i]!, mul(eq, CO_OH)), i)
    push('H', add(P[i]!, mul(ax, CH)), i)
    oxygens.push({ o, c: i, ref: (i + 1) % 6 })
  }
  // C5: CH₂OH экваториально, H аксиально
  const [eq5, ax5] = vacancies(4)
  const c6 = push('C', add(P[4]!, mul(eq5, CC)), 4)
  push('H', add(P[4]!, mul(ax5, CH)), 4)
  // O6: гош к O5 (конформация gg, двугранный O5–C5–C6–O6 = −60°)
  const o6 = push('O', place(P[5]!, P[4]!, P[c6]!, CO_OH, SP3, -60), c6)
  push('H', place(P[5]!, P[4]!, P[c6]!, CH, SP3, -60 + 120), c6)
  push('H', place(P[5]!, P[4]!, P[c6]!, CH, SP3, -60 - 120), c6)
  oxygens.push({ o: o6, c: c6, ref: 4 })
  // гидроксильные H: C–O–H 108.5°, анти к соседнему атому кольца
  for (const { o, c, ref } of oxygens) push('H', place(P[ref]!, P[c]!, P[o]!, OHr, 108.5, 180), o)

  // Проверка D-конфигурации: у C5 приоритеты O5 > C4 > C6 > H, R ⇔ смешанное произведение < 0.
  const c5 = P[4]!
  const triple = dot(subV(P[5]!, c5), cross(subV(P[3]!, c5), subV(P[c6]!, c5)))
  const mirror = triple > 0
  const atoms: Atom3D[] = P.map((p, i) => ({ symbol: syms[i]!, pos: (mirror ? [p[0], p[1], -p[2]] : p) as Vec3 }))
  return { atoms, bonds }
}

// ── простые вещества ────────────────────────────────────────────────────────

/** Длина связи двухатомной молекулы простого вещества, Å (ядро), null — нет в ядре. */
export function diatomicBondA(symbol: string): number | null {
  switch (symbol) {
    case 'H':
      return pm('H-H')
    case 'N':
      return pm('N#N')
    case 'O':
      return pm('O=O')
    case 'F':
      return pm('F-F')
    case 'Cl':
      return pm('Cl-Cl')
    case 'Br':
      return pm('Br-Br')
    case 'I':
      return pm('I-I')
    default:
      return null
  }
}

export function simpleSubstanceGeometry(symbol: string, n: number): LabGeometry {
  if (n === 2) {
    const r = diatomicBondA(symbol) ?? 1.5
    return {
      atoms: [
        { symbol, pos: [-r / 2, 0, 0] },
        { symbol, pos: [r / 2, 0, 0] },
      ],
      bonds: [[0, 1]],
    }
  }
  return { atoms: [{ symbol, pos: [0, 0, 0] }], bonds: [] }
}

/** Валентный угол по трём атомам геометрии, ° — для тестов. */
export function angleAt(g: LabGeometry, a: number, center: number, b: number): number {
  const p = (i: number) => g.atoms[i]!.pos as unknown as V
  const u = norm(subV(p(a), p(center)))
  const v = norm(subV(p(b), p(center)))
  return Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) / DEG
}

/** Длина связи по двум атомам геометрии, Å — для тестов. */
export function distance(g: LabGeometry, a: number, b: number): number {
  const p = g.atoms[a]!.pos
  const q = g.atoms[b]!.pos
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}
