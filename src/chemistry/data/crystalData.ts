/**
 * ATOMLAB — кристаллические структуры: пространственная группа, тип решётки,
 * параметры ячейки, расстояние катион–анион, координационные числа, Z и плотность.
 *
 * ИСТОЧНИКИ (по таблице, не по значению):
 *  • Пространственные группы (Германа — Могена) и параметры ячеек — R. W. G. Wyckoff,
 *    «Crystal Structures», vols. 1–2; ICSD/COD (Crystallography Open Database).
 *  • Плотности — CRC Handbook of Chemistry and Physics, 97th ed. (рентгеновская плотность).
 *  • Параметры металлов при 298 K — CRC Handbook, «Crystal structures of the elements».
 *
 * ПРАВИЛО ДЛЯ СЦЕН: в ионной решётке заряды чередуются, одноимённые ионы НИКОГДА не соседи.
 * Поэтому у каждой структуры хранится `alternates: true` для ионных и шаг подрешётки
 * (cationAnionPm) — сцена строит ячейку по этому шагу, а не «на глаз».
 */

/** Тип решётки по-русски, как в школьном учебнике. */
export type LatticeType =
  | 'ГЦК' // гранецентрированная кубическая
  | 'ОЦК' // объёмноцентрированная кубическая
  | 'ГПУ' // гексагональная плотнейшая упаковка
  | 'примитивная кубическая'
  | 'тетрагональная'
  | 'тригональная (ромбоэдрическая)'
  | 'гексагональная'

export type CrystalDatum = {
  readonly id: string
  /** Формула, как её пишут на доске. */
  readonly formula: string
  readonly nameRu: string
  /** Структурный тип (NaCl, CsCl, сфалерит, вюрцит, NiAs, кальцит, алмаз…). */
  readonly structureType: string
  /** Пространственная группа в символике Германа — Могена. */
  readonly spaceGroup: string
  /** Номер группы в International Tables (1…230). */
  readonly spaceGroupNo: number
  readonly latticeType: LatticeType
  /** Параметры ячейки, пм. У кубических задан только a. */
  readonly cellPm: { readonly a: number; readonly b?: number; readonly c?: number }
  /** Углы ячейки, градусы (по умолчанию 90/90/90). */
  readonly cellAnglesDeg?: { readonly alpha: number; readonly beta: number; readonly gamma: number }
  /** Кратчайшее расстояние катион–анион (или ближайших соседей в металле/ковалентном кристалле), пм. */
  readonly cationAnionPm: number
  /** Координационные числа: подпись → КЧ. */
  readonly coordination: Readonly<Record<string, number>>
  /** Число формульных единиц в ячейке. */
  readonly z: number
  /** Плотность, г/см³ (298 K). */
  readonly densityGCm3: number
  /** true — ионная решётка с чередованием знаков заряда. */
  readonly ionic: boolean
  /** Температура плавления при 1 атм, °C (CRC Handbook, 97th ed.). */
  readonly meltingC?: number
  readonly note?: string
}

export const CRYSTAL_DATA: Readonly<Record<string, CrystalDatum>> = {
  nacl: {
    id: 'nacl',
    formula: 'NaCl',
    nameRu: 'хлорид натрия (галит)',
    structureType: 'NaCl (каменная соль)',
    spaceGroup: 'Fm-3m',
    spaceGroupNo: 225,
    latticeType: 'ГЦК',
    cellPm: { a: 564.02 },
    cationAnionPm: 282.01,
    coordination: { 'Na⁺': 6, 'Cl⁻': 6 },
    z: 4,
    densityGCm3: 2.165,
    ionic: true,
    meltingC: 801,
    note: 'две ГЦК-подрешётки, сдвинутые на ½a: каждый Na⁺ в октаэдре из шести Cl⁻ и наоборот. Сумма радиусов 102 + 181 = 283 пм ≈ a/2.',
  },
  mgo: {
    id: 'mgo',
    formula: 'MgO',
    nameRu: 'оксид магния (периклаз)',
    structureType: 'NaCl (каменная соль)',
    spaceGroup: 'Fm-3m',
    spaceGroupNo: 225,
    latticeType: 'ГЦК',
    cellPm: { a: 421.12 },
    cationAnionPm: 210.56,
    coordination: { 'Mg²⁺': 6, 'O²⁻': 6 },
    z: 4,
    densityGCm3: 3.58,
    ionic: true,
    meltingC: 2852,
    note: 'та же геометрия, что у NaCl, но заряды ±2 и ячейка на четверть меньше — отсюда энергия решётки почти в пять раз больше.',
  },
  cao: {
    id: 'cao',
    formula: 'CaO',
    nameRu: 'оксид кальция (негашёная известь)',
    structureType: 'NaCl (каменная соль)',
    spaceGroup: 'Fm-3m',
    spaceGroupNo: 225,
    latticeType: 'ГЦК',
    cellPm: { a: 481.08 },
    cationAnionPm: 240.54,
    coordination: { 'Ca²⁺': 6, 'O²⁻': 6 },
    z: 4,
    densityGCm3: 3.34,
    ionic: true,
  },
  calcite: {
    id: 'calcite',
    formula: 'CaCO₃',
    nameRu: 'карбонат кальция (кальцит)',
    structureType: 'кальцит',
    spaceGroup: 'R-3c',
    spaceGroupNo: 167,
    latticeType: 'тригональная (ромбоэдрическая)',
    cellPm: { a: 499.0, c: 1706.1 },
    cellAnglesDeg: { alpha: 90, beta: 90, gamma: 120 },
    cationAnionPm: 235.9,
    coordination: { 'Ca²⁺ (по O)': 6, 'C (по O)': 3, 'O (по Ca)': 2 },
    z: 6,
    densityGCm3: 2.711,
    ionic: true,
    note: 'гексагональная установка ячейки; структура NaCl, «растянутая» вдоль оси 3 с плоскими группами CO₃²⁻ вместо шаровых анионов. C–O внутри группы 128.4 пм.',
  },
  troilite: {
    id: 'troilite',
    formula: 'FeS',
    nameRu: 'сульфид железа(II) (троилит)',
    structureType: 'сверхструктура NiAs',
    spaceGroup: 'P-62c',
    spaceGroupNo: 190,
    latticeType: 'гексагональная',
    cellPm: { a: 596.3, c: 1175.4 },
    cellAnglesDeg: { alpha: 90, beta: 90, gamma: 120 },
    cationAnionPm: 244.5,
    coordination: { 'Fe²⁺ (октаэдр S)': 6, 'S²⁻ (тригональная призма Fe)': 6 },
    z: 12,
    densityGCm3: 4.61,
    ionic: true,
    note: 'связь заметно ковалентная: Fe и S близки по электроотрицательности (1.83 и 2.58), поэтому решётка не чисто ионная.',
  },
  zncl2: {
    id: 'zncl2',
    formula: 'ZnCl₂',
    nameRu: 'хлорид цинка (α-форма)',
    structureType: 'α-ZnCl₂ (тетраэдрический каркас)',
    spaceGroup: 'I-42d',
    spaceGroupNo: 122,
    latticeType: 'тетрагональная',
    cellPm: { a: 539.8, c: 1033 },
    cationAnionPm: 229,
    coordination: { 'Zn²⁺': 4, 'Cl⁻': 2 },
    z: 4,
    densityGCm3: 2.907,
    ionic: false,
    note: 'ZnCl₂ полиморфен (α-тетрагональная, β, γ, δ); связь сильно поляризована и ближе к ковалентной — отсюда низкая т. пл. 290 °C и тетраэдры ZnCl₄, а не октаэдры. Параметры ячейки α-формы в литературе разнятся.',
  },
  sphalerite: {
    id: 'sphalerite',
    formula: 'ZnS',
    nameRu: 'сульфид цинка (сфалерит, цинковая обманка)',
    structureType: 'сфалерит',
    spaceGroup: 'F-43m',
    spaceGroupNo: 216,
    latticeType: 'ГЦК',
    cellPm: { a: 540.93 },
    cationAnionPm: 234.2,
    coordination: { 'Zn²⁺': 4, 'S²⁻': 4 },
    z: 4,
    densityGCm3: 4.09,
    ionic: true,
    note: 'ГЦК-упаковка S²⁻, Zn²⁺ занимает половину тетраэдрических пустот (та же топология, что у алмаза).',
  },
  wurtzite: {
    id: 'wurtzite',
    formula: 'ZnS',
    nameRu: 'сульфид цинка (вюрцит)',
    structureType: 'вюрцит',
    spaceGroup: 'P6₃mc',
    spaceGroupNo: 186,
    latticeType: 'ГПУ',
    cellPm: { a: 382.3, c: 626.1 },
    cellAnglesDeg: { alpha: 90, beta: 90, gamma: 120 },
    cationAnionPm: 234.2,
    coordination: { 'Zn²⁺': 4, 'S²⁻': 4 },
    z: 2,
    densityGCm3: 4.087,
    ionic: true,
    note: 'высокотемпературная форма ZnS: та же тетраэдрия, но упаковка ГПУ вместо ГЦК.',
  },
  cscl: {
    id: 'cscl',
    formula: 'CsCl',
    nameRu: 'хлорид цезия',
    structureType: 'CsCl',
    spaceGroup: 'Pm-3m',
    spaceGroupNo: 221,
    latticeType: 'примитивная кубическая',
    cellPm: { a: 411.3 },
    cationAnionPm: 356.2,
    coordination: { 'Cs⁺': 8, 'Cl⁻': 8 },
    z: 1,
    densityGCm3: 3.99,
    ionic: true,
    note: 'НЕ ОЦК-решётка: в центре куба другой сорт ионов, поэтому группа примитивная Pm-3m. Cs⁺ большой (167 пм), отношение радиусов 0.92 → КЧ 8. Cs⁺···Cl⁻ = a·√3/2.',
  },
  diamond: {
    id: 'diamond',
    formula: 'C',
    nameRu: 'алмаз',
    structureType: 'алмаз',
    spaceGroup: 'Fd-3m',
    spaceGroupNo: 227,
    latticeType: 'ГЦК',
    cellPm: { a: 356.68 },
    cationAnionPm: 154.4,
    coordination: { C: 4 },
    z: 8,
    densityGCm3: 3.515,
    ionic: false,
    note: 'атомный (ковалентный) кристалл: каждый C в тетраэдре из четырёх C, угол 109.47°.',
  },
  graphite: {
    id: 'graphite',
    formula: 'C',
    nameRu: 'графит (стандартное состояние углерода)',
    structureType: 'графит 2H',
    spaceGroup: 'P6₃/mmc',
    spaceGroupNo: 194,
    latticeType: 'гексагональная',
    cellPm: { a: 246.12, c: 670.9 },
    cellAnglesDeg: { alpha: 90, beta: 90, gamma: 120 },
    cationAnionPm: 141.8,
    coordination: { 'C (в слое)': 3 },
    z: 4,
    densityGCm3: 2.266,
    ionic: false,
    note: 'слои связаны только ван-дер-ваальсовыми силами, межслоевое расстояние 335.4 пм = c/2. ΔH°f графита = 0 по определению, алмаза +1.9 кДж/моль.',
  },
  na_metal: {
    id: 'na_metal',
    formula: 'Na',
    nameRu: 'натрий (металл)',
    structureType: 'W (вольфрам)',
    spaceGroup: 'Im-3m',
    spaceGroupNo: 229,
    latticeType: 'ОЦК',
    cellPm: { a: 429.06 },
    cationAnionPm: 371.6,
    coordination: { Na: 8 },
    z: 2,
    densityGCm3: 0.968,
    ionic: false,
    note: 'КЧ 8 на расстоянии a·√3/2 = 371.6 пм плюс ещё 6 соседей на 429.1 пм. Металлический радиус (КЧ 12) 186 пм.',
  },
  mg_metal: {
    id: 'mg_metal',
    formula: 'Mg',
    nameRu: 'магний (металл)',
    structureType: 'Mg',
    spaceGroup: 'P6₃/mmc',
    spaceGroupNo: 194,
    latticeType: 'ГПУ',
    cellPm: { a: 320.94, c: 521.08 },
    cellAnglesDeg: { alpha: 90, beta: 90, gamma: 120 },
    cationAnionPm: 320.0,
    coordination: { Mg: 12 },
    z: 2,
    densityGCm3: 1.738,
    ionic: false,
    note: 'c/a = 1.624, почти идеальная плотнейшая упаковка (1.633).',
  },
  fe_metal: {
    id: 'fe_metal',
    formula: 'Fe',
    nameRu: 'железо α (феррит)',
    structureType: 'W (вольфрам)',
    spaceGroup: 'Im-3m',
    spaceGroupNo: 229,
    latticeType: 'ОЦК',
    cellPm: { a: 286.65 },
    cationAnionPm: 248.2,
    coordination: { Fe: 8 },
    z: 2,
    densityGCm3: 7.874,
    ionic: false,
    note: 'выше 912 °C переходит в γ-Fe (аустенит, ГЦК, a = 364.7 пм, КЧ 12).',
  },
  zn_metal: {
    id: 'zn_metal',
    formula: 'Zn',
    nameRu: 'цинк (металл)',
    structureType: 'Mg (искажённая)',
    spaceGroup: 'P6₃/mmc',
    spaceGroupNo: 194,
    latticeType: 'ГПУ',
    cellPm: { a: 266.49, c: 494.68 },
    cellAnglesDeg: { alpha: 90, beta: 90, gamma: 120 },
    cationAnionPm: 266.5,
    coordination: { Zn: 6 },
    z: 2,
    densityGCm3: 7.134,
    ionic: false,
    note: 'c/a = 1.856 — упаковка сильно вытянута, поэтому 6 близких соседей в слое (266.5 пм) и 6 дальних (290.7 пм).',
  },
  cu_metal: {
    id: 'cu_metal',
    formula: 'Cu',
    nameRu: 'медь (металл)',
    structureType: 'Cu',
    spaceGroup: 'Fm-3m',
    spaceGroupNo: 225,
    latticeType: 'ГЦК',
    cellPm: { a: 361.49 },
    cationAnionPm: 255.6,
    coordination: { Cu: 12 },
    z: 4,
    densityGCm3: 8.96,
    ionic: false,
    note: 'кубическая плотнейшая упаковка, ближайший сосед a/√2.',
  },
}

export const CRYSTAL_IDS = Object.keys(CRYSTAL_DATA)

export function getCrystal(id: string): CrystalDatum | null {
  return CRYSTAL_DATA[id] ?? null
}

/** Параметр ячейки a в ангстремах — готово для three.js. */
export function cellAngstrom(id: string): number | null {
  const c = CRYSTAL_DATA[id]
  return c ? c.cellPm.a / 100 : null
}

/**
 * Проверка «шахматного» правила ионной решётки: индекс узла (i+j+k) чётный → катион,
 * нечётный → анион. Сцены строят решётку только через этот предикат,
 * поэтому одноимённые ионы физически не могут оказаться соседями.
 */
export function isCationSite(i: number, j: number, k: number): boolean {
  return (((i + j + k) % 2) + 2) % 2 === 0
}
