/** Данные режимов органической лаборатории (изомеры и реэкспорт каталога сборки). */

export type IrPeak = {
  /** см⁻¹ */
  wavenumber: number
  /** 0..1 */
  intensity: number
  label: string
}

export type IsomerCandidate = {
  id: string
  nameRu: string
  nameEn: string
  nameUz: string
  formula: string
  /** Верный ответ для текущего задания */
  correct: boolean
  skeleton: 'n' | 'iso' | 'neo' | 'sec' | 'tert' | 'ether' | 'alcohol' | 'ring'
  functionalGroups: readonly string[]
  irPeaks: readonly IrPeak[]
  /** Краткое свойство / «катастрофа» */
  hazardRu: string
  hazardEn: string
  hazardUz: string
  color: string
}

export type IsomerChallenge = {
  id: string
  formula: string
  targetCount: number
  titleRu: string
  titleEn: string
  titleUz: string
  hintRu: string
  hintEn: string
  hintUz: string
  candidates: readonly IsomerCandidate[]
}

const OH_PEAK: IrPeak = { wavenumber: 3350, intensity: 0.92, label: 'O–H' }
const CH_PEAK: IrPeak = { wavenumber: 2920, intensity: 0.7, label: 'C–H' }
const CO_PEAK: IrPeak = { wavenumber: 1100, intensity: 0.55, label: 'C–O' }
const CO_ETHER: IrPeak = { wavenumber: 1120, intensity: 0.65, label: 'C–O (эфир)' }
const NO_OH: IrPeak[] = [CH_PEAK, CO_ETHER]

const PALETTE = ['#7dd3fc', '#a5b4fc', '#c4b5fd', '#f0abfc', '#fda4af', '#fcd34d', '#86efac', '#5eead4', '#fdba74']

type CandRow = readonly [
  id: string,
  ru: string,
  en: string,
  uz: string,
  formula: string,
  correct: boolean,
  skeleton: IsomerCandidate['skeleton'],
  noteRu: string,
  noteEn: string,
  noteUz: string,
]

/** Карточки-кандидаты из строк [id, RU, EN, UZ, формула, верно?, тип скелета, пояснение RU/EN/UZ]. */
function cands(rows: readonly CandRow[]): IsomerCandidate[] {
  return rows.map(([id, nameRu, nameEn, nameUz, formula, correct, skeleton, hazardRu, hazardEn, hazardUz], i) => ({
    id,
    nameRu,
    nameEn,
    nameUz,
    formula,
    correct,
    skeleton,
    functionalGroups: skeleton === 'ring' ? ['cycloalkane'] : ['alkane'],
    irPeaks: [CH_PEAK],
    hazardRu,
    hazardEn,
    hazardUz,
    color: PALETTE[i % PALETTE.length]!,
  }))
}

/** Девять изомеров C₇H₁₆ (Kimyo 10, с. 43); `c5` — главная цепь из 5 C (задача с. 45). */
const C7H16_ROWS: readonly (readonly [...CandRow, c5: boolean])[] = [
  ['n-heptane', 'Гептан', 'Heptane', 'Geptan', 'C₇H₁₆', true, 'n', 'Цепь из 7 C без ветвей.', 'Seven-carbon chain, no branches.', 'Shoxsiz 7 C zanjir.', false],
  ['2-2-dimethylpentane', '2,2-Диметилпентан', '2,2-Dimethylpentane', '2,2-Dimetilpentan', 'C₇H₁₆', true, 'neo', 'Цепь 5 C, два метила у C2.', 'Five-carbon chain, two methyls on C2.', '5 C zanjir, C2 da ikki metil.', true],
  ['2-methylhexane', '2-Метилгексан', '2-Methylhexane', '2-Metilgeksan', 'C₇H₁₆', true, 'iso', 'Цепь 6 C, метил у C2.', 'Six-carbon chain, methyl on C2.', '6 C zanjir, C2 da metil.', false],
  ['2-3-dimethylpentane', '2,3-Диметилпентан', '2,3-Dimethylpentane', '2,3-Dimetilpentan', 'C₇H₁₆', true, 'iso', 'Цепь 5 C, метилы у C2 и C3.', 'Five-carbon chain, methyls on C2 and C3.', '5 C zanjir, C2 va C3 da metil.', true],
  ['3-methylhexane', '3-Метилгексан', '3-Methylhexane', '3-Metilgeksan', 'C₇H₁₆', true, 'iso', 'Цепь 6 C, метил у C3.', 'Six-carbon chain, methyl on C3.', '6 C zanjir, C3 da metil.', false],
  ['2-4-dimethylpentane', '2,4-Диметилпентан', '2,4-Dimethylpentane', '2,4-Dimetilpentan', 'C₇H₁₆', true, 'iso', 'Цепь 5 C, метилы у C2 и C4.', 'Five-carbon chain, methyls on C2 and C4.', '5 C zanjir, C2 va C4 da metil.', true],
  ['2-2-3-trimethylbutane', '2,2,3-Триметилбутан', '2,2,3-Trimethylbutane', '2,2,3-Trimetilbutan', 'C₇H₁₆', true, 'neo', 'Цепь 4 C, три метила.', 'Four-carbon chain, three methyls.', '4 C zanjir, uchta metil.', false],
  ['3-3-dimethylpentane', '3,3-Диметилпентан', '3,3-Dimethylpentane', '3,3-Dimetilpentan', 'C₇H₁₆', true, 'neo', 'Цепь 5 C, два метила у C3.', 'Five-carbon chain, two methyls on C3.', '5 C zanjir, C3 da ikki metil.', true],
  ['3-ethylpentane', '3-Этилпентан', '3-Ethylpentane', '3-Etilpentan', 'C₇H₁₆', true, 'iso', 'Цепь 5 C, этил у C3.', 'Five-carbon chain, ethyl on C3.', '5 C zanjir, C3 da etil.', true],
]

export const ISOMER_CHALLENGES: readonly IsomerChallenge[] = [
  {
    id: 'c5h12',
    formula: 'C₅H₁₂',
    targetCount: 3,
    titleRu: 'Собери все изомеры пентана',
    titleEn: 'Collect all pentane isomers',
    titleUz: 'Pentaning barcha izomerlarini yigʻing',
    hintRu: 'Три структурных изомера: н-, изо- и неопентан.',
    hintEn: 'Three structural isomers: n-, iso- and neopentane.',
    hintUz: 'Uchta tuzilish izomeri: n-, izo- va neopentan.',
    candidates: [
      {
        id: 'n-pentane',
        nameRu: 'н-Пентан',
        nameEn: 'n-Pentane',
        nameUz: 'n-Pentan',
        formula: 'C₅H₁₂',
        correct: true,
        skeleton: 'n',
        functionalGroups: ['alkane'],
        irPeaks: [CH_PEAK],
        hazardRu: 'Легковоспламеняющаяся жидкость, топливо.',
        hazardEn: 'Flammable liquid, fuel component.',
        hazardUz: 'Yonuvchan suyuqlik, yoqilgʻi.',
        color: '#7dd3fc',
      },
      {
        id: 'isopentane',
        nameRu: '2-Метилбутан (изопентан)',
        nameEn: '2-Methylbutane (isopentane)',
        nameUz: '2-Metilbutan (izopentan)',
        formula: 'C₅H₁₂',
        correct: true,
        skeleton: 'iso',
        functionalGroups: ['alkane'],
        irPeaks: [{ wavenumber: 2960, intensity: 0.75, label: 'C–H' }],
        hazardRu: 'Более низкая tкип., чем у н-пентана.',
        hazardEn: 'Lower boiling point than n-pentane.',
        hazardUz: 'n-Pentanga qaraganda pastroq qaynash nuqtasi.',
        color: '#a5b4fc',
      },
      {
        id: 'neopentane',
        nameRu: '2,2-Диметилпропан (неопентан)',
        nameEn: '2,2-Dimethylpropane (neopentane)',
        nameUz: '2,2-Dimetilpropan (neopentan)',
        formula: 'C₅H₁₂',
        correct: true,
        skeleton: 'neo',
        functionalGroups: ['alkane'],
        irPeaks: [{ wavenumber: 2955, intensity: 0.68, label: 'C–H' }],
        hazardRu: 'Компактная «клетка» — газ при комнатной t.',
        hazardEn: 'Compact cage — gas at room temperature.',
        hazardUz: 'Ixcham tuzilma — xona haroratida gaz.',
        color: '#c4b5fd',
      },
      {
        id: 'hexane-trap',
        nameRu: 'н-Гексан',
        nameEn: 'n-Hexane',
        nameUz: 'n-Geksan',
        formula: 'C₆H₁₄',
        correct: false,
        skeleton: 'n',
        functionalGroups: ['alkane'],
        irPeaks: [CH_PEAK],
        hazardRu: 'Ловушка: другая формула!',
        hazardEn: 'Trap: different formula!',
        hazardUz: 'Tuzoq: boshqa formula!',
        color: '#94a3b8',
      },
    ],
  },
  {
    id: 'c6h14',
    formula: 'C₆H₁₄',
    targetCount: 5,
    titleRu: 'Собери все изомеры гексана',
    titleEn: 'Collect all hexane isomers',
    titleUz: 'Geksanning barcha izomerlarini yigʻing',
    hintRu: 'Пять структурных изомеров: н-гексан, 2- и 3-метилпентан, 2,3- и 2,2-диметилбутан.',
    hintEn: 'Five structural isomers: n-hexane, 2- and 3-methylpentane, 2,3- and 2,2-dimethylbutane.',
    hintUz: 'Besh tuzilish izomeri: n-geksan, 2- va 3-metilpentan, 2,3- va 2,2-dimetilbutan.',
    candidates: [
      {
        id: 'n-hexane',
        nameRu: 'н-Гексан',
        nameEn: 'n-Hexane',
        nameUz: 'n-Geksan',
        formula: 'C₆H₁₄',
        correct: true,
        skeleton: 'n',
        functionalGroups: ['alkane'],
        irPeaks: [CH_PEAK],
        hazardRu: 'Линейная цепь CH₃–(CH₂)₄–CH₃.',
        hazardEn: 'Linear chain CH₃–(CH₂)₄–CH₃.',
        hazardUz: 'Chiziqli zanjir CH₃–(CH₂)₄–CH₃.',
        color: '#7dd3fc',
      },
      {
        id: '2-methylpentane',
        nameRu: '2-Метилпентан',
        nameEn: '2-Methylpentane',
        nameUz: '2-Metilpentan',
        formula: 'C₆H₁₄',
        correct: true,
        skeleton: 'iso',
        functionalGroups: ['alkane'],
        irPeaks: [{ wavenumber: 2960, intensity: 0.75, label: 'C–H' }],
        hazardRu: 'Метил у 2-го углерода пентановой цепи.',
        hazardEn: 'Methyl at carbon 2 of a pentane chain.',
        hazardUz: 'Pentan zanjirining 2-uglerodida metil.',
        color: '#a5b4fc',
      },
      {
        id: '3-methylpentane',
        nameRu: '3-Метилпентан',
        nameEn: '3-Methylpentane',
        nameUz: '3-Metilpentan',
        formula: 'C₆H₁₄',
        correct: true,
        skeleton: 'iso',
        functionalGroups: ['alkane'],
        irPeaks: [{ wavenumber: 2958, intensity: 0.72, label: 'C–H' }],
        hazardRu: 'Метил у 3-го (среднего) углерода.',
        hazardEn: 'Methyl at carbon 3 (middle).',
        hazardUz: '3-uglerodda (oʻrtada) metil.',
        color: '#c4b5fd',
      },
      {
        id: '2-3-dimethylbutane',
        nameRu: '2,3-Диметилбутан',
        nameEn: '2,3-Dimethylbutane',
        nameUz: '2,3-Dimetilbutan',
        formula: 'C₆H₁₄',
        correct: true,
        skeleton: 'iso',
        functionalGroups: ['alkane'],
        irPeaks: [{ wavenumber: 2955, intensity: 0.7, label: 'C–H' }],
        hazardRu: 'Два соседних разветвления на бутановой цепи.',
        hazardEn: 'Two adjacent branches on a butane chain.',
        hazardUz: 'Butan zanjirida ikki qoʻshni shox.',
        color: '#f0abfc',
      },
      {
        id: '2-2-dimethylbutane',
        nameRu: '2,2-Диметилбутан',
        nameEn: '2,2-Dimethylbutane',
        nameUz: '2,2-Dimetilbutan',
        formula: 'C₆H₁₄',
        correct: true,
        skeleton: 'neo',
        functionalGroups: ['alkane'],
        irPeaks: [{ wavenumber: 2950, intensity: 0.68, label: 'C–H' }],
        hazardRu: 'Четвертичный углерод: два метила на одном атоме.',
        hazardEn: 'Quaternary carbon: two methyls on one atom.',
        hazardUz: 'Toʻrtlamchi uglerod: bir atomda ikki metil.',
        color: '#fda4af',
      },
      {
        id: 'pentane-trap',
        nameRu: 'н-Пентан',
        nameEn: 'n-Pentane',
        nameUz: 'n-Pentan',
        formula: 'C₅H₁₂',
        correct: false,
        skeleton: 'n',
        functionalGroups: ['alkane'],
        irPeaks: [CH_PEAK],
        hazardRu: 'Ловушка: другая формула (C₅)!',
        hazardEn: 'Trap: different formula (C₅)!',
        hazardUz: 'Tuzoq: boshqa formula (C₅)!',
        color: '#94a3b8',
      },
    ],
  },
  {
    id: 'c4h10o',
    formula: 'C₄H₁₀O',
    targetCount: 2,
    titleRu: 'Спирт или эфир? Одна формула — разные судьбы',
    titleEn: 'Alcohol or ether? Same formula, different fates',
    titleUz: 'Spirt yoki efir? Bir formula — turli taqdir',
    hintRu: 'Выберите бутанол (есть −OH) и диэтиловый эфир (нет −OH). Сравните ИК.',
    hintEn: 'Pick butanol (−OH) and diethyl ether (no −OH). Compare IR.',
    hintUz: 'Butanol (−OH) va dietil efirini (−OH yoʻq) tanlang. IK solishtiring.',
    candidates: [
      {
        id: 'n-butanol',
        nameRu: 'Бутан-1-ол',
        nameEn: 'Butan-1-ol',
        nameUz: 'Butan-1-ol',
        formula: 'C₄H₁₀O',
        correct: true,
        skeleton: 'alcohol',
        functionalGroups: ['alcohol', 'OH'],
        irPeaks: [OH_PEAK, CH_PEAK, CO_PEAK],
        hazardRu: 'Спирт: широкий пик O–H ~3300 см⁻¹. Токсичен при злоупотреблении.',
        hazardEn: 'Alcohol: broad O–H peak ~3300 cm⁻¹.',
        hazardUz: 'Spirt: keng O–H choʻqqisi ~3300 cm⁻¹.',
        color: '#fbbf24',
      },
      {
        id: 'diethyl-ether',
        nameRu: 'Диэтиловый эфир',
        nameEn: 'Diethyl ether',
        nameUz: 'Dietil efiri',
        formula: 'C₄H₁₀O',
        correct: true,
        skeleton: 'ether',
        functionalGroups: ['ether'],
        irPeaks: NO_OH,
        hazardRu: 'Мед. эфир: нет пика O–H! Легко воспламеняется, наркоз в истории медицины.',
        hazardEn: 'Medical ether: no O–H peak! Highly flammable.',
        hazardUz: 'Tibbiy efir: O–H choʻqqisi yoʻq! Oson yonadi.',
        color: '#34d399',
      },
      {
        id: 'sec-butanol',
        nameRu: 'Бутан-2-ол',
        nameEn: 'Butan-2-ol',
        nameUz: 'Butan-2-ol',
        formula: 'C₄H₁₀O',
        correct: false,
        skeleton: 'sec',
        functionalGroups: ['alcohol', 'OH'],
        irPeaks: [OH_PEAK, CH_PEAK, CO_PEAK],
        hazardRu: 'Тоже спирт (есть O–H), но для задания достаточно одного спирта + эфир.',
        hazardEn: 'Also an alcohol; challenge needs one alcohol + ether.',
        hazardUz: 'Ham spirt; topshiriqda bitta spirt + efir yetarli.',
        color: '#f59e0b',
      },
      {
        id: 'acetone-trap',
        nameRu: 'Ацетон',
        nameEn: 'Acetone',
        nameUz: 'Atseton',
        formula: 'C₃H₆O',
        correct: false,
        skeleton: 'n',
        functionalGroups: ['ketone', 'C=O'],
        irPeaks: [
          { wavenumber: 1715, intensity: 0.95, label: 'C=O' },
          CH_PEAK,
        ],
        hazardRu: 'Ловушка: другая формула и сильный пик карбонила.',
        hazardEn: 'Trap: different formula + carbonyl peak.',
        hazardUz: 'Tuzoq: boshqa formula + karbonil choʻqqisi.',
        color: '#fb7185',
      },
    ],
  },
  {
    id: 'c7h16',
    formula: 'C₇H₁₆',
    targetCount: 9,
    titleRu: 'Все 9 изомеров гептана',
    titleEn: 'All 9 heptane isomers',
    titleUz: 'Geptanning barcha 9 izomeri',
    hintRu:
      'Учебник, с. 43: число изомеров растёт с длиной цепи — C₄H₁₀ 2, C₅H₁₂ 3, C₆H₁₄ 5, C₇H₁₆ 9, C₈H₁₈ 18, C₉H₂₀ 35, C₁₀H₂₂ 75. Отметьте все девять изомеров C₇H₁₆ (карточки другой формулы — ловушки).',
    hintEn:
      'Textbook p. 43: the number of isomers grows with chain length — C₄H₁₀ 2, C₅H₁₂ 3, C₆H₁₄ 5, C₇H₁₆ 9, C₈H₁₈ 18, C₉H₂₀ 35, C₁₀H₂₂ 75. Mark all nine C₇H₁₆ isomers (cards with another formula are traps).',
    hintUz:
      'Darslik, 43-bet: izomerlar soni zanjir uzunligi bilan oshadi — C₄H₁₀ 2, C₅H₁₂ 3, C₆H₁₄ 5, C₇H₁₆ 9, C₈H₁₈ 18, C₉H₂₀ 35, C₁₀H₂₂ 75. C₇H₁₆ ning toʻqqizta izomerini belgilang (boshqa formulali kartalar — tuzoq).',
    candidates: cands([
      ...C7H16_ROWS.slice(0, 3).map((r) => r.slice(0, 10) as unknown as CandRow),
      ['c7-trap-hexane', 'н-Гексан', 'n-Hexane', 'n-Geksan', 'C₆H₁₄', false, 'n', 'Ловушка: C₆H₁₄ — другая формула.', 'Trap: C₆H₁₄ is another formula.', 'Tuzoq: C₆H₁₄ — boshqa formula.'],
      ...C7H16_ROWS.slice(3, 7).map((r) => r.slice(0, 10) as unknown as CandRow),
      ['c7-trap-isooctane', '2,2,4-Триметилпентан (изооктан)', '2,2,4-Trimethylpentane (isooctane)', '2,2,4-Trimetilpentan (izooktan)', 'C₈H₁₈', false, 'neo', 'Ловушка: C₈H₁₈ — другая формула.', 'Trap: C₈H₁₈ is another formula.', 'Tuzoq: C₈H₁₈ — boshqa formula.'],
      ...C7H16_ROWS.slice(7).map((r) => r.slice(0, 10) as unknown as CandRow),
    ]),
  },
  {
    id: 'c7h16-c5chain',
    formula: 'C₇H₁₆ · C₅',
    targetCount: 5,
    titleRu: 'Задача: алкан с M = 100 и цепью из 5 C',
    titleEn: 'Task: an alkane with M = 100 and a 5-carbon chain',
    titleUz: 'Masala: M = 100 va 5 C zanjirli alkan',
    hintRu:
      'Учебник, с. 45: плотность пара по водороду 50, значит M = 2 · 50 = 100 г/моль; 14n + 2 = 100 → n = 7, это C₇H₁₆. Выберите изомеры, у которых главная (самая длинная) цепь — ровно 5 атомов C.',
    hintEn:
      'Textbook p. 45: vapour density relative to hydrogen is 50, so M = 2 · 50 = 100 g/mol; 14n + 2 = 100 → n = 7, i.e. C₇H₁₆. Pick the isomers whose main (longest) chain is exactly 5 carbons.',
    hintUz:
      'Darslik, 45-bet: bugʻning vodorodga nisbatan zichligi 50, demak M = 2 · 50 = 100 g/mol; 14n + 2 = 100 → n = 7, bu C₇H₁₆. Asosiy (eng uzun) zanjiri aynan 5 C boʻlgan izomerlarni tanlang.',
    candidates: cands(
      C7H16_ROWS.map(
        (r) =>
          [r[0], r[1], r[2], r[3], r[4], r[10], r[6], r[10] ? r[7] : `Нет: ${r[7]}`, r[10] ? r[8] : `No: ${r[8]}`, r[10] ? r[9] : `Yoʻq: ${r[9]}`] as const,
      ),
    ),
  },
  {
    id: 'c4h8-ring',
    formula: 'C₄H₈ · цикл',
    targetCount: 2,
    titleRu: 'Циклоалканы C₄H₈',
    titleEn: 'Cycloalkanes C₄H₈',
    titleUz: 'Tsikloalkanlar C₄H₈',
    hintRu:
      'Учебник, с. 52: изомерия циклоалканов начинается с циклобутана — у C₄H₈ два циклических изомера. Алкен той же формулы — межклассовый изомер, в этом задании он не считается.',
    hintEn:
      'Textbook p. 52: cycloalkane isomerism starts with cyclobutane — C₄H₈ has two cyclic isomers. An alkene of the same formula is an interclass isomer and does not count here.',
    hintUz:
      'Darslik, 52-bet: tsikloalkanlar izomeriyasi tsiklobutandan boshlanadi — C₄H₈ ning ikkita halqali izomeri bor. Shu formulali alken — sinflararo izomer, bu topshiriqda hisoblanmaydi.',
    candidates: cands([
      ['cyclobutane', 'Циклобутан', 'Cyclobutane', 'Tsiklobutan', 'C₄H₈', true, 'ring', 'Кольцо из 4 C.', 'Four-carbon ring.', '4 C li halqa.'],
      ['but-1-ene', 'Бутен-1', 'But-1-ene', 'Buten-1', 'C₄H₈', false, 'n', 'Та же формула, но кольца нет — это алкен (межклассовый изомер).', 'Same formula but no ring — an alkene (interclass isomer).', 'Formula bir xil, lekin halqa yoʻq — bu alken (sinflararo izomer).'],
      ['methylcyclopropane', 'Метилциклопропан', 'Methylcyclopropane', 'Metiltsiklopropan', 'C₄H₈', true, 'ring', 'Кольцо из 3 C + метил.', 'Three-carbon ring + methyl.', '3 C li halqa + metil.'],
      ['cyclopropane', 'Циклопропан', 'Cyclopropane', 'Tsiklopropan', 'C₃H₆', false, 'ring', 'Ловушка: C₃H₆ — другая формула.', 'Trap: C₃H₆ is another formula.', 'Tuzoq: C₃H₆ — boshqa formula.'],
    ]),
  },
  {
    id: 'c5h10-ring',
    formula: 'C₅H₁₀ · цикл',
    targetCount: 5,
    titleRu: 'Циклические изомеры C₅H₁₀',
    titleEn: 'Cyclic isomers of C₅H₁₀',
    titleUz: 'C₅H₁₀ ning halqali izomerlari',
    hintRu:
      'Учебник, с. 53: «циклопентан имеет 5 изомеров» — в это число входит сам циклопентан; цис/транс не различаются. Пентены той же формулы — межклассовые изомеры, их не отмечайте.',
    hintEn:
      'Textbook p. 53: “cyclopentane has 5 isomers” — cyclopentane itself is counted; cis/trans are not distinguished. Pentenes of the same formula are interclass isomers — do not mark them.',
    hintUz:
      'Darslik, 53-bet: «tsiklopentanning 5 ta izomeri bor» — bu songa tsiklopentanning oʻzi ham kiradi; sis/trans farqlanmaydi. Shu formulali pentenlar — sinflararo izomerlar, ularni belgilamang.',
    candidates: cands([
      ['cyclopentane', 'Циклопентан', 'Cyclopentane', 'Tsiklopentan', 'C₅H₁₀', true, 'ring', 'Кольцо из 5 C.', 'Five-carbon ring.', '5 C li halqa.'],
      ['pent-1-ene', 'Пентен-1', 'Pent-1-ene', 'Penten-1', 'C₅H₁₀', false, 'n', 'Та же формула, но кольца нет — алкен (межклассовый изомер).', 'Same formula but no ring — an alkene (interclass isomer).', 'Formula bir xil, lekin halqa yoʻq — alken (sinflararo izomer).'],
      ['methylcyclobutane', 'Метилциклобутан', 'Methylcyclobutane', 'Metiltsiklobutan', 'C₅H₁₀', true, 'ring', 'Кольцо из 4 C + метил.', 'Four-carbon ring + methyl.', '4 C li halqa + metil.'],
      ['1-1-dimethylcyclopropane', '1,1-Диметилциклопропан', '1,1-Dimethylcyclopropane', '1,1-Dimetiltsiklopropan', 'C₅H₁₀', true, 'ring', 'Кольцо из 3 C, оба метила у одного C.', 'Three-carbon ring, both methyls on one C.', '3 C li halqa, ikkala metil bitta C da.'],
      ['cyclohexane', 'Циклогексан', 'Cyclohexane', 'Tsiklogeksan', 'C₆H₁₂', false, 'ring', 'Ловушка: C₆H₁₂ — другая формула.', 'Trap: C₆H₁₂ is another formula.', 'Tuzoq: C₆H₁₂ — boshqa formula.'],
      ['1-2-dimethylcyclopropane', '1,2-Диметилциклопропан', '1,2-Dimethylcyclopropane', '1,2-Dimetiltsiklopropan', 'C₅H₁₀', true, 'ring', 'Кольцо из 3 C, метилы у соседних C.', 'Three-carbon ring, methyls on neighbouring C.', '3 C li halqa, metillar qoʻshni C da.'],
      ['ethylcyclopropane', 'Этилциклопропан', 'Ethylcyclopropane', 'Etiltsiklopropan', 'C₅H₁₀', true, 'ring', 'Кольцо из 3 C + этил.', 'Three-carbon ring + ethyl.', '3 C li halqa + etil.'],
    ]),
  },
]

export {
  ORGANIC_BUILD_CHALLENGES,
  ORGANIC_CLASS_LABELS,
  challengeBuildStage,
  organicBuildByIsomerCandidate,
  organicBuildChallengeById,
  type OrganicBuildChallenge,
  type OrganicBuildStage,
  type OrganicClassId,
  type OrganicKit,
} from './organicBuildCatalog'
