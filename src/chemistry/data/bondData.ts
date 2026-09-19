/**
 * ATOMLAB — длины связей, средние энергии связей, валентные углы и дипольные моменты.
 *
 * ИСТОЧНИКИ (по таблице, не по значению):
 *  • Длины связей двухатомных молекул и равновесные геометрии — NIST Chemistry WebBook,
 *    Computational Chemistry Comparison and Benchmark DataBase (CCCBDB), экспериментальные r_e/r_0.
 *  • Средние энергии связей (bond dissociation enthalpies, 298 K) — CRC Handbook,
 *    97th ed., «Bond dissociation energies»; для многоатомных молекул это СРЕДНЕЕ значение
 *    по связи, а не энергия отрыва конкретного атома.
 *  • Валентные углы — микроволновая спектроскопия (NIST CCCBDB).
 *  • Дипольные моменты — CRC Handbook, «Dipole moments», дебаи (D).
 *
 * ВАЖНО для сцен: реагенты-простые вещества берутся в реальном состоянии при 25 °C / 1 атм —
 * H₂, N₂, O₂, F₂, Cl₂, Br₂, I₂ двухатомны, поэтому для них здесь есть и длина, и энергия связи.
 * Сера в стандартном состоянии — S₈ (кольцо, связь S–S 205 пм), фосфор — P₄ (тетраэдр, P–P 221 пм),
 * углерод — графит (не молекула), металлы — атомы в решётке (см. crystalData.ts).
 */

export type BondKey =
  | 'H-H'
  | 'F-F'
  | 'Cl-Cl'
  | 'Br-Br'
  | 'I-I'
  | 'O=O'
  | 'N#N'
  | 'H-F'
  | 'H-Cl'
  | 'H-Br'
  | 'H-I'
  | 'O-H'
  | 'N-H'
  | 'S-H'
  | 'C-H'
  | 'C-C'
  | 'C=C'
  | 'C#C'
  | 'C-O'
  | 'C=O'
  | 'C=O(CO2)'
  | 'C-O(CO3)'
  | 'C#O'
  | 'C-Cl'
  | 'N-N'
  | 'N=N'
  | 'N-O'
  | 'N=O'
  | 'O-O'
  | 'S-S'
  | 'S=O'
  | 'S=O(SO3)'
  | 'Si-O'
  | 'Cl-O'
  | 'Cl-O(ClO2)'
  | 'Na-Cl'
  | 'Mg-O'
  | 'Ca-O'
  | 'Fe-S'
  | 'Zn-Cl'
  | 'Zn-S'
  | 'Zn-O'
  | 'P-P'
  /** МЕЖмолекулярная водородная связь O–H···O (не ковалентная!) */
  | 'O-H...O'

export type BondDatum = {
  readonly key: BondKey
  /** Подпись формулой, как её пишут в тетради. */
  readonly label: string
  /** Равновесная длина связи, пм. */
  readonly lengthPm: number
  /** Средняя энергия связи, кДж/моль (> 0 — на разрыв). */
  readonly enthalpyKJ: number
  /** Где именно измерена длина/энергия — важно, если связь встречается в разных молекулах. */
  readonly context: string
  /** Помечает значения, полученные расчётом из ΔH°f, а не взятые из таблицы связей. */
  readonly derived?: boolean
  readonly note?: string
}

export const BOND_DATA: Readonly<Record<BondKey, BondDatum>> = {
  'H-H': { key: 'H-H', label: 'H–H', lengthPm: 74.14, enthalpyKJ: 436, context: 'H₂ (г)' },
  'F-F': { key: 'F-F', label: 'F–F', lengthPm: 141.2, enthalpyKJ: 159, context: 'F₂ (г)' },
  'Cl-Cl': { key: 'Cl-Cl', label: 'Cl–Cl', lengthPm: 198.8, enthalpyKJ: 243, context: 'Cl₂ (г)' },
  'Br-Br': { key: 'Br-Br', label: 'Br–Br', lengthPm: 228.1, enthalpyKJ: 193, context: 'Br₂ (г)' },
  'I-I': { key: 'I-I', label: 'I–I', lengthPm: 266.6, enthalpyKJ: 151, context: 'I₂ (г)' },
  'O=O': { key: 'O=O', label: 'O=O', lengthPm: 120.8, enthalpyKJ: 498, context: 'O₂ (г), триплет ³Σg⁻' },
  'N#N': { key: 'N#N', label: 'N≡N', lengthPm: 109.77, enthalpyKJ: 945, context: 'N₂ (г)' },

  'H-F': { key: 'H-F', label: 'H–F', lengthPm: 91.7, enthalpyKJ: 565, context: 'HF (г)' },
  'H-Cl': { key: 'H-Cl', label: 'H–Cl', lengthPm: 127.46, enthalpyKJ: 431, context: 'HCl (г)' },
  'H-Br': { key: 'H-Br', label: 'H–Br', lengthPm: 141.44, enthalpyKJ: 366, context: 'HBr (г)' },
  'H-I': { key: 'H-I', label: 'H–I', lengthPm: 160.92, enthalpyKJ: 298, context: 'HI (г)' },

  'O-H': { key: 'O-H', label: 'O–H', lengthPm: 95.8, enthalpyKJ: 463, context: 'H₂O (г); средняя по двум связям' },
  'N-H': { key: 'N-H', label: 'N–H', lengthPm: 101.2, enthalpyKJ: 391, context: 'NH₃ (г); средняя по трём связям' },
  'S-H': { key: 'S-H', label: 'S–H', lengthPm: 133.6, enthalpyKJ: 339, context: 'H₂S (г)' },
  'C-H': { key: 'C-H', label: 'C–H', lengthPm: 108.7, enthalpyKJ: 413, context: 'CH₄ (г); средняя по четырём связям' },

  'C-C': { key: 'C-C', label: 'C–C', lengthPm: 154, enthalpyKJ: 347, context: 'этан и алканы' },
  'C=C': { key: 'C=C', label: 'C=C', lengthPm: 134, enthalpyKJ: 614, context: 'этилен' },
  'C#C': { key: 'C#C', label: 'C≡C', lengthPm: 120.3, enthalpyKJ: 839, context: 'ацетилен' },
  'C-O': { key: 'C-O', label: 'C–O', lengthPm: 143, enthalpyKJ: 358, context: 'спирты, простые эфиры' },
  'C=O': { key: 'C=O', label: 'C=O', lengthPm: 122, enthalpyKJ: 745, context: 'альдегиды и кетоны' },
  'C=O(CO2)': {
    key: 'C=O(CO2)',
    label: 'C=O (в CO₂)',
    lengthPm: 116.0,
    enthalpyKJ: 799,
    context: 'CO₂ (г); связь короче и прочнее, чем C=O карбонила, из-за делокализации',
  },
  'C-O(CO3)': {
    key: 'C-O(CO3)',
    label: 'C–O (в CO₃²⁻)',
    lengthPm: 128.4,
    enthalpyKJ: 505,
    context: 'ион CO₃²⁻ в кальците (ICSD): плоский треугольник, три одинаковые связи, порядок 1⅓',
    derived: true,
    note:
      'ДЛИНА 128,4 пм — измеренная (кальцит). ЭНЕРГИЯ табличного значения не имеет: ' +
      'это оценка интерполяцией по порядку связи между C–O (358) и C=O в CO₂ (799) при порядке 4/3. ' +
      'Ни сцена, ни расчёты её не используют — энтальпия обжига считается по ΔH°f.',
  },
  'C#O': { key: 'C#O', label: 'C≡O', lengthPm: 112.8, enthalpyKJ: 1072, context: 'CO (г)' },
  'C-Cl': { key: 'C-Cl', label: 'C–Cl', lengthPm: 177, enthalpyKJ: 339, context: 'хлоралканы' },

  'N-N': { key: 'N-N', label: 'N–N', lengthPm: 145, enthalpyKJ: 163, context: 'гидразин N₂H₄' },
  'N=N': { key: 'N=N', label: 'N=N', lengthPm: 125, enthalpyKJ: 418, context: 'диимид HN=NH' },
  'N-O': { key: 'N-O', label: 'N–O', lengthPm: 140, enthalpyKJ: 201, context: 'гидроксиламин' },
  'N=O': { key: 'N=O', label: 'N=O', lengthPm: 115.1, enthalpyKJ: 607, context: 'NO (г)' },
  'O-O': { key: 'O-O', label: 'O–O', lengthPm: 147.5, enthalpyKJ: 146, context: 'пероксид водорода H₂O₂' },

  'S-S': { key: 'S-S', label: 'S–S', lengthPm: 205.5, enthalpyKJ: 266, context: 'кольцо S₈ (ромбическая сера)' },
  'S=O': { key: 'S=O', label: 'S=O', lengthPm: 143.1, enthalpyKJ: 522, context: 'SO₂ (г); средняя по двум связям' },
  'S=O(SO3)': { key: 'S=O(SO3)', label: 'S=O (в SO₃)', lengthPm: 141.8, enthalpyKJ: 469, context: 'SO₃ (г)' },
  'Si-O': { key: 'Si-O', label: 'Si–O', lengthPm: 163, enthalpyKJ: 452, context: 'кварц, силикаты' },

  'Cl-O': {
    key: 'Cl-O',
    label: 'Cl–O (в ClO₂⁻)',
    lengthPm: 157,
    enthalpyKJ: 218,
    context: 'ион хлорита ClO₂⁻; связь длиннее — порядок связи ниже',
  },
  'Cl-O(ClO2)': {
    key: 'Cl-O(ClO2)',
    label: 'Cl–O (в ClO₂)',
    lengthPm: 147,
    enthalpyKJ: 272,
    context: 'радикал ClO₂ (г)',
  },

  'Na-Cl': {
    key: 'Na-Cl',
    label: 'Na–Cl',
    lengthPm: 236.1,
    enthalpyKJ: 412,
    context: 'ГАЗОВАЯ молекула NaCl; в кристалле расстояние Na⁺···Cl⁻ 282 пм (см. crystalData)',
  },
  'Mg-O': {
    key: 'Mg-O',
    label: 'Mg–O',
    lengthPm: 174.9,
    enthalpyKJ: 394,
    context: 'газовая молекула MgO; в периклазе Mg²⁺···O²⁻ 210.6 пм',
  },
  'Ca-O': {
    key: 'Ca-O',
    label: 'Ca–O',
    lengthPm: 182.2,
    enthalpyKJ: 464,
    context: 'газовая молекула CaO; в кристалле Ca²⁺···O²⁻ 240.5 пм',
  },
  'Fe-S': {
    key: 'Fe-S',
    label: 'Fe–S',
    lengthPm: 244.5,
    enthalpyKJ: 323,
    context: 'длина — троилит FeS (октаэдр FeS₆); энергия — газовая молекула FeS, D₀ = 323 кДж/моль',
    note: 'длина и энергия относятся к разным состояниям: в кристалле связь не молекулярная',
  },
  'Zn-Cl': {
    key: 'Zn-Cl',
    label: 'Zn–Cl',
    lengthPm: 205.5,
    enthalpyKJ: 320,
    context: 'линейная газовая молекула ZnCl₂; в кристалле α-ZnCl₂ Zn–Cl 229 пм (тетраэдр)',
    derived: true,
    note: 'энергия получена из энтальпии атомизации ZnCl₂ (г): (130.4 + 2·121.3 + 266.1)/2 ≈ 320 кДж/моль',
  },
  'Zn-S': {
    key: 'Zn-S',
    label: 'Zn–S',
    lengthPm: 234.2,
    enthalpyKJ: 205,
    context: 'сфалерит ZnS (тетраэдр ZnS₄); энергия — газовая молекула ZnS, D₀ ≈ 205 кДж/моль',
    note: 'энергия относится к двухатомной молекуле ZnS, не к кристаллу',
  },
  'P-P': { key: 'P-P', label: 'P–P', lengthPm: 221, enthalpyKJ: 201, context: 'тетраэдр P₄ (белый фосфор)' },
  'O-H...O': {
    key: 'O-H...O',
    label: 'O–H···O',
    lengthPm: 185,
    enthalpyKJ: 20,
    context: 'ВОДОРОДНАЯ связь между молекулами воды: расстояние H···O ≈ 185 пм (O···O ≈ 280 пм в жидкой воде, 276 пм во льду Ih), угол O–H···O ≈ 175°',
    note: 'это НЕ ковалентная связь: ковалентная O–H внутри молекулы вдвое короче (95.8 пм) и в ~23 раза прочнее. Энергия водородной связи в воде по разным оценкам 18–25 кДж/моль; взято 20.',
  },
  'Zn-O': {
    key: 'Zn-O',
    label: 'Zn–O',
    lengthPm: 208,
    enthalpyKJ: 159,
    context: 'аквакомплекс [Zn(H₂O)₆]²⁺ в растворе, КЧ 6 (EXAFS / дифракция: 208–211 пм); энергия — газовая молекула ZnO, D₀ ≈ 159 кДж/моль',
    note: 'длина и энергия относятся к РАЗНЫМ состояниям: длина — Zn²⁺–OH₂ в гидратной оболочке, энергия — двухатомная молекула ZnO (источники дают 159–250 кДж/моль). Для связи Zn²⁺–H₂O в растворе табличной энергии нет.',
  },
}

/** Длина связи, пм. */
export function bondLengthPm(key: BondKey): number {
  return BOND_DATA[key].lengthPm
}

/** Средняя энергия связи, кДж/моль. */
export function bondEnthalpyKJ(key: BondKey): number {
  return BOND_DATA[key].enthalpyKJ
}

// ─────────────────────────────────────────────────────────────────────────────
// Валентные углы (эксперимент; для идеальных форм VSEPR — точные значения)
// ─────────────────────────────────────────────────────────────────────────────

export type AngleKey =
  | 'water'
  | 'carbonate'
  | 'ammonia'
  | 'hydrogenSulfide'
  | 'phosphine'
  | 'sulfurDioxide'
  | 'sulfurRing'
  | 'carbonDioxide'
  | 'methane'
  | 'ozone'
  | 'nitrogenDioxide'
  | 'chlorineDioxide'
  | 'chlorite'
  | 'ethylene'
  | 'tetrahedral'
  | 'trigonalPlanar'
  | 'linear'
  | 'octahedral'

export type AngleDatum = {
  readonly key: AngleKey
  readonly label: string
  readonly deg: number
  readonly context: string
}

export const BOND_ANGLES: Readonly<Record<AngleKey, AngleDatum>> = {
  water: { key: 'water', label: 'H–O–H', deg: 104.45, context: 'H₂O (г), микроволновая спектроскопия' },
  ammonia: { key: 'ammonia', label: 'H–N–H', deg: 106.7, context: 'NH₃ (г), тригональная пирамида' },
  hydrogenSulfide: { key: 'hydrogenSulfide', label: 'H–S–H', deg: 92.1, context: 'H₂S (г)' },
  phosphine: { key: 'phosphine', label: 'H–P–H', deg: 93.5, context: 'PH₃ (г)' },
  sulfurDioxide: { key: 'sulfurDioxide', label: 'O–S–O', deg: 119.5, context: 'SO₂ (г), уголковая молекула' },
  sulfurRing: {
    key: 'sulfurRing',
    label: 'S–S–S',
    deg: 108.0,
    context: 'кольцо S₈ (ромбическая сера), корона D4d; двугранный угол 98.3° (Rettig & Trotter, 1987)',
  },
  carbonate: { key: 'carbonate', label: 'O–C–O', deg: 120, context: 'ион CO₃²⁻, плоский правильный треугольник (sp²-гибридизация)' },
  carbonDioxide: { key: 'carbonDioxide', label: 'O–C–O', deg: 180, context: 'CO₂ (г), линейная молекула' },
  methane: { key: 'methane', label: 'H–C–H', deg: 109.47, context: 'CH₄ (г), правильный тетраэдр' },
  ozone: { key: 'ozone', label: 'O–O–O', deg: 116.8, context: 'O₃ (г)' },
  nitrogenDioxide: { key: 'nitrogenDioxide', label: 'O–N–O', deg: 134.1, context: 'NO₂ (г), радикал' },
  chlorineDioxide: { key: 'chlorineDioxide', label: 'O–Cl–O', deg: 117.4, context: 'ClO₂ (г), радикал' },
  chlorite: { key: 'chlorite', label: 'O–Cl–O', deg: 110.5, context: 'ион ClO₂⁻' },
  ethylene: { key: 'ethylene', label: 'H–C–H', deg: 117.4, context: 'C₂H₄ (г)' },
  tetrahedral: { key: 'tetrahedral', label: 'тетраэдр', deg: 109.47, context: 'идеальная форма VSEPR, arccos(−1/3)' },
  trigonalPlanar: { key: 'trigonalPlanar', label: 'тригональная плоская', deg: 120, context: 'идеальная форма VSEPR' },
  linear: { key: 'linear', label: 'линейная', deg: 180, context: 'идеальная форма VSEPR' },
  octahedral: { key: 'octahedral', label: 'октаэдр', deg: 90, context: 'идеальная форма VSEPR' },
}

export function bondAngleDeg(key: AngleKey): number {
  return BOND_ANGLES[key].deg
}

// ─────────────────────────────────────────────────────────────────────────────
// Дипольные моменты, дебаи (D). CRC Handbook, 97th ed.
// ─────────────────────────────────────────────────────────────────────────────

export type DipoleDatum = {
  readonly formula: string
  /** Дипольный момент, D (1 D = 3.33564·10⁻³⁰ Кл·м). */
  readonly debye: number
  readonly note?: string
}

export const DIPOLE_MOMENTS: Readonly<Record<string, DipoleDatum>> = {
  H2O: { formula: 'H₂O', debye: 1.85 },
  NH3: { formula: 'NH₃', debye: 1.47 },
  HF: { formula: 'HF', debye: 1.826 },
  HCl: { formula: 'HCl', debye: 1.08 },
  HBr: { formula: 'HBr', debye: 0.82 },
  HI: { formula: 'HI', debye: 0.45 },
  H2S: { formula: 'H₂S', debye: 0.97 },
  SO2: { formula: 'SO₂', debye: 1.63 },
  CO: { formula: 'CO', debye: 0.11 },
  CO2: { formula: 'CO₂', debye: 0, note: 'линейная симметричная: связи полярны, молекула — нет' },
  CH4: { formula: 'CH₄', debye: 0, note: 'тетраэдр: векторная сумма четырёх C–H равна нулю' },
  H2: { formula: 'H₂', debye: 0, note: 'гомоядерная молекула' },
  N2: { formula: 'N₂', debye: 0, note: 'гомоядерная молекула' },
  O2: { formula: 'O₂', debye: 0, note: 'гомоядерная молекула' },
  Cl2: { formula: 'Cl₂', debye: 0, note: 'гомоядерная молекула' },
  NaCl: { formula: 'NaCl (г)', debye: 9.0, note: 'газовая ионная пара — предельно полярная связь' },
  ClO2: { formula: 'ClO₂', debye: 1.79 },
}

export function dipoleDebye(formula: string): number | null {
  return DIPOLE_MOMENTS[formula]?.debye ?? null
}
