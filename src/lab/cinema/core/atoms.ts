/**
 * ATOMLAB Cinema — атомные константы.
 *
 * Радиусы — ковалентные / ионные в ангстремах (Cordero 2008, Shannon 1976),
 * поэтому пропорции молекул на экране совпадают с реальными, а не «на глаз».
 * Цвета — CPK-палитра, адаптированная под неоновый микромир:
 * кислород красный, хлор жёлто-зелёный (цвет настоящего Cl₂), натрий фиолетовый.
 */

/** Сцена: 1 Å = SCENE_PER_ANGSTROM мировых единиц. */
export const SCENE_PER_ANGSTROM = 0.285

export function ang(a: number): number {
  return a * SCENE_PER_ANGSTROM
}

export const CPK = {
  H: 0xffffff,
  C: 0x2a2a32,
  N: 0x3050f8,
  O: 0xff0040,
  Na: 0x8a2be2,
  Cl: 0xa6ff00,
} as const

export type CpkSymbol = keyof typeof CPK

/** Ковалентные радиусы, Å. */
export const COVALENT_RADIUS_A = {
  H: 0.31,
  C: 0.76,
  N: 0.71,
  O: 0.66,
  Na: 1.66,
  Cl: 1.02,
} as const

/** Ионные радиусы, Å (КЧ 6). */
export const IONIC_RADIUS_A = {
  'Na+': 1.02,
  'Cl-': 1.81,
} as const

/**
 * Экранный радиус сферы атома. Ковалентный радиус даёт слишком плотные
 * «слипшиеся» шары, поэтому берём его долю — стандартный приём ball-and-stick.
 */
export function atomRadius(symbol: CpkSymbol, scale = 0.72): number {
  return ang(COVALENT_RADIUS_A[symbol]) * scale
}

/** Экспериментальные длины связей, Å. */
export const BOND_LENGTH_A = {
  /** Cl–O в радикале ClO₂ */
  ClO_radical: 1.47,
  /** Cl–O в ионе хлорита ClO₂⁻ (чуть длиннее — меньший порядок связи) */
  ClO_chlorite: 1.57,
  /** Cl–Cl в молекуле хлора */
  ClCl: 1.988,
  /** Na⁺···Cl⁻ в ионной паре */
  NaCl: 2.36,
  /** C–H в метане */
  CH: 1.087,
  /** O=O в молекулярном кислороде */
  OO: 1.208,
  /** C=O в CO₂ */
  CO: 1.16,
  /** O–H в воде */
  OH: 0.958,
} as const

/** Валентные углы, градусы (эксперимент / VSEPR). */
export const BOND_ANGLE_DEG = {
  /** O–Cl–O в радикале ClO₂ */
  clo2: 117.4,
  /** O–Cl–O в ионе хлорита ClO₂⁻ */
  chlorite: 110.5,
  /** H–O–H в воде */
  water: 104.5,
  /** тетраэдр (метан) */
  tetrahedral: 109.47,
  /** линейная молекула (CO₂) */
  linear: 180,
} as const
