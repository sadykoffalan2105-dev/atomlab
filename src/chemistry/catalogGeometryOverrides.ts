import type { Atom3D, Vec3 } from '../types/chemistry'
import pubchemGeometryById from '../data/pubchemGeometryById.json'

type PubChemGeometryById = Record<
  string,
  {
    atoms: Atom3D[]
    bonds: Array<[number, number]>
    source?: unknown
  }
>

const pubchemById = pubchemGeometryById as unknown as PubChemGeometryById

const LEN = (v: Vec3) => Math.hypot(v[0], v[1], v[2]) || 1
const TETR = 0.52 / Math.sqrt(3)
const tetO = (sx: number, sy: number, sz: number): Vec3 => [sx * TETR, sy * TETR, sz * TETR]

/**
 * H₂SO₄: тетраэдр O–S–O, два **смежных** гидроксильных O (цис относительно S),
 * чтобы обе O–H группы хорошо читались (учебниковая схема, не кристалл/DFT).
 */
function h2so4Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const o0 = tetO(1, 1, 1)
  const o1 = tetO(1, -1, -1)
  const o2 = tetO(-1, 1, -1)
  const o3 = tetO(-1, -1, 1)
  const oh = 0.34
  const h0: Vec3 = [
    o0[0] + (o0[0] / LEN(o0)) * oh,
    o0[1] + (o0[1] / LEN(o0)) * oh,
    o0[2] + (o0[2] / LEN(o0)) * oh,
  ]
  const h1: Vec3 = [
    o1[0] + (o1[0] / LEN(o1)) * oh,
    o1[1] + (o1[1] / LEN(o1)) * oh,
    o1[2] + (o1[2] / LEN(o1)) * oh,
  ]
  const atoms: Atom3D[] = [
    { symbol: 'S', pos: [0, 0, 0] },
    { symbol: 'O', pos: o0 },
    { symbol: 'O', pos: o1 },
    { symbol: 'O', pos: o2 },
    { symbol: 'O', pos: o3 },
    { symbol: 'H', pos: h0 },
    { symbol: 'H', pos: h1 },
  ]
  const bonds: (readonly [number, number])[] = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 5],
    [2, 6],
  ]
  return { atoms, bonds }
}

/** SO₃ (газ): S в центре, три O в плоскости, ~120°. */
function so3Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const r = 0.5
  const o0: Vec3 = [r, 0, 0]
  const o1: Vec3 = [r * Math.cos((2 * Math.PI) / 3), r * Math.sin((2 * Math.PI) / 3), 0]
  const o2: Vec3 = [r * Math.cos((4 * Math.PI) / 3), r * Math.sin((4 * Math.PI) / 3), 0]
  const atoms: Atom3D[] = [
    { symbol: 'S', pos: [0, 0, 0] },
    { symbol: 'O', pos: o0 },
    { symbol: 'O', pos: o1 },
    { symbol: 'O', pos: o2 },
  ]
  const bonds: (readonly [number, number])[] = [
    [0, 1],
    [0, 2],
    [0, 3],
  ]
  return { atoms, bonds }
}

/** H₂S: изогнутая молекула, угол H–S–H ~92° (схематично). */
function h2sGeometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const d = 0.85
  const a = 46 * (Math.PI / 180)
  const h0: Vec3 = [d * Math.sin(a), 0, d * Math.cos(a)]
  const h1: Vec3 = [-d * Math.sin(a), 0, d * Math.cos(a)]
  const atoms: Atom3D[] = [
    { symbol: 'S', pos: [0, 0, 0] },
    { symbol: 'H', pos: h0 },
    { symbol: 'H', pos: h1 },
  ]
  const bonds: (readonly [number, number])[] = [
    [0, 1],
    [0, 2],
  ]
  return { atoms, bonds }
}

/**
 * HNO₃: прибл. плоская картинка (sp² у N): трёхсвязный N + O–H.
 * Индексы: 0 N, 1 O (к OH), 2–3 O (нитрогруппа), 4 H.
 */
function hno3Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const r = 0.5
  const o0: Vec3 = [r, 0, 0]
  const o1: Vec3 = [r * Math.cos((2 * Math.PI) / 3), r * Math.sin((2 * Math.PI) / 3), 0]
  const o2: Vec3 = [r * Math.cos((4 * Math.PI) / 3), r * Math.sin((4 * Math.PI) / 3), 0]
  const h: Vec3 = [0.9, 0, 0]
  const atoms: Atom3D[] = [
    { symbol: 'N', pos: [0, 0, 0] },
    { symbol: 'O', pos: o0 },
    { symbol: 'O', pos: o1 },
    { symbol: 'O', pos: o2 },
    { symbol: 'H', pos: h },
  ]
  const bonds: (readonly [number, number])[] = [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 4],
  ]
  return { atoms, bonds }
}

/**
 * H₃PO₄: тетраэдр вокруг P, три O–H и одно O без H (=O в учебнике).
 */
function h3po4Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const o0 = tetO(1, 1, 1)
  const o1 = tetO(1, -1, -1)
  const o2 = tetO(-1, 1, -1)
  const o3 = tetO(-1, -1, 1)
  const oh = 0.33
  const h0: Vec3 = [o0[0] + (o0[0] / LEN(o0)) * oh, o0[1] + (o0[1] / LEN(o0)) * oh, o0[2] + (o0[2] / LEN(o0)) * oh]
  const h1: Vec3 = [o1[0] + (o1[0] / LEN(o1)) * oh, o1[1] + (o1[1] / LEN(o1)) * oh, o1[2] + (o1[2] / LEN(o1)) * oh]
  const h2: Vec3 = [o2[0] + (o2[0] / LEN(o2)) * oh, o2[1] + (o2[1] / LEN(o2)) * oh, o2[2] + (o2[2] / LEN(o2)) * oh]
  const atoms: Atom3D[] = [
    { symbol: 'P', pos: [0, 0, 0] },
    { symbol: 'O', pos: o0 },
    { symbol: 'O', pos: o1 },
    { symbol: 'O', pos: o2 },
    { symbol: 'O', pos: o3 },
    { symbol: 'H', pos: h0 },
    { symbol: 'H', pos: h1 },
    { symbol: 'H', pos: h2 },
  ]
  const bonds: (readonly [number, number])[] = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ]
  return { atoms, bonds }
}

/**
 * H₃PO₃: как на присланной учебниковой картинке — P в центре и 3 группы P–O–H (без P–H).
 * Схема плоская для читаемости: три O вокруг P под ~120°, H дальше по лучам O–H.
 */
function h3po3Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const rPO = 0.56
  const rOH = 0.34
  const a = (2 * Math.PI) / 3
  const o0: Vec3 = [rPO, 0, 0]
  const o1: Vec3 = [rPO * Math.cos(a), rPO * Math.sin(a), 0]
  const o2: Vec3 = [rPO * Math.cos(2 * a), rPO * Math.sin(2 * a), 0]

  const h0: Vec3 = [o0[0] + (o0[0] / LEN(o0)) * rOH, o0[1] + (o0[1] / LEN(o0)) * rOH, 0]
  const h1: Vec3 = [o1[0] + (o1[0] / LEN(o1)) * rOH, o1[1] + (o1[1] / LEN(o1)) * rOH, 0]
  const h2: Vec3 = [o2[0] + (o2[0] / LEN(o2)) * rOH, o2[1] + (o2[1] / LEN(o2)) * rOH, 0]

  const atoms: Atom3D[] = [
    { symbol: 'P', pos: [0, 0, 0] }, // 0
    { symbol: 'O', pos: o0 }, // 1
    { symbol: 'O', pos: o1 }, // 2
    { symbol: 'O', pos: o2 }, // 3
    { symbol: 'H', pos: h0 }, // 4
    { symbol: 'H', pos: h1 }, // 5
    { symbol: 'H', pos: h2 }, // 6
  ]

  const bonds: (readonly [number, number])[] = [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 4],
    [2, 5],
    [3, 6],
  ]
  return { atoms, bonds }
}

/**
 * P₂O₅: учебниковая схема с мостиком P–O–P и терминальными O.
 * Индексы: 0 P(left), 1 P(right), 2 O(bridge), 3-4 O(left terminals), 5-6 O(right terminals)
 */
function p2o5Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const pL: Vec3 = [-0.85, 0, 0]
  const pR: Vec3 = [0.85, 0, 0]
  const oB: Vec3 = [0, 0, 0]

  // Left terminals: one up (double in textbook), one left-down (double)
  const oL_up: Vec3 = [-0.85, 0.72, 0.12]
  const oL_ld: Vec3 = [-1.55, -0.25, -0.12]
  // Right terminals: one up, one right-down
  const oR_up: Vec3 = [0.85, 0.72, 0.12]
  const oR_rd: Vec3 = [1.55, -0.25, -0.12]

  const atoms: Atom3D[] = [
    { symbol: 'P', pos: pL }, // 0
    { symbol: 'P', pos: pR }, // 1
    { symbol: 'O', pos: oB }, // 2
    { symbol: 'O', pos: oL_up }, // 3
    { symbol: 'O', pos: oL_ld }, // 4
    { symbol: 'O', pos: oR_up }, // 5
    { symbol: 'O', pos: oR_rd }, // 6
  ]

  const bonds: (readonly [number, number])[] = [
    [0, 2],
    [1, 2],
    [0, 3],
    [0, 4],
    [1, 5],
    [1, 6],
  ]

  return { atoms, bonds }
}

/**
 * Al₂O₃: учебниковая схема Al–O–Al с терминальными O по краям.
 * Индексы: 0 Al(left), 1 O(left terminal), 2 O(bridge), 3 Al(right), 4 O(right terminal)
 */
function al2o3Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const alL: Vec3 = [-0.8, 0, 0]
  const alR: Vec3 = [0.8, 0, 0]
  const oB: Vec3 = [0, 0, 0]
  const oL: Vec3 = [-1.45, 0.05, 0.08]
  const oR: Vec3 = [1.45, 0.05, 0.08]

  const atoms: Atom3D[] = [
    { symbol: 'Al', pos: alL }, // 0
    { symbol: 'O', pos: oL }, // 1
    { symbol: 'O', pos: oB }, // 2
    { symbol: 'Al', pos: alR }, // 3
    { symbol: 'O', pos: oR }, // 4
  ]

  const bonds: (readonly [number, number])[] = [
    [0, 2],
    [2, 3],
    [0, 1],
    [3, 4],
  ]
  return { atoms, bonds }
}

/** Cu₂O: учебниковая цепочка Cu–O–Cu. */
function cu2oGeometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const cuL: Vec3 = [-0.9, 0, 0]
  const o: Vec3 = [0, 0, 0]
  const cuR: Vec3 = [0.9, 0, 0]
  const atoms: Atom3D[] = [
    { symbol: 'Cu', pos: cuL }, // 0
    { symbol: 'O', pos: o }, // 1
    { symbol: 'Cu', pos: cuR }, // 2
  ]
  const bonds: (readonly [number, number])[] = [
    [0, 1],
    [1, 2],
  ]
  return { atoms, bonds }
}

/** Li₂O₂: учебниковая цепочка Li–O–O–Li. */
function li2o2Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const liL: Vec3 = [-1.25, 0, 0]
  const oL: Vec3 = [-0.42, 0, 0]
  const oR: Vec3 = [0.42, 0, 0]
  const liR: Vec3 = [1.25, 0, 0]
  const atoms: Atom3D[] = [
    { symbol: 'Li', pos: liL }, // 0
    { symbol: 'O', pos: oL }, // 1
    { symbol: 'O', pos: oR }, // 2
    { symbol: 'Li', pos: liR }, // 3
  ]
  const bonds: (readonly [number, number])[] = [
    [0, 1],
    [1, 2],
    [2, 3],
  ]
  return { atoms, bonds }
}

/** Na₂O₂: учебниковая цепочка Na–O–O–Na. */
function na2o2Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const naL: Vec3 = [-1.35, 0, 0]
  const oL: Vec3 = [-0.46, 0, 0]
  const oR: Vec3 = [0.46, 0, 0]
  const naR: Vec3 = [1.35, 0, 0]
  const atoms: Atom3D[] = [
    { symbol: 'Na', pos: naL }, // 0
    { symbol: 'O', pos: oL }, // 1
    { symbol: 'O', pos: oR }, // 2
    { symbol: 'Na', pos: naR }, // 3
  ]
  const bonds: (readonly [number, number])[] = [
    [0, 1],
    [1, 2],
    [2, 3],
  ]
  return { atoms, bonds }
}

/**
 * Fe₂O₃: учебниковая цепочка O–Fe–O–Fe–O (как на присланной картинке).
 * Индексы: 0 O, 1 Fe, 2 O(bridge), 3 Fe, 4 O
 */
function fe2o3Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const o0: Vec3 = [-1.35, 0, 0]
  const fe0: Vec3 = [-0.55, 0, 0]
  const oB: Vec3 = [0, 0, 0]
  const fe1: Vec3 = [0.55, 0, 0]
  const o1: Vec3 = [1.35, 0, 0]
  const atoms: Atom3D[] = [
    { symbol: 'O', pos: o0 }, // 0
    { symbol: 'Fe', pos: fe0 }, // 1
    { symbol: 'O', pos: oB }, // 2
    { symbol: 'Fe', pos: fe1 }, // 3
    { symbol: 'O', pos: o1 }, // 4
  ]
  const bonds: (readonly [number, number])[] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
  ]
  return { atoms, bonds }
}

/** Cr₂O₃: учебниковая цепочка O–Cr–O–Cr–O. */
function cr2o3Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const o0: Vec3 = [-1.35, 0, 0]
  const cr0: Vec3 = [-0.55, 0, 0]
  const oB: Vec3 = [0, 0, 0]
  const cr1: Vec3 = [0.55, 0, 0]
  const o1: Vec3 = [1.35, 0, 0]
  const atoms: Atom3D[] = [
    { symbol: 'O', pos: o0 }, // 0
    { symbol: 'Cr', pos: cr0 }, // 1
    { symbol: 'O', pos: oB }, // 2
    { symbol: 'Cr', pos: cr1 }, // 3
    { symbol: 'O', pos: o1 }, // 4
  ]
  const bonds: (readonly [number, number])[] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
  ]
  return { atoms, bonds }
}

/**
 * Fe₃O₄: две отдельные части (без палочки между ними):
 * - часть A: Fe–O
 * - часть B: O–Fe–O–Fe–O
 */
function fe3o4Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  // Part A (left)
  const feA: Vec3 = [-1.9, 0, 0]
  const oA: Vec3 = [-1.25, 0, 0]
  // Part B (right, 5-atom chain)
  const o0: Vec3 = [-0.35, 0, 0]
  const fe0: Vec3 = [0.2, 0, 0]
  const oB: Vec3 = [0.75, 0, 0]
  const fe1: Vec3 = [1.3, 0, 0]
  const o1: Vec3 = [1.85, 0, 0]

  const atoms: Atom3D[] = [
    { symbol: 'Fe', pos: feA }, // 0
    { symbol: 'O', pos: oA }, // 1
    { symbol: 'O', pos: o0 }, // 2
    { symbol: 'Fe', pos: fe0 }, // 3
    { symbol: 'O', pos: oB }, // 4
    { symbol: 'Fe', pos: fe1 }, // 5
    { symbol: 'O', pos: o1 }, // 6
  ]

  const bonds: (readonly [number, number])[] = [
    // Part A
    [0, 1],
    // Part B
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
  ]
  return { atoms, bonds }
}

function baseMohGeometry(metal: string): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  // Linear readable chain: M–O–H
  const m: Vec3 = [-0.95, 0, 0]
  const o: Vec3 = [0, 0, 0]
  const h: Vec3 = [0.72, 0, 0]
  const atoms: Atom3D[] = [
    { symbol: metal, pos: m }, // 0
    { symbol: 'O', pos: o }, // 1
    { symbol: 'H', pos: h }, // 2
  ]
  const bonds: (readonly [number, number])[] = [
    [0, 1],
    [1, 2],
  ]
  return { atoms, bonds }
}

/** LiOH: цепочка Li–O–H. */
function liohGeometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  return baseMohGeometry('Li')
}

/** NaOH: цепочка Na–O–H. */
function naohGeometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  return baseMohGeometry('Na')
}

/** KOH: цепочка K–O–H. */
function kohGeometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  return baseMohGeometry('K')
}

/** CsOH: цепочка Cs–O–H. */
function csohGeometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  return baseMohGeometry('Cs')
}

function hydroxideOh2Geometry(metal: string): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  // Strict linear textbook chain: H–O–M–O–H
  // Indices: 0 M, 1 O(L), 2 H(L), 3 O(R), 4 H(R)
  const m: Vec3 = [0, 0, 0]
  const oL: Vec3 = [-0.78, 0, 0]
  const hL: Vec3 = [-1.38, 0, 0]
  const oR: Vec3 = [0.78, 0, 0]
  const hR: Vec3 = [1.38, 0, 0]

  const atoms: Atom3D[] = [
    { symbol: metal, pos: m }, // 0
    { symbol: 'O', pos: oL }, // 1
    { symbol: 'H', pos: hL }, // 2
    { symbol: 'O', pos: oR }, // 3
    { symbol: 'H', pos: hR }, // 4
  ]
  const bonds: (readonly [number, number])[] = [
    [0, 1],
    [1, 2],
    [0, 3],
    [3, 4],
  ]
  return { atoms, bonds }
}

function hydroxideOh3Geometry(metal: string): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  // Planar trigonal arrangement: three separate H–O–M rays.
  // Indices: 0 M, 1-3 O, 4-6 H
  const rMO = 0.62
  const rOH = 0.46
  const a = (2 * Math.PI) / 3
  const o0: Vec3 = [rMO, 0, 0]
  const o1: Vec3 = [rMO * Math.cos(a), rMO * Math.sin(a), 0]
  const o2: Vec3 = [rMO * Math.cos(2 * a), rMO * Math.sin(2 * a), 0]

  const h0: Vec3 = [o0[0] + (o0[0] / LEN(o0)) * rOH, o0[1] + (o0[1] / LEN(o0)) * rOH, 0]
  const h1: Vec3 = [o1[0] + (o1[0] / LEN(o1)) * rOH, o1[1] + (o1[1] / LEN(o1)) * rOH, 0]
  const h2: Vec3 = [o2[0] + (o2[0] / LEN(o2)) * rOH, o2[1] + (o2[1] / LEN(o2)) * rOH, 0]

  const atoms: Atom3D[] = [
    { symbol: metal, pos: [0, 0, 0] }, // 0
    { symbol: 'O', pos: o0 }, // 1
    { symbol: 'O', pos: o1 }, // 2
    { symbol: 'O', pos: o2 }, // 3
    { symbol: 'H', pos: h0 }, // 4
    { symbol: 'H', pos: h1 }, // 5
    { symbol: 'H', pos: h2 }, // 6
  ]
  const bonds: (readonly [number, number])[] = [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 4],
    [2, 5],
    [3, 6],
  ]
  return { atoms, bonds }
}

function baoh2Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  return hydroxideOh2Geometry('Ba')
}
function caoh2Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  return hydroxideOh2Geometry('Ca')
}
function sroh2Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  return hydroxideOh2Geometry('Sr')
}
function mgoh2Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  return hydroxideOh2Geometry('Mg')
}
function cuoh2Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  return hydroxideOh2Geometry('Cu')
}
function feoh2Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  return hydroxideOh2Geometry('Fe')
}
function znoh2Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  return hydroxideOh2Geometry('Zn')
}
function feoh3Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  return hydroxideOh3Geometry('Fe')
}
function aloh3Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  return hydroxideOh3Geometry('Al')
}

/**
 * NaMnO₄: учебниковая “видимая” схема тетраэдра MnO₄ и присоединённый Na.
 * Цель: 4 палочки Mn–O и минимум палочки Na–O для связности картинки.
 */
function naMno4Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const mn: Vec3 = [0, 0, 0]

  // Тетраэдр вокруг Mn (4 O).
  const o0: Vec3 = tetO(1, 1, 1) // x+
  const o1: Vec3 = tetO(1, -1, -1) // x+
  const o2: Vec3 = tetO(-1, 1, -1) // x-
  const o3: Vec3 = tetO(-1, -1, 1) // x-

  // Na размещаем “слева”, ближе к двум O с отрицательным x, чтобы палочки были хорошо видны.
  const na: Vec3 = [-1.2, 0, 0]

  // Индексы: 0 Mn, 1 Na, 2 O0, 3 O1, 4 O2, 5 O3
  const atoms: Atom3D[] = [
    { symbol: 'Mn', pos: mn },
    { symbol: 'Na', pos: na },
    { symbol: 'O', pos: o0 },
    { symbol: 'O', pos: o1 },
    { symbol: 'O', pos: o2 },
    { symbol: 'O', pos: o3 },
  ]

  const bonds: (readonly [number, number])[] = [
    // Mn–O тетраэдр
    [0, 2],
    [0, 3],
    [0, 4],
    [0, 5],
  ]

  return { atoms, bonds }
}

/**
 * CoCrO₄ (хромат кобальта(II)): симметричный анион CrO₄²⁻ (тетраэдр) + Co²⁺ сбоку.
 * Визуальная цель: палочки есть, фигура симметричная (как “учебниковая” модель).
 */
function cobaltCro4Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const cr: Vec3 = [0, 0, 0]
  const o0: Vec3 = tetO(1, 1, 1)
  const o1: Vec3 = tetO(1, -1, -1)
  const o2: Vec3 = tetO(-1, 1, -1)
  const o3: Vec3 = tetO(-1, -1, 1)

  // Co²⁺ — вынесен в сторону и “подвязан” к двум O для видимых палочек.
  const co: Vec3 = [-1.12, 0, 0]

  // Индексы: 0 Co, 1 Cr, 2-5 O
  const atoms: Atom3D[] = [
    { symbol: 'Co', pos: co }, // 0
    { symbol: 'Cr', pos: cr }, // 1
    { symbol: 'O', pos: o0 }, // 2
    { symbol: 'O', pos: o1 }, // 3
    { symbol: 'O', pos: o2 }, // 4
    { symbol: 'O', pos: o3 }, // 5
  ]

  const bonds: (readonly [number, number])[] = [
    // CrO4 core
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
  ]

  return { atoms, bonds }
}

/**
 * NaNO₂: как на референсе — Na⁺ отдельно, анион NO₂⁻ связан палочками внутри (N–O).
 * Визуальная цель: НЕТ палочек от Na к N/O.
 */
function nano2Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const na: Vec3 = [-1.45, -0.35, 0]
  const n: Vec3 = [0.25, 0.15, 0]
  const o0: Vec3 = [-0.35, -0.35, 0]
  const o1: Vec3 = [0.85, -0.35, 0]

  // Индексы: 0 Na, 1 N, 2 O, 3 O
  const atoms: Atom3D[] = [
    { symbol: 'Na', pos: na }, // 0
    { symbol: 'N', pos: n }, // 1
    { symbol: 'O', pos: o0 }, // 2
    { symbol: 'O', pos: o1 }, // 3
  ]

  const bonds: (readonly [number, number])[] = [
    [1, 2],
    [1, 3],
  ]
  return { atoms, bonds }
}

/**
 * KNO₃: ионная модель — K⁺ отдельно, анион NO₃⁻ с палочками N–O (симметрично, плоско ~120°).
 */
function kno3Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const k: Vec3 = [-1.55, -0.15, 0]
  const n: Vec3 = [0, 0.1, 0]
  const r = 0.68
  const a = (2 * Math.PI) / 3
  const o0: Vec3 = [r, -0.25, 0]
  const o1: Vec3 = [r * Math.cos(a), -0.25 + r * Math.sin(a), 0]
  const o2: Vec3 = [r * Math.cos(2 * a), -0.25 + r * Math.sin(2 * a), 0]

  // Индексы: 0 K, 1 N, 2-4 O
  const atoms: Atom3D[] = [
    { symbol: 'K', pos: k },
    { symbol: 'N', pos: n },
    { symbol: 'O', pos: o0 },
    { symbol: 'O', pos: o1 },
    { symbol: 'O', pos: o2 },
  ]
  const bonds: (readonly [number, number])[] = [
    [1, 2],
    [1, 3],
    [1, 4],
  ]
  return { atoms, bonds }
}

/**
 * (NH₄)₃PO₄: симметричная “учебниковая” связная модель.
 * - PO₄: P в центре, 4 O тетраэдром, палочки P–O.
 * - 3×NH₄: три N вокруг, у каждого 4 H тетраэдром, палочки N–H.
 * - Межионные палочки: N–O (чтобы всё было одной связной фигурой).
 */
function nh4_3_po4Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k]
  const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
  const norm = (v: Vec3): Vec3 => {
    const l = LEN(v)
    return [v[0] / l, v[1] / l, v[2] / l]
  }

  // PO4 tetrahedron
  const p: Vec3 = [0, 0, 0]
  const rPO = 0.66
  const o0 = scale(norm(tetO(1, 1, 1)), rPO)
  const o1 = scale(norm(tetO(1, -1, -1)), rPO)
  const o2 = scale(norm(tetO(-1, 1, -1)), rPO)
  const o3 = scale(norm(tetO(-1, -1, 1)), rPO)

  // Place three NH4 groups around (triangular symmetry), slightly outside PO4.
  const rPN = 1.42
  const nDirs: Vec3[] = [o0, o1, o2].map((v) => norm(v))
  const n0 = scale(nDirs[0]!, rPN)
  const n1 = scale(nDirs[1]!, rPN)
  const n2 = scale(nDirs[2]!, rPN)

  const rNH = 0.54
  const hDirs: Vec3[] = [
    norm(tetO(1, 1, 1)),
    norm(tetO(1, -1, -1)),
    norm(tetO(-1, 1, -1)),
    norm(tetO(-1, -1, 1)),
  ]

  const atoms: Atom3D[] = [
    { symbol: 'P', pos: p }, // 0
    { symbol: 'O', pos: o0 }, // 1
    { symbol: 'O', pos: o1 }, // 2
    { symbol: 'O', pos: o2 }, // 3
    { symbol: 'O', pos: o3 }, // 4

    { symbol: 'N', pos: n0 }, // 5
    { symbol: 'N', pos: n1 }, // 6
    { symbol: 'N', pos: n2 }, // 7
  ]

  const bonds: (readonly [number, number])[] = [
    // PO4
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
  ]

  const addNh4 = (nIdx: number) => {
    const nPos = atoms[nIdx]!.pos
    const start = atoms.length
    for (let i = 0; i < 4; i++) {
      const hPos = add(nPos, scale(hDirs[i]!, rNH))
      atoms.push({ symbol: 'H', pos: hPos })
      bonds.push([nIdx, start + i])
    }
  }

  addNh4(5)
  addNh4(6)
  addNh4(7)

  // Ionic model: NH₄⁺ and PO₄³⁻ are separate ions (no inter-ion sticks).

  return { atoms, bonds }
}

/**
 * NH₃·H₂O: учебниковая схема (аммиак + вода).
 * Важно: N связано ровно с 3 H, O связано ровно с 2 H (всего H=5).
 */
function nh3h2oGeometry(): {
  atoms: Atom3D[]
  bonds: readonly (readonly [number, number])[]
} {
  // Layout: NH3 сверху, H2O снизу — так палочки визуально читаются.
  const n: Vec3 = [0, 0.45, 0]
  const o: Vec3 = [0, -0.55, 0]

  const rNH = 0.72
  const rOH = 0.46

  // Three N–H bonds (approx trigonal pyramid, schematic)
  const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]
  const nhDirs: Vec3[] = angles.map((t) => {
    const x = Math.cos(t)
    const z = Math.sin(t)
    const y = 0.25 // slight upward component towards the viewer
    const len = Math.hypot(x, y, z) || 1
    return [x / len, y / len, z / len]
  })
  const hN0: Vec3 = [n[0] + nhDirs[0]![0] * rNH, n[1] + nhDirs[0]![1] * rNH, n[2] + nhDirs[0]![2] * rNH]
  const hN1: Vec3 = [n[0] + nhDirs[1]![0] * rNH, n[1] + nhDirs[1]![1] * rNH, n[2] + nhDirs[1]![2] * rNH]
  const hN2: Vec3 = [n[0] + nhDirs[2]![0] * rNH, n[1] + nhDirs[2]![1] * rNH, n[2] + nhDirs[2]![2] * rNH]

  // Two O–H bonds
  const hO0: Vec3 = [o[0] - rOH * 0.8, o[1] + rOH * 0.6, rOH * 0.2]
  const hO1: Vec3 = [o[0] + rOH * 0.8, o[1] + rOH * 0.6, -rOH * 0.2]

  // Indices:
  // 0 N
  // 1 O
  // 2-4 H on N (3 шт)
  // 5-6 H on O (2 шт)
  const atoms: Atom3D[] = [
    { symbol: 'N', pos: n }, // 0
    { symbol: 'O', pos: o }, // 1
    { symbol: 'H', pos: hN0 }, // 2
    { symbol: 'H', pos: hN1 }, // 3
    { symbol: 'H', pos: hN2 }, // 4
    { symbol: 'H', pos: hO0 }, // 5
    { symbol: 'H', pos: hO1 }, // 6
  ]

  const bonds: (readonly [number, number])[] = [
    // NH3
    [0, 2],
    [0, 3],
    [0, 4],
    // H2O
    [1, 5],
    [1, 6],
  ]

  return { atoms, bonds }
}

/**
 * K₂Cr₂O₇ (дихромат калия): учебниковая схема «два CrO₄, общий мостиковый O».
 * Делается намеренно читаемой (не кристалл/DFT): K⁺ вынесены по краям, связи палочками есть везде.
 */
function k2cr2o7Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  // Индексы: 0 K(left), 1 K(right), 2 Cr(left), 3 Cr(right), 4 O(bridge), далее O терминальные
  const kL: Vec3 = [-2.1, -0.15, 0.35]
  const kR: Vec3 = [2.1, -0.15, 0.35]
  const crL: Vec3 = [-0.78, 0, 0]
  const crR: Vec3 = [0.78, 0, 0]
  const oB: Vec3 = [0, 0, 0]

  // Терминальные O вокруг каждого Cr (3 шт), плюс по одному «верхнему» O для более похожей картинки
  const oL0: Vec3 = [crL[0] - 0.2, crL[1] + 0.62, crL[2] + 0.22]
  const oL1: Vec3 = [crL[0] - 0.58, crL[1] - 0.18, crL[2] - 0.18]
  const oL2: Vec3 = [crL[0] + 0.06, crL[1] - 0.58, crL[2] + 0.12]
  const oR0: Vec3 = [crR[0] + 0.2, crR[1] + 0.62, crR[2] + 0.22]
  const oR1: Vec3 = [crR[0] + 0.58, crR[1] - 0.18, crR[2] - 0.18]
  const oR2: Vec3 = [crR[0] - 0.06, crR[1] - 0.58, crR[2] + 0.12]

  const atoms: Atom3D[] = [
    { symbol: 'K', pos: kL }, // 0
    { symbol: 'K', pos: kR }, // 1
    { symbol: 'Cr', pos: crL }, // 2
    { symbol: 'Cr', pos: crR }, // 3
    { symbol: 'O', pos: oB }, // 4
    { symbol: 'O', pos: oL0 }, // 5
    { symbol: 'O', pos: oL1 }, // 6
    { symbol: 'O', pos: oL2 }, // 7
    { symbol: 'O', pos: oR0 }, // 8
    { symbol: 'O', pos: oR1 }, // 9
    { symbol: 'O', pos: oR2 }, // 10
  ]

  const bonds: (readonly [number, number])[] = [
    // Cr—O внутри аниона
    [2, 4],
    [2, 5],
    [2, 6],
    [2, 7],
    [3, 4],
    [3, 8],
    [3, 9],
    [3, 10],
  ]

  return { atoms, bonds }
}

/**
 * Ca(HCO₃)₂: учебниковая схема, Ca в центре, две группы HCO₃ симметрично.
 * Цвета не трогаем — только топология/раскладка.
 */
function caHco32Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  // Индексы:
  // 0 Ca
  // Левая группа: 1 C, 2 O(to Ca), 3 O(top), 4 O(bottom), 5 H(bottom)
  // Правая группа: 6 C, 7 O(to Ca), 8 O(top), 9 O(bottom), 10 H(bottom)
  const ca: Vec3 = [0, 0, 0]

  const cL: Vec3 = [-1.35, 0, 0]
  const oL_ca: Vec3 = [-0.78, 0.22, 0] // катион не должен "слипаться" с анионом
  const oL_top: Vec3 = [-1.55, 0.62, 0.15]
  const oL_bot: Vec3 = [-1.55, -0.62, -0.15]
  const hL: Vec3 = [-1.85, -0.88, -0.15]

  const cR: Vec3 = [1.35, 0, 0]
  const oR_ca: Vec3 = [0.78, 0.22, 0]
  const oR_top: Vec3 = [1.55, 0.62, 0.15]
  const oR_bot: Vec3 = [1.55, -0.62, -0.15]
  const hR: Vec3 = [1.85, -0.88, -0.15]

  const atoms: Atom3D[] = [
    { symbol: 'Ca', pos: ca }, // 0
    { symbol: 'C', pos: cL }, // 1
    { symbol: 'O', pos: oL_ca }, // 2
    { symbol: 'O', pos: oL_top }, // 3
    { symbol: 'O', pos: oL_bot }, // 4
    { symbol: 'H', pos: hL }, // 5
    { symbol: 'C', pos: cR }, // 6
    { symbol: 'O', pos: oR_ca }, // 7
    { symbol: 'O', pos: oR_top }, // 8
    { symbol: 'O', pos: oR_bot }, // 9
    { symbol: 'H', pos: hR }, // 10
  ]

  const bonds: (readonly [number, number])[] = [
    // связи внутри HCO3
    [1, 2],
    [1, 3],
    [1, 4],
    [4, 5],
    [6, 7],
    [6, 8],
    [6, 9],
    [9, 10],
    // Ionic model: Ca²⁺ отдельно, без палочек к HCO₃⁻
  ]

  return { atoms, bonds }
}

/**
 * KHCO₃: калий + бикарбонат (HCO₃) — симметричная учебниковая схема.
 * K слева, связь к O (координация), внутри аниона C–O и O–H.
 */
function khco3Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  // Индексы: 0 K, 1 C, 2 O(to K), 3 O(top), 4 O(bottom), 5 H(bottom)
  const k: Vec3 = [-1.65, 0.05, 0.15]
  const c: Vec3 = [0.1, 0, 0]
  const oK: Vec3 = [-0.62, 0.16, 0]
  const oTop: Vec3 = [0.55, 0.62, 0.15]
  const oBot: Vec3 = [0.55, -0.62, -0.15]
  const h: Vec3 = [0.92, -0.88, -0.15]

  const atoms: Atom3D[] = [
    { symbol: 'K', pos: k }, // 0
    { symbol: 'C', pos: c }, // 1
    { symbol: 'O', pos: oK }, // 2
    { symbol: 'O', pos: oTop }, // 3
    { symbol: 'O', pos: oBot }, // 4
    { symbol: 'H', pos: h }, // 5
  ]

  const bonds: (readonly [number, number])[] = [
    [1, 2],
    [1, 3],
    [1, 4],
    [4, 5],
  ]
  return { atoms, bonds }
}

/**
 * NaHCO₃: как на присланной схеме — Na⁺ слева, два контакта к O⁻,
 * внутри аниона связи C–O и O–H.
 */
function nahco3Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  // Индексы: 0 Na, 1 C, 2 O(left, to Na), 3 O(top, to Na), 4 O(bottom, to H), 5 H, 6 C(second) (для «изгиба» как на фото)
  // На картинке видно два углерода (визуальная постановка). В нашей формуле C один, поэтому делаем один C.
  // Размещаем HCO3 вокруг C и Na слева, с двумя связями Na—O.
  const na: Vec3 = [-1.7, 0.12, 0.15]
  const c: Vec3 = [0, 0, 0]
  const oLeft: Vec3 = [-0.68, -0.22, 0.05] // O- ближе к Na
  const oTop: Vec3 = [-0.1, 0.78, 0.14]
  const oBot: Vec3 = [0.72, -0.52, -0.12]
  const h: Vec3 = [1.06, -0.82, -0.12]

  const atoms: Atom3D[] = [
    { symbol: 'Na', pos: na }, // 0
    { symbol: 'C', pos: c }, // 1
    { symbol: 'O', pos: oLeft }, // 2
    { symbol: 'O', pos: oTop }, // 3
    { symbol: 'O', pos: oBot }, // 4
    { symbol: 'H', pos: h }, // 5
  ]

  const bonds: (readonly [number, number])[] = [
    // HCO3
    [1, 2],
    [1, 3],
    [1, 4],
    [4, 5],
    // Ionic model: Na⁺ отдельно, без палочек к HCO₃⁻
  ]
  return { atoms, bonds }
}

/**
 * CrPO₄: как на присланной схеме — Cr³⁺ слева, PO₄ справа (P в центре),
 * и “координационные” связи Cr—O к трём кислородам (пунктир на фото).
 */
function crpo4Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  // Индексы: 0 Cr, 1 P, 2 O(top), 3 O(right), 4 O(left-bottom), 5 O(left)
  const cr: Vec3 = [-1.25, 0.05, 0.15]
  const p: Vec3 = [0.35, 0.05, 0]
  const oTop: Vec3 = [0.35, 0.95, 0.08]
  const oRight: Vec3 = [1.18, 0.05, -0.05]
  const oLb: Vec3 = [0.35, -0.82, -0.12]
  const oLeft: Vec3 = [-0.48, 0.1, 0.05]

  const atoms: Atom3D[] = [
    { symbol: 'Cr', pos: cr }, // 0
    { symbol: 'P', pos: p }, // 1
    { symbol: 'O', pos: oTop }, // 2
    { symbol: 'O', pos: oRight }, // 3
    { symbol: 'O', pos: oLb }, // 4
    { symbol: 'O', pos: oLeft }, // 5
  ]

  const bonds: (readonly [number, number])[] = [
    // phosphate core
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
    // Ionic model: Cr³⁺ отдельно, без палочек к PO₄³⁻
  ]
  return { atoms, bonds }
}

/**
 * AlPO₄: как на присланной схеме — Al³⁺ слева, PO₄ справа (P в центре),
 * и две “координационные” связи Al—O (пунктир на фото).
 */
function alpo4Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  // Индексы: 0 Al, 1 P, 2 O(top), 3 O(right), 4 O(bottom), 5 O(left)
  const al: Vec3 = [-1.15, 0.05, 0.12]
  const p: Vec3 = [0.42, 0.08, 0]
  const oTop: Vec3 = [0.42, 1.0, 0.08]
  const oRight: Vec3 = [1.2, 0.08, -0.05]
  const oBot: Vec3 = [0.42, -0.78, -0.12]
  const oLeft: Vec3 = [-0.4, 0.18, 0.04]

  const atoms: Atom3D[] = [
    { symbol: 'Al', pos: al }, // 0
    { symbol: 'P', pos: p }, // 1
    { symbol: 'O', pos: oTop }, // 2
    { symbol: 'O', pos: oRight }, // 3
    { symbol: 'O', pos: oBot }, // 4
    { symbol: 'O', pos: oLeft }, // 5
  ]

  const bonds: (readonly [number, number])[] = [
    // phosphate core
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
    // Ionic model: Al³⁺ отдельно, без палочек к PO₄³⁻
  ]
  return { atoms, bonds }
}

/**
 * FePO₄: как учебниковая схема (по фото — Fe³⁺ слева + координация к O фосфата).
 * В реальности это сетчатая структура, но тут делаем читаемую “модель на столе”.
 */
function fepo4Geometry(): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  // Индексы: 0 Fe, 1 P, 2 O(top), 3 O(right), 4 O(bottom), 5 O(left)
  // На присланной схеме Fe³⁺ показан отдельно от аниона PO₄³⁻ (без палочек).
  const p: Vec3 = [0, 0.05, 0]
  const oTop: Vec3 = [0, 1.02, 0.08]
  const oRight: Vec3 = [0.92, 0.05, -0.08]
  const oBot: Vec3 = [0, -0.88, -0.12]
  const oLeft: Vec3 = [-0.92, 0.12, 0.08]
  const fe: Vec3 = [1.28, -0.78, 0.22]

  const atoms: Atom3D[] = [
    { symbol: 'Fe', pos: fe }, // 0
    { symbol: 'P', pos: p }, // 1
    { symbol: 'O', pos: oTop }, // 2
    { symbol: 'O', pos: oRight }, // 3
    { symbol: 'O', pos: oBot }, // 4
    { symbol: 'O', pos: oLeft }, // 5
  ]

  const bonds: (readonly [number, number])[] = [
    // phosphate core
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
    // Fe³⁺ отдельно — без связей (как на схеме)
  ]
  return { atoms, bonds }
}

/**
 * Топология и 3D-раскладка «как в учебнике» (не DFT, не кристалл);
 * идентификатор = `id` вещества в данных.
 */
export function getMolecularGeometryOrNull(
  compoundId: string,
): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } | null {
  switch (compoundId) {
    case 'h2so4':
      return h2so4Geometry()
    case 'so3':
      return so3Geometry()
    case 'h2s':
      return h2sGeometry()
    case 'hno3':
      return hno3Geometry()
    case 'h3po4':
      return h3po4Geometry()
    case 'h3po3':
      return h3po3Geometry()
    case 'p2o5':
      return p2o5Geometry()
    case 'al2o3':
      return al2o3Geometry()
    case 'cu2o':
      return cu2oGeometry()
    case 'li2o2':
      return li2o2Geometry()
    case 'na2o2':
      return na2o2Geometry()
    case 'fe2o3':
      return fe2o3Geometry()
    case 'cr2o3':
      return cr2o3Geometry()
    case 'fe3o4':
      return fe3o4Geometry()
    case 'lioh':
      return liohGeometry()
    case 'naoh':
      return naohGeometry()
    case 'koh':
      return kohGeometry()
    case 'csoh':
      return csohGeometry()
    case 'nh3_h2o':
      return nh3h2oGeometry()
    // M(OH)2: в данных id в формате *_oh_2
    case 'baoh2':
    case 'ba_oh_2':
      return baoh2Geometry()
    case 'caoh2':
    case 'ca_oh_2':
      return caoh2Geometry()
    case 'sroh2':
    case 'sr_oh_2':
      return sroh2Geometry()
    case 'mgoh2':
    case 'mg_oh_2':
      return mgoh2Geometry()
    case 'cuoh2':
    case 'cu_oh_2':
      return cuoh2Geometry()
    case 'feoh2':
    case 'fe_oh_2':
      return feoh2Geometry()
    case 'znoh2':
    case 'zn_oh_2':
      return znoh2Geometry()

    // M(OH)3: в данных id в формате *_oh_3
    case 'feoh3':
    case 'fe_oh_3':
      return feoh3Geometry()
    case 'aloh3':
    case 'al_oh_3':
      return aloh3Geometry()
    case 'salt_k2cr2o7':
      return k2cr2o7Geometry()
    case 'salt_k_no3':
      return kno3Geometry()
    case 'salt_nh4_3_po4':
      return nh4_3_po4Geometry()
    case 'salt_na_no2':
      {
        const geo = nano2Geometry()
      // #region agent log
      fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dbdb64' },
        body: JSON.stringify({
          sessionId: 'dbdb64',
          runId: 'na_no2_dbg',
          hypothesisId: 'H3_override_selected',
          location: 'src/chemistry/catalogGeometryOverrides.ts:getMolecularGeometryOrNull',
          message: 'using manual override nano2Geometry()',
          data: {
            compoundId,
            symbols: geo.atoms.map((a) => a.symbol),
            bonds: geo.bonds,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
        return geo
      }
    case 'salt_na_mno4':
      return naMno4Geometry()
    case 'salt_cobalt_cro4':
      return cobaltCro4Geometry()
    case 'salt_ca_hco3_2':
      return caHco32Geometry()
    case 'salt_khco3':
      return khco3Geometry()
    case 'salt_nahco3':
      return nahco3Geometry()
    case 'salt_cr_po4':
      return crpo4Geometry()
    case 'salt_al_po4':
      return alpo4Geometry()
    case 'salt_fe3_po4':
      return fepo4Geometry()
    default:
      {
        // Ionic salts: do not trust PubChem "molecular" bonds between ions.
        // Use generator/overrides instead.
        if (compoundId.startsWith('salt_')) return null
        const g = pubchemById[compoundId]
        // #region agent log
        if (compoundId === 'salt_na_no2') {
          fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dbdb64' },
            body: JSON.stringify({
              sessionId: 'dbdb64',
              runId: 'na_no2_dbg',
              hypothesisId: 'H1_pubchem_selected',
              location: 'src/chemistry/catalogGeometryOverrides.ts:getMolecularGeometryOrNull',
              message: 'default branch pubchem lookup',
              data: {
                found: !!g,
                atomsLen: Array.isArray(g?.atoms) ? g?.atoms?.length : null,
                bondsLen: Array.isArray(g?.bonds) ? g?.bonds?.length : null,
                firstSymbols: Array.isArray(g?.atoms) ? g.atoms.slice(0, 6).map((a) => a.symbol) : null,
                firstBonds: Array.isArray(g?.bonds) ? g.bonds.slice(0, 8) : null,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {})
        }
        // #endregion
        if (!g || !Array.isArray(g.atoms) || !Array.isArray(g.bonds)) return null
        return { atoms: g.atoms, bonds: g.bonds }
      }
  }
}
