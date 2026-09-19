/**
 * ATOMLAB — термохимия: стандартные энтальпии образования, циклы Борна — Габера,
 * энергии решёток и тепловые эффекты реакций, посчитанные ДВУМЯ способами.
 *
 * ИСТОЧНИКИ (по таблице, не по значению):
 *  • ΔH°f (298.15 K, 1 бар) — CRC Handbook of Chemistry and Physics, 97th ed.,
 *    «Standard Thermodynamic Properties of Chemical Substances»; NIST-JANAF Thermochemical Tables.
 *  • Энтальпии сублимации металлов равны ΔH°f их одноатомного газа (та же таблица).
 *  • Энергии ионизации и сродства к электрону — см. atomicData.ts.
 *  • Энергии решёток — значения цикла Борна — Габера (экспериментальные), а не расчёт
 *    по Борну — Ланде: NaCl 787, MgO 3791, CaO 3401 кДж/моль.
 *
 * ЗНАКИ (строго): ΔH_субл > 0, ½D(X₂) > 0, IE > 0, EA₁ < 0 (но EA₂ кислорода > 0),
 * U_реш < 0, ΔH°f < 0 для экзотермического образования.
 *
 * ПРОВЕРКА: сумма ступеней цикла обязана совпасть с табличной ΔH°f (скрипт test-chem-data).
 */

import type { BondKey } from './bondData'
import { bondEnthalpyKJ } from './bondData'

// ─────────────────────────────────────────────────────────────────────────────
// ΔH°f — стандартные энтальпии образования, кДж/моль
// ─────────────────────────────────────────────────────────────────────────────

export type FormationDatum = {
  readonly formula: string
  readonly nameRu: string
  /** Агрегатное состояние в стандартных условиях записи. */
  readonly state: 'г' | 'ж' | 'тв' | 'водн'
  readonly dHfKJ: number
  readonly note?: string
}

export const FORMATION_ENTHALPY: Readonly<Record<string, FormationDatum>> = {
  // простые вещества в стандартном состоянии — ровно 0 по определению
  'H2(g)': { formula: 'H₂', nameRu: 'водород', state: 'г', dHfKJ: 0 },
  'N2(g)': { formula: 'N₂', nameRu: 'азот', state: 'г', dHfKJ: 0 },
  'O2(g)': { formula: 'O₂', nameRu: 'кислород', state: 'г', dHfKJ: 0 },
  'Cl2(g)': { formula: 'Cl₂', nameRu: 'хлор', state: 'г', dHfKJ: 0 },
  'Br2(l)': { formula: 'Br₂', nameRu: 'бром', state: 'ж', dHfKJ: 0, note: 'при 25 °C бром — ЖИДКОСТЬ; Br₂(г) +30.9' },
  'I2(s)': { formula: 'I₂', nameRu: 'иод', state: 'тв', dHfKJ: 0, note: 'при 25 °C иод — ТВЁРДЫЙ; I₂(г) +62.4' },
  'C(graphite)': { formula: 'C', nameRu: 'графит', state: 'тв', dHfKJ: 0, note: 'алмаз +1.9 кДж/моль' },
  'S8(s)': { formula: 'S₈', nameRu: 'сера ромбическая', state: 'тв', dHfKJ: 0, note: 'на 1 моль атомов S тоже 0' },
  'P4(s)': { formula: 'P₄', nameRu: 'фосфор белый', state: 'тв', dHfKJ: 0, note: 'красный фосфор −17.6' },
  'Na(s)': { formula: 'Na', nameRu: 'натрий', state: 'тв', dHfKJ: 0 },
  'Mg(s)': { formula: 'Mg', nameRu: 'магний', state: 'тв', dHfKJ: 0 },
  'Ca(s)': { formula: 'Ca', nameRu: 'кальций', state: 'тв', dHfKJ: 0 },
  'Fe(s)': { formula: 'Fe', nameRu: 'железо', state: 'тв', dHfKJ: 0 },
  'Zn(s)': { formula: 'Zn', nameRu: 'цинк', state: 'тв', dHfKJ: 0 },
  'Cu(s)': { formula: 'Cu', nameRu: 'медь', state: 'тв', dHfKJ: 0 },
  'Al(s)': { formula: 'Al', nameRu: 'алюминий', state: 'тв', dHfKJ: 0 },

  // одноатомные газы — это и есть энтальпии сублимации / атомизации
  'Na(g)': { formula: 'Na (г)', nameRu: 'натрий атомарный', state: 'г', dHfKJ: 107.3 },
  'Mg(g)': { formula: 'Mg (г)', nameRu: 'магний атомарный', state: 'г', dHfKJ: 147.1 },
  'Ca(g)': { formula: 'Ca (г)', nameRu: 'кальций атомарный', state: 'г', dHfKJ: 177.8 },
  'Zn(g)': { formula: 'Zn (г)', nameRu: 'цинк атомарный', state: 'г', dHfKJ: 130.4 },
  'Fe(g)': { formula: 'Fe (г)', nameRu: 'железо атомарное', state: 'г', dHfKJ: 416.3 },
  'H(g)': { formula: 'H (г)', nameRu: 'водород атомарный', state: 'г', dHfKJ: 218.0 },
  'O(g)': { formula: 'O (г)', nameRu: 'кислород атомарный', state: 'г', dHfKJ: 249.2 },
  'Cl(g)': { formula: 'Cl (г)', nameRu: 'хлор атомарный', state: 'г', dHfKJ: 121.3 },
  'N(g)': { formula: 'N (г)', nameRu: 'азот атомарный', state: 'г', dHfKJ: 472.7 },
  'S(g)': { formula: 'S (г)', nameRu: 'сера атомарная', state: 'г', dHfKJ: 277.2 },
  'C(g)': { formula: 'C (г)', nameRu: 'углерод атомарный', state: 'г', dHfKJ: 716.7 },

  // продукты сцен
  'NaCl(s)': { formula: 'NaCl', nameRu: 'хлорид натрия', state: 'тв', dHfKJ: -411.2 },
  'MgO(s)': { formula: 'MgO', nameRu: 'оксид магния', state: 'тв', dHfKJ: -601.6 },
  'CaO(s)': { formula: 'CaO', nameRu: 'оксид кальция', state: 'тв', dHfKJ: -634.9 },
  'CaCO3(s)': { formula: 'CaCO₃', nameRu: 'карбонат кальция (кальцит)', state: 'тв', dHfKJ: -1207.6 },
  'FeS(s)': { formula: 'FeS', nameRu: 'сульфид железа(II)', state: 'тв', dHfKJ: -100.0 },
  'ZnCl2(s)': { formula: 'ZnCl₂', nameRu: 'хлорид цинка', state: 'тв', dHfKJ: -415.1 },

  // ——— ИОНЫ В ВОДНОМ РАСТВОРЕ (бесконечное разбавление, 298 K) ———
  // Шкала относительная: ΔH°f(H⁺, водн) ≡ 0 ПО СОГЛАШЕНИЮ, всё остальное отсчитано от него.
  // Поэтому «энтальпия образования иона» — не абсолютная величина, а разность; в сумме
  // по электронейтральному уравнению соглашение сокращается и ответ физически точен.
  'H+(aq)': { formula: 'H⁺', nameRu: 'ион водорода (гидратированный)', state: 'водн', dHfKJ: 0, note: 'ноль шкалы по соглашению IUPAC; реально протон в воде существует как H₃O⁺ и далее H₉O₄⁺' },
  'Cl-(aq)': { formula: 'Cl⁻', nameRu: 'хлорид-ион', state: 'водн', dHfKJ: -167.2 },
  'Zn2+(aq)': { formula: 'Zn²⁺', nameRu: 'ион цинка', state: 'водн', dHfKJ: -153.9, note: 'реально существует как аквакомплекс [Zn(H₂O)₆]²⁺' },
  'HCl(aq)': { formula: 'HCl', nameRu: 'соляная кислота', state: 'водн', dHfKJ: -167.2, note: 'кислота диссоциирована нацело: ΔH°f(H⁺) + ΔH°f(Cl⁻) = 0 + (−167.2)' },
  'ZnCl2(aq)': { formula: 'ZnCl₂', nameRu: 'хлорид цинка (раствор)', state: 'водн', dHfKJ: -488.3, note: 'ΔH°f(Zn²⁺) + 2·ΔH°f(Cl⁻) = −153.9 + 2·(−167.2); табличное значение −488.19' },
  'ZnS(s)': { formula: 'ZnS', nameRu: 'сульфид цинка (сфалерит)', state: 'тв', dHfKJ: -206.0 },
  'H2O(g)': { formula: 'H₂O', nameRu: 'вода (пар)', state: 'г', dHfKJ: -241.8 },
  'H2O(l)': { formula: 'H₂O', nameRu: 'вода (жидкость)', state: 'ж', dHfKJ: -285.8 },
  'HCl(g)': { formula: 'HCl', nameRu: 'хлороводород', state: 'г', dHfKJ: -92.3 },
  'NH3(g)': { formula: 'NH₃', nameRu: 'аммиак', state: 'г', dHfKJ: -45.9 },
  'CO2(g)': { formula: 'CO₂', nameRu: 'оксид углерода(IV)', state: 'г', dHfKJ: -393.5 },
  'CO(g)': { formula: 'CO', nameRu: 'оксид углерода(II)', state: 'г', dHfKJ: -110.5 },
  'SO2(g)': { formula: 'SO₂', nameRu: 'оксид серы(IV)', state: 'г', dHfKJ: -296.8 },
  'SO3(g)': { formula: 'SO₃', nameRu: 'оксид серы(VI)', state: 'г', dHfKJ: -395.7 },
  'CH4(g)': { formula: 'CH₄', nameRu: 'метан', state: 'г', dHfKJ: -74.6 },
  'ClO2(g)': { formula: 'ClO₂', nameRu: 'диоксид хлора', state: 'г', dHfKJ: 102.5 },
  'NO(g)': { formula: 'NO', nameRu: 'оксид азота(II)', state: 'г', dHfKJ: 91.3 },
  'NO2(g)': { formula: 'NO₂', nameRu: 'оксид азота(IV)', state: 'г', dHfKJ: 33.2 },
  'H2S(g)': { formula: 'H₂S', nameRu: 'сероводород', state: 'г', dHfKJ: -20.6 },
  'CuO(s)': { formula: 'CuO', nameRu: 'оксид меди(II)', state: 'тв', dHfKJ: -157.3 },
  'Fe2O3(s)': { formula: 'Fe₂O₃', nameRu: 'оксид железа(III)', state: 'тв', dHfKJ: -824.2 },
  'Al2O3(s)': { formula: 'Al₂O₃', nameRu: 'оксид алюминия (корунд)', state: 'тв', dHfKJ: -1675.7 },
  'ZnO(s)': { formula: 'ZnO', nameRu: 'оксид цинка', state: 'тв', dHfKJ: -350.5 },
  'CaCl2(s)': { formula: 'CaCl₂', nameRu: 'хлорид кальция', state: 'тв', dHfKJ: -795.4 },
  'KCl(s)': { formula: 'KCl', nameRu: 'хлорид калия', state: 'тв', dHfKJ: -436.5 },
  'CsCl(s)': { formula: 'CsCl', nameRu: 'хлорид цезия', state: 'тв', dHfKJ: -443.0 },
  'Ca(OH)2(s)': { formula: 'Ca(OH)₂', nameRu: 'гидроксид кальция (гашёная известь)', state: 'тв', dHfKJ: -985.2 },
}

/** ΔH°f по ключу таблицы; бросает, если вещества нет — молчаливый 0 скрыл бы ошибку. */
export function dHfKJ(key: string): number {
  const datum = FORMATION_ENTHALPY[key]
  if (!datum) throw new Error(`thermoData: нет ΔH°f для «${key}»`)
  return datum.dHfKJ
}

// ─────────────────────────────────────────────────────────────────────────────
// Стандартные энтропии S°(298 K), Дж/(моль·К)  — CRC Handbook, 97th ed.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Нужны там, где знака ΔH мало: эндотермическая реакция идёт только за счёт
 * роста энтропии. Обжиг известняка CaCO₃ → CaO + CO₂ выделяет ГАЗ, поэтому
 * ΔS° = 38.1 + 213.8 − 91.7 = +160.2 Дж/(моль·К), и ΔG = ΔH − TΔS обращается
 * в ноль около 1119 K — отсюда и печь на 900…1000 °C.
 */
export const STANDARD_ENTROPY_J: Readonly<Record<string, number>> = {
  'CaCO3(s)': 91.7,
  'CaO(s)': 38.1,
  'CO2(g)': 213.8,
  'Ca(OH)2(s)': 83.4,
  'H2O(l)': 69.9,
  'H2O(g)': 188.8,
}

/** S°(298 K), Дж/(моль·К); бросает, если вещества нет. */
export function sJ(key: string): number {
  const s = STANDARD_ENTROPY_J[key]
  if (s == null) throw new Error(`thermoData: нет S° для «${key}»`)
  return s
}

// ─────────────────────────────────────────────────────────────────────────────
// Энергии решёток, кДж/моль (< 0: газообразные ионы → кристалл)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Значения цикла Борна — Габера. В литературе их часто печатают как положительные
 * «энтальпии решётки» (энергия разрушения кристалла) — здесь знак ФИЗИЧЕСКИЙ: сборка
 * решётки экзотермична, поэтому U < 0.
 */
export const LATTICE_ENTHALPY_KJ: Readonly<Record<string, number>> = {
  'NaCl(s)': -787,
  'NaF(s)': -923,
  'KCl(s)': -711,
  'CsCl(s)': -657,
  'MgO(s)': -3789,
  'CaO(s)': -3400,
  'CaCl2(s)': -2258,
  'ZnS(s)': -3610,
}

/**
 * Вторая энергия сродства к электрону кислорода: O⁻(г) + e⁻ → O²⁻(г).
 * Процесс ЭНДОТЕРМИЧЕСКИЙ (электрон загоняют в уже отрицательный ион), знак «+».
 * Значение 744 кДж/моль согласовано с энтальпиями решёток MgO (3791) и CaO (3401):
 * в литературе встречается разброс 744…844, и вместе с ним «плавает» энергия решётки.
 */
export const OXIDE_SECOND_EA_KJ = 744

// ─────────────────────────────────────────────────────────────────────────────
// Циклы Борна — Габера
// ─────────────────────────────────────────────────────────────────────────────

export type BornHaberKind =
  | 'sublimation'
  | 'dissociation'
  | 'ionization'
  | 'affinity'
  | 'lattice'
  /** ион из газа уходит в воду (ΔH < 0) или вырывается из воды в газ (ΔH > 0) */
  | 'hydration'
  /** образование ковалентной связи из атомов (ΔH < 0) */
  | 'bond'

export type BornHaberStage = {
  readonly id: string
  readonly kind: BornHaberKind
  /** Уравнение ступени — рисуется на лесенке энергии. */
  readonly equation: string
  /** ΔH ступени, кДж на 1 моль продукта. Знак физический. */
  readonly dHKJ: number
}

export type BornHaberCycle = {
  readonly id: string
  readonly formula: string
  /** Итоговое уравнение образования 1 моля продукта. */
  readonly equation: string
  readonly stages: readonly BornHaberStage[]
  /** Табличная ΔH°f продукта, кДж/моль — с ней сверяется сумма. */
  readonly dHfTableKJ: number
}

export const BORN_HABER: Readonly<Record<string, BornHaberCycle>> = {
  nacl: {
    id: 'nacl',
    formula: 'NaCl',
    equation: 'Na (тв) + ½ Cl₂ (г) → NaCl (тв)',
    dHfTableKJ: -411.2,
    stages: [
      { id: 'sublimation', kind: 'sublimation', equation: 'Na (тв) → Na (г)', dHKJ: 107.3 },
      { id: 'dissociation', kind: 'dissociation', equation: '½ Cl₂ (г) → Cl (г)', dHKJ: 121.7 },
      { id: 'ionization', kind: 'ionization', equation: 'Na (г) → Na⁺ (г) + e⁻', dHKJ: 495.8 },
      { id: 'affinity', kind: 'affinity', equation: 'Cl (г) + e⁻ → Cl⁻ (г)', dHKJ: -348.6 },
      { id: 'lattice', kind: 'lattice', equation: 'Na⁺ (г) + Cl⁻ (г) → NaCl (тв)', dHKJ: -787.0 },
    ],
  },
  mgo: {
    id: 'mgo',
    formula: 'MgO',
    equation: 'Mg (тв) + ½ O₂ (г) → MgO (тв)',
    dHfTableKJ: -601.6,
    stages: [
      { id: 'sublimation', kind: 'sublimation', equation: 'Mg (тв) → Mg (г)', dHKJ: 147.1 },
      { id: 'dissociation', kind: 'dissociation', equation: '½ O₂ (г) → O (г)', dHKJ: 249.2 },
      { id: 'ionization1', kind: 'ionization', equation: 'Mg (г) → Mg⁺ (г) + e⁻', dHKJ: 737.7 },
      { id: 'ionization2', kind: 'ionization', equation: 'Mg⁺ (г) → Mg²⁺ (г) + e⁻', dHKJ: 1450.7 },
      { id: 'affinity1', kind: 'affinity', equation: 'O (г) + e⁻ → O⁻ (г)', dHKJ: -141.0 },
      { id: 'affinity2', kind: 'affinity', equation: 'O⁻ (г) + e⁻ → O²⁻ (г)', dHKJ: OXIDE_SECOND_EA_KJ },
      { id: 'lattice', kind: 'lattice', equation: 'Mg²⁺ (г) + O²⁻ (г) → MgO (тв)', dHKJ: -3789.0 },
    ],
  },
  cao: {
    id: 'cao',
    formula: 'CaO',
    equation: 'Ca (тв) + ½ O₂ (г) → CaO (тв)',
    dHfTableKJ: -634.9,
    stages: [
      { id: 'sublimation', kind: 'sublimation', equation: 'Ca (тв) → Ca (г)', dHKJ: 177.8 },
      { id: 'dissociation', kind: 'dissociation', equation: '½ O₂ (г) → O (г)', dHKJ: 249.2 },
      { id: 'ionization1', kind: 'ionization', equation: 'Ca (г) → Ca⁺ (г) + e⁻', dHKJ: 589.8 },
      { id: 'ionization2', kind: 'ionization', equation: 'Ca⁺ (г) → Ca²⁺ (г) + e⁻', dHKJ: 1145.4 },
      { id: 'affinity1', kind: 'affinity', equation: 'O (г) + e⁻ → O⁻ (г)', dHKJ: -141.0 },
      { id: 'affinity2', kind: 'affinity', equation: 'O⁻ (г) + e⁻ → O²⁻ (г)', dHKJ: OXIDE_SECOND_EA_KJ },
      { id: 'lattice', kind: 'lattice', equation: 'Ca²⁺ (г) + O²⁻ (г) → CaO (тв)', dHKJ: -3400.0 },
    ],
  },

  /**
   * C (графит) + O₂ (г) → CO₂ (г) — горение угля. НЕ цикл Борна — Габера
   * (решётки у продукта нет, связи ковалентные), а цикл Гесса того же вида:
   * реакцию разложили на атомизацию исходных веществ и образование связей.
   *
   * ВАЖНО, И ЭТО СКАЗАНО В ТЕКСТЕ УРОКА: это путь РАСЧЁТА, а не механизм.
   * Уголь горит на поверхности твёрдой фазы, свободные атомы C (г) и O (г)
   * в пламени промежуточными частицами не являются. Закон Гесса разрешает
   * считать по любому пути — ответ от пути не зависит.
   *
   * Ступени (кДж на 1 моль CO₂, 298 K):
   *   C (графит) → C (г)            +716.7   = ΔH°f(C, г), NIST-JANAF (энтальпия атомизации графита)
   *   O₂ (г) → 2 O (г)              +498.4   = 2 · ΔH°f(O, г) = 2 · 249.2 (D₀(O=O))
   *   C (г) + 2 O (г) → CO₂ (г)    −1608.6   = ΔH°f(CO₂) − ΔH°f(C, г) − 2 · ΔH°f(O, г)
   *   ────────────────────────────────────
   *   Σ = −393.5 = ΔH°f(CO₂, г) — сходится точно, ступени выведены по Гессу.
   *
   * Отсюда ЭНЕРГИЯ ОДНОЙ связи C=O в самой CO₂: 1608.6 / 2 = 804.3 кДж/моль.
   * Табличная средняя энергия связи C=O(CO2) = 799 кДж/моль (bondData) даёт
   * оценку −383 кДж/моль: средние энергии связей усреднены по многим
   * соединениям и дают ошибку порядка 10 кДж — это и есть школьный вывод.
   */
  co2: {
    id: 'co2',
    formula: 'CO₂ (г)',
    equation: 'C (графит) + O₂ (г) → CO₂ (г)',
    dHfTableKJ: -393.5,
    stages: [
      { id: 'atomization', kind: 'sublimation', equation: 'C (графит) → C (г)', dHKJ: 716.7 },
      { id: 'dissociation', kind: 'dissociation', equation: 'O₂ (г) → 2 O (г)', dHKJ: 498.4 },
      { id: 'bonds', kind: 'bond', equation: 'C (г) + 2 O (г) → CO₂ (г)', dHKJ: -1608.6 },
    ],
  },

  /**
   * Zn (тв) + 2 H⁺ (водн) → Zn²⁺ (водн) + H₂ (г) — получение водорода в аппарате Киппа.
   *
   * Это НЕ цикл Борна — Габера (решётки продукта нет), а цикл Гесса того же вида:
   * реакцию в растворе разложили на газофазные стадии. Сумма по закону Гесса
   * обязана дать ΔH°f(Zn²⁺, водн) = −153.9 кДж/моль, потому что ΔH°f остальных
   * участников (Zn тв, H⁺ водн, H₂ г) равны нулю по определению.
   *
   * Электронный баланс сходится внутри цикла: цинк отдаёт ровно 2 e⁻
   * (ступени ionization1 + ionization2), и ровно 2 e⁻ принимают два протона
   * (ступень neutralization). Заряд тоже сходится: слева 2(+1), справа (+2).
   *
   * Энтальпии гидратации — по шкале, где ΔH_гидр(H⁺) = −1091 кДж/моль
   * (Smith, J. Chem. Educ. 1977). Абсолютные значения зависят от выбора этой
   * опорной точки, но в электронейтральном уравнении она сокращается.
   */
  zncl2_aq: {
    id: 'zncl2_aq',
    formula: 'Zn²⁺ (водн)',
    equation: 'Zn (тв) + 2 H⁺ (водн) → Zn²⁺ (водн) + H₂ (г)',
    dHfTableKJ: -153.9,
    stages: [
      { id: 'sublimation', kind: 'sublimation', equation: 'Zn (тв) → Zn (г)', dHKJ: 130.4 },
      { id: 'ionization1', kind: 'ionization', equation: 'Zn (г) → Zn⁺ (г) + e⁻', dHKJ: 906.4 },
      { id: 'ionization2', kind: 'ionization', equation: 'Zn⁺ (г) → Zn²⁺ (г) + e⁻', dHKJ: 1733.3 },
      { id: 'hydration', kind: 'hydration', equation: 'Zn²⁺ (г) → Zn²⁺ (водн)', dHKJ: -2046.0 },
      { id: 'dehydration', kind: 'hydration', equation: '2 H⁺ (водн) → 2 H⁺ (г)', dHKJ: 2182.0 },
      { id: 'neutralization', kind: 'ionization', equation: '2 H⁺ (г) + 2e⁻ → 2 H (г)', dHKJ: -2624.0 },
      { id: 'recombination', kind: 'bond', equation: '2 H (г) → H₂ (г)', dHKJ: -436.0 },
    ],
  },
}

/**
 * Энтальпии гидратации отдельных ионов, кДж/моль (298 K, бесконечное разбавление).
 *
 * ШКАЛА ОТНОСИТЕЛЬНАЯ: принято ΔH_гидр(H⁺) = −1091 кДж/моль (Smith, J. Chem. Educ. 54 (1977) 540).
 * Другие компиляции берут −1103 или −1150 и тогда СДВИГАЮТ все остальные ионы на ту же
 * величину — сравнивать значения из разных источников напрямую нельзя. В любом
 * электронейтральном уравнении выбор опорной точки сокращается.
 */
export const HYDRATION_ENTHALPY_KJ: Readonly<Record<string, number>> = {
  'H+': -1091,
  'Zn2+': -2046,
  'Na+': -406,
  'Cl-': -364,
}

// ─────────────────────────────────────────────────────────────────────────────
// Стандартные электродные потенциалы (водный раствор, 298 K, шкала СВЭ)
// ─────────────────────────────────────────────────────────────────────────────

export type RedoxCouple = {
  readonly id: string
  /** Полуреакция ВОССТАНОВЛЕНИЯ, как её пишут в таблице. */
  readonly half: string
  /** E°, вольты, относительно стандартного водородного электрода. */
  readonly e0V: number
  /** Число электронов в полуреакции. */
  readonly n: number
  readonly note?: string
}

export const STANDARD_POTENTIALS_V: Readonly<Record<string, RedoxCouple>> = {
  'Zn2+/Zn': { id: 'Zn2+/Zn', half: 'Zn²⁺ (водн) + 2e⁻ ⇌ Zn (тв)', e0V: -0.7618, n: 2 },
  'H+/H2': { id: 'H+/H2', half: '2 H⁺ (водн) + 2e⁻ ⇌ H₂ (г)', e0V: 0, n: 2, note: 'ноль шкалы ПО ОПРЕДЕЛЕНИЮ (стандартный водородный электрод)' },
  'Cu2+/Cu': { id: 'Cu2+/Cu', half: 'Cu²⁺ (водн) + 2e⁻ ⇌ Cu (тв)', e0V: 0.3419, n: 2 },
  'Fe2+/Fe': { id: 'Fe2+/Fe', half: 'Fe²⁺ (водн) + 2e⁻ ⇌ Fe (тв)', e0V: -0.447, n: 2 },
  'Mg2+/Mg': { id: 'Mg2+/Mg', half: 'Mg²⁺ (водн) + 2e⁻ ⇌ Mg (тв)', e0V: -2.372, n: 2 },
}

export function standardPotentialV(id: string): number {
  const c = STANDARD_POTENTIALS_V[id]
  if (!c) throw new Error(`thermoData: нет пары «${id}» в таблице стандартных потенциалов`)
  return c.e0V
}

/**
 * ЭДС реакции: E° = E°(окислителя) − E°(восстановителя).
 * E° > 0 — реакция идёт самопроизвольно (ΔG° = −nFE° < 0).
 */
export function cellPotentialV(oxidizer: string, reducer: string): number {
  return Math.round((standardPotentialV(oxidizer) - standardPotentialV(reducer)) * 10000) / 10000
}

/** Сумма ступеней цикла, кДж/моль — по закону Гесса равна ΔH°f. */
export function bornHaberSumKJ(cycleId: string): number {
  const cycle = BORN_HABER[cycleId]
  if (!cycle) throw new Error(`thermoData: нет цикла Борна — Габера «${cycleId}»`)
  let sum = 0
  for (const stage of cycle.stages) sum += stage.dHKJ
  return Math.round(sum * 1000) / 1000
}

/** Расхождение суммы цикла с табличной ΔH°f, кДж/моль (должно быть в пределах ±5). */
export function bornHaberResidualKJ(cycleId: string): number {
  const cycle = BORN_HABER[cycleId]!
  return Math.round((bornHaberSumKJ(cycleId) - cycle.dHfTableKJ) * 1000) / 1000
}

// ─────────────────────────────────────────────────────────────────────────────
// Тепловые эффекты молекулярных реакций — два независимых расчёта
// ─────────────────────────────────────────────────────────────────────────────

export type BondTerm = { readonly bond: BondKey; readonly n: number }
/** Коэффициент в уравнении: < 0 — реагент, > 0 — продукт. */
export type SpeciesTerm = { readonly key: string; readonly coef: number }

export type MolecularReaction = {
  readonly id: string
  readonly equation: string
  readonly nameRu: string
  /** Связи, которые рвутся (вклад > 0). */
  readonly bondsBroken: readonly BondTerm[]
  /** Связи, которые образуются (вклад < 0). */
  readonly bondsFormed: readonly BondTerm[]
  /** Те же реагенты и продукты для расчёта по ΔH°f. */
  readonly species: readonly SpeciesTerm[]
  readonly note?: string
}

export const MOLECULAR_REACTIONS: Readonly<Record<string, MolecularReaction>> = {
  water_g: {
    id: 'water_g',
    equation: 'H₂ (г) + ½ O₂ (г) → H₂O (г)',
    nameRu: 'образование воды из простых веществ',
    bondsBroken: [
      { bond: 'H-H', n: 1 },
      { bond: 'O=O', n: 0.5 },
    ],
    bondsFormed: [{ bond: 'O-H', n: 2 }],
    species: [
      { key: 'H2(g)', coef: -1 },
      { key: 'O2(g)', coef: -0.5 },
      { key: 'H2O(g)', coef: 1 },
    ],
    note: 'по связям −241, по ΔH°f −241.8 кДж/моль',
  },
  water_g_2mol: {
    id: 'water_g_2mol',
    equation: '2 H₂ (г) + O₂ (г) → 2 H₂O (г)',
    nameRu: 'горение водорода',
    bondsBroken: [
      { bond: 'H-H', n: 2 },
      { bond: 'O=O', n: 1 },
    ],
    bondsFormed: [{ bond: 'O-H', n: 4 }],
    species: [
      { key: 'H2(g)', coef: -2 },
      { key: 'O2(g)', coef: -1 },
      { key: 'H2O(g)', coef: 2 },
    ],
  },
  hcl_g: {
    id: 'hcl_g',
    equation: '½ H₂ (г) + ½ Cl₂ (г) → HCl (г)',
    nameRu: 'образование хлороводорода',
    bondsBroken: [
      { bond: 'H-H', n: 0.5 },
      { bond: 'Cl-Cl', n: 0.5 },
    ],
    bondsFormed: [{ bond: 'H-Cl', n: 1 }],
    species: [
      { key: 'H2(g)', coef: -0.5 },
      { key: 'Cl2(g)', coef: -0.5 },
      { key: 'HCl(g)', coef: 1 },
    ],
  },
  hcl_g_2mol: {
    id: 'hcl_g_2mol',
    equation: 'H₂ (г) + Cl₂ (г) → 2 HCl (г)',
    nameRu: 'цепной синтез хлороводорода',
    bondsBroken: [
      { bond: 'H-H', n: 1 },
      { bond: 'Cl-Cl', n: 1 },
    ],
    bondsFormed: [{ bond: 'H-Cl', n: 2 }],
    species: [
      { key: 'H2(g)', coef: -1 },
      { key: 'Cl2(g)', coef: -1 },
      { key: 'HCl(g)', coef: 2 },
    ],
  },
  ammonia: {
    id: 'ammonia',
    equation: '½ N₂ (г) + 1½ H₂ (г) → NH₃ (г)',
    nameRu: 'синтез аммиака (Габер — Бош)',
    bondsBroken: [
      { bond: 'N#N', n: 0.5 },
      { bond: 'H-H', n: 1.5 },
    ],
    bondsFormed: [{ bond: 'N-H', n: 3 }],
    species: [
      { key: 'N2(g)', coef: -0.5 },
      { key: 'H2(g)', coef: -1.5 },
      { key: 'NH3(g)', coef: 1 },
    ],
  },
  ammonia_2mol: {
    id: 'ammonia_2mol',
    equation: 'N₂ (г) + 3 H₂ (г) → 2 NH₃ (г)',
    nameRu: 'синтез аммиака, полное уравнение',
    bondsBroken: [
      { bond: 'N#N', n: 1 },
      { bond: 'H-H', n: 3 },
    ],
    bondsFormed: [{ bond: 'N-H', n: 6 }],
    species: [
      { key: 'N2(g)', coef: -1 },
      { key: 'H2(g)', coef: -3 },
      { key: 'NH3(g)', coef: 2 },
    ],
  },
  methane_combustion: {
    id: 'methane_combustion',
    equation: 'CH₄ (г) + 2 O₂ (г) → CO₂ (г) + 2 H₂O (г)',
    nameRu: 'горение метана',
    bondsBroken: [
      { bond: 'C-H', n: 4 },
      { bond: 'O=O', n: 2 },
    ],
    bondsFormed: [
      { bond: 'C=O(CO2)', n: 2 },
      { bond: 'O-H', n: 4 },
    ],
    species: [
      { key: 'CH4(g)', coef: -1 },
      { key: 'O2(g)', coef: -2 },
      { key: 'CO2(g)', coef: 1 },
      { key: 'H2O(g)', coef: 2 },
    ],
    note: 'по связям −802, по ΔH°f −802.5 кДж — редкое совпадение до 0.5 кДж',
  },
  so2_from_elements: {
    id: 'so2_from_elements',
    equation: '⅛ S₈ (тв.) + O₂ (г) → SO₂ (г)',
    nameRu: 'горение серы',
    // В короне S₈ у каждого атома две связи S–S, но каждая принадлежит двум атомам:
    // на один атом серы приходится ровно одна связь S–S.
    bondsBroken: [
      { bond: 'S-S', n: 1 },
      { bond: 'O=O', n: 1 },
    ],
    bondsFormed: [{ bond: 'S=O', n: 2 }],
    species: [
      { key: 'S8(s)', coef: -0.125 },
      { key: 'O2(g)', coef: -1 },
      { key: 'SO2(g)', coef: 1 },
    ],
    note:
      'по связям −280, по ΔH°f −296.8 кДж/моль. Разница 16.8 кДж — потому что 522 кДж/моль это СРЕДНЯЯ ' +
      'энергия S=O по многим соединениям; в самой SO₂ обе связи прочнее (1072.4 / 2 = 536.2 кДж/моль), ' +
      'так как π-электронная плотность делокализована между ними.',
  },
}

/** ΔH реакции по средним энергиям связей: разорвать минус образовать, кДж. */
export function reactionEnthalpyFromBondsKJ(id: string): number {
  const r = MOLECULAR_REACTIONS[id]
  if (!r) throw new Error(`thermoData: нет реакции «${id}»`)
  let broken = 0
  for (const t of r.bondsBroken) broken += t.n * bondEnthalpyKJ(t.bond)
  let formed = 0
  for (const t of r.bondsFormed) formed += t.n * bondEnthalpyKJ(t.bond)
  return Math.round((broken - formed) * 1000) / 1000
}

/** ΔH реакции по закону Гесса: Σ ΔH°f(продукты) − Σ ΔH°f(реагенты), кДж. */
export function reactionEnthalpyFromFormationKJ(id: string): number {
  const r = MOLECULAR_REACTIONS[id]
  if (!r) throw new Error(`thermoData: нет реакции «${id}»`)
  let sum = 0
  for (const t of r.species) sum += t.coef * dHfKJ(t.key)
  return Math.round(sum * 1000) / 1000
}

/** Оба значения сразу — сцена показывает их рядом и объясняет разницу. */
export function reactionEnthalpyBothKJ(id: string): {
  fromBonds: number
  fromFormation: number
  deltaKJ: number
} {
  const fromBonds = reactionEnthalpyFromBondsKJ(id)
  const fromFormation = reactionEnthalpyFromFormationKJ(id)
  return { fromBonds, fromFormation, deltaKJ: Math.round((fromBonds - fromFormation) * 1000) / 1000 }
}

/** Экзотермична ли реакция (по надёжному расчёту через ΔH°f). */
export function isExothermic(id: string): boolean {
  return reactionEnthalpyFromFormationKJ(id) < 0
}
