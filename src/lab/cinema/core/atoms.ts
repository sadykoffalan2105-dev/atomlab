/**
 * ATOMLAB Cinema — атомные константы В МИРОВЫХ ЕДИНИЦАХ СЦЕНЫ.
 *
 * Этот файл БОЛЬШЕ НЕ ХРАНИТ чисел: все радиусы, длины связей и углы
 * приходят из научного ядра `src/chemistry/data` (Cordero 2008, Shannon 1976,
 * NIST/CRC) и здесь только переводятся пм → Å → мировые единицы сцены.
 * Правку числа делают ТАМ, чтобы сцены, панели и тесты никогда не разъезжались.
 *
 * Цвета — CPK-палитра, адаптированная под неоновый микромир:
 * кислород красный, хлор жёлто-зелёный (цвет настоящего Cl₂), натрий фиолетовый.
 */
import {
  ATOMIC_DATA,
  bondAngleDeg,
  bondLengthPm,
  covalentRadiusPm,
  ionicRadiusPm,
  metallicRadiusPm,
  radiusForSpecies as radiusForSpeciesPm,
  reagentAngleDeg,
  reagentBondPm,
  type ReagentGeometryKey,
  type ElementSymbol,
  type RadiusModel,
} from '../../../chemistry/data'

/** Опции радиуса частицы — те же, что у ядра: фактическое КЧ и модель (ionic/covalent/metallic). */
export type SpeciesRadiusOpts = { readonly cn?: number; readonly model?: RadiusModel }

/** Сцена: 1 Å = SCENE_PER_ANGSTROM мировых единиц. */
export const SCENE_PER_ANGSTROM = 0.285

export function ang(a: number): number {
  return a * SCENE_PER_ANGSTROM
}

/** пм → Å. Научное ядро хранит пикометры, сцены считают в ангстремах. */
export function pmToAngstrom(pm: number): number {
  return pm / 100
}

const covA = (s: ElementSymbol) => pmToAngstrom(covalentRadiusPm(s))
const ionA = (s: ElementSymbol, charge: number) => pmToAngstrom(ionicRadiusPm(s, charge) as number)
const metA = (s: ElementSymbol) => pmToAngstrom(metallicRadiusPm(s) as number)

export const CPK = {
  H: ATOMIC_DATA.H.cpk,
  C: ATOMIC_DATA.C.cpk,
  N: ATOMIC_DATA.N.cpk,
  O: ATOMIC_DATA.O.cpk,
  F: ATOMIC_DATA.F.cpk,
  Na: ATOMIC_DATA.Na.cpk,
  Mg: ATOMIC_DATA.Mg.cpk,
  Al: ATOMIC_DATA.Al.cpk,
  Si: ATOMIC_DATA.Si.cpk,
  P: ATOMIC_DATA.P.cpk,
  S: ATOMIC_DATA.S.cpk,
  Cl: ATOMIC_DATA.Cl.cpk,
  K: ATOMIC_DATA.K.cpk,
  Ca: ATOMIC_DATA.Ca.cpk,
  V: ATOMIC_DATA.V.cpk,
  Cr: ATOMIC_DATA.Cr.cpk,
  Mn: ATOMIC_DATA.Mn.cpk,
  Fe: ATOMIC_DATA.Fe.cpk,
  Cu: ATOMIC_DATA.Cu.cpk,
  Zn: ATOMIC_DATA.Zn.cpk,
  Br: ATOMIC_DATA.Br.cpk,
  Ag: ATOMIC_DATA.Ag.cpk,
  I: ATOMIC_DATA.I.cpk,
  Ba: ATOMIC_DATA.Ba.cpk,
  Pb: ATOMIC_DATA.Pb.cpk,
}

export type CpkSymbol = keyof typeof CPK

/** Ковалентные радиусы, Å (Cordero 2008 — см. chemistry/data/atomicData.ts). */
export const COVALENT_RADIUS_A = {
  H: covA('H'),
  C: covA('C'),
  N: covA('N'),
  O: covA('O'),
  F: covA('F'),
  Na: covA('Na'),
  Mg: covA('Mg'),
  Al: covA('Al'),
  Si: covA('Si'),
  P: covA('P'),
  S: covA('S'),
  Cl: covA('Cl'),
  K: covA('K'),
  Ca: covA('Ca'),
  V: covA('V'),
  Cr: covA('Cr'),
  Mn: covA('Mn'),
  Fe: covA('Fe'),
  Cu: covA('Cu'),
  Zn: covA('Zn'),
  Br: covA('Br'),
  Ag: covA('Ag'),
  I: covA('I'),
  Ba: covA('Ba'),
  Pb: covA('Pb'),
}

/** Металлические радиусы (КЧ 12), Å — атом в металлической решётке, а не «шарик». */
export const METALLIC_RADIUS_A = {
  Na: metA('Na'),
  Mg: metA('Mg'),
  Al: metA('Al'),
  K: metA('K'),
  Ca: metA('Ca'),
  V: metA('V'),
  Cr: metA('Cr'),
  Mn: metA('Mn'),
  Fe: metA('Fe'),
  Cu: metA('Cu'),
  Zn: metA('Zn'),
  Ag: metA('Ag'),
  Ba: metA('Ba'),
  Pb: metA('Pb'),
}

/**
 * Ионные радиусы, Å (Shannon 1976, КЧ 6). Радиус при другом КЧ — radiusForSpecies(el, q, { cn }).
 * Катион МЕНЬШЕ своего атома, анион БОЛЬШЕ: Na⁺ 1.02 Å против Cl⁻ 1.81 Å —
 * на экране хлорид-ион обязан выглядеть примерно в 1.8 раза крупнее.
 */
export const IONIC_RADIUS_A = {
  'H-': ionA('H', -1),
  'N3-': ionA('N', -3),
  'O2-': ionA('O', -2),
  'F-': ionA('F', -1),
  'Na+': ionA('Na', 1),
  'Mg2+': ionA('Mg', 2),
  'Al3+': ionA('Al', 3),
  'S2-': ionA('S', -2),
  'Cl-': ionA('Cl', -1),
  'K+': ionA('K', 1),
  'Ca2+': ionA('Ca', 2),
  'V5+': ionA('V', 5),
  'Cr3+': ionA('Cr', 3),
  'Mn2+': ionA('Mn', 2),
  'Fe2+': ionA('Fe', 2),
  'Fe3+': ionA('Fe', 3),
  'Cu2+': ionA('Cu', 2),
  'Zn2+': ionA('Zn', 2),
  'Br-': ionA('Br', -1),
  'Ag+': ionA('Ag', 1),
  'I-': ionA('I', -1),
  'Ba2+': ionA('Ba', 2),
  'Pb2+': ionA('Pb', 2),
}

/**
 * Экранный радиус сферы атома. Ковалентный радиус даёт слишком плотные
 * «слипшиеся» шары, поэтому берём его долю — стандартный приём ball-and-stick.
 */
export function atomRadius(symbol: CpkSymbol, scale = 0.72): number {
  return ang(COVALENT_RADIUS_A[symbol]) * scale
}

/**
 * Радиус частицы в мировых единицах сцены с честной физикой размера:
 * катион сжимается, анион раздувается, нейтральный металл берёт металлический радиус.
 * Именно эта функция обязана строить кадры ионных сцен.
 */
export function sceneRadius(symbol: ElementSymbol, charge = 0, scale = 0.72, opts?: SpeciesRadiusOpts): number {
  return ang(pmToAngstrom(radiusForSpeciesPm(symbol, charge, opts))) * scale
}

/** Радиус частицы в ПИКОМЕТРАХ (переэкспорт научного ядра — для подписей и тестов). */
export function radiusForSpecies(symbol: ElementSymbol, charge = 0, opts?: SpeciesRadiusOpts): number {
  return radiusForSpeciesPm(symbol, charge, opts)
}

/** Экспериментальные длины связей, Å (см. chemistry/data/bondData.ts). */
export const BOND_LENGTH_A = {
  /** Cl–O в радикале ClO₂ */
  ClO_radical: pmToAngstrom(bondLengthPm('Cl-O(ClO2)')),
  /** Cl–O в ионе хлорита ClO₂⁻ (чуть длиннее — меньший порядок связи) */
  ClO_chlorite: pmToAngstrom(bondLengthPm('Cl-O')),
  /** Cl–Cl в молекуле хлора */
  ClCl: pmToAngstrom(bondLengthPm('Cl-Cl')),
  /** Na–Cl в газовой ионной паре */
  NaCl: pmToAngstrom(bondLengthPm('Na-Cl')),
  /** C–H в метане */
  CH: pmToAngstrom(bondLengthPm('C-H')),
  /** O=O в молекулярном кислороде */
  OO: pmToAngstrom(bondLengthPm('O=O')),
  /** C=O в CO₂ */
  CO: pmToAngstrom(bondLengthPm('C=O(CO2)')),
  /** O–H в воде */
  OH: pmToAngstrom(bondLengthPm('O-H')),
  /** H–H в молекулярном водороде */
  HH: pmToAngstrom(bondLengthPm('H-H')),
  /** H–Cl в хлороводороде */
  HCl: pmToAngstrom(bondLengthPm('H-Cl')),
  /** N≡N в молекулярном азоте */
  NN: pmToAngstrom(bondLengthPm('N#N')),
  /** N–H в аммиаке */
  NH: pmToAngstrom(bondLengthPm('N-H')),
  /** S=O в SO₂ */
  SO: pmToAngstrom(bondLengthPm('S=O')),
  /** Zn–Cl в газовой молекуле ZnCl₂ */
  ZnCl: pmToAngstrom(bondLengthPm('Zn-Cl')),
  /** Fe–S в троилите */
  FeS: pmToAngstrom(bondLengthPm('Fe-S')),
  /** Zn–S в сфалерите */
  ZnS: pmToAngstrom(bondLengthPm('Zn-S')),
  // ── этап 11: десять сцен (числа — только из ядра) ──
  /** S–O в SO₃ (г), D₃h */
  SO3: pmToAngstrom(bondLengthPm('S=O(SO3)')),
  /** Si–O в α-кварце (среднее) */
  SiO: pmToAngstrom(bondLengthPm('Si-O')),
  /** Si–Si в кристаллическом кремнии */
  SiSi: pmToAngstrom(bondLengthPm('Si-Si')),
  /** Pb–O в глёте */
  PbO: pmToAngstrom(bondLengthPm('Pb-O')),
  /** O–O в H₂O₂ (r_0) */
  OO_H2O2: pmToAngstrom(bondLengthPm('O-O')),
  /** O–H в H₂O₂ (r_0) */
  OH_H2O2: pmToAngstrom(bondLengthPm('O-H(H2O2)')),
  /** O–O в пероксид-ионе O₂²⁻ */
  OO_peroxide: pmToAngstrom(bondLengthPm('O-O(O2 2-)')),
  /** Mn=O концевая в Mn₂O₇ */
  MnO_term: pmToAngstrom(bondLengthPm('Mn-O(term)')),
  /** Mn–O мостиковая в Mn₂O₇ */
  MnO_bridge: pmToAngstrom(bondLengthPm('Mn-O(bridge)')),
  /** Mn–O в MnO₄⁻ */
  MnO4: pmToAngstrom(bondLengthPm('Mn-O(MnO4)')),
  /** Cl=O концевая в Cl₂O₇ (г) */
  ClO_term: pmToAngstrom(bondLengthPm('Cl-O(term)')),
  /** Cl–O мостиковая в Cl₂O₇ (г) */
  ClO_bridge: pmToAngstrom(bondLengthPm('Cl-O(bridge)')),
}

/** Валентные углы, градусы (эксперимент / VSEPR). */
export const BOND_ANGLE_DEG = {
  /** O–Cl–O в радикале ClO₂ */
  clo2: bondAngleDeg('chlorineDioxide'),
  /** O–Cl–O в ионе хлорита ClO₂⁻ */
  chlorite: bondAngleDeg('chlorite'),
  /** H–O–H в воде */
  water: bondAngleDeg('water'),
  /** H–N–H в аммиаке */
  ammonia: bondAngleDeg('ammonia'),
  /** O–S–O в SO₂ */
  sulfurDioxide: bondAngleDeg('sulfurDioxide'),
  /** тетраэдр (метан) */
  tetrahedral: bondAngleDeg('tetrahedral'),
  /** тригональная плоская */
  trigonalPlanar: bondAngleDeg('trigonalPlanar'),
  /** линейная молекула (CO₂) */
  linear: bondAngleDeg('linear'),
  // ── этап 11 ──
  /** O–S–O в SO₃ (D₃h) */
  sulfurTrioxide: bondAngleDeg('sulfurTrioxide'),
  /** O–O–H в H₂O₂ (r_0) */
  h2o2OOH: bondAngleDeg('hydrogenPeroxideOOH'),
  /** Si–O–Si в α-кварце */
  quartzSiOSi: bondAngleDeg('quartzSiOSi'),
  /** O–Si–O в α-кварце */
  quartzOSiO: bondAngleDeg('quartzOSiO'),
  /** Mn–O–Mn в Mn₂O₇ */
  mn2o7MnOMn: bondAngleDeg('mn2o7MnOMn'),
  /** Cl–O–Cl в Cl₂O₇ (г) */
  cl2o7ClOCl: bondAngleDeg('cl2o7ClOCl'),
  /** O–Cl–O в Cl₂O₇ (г) */
  cl2o7OClO: bondAngleDeg('cl2o7OClO'),
}

/** Длина связи частицы-реагента (H₂SO₄, HClO₄, P₄O₁₀, SO₄²⁻, S₃O₉, O₂²⁻, MnO₄⁻), Å — из ядра. */
export function reagentBondA(key: ReagentGeometryKey, bond: string): number {
  return pmToAngstrom(reagentBondPm(key, bond))
}

/** Валентный угол частицы-реагента, градусы — из ядра. */
export function reagentAngle(key: ReagentGeometryKey, angle: string): number {
  return reagentAngleDeg(key, angle)
}
