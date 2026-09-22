/**
 * ATOMLAB — кристаллические структуры: пространственная группа, тип решётки,
 * параметры ячейки, расстояние катион–анион, координационные числа, Z и плотность.
 *
 * ИСТОЧНИКИ (по таблице, не по значению):
 *  • Пространственные группы (Германа — Могена) и параметры ячеек — R. W. G. Wyckoff,
 *    «Crystal Structures», vols. 1–2; ICSD/COD (Crystallography Open Database).
 *  • Плотности — РЕНТГЕНОВСКИЕ: ρ = Z·M / (N_A·V), где V посчитан по параметрам ячейки из этой же
 *    записи (CRC Handbook, 97th ed.; сходимость проверяет скрипт test-chem-data). Там, где справочная
 *    «макроскопическая» плотность другая (троилит, α-ZnCl₂, медь), она вынесена в `note`.
 *    Сходимость ρ с ячейкой тест держит в пределах 0.3 % — этого хватает, чтобы поймать
 *    чужой параметр ячейки или подмену рентгеновской плотности макроскопической.
 *  • Параметры металлов при 298 K — CRC Handbook, «Crystal structures of the elements».
 *
 * ПРАВИЛО ДЛЯ СЦЕН: в ионной решётке заряды чередуются, одноимённые ионы НИКОГДА не соседи.
 * Поэтому у каждой структуры хранится `alternates: true` для ионных и шаг подрешётки
 * (cationAnionPm) — сцена строит ячейку по этому шагу, а не «на глаз».
 */

import type { ElementSymbol } from './atomicData'

/** Тип решётки по-русски, как в школьном учебнике. */
export type LatticeType =
  | 'ГЦК' // гранецентрированная кубическая
  | 'ОЦК' // объёмноцентрированная кубическая
  | 'ГПУ' // гексагональная плотнейшая упаковка
  | 'примитивная кубическая'
  | 'тетрагональная'
  | 'тригональная (ромбоэдрическая)'
  | 'гексагональная'
  | 'ромбическая' // орторомбическая (массикот, Pbcm)
  | 'кубическая (молекулярная)' // молекулы в узлах кубической ячейки (сухой лёд, Pa-3)
  | 'алмазоподобная' // Fd-3m: ГЦК + вторая ГЦК со сдвигом на ¼ диагонали (Si, алмаз)

/**
 * Атом базиса конвенциональной ячейки. `frac` — дробные координаты в [0, 1),
 * `charge` — формальный заряд иона (только у ионных решёток; у ковалентных каркасов не задан),
 * `wyckoff` — позиция Уайкоффа исходной асимметричной части.
 */
export type BasisSite = {
  readonly el: ElementSymbol
  readonly charge?: number
  readonly frac: readonly [number, number, number]
  readonly wyckoff?: string
}

/** Установка ячейки: для ромбоэдрических групп — гексагональная установка (R-3c: a, c, γ = 120°). */
export type CellSetting = 'cubic' | 'hexagonal' | 'tetragonal' | 'orthorhombic' | 'rhombohedral-hex'

export type CrystalDatum = {
  readonly id: string
  /**
   * ПОЛНОЕ содержимое конвенциональной ячейки: все атомы всех Z формульных единиц, уже размноженные
   * операциями симметрии группы (из CIF-источника), дроби в [0, 1). Генератор решётки строит фрагмент
   * трансляциями этого набора; test-crystal-basis сверяет состав, плотность, расстояния и КЧ.
   */
  readonly basis?: readonly BasisSite[]
  /** Элементы, которых нет в basis намеренно (лёд Ih: H разупорядочены). Масса формулы их учитывает. */
  readonly basisOmits?: readonly ElementSymbol[]
  readonly setting?: CellSetting
  /** Температура, к которой относятся ячейка и плотность, если это не 298 K (лёд, сухой лёд). */
  readonly temperatureK?: number
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
  /** Плотность, г/см³ — РЕНТГЕНОВСКАЯ при 298 K или при temperatureK. */
  readonly densityGCm3: number
  /**
   * true — решётку строят ИОНЫ с чередованием знаков заряда (сцена рисует её по шахматному правилу).
   * Это флаг геометрии, а не мера ионности связи: у троилита он true, хотя связь Fe–S ионно-ковалентная.
   */
  readonly ionic: boolean
  /** Температура плавления при 1 атм, °C (CRC Handbook, 97th ed.). */
  readonly meltingC?: number
  /**
   * Температура улетучивания-диссоциации оксида при 1 атм, K (критерий Глассмана: I. Glassman,
   * R. A. Yetter, «Combustion», 4th ed., 2008, табл. 9.x): выше неё тепло реакции уходит на
   * MO(ж) → M(г) + O(г), поэтому это ПОТОЛОК адиабатической температуры пламени металла.
   */
  readonly volatilizationK?: number
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
    setting: 'cubic',
    // Fm-3m: Na 4a (0,0,0), Cl 4b (½,½,½) + ГЦК-трансляции (Wyckoff, Crystal Structures vol. 1)
    basis: [
      { el: 'Na', charge: 1, frac: [0, 0, 0], wyckoff: '4a' },
      { el: 'Na', charge: 1, frac: [0, 0.5, 0.5], wyckoff: '4a' },
      { el: 'Na', charge: 1, frac: [0.5, 0, 0.5], wyckoff: '4a' },
      { el: 'Na', charge: 1, frac: [0.5, 0.5, 0], wyckoff: '4a' },
      { el: 'Cl', charge: -1, frac: [0.5, 0.5, 0.5], wyckoff: '4b' },
      { el: 'Cl', charge: -1, frac: [0.5, 0, 0], wyckoff: '4b' },
      { el: 'Cl', charge: -1, frac: [0, 0.5, 0], wyckoff: '4b' },
      { el: 'Cl', charge: -1, frac: [0, 0, 0.5], wyckoff: '4b' },
    ],
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
    // NIST-JANAF: T_пл = 3105 K = 2832 °C → ≈ 2830; в справочниках 2825–2852 °C (CRC 97th — 2825, старое 2852)
    meltingC: 2830,
    // Glassman & Yetter 2008: MgO(ж) → Mg(г) + O(г) при ≈ 3430 K — потолок пламени Mg + O₂
    volatilizationK: 3430,
    setting: 'cubic',
    // Fm-3m, тип NaCl: Mg 4a, O 4b
    basis: [
      { el: 'Mg', charge: 2, frac: [0, 0, 0], wyckoff: '4a' },
      { el: 'Mg', charge: 2, frac: [0, 0.5, 0.5], wyckoff: '4a' },
      { el: 'Mg', charge: 2, frac: [0.5, 0, 0.5], wyckoff: '4a' },
      { el: 'Mg', charge: 2, frac: [0.5, 0.5, 0], wyckoff: '4a' },
      { el: 'O', charge: -2, frac: [0.5, 0.5, 0.5], wyckoff: '4b' },
      { el: 'O', charge: -2, frac: [0.5, 0, 0], wyckoff: '4b' },
      { el: 'O', charge: -2, frac: [0, 0.5, 0], wyckoff: '4b' },
      { el: 'O', charge: -2, frac: [0, 0, 0.5], wyckoff: '4b' },
    ],
    note:
      'та же геометрия, что у NaCl, но заряды ±2 и ячейка на четверть меньше — отсюда энергия решётки почти в пять раз больше. ' +
      'T_пл ≈ 2830 °C (3105 K, NIST-JANAF; в справочниках 2825–2852), кипение с разложением ≈ 3600 °C. ' +
      'Потолок температуры пламени магния задаёт не плавление, а улетучивание-диссоциация оксида ≈ 3430 K (Глассман).',
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
    meltingC: 2572,
    note: 'та же структура каменной соли, что у MgO, но Ca²⁺ крупнее (100 пм против 72 пм у Mg²⁺). Плотность заряда ниже → решётка −3400 вместо −3789 кДж/моль → плавится при 2572 °C, а не при ≈ 2830 °C, как MgO.',
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
    densityGCm3: 4.84,
    ionic: true,
    note: 'связь заметно ковалентная: Fe и S близки по электроотрицательности (1.83 и 2.58), поэтому решётка не чисто ионная; флаг ionic здесь означает чередование подрешёток Fe/S, а не стопроцентную ионность. Плотность 4.84 г/см³ — рентгеновская, посчитанная по этой же ячейке (V = (√3/2)·a²·c); измеренная у природного троилита 4.67…4.79 г/см³.',
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
    densityGCm3: 3.01,
    ionic: false,
    note: 'ZnCl₂ полиморфен (α-тетрагональная, β, γ, δ); связь сильно поляризована и ближе к ковалентной — отсюда низкая т. пл. 290 °C и тетраэдры ZnCl₄, а не октаэдры. Параметры ячейки α-формы в литературе разнятся. Плотность 3.01 г/см³ — рентгеновская для α-формы (V = a²c, Z = 4); справочная плотность технического ZnCl₂ в CRC — 2.907 г/см³.',
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
    cellPm: { a: 412.3 },
    cationAnionPm: 357.1,
    coordination: { 'Cs⁺': 8, 'Cl⁻': 8 },
    z: 1,
    densityGCm3: 3.99,
    ionic: true,
    note: 'НЕ ОЦК-решётка: в центре куба другой сорт ионов, поэтому группа примитивная Pm-3m. Cs⁺ большой (167 пм), отношение радиусов 0.92 → КЧ 8. Cs⁺···Cl⁻ = a·√3/2 = 412.3·0.86603 = 357.1 пм; рентгеновская ρ = M/(N_A·a³) = 3.989 г/см³ при Z = 1.',
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
    cationAnionPm: 142.1,
    coordination: { 'C (в слое)': 3 },
    z: 4,
    densityGCm3: 2.266,
    ionic: false,
    setting: 'hexagonal',
    // P6₃/mmc: C1 2b (0,0,¼), C2 2c (⅓,⅔,¼) — слои на z = ¼ и ¾, укладка AB (Wyckoff; Trucano & Chen 1975)
    basis: [
      { el: 'C', frac: [0, 0, 0.25], wyckoff: '2b' },
      { el: 'C', frac: [0, 0, 0.75], wyckoff: '2b' },
      { el: 'C', frac: [1 / 3, 2 / 3, 0.25], wyckoff: '2c' },
      { el: 'C', frac: [2 / 3, 1 / 3, 0.75], wyckoff: '2c' },
    ],
    note: 'слои связаны только ван-дер-ваальсовыми силами, межслоевое расстояние 335.4 пм = c/2. Кратчайшее C–C в слое строго связано с параметром ячейки: a/√3 = 246.12/1.73205 = 142.1 пм. ΔH°f графита = 0 по определению, алмаза +1.9 кДж/моль.',
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
    setting: 'cubic',
    // Im-3m: 2a (0,0,0) + I-трансляция (½,½,½)
    basis: [
      { el: 'Na', frac: [0, 0, 0], wyckoff: '2a' },
      { el: 'Na', frac: [0.5, 0.5, 0.5], wyckoff: '2a' },
    ],
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
    // кратчайшее Mg–Mg — между слоями: √(a²/3 + c²/4) = 319.7 пм; в слое 6 соседей на a = 320.9 пм
    cationAnionPm: 319.7,
    coordination: { Mg: 12 },
    z: 2,
    densityGCm3: 1.738,
    ionic: false,
    setting: 'hexagonal',
    // P6₃/mmc: 2c (⅓,⅔,¼), (⅔,⅓,¾)
    basis: [
      { el: 'Mg', frac: [1 / 3, 2 / 3, 0.25], wyckoff: '2c' },
      { el: 'Mg', frac: [2 / 3, 1 / 3, 0.75], wyckoff: '2c' },
    ],
    note: 'c/a = 1.624, почти идеальная плотнейшая упаковка (1.633): 6 соседей между слоями на 319.7 пм и 6 в слое на 320.9 пм — вместе КЧ 12.',
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
    note: 'c/a = 1.856 — упаковка сильно вытянута, поэтому 6 близких соседей в слое (266.5 пм) и 6 дальних (291.3 пм = √(a²/3 + c²/4) — соседи из соседнего слоя).',
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
    densityGCm3: 8.935,
    ionic: false,
    note: 'кубическая плотнейшая упаковка, ближайший сосед a/√2. Плотность 8.935 г/см³ — рентгеновская по этой же ячейке (a = 361.49 пм, Z = 4); справочная макроскопическая в CRC — 8.96 г/см³ (разница 0.3 % — вклад вакансий и границ зёрен).',
  },
  si: {
    id: 'si',
    formula: 'Si',
    nameRu: 'кремний (кристаллический)',
    structureType: 'алмаз',
    spaceGroup: 'Fd-3m',
    spaceGroupNo: 227,
    latticeType: 'алмазоподобная',
    // CRC 97th / NIST SRM 640: a = 543.102 пм при 22.5 °C
    cellPm: { a: 543.102 },
    // a·√3/4 = 235.17 пм
    cationAnionPm: 235.2,
    coordination: { Si: 4 },
    z: 8,
    densityGCm3: 2.329,
    ionic: false,
    meltingC: 1414,
    setting: 'cubic',
    // Fd-3m (начало 1): 8a (0,0,0), (¼,¼,¼) + ГЦК-трансляции
    basis: [
      { el: 'Si', frac: [0, 0, 0], wyckoff: '8a' },
      { el: 'Si', frac: [0, 0.5, 0.5], wyckoff: '8a' },
      { el: 'Si', frac: [0.5, 0, 0.5], wyckoff: '8a' },
      { el: 'Si', frac: [0.5, 0.5, 0], wyckoff: '8a' },
      { el: 'Si', frac: [0.25, 0.25, 0.25], wyckoff: '8a' },
      { el: 'Si', frac: [0.25, 0.75, 0.75], wyckoff: '8a' },
      { el: 'Si', frac: [0.75, 0.25, 0.75], wyckoff: '8a' },
      { el: 'Si', frac: [0.75, 0.75, 0.25], wyckoff: '8a' },
    ],
    note: 'атомный кристалл, как алмаз: каждый Si в тетраэдре из четырёх Si на a·√3/4 = 235.2 пм. Ковалентный радиус Кордеро 111 пм ×2 = 222 — связь в кристалле немного длиннее суммы.',
  },
  quartz: {
    id: 'quartz',
    formula: 'SiO₂',
    nameRu: 'α-кварц',
    structureType: 'α-кварц (каркас тетраэдров SiO₄)',
    spaceGroup: 'P3₂21',
    spaceGroupNo: 154,
    latticeType: 'тригональная (ромбоэдрическая)',
    // Levien, Prewitt & Weidner, Am. Mineral. 65 (1980) 920, 1 атм (COD 9000775); в справочниках также 491.3 / 540.5
    cellPm: { a: 491.6, c: 540.54 },
    cellAnglesDeg: { alpha: 90, beta: 90, gamma: 120 },
    // кратчайшее Si–O из базиса: 160.5 ×2 и 161.4 ×2 пм (bondData 'Si-O')
    cationAnionPm: 160.5,
    coordination: { Si: 4, O: 2 },
    z: 3,
    densityGCm3: 2.646,
    ionic: false,
    setting: 'hexagonal',
    // Levien 1980: Si 3a (0.4697, 0, 0), O 6c (0.4135, 0.2669, 0.1191); операции P3₂21 — из того же CIF
    basis: [
      { el: 'Si', frac: [0.4697, 0, 0], wyckoff: '3a' },
      { el: 'Si', frac: [0, 0.4697, 2 / 3], wyckoff: '3a' },
      { el: 'Si', frac: [0.5303, 0.5303, 1 / 3], wyckoff: '3a' },
      { el: 'O', frac: [0.4135, 0.2669, 0.1191], wyckoff: '6c' },
      { el: 'O', frac: [0.2669, 0.4135, 0.54757], wyckoff: '6c' },
      { el: 'O', frac: [0.7331, 0.1466, 0.78577], wyckoff: '6c' },
      { el: 'O', frac: [0.5865, 0.8534, 0.21423], wyckoff: '6c' },
      { el: 'O', frac: [0.8534, 0.5865, 0.45243], wyckoff: '6c' },
      { el: 'O', frac: [0.1466, 0.7331, 0.8809], wyckoff: '6c' },
    ],
    note:
      'полярно-ковалентный каркас: каждый Si — в тетраэдре из четырёх O, каждый O — мостик между двумя Si (∠Si–O–Si 143.7°); ' +
      'спиральные цепочки тетраэдров вокруг винтовой оси 3₂ (энантиоморф — P3₁21). Устойчивая форма SiO₂ при 25 °C; ' +
      'выше 573 °C — β-кварц, кристобалит плавится при ≈ 1713 °C. Оксид на самом кремнии — аморфный, не кварц. ' +
      'Плотность 2.646 г/см³ — рентгеновская по этой ячейке (справочная 2.65).',
  },
  litharge: {
    id: 'litharge',
    formula: 'PbO',
    nameRu: 'оксид свинца(II), глёт (α-PbO, красный)',
    structureType: 'глёт (слоистый, PbO₄ — квадратная пирамида)',
    spaceGroup: 'P4/nmm',
    spaceGroupNo: 129,
    latticeType: 'тетрагональная',
    // Wyckoff, Crystal Structures vol. 1 (1963), COD 9008955; Pirovano et al. 2001 — те же a, c и z(Pb)
    cellPm: { a: 397.5, c: 502.3 },
    // Pb–O = √((a/2)² + (z·c)²) = 232.1 пм (bondData 'Pb-O'); в литературе 231.8 ± 0.5
    cationAnionPm: 232.1,
    coordination: { 'Pb²⁺': 4, 'O²⁻': 4 },
    z: 2,
    densityGCm3: 9.34,
    ionic: true,
    meltingC: 888,
    setting: 'tetragonal',
    // P4/nmm (начало 1): O 2a (0,0,0), Pb 2c (0,½,z), z = 0.2385
    basis: [
      { el: 'Pb', charge: 2, frac: [0, 0.5, 0.2385], wyckoff: '2c' },
      { el: 'Pb', charge: 2, frac: [0.5, 0, 0.7615], wyckoff: '2c' },
      { el: 'O', charge: -2, frac: [0, 0, 0], wyckoff: '2a' },
      { el: 'O', charge: -2, frac: [0.5, 0.5, 0], wyckoff: '2a' },
    ],
    note:
      'слой O²⁻ (квадратная сетка) с Pb²⁺ над и под ним: каждый Pb — вершина квадратной пирамиды PbO₄, каждый O — в тетраэдре из четырёх Pb. ' +
      'Слои смотрят друг на друга «пустыми» сторонами Pb (Pb···Pb ≈ 385 пм) — там стереоактивная пара 6s² (школьная схема; ' +
      'современно — смешение Pb 6s/O 2p с примесью Pb 6p, Walsh et al. 2011). Устойчив ниже 489 °C. Связь заметно ковалентная — ' +
      'флаг ionic означает чередование подрешёток, а не стопроцентную ионность.',
  },
  massicot: {
    id: 'massicot',
    formula: 'PbO',
    nameRu: 'оксид свинца(II), массикот (β-PbO, жёлтый)',
    structureType: 'массикот (зигзагообразные цепи PbO₄)',
    spaceGroup: 'Pbcm',
    spaceGroupNo: 57,
    latticeType: 'ромбическая',
    // Hill, Acta Cryst. C41 (1985) 1281, нейтроны, 295 K (COD 9007710); Kay 1961: 589.1 / 548.9 / 477.5
    cellPm: { a: 589.31, b: 549.04, c: 475.28 },
    // кратчайшее Pb–O из базиса; остальные три — 224.9 и 248.1 ×2
    cationAnionPm: 222.1,
    coordination: { 'Pb²⁺': 4, 'O²⁻': 4 },
    z: 4,
    densityGCm3: 9.641,
    ionic: true,
    meltingC: 888,
    setting: 'orthorhombic',
    // Hill 1985: Pb 4d (0.2297, −0.0116, ¼), O 4d (−0.1347, 0.0917, ¼); операции Pbcm — из того же CIF
    basis: [
      { el: 'Pb', charge: 2, frac: [0.2297, 0.9884, 0.25], wyckoff: '4d' },
      { el: 'Pb', charge: 2, frac: [0.2297, 0.5116, 0.75], wyckoff: '4d' },
      { el: 'Pb', charge: 2, frac: [0.7703, 0.4884, 0.25], wyckoff: '4d' },
      { el: 'Pb', charge: 2, frac: [0.7703, 0.0116, 0.75], wyckoff: '4d' },
      { el: 'O', charge: -2, frac: [0.8653, 0.0917, 0.25], wyckoff: '4d' },
      { el: 'O', charge: -2, frac: [0.8653, 0.4083, 0.75], wyckoff: '4d' },
      { el: 'O', charge: -2, frac: [0.1347, 0.5917, 0.25], wyckoff: '4d' },
      { el: 'O', charge: -2, frac: [0.1347, 0.9083, 0.75], wyckoff: '4d' },
    ],
    note:
      'высокотемпературная форма (выше 489 °C), при 25 °C метастабильна. Та же пирамида PbO₄ с парой 6s², но искажённая: ' +
      'Pb–O 222.1, 224.9 и 248.1 ×2 пм; слои гофрированы. Плотность 9.641 г/см³ — рентгеновская по ячейке Hill 1985.',
  },
  pb_metal: {
    id: 'pb_metal',
    formula: 'Pb',
    nameRu: 'свинец (металл)',
    structureType: 'Cu',
    spaceGroup: 'Fm-3m',
    spaceGroupNo: 225,
    latticeType: 'ГЦК',
    // CRC 97th, «Crystal structures of the elements»: a = 495.08 пм (298 K)
    cellPm: { a: 495.08 },
    // a/√2
    cationAnionPm: 350.1,
    coordination: { Pb: 12 },
    z: 4,
    densityGCm3: 11.341,
    ionic: false,
    meltingC: 327.5,
    setting: 'cubic',
    basis: [
      { el: 'Pb', frac: [0, 0, 0], wyckoff: '4a' },
      { el: 'Pb', frac: [0, 0.5, 0.5], wyckoff: '4a' },
      { el: 'Pb', frac: [0.5, 0, 0.5], wyckoff: '4a' },
      { el: 'Pb', frac: [0.5, 0.5, 0], wyckoff: '4a' },
    ],
    note: 'кубическая плотнейшая упаковка, КЧ 12 на a/√2 = 350.1 пм; металлический радиус 175 пм = половина этого расстояния. Рентгеновская ρ 11.341 (справочная 11.34).',
  },
  al_metal: {
    id: 'al_metal',
    formula: 'Al',
    nameRu: 'алюминий (металл)',
    structureType: 'Cu',
    spaceGroup: 'Fm-3m',
    spaceGroupNo: 225,
    latticeType: 'ГЦК',
    // CRC 97th: a = 404.95 пм (298 K)
    cellPm: { a: 404.95 },
    // a/√2
    cationAnionPm: 286.3,
    coordination: { Al: 12 },
    z: 4,
    densityGCm3: 2.699,
    ionic: false,
    meltingC: 660.3,
    setting: 'cubic',
    basis: [
      { el: 'Al', frac: [0, 0, 0], wyckoff: '4a' },
      { el: 'Al', frac: [0, 0.5, 0.5], wyckoff: '4a' },
      { el: 'Al', frac: [0.5, 0, 0.5], wyckoff: '4a' },
      { el: 'Al', frac: [0.5, 0.5, 0], wyckoff: '4a' },
    ],
    note: 'ГЦК, КЧ 12 на a/√2 = 286.3 пм. На воздухе всегда покрыт аморфной плёнкой Al₂O₃ толщиной 2–4 нм — не корундом.',
  },
  corundum: {
    id: 'corundum',
    formula: 'Al₂O₃',
    nameRu: 'оксид алюминия (корунд, α-Al₂O₃)',
    structureType: 'корунд',
    spaceGroup: 'R-3c',
    spaceGroupNo: 167,
    latticeType: 'тригональная (ромбоэдрическая)',
    // Kirfel & Eichhorn, Acta Cryst. A46 (1990) 271 (COD 9007498); CRC/Lewis 1982: 475.9 / 1299.1
    cellPm: { a: 475.7, c: 1298.77 },
    cellAnglesDeg: { alpha: 90, beta: 90, gamma: 120 },
    // две длины Al–O из базиса: 185.4 ×3 и 197.1 ×3 пм; здесь — кратчайшая
    cationAnionPm: 185.4,
    coordination: { 'Al³⁺': 6, 'O²⁻': 4 },
    z: 6,
    densityGCm3: 3.991,
    ionic: true,
    meltingC: 2072,
    // Glassman & Yetter 2008: улетучивание-диссоциация Al₂O₃ ≈ 4000 K — потолок пламени алюминия
    volatilizationK: 4000,
    setting: 'rhombohedral-hex',
    // Kirfel & Eichhorn 1990: Al 12c (0, 0, 0.35218), O 18e (0.30625, 0, ¼); гекс. установка, R-центрировка
    basis: [
      { el: 'Al', charge: 3, frac: [0, 0, 0.35218], wyckoff: '12c' },
      { el: 'Al', charge: 3, frac: [0, 0, 0.14782], wyckoff: '12c' },
      { el: 'Al', charge: 3, frac: [0, 0, 0.64782], wyckoff: '12c' },
      { el: 'Al', charge: 3, frac: [0, 0, 0.85218], wyckoff: '12c' },
      { el: 'Al', charge: 3, frac: [2 / 3, 1 / 3, 0.68551], wyckoff: '12c' },
      { el: 'Al', charge: 3, frac: [2 / 3, 1 / 3, 0.48115], wyckoff: '12c' },
      { el: 'Al', charge: 3, frac: [2 / 3, 1 / 3, 0.98115], wyckoff: '12c' },
      { el: 'Al', charge: 3, frac: [2 / 3, 1 / 3, 0.18551], wyckoff: '12c' },
      { el: 'Al', charge: 3, frac: [1 / 3, 2 / 3, 0.01885], wyckoff: '12c' },
      { el: 'Al', charge: 3, frac: [1 / 3, 2 / 3, 0.81449], wyckoff: '12c' },
      { el: 'Al', charge: 3, frac: [1 / 3, 2 / 3, 0.31449], wyckoff: '12c' },
      { el: 'Al', charge: 3, frac: [1 / 3, 2 / 3, 0.51885], wyckoff: '12c' },
      { el: 'O', charge: -2, frac: [0.30625, 0, 0.25], wyckoff: '18e' },
      { el: 'O', charge: -2, frac: [0, 0.30625, 0.25], wyckoff: '18e' },
      { el: 'O', charge: -2, frac: [0.69375, 0.69375, 0.25], wyckoff: '18e' },
      { el: 'O', charge: -2, frac: [0.69375, 0, 0.75], wyckoff: '18e' },
      { el: 'O', charge: -2, frac: [0, 0.69375, 0.75], wyckoff: '18e' },
      { el: 'O', charge: -2, frac: [0.30625, 0.30625, 0.75], wyckoff: '18e' },
      { el: 'O', charge: -2, frac: [0.97292, 1 / 3, 7 / 12], wyckoff: '18e' },
      { el: 'O', charge: -2, frac: [2 / 3, 0.63958, 7 / 12], wyckoff: '18e' },
      { el: 'O', charge: -2, frac: [0.36042, 0.02708, 7 / 12], wyckoff: '18e' },
      { el: 'O', charge: -2, frac: [0.36042, 1 / 3, 1 / 12], wyckoff: '18e' },
      { el: 'O', charge: -2, frac: [2 / 3, 0.02708, 1 / 12], wyckoff: '18e' },
      { el: 'O', charge: -2, frac: [0.97292, 0.63958, 1 / 12], wyckoff: '18e' },
      { el: 'O', charge: -2, frac: [0.63958, 2 / 3, 11 / 12], wyckoff: '18e' },
      { el: 'O', charge: -2, frac: [1 / 3, 0.97292, 11 / 12], wyckoff: '18e' },
      { el: 'O', charge: -2, frac: [0.02708, 0.36042, 11 / 12], wyckoff: '18e' },
      { el: 'O', charge: -2, frac: [0.02708, 2 / 3, 5 / 12], wyckoff: '18e' },
      { el: 'O', charge: -2, frac: [1 / 3, 0.36042, 5 / 12], wyckoff: '18e' },
      { el: 'O', charge: -2, frac: [0.63958, 0.97292, 5 / 12], wyckoff: '18e' },
    ],
    note:
      'ГПУ-упаковка O²⁻, Al³⁺ занимает 2/3 октаэдрических пустот: октаэдр AlO₆ с двумя длинами Al–O (185.4 и 197.1 пм), ' +
      'каждый O — в искажённом тетраэдре из четырёх Al. Гексагональная установка ромбоэдрической ячейки (Z = 6: 12 Al + 18 O). ' +
      'Рентгеновская ρ 3.991 (справочная 3.99). Рубин и сапфир — корунд с примесями Cr³⁺ и Fe/Ti.',
  },
  ice: {
    id: 'ice',
    formula: 'H₂O',
    nameRu: 'лёд Ih (гексагональный)',
    structureType: 'лёд Ih (вюрцитоподобная сетка O)',
    spaceGroup: 'P6₃/mmc',
    spaceGroupNo: 194,
    latticeType: 'гексагональная',
    // Röttger et al., Acta Cryst. B50 (1994) 644, H₂O при 250 K: a = 451.81, c = 735.60 пм
    cellPm: { a: 451.81, c: 735.6 },
    cellAnglesDeg: { alpha: 90, beta: 90, gamma: 120 },
    // кратчайшее O···O из базиса (276.2 ×3 в слое и 276.9 вдоль c) — водородная связь O–H···O
    cationAnionPm: 276.2,
    coordination: { 'O (по O)': 4 },
    z: 4,
    densityGCm3: 0.92,
    ionic: false,
    meltingC: 0,
    temperatureK: 250,
    setting: 'hexagonal',
    basisOmits: ['H'],
    // O 4f (⅓, ⅔, z), z = 0.0618 (Goto, Hondoh & Mae, J. Chem. Phys. 93 (1990) 1412, COD 1538173); H в базис не входят
    basis: [
      { el: 'O', frac: [1 / 3, 2 / 3, 0.0618], wyckoff: '4f' },
      { el: 'O', frac: [2 / 3, 1 / 3, 0.5618], wyckoff: '4f' },
      { el: 'O', frac: [1 / 3, 2 / 3, 0.4382], wyckoff: '4f' },
      { el: 'O', frac: [2 / 3, 1 / 3, 0.9382], wyckoff: '4f' },
    ],
    note:
      'в базисе только кислородная подрешётка: атомы H разупорядочены (правила льда Бернала — Фаулера — на каждой связи O···O ' +
      'ровно один H, у каждого O ровно два близких H), поэтому фиксированных позиций H в ячейке нет. Каждый O — в тетраэдре из ' +
      'четырёх O на ≈ 276 пм: ажурная сетка, отсюда лёд легче воды. Рентгеновская ρ при 250 K 0.920 (при 0 °C 0.917).',
  },
  dry_ice: {
    id: 'dry_ice',
    formula: 'CO₂',
    nameRu: 'сухой лёд (твёрдый CO₂)',
    structureType: 'молекулярная решётка α-N₂ (Pa-3)',
    spaceGroup: 'Pa-3',
    spaceGroupNo: 205,
    latticeType: 'кубическая (молекулярная)',
    // Simon & Peters, Acta Cryst. B36 (1980) 2750, монокристалл при 150 K (COD 9007643)
    cellPm: { a: 562.4 },
    // C=O внутри молекулы из базиса: x(O)·√3·a = 115.4 пм
    cationAnionPm: 115.4,
    coordination: { 'C (по O)': 2, 'CO₂ (соседних молекул)': 12 },
    z: 4,
    densityGCm3: 1.643,
    ionic: false,
    temperatureK: 150,
    setting: 'cubic',
    // Pa-3: C 4a (0,0,0), O 8c (x,x,x), x = 0.1185 — молекулы вдоль четырёх диагоналей куба
    basis: [
      { el: 'C', frac: [0, 0, 0], wyckoff: '4a' },
      { el: 'C', frac: [0.5, 0, 0.5], wyckoff: '4a' },
      { el: 'C', frac: [0, 0.5, 0.5], wyckoff: '4a' },
      { el: 'C', frac: [0.5, 0.5, 0], wyckoff: '4a' },
      { el: 'O', frac: [0.1185, 0.1185, 0.1185], wyckoff: '8c' },
      { el: 'O', frac: [0.6185, 0.1185, 0.3815], wyckoff: '8c' },
      { el: 'O', frac: [0.1185, 0.3815, 0.6185], wyckoff: '8c' },
      { el: 'O', frac: [0.3815, 0.6185, 0.1185], wyckoff: '8c' },
      { el: 'O', frac: [0.8815, 0.8815, 0.8815], wyckoff: '8c' },
      { el: 'O', frac: [0.6185, 0.3815, 0.8815], wyckoff: '8c' },
      { el: 'O', frac: [0.3815, 0.8815, 0.6185], wyckoff: '8c' },
      { el: 'O', frac: [0.8815, 0.6185, 0.3815], wyckoff: '8c' },
    ],
    note:
      'молекулы CO₂ в узлах ГЦК, оси молекул — по четырём разным объёмным диагоналям. Внутри молекулы C=O 115.4 пм (в газе r_e 116.0), ' +
      'между молекулами только ван-дер-ваальсово притяжение → сублимация при −78.5 °C (1 атм). Рентгеновская ρ при 150 K 1.643; ' +
      'справочные ≈ 1.56 г/см³ при 195 K — насыпной/пористый продукт.',
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
