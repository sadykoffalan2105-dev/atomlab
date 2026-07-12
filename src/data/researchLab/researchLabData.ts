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
  skeleton: 'n' | 'iso' | 'neo' | 'sec' | 'tert' | 'ether' | 'alcohol'
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
