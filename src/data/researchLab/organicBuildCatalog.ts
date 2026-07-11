/**
 * Каталог 3D-сборки органики по учебнику Kimyo 10 (и общие вещества для 10–11).
 * Скелет — тяжёлые атомы без H; kit — полный набор по формуле.
 */
import type { OrganicElement, SkeletonSpec } from '../../chemistry/organic/organicGraph'

export type IrPeak = {
  wavenumber: number
  intensity: number
  label: string
}

export type OrganicClassId =
  | 'alkane'
  | 'cycloalkane'
  | 'alkene'
  | 'alkadiene'
  | 'alkyne'
  | 'arene'
  | 'alcohol'
  | 'polyol'
  | 'phenol'
  | 'ether'
  | 'aldehyde'
  | 'ketone'
  | 'acid'
  | 'ester'
  | 'carb'
  | 'halo'
  | 'nitrogen'

/** Учебный этап сборки: цепь → кольцо → каркас (как на схеме в учебнике). */
export type OrganicBuildStage = 'chain' | 'ring' | 'cage'

export type OrganicKit = Readonly<Partial<Record<'C' | 'H' | 'O' | 'N' | 'Cl', number>>>

export type OrganicBuildChallenge = {
  id: string
  isomerCandidateId?: string
  classId: OrganicClassId
  /** Этап 3D-студии; по умолчанию выводится из classId */
  buildStage?: OrganicBuildStage
  formula: string
  kit: OrganicKit
  titleRu: string
  titleEn: string
  titleUz: string
  hintRu: string
  hintEn: string
  hintUz: string
  successRu: string
  successEn: string
  successUz: string
  skeleton: SkeletonSpec
  irPeaks: readonly IrPeak[]
  allowOxygen?: boolean
  allowNitrogen?: boolean
  allowChlorine?: boolean
  /** Учебное уравнение (для панели в студии) */
  equationRu: string
  equationEn: string
  equationUz: string
}

const OH: IrPeak = { wavenumber: 3350, intensity: 0.92, label: 'O–H' }
const CH: IrPeak = { wavenumber: 2920, intensity: 0.7, label: 'C–H' }
const CO: IrPeak = { wavenumber: 1100, intensity: 0.55, label: 'C–O' }
const CO_ETH: IrPeak = { wavenumber: 1120, intensity: 0.65, label: 'C–O (эфир)' }
const CC_D: IrPeak = { wavenumber: 1650, intensity: 0.55, label: 'C=C' }
const CC_T: IrPeak = { wavenumber: 2100, intensity: 0.45, label: 'C≡C' }
const CO_ALD: IrPeak = { wavenumber: 1730, intensity: 0.9, label: 'C=O' }
const CO_KET: IrPeak = { wavenumber: 1715, intensity: 0.92, label: 'C=O' }
const COOH: IrPeak = { wavenumber: 1710, intensity: 0.88, label: 'C=O' }
const AROM: IrPeak = { wavenumber: 1500, intensity: 0.5, label: 'Ar' }
const NH: IrPeak = { wavenumber: 3400, intensity: 0.6, label: 'N–H' }

type Edge = readonly [number, number] | readonly [number, number, 1 | 2 | 3]

function chain(n: number, order: 1 | 2 | 3 = 1): { elements: ('C')[]; edges: Edge[] } {
  const elements = Array.from({ length: n }, () => 'C' as const)
  const edges: Edge[] = []
  for (let i = 0; i < n - 1; i++) edges.push(order === 1 ? [i, i + 1] : [i, i + 1, order])
  return { elements, edges }
}

function ch(partial: Omit<OrganicBuildChallenge, 'irPeaks' | 'equationEn' | 'equationUz'> & {
  irPeaks?: readonly IrPeak[]
  equationEn?: string
  equationUz?: string
}): OrganicBuildChallenge {
  const buildStage =
    partial.buildStage ??
    (partial.classId === 'cycloalkane' || partial.classId === 'arene'
      ? 'ring'
      : 'chain')
  return {
    ...partial,
    buildStage,
    irPeaks: partial.irPeaks ?? [CH],
    equationEn: partial.equationEn ?? partial.equationRu,
    equationUz: partial.equationUz ?? partial.equationRu,
    allowOxygen: partial.allowOxygen ?? Boolean(partial.kit.O),
    allowNitrogen: partial.allowNitrogen ?? Boolean(partial.kit.N),
    allowChlorine: partial.allowChlorine ?? Boolean(partial.kit.Cl),
  }
}

/** Линейная цепь Cₙ + опционально конец O / Cl / N */
function linearC(
  n: number,
  extra?: { O?: 'end' | 'mid'; Cl?: 'end'; doubleAt?: number; tripleAt?: number },
): SkeletonSpec {
  const elements: OrganicElement[] = Array.from({ length: n }, () => 'C')
  const edges: Edge[] = []
  for (let i = 0; i < n - 1; i++) {
    let order: 1 | 2 | 3 = 1
    if (extra?.doubleAt === i) order = 2
    if (extra?.tripleAt === i) order = 3
    edges.push(order === 1 ? [i, i + 1] : [i, i + 1, order])
  }
  if (extra?.O === 'end') {
    elements.push('O')
    edges.push([n - 1, elements.length - 1])
  }
  if (extra?.Cl === 'end') {
    elements.push('Cl')
    edges.push([n - 1, elements.length - 1])
  }
  return { elements, edges }
}

export const ORGANIC_CLASS_LABELS: Record<
  OrganicClassId,
  { ru: string; en: string; uz: string }
> = {
  alkane: { ru: 'Алканы', en: 'Alkanes', uz: 'Alkanlar' },
  cycloalkane: { ru: 'Циклоалканы', en: 'Cycloalkanes', uz: 'Tsikloalkanlar' },
  alkene: { ru: 'Алкены', en: 'Alkenes', uz: 'Alkenlar' },
  alkadiene: { ru: 'Алкадиены', en: 'Alkadienes', uz: 'Alkadiyenlar' },
  alkyne: { ru: 'Алкины', en: 'Alkynes', uz: 'Alkinlar' },
  arene: { ru: 'Арены', en: 'Arenes', uz: 'Arenlar' },
  alcohol: { ru: 'Спирты', en: 'Alcohols', uz: 'Spirtlar' },
  polyol: { ru: 'Многоатомные', en: 'Polyols', uz: 'Koʻp atomli' },
  phenol: { ru: 'Фенолы', en: 'Phenols', uz: 'Fenollar' },
  ether: { ru: 'Эфиры', en: 'Ethers', uz: 'Efirlar' },
  aldehyde: { ru: 'Альдегиды', en: 'Aldehydes', uz: 'Aldegidlar' },
  ketone: { ru: 'Кетоны', en: 'Ketones', uz: 'Ketonlar' },
  acid: { ru: 'Кислоты', en: 'Acids', uz: 'Kislotalar' },
  ester: { ru: 'Сложные эфиры', en: 'Esters', uz: 'Murakkab efirlar' },
  carb: { ru: 'Углеводы', en: 'Carbohydrates', uz: 'Uglevodlar' },
  halo: { ru: 'Галогенпроизводные', en: 'Haloalkanes', uz: 'Galogenli' },
  nitrogen: { ru: 'Азотсодержащие', en: 'N-compounds', uz: 'Azotli' },
}

export const ORGANIC_BUILD_CHALLENGES: readonly OrganicBuildChallenge[] = [
  // ——— Алканы ———
  ch({
    id: 'methane',
    classId: 'alkane',
    formula: 'CH₄',
    kit: { C: 1, H: 4 },
    titleRu: 'Метан',
    titleEn: 'Methane',
    titleUz: 'Metan',
    hintRu: 'Соедините C с четырьмя H. Углы ~109.5° (sp³).',
    hintEn: 'Bond C to four H. Angles ~109.5° (sp³).',
    hintUz: 'C ni toʻrt H bilan bogʻlang. ~109.5° (sp³).',
    successRu: 'Метан — простейший алкан, тетраэдр.',
    successEn: 'Methane — simplest alkane, tetrahedron.',
    successUz: 'Metan — eng oddiy alkan, tetraedr.',
    skeleton: { elements: ['C'], edges: [] },
    equationRu: 'CH₄ + 2O₂ → CO₂ + 2H₂O',
  }),
  ch({
    id: 'ethane',
    classId: 'alkane',
    formula: 'C₂H₆',
    kit: { C: 2, H: 6 },
    titleRu: 'Этан',
    titleEn: 'Ethane',
    titleUz: 'Etan',
    hintRu: 'Сначала C–C, затем водороды («Связать H»).',
    hintEn: 'Bond C–C first, then hydrogens.',
    hintUz: 'Avval C–C, keyin H.',
    successRu: 'Этан: одинарная связь, свободное вращение.',
    successEn: 'Ethane: single bond, free rotation.',
    successUz: 'Etan: oddiy bogʻ.',
    skeleton: chain(2),
    equationRu: '2C₂H₆ + 7O₂ → 4CO₂ + 6H₂O',
  }),
  ch({
    id: 'propane',
    classId: 'alkane',
    formula: 'C₃H₈',
    kit: { C: 3, H: 8 },
    titleRu: 'Пропан',
    titleEn: 'Propane',
    titleUz: 'Propan',
    hintRu: 'Цепь из трёх C, затем H.',
    hintEn: 'Chain of three C, then H.',
    hintUz: 'Uch C zanjir, keyin H.',
    successRu: 'Пропан — бытовой газ.',
    successEn: 'Propane — household fuel gas.',
    successUz: 'Propan — maishiy gaz.',
    skeleton: chain(3),
    equationRu: 'C₃H₈ + 5O₂ → 3CO₂ + 4H₂O',
  }),
  ch({
    id: 'n-butane',
    classId: 'alkane',
    formula: 'C₄H₁₀',
    kit: { C: 4, H: 10 },
    titleRu: 'н-Бутан',
    titleEn: 'n-Butane',
    titleUz: 'n-Butan',
    hintRu: 'Неразветвлённая цепь C₄.',
    hintEn: 'Unbranched C₄ chain.',
    hintUz: 'Shoxlanmagan C₄.',
    successRu: 'н-Бутан — линейный скелет.',
    successEn: 'n-Butane — linear skeleton.',
    successUz: 'n-Butan — chiziqli skelet.',
    skeleton: chain(4),
    equationRu: '2C₄H₁₀ + 13O₂ → 8CO₂ + 10H₂O',
  }),
  ch({
    id: 'isobutane',
    classId: 'alkane',
    formula: 'C₄H₁₀',
    kit: { C: 4, H: 10 },
    titleRu: '2-Метилпропан',
    titleEn: '2-Methylpropane',
    titleUz: '2-Metilpropan',
    hintRu: 'Разветвление: центральный C связан с тремя C.',
    hintEn: 'Branch: central C bonded to three C.',
    hintUz: 'Markaziy C uchta C bilan.',
    successRu: 'Изобутан — структурный изомер н-бутана.',
    successEn: 'Isobutane — structural isomer of n-butane.',
    successUz: 'Izobutan — n-butan izomeri.',
    skeleton: {
      elements: ['C', 'C', 'C', 'C'],
      edges: [
        [0, 1],
        [1, 2],
        [1, 3],
      ],
    },
    equationRu: 'C₄H₁₀ (изо) — изомер н-бутана',
  }),
  ch({
    id: 'n-pentane',
    isomerCandidateId: 'n-pentane',
    classId: 'alkane',
    formula: 'C₅H₁₂',
    kit: { C: 5, H: 12 },
    titleRu: 'н-Пентан',
    titleEn: 'n-Pentane',
    titleUz: 'n-Pentan',
    hintRu: 'Пять C в ряд — без боковых метилов.',
    hintEn: 'Five C in a row.',
    hintUz: 'Besh C qator.',
    successRu: 'н-Пентан собран.',
    successEn: 'n-Pentane built.',
    successUz: 'n-Pentan yigʻildi.',
    skeleton: chain(5),
    equationRu: 'C₅H₁₂ + 8O₂ → 5CO₂ + 6H₂O',
  }),
  ch({
    id: 'isopentane',
    isomerCandidateId: 'isopentane',
    classId: 'alkane',
    formula: 'C₅H₁₂',
    kit: { C: 5, H: 12 },
    titleRu: '2-Метилбутан',
    titleEn: '2-Methylbutane',
    titleUz: '2-Metilbutan',
    hintRu: 'Цепь C₄ + метил на 2-м углероде.',
    hintEn: 'C₄ chain + methyl on carbon 2.',
    hintUz: 'C₄ + 2-uglerodda metil.',
    successRu: 'Изопентан — изомер пентана.',
    successEn: 'Isopentane — pentane isomer.',
    successUz: 'Izopentan — pentan izomeri.',
    skeleton: {
      elements: ['C', 'C', 'C', 'C', 'C'],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [1, 4],
      ],
    },
    equationRu: 'C₅H₁₂ (изо) — изомер н-пентана',
  }),
  ch({
    id: 'neopentane',
    isomerCandidateId: 'neopentane',
    classId: 'alkane',
    formula: 'C₅H₁₂',
    kit: { C: 5, H: 12 },
    titleRu: '2,2-Диметилпропан',
    titleEn: '2,2-Dimethylpropane',
    titleUz: '2,2-Dimetilpropan',
    hintRu: 'Центральный C с четырьмя метилами (нео).',
    hintEn: 'Central C with four methyls (neo).',
    hintUz: 'Markaziy C toʻrt metil bilan.',
    successRu: 'Неопентан — компактная «клетка».',
    successEn: 'Neopentane — compact cage.',
    successUz: 'Neopentan — ixcham tuzilma.',
    skeleton: {
      elements: ['C', 'C', 'C', 'C', 'C'],
      edges: [
        [0, 1],
        [0, 2],
        [0, 3],
        [0, 4],
      ],
    },
    equationRu: 'C₅H₁₂ (нео) — изомер н-пентана',
  }),
  ch({
    id: 'n-hexane',
    isomerCandidateId: 'n-hexane',
    classId: 'alkane',
    buildStage: 'chain',
    formula: 'C₆H₁₄',
    kit: { C: 6, H: 14 },
    titleRu: 'н-Гексан',
    titleEn: 'n-Hexane',
    titleUz: 'n-Geksan',
    hintRu: 'Неразветвлённая цепь из шести C: CH₃–(CH₂)₄–CH₃.',
    hintEn: 'Unbranched chain of six C.',
    hintUz: 'Shoxlanmagan olti C zanjir.',
    successRu: 'н-Гексан — растворитель, компонент бензина.',
    successEn: 'n-Hexane — solvent, gasoline component.',
    successUz: 'n-Geksan — erituvchi.',
    skeleton: chain(6),
    equationRu: '2C₆H₁₄ + 19O₂ → 12CO₂ + 14H₂O',
  }),
  ch({
    id: '2-methylpentane',
    isomerCandidateId: '2-methylpentane',
    classId: 'alkane',
    formula: 'C₆H₁₄',
    kit: { C: 6, H: 14 },
    titleRu: '2-Метилпентан',
    titleEn: '2-Methylpentane',
    titleUz: '2-Metilpentan',
    hintRu: 'Цепь C₅ + метил на 2-м углероде (изогексан).',
    hintEn: 'C₅ chain + methyl on carbon 2.',
    hintUz: 'C₅ zanjir + 2-uglerodda metil.',
    successRu: '2-Метилпентан — структурный изомер гексана.',
    successEn: '2-Methylpentane — structural isomer of hexane.',
    successUz: '2-Metilpentan — geksan izomeri.',
    skeleton: {
      // C0–C1–C2–C3–C4  +  C5 на C1 (позиция 2)
      elements: ['C', 'C', 'C', 'C', 'C', 'C'],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [1, 5],
      ],
    },
    equationRu: 'C₆H₁₄ (2-метилпентан) — изомер н-гексана',
  }),
  ch({
    id: '3-methylpentane',
    isomerCandidateId: '3-methylpentane',
    classId: 'alkane',
    formula: 'C₆H₁₄',
    kit: { C: 6, H: 14 },
    titleRu: '3-Метилпентан',
    titleEn: '3-Methylpentane',
    titleUz: '3-Metilpentan',
    hintRu: 'Цепь C₅ + метил на 3-м (среднем) углероде.',
    hintEn: 'C₅ chain + methyl on carbon 3.',
    hintUz: 'C₅ + 3-uglerodda metil.',
    successRu: '3-Метилпентан — изомер с ветвью в центре.',
    successEn: '3-Methylpentane — branch in the middle.',
    successUz: '3-Metilpentan — markazda shox.',
    skeleton: {
      // C0–C1–C2–C3–C4  +  C5 на C2
      elements: ['C', 'C', 'C', 'C', 'C', 'C'],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [2, 5],
      ],
    },
    equationRu: 'C₆H₁₄ (3-метилпентан) — изомер н-гексана',
  }),
  ch({
    id: '2-3-dimethylbutane',
    isomerCandidateId: '2-3-dimethylbutane',
    classId: 'alkane',
    formula: 'C₆H₁₄',
    kit: { C: 6, H: 14 },
    titleRu: '2,3-Диметилбутан',
    titleEn: '2,3-Dimethylbutane',
    titleUz: '2,3-Dimetilbutan',
    hintRu: 'Цепь C₄ + по метилу на 2-м и 3-м углеродах.',
    hintEn: 'C₄ chain + methyls on carbons 2 and 3.',
    hintUz: 'C₄ + 2- va 3-uglerodda metillar.',
    successRu: '2,3-Диметилбутан — два соседних разветвления.',
    successEn: '2,3-Dimethylbutane — two adjacent branches.',
    successUz: '2,3-Dimetilbutan — ikki qoʻshni shox.',
    skeleton: {
      // C0–C1–C2–C3  +  C4 на C1, C5 на C2
      elements: ['C', 'C', 'C', 'C', 'C', 'C'],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [1, 4],
        [2, 5],
      ],
    },
    equationRu: 'C₆H₁₄ (2,3-диметилбутан) — изомер н-гексана',
  }),
  ch({
    id: '2-2-dimethylbutane',
    isomerCandidateId: '2-2-dimethylbutane',
    classId: 'alkane',
    formula: 'C₆H₁₄',
    kit: { C: 6, H: 14 },
    titleRu: '2,2-Диметилбутан',
    titleEn: '2,2-Dimethylbutane',
    titleUz: '2,2-Dimetilbutan',
    hintRu: 'Цепь C₄ + два метила на одном (2-м) углероде.',
    hintEn: 'C₄ chain + two methyls on carbon 2.',
    hintUz: 'C₄ + 2-uglerodda ikki metil.',
    successRu: '2,2-Диметилбутан — четвертичный углерод.',
    successEn: '2,2-Dimethylbutane — quaternary carbon.',
    successUz: '2,2-Dimetilbutan — toʻrtlamchi uglerod.',
    skeleton: {
      // C0–C1–C2–C3  +  C4 и C5 на C1
      elements: ['C', 'C', 'C', 'C', 'C', 'C'],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [1, 4],
        [1, 5],
      ],
    },
    equationRu: 'C₆H₁₄ (2,2-диметилбутан) — изомер н-гексана',
  }),

  // ——— Циклоалканы ———
  ch({
    id: 'cyclopropane',
    classId: 'cycloalkane',
    buildStage: 'ring',
    formula: 'C₃H₆',
    kit: { C: 3, H: 6 },
    titleRu: 'Циклопропан',
    titleEn: 'Cyclopropane',
    titleUz: 'Tsiklopropan',
    hintRu: 'Треугольник из трёх C. Угол C–C–C ≈ 60° (сильное напряжение кольца).',
    hintEn: 'Triangle of three C. C–C–C ≈ 60° (high ring strain).',
    hintUz: 'Uch C uchburchak. C–C–C ≈ 60°.',
    successRu: 'Циклопропан — напряжённое трёхчленное кольцо (C₃H₆).',
    successEn: 'Cyclopropane — strained three-membered ring (C₃H₆).',
    successUz: 'Tsiklopropan — kuchlanishli uch aʼzoli halqa.',
    skeleton: {
      elements: ['C', 'C', 'C'],
      edges: [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
    },
    equationRu: 'C₃H₆ — циклопропан',
  }),
  ch({
    id: 'cyclobutane',
    classId: 'cycloalkane',
    buildStage: 'ring',
    formula: 'C₄H₈',
    kit: { C: 4, H: 8 },
    titleRu: 'Циклобутан',
    titleEn: 'Cyclobutane',
    titleUz: 'Tsiklobutan',
    hintRu: 'Квадрат из четырёх C. Угол C–C–C ≈ 90°.',
    hintEn: 'Square of four C. C–C–C ≈ 90°.',
    hintUz: 'Toʻrt C kvadrat. C–C–C ≈ 90°.',
    successRu: 'Циклобутан — четырёхчленное кольцо (C₄H₈).',
    successEn: 'Cyclobutane — four-membered ring (C₄H₈).',
    successUz: 'Tsiklobutan — toʻrt aʼzoli halqa.',
    skeleton: {
      elements: ['C', 'C', 'C', 'C'],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
      ],
    },
    equationRu: 'C₄H₈ — циклобутан',
  }),
  ch({
    id: 'cyclopentane',
    classId: 'cycloalkane',
    buildStage: 'ring',
    formula: 'C₅H₁₀',
    kit: { C: 5, H: 10 },
    titleRu: 'Циклопентан',
    titleEn: 'Cyclopentane',
    titleUz: 'Tsiklopentan',
    hintRu: 'Пятиугольник из пяти C. Угол C–C–C ≈ 108° (почти тетраэдр).',
    hintEn: 'Pentagon of five C. C–C–C ≈ 108° (near tetrahedral).',
    hintUz: 'Besh C beshburchak. C–C–C ≈ 108°.',
    successRu: 'Циклопентан — пятичленное кольцо (C₅H₁₀).',
    successEn: 'Cyclopentane — five-membered ring (C₅H₁₀).',
    successUz: 'Tsiklopentan — besh aʼzoli halqa.',
    skeleton: {
      elements: ['C', 'C', 'C', 'C', 'C'],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 0],
      ],
    },
    equationRu: 'C₅H₁₀ — циклопентан',
  }),
  ch({
    id: 'cyclohexane',
    classId: 'cycloalkane',
    buildStage: 'ring',
    formula: 'C₆H₁₂',
    kit: { C: 6, H: 12 },
    titleRu: 'Циклогексан',
    titleEn: 'Cyclohexane',
    titleUz: 'Tsikloheksan',
    hintRu: 'Шестичленное кольцо. В 3D — «кресло», углы ≈ 109.5°.',
    hintEn: 'Six-membered ring. In 3D — chair, angles ≈ 109.5°.',
    hintUz: 'Olti aʼzoli. 3D da — stul, ~109.5°.',
    successRu: 'Циклогексан — «кресло», мало напряжён (C₆H₁₂).',
    successEn: 'Cyclohexane — chair form, low strain (C₆H₁₂).',
    successUz: 'Tsikloheksan — stul shakli.',
    skeleton: {
      elements: ['C', 'C', 'C', 'C', 'C', 'C'],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 0],
      ],
    },
    equationRu: 'C₆H₁₂ — циклогексан',
  }),
  ch({
    id: 'adamantane',
    classId: 'cycloalkane',
    buildStage: 'cage',
    formula: 'C₁₀H₁₆',
    kit: { C: 10, H: 16 },
    titleRu: 'Адамантан',
    titleEn: 'Adamantane',
    titleUz: 'Adamantan',
    hintRu:
      'Каркас: 4 третичных C (мостики) + 6 CH₂. Каждый мостиковый C связан с тремя CH₂.',
    hintEn: 'Cage: 4 bridgehead C + 6 CH₂. Each bridgehead bonds to three CH₂.',
    hintUz: 'Karkas: 4 koʻprik C + 6 CH₂.',
    successRu: 'Адамантан — алмазоподобный каркас (алифатическое полициклическое).',
    successEn: 'Adamantane — diamondoid cage.',
    successUz: 'Adamantan — olmosga oʻxshash karkas.',
    skeleton: {
      // 0–3 bridgeheads, 4–9 methylene bridges
      elements: ['C', 'C', 'C', 'C', 'C', 'C', 'C', 'C', 'C', 'C'],
      edges: [
        [0, 4],
        [4, 1],
        [0, 5],
        [5, 2],
        [0, 6],
        [6, 3],
        [1, 7],
        [7, 2],
        [1, 8],
        [8, 3],
        [2, 9],
        [9, 3],
      ],
    },
    equationRu: 'C₁₀H₁₆ — адамантан (каркас)',
  }),

  // ——— Алкены / алкины / диены ———
  ch({
    id: 'ethylene',
    classId: 'alkene',
    formula: 'C₂H₄',
    kit: { C: 2, H: 4 },
    titleRu: 'Этилен (этен)',
    titleEn: 'Ethene',
    titleUz: 'Etilen',
    hintRu: 'Двойная связь C=C (порядок связи 2), углы ~120°.',
    hintEn: 'Double bond C=C (order 2), angles ~120°.',
    hintUz: 'C=C qoʻsh bogʻ (tartib 2), ~120°.',
    successRu: 'Этилен — важнейший алкен, мономер полиэтилена.',
    successEn: 'Ethene — key alkene, PE monomer.',
    successUz: 'Etilen — muhim alken, PE monomeri.',
    skeleton: { elements: ['C', 'C'], edges: [[0, 1, 2]] },
    irPeaks: [CH, CC_D],
    equationRu: 'C₂H₄ + H₂O → C₂H₅OH (гидратация)',
  }),
  ch({
    id: 'propene',
    classId: 'alkene',
    formula: 'C₃H₆',
    kit: { C: 3, H: 6 },
    titleRu: 'Пропен',
    titleEn: 'Propene',
    titleUz: 'Propen',
    hintRu: 'C=C между 1–2, затем метил.',
    hintEn: 'C=C between 1–2, then methyl.',
    hintUz: '1–2 da C=C, keyin metil.',
    successRu: 'Пропилен — мономер полипропилена.',
    successEn: 'Propene — PP monomer.',
    successUz: 'Propilen — PP monomeri.',
    skeleton: {
      elements: ['C', 'C', 'C'],
      edges: [
        [0, 1, 2],
        [1, 2],
      ],
    },
    irPeaks: [CH, CC_D],
    equationRu: 'C₃H₆ — пропен',
  }),
  ch({
    id: 'butadiene',
    classId: 'alkadiene',
    formula: 'C₄H₆',
    kit: { C: 4, H: 6 },
    titleRu: 'Бутадиен-1,3',
    titleEn: 'Buta-1,3-diene',
    titleUz: 'Butadien-1,3',
    hintRu: 'Две двойные связи: C=C–C=C.',
    hintEn: 'Two double bonds: C=C–C=C.',
    hintUz: 'Ikki qoʻsh bogʻ: C=C–C=C.',
    successRu: 'Бутадиен — основа синтетического каучука.',
    successEn: 'Butadiene — synthetic rubber base.',
    successUz: 'Butadien — kauchuk asosi.',
    skeleton: {
      elements: ['C', 'C', 'C', 'C'],
      edges: [
        [0, 1, 2],
        [1, 2],
        [2, 3, 2],
      ],
    },
    irPeaks: [CH, CC_D],
    equationRu: 'n C₄H₆ → (каучук)',
  }),
  ch({
    id: 'isoprene',
    classId: 'alkadiene',
    formula: 'C₅H₈',
    kit: { C: 5, H: 8 },
    titleRu: 'Изопрен',
    titleEn: 'Isoprene',
    titleUz: 'Izopren',
    hintRu: 'Бутадиен-1,3 с метилом на 2-м C.',
    hintEn: 'Butadiene with methyl on carbon 2.',
    hintUz: '2-C da metilli butadien.',
    successRu: 'Изопрен — звено натурального каучука.',
    successEn: 'Isoprene — natural rubber unit.',
    successUz: 'Izopren — tabiiy kauchuk.',
    skeleton: {
      elements: ['C', 'C', 'C', 'C', 'C'],
      edges: [
        [0, 1, 2],
        [1, 2],
        [2, 3, 2],
        [1, 4],
      ],
    },
    irPeaks: [CH, CC_D],
    equationRu: 'C₅H₈ — изопрен',
  }),
  ch({
    id: 'acetylene',
    classId: 'alkyne',
    formula: 'C₂H₂',
    kit: { C: 2, H: 2 },
    titleRu: 'Ацетилен (этин)',
    titleEn: 'Ethyne',
    titleUz: 'Atsetilen',
    hintRu: 'Тройная связь C≡C (порядок 3), угол 180°.',
    hintEn: 'Triple bond C≡C (order 3), 180°.',
    hintUz: 'C≡C uch bogʻ (tartib 3), 180°.',
    successRu: 'Ацетилен — сварка, исходник органического синтеза.',
    successEn: 'Acetylene — welding, organic feedstock.',
    successUz: 'Atsetilen — payvandlash.',
    skeleton: { elements: ['C', 'C'], edges: [[0, 1, 3]] },
    irPeaks: [CH, CC_T],
    equationRu: 'C₂H₂ + H₂O → CH₃CHO',
  }),
  ch({
    id: 'propyne',
    classId: 'alkyne',
    formula: 'C₃H₄',
    kit: { C: 3, H: 4 },
    titleRu: 'Пропин',
    titleEn: 'Propyne',
    titleUz: 'Propin',
    hintRu: 'C≡C–C: тройная + метил.',
    hintEn: 'C≡C–C: triple + methyl.',
    hintUz: 'C≡C–C.',
    successRu: 'Пропин (метилацетилен).',
    successEn: 'Propyne (methylacetylene).',
    successUz: 'Propin.',
    skeleton: {
      elements: ['C', 'C', 'C'],
      edges: [
        [0, 1, 3],
        [1, 2],
      ],
    },
    irPeaks: [CH, CC_T],
    equationRu: 'C₃H₄ — пропин',
  }),

  // ——— Арены ———
  ch({
    id: 'benzene',
    classId: 'arene',
    formula: 'C₆H₆',
    kit: { C: 6, H: 6 },
    titleRu: 'Бензол',
    titleEn: 'Benzene',
    titleUz: 'Benzol',
    hintRu: 'Кольцо C₆ с чередующимися двойными связями.',
    hintEn: 'C₆ ring with alternating doubles.',
    hintUz: 'C₆ halqa, navbatli qoʻsh bogʻlar.',
    successRu: 'Бензол — основа ароматики.',
    successEn: 'Benzene — aromatic core.',
    successUz: 'Benzol — aromatik asos.',
    skeleton: {
      elements: ['C', 'C', 'C', 'C', 'C', 'C'],
      edges: [
        [0, 1, 2],
        [1, 2],
        [2, 3, 2],
        [3, 4],
        [4, 5, 2],
        [5, 0],
      ],
    },
    irPeaks: [CH, AROM],
    equationRu: 'C₆H₆ + Br₂ → C₆H₅Br + HBr (FeBr₃)',
  }),
  ch({
    id: 'toluene',
    classId: 'arene',
    formula: 'C₇H₈',
    kit: { C: 7, H: 8 },
    titleRu: 'Толуол',
    titleEn: 'Toluene',
    titleUz: 'Toluol',
    hintRu: 'Бензольное кольцо + метил.',
    hintEn: 'Benzene ring + methyl.',
    hintUz: 'Benzol + metil.',
    successRu: 'Толуол — метилбензол, растворитель.',
    successEn: 'Toluene — methylbenzene, solvent.',
    successUz: 'Toluol — erituvchi.',
    skeleton: {
      elements: ['C', 'C', 'C', 'C', 'C', 'C', 'C'],
      edges: [
        [0, 1, 2],
        [1, 2],
        [2, 3, 2],
        [3, 4],
        [4, 5, 2],
        [5, 0],
        [0, 6],
      ],
    },
    irPeaks: [CH, AROM],
    equationRu: 'C₆H₅CH₃ — толуол',
  }),
  ch({
    id: 'styrene',
    classId: 'arene',
    formula: 'C₈H₈',
    kit: { C: 8, H: 8 },
    titleRu: 'Стирол',
    titleEn: 'Styrene',
    titleUz: 'Stirol',
    hintRu: 'Бензол + винил (C=C).',
    hintEn: 'Benzene + vinyl (C=C).',
    hintUz: 'Benzol + vinil.',
    successRu: 'Стирол — мономер полистирола.',
    successEn: 'Styrene — polystyrene monomer.',
    successUz: 'Stirol — polistirol.',
    skeleton: {
      elements: ['C', 'C', 'C', 'C', 'C', 'C', 'C', 'C'],
      edges: [
        [0, 1, 2],
        [1, 2],
        [2, 3, 2],
        [3, 4],
        [4, 5, 2],
        [5, 0],
        [0, 6],
        [6, 7, 2],
      ],
    },
    irPeaks: [CH, AROM, CC_D],
    equationRu: 'n C₈H₈ → полистирол',
  }),

  // ——— Спирты / многоатомные / фенол ———
  ch({
    id: 'methanol',
    classId: 'alcohol',
    formula: 'CH₄O',
    kit: { C: 1, H: 4, O: 1 },
    titleRu: 'Метанол',
    titleEn: 'Methanol',
    titleUz: 'Metanol',
    hintRu: 'C–O–H (кислород на углероде).',
    hintEn: 'C–O–H.',
    hintUz: 'C–O–H.',
    successRu: 'Метанол ядовит! Пик O–H в ИК.',
    successEn: 'Methanol is toxic! O–H in IR.',
    successUz: 'Metanol zaharli!',
    skeleton: { elements: ['C', 'O'], edges: [[0, 1]] },
    irPeaks: [OH, CH, CO],
    equationRu: 'CO + 2H₂ → CH₃OH',
  }),
  ch({
    id: 'ethanol',
    classId: 'alcohol',
    formula: 'C₂H₆O',
    kit: { C: 2, H: 6, O: 1 },
    titleRu: 'Этанол',
    titleEn: 'Ethanol',
    titleUz: 'Etanol',
    hintRu: 'C–C–O (этиловый спирт).',
    hintEn: 'C–C–O (ethyl alcohol).',
    hintUz: 'C–C–O.',
    successRu: 'Этанол — брожение, растворитель.',
    successEn: 'Ethanol — fermentation, solvent.',
    successUz: 'Etanol — erituvchi.',
    skeleton: {
      elements: ['C', 'C', 'O'],
      edges: [
        [0, 1],
        [1, 2],
      ],
    },
    irPeaks: [OH, CH, CO],
    equationRu: 'C₂H₄ + H₂O → C₂H₅OH',
  }),
  ch({
    id: 'propanol',
    classId: 'alcohol',
    formula: 'C₃H₈O',
    kit: { C: 3, H: 8, O: 1 },
    titleRu: 'Пропан-1-ол',
    titleEn: 'Propan-1-ol',
    titleUz: 'Propan-1-ol',
    hintRu: 'Цепь C₃ + OH на конце.',
    hintEn: 'C₃ chain + terminal OH.',
    hintUz: 'C₃ + oxirida OH.',
    successRu: 'Пропанол-1.',
    successEn: 'Propan-1-ol.',
    successUz: 'Propan-1-ol.',
    skeleton: linearC(3, { O: 'end' }),
    irPeaks: [OH, CH, CO],
    equationRu: 'C₃H₇OH — пропанол',
  }),
  ch({
    id: 'n-butanol',
    isomerCandidateId: 'n-butanol',
    classId: 'alcohol',
    formula: 'C₄H₁₀O',
    kit: { C: 4, H: 10, O: 1 },
    titleRu: 'Бутан-1-ол',
    titleEn: 'Butan-1-ol',
    titleUz: 'Butan-1-ol',
    hintRu: 'C₄ + OH на конце.',
    hintEn: 'C₄ + terminal OH.',
    hintUz: 'C₄ + oxirida OH.',
    successRu: 'Спирт: широкий O–H ~3300 см⁻¹.',
    successEn: 'Alcohol: broad O–H ~3300 cm⁻¹.',
    successUz: 'Spirt: keng O–H.',
    skeleton: linearC(4, { O: 'end' }),
    irPeaks: [OH, CH, CO],
    equationRu: 'C₄H₉OH — бутанол',
  }),
  ch({
    id: 'ethylene-glycol',
    classId: 'polyol',
    formula: 'C₂H₆O₂',
    kit: { C: 2, H: 6, O: 2 },
    titleRu: 'Этиленгликоль',
    titleEn: 'Ethylene glycol',
    titleUz: 'Etilenglikol',
    hintRu: 'HO–C–C–OH: два кислорода на концах.',
    hintEn: 'HO–C–C–OH.',
    hintUz: 'HO–C–C–OH.',
    successRu: 'Антифриз, двухатомный спирт.',
    successEn: 'Antifreeze, diol.',
    successUz: 'Antifriz.',
    skeleton: {
      elements: ['O', 'C', 'C', 'O'],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
      ],
    },
    irPeaks: [OH, CH, CO],
    equationRu: 'C₂H₄(OH)₂ — этиленгликоль',
  }),
  ch({
    id: 'glycerol',
    classId: 'polyol',
    formula: 'C₃H₈O₃',
    kit: { C: 3, H: 8, O: 3 },
    titleRu: 'Глицерин',
    titleEn: 'Glycerol',
    titleUz: 'Glitserin',
    hintRu: 'Три OH на трёх соседних C.',
    hintEn: 'Three OH on three adjacent C.',
    hintUz: 'Uch OH uch C da.',
    successRu: 'Глицерин — основа жиров.',
    successEn: 'Glycerol — fat backbone.',
    successUz: 'Glitserin — yogʻ asosi.',
    skeleton: {
      elements: ['C', 'C', 'C', 'O', 'O', 'O'],
      edges: [
        [0, 1],
        [1, 2],
        [0, 3],
        [1, 4],
        [2, 5],
      ],
    },
    irPeaks: [OH, CH, CO],
    equationRu: 'C₃H₅(OH)₃ — глицерин',
  }),
  ch({
    id: 'phenol',
    classId: 'phenol',
    formula: 'C₆H₆O',
    kit: { C: 6, H: 6, O: 1 },
    titleRu: 'Фенол',
    titleEn: 'Phenol',
    titleUz: 'Fenol',
    hintRu: 'Бензольное кольцо + OH.',
    hintEn: 'Benzene ring + OH.',
    hintUz: 'Benzol + OH.',
    successRu: 'Фенол — карболовая кислота (историч.).',
    successEn: 'Phenol — carbolic acid (hist.).',
    successUz: 'Fenol.',
    skeleton: {
      elements: ['C', 'C', 'C', 'C', 'C', 'C', 'O'],
      edges: [
        [0, 1, 2],
        [1, 2],
        [2, 3, 2],
        [3, 4],
        [4, 5, 2],
        [5, 0],
        [0, 6],
      ],
    },
    irPeaks: [OH, AROM, CO],
    equationRu: 'C₆H₅OH — фенол',
  }),

  // ——— Эфиры ———
  ch({
    id: 'dimethyl-ether',
    classId: 'ether',
    formula: 'C₂H₆O',
    kit: { C: 2, H: 6, O: 1 },
    titleRu: 'Диметиловый эфир',
    titleEn: 'Dimethyl ether',
    titleUz: 'Dimetil efiri',
    hintRu: 'C–O–C (нет OH) — изомер этанола.',
    hintEn: 'C–O–C (no OH) — ethanol isomer.',
    hintUz: 'C–O–C (OH yoʻq).',
    successRu: 'Межклассовый изомер этанола.',
    successEn: 'Functional isomer of ethanol.',
    successUz: 'Etanol izomeri.',
    skeleton: {
      elements: ['C', 'O', 'C'],
      edges: [
        [0, 1],
        [1, 2],
      ],
    },
    irPeaks: [CH, CO_ETH],
    equationRu: '2CH₃OH → CH₃OCH₃ + H₂O',
  }),
  ch({
    id: 'diethyl-ether',
    isomerCandidateId: 'diethyl-ether',
    classId: 'ether',
    formula: 'C₄H₁₀O',
    kit: { C: 4, H: 10, O: 1 },
    titleRu: 'Диэтиловый эфир',
    titleEn: 'Diethyl ether',
    titleUz: 'Dietil efiri',
    hintRu: 'C–C–O–C–C — O в середине.',
    hintEn: 'C–C–O–C–C — O in middle.',
    hintUz: 'C–C–O–C–C.',
    successRu: 'Мед. эфир: нет пика O–H.',
    successEn: 'Ether: no O–H peak.',
    successUz: 'Efir: O–H yoʻq.',
    skeleton: {
      elements: ['C', 'C', 'O', 'C', 'C'],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
      ],
    },
    irPeaks: [CH, CO_ETH],
    equationRu: '2C₂H₅OH → (C₂H₅)₂O + H₂O',
  }),

  // ——— Альдегиды / кетоны ———
  ch({
    id: 'formaldehyde',
    classId: 'aldehyde',
    formula: 'CH₂O',
    kit: { C: 1, H: 2, O: 1 },
    titleRu: 'Формальдегид',
    titleEn: 'Formaldehyde',
    titleUz: 'Formaldegid',
    hintRu: 'C=O (двойная связь C–O), два H на C.',
    hintEn: 'C=O double bond, two H on C.',
    hintUz: 'C=O, ikki H.',
    successRu: 'Формалин — раствор формальдегида.',
    successEn: 'Formalin — formaldehyde solution.',
    successUz: 'Formalin.',
    skeleton: { elements: ['C', 'O'], edges: [[0, 1, 2]] },
    irPeaks: [CH, CO_ALD],
    equationRu: 'CH₃OH → HCHO + H₂',
  }),
  ch({
    id: 'acetaldehyde',
    classId: 'aldehyde',
    formula: 'C₂H₄O',
    kit: { C: 2, H: 4, O: 1 },
    titleRu: 'Ацетальдегид',
    titleEn: 'Acetaldehyde',
    titleUz: 'Atsetaldegid',
    hintRu: 'C–C=O.',
    hintEn: 'C–C=O.',
    hintUz: 'C–C=O.',
    successRu: 'Уксусный альдегид.',
    successEn: 'Acetic aldehyde.',
    successUz: 'Sirka aldegidi.',
    skeleton: {
      elements: ['C', 'C', 'O'],
      edges: [
        [0, 1],
        [1, 2, 2],
      ],
    },
    irPeaks: [CH, CO_ALD],
    equationRu: 'C₂H₂ + H₂O → CH₃CHO',
  }),
  ch({
    id: 'acetone',
    classId: 'ketone',
    formula: 'C₃H₆O',
    kit: { C: 3, H: 6, O: 1 },
    titleRu: 'Ацетон',
    titleEn: 'Acetone',
    titleUz: 'Atseton',
    hintRu: 'C–C(=O)–C: карбонил в середине.',
    hintEn: 'C–C(=O)–C: mid carbonyl.',
    hintUz: 'C–C(=O)–C.',
    successRu: 'Ацетон — важный растворитель.',
    successEn: 'Acetone — key solvent.',
    successUz: 'Atseton — erituvchi.',
    skeleton: {
      elements: ['C', 'C', 'C', 'O'],
      edges: [
        [0, 1],
        [1, 2],
        [1, 3, 2],
      ],
    },
    irPeaks: [CH, CO_KET],
    equationRu: 'C₃H₆O — пропанон',
  }),

  // ——— Кислоты / эфиры ———
  ch({
    id: 'formic-acid',
    classId: 'acid',
    formula: 'CH₂O₂',
    kit: { C: 1, H: 2, O: 2 },
    titleRu: 'Муравьиная кислота',
    titleEn: 'Formic acid',
    titleUz: 'Chumoli kislota',
    hintRu: 'O=C–O (карбоксил на одном C).',
    hintEn: 'O=C–O carboxyl.',
    hintUz: 'O=C–O.',
    successRu: 'HCOOH — сильнейшая среди предельных.',
    successEn: 'HCOOH — strongest among saturated.',
    successUz: 'HCOOH.',
    skeleton: {
      elements: ['C', 'O', 'O'],
      edges: [
        [0, 1, 2],
        [0, 2],
      ],
    },
    irPeaks: [OH, COOH, CH],
    equationRu: 'HCOOH — муравьиная',
  }),
  ch({
    id: 'acetic-acid',
    classId: 'acid',
    formula: 'C₂H₄O₂',
    kit: { C: 2, H: 4, O: 2 },
    titleRu: 'Уксусная кислота',
    titleEn: 'Acetic acid',
    titleUz: 'Sirka kislota',
    hintRu: 'C–C(=O)–O.',
    hintEn: 'C–C(=O)–O.',
    hintUz: 'C–C(=O)–O.',
    successRu: 'CH₃COOH — уксус.',
    successEn: 'CH₃COOH — vinegar acid.',
    successUz: 'CH₃COOH.',
    skeleton: {
      elements: ['C', 'C', 'O', 'O'],
      edges: [
        [0, 1],
        [1, 2, 2],
        [1, 3],
      ],
    },
    irPeaks: [OH, COOH, CH],
    equationRu: 'CH₃CHO + [O] → CH₃COOH',
  }),
  ch({
    id: 'ethyl-acetate',
    classId: 'ester',
    formula: 'C₄H₈O₂',
    kit: { C: 4, H: 8, O: 2 },
    titleRu: 'Этилацетат',
    titleEn: 'Ethyl acetate',
    titleUz: 'Etilatsetat',
    hintRu: 'Сложный эфир: C–C(=O)–O–C–C.',
    hintEn: 'Ester: C–C(=O)–O–C–C.',
    hintUz: 'Murakkab efir.',
    successRu: 'Этилацетат — запах фруктов, растворитель.',
    successEn: 'Ethyl acetate — fruity solvent.',
    successUz: 'Etilatsetat.',
    skeleton: {
      elements: ['C', 'C', 'O', 'O', 'C', 'C'],
      edges: [
        [0, 1],
        [1, 2, 2],
        [1, 3],
        [3, 4],
        [4, 5],
      ],
    },
    irPeaks: [CH, COOH, CO],
    equationRu: 'CH₃COOH + C₂H₅OH ⇌ CH₃COOC₂H₅ + H₂O',
  }),

  // ——— Углеводы (упрощённый скелет) ———
  ch({
    id: 'glucose-open',
    classId: 'carb',
    formula: 'C₆H₁₂O₆',
    kit: { C: 6, H: 12, O: 6 },
    titleRu: 'Глюкоза (открытая)',
    titleEn: 'Glucose (open)',
    titleUz: 'Glyukoza',
    hintRu: 'Цепь C₆: альдегид на конце + 5 OH (O на каждом C кроме одного в C=O).',
    hintEn: 'C₆ chain: terminal aldehyde + OH groups.',
    hintUz: 'C₆: aldegid + OH.',
    successRu: 'Глюкоза C₆H₁₂O₆ — виноградный сахар.',
    successEn: 'Glucose C₆H₁₂O₆.',
    successUz: 'Glyukoza.',
    skeleton: {
      elements: ['C', 'C', 'C', 'C', 'C', 'C', 'O', 'O', 'O', 'O', 'O', 'O'],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [0, 6, 2],
        [1, 7],
        [2, 8],
        [3, 9],
        [4, 10],
        [5, 11],
      ],
    },
    irPeaks: [OH, CH, CO_ALD],
    equationRu: 'C₆H₁₂O₆ → 2C₂H₅OH + 2CO₂',
  }),

  // ——— Галоген / азот ———
  ch({
    id: 'chloromethane',
    classId: 'halo',
    formula: 'CH₃Cl',
    kit: { C: 1, H: 3, Cl: 1 },
    titleRu: 'Хлорметан',
    titleEn: 'Chloromethane',
    titleUz: 'Xlorometan',
    hintRu: 'C–Cl + три H. Важно для SN2 (вектор атаки).',
    hintEn: 'C–Cl + three H. Key for SN2.',
    hintUz: 'C–Cl + uch H. SN2 uchun.',
    successRu: 'Субстрат для нуклеофильной атаки.',
    successEn: 'Substrate for nucleophilic attack.',
    successUz: 'Nukleofil hujum substrati.',
    skeleton: { elements: ['C', 'Cl'], edges: [[0, 1]] },
    irPeaks: [CH],
    equationRu: 'CH₄ + Cl₂ → CH₃Cl + HCl',
  }),
  ch({
    id: 'chloroethane',
    classId: 'halo',
    formula: 'C₂H₅Cl',
    kit: { C: 2, H: 5, Cl: 1 },
    titleRu: 'Хлорэтан',
    titleEn: 'Chloroethane',
    titleUz: 'Xloroetan',
    hintRu: 'C–C–Cl.',
    hintEn: 'C–C–Cl.',
    hintUz: 'C–C–Cl.',
    successRu: 'Галогеналкан для SN2.',
    successEn: 'Haloalkane for SN2.',
    successUz: 'SN2 uchun.',
    skeleton: {
      elements: ['C', 'C', 'Cl'],
      edges: [
        [0, 1],
        [1, 2],
      ],
    },
    irPeaks: [CH],
    equationRu: 'C₂H₄ + HCl → C₂H₅Cl',
  }),
  ch({
    id: 'methylamine',
    classId: 'nitrogen',
    formula: 'CH₅N',
    kit: { C: 1, H: 5, N: 1 },
    titleRu: 'Метиламин',
    titleEn: 'Methylamine',
    titleUz: 'Metilamin',
    hintRu: 'C–N + водороды на N и C.',
    hintEn: 'C–N + hydrogens.',
    hintUz: 'C–N.',
    successRu: 'Простейший амин.',
    successEn: 'Simplest amine.',
    successUz: 'Eng oddiy amin.',
    skeleton: { elements: ['C', 'N'], edges: [[0, 1]] },
    irPeaks: [CH, NH],
    equationRu: 'CH₃NH₂ — метиламин',
  }),
  ch({
    id: 'aniline',
    classId: 'nitrogen',
    formula: 'C₆H₇N',
    kit: { C: 6, H: 7, N: 1 },
    titleRu: 'Анилин',
    titleEn: 'Aniline',
    titleUz: 'Anilin',
    hintRu: 'Бензол + NH₂.',
    hintEn: 'Benzene + NH₂.',
    hintUz: 'Benzol + NH₂.',
    successRu: 'Анилин — основа красителей.',
    successEn: 'Aniline — dye precursor.',
    successUz: 'Anilin.',
    skeleton: {
      elements: ['C', 'C', 'C', 'C', 'C', 'C', 'N'],
      edges: [
        [0, 1, 2],
        [1, 2],
        [2, 3, 2],
        [3, 4],
        [4, 5, 2],
        [5, 0],
        [0, 6],
      ],
    },
    irPeaks: [NH, AROM, CH],
    equationRu: 'C₆H₅NO₂ → C₆H₅NH₂',
  }),
]

export function organicBuildChallengeById(id: string): OrganicBuildChallenge | undefined {
  if (id === 'hexane') return ORGANIC_BUILD_CHALLENGES.find((c) => c.id === 'n-hexane')
  return ORGANIC_BUILD_CHALLENGES.find((c) => c.id === id)
}

export function organicBuildByIsomerCandidate(
  candidateId: string,
): OrganicBuildChallenge | undefined {
  return ORGANIC_BUILD_CHALLENGES.find((c) => c.isomerCandidateId === candidateId)
}

export function organicChallengesByClass(classId: OrganicClassId): OrganicBuildChallenge[] {
  return ORGANIC_BUILD_CHALLENGES.filter((c) => c.classId === classId)
}

export function challengeBuildStage(c: OrganicBuildChallenge): OrganicBuildStage {
  return c.buildStage ?? 'chain'
}

export function organicChallengesByStage(stage: OrganicBuildStage | 'all'): OrganicBuildChallenge[] {
  if (stage === 'all') return [...ORGANIC_BUILD_CHALLENGES]
  return ORGANIC_BUILD_CHALLENGES.filter((c) => challengeBuildStage(c) === stage)
}

/** Эталонные молекулы «как на фото»: цепь → кольцо → каркас */
export const STAGE_SHOWCASE_IDS: Record<OrganicBuildStage, string> = {
  chain: 'n-hexane',
  ring: 'cyclohexane',
  cage: 'adamantane',
}
