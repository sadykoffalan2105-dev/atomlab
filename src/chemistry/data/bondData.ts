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
  | 'Si-Si'
  | 'Pb-O'
  | 'Mn-O(term)'
  | 'Mn-O(bridge)'
  | 'Mn-O(MnO4)'
  | 'Cl-O(term)'
  | 'Cl-O(bridge)'
  | 'O-O(O2 2-)'
  | 'O-H(H2O2)'
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

/**
 * Тип длины — справочники их различают, и смешивать их в одной подписи нельзя:
 *  • 'r_e' — равновесная (минимум потенциала);
 *  • 'r_0' — эффективная, из вращательных постоянных основного колебательного состояния;
 *  • 'r_g' — термически усреднённая (газовая электронография);
 *  • 'crystal' — межъядерное расстояние в кристалле (рентген/нейтроны при своей T).
 */
export type BondLengthType = 'r_e' | 'r_0' | 'r_g' | 'crystal'

export type BondDatum = {
  readonly key: BondKey
  /** Подпись формулой, как её пишут в тетради. */
  readonly label: string
  /** Длина связи, пм (тип — в lengthType; без него — справочное значение без различения r_e/r_0). */
  readonly lengthPm: number
  readonly lengthType?: BondLengthType
  /** Равновесная r_e, если основное значение — r_0 (вода: r_0 95.8, r_e 95.72). */
  readonly lengthRePm?: number
  /** Неэквивалентные длины той же связи в структуре (кварц: 160.5 ×2 и 161.4 ×2), пм. */
  readonly lengthsPm?: readonly number[]
  /**
   * Энергия заимствована у другой связи (табличной энергии для этой частицы нет) — ключ-донор.
   * Тест проверяет, что число совпадает с донором и что это объяснено в note.
   */
  readonly enthalpyFrom?: BondKey
  /** Средняя энергия связи, кДж/моль (> 0 — на разрыв). */
  readonly enthalpyKJ: number
  /** Где именно измерена длина/энергия — важно, если связь встречается в разных молекулах. */
  readonly context: string
  /** Помечает значения, полученные расчётом из ΔH°f, а не взятые из таблицы связей. */
  readonly derived?: boolean
  readonly note?: string
}

export const BOND_DATA: Readonly<Record<BondKey, BondDatum>> = {
  'H-H': {
    key: 'H-H',
    label: 'H–H',
    // r_e 74.14 пм (Huber & Herzberg 1979 / NIST CCCBDB)
    lengthPm: 74.14,
    lengthType: 'r_e',
    // D₂₉₈ = 435.8 кДж/моль (CRC 97th, «Bond dissociation energies»; школьное 436 — округление)
    enthalpyKJ: 435.8,
    context: 'H₂ (г)',
    note:
      'CRC даёт D₂₉₈(H–H) = 435.8; удвоенная ΔH°f(H, г) = 2·218.0 = 436.0 (NIST-JANAF) — расхождение 0.2 кДж ' +
      'между компиляциями, в пределах их погрешности. Циклы Гесса в thermoData считаются по ΔH°f (436.0).',
  },
  'F-F': { key: 'F-F', label: 'F–F', lengthPm: 141.2, enthalpyKJ: 159, context: 'F₂ (г)' },
  'Cl-Cl': { key: 'Cl-Cl', label: 'Cl–Cl', lengthPm: 198.8, enthalpyKJ: 243, context: 'Cl₂ (г)' },
  'Br-Br': { key: 'Br-Br', label: 'Br–Br', lengthPm: 228.1, enthalpyKJ: 193, context: 'Br₂ (г)' },
  'I-I': { key: 'I-I', label: 'I–I', lengthPm: 266.6, enthalpyKJ: 151, context: 'I₂ (г)' },
  'O=O': {
    key: 'O=O',
    label: 'O=O',
    // r_e = 120.75 пм (Huber & Herzberg 1979; NIST CCCBDB: 1.2075 Å); прежнее 120.8 — округление
    lengthPm: 120.75,
    lengthType: 'r_e',
    enthalpyKJ: 498,
    context: 'O₂ (г), триплет ³Σg⁻',
    note: 'энергия 498 — округление 2·ΔH°f(O, г) = 2·249.2 = 498.4 кДж/моль (NIST-JANAF, 298 K).',
  },
  'N#N': { key: 'N#N', label: 'N≡N', lengthPm: 109.77, enthalpyKJ: 945, context: 'N₂ (г)' },

  'H-F': { key: 'H-F', label: 'H–F', lengthPm: 91.7, enthalpyKJ: 565, context: 'HF (г)' },
  'H-Cl': { key: 'H-Cl', label: 'H–Cl', lengthPm: 127.46, enthalpyKJ: 431, context: 'HCl (г)' },
  'H-Br': { key: 'H-Br', label: 'H–Br', lengthPm: 141.44, enthalpyKJ: 366, context: 'HBr (г)' },
  'H-I': { key: 'H-I', label: 'H–I', lengthPm: 160.92, enthalpyKJ: 298, context: 'HI (г)' },

  'O-H': {
    key: 'O-H',
    label: 'O–H',
    // r_0 = 95.8 пм (NIST CCCBDB, эксперимент); равновесная r_e = 95.72 пм (Hoy & Bunker 1979) — в lengthRePm
    lengthPm: 95.8,
    lengthType: 'r_0',
    lengthRePm: 95.72,
    enthalpyKJ: 463,
    context: 'H₂O (г); средняя по двум связям',
    note:
      'средняя 463 — это (D(H–OH) + D(O–H в ·OH))/2 ≈ (497.1 + 429.9)/2 = 463.5; последовательные энергии ' +
      'разные — см. WATER_SEQUENTIAL_BDE_KJ.',
  },
  'N-H': { key: 'N-H', label: 'N–H', lengthPm: 101.2, enthalpyKJ: 391, context: 'NH₃ (г); средняя по трём связям' },
  'S-H': {
    key: 'S-H',
    label: 'S–H',
    lengthPm: 133.6,
    enthalpyKJ: 366.9,
    context: 'H₂S (г); средняя по двум связям',
    derived: true,
    note:
      'выведено из ΔH°f той же таблицы: энтальпия атомизации H₂S равна 277.2 + 2·218.0 + 20.6 = 733.8 кДж, ' +
      'на две связи — 366.9 кДж/моль. Часто печатаемое «среднее по соединениям» S–H 339 кДж/моль ' +
      'к самому сероводороду не относится.',
  },
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
  'N=O': {
    key: 'N=O',
    label: 'N=O',
    lengthPm: 115.1,
    enthalpyKJ: 630.6,
    context: 'NO (г)',
    derived: true,
    note:
      'выведено из ΔH°f той же таблицы: 472.7 + 249.2 − 91.3 = 630.6 кДж/моль (D₀(NO) ≈ 631). ' +
      'Табличные 607 кДж/моль — среднее «N=O» по многим соединениям, а не связь в самой NO.',
  },
  'O-O': {
    key: 'O-O',
    label: 'O–O',
    // r_0 = 147.5 пм — набор Redington, Olson & Cross 1962 (CRC «Structure of free molecules», CCCBDB)
    lengthPm: 147.5,
    lengthType: 'r_0',
    enthalpyKJ: 146,
    context: 'пероксид водорода H₂O₂ (г); энергия — среднее табличное O–O по пероксидам',
    note:
      'в самой H₂O₂ разрыв HO–OH стоит больше: 2·ΔH°f(OH, г) − ΔH°f(H₂O₂, г) = 2·37.3 + 136.3 = 210.9 кДж/моль; ' +
      '146 — усреднение по пероксидам (CRC).',
  },
  'O-H(H2O2)': {
    key: 'O-H(H2O2)',
    label: 'O–H (в H₂O₂)',
    // r_0 = 95.0 пм — тот же набор Redington 1962 (не смешивать с r_e)
    lengthPm: 95.0,
    lengthType: 'r_0',
    enthalpyKJ: 462.4,
    context: 'H₂O₂ (г); энергия — средняя O–H, выведенная из атомизации',
    derived: true,
    note:
      'атомизация H₂O₂ (г) = 2·218.0 + 2·249.2 + 136.3 = 1070.7 кДж/моль; минус O–O (146) и пополам на две ' +
      'связи O–H: (1070.7 − 146)/2 = 462.4 кДж/моль.',
  },
  'O-O(O2 2-)': {
    key: 'O-O(O2 2-)',
    label: 'O–O (в O₂²⁻)',
    // Na₂O₂: O–O 149 пм (Tallman & Margrave, J. Inorg. Nucl. Chem. 21 (1961) 215; Föppl 1957 — 1.49 Å)
    lengthPm: 149,
    lengthType: 'crystal',
    enthalpyKJ: 146,
    enthalpyFrom: 'O-O',
    context: 'пероксид-ион O₂²⁻ в Na₂O₂ (кристалл); порядок связи 1, как в H₂O₂',
    note:
      'табличной энергии связи для свободного O₂²⁻ нет (ион в газе неустойчив): взято среднее пероксидное ' +
      'O–O = 146 кДж/моль — только для сравнения порядка связи, в расчётах не используется.',
  },

  'S-S': {
    key: 'S-S',
    label: 'S–S',
    lengthPm: 205.5,
    enthalpyKJ: 266,
    context: 'длина — кольцо S₈ (ромбическая сера); энергия — среднее табличное значение S–S по соединениям',
    note:
      'длина и энергия относятся к разным вещам. В самой короне S₈ на атом приходится ровно одна связь S–S, ' +
      'поэтому её энергия равна ΔH°f(S, г) = 277.2 кДж/моль; 266 — усреднённое по дисульфидам значение CRC. ' +
      'Разница 11.2 кДж учтена в разборе остатка реакции so2_from_elements (thermoData).',
  },
  'S=O': { key: 'S=O', label: 'S=O', lengthPm: 143.1, enthalpyKJ: 522, context: 'SO₂ (г); средняя по двум связям' },
  'S=O(SO3)': {
    key: 'S=O(SO3)',
    label: 'S=O (в SO₃)',
    // r_e = 141.98 пм (CRC 97th, «Structure of free molecules»; Ortigoso et al. 1989), D₃h, три равные связи
    lengthPm: 141.98,
    lengthType: 'r_e',
    enthalpyKJ: 469,
    context: 'SO₃ (г), плоский треугольник D₃h; энергия — табличная средняя',
    note:
      'атомизация SO₃ (г) по ΔH°f этой же таблицы: 277.2 + 3·249.2 + 395.7 = 1420.5 кДж/моль, т. е. 473.5 на связь; ' +
      '469 — справочное среднее (разница 4.5 кДж — масштаб ошибки метода средних энергий).',
  },
  'Si-O': {
    key: 'Si-O',
    label: 'Si–O',
    // α-кварц, Levien, Prewitt & Weidner, Am. Mineral. 65 (1980) 920: 160.5 ×2 и 161.4 ×2 пм;
    // значения ПЕРЕСЧИТАНЫ из базиса crystalData.quartz (test-crystal-basis сверяет до 0.1 пм)
    lengthPm: 160.9,
    lengthType: 'crystal',
    lengthsPm: [160.5, 161.4],
    enthalpyKJ: 464.8,
    context: 'α-кварц: тетраэдр SiO₄, две пары неэквивалентных связей; lengthPm — среднее',
    derived: true,
    note:
      'энергия выведена из атомизации α-кварца: ΔH°f(Si, г) + 2·ΔH°f(O, г) − ΔH°f(SiO₂) = 450.0 + 498.4 + 910.7 = ' +
      '1859.1 кДж/моль на четыре связи Si–O → 464.8. В справочниках 452–466 (прежнее табличное 452). ' +
      'Четыре σ-связи Si–O (≈ 1859) выгоднее двух Si=O — поэтому каркас, а не молекула O=Si=O.',
  },
  'Si-Si': {
    key: 'Si-Si',
    label: 'Si–Si',
    // кремний, Fd-3m: a·√3/4 = 543.10·0.4330 = 235.2 пм (crystalData.si)
    lengthPm: 235.2,
    lengthType: 'crystal',
    enthalpyKJ: 225.0,
    context: 'кристаллический кремний (решётка алмаза), каждый атом — в тетраэдре из четырёх Si',
    derived: true,
    note:
      'на атом кремния в решётке алмаза приходится ровно ДВЕ связи (4 связи, каждая на двоих), поэтому ' +
      'E(Si–Si) = ΔH°f(Si, г)/2 = 450.0/2 = 225.0 кДж/моль; табличное среднее по силанам — 222 (CRC).',
  },
  'Pb-O': {
    key: 'Pb-O',
    label: 'Pb–O',
    // глёт α-PbO, P4/nmm: √((a/2)² + (z·c)²) при a = 397.5, c = 502.3 пм, z(Pb) = 0.2385 (Wyckoff 1963;
    // Pirovano et al. 2001 — z 0.23851) = 232.1 пм; test-crystal-basis пересчитывает из базиса
    lengthPm: 232.1,
    lengthType: 'crystal',
    enthalpyKJ: 165.9,
    context: 'глёт (красный α-PbO): квадратная пирамида PbO₄, четыре равные связи; Pb–O 231.8 ± 0.5 в литературе',
    derived: true,
    note:
      'энергия — атомизация глёта на четыре связи: (195.2 + 249.2 + 219.0)/4 = 165.9 кДж/моль. В массикоте ' +
      '(β-PbO) связи неравные: 222.1, 224.9 и 248.1 ×2 пм (Hill 1985, пересчёт из базиса crystalData.massicot).',
  },
  'Mn-O(term)': {
    key: 'Mn-O(term)',
    label: 'Mn=O (концевая)',
    // Mn₂O₇, кристалл при 173 K: Simon, Dronskowski, Krebs & Hettich, Angew. Chem. 99 (1987) 160 — среднее 158.5 пм
    lengthPm: 158.5,
    lengthType: 'crystal',
    enthalpyKJ: 362,
    context: 'Mn₂O₇: шесть концевых Mn–O двух тетраэдров MnO₄; энергия — двухатомная MnO (г)',
    note:
      'для Mn₂O₇ табличных энергий связей нет (и ΔH°f только оценочная); 362 кДж/моль — D₀ двухатомной MnO ' +
      '(Luo, «Comprehensive Handbook of Chemical Bond Energies», 2007) — к оксиду Mn(VII) напрямую не относится.',
  },
  'Mn-O(bridge)': {
    key: 'Mn-O(bridge)',
    label: 'Mn–O (мостиковая)',
    // Simon et al. 1987: мостик Mn–O–Mn 177 пм, ∠ 120.7°
    lengthPm: 177,
    lengthType: 'crystal',
    enthalpyKJ: 362,
    enthalpyFrom: 'Mn-O(term)',
    context: 'Mn₂O₇: мостик O₃Mn–O–MnO₃ (два тетраэдра по общей вершине)',
    note: 'энергия заимствована у концевой связи (двухатомная MnO) — только чтобы у записи было значение; длиннее — значит слабее.',
  },
  'Mn-O(MnO4)': {
    key: 'Mn-O(MnO4)',
    label: 'Mn–O (в MnO₄⁻)',
    // KMnO₄: Palenik, Inorg. Chem. 6 (1967) 503 — Mn–O 162.9 пм (среднее по тетраэдру)
    lengthPm: 162.9,
    lengthType: 'crystal',
    enthalpyKJ: 362,
    enthalpyFrom: 'Mn-O(term)',
    context: 'перманганат-ион MnO₄⁻ (KMnO₄), правильный тетраэдр, Mn(+7) d⁰; порядок связи 1¾',
    note: 'энергия заимствована у двухатомной MnO — табличной энергии для MnO₄⁻ нет.',
  },
  'Cl-O(term)': {
    key: 'Cl-O(term)',
    label: 'Cl=O (концевая)',
    // Cl₂O₇ (г), электронография: Beagley, Acta Cryst. / Trans. Faraday Soc. 61 (1965) 1821 — 140.5 пм (r_g)
    lengthPm: 140.5,
    lengthType: 'r_g',
    enthalpyKJ: 269,
    context: 'Cl₂O₇ (г): шесть концевых Cl–O; энергия — двухатомный радикал ClO',
    note:
      'в кристалле (Simon & Borrmann 1988) длины другие — с газовыми углами их не смешивать. Энергия 269 кДж/моль — ' +
      'D₂₉₈ радикала ClO (CRC 97th / Luo 2007), к Cl₂O₇ напрямую не относится: вещество эндотермично.',
  },
  'Cl-O(bridge)': {
    key: 'Cl-O(bridge)',
    label: 'Cl–O (мостиковая)',
    // Beagley 1965: мостик Cl–O–Cl 170.9 пм (r_g), ∠Cl–O–Cl 118.6°
    lengthPm: 170.9,
    lengthType: 'r_g',
    enthalpyKJ: 269,
    enthalpyFrom: 'Cl-O(term)',
    context: 'Cl₂O₇ (г): мостик O₃Cl–O–ClO₃',
    note: 'энергия заимствована у концевой (радикал ClO); мостиковая связь длиннее и слабее — по ней молекула и рвётся.',
  },

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
    enthalpyKJ: 338,
    context: 'газовая молекула MgO; в периклазе Mg²⁺···O²⁻ 210.6 пм',
    derived: true,
    note:
      'энергия выведена по Гессу из ΔH°f той же таблицы: 147.1 + 249.2 − 58.2 = 338 кДж/моль, ' +
      'где ΔH°f(MgO, г) = +58.2 (NIST-JANAF). В литературе D₀(MgO) 338…358 кДж/моль.',
  },
  'Ca-O': {
    key: 'Ca-O',
    label: 'Ca–O',
    lengthPm: 182.2,
    enthalpyKJ: 383,
    context: 'газовая молекула CaO; в кристалле Ca²⁺···O²⁻ 240.5 пм',
    derived: true,
    note:
      'энергия выведена по Гессу из ΔH°f той же таблицы: 177.8 + 249.2 − 43.9 = 383 кДж/моль, ' +
      'где ΔH°f(CaO, г) = +43.9 (NIST-JANAF) — газовая CaO эндотермична. Luo даёт D₀ = 383.3 ± 20.',
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
  | 'hydrogenPeroxideOOH'
  | 'sulfurTrioxide'
  | 'quartzSiOSi'
  | 'quartzOSiO'
  | 'mn2o7MnOMn'
  | 'cl2o7ClOCl'
  | 'cl2o7OClO'

export type AngleDatum = {
  readonly key: AngleKey
  readonly label: string
  readonly deg: number
  readonly context: string
  /** Тип геометрии, из которой взят угол (r_e / r_0 / r_g / crystal) — см. BondLengthType. */
  readonly angleType?: BondLengthType
  /** Равновесный угол, если основное значение — r_0 (вода: 104.5 против r_e 104.52). */
  readonly degRe?: number
}

export const BOND_ANGLES: Readonly<Record<AngleKey, AngleDatum>> = {
  // r_0-набор воды: 95.8 пм / 104.5° (NIST CCCBDB); равновесные r_e 95.72 пм / 104.52° (Hoy & Bunker 1979).
  // Прежнее 104.45 — смесь наборов; в одной подписи с O–H 95.8 обязан стоять r_0-угол.
  water: {
    key: 'water',
    label: 'H–O–H',
    deg: 104.5,
    angleType: 'r_0',
    degRe: 104.52,
    context: 'H₂O (г), микроволновая спектроскопия (r_0); r_e = 104.52°',
  },
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
  // H₂O₂ (г), r_0-набор Redington, Olson & Cross, J. Chem. Phys. 36 (1962) 1311 (CRC / CCCBDB) — вместе с O–O 147.5, O–H 95.0
  hydrogenPeroxideOOH: {
    key: 'hydrogenPeroxideOOH',
    label: 'O–O–H',
    deg: 94.8,
    angleType: 'r_0',
    context: 'H₂O₂ (г), набор Redington 1962; современные r_e-данные дают 95–102° (разброс называется в уроке)',
  },
  // SO₃ (г), D₃h — угол задан симметрией (CRC «Structure of free molecules»)
  sulfurTrioxide: { key: 'sulfurTrioxide', label: 'O–S–O', deg: 120, context: 'SO₃ (г), плоский правильный треугольник D₃h' },
  // α-кварц, Levien et al. 1980: ∠Si–O–Si = 143.7° — пересчитывается из базиса crystalData.quartz
  quartzSiOSi: { key: 'quartzSiOSi', label: 'Si–O–Si', deg: 143.7, angleType: 'crystal', context: 'α-кварц, мостиковый кислород' },
  // α-кварц: тетраэдр SiO₄ слегка искажён (108.8…110.5°), среднее — тетраэдрическое
  quartzOSiO: { key: 'quartzOSiO', label: 'O–Si–O', deg: 109.5, angleType: 'crystal', context: 'α-кварц, тетраэдр SiO₄ (среднее; 108.8–110.5°)' },
  // Mn₂O₇, Simon, Dronskowski, Krebs & Hettich 1987 (кристалл)
  mn2o7MnOMn: { key: 'mn2o7MnOMn', label: 'Mn–O–Mn', deg: 120.7, angleType: 'crystal', context: 'Mn₂O₇: два тетраэдра MnO₄ по общей вершине' },
  // Cl₂O₇ (г), электронография Beagley 1965 — один газовый набор с длинами 140.5 / 170.9
  cl2o7ClOCl: { key: 'cl2o7ClOCl', label: 'Cl–O–Cl', deg: 118.6, angleType: 'r_g', context: 'Cl₂O₇ (г), мостик' },
  cl2o7OClO: { key: 'cl2o7OClO', label: 'O–Cl–O', deg: 115.2, angleType: 'r_g', context: 'Cl₂O₇ (г), между концевыми O одного ClO₃' },
}

export function bondAngleDeg(key: AngleKey): number {
  return BOND_ANGLES[key].deg
}

// ─────────────────────────────────────────────────────────────────────────────
// Двугранные (торсионные) углы — для неплоских молекул (H₂O₂: гош-конформация C₂)
// ─────────────────────────────────────────────────────────────────────────────

export type DihedralKey = 'hydrogenPeroxideGas' | 'hydrogenPeroxideCrystal'

export type DihedralDatum = {
  readonly key: DihedralKey
  /** Четвёрка атомов, задающая угол. */
  readonly label: string
  readonly deg: number
  readonly angleType?: BondLengthType
  readonly context: string
  readonly note?: string
}

export const DIHEDRAL_ANGLES: Readonly<Record<DihedralKey, DihedralDatum>> = {
  // Redington et al. 1962 (r_0, тот же набор, что O–O 147.5 / O–H 95.0 / ∠OOH 94.8)
  hydrogenPeroxideGas: {
    key: 'hydrogenPeroxideGas',
    label: 'H–O–O–H',
    deg: 111.5,
    angleType: 'r_0',
    context: 'H₂O₂ (г), гош-конформация C₂',
    note: 'современные равновесные расчёты и ИК-спектры дают 111–120° (барьеры транс 4.6 и цис 29 кДж/моль): молекула не плоская.',
  },
  // Кристалл H₂O₂ при 110 K: Busing & Levy, J. Chem. Phys. 42 (1965) 3054 — 90.2°
  hydrogenPeroxideCrystal: {
    key: 'hydrogenPeroxideCrystal',
    label: 'H–O–O–H',
    deg: 90.2,
    angleType: 'crystal',
    context: 'кристаллический H₂O₂ (нейтронография, 110 K): водородные связи закручивают молекулу',
    note: 'разница с газом (111.5°) — эффект кристаллического окружения; в гидратах и комплексах встречается 90–180°.',
  },
}

export function dihedralAngleDeg(key: DihedralKey): number {
  return DIHEDRAL_ANGLES[key].deg
}

// ─────────────────────────────────────────────────────────────────────────────
// Последовательные энергии связей воды (298 K) — отрыв первого и второго H
// ─────────────────────────────────────────────────────────────────────────────

/**
 * H₂O → H + ·OH и ·OH → O + H. Обе величины — по ΔH°f этой же базы (NIST-JANAF / CRC 97th):
 *   D(H–OH) = ΔH°f(H) + ΔH°f(OH) − ΔH°f(H₂O, г) = 218.0 + 37.3 + 241.8 = 497.1 кДж/моль (CRC: 497.1);
 *   D(O–H в ·OH) = ΔH°f(O) + ΔH°f(H) − ΔH°f(OH) = 249.2 + 218.0 − 37.3 = 429.9 кДж/моль.
 * Сумма 927.0 = энтальпия атомизации H₂O (г) — test-chem-data это сверяет.
 * Встречающееся «428.0» для ·OH — значение другой компиляции (D₀-подобное), с ΔH°f(OH) = 37.3 не сходится
 * на 1.9 кДж, поэтому в ядре 429.9.
 */
export const WATER_SEQUENTIAL_BDE_KJ = {
  /** H–OH: отрыв первого атома H */
  first: 497.1,
  /** O–H в радикале ·OH: отрыв второго */
  second: 429.9,
} as const

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
  // CRC 97th: 1.8546 D (газ) → 1.855; прежнее 1.85 — округление
  H2O: { formula: 'H₂O', debye: 1.855 },
  // Cohen & Pickett, J. Mol. Spectrosc. 86 (1981) 229 — газ; старое 2.26 D измерено в диоксане
  H2O2: {
    formula: 'H₂O₂',
    debye: 1.57,
    note: 'газ (микроволновый спектр); часто печатаемое 2.26 D получено в растворе диоксана и с газовой геометрией несовместимо',
  },
  SO3: { formula: 'SO₃', debye: 0, note: 'плоский правильный треугольник D₃h: три вектора S–O гасят друг друга' },
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

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия реагентов и промежуточных частиц (этап 11): только длины и углы
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Для этих частиц НЕТ честной табличной энергии каждой связи (S–O в H₂SO₄, P–O в P₄O₁₀…),
 * поэтому они живут не в BOND_DATA (там энергия обязательна), а здесь — только геометрия.
 * Каждая запись — ОДИН набор одного метода (lengthType), наборы не смешиваются.
 * Ключи bondsPm / anglesDeg — подписи, как на доске: 'S=O', 'S–O(H)', '∠O=S=O'.
 */
export type ReagentGeometryKey = 'h2so4' | 'hclo4' | 'p4o10' | 'sulfate' | 's3o9' | 'peroxide' | 'permanganate'

export type ReagentGeometry = {
  readonly key: ReagentGeometryKey
  readonly formula: string
  /** Состояние, в котором измерена геометрия. */
  readonly phase: 'г' | 'тв' | 'ион в кристалле'
  readonly lengthType: BondLengthType
  /** Длины связей, пм. */
  readonly bondsPm: Readonly<Record<string, number>>
  /** Валентные углы, градусы (того же набора). */
  readonly anglesDeg: Readonly<Record<string, number>>
  /** Число связей каждого сорта в частице (для проверки состава). */
  readonly bondCounts: Readonly<Record<string, number>>
  /** Точечная группа симметрии частицы. */
  readonly pointGroup: string
  readonly source: string
  readonly note?: string
}

export const REAGENT_GEOMETRY: Readonly<Record<ReagentGeometryKey, ReagentGeometry>> = {
  // Kuczkowski, Suenram & Lovas, J. Am. Chem. Soc. 103 (1981) 2561 — микроволновый спектр паров H₂SO₄
  h2so4: {
    key: 'h2so4',
    formula: 'H₂SO₄',
    phase: 'г',
    lengthType: 'r_0',
    bondsPm: { 'S=O': 142.2, 'S–O(H)': 157.4, 'O–H': 97.0 },
    anglesDeg: { '∠O=S=O': 123.3, '∠HO–S–OH': 101.3, '∠S–O–H': 108.5 },
    bondCounts: { 'S=O': 2, 'S–O(H)': 2, 'O–H': 2 },
    pointGroup: 'C₂',
    source: 'Kuczkowski, Suenram & Lovas, J. Am. Chem. Soc. 103 (1981) 2561 (микроволны, газ)',
    note:
      'искажённый тетраэдр вокруг S: две короткие S=O и две длинные S–OH; O–H 97 ± 1 пм — точность хуже, ' +
      'чем у S–O. В жидкой кислоте молекулы связаны водородными связями — геометрия газа для неё приближённая.',
  },
  // Clark, Beagley, Cruickshank & Hewitt, J. Chem. Soc. A (1970) 872 — электронография паров HClO₄
  hclo4: {
    key: 'hclo4',
    formula: 'HClO₄',
    phase: 'г',
    lengthType: 'r_g',
    bondsPm: { 'Cl=O': 140.8, 'Cl–O(H)': 163.5 },
    anglesDeg: { '∠O=Cl=O': 112.8 },
    bondCounts: { 'Cl=O': 3, 'Cl–O(H)': 1, 'O–H': 1 },
    pointGroup: 'Cs',
    source: 'Clark, Beagley, Cruickshank & Hewitt, J. Chem. Soc. A (1970) 872 (электронография, газ)',
    note:
      'тетраэдр ClO₃(OH): три короткие Cl=O и одна длинная Cl–OH (в литературе 163–164 пм). O–H электронография ' +
      'не разрешает — длину O–H здесь не даём; сцена берёт O–H кислородных кислот как у H₂SO₄ (97 пм) и пишет это в note.',
  },
  // Beagley, Cruickshank, Hewitt & Jost, Trans. Faraday Soc. 65 (1969) 1219 — электронография паров P₄O₁₀
  p4o10: {
    key: 'p4o10',
    formula: 'P₄O₁₀',
    phase: 'г',
    lengthType: 'r_g',
    bondsPm: { 'P=O': 142.9, 'P–O(мост)': 160.4 },
    anglesDeg: { '∠P–O–P': 123.5, '∠O–P–O(мост)': 101.6 },
    bondCounts: { 'P=O': 4, 'P–O(мост)': 12 },
    pointGroup: 'Td',
    source: 'Beagley, Cruickshank, Hewitt & Jost, Trans. Faraday Soc. 65 (1969) 1219 (электронография, газ)',
    note: 'каркас адамантана: тетраэдр P₄, шесть мостиковых O над рёбрами, четыре концевых P=O наружу.',
  },
  // Сульфат-ион: среднее по безводным сульфатам (тенардит Na₂SO₄, K₂SO₄, барит BaSO₄) — 146–148 пм
  sulfate: {
    key: 'sulfate',
    formula: 'SO₄²⁻',
    phase: 'ион в кристалле',
    lengthType: 'crystal',
    bondsPm: { 'S–O': 147 },
    anglesDeg: { '∠O–S–O': 109.47 },
    bondCounts: { 'S–O': 4 },
    pointGroup: 'Td',
    source:
      'Greenwood & Earnshaw, «Chemistry of the Elements», 2nd ed. (1997), §15.2.6; Hawthorne & Ferguson, Can. Mineral. 13 (1975) 181 (тенардит)',
    note:
      'четыре равные связи, порядок 1½ (делокализация заряда 2−); в конкретных кристаллах 146–148 пм и искажение ' +
      'тетраэдра на 1–2°. Короче S–OH (157) и длиннее S=O (142) кислоты — промежуточный порядок связи.',
  },
  // γ-SO₃ = циклический тример S₃O₉ (кристалл): McDonald & Cruickshank, Acta Cryst. 22 (1967) 48
  s3o9: {
    key: 's3o9',
    formula: 'S₃O₉',
    phase: 'тв',
    lengthType: 'crystal',
    bondsPm: { 'S–O(кольцо)': 162, 'S=O(конц.)': 140 },
    anglesDeg: {},
    bondCounts: { 'S–O(кольцо)': 6, 'S=O(конц.)': 6 },
    pointGroup: 'C₃v',
    source: 'McDonald & Cruickshank, Acta Cryst. 22 (1967) 48; Greenwood & Earnshaw (1997), §15.2.5',
    note:
      'кольцо (–SO₂–O–)₃ в форме «кресла», каждый S — тетраэдр SO₄ (две концевые S=O, два мостиковых O). ' +
      'Углы кольца здесь не даём — сцена строит тетраэдры по идеальному углу и называет это схемой.',
  },
  // Пероксид-ион O₂²⁻ в Na₂O₂ / BaO₂ — число берётся из BOND_DATA (одно место истины)
  peroxide: {
    key: 'peroxide',
    formula: 'O₂²⁻',
    phase: 'ион в кристалле',
    lengthType: 'crystal',
    bondsPm: { 'O–O': BOND_DATA['O-O(O2 2-)'].lengthPm },
    anglesDeg: {},
    bondCounts: { 'O–O': 1 },
    pointGroup: 'D∞h',
    source: 'Tallman & Margrave, J. Inorg. Nucl. Chem. 21 (1961) 215; Föppl 1957 (Na₂O₂) — см. BOND_DATA «O-O(O2 2-)»',
    note:
      'структура Na₂O₂ (P-62m) в ядро не внесена — базис из первичного CIF не сверен; сцена показывает формульную ' +
      'единицу 2 Na⁺ + O₂²⁻ с радиусами Шеннона и называет это схемой.',
  },
  // Перманганат-ион — число из BOND_DATA (Palenik 1967)
  permanganate: {
    key: 'permanganate',
    formula: 'MnO₄⁻',
    phase: 'ион в кристалле',
    lengthType: 'crystal',
    bondsPm: { 'Mn–O': BOND_DATA['Mn-O(MnO4)'].lengthPm },
    anglesDeg: { '∠O–Mn–O': 109.47 },
    bondCounts: { 'Mn–O': 4 },
    pointGroup: 'Td',
    source: 'Palenik, Inorg. Chem. 6 (1967) 503 (KMnO₄) — см. BOND_DATA «Mn-O(MnO4)»',
  },
}

/** Длина связи частицы-реагента, пм; бросает на опечатке — молчаливый 0 скрыл бы ошибку. */
export function reagentBondPm(key: ReagentGeometryKey, bond: string): number {
  const v = REAGENT_GEOMETRY[key].bondsPm[bond]
  if (v == null) throw new Error(`bondData: у «${key}» нет связи «${bond}»`)
  return v
}

/** Валентный угол частицы-реагента, градусы; бросает на опечатке. */
export function reagentAngleDeg(key: ReagentGeometryKey, angle: string): number {
  const v = REAGENT_GEOMETRY[key].anglesDeg[angle]
  if (v == null) throw new Error(`bondData: у «${key}» нет угла «${angle}»`)
  return v
}
