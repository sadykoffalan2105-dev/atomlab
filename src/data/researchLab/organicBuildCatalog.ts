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

export type OrganicKit = Readonly<Partial<Record<'C' | 'H' | 'O' | 'N' | 'Cl' | 'Br' | 'S', number>>>

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
  /** Подписать над каждым C его тип: I — первичный … IV — четвертичный (изооктан, с. 44) */
  showCarbonDegrees?: boolean
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

/**
 * Углеродный скелет для примеров учебника: главная цепь (или кольцо) из `main` атомов C,
 * алкильные заместители [позиция 1…main, длина], затем гетероатомы [индекс атома, элемент].
 */
function carbSkel(
  main: number,
  subs: readonly (readonly [number, number])[] = [],
  opts: { ring?: boolean; hetero?: readonly (readonly [number, OrganicElement])[]; double?: readonly (readonly [number, number])[] } = {},
): SkeletonSpec {
  const elements: OrganicElement[] = Array.from({ length: main }, () => 'C')
  const edges: Edge[] = []
  const isDouble = (a: number, b: number) =>
    (opts.double ?? []).some(([x, y]) => (x === a && y === b) || (x === b && y === a))
  for (let i = 0; i < main - 1; i++) edges.push(isDouble(i, i + 1) ? [i, i + 1, 2] : [i, i + 1])
  if (opts.ring) edges.push([main - 1, 0])
  for (const [pos, len] of subs) {
    let prev = pos - 1
    for (let k = 0; k < len; k++) {
      elements.push('C')
      const idx = elements.length - 1
      edges.push(isDouble(prev, idx) ? [prev, idx, 2] : [prev, idx])
      prev = idx
    }
  }
  for (const [at, el] of opts.hetero ?? []) {
    elements.push(el)
    edges.push([at, elements.length - 1])
  }
  return { elements, edges }
}

type Tri = readonly [title: string, hint: string, success: string]

/** Пример из учебника Kimyo 10 (гл. I–II): названия RU/EN/UZ одной строкой [название, подсказка, итог]. */
function tb(p: {
  id: string
  classId: OrganicClassId
  formula: string
  kit: OrganicKit
  ru: Tri
  en: Tri
  uz: Tri
  skeleton: SkeletonSpec
  equationRu: string
  irPeaks?: readonly IrPeak[]
  isomerCandidateId?: string
  showCarbonDegrees?: boolean
}): OrganicBuildChallenge {
  return ch({
    id: p.id,
    classId: p.classId,
    formula: p.formula,
    kit: p.kit,
    titleRu: p.ru[0],
    hintRu: p.ru[1],
    successRu: p.ru[2],
    titleEn: p.en[0],
    hintEn: p.en[1],
    successEn: p.en[2],
    titleUz: p.uz[0],
    hintUz: p.uz[1],
    successUz: p.uz[2],
    skeleton: p.skeleton,
    equationRu: p.equationRu,
    irPeaks: p.irPeaks,
    isomerCandidateId: p.isomerCandidateId,
    showCarbonDegrees: p.showCarbonDegrees,
  })
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
    hintRu: 'CH₂=CH–CH=CH₂ (IUPAC: бута-1,3-диен). Две двойные связи: C=C–C=C.',
    hintEn: 'CH₂=CH–CH=CH₂ (IUPAC: buta-1,3-diene). Two double bonds: C=C–C=C.',
    hintUz: 'CH₂=CH–CH=CH₂ (IUPAC: buta-1,3-diyen). Ikki qoʻsh bogʻ: C=C–C=C.',
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
    hintRu: 'HO–CH₂–CH₂–OH (IUPAC: этан-1,2-диол). Учебник, с. 28: мономер лавсана вместе с терефталевой кислотой.',
    hintEn: 'HO–CH₂–CH₂–OH (IUPAC: ethane-1,2-diol). Textbook p. 28: PET monomer with terephthalic acid.',
    hintUz: 'HO–CH₂–CH₂–OH (IUPAC: etan-1,2-diol). Darslik, 28-bet: tereftal kislota bilan lavsan monomeri.',
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
    titleRu: 'Этаналь (уксусный альдегид)',
    titleEn: 'Ethanal (acetaldehyde)',
    titleUz: 'Etanal (sirka aldegidi)',
    hintRu: 'CH₃–CHO: C–C=O. Учебник, с. 28: из двух молекул этаналя получается альдоль.',
    hintEn: 'CH₃–CHO: C–C=O. Textbook p. 28: two ethanal molecules give aldol.',
    hintUz: 'CH₃–CHO: C–C=O. Darslik, 28-bet: ikki etanal molekulasidan aldol hosil boʻladi.',
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
  // ——— Kimyo 10, гл. I–II: школьные примеры (с. 26–55), docs/textbook/g10-ch1-2-organic-examples.md ———
  // § 1.6 Типы реакций
  tb({
    id: '1-2-dichloroethane',
    classId: 'halo',
    formula: 'C₂H₄Cl₂',
    kit: { C: 2, H: 4, Cl: 2 },
    ru: ['1,2-Дихлорэтан', 'CH₂Cl–CH₂Cl: по атому Cl у каждого C. Учебник, с. 27: продукт присоединения Cl₂ к этену.', '1,2-Дихлорэтан собран — продукт реакции присоединения.'],
    en: ['1,2-Dichloroethane', 'CH₂Cl–CH₂Cl: one Cl on each C. Textbook p. 27: product of adding Cl₂ to ethene.', '1,2-Dichloroethane built — an addition product.'],
    uz: ['1,2-Dixloretan', 'CH₂Cl–CH₂Cl: har bir C da bittadan Cl. Darslik, 27-bet: etenga Cl₂ birikishi mahsuloti.', '1,2-Dixloretan yigʻildi — birikish mahsuloti.'],
    skeleton: carbSkel(2, [], { hetero: [[0, 'Cl'], [1, 'Cl']] }),
    equationRu: 'CH₂=CH₂ + Cl₂ → CH₂Cl–CH₂Cl',
  }),
  tb({
    id: '3-hydroxybutanal',
    classId: 'aldehyde',
    formula: 'C₄H₈O₂',
    kit: { C: 4, H: 8, O: 2 },
    ru: ['3-Гидроксибутаналь (альдоль)', 'CH₃–CH(OH)–CH₂–CHO: альдегидная группа на C1, OH на C3. Учебник, с. 28: образуется из двух молекул этаналя.', 'Альдоль собран: в одной молекуле и –OH, и –CHO.'],
    en: ['3-Hydroxybutanal (aldol)', 'CH₃–CH(OH)–CH₂–CHO: aldehyde group on C1, OH on C3. Textbook p. 28: formed from two ethanal molecules.', 'Aldol built: both –OH and –CHO in one molecule.'],
    uz: ['3-Gidroksibutanal (aldol)', 'CH₃–CH(OH)–CH₂–CHO: C1 da aldegid guruhi, C3 da OH. Darslik, 28-bet: ikki etanal molekulasidan hosil boʻladi.', 'Aldol yigʻildi: bitta molekulada –OH ham, –CHO ham bor.'],
    skeleton: {
      elements: ['C', 'C', 'C', 'C', 'O', 'O'],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [1, 4],
        [3, 5, 2],
      ],
    },
    irPeaks: [OH, CH, CO_ALD],
    equationRu: '2CH₃–CHO → CH₃–CH(OH)–CH₂–CHO',
  }),
  tb({
    id: 'terephthalic-acid',
    classId: 'acid',
    formula: 'C₈H₆O₄',
    kit: { C: 8, H: 6, O: 4 },
    ru: ['Терефталевая кислота', 'HOOC–C₆H₄–COOH (IUPAC: бензол-1,4-дикарбоновая кислота): две группы –COOH в пара-положении бензольного кольца. Учебник, с. 28: мономер лавсана.', 'Терефталевая кислота собрана — вместе с этиленгликолем даёт лавсан.'],
    en: ['Terephthalic acid', 'HOOC–C₆H₄–COOH (IUPAC: benzene-1,4-dicarboxylic acid): two –COOH groups para on the benzene ring. Textbook p. 28: PET monomer.', 'Terephthalic acid built — with ethylene glycol it gives PET.'],
    uz: ['Tereftal kislota', 'HOOC–C₆H₄–COOH (IUPAC: benzol-1,4-dikarbon kislota): benzol halqasining para-holatida ikki –COOH. Darslik, 28-bet: lavsan monomeri.', 'Tereftal kislota yigʻildi — etilenglikol bilan lavsan beradi.'],
    skeleton: {
      elements: ['C', 'C', 'C', 'C', 'C', 'C', 'C', 'C', 'O', 'O', 'O', 'O'],
      edges: [
        [0, 1, 2],
        [1, 2],
        [2, 3, 2],
        [3, 4],
        [4, 5, 2],
        [5, 0],
        [0, 6],
        [3, 7],
        [6, 8, 2],
        [6, 9],
        [7, 10, 2],
        [7, 11],
      ],
    },
    irPeaks: [OH, COOH, AROM],
    equationRu: 'nHOOC–C₆H₄–COOH + nHO–CH₂–CH₂–OH → (–OC–C₆H₄–CO–O–CH₂–CH₂–O–)ₙ + 2nH₂O',
  }),
  // § 1.7–1.8 Номенклатура
  tb({
    id: 'cysteine',
    classId: 'nitrogen',
    formula: 'C₃H₇NO₂S',
    kit: { C: 3, H: 7, N: 1, O: 2, S: 1 },
    ru: ['Цистеин', 'HS–CH₂–CH(NH₂)–COOH (IUPAC: 2-амино-3-сульфанилпропановая кислота). Учебник, с. 31: в одной молекуле три характеристические группы — –SH, –NH₂, –COOH; старшая –COOH даёт окончание «-овая кислота».', 'Цистеин собран: –SH, –NH₂ и –COOH на цепи из трёх C.'],
    en: ['Cysteine', 'HS–CH₂–CH(NH₂)–COOH (IUPAC: 2-amino-3-sulfanylpropanoic acid). Textbook p. 31: three characteristic groups — –SH, –NH₂, –COOH; the senior –COOH gives the “-oic acid” ending.', 'Cysteine built: –SH, –NH₂ and –COOH on a three-carbon chain.'],
    uz: ['Sistein', 'HS–CH₂–CH(NH₂)–COOH (IUPAC: 2-amino-3-sulfanilpropan kislota). Darslik, 31-bet: uchta xarakteristik guruh — –SH, –NH₂, –COOH; eng kattasi –COOH nomga «kislota» qoʻshadi.', 'Sistein yigʻildi: uch C li zanjirda –SH, –NH₂ va –COOH.'],
    skeleton: {
      elements: ['C', 'C', 'C', 'O', 'O', 'N', 'S'],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3, 2],
        [2, 4],
        [1, 5],
        [0, 6],
      ],
    },
    irPeaks: [OH, COOH, NH, CH],
    equationRu: 'HS–CH₂–CH(NH₂)–COOH — 2-амино-3-сульфанилпропановая кислота',
  }),
  tb({
    id: 'propanoic-acid',
    classId: 'acid',
    formula: 'C₃H₆O₂',
    kit: { C: 3, H: 6, O: 2 },
    ru: ['Пропановая кислота', 'CH₃–CH₂–COOH: углерод карбоксила входит в главную цепь (C1), поэтому «пропан-» + «-овая кислота». Учебник, с. 31.', 'Пропановая кислота собрана.'],
    en: ['Propanoic acid', 'CH₃–CH₂–COOH: the carboxyl carbon is C1 of the main chain, hence “propan-” + “-oic acid”. Textbook p. 31.', 'Propanoic acid built.'],
    uz: ['Propan kislota', 'CH₃–CH₂–COOH: karboksil uglerodi asosiy zanjirning C1 atomi, shuning uchun «propan» + «kislota». Darslik, 31-bet.', 'Propan kislota yigʻildi.'],
    skeleton: {
      elements: ['C', 'C', 'C', 'O', 'O'],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3, 2],
        [2, 4],
      ],
    },
    irPeaks: [OH, COOH, CH],
    equationRu: 'CH₃–CH₂–COOH — пропановая кислота',
  }),
  tb({
    id: 'isobutylene',
    classId: 'alkene',
    formula: 'C₄H₈',
    kit: { C: 4, H: 8 },
    ru: ['2-Метилпропен-1', 'CH₂=C(CH₃)–CH₃ (IUPAC: 2-метилпроп-1-ен). Учебник, с. 32: цепь нумеруют с того конца, к которому ближе двойная связь.', '2-Метилпропен-1 (изобутилен) собран.'],
    en: ['2-Methylpropene', 'CH₂=C(CH₃)–CH₃ (IUPAC: 2-methylprop-1-ene). Textbook p. 32: number the chain from the end nearer the double bond.', '2-Methylpropene (isobutylene) built.'],
    uz: ['2-Metilpropen-1', 'CH₂=C(CH₃)–CH₃ (IUPAC: 2-metilprop-1-en). Darslik, 32-bet: zanjir qoʻsh bogʻga yaqin uchidan raqamlanadi.', '2-Metilpropen-1 (izobutilen) yigʻildi.'],
    skeleton: carbSkel(3, [[2, 1]], { double: [[0, 1]] }),
    irPeaks: [CH, CC_D],
    equationRu: 'CH₂=C(CH₃)–CH₃ — 2-метилпроп-1-ен',
  }),
  tb({
    id: 'butan-2-ol',
    classId: 'alcohol',
    formula: 'C₄H₁₀O',
    kit: { C: 4, H: 10, O: 1 },
    ru: ['Бутанол-2', 'CH₃–CH(OH)–CH₂–CH₃ (IUPAC: бутан-2-ол): группа –OH у второго атома C. Учебник, с. 32.', 'Бутанол-2 — вторичный спирт.'],
    en: ['Butan-2-ol', 'CH₃–CH(OH)–CH₂–CH₃ (IUPAC: butan-2-ol): –OH on carbon 2. Textbook p. 32.', 'Butan-2-ol — a secondary alcohol.'],
    uz: ['Butanol-2', 'CH₃–CH(OH)–CH₂–CH₃ (IUPAC: butan-2-ol): –OH ikkinchi C da. Darslik, 32-bet.', 'Butanol-2 — ikkilamchi spirt.'],
    skeleton: carbSkel(4, [], { hetero: [[1, 'O']] }),
    irPeaks: [OH, CH, CO],
    equationRu: 'CH₃–CH(OH)–CH₂–CH₃ — бутан-2-ол',
  }),
  tb({
    id: 'butanone',
    classId: 'ketone',
    formula: 'C₄H₈O',
    kit: { C: 4, H: 8, O: 1 },
    ru: ['Бутанон-2', 'CH₃–CO–CH₂–CH₃ (IUPAC: бутан-2-он): группа C=O у второго атома C. Учебник, с. 32.', 'Бутанон-2 (метилэтилкетон) собран.'],
    en: ['Butan-2-one', 'CH₃–CO–CH₂–CH₃ (IUPAC: butan-2-one): C=O at carbon 2. Textbook p. 32.', 'Butan-2-one (methyl ethyl ketone) built.'],
    uz: ['Butanon-2', 'CH₃–CO–CH₂–CH₃ (IUPAC: butan-2-on): C=O ikkinchi C da. Darslik, 32-bet.', 'Butanon-2 (metiletilketon) yigʻildi.'],
    skeleton: {
      elements: ['C', 'C', 'C', 'C', 'O'],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [1, 4, 2],
      ],
    },
    irPeaks: [CH, CO_KET],
    equationRu: 'CH₃–CO–CH₂–CH₃ — бутан-2-он',
  }),
  tb({
    id: '4-bromomethylheptane',
    classId: 'halo',
    formula: 'C₈H₁₇Br',
    kit: { C: 8, H: 17, Br: 1 },
    ru: ['4-(Бромметил)гептан', 'Главная цепь — 7 атомов C, у C4 группа –CH₂Br. Учебник, с. 33: задача на номенклатуру — бромметил считается одним заместителем.', '4-(Бромметил)гептан собран.'],
    en: ['4-(Bromomethyl)heptane', 'Main chain of 7 C with a –CH₂Br group on C4. Textbook p. 33: naming task — bromomethyl is one substituent.', '4-(Bromomethyl)heptane built.'],
    uz: ['4-(Brommetil)geptan', 'Asosiy zanjir — 7 ta C, C4 da –CH₂Br guruhi. Darslik, 33-bet: nomlash masalasi — brommetil bitta oʻrinbosar.', '4-(Brommetil)geptan yigʻildi.'],
    skeleton: carbSkel(7, [[4, 1]], { hetero: [[7, 'Br']] }),
    equationRu: 'C₈H₁₇Br — 4-(бромметил)гептан',
  }),
  // § 2.2 Изомерия и номенклатура алканов
  tb({
    id: 'isooctane',
    classId: 'alkane',
    formula: 'C₈H₁₈',
    kit: { C: 8, H: 18 },
    ru: ['Изооктан (2,2,4-триметилпентан)', 'Учебник, с. 44. Над атомами C — их тип: I — первичный (связан с одним C), II — вторичный (с двумя), III — третичный (с тремя), IV — четвертичный (с четырьмя). В изооктане 5 первичных, 1 вторичный, 1 третичный и 1 четвертичный.', 'Изооктан — эталон бензина (октановое число 100).'],
    en: ['Isooctane (2,2,4-trimethylpentane)', 'Textbook p. 44. Labels over C show the type: I — primary (bonded to one C), II — secondary (two), III — tertiary (three), IV — quaternary (four). Isooctane has 5 primary, 1 secondary, 1 tertiary and 1 quaternary C.', 'Isooctane — the gasoline standard (octane number 100).'],
    uz: ['Izooktan (2,2,4-trimetilpentan)', 'Darslik, 44-bet. C atomlari ustida turi: I — birlamchi (bitta C bilan), II — ikkilamchi (ikkita), III — uchlamchi (uchta), IV — toʻrtlamchi (toʻrtta). Izooktanda 5 ta birlamchi, 1 ikkilamchi, 1 uchlamchi va 1 toʻrtlamchi C.', 'Izooktan — benzin etaloni (oktan soni 100).'],
    skeleton: carbSkel(5, [[2, 1], [2, 1], [4, 1]]),
    showCarbonDegrees: true,
    equationRu: '(CH₃)₃C–CH₂–CH(CH₃)₂ — 2,2,4-триметилпентан',
  }),
  tb({
    id: '2-methylhexane',
    isomerCandidateId: '2-methylhexane',
    classId: 'alkane',
    formula: 'C₇H₁₆',
    kit: { C: 7, H: 16 },
    ru: ['2-Метилгексан', 'Главная цепь — 6 C, метил у C2. Учебник, с. 44.', '2-Метилгексан — изомер гептана.'],
    en: ['2-Methylhexane', 'Main chain of 6 C, methyl on C2. Textbook p. 44.', '2-Methylhexane — an isomer of heptane.'],
    uz: ['2-Metilgeksan', 'Asosiy zanjir — 6 ta C, C2 da metil. Darslik, 44-bet.', '2-Metilgeksan — geptan izomeri.'],
    skeleton: carbSkel(6, [[2, 1]]),
    equationRu: 'CH₃–CH(CH₃)–CH₂–CH₂–CH₂–CH₃',
  }),
  tb({
    id: '3-methyl-4-ethylhexane',
    classId: 'alkane',
    formula: 'C₉H₂₀',
    kit: { C: 9, H: 20 },
    ru: ['4-Этил-3-метилгексан', 'Учебник, с. 44 называет «3-метил-4-этилгексан»; по IUPAC заместители перечисляют по алфавиту — 4-этил-3-метилгексан. Главная цепь — 6 C, CH₃ у C3, C₂H₅ у C4.', '4-Этил-3-метилгексан собран.'],
    en: ['4-Ethyl-3-methylhexane', 'The textbook (p. 44) says “3-methyl-4-ethylhexane”; IUPAC lists substituents alphabetically — 4-ethyl-3-methylhexane. Main chain of 6 C, CH₃ on C3, C₂H₅ on C4.', '4-Ethyl-3-methylhexane built.'],
    uz: ['4-Etil-3-metilgeksan', 'Darslik (44-bet) «3-metil-4-etilgeksan» deydi; IUPAC boʻyicha oʻrinbosarlar alifbo tartibida — 4-etil-3-metilgeksan. Asosiy zanjir — 6 ta C, C3 da CH₃, C4 da C₂H₅.', '4-Etil-3-metilgeksan yigʻildi.'],
    skeleton: carbSkel(6, [[3, 1], [4, 2]]),
    equationRu: 'CH₃–CH₂–CH(CH₃)–CH(C₂H₅)–CH₂–CH₃',
  }),
  tb({
    id: '2-3-5-trimethylhexane',
    classId: 'alkane',
    formula: 'C₉H₂₀',
    kit: { C: 9, H: 20 },
    ru: ['2,3,5-Триметилгексан', 'Главная цепь — 6 C, метилы у C2, C3 и C5 (нумерация даёт наименьшие номера). Учебник, с. 45.', '2,3,5-Триметилгексан собран.'],
    en: ['2,3,5-Trimethylhexane', 'Main chain of 6 C, methyls on C2, C3 and C5 (lowest locants). Textbook p. 45.', '2,3,5-Trimethylhexane built.'],
    uz: ['2,3,5-Trimetilgeksan', 'Asosiy zanjir — 6 ta C, C2, C3 va C5 da metil (eng kichik raqamlar). Darslik, 45-bet.', '2,3,5-Trimetilgeksan yigʻildi.'],
    skeleton: carbSkel(6, [[2, 1], [3, 1], [5, 1]]),
    equationRu: 'CH₃–CH(CH₃)–CH(CH₃)–CH₂–CH(CH₃)–CH₃',
  }),
  tb({
    id: 'n-heptane',
    isomerCandidateId: 'n-heptane',
    classId: 'alkane',
    formula: 'C₇H₁₆',
    kit: { C: 7, H: 16 },
    ru: ['Гептан', 'Неразветвлённая цепь из 7 C: CH₃–(CH₂)₅–CH₃. Учебник, с. 43: у C₇H₁₆ 9 изомеров.', 'Гептан — первый из 9 изомеров C₇H₁₆.'],
    en: ['Heptane', 'Unbranched chain of 7 C: CH₃–(CH₂)₅–CH₃. Textbook p. 43: C₇H₁₆ has 9 isomers.', 'Heptane — the first of the 9 C₇H₁₆ isomers.'],
    uz: ['Geptan', 'Shoxlanmagan 7 C zanjir: CH₃–(CH₂)₅–CH₃. Darslik, 43-bet: C₇H₁₆ ning 9 ta izomeri bor.', 'Geptan — C₇H₁₆ ning 9 izomeridan birinchisi.'],
    skeleton: carbSkel(7),
    equationRu: 'CH₃–(CH₂)₅–CH₃ — гептан',
  }),
  tb({
    id: '3-methylhexane',
    isomerCandidateId: '3-methylhexane',
    classId: 'alkane',
    formula: 'C₇H₁₆',
    kit: { C: 7, H: 16 },
    ru: ['3-Метилгексан', 'Главная цепь — 6 C, метил у C3. Изомер C₇H₁₆ (учебник, с. 43).', '3-Метилгексан собран.'],
    en: ['3-Methylhexane', 'Main chain of 6 C, methyl on C3. A C₇H₁₆ isomer (textbook p. 43).', '3-Methylhexane built.'],
    uz: ['3-Metilgeksan', 'Asosiy zanjir — 6 ta C, C3 da metil. C₇H₁₆ izomeri (darslik, 43-bet).', '3-Metilgeksan yigʻildi.'],
    skeleton: carbSkel(6, [[3, 1]]),
    equationRu: 'CH₃–CH₂–CH(CH₃)–CH₂–CH₂–CH₃',
  }),
  tb({
    id: '2-2-dimethylpentane',
    isomerCandidateId: '2-2-dimethylpentane',
    classId: 'alkane',
    formula: 'C₇H₁₆',
    kit: { C: 7, H: 16 },
    ru: ['2,2-Диметилпентан', 'Главная цепь — 5 C, два метила у C2. Учебник, с. 45: один из ответов задачи про C₇H₁₆ с цепью из 5 C.', '2,2-Диметилпентан собран.'],
    en: ['2,2-Dimethylpentane', 'Main chain of 5 C, two methyls on C2. Textbook p. 45: one answer to the C₇H₁₆ five-carbon-chain task.', '2,2-Dimethylpentane built.'],
    uz: ['2,2-Dimetilpentan', 'Asosiy zanjir — 5 ta C, C2 da ikki metil. Darslik, 45-bet: 5 C zanjirli C₇H₁₆ masalasining javoblaridan biri.', '2,2-Dimetilpentan yigʻildi.'],
    skeleton: carbSkel(5, [[2, 1], [2, 1]]),
    equationRu: 'CH₃–C(CH₃)₂–CH₂–CH₂–CH₃',
  }),
  tb({
    id: '2-3-dimethylpentane',
    isomerCandidateId: '2-3-dimethylpentane',
    classId: 'alkane',
    formula: 'C₇H₁₆',
    kit: { C: 7, H: 16 },
    ru: ['2,3-Диметилпентан', 'Главная цепь — 5 C, метилы у C2 и C3. Учебник, с. 45.', '2,3-Диметилпентан собран.'],
    en: ['2,3-Dimethylpentane', 'Main chain of 5 C, methyls on C2 and C3. Textbook p. 45.', '2,3-Dimethylpentane built.'],
    uz: ['2,3-Dimetilpentan', 'Asosiy zanjir — 5 ta C, C2 va C3 da metil. Darslik, 45-bet.', '2,3-Dimetilpentan yigʻildi.'],
    skeleton: carbSkel(5, [[2, 1], [3, 1]]),
    equationRu: 'CH₃–CH(CH₃)–CH(CH₃)–CH₂–CH₃',
  }),
  tb({
    id: '2-4-dimethylpentane',
    isomerCandidateId: '2-4-dimethylpentane',
    classId: 'alkane',
    formula: 'C₇H₁₆',
    kit: { C: 7, H: 16 },
    ru: ['2,4-Диметилпентан', 'Главная цепь — 5 C, метилы у C2 и C4. Учебник, с. 45.', '2,4-Диметилпентан собран.'],
    en: ['2,4-Dimethylpentane', 'Main chain of 5 C, methyls on C2 and C4. Textbook p. 45.', '2,4-Dimethylpentane built.'],
    uz: ['2,4-Dimetilpentan', 'Asosiy zanjir — 5 ta C, C2 va C4 da metil. Darslik, 45-bet.', '2,4-Dimetilpentan yigʻildi.'],
    skeleton: carbSkel(5, [[2, 1], [4, 1]]),
    equationRu: 'CH₃–CH(CH₃)–CH₂–CH(CH₃)–CH₃',
  }),
  tb({
    id: '3-3-dimethylpentane',
    isomerCandidateId: '3-3-dimethylpentane',
    classId: 'alkane',
    formula: 'C₇H₁₆',
    kit: { C: 7, H: 16 },
    ru: ['3,3-Диметилпентан', 'Главная цепь — 5 C, два метила у C3. Учебник, с. 45.', '3,3-Диметилпентан собран.'],
    en: ['3,3-Dimethylpentane', 'Main chain of 5 C, two methyls on C3. Textbook p. 45.', '3,3-Dimethylpentane built.'],
    uz: ['3,3-Dimetilpentan', 'Asosiy zanjir — 5 ta C, C3 da ikki metil. Darslik, 45-bet.', '3,3-Dimetilpentan yigʻildi.'],
    skeleton: carbSkel(5, [[3, 1], [3, 1]]),
    equationRu: 'CH₃–CH₂–C(CH₃)₂–CH₂–CH₃',
  }),
  tb({
    id: '3-ethylpentane',
    isomerCandidateId: '3-ethylpentane',
    classId: 'alkane',
    formula: 'C₇H₁₆',
    kit: { C: 7, H: 16 },
    ru: ['3-Этилпентан', 'Главная цепь — 5 C, этил у C3 (самая длинная цепь всё равно 5 C). Учебник, с. 45.', '3-Этилпентан собран.'],
    en: ['3-Ethylpentane', 'Main chain of 5 C, ethyl on C3 (the longest chain is still 5 C). Textbook p. 45.', '3-Ethylpentane built.'],
    uz: ['3-Etilpentan', 'Asosiy zanjir — 5 ta C, C3 da etil (eng uzun zanjir baribir 5 C). Darslik, 45-bet.', '3-Etilpentan yigʻildi.'],
    skeleton: carbSkel(5, [[3, 2]]),
    equationRu: 'CH₃–CH₂–CH(C₂H₅)–CH₂–CH₃',
  }),
  tb({
    id: '2-2-3-trimethylbutane',
    isomerCandidateId: '2-2-3-trimethylbutane',
    classId: 'alkane',
    formula: 'C₇H₁₆',
    kit: { C: 7, H: 16 },
    ru: ['2,2,3-Триметилбутан', 'Главная цепь — 4 C, два метила у C2 и один у C3. Самый разветвлённый изомер C₇H₁₆ (учебник, с. 43).', '2,2,3-Триметилбутан собран.'],
    en: ['2,2,3-Trimethylbutane', 'Main chain of 4 C, two methyls on C2 and one on C3. The most branched C₇H₁₆ isomer (textbook p. 43).', '2,2,3-Trimethylbutane built.'],
    uz: ['2,2,3-Trimetilbutan', 'Asosiy zanjir — 4 ta C, C2 da ikki, C3 da bitta metil. C₇H₁₆ ning eng shoxlangan izomeri (darslik, 43-bet).', '2,2,3-Trimetilbutan yigʻildi.'],
    skeleton: carbSkel(4, [[2, 1], [2, 1], [3, 1]]),
    equationRu: 'CH₃–C(CH₃)₂–CH(CH₃)–CH₃',
  }),
  // § 2.4 Свойства алканов: хлорирование метана, крекинг
  tb({
    id: 'dichloromethane',
    classId: 'halo',
    formula: 'CH₂Cl₂',
    kit: { C: 1, H: 2, Cl: 2 },
    ru: ['Дихлорметан (метиленхлорид)', 'C с двумя H и двумя Cl. Учебник, с. 50: вторая ступень хлорирования метана.', 'Дихлорметан собран.'],
    en: ['Dichloromethane (methylene chloride)', 'C with two H and two Cl. Textbook p. 50: second step of methane chlorination.', 'Dichloromethane built.'],
    uz: ['Dixlormetan (metilenxlorid)', 'Ikki H va ikki Cl bilan C. Darslik, 50-bet: metan xlorlanishining ikkinchi bosqichi.', 'Dixlormetan yigʻildi.'],
    skeleton: carbSkel(1, [], { hetero: [[0, 'Cl'], [0, 'Cl']] }),
    equationRu: 'CH₃Cl + Cl₂ → CH₂Cl₂ + HCl',
  }),
  tb({
    id: 'chloroform',
    classId: 'halo',
    formula: 'CHCl₃',
    kit: { C: 1, H: 1, Cl: 3 },
    ru: ['Хлороформ (трихлорметан)', 'C с одним H и тремя Cl. Учебник, с. 50: третья ступень хлорирования метана.', 'Хлороформ собран.'],
    en: ['Chloroform (trichloromethane)', 'C with one H and three Cl. Textbook p. 50: third step of methane chlorination.', 'Chloroform built.'],
    uz: ['Xloroform (trixlormetan)', 'Bitta H va uchta Cl bilan C. Darslik, 50-bet: metan xlorlanishining uchinchi bosqichi.', 'Xloroform yigʻildi.'],
    skeleton: carbSkel(1, [], { hetero: [[0, 'Cl'], [0, 'Cl'], [0, 'Cl']] }),
    equationRu: 'CH₂Cl₂ + Cl₂ → CHCl₃ + HCl',
  }),
  tb({
    id: 'tetrachloromethane',
    classId: 'halo',
    formula: 'CCl₄',
    kit: { C: 1, Cl: 4 },
    ru: ['Тетрахлорметан (хлорид углерода(IV))', 'C с четырьмя Cl, водородов нет. Учебник, с. 50: последняя ступень хлорирования метана.', 'Тетрахлорметан собран.'],
    en: ['Tetrachloromethane (carbon tetrachloride)', 'C with four Cl, no hydrogens. Textbook p. 50: last step of methane chlorination.', 'Tetrachloromethane built.'],
    uz: ['Tetraxlormetan (uglerod(IV) xlorid)', 'Toʻrt Cl bilan C, vodorod yoʻq. Darslik, 50-bet: metan xlorlanishining oxirgi bosqichi.', 'Tetraxlormetan yigʻildi.'],
    skeleton: carbSkel(1, [], { hetero: [[0, 'Cl'], [0, 'Cl'], [0, 'Cl'], [0, 'Cl']] }),
    equationRu: 'CHCl₃ + Cl₂ → CCl₄ + HCl',
  }),
  tb({
    id: '2-3-dimethylbut-2-ene',
    classId: 'alkene',
    formula: 'C₆H₁₂',
    kit: { C: 6, H: 12 },
    ru: ['2,3-Диметилбут-2-ен', '(CH₃)₂C=C(CH₃)₂: двойная связь между C2 и C3, у каждого по метилу. Учебник, с. 50: продукт крекинга декана.', '2,3-Диметилбут-2-ен собран.'],
    en: ['2,3-Dimethylbut-2-ene', '(CH₃)₂C=C(CH₃)₂: C2=C3 double bond, a methyl on each. Textbook p. 50: a decane cracking product.', '2,3-Dimethylbut-2-ene built.'],
    uz: ['2,3-Dimetilbut-2-en', '(CH₃)₂C=C(CH₃)₂: C2=C3 qoʻsh bogʻ, har birida metil. Darslik, 50-bet: dekan krekingi mahsuloti.', '2,3-Dimetilbut-2-en yigʻildi.'],
    skeleton: carbSkel(4, [[2, 1], [3, 1]], { double: [[1, 2]] }),
    irPeaks: [CH, CC_D],
    equationRu: 'CH₃–(CH₂)₈–CH₃ → C₄H₁₀ + (CH₃)₂C=C(CH₃)₂',
  }),
  // § 2.5–2.6 Циклоалканы
  tb({
    id: 'methylcyclopropane',
    isomerCandidateId: 'methylcyclopropane',
    classId: 'cycloalkane',
    formula: 'C₄H₈',
    kit: { C: 4, H: 8 },
    ru: ['Метилциклопропан', 'Кольцо из 3 C и метил. Учебник, с. 52: изомер циклобутана (C₄H₈).', 'Метилциклопропан собран.'],
    en: ['Methylcyclopropane', 'A 3-carbon ring plus a methyl. Textbook p. 52: an isomer of cyclobutane (C₄H₈).', 'Methylcyclopropane built.'],
    uz: ['Metiltsiklopropan', '3 C li halqa va metil. Darslik, 52-bet: tsiklobutan izomeri (C₄H₈).', 'Metiltsiklopropan yigʻildi.'],
    skeleton: carbSkel(3, [[1, 1]], { ring: true }),
    equationRu: 'C₄H₈ — метилциклопропан',
  }),
  tb({
    id: '1-2-dimethylcyclobutane',
    classId: 'cycloalkane',
    formula: 'C₆H₁₂',
    kit: { C: 6, H: 12 },
    ru: ['1,2-Диметилциклобутан', 'Кольцо из 4 C, метилы у соседних атомов C1 и C2. Учебник, с. 52.', '1,2-Диметилциклобутан собран.'],
    en: ['1,2-Dimethylcyclobutane', 'A 4-carbon ring, methyls on neighbouring C1 and C2. Textbook p. 52.', '1,2-Dimethylcyclobutane built.'],
    uz: ['1,2-Dimetiltsiklobutan', '4 C li halqa, qoʻshni C1 va C2 da metil. Darslik, 52-bet.', '1,2-Dimetiltsiklobutan yigʻildi.'],
    skeleton: carbSkel(4, [[1, 1], [2, 1]], { ring: true }),
    equationRu: 'C₆H₁₂ — 1,2-диметилциклобутан',
  }),
  tb({
    id: '1-methyl-3-ethylcyclopentane',
    classId: 'cycloalkane',
    formula: 'C₈H₁₆',
    kit: { C: 8, H: 16 },
    ru: ['1-Этил-3-метилциклопентан', 'Учебник, с. 52 называет «1-метил-3-этилциклопентан»; по IUPAC заместители по алфавиту — 1-этил-3-метилциклопентан. Кольцо из 5 C, C₂H₅ и CH₃ через один атом.', '1-Этил-3-метилциклопентан собран.'],
    en: ['1-Ethyl-3-methylcyclopentane', 'The textbook (p. 52) says “1-methyl-3-ethylcyclopentane”; IUPAC orders substituents alphabetically — 1-ethyl-3-methylcyclopentane. A 5-carbon ring, C₂H₅ and CH₃ one atom apart.', '1-Ethyl-3-methylcyclopentane built.'],
    uz: ['1-Etil-3-metiltsiklopentan', 'Darslik (52-bet) «1-metil-3-etiltsiklopentan» deydi; IUPAC boʻyicha alifbo tartibida — 1-etil-3-metiltsiklopentan. 5 C li halqa, C₂H₅ va CH₃ bir atom oraliqda.', '1-Etil-3-metiltsiklopentan yigʻildi.'],
    skeleton: carbSkel(5, [[1, 2], [3, 1]], { ring: true }),
    equationRu: 'C₈H₁₆ — 1-этил-3-метилциклопентан',
  }),
  tb({
    id: 'methylcyclobutane',
    isomerCandidateId: 'methylcyclobutane',
    classId: 'cycloalkane',
    formula: 'C₅H₁₀',
    kit: { C: 5, H: 10 },
    ru: ['Метилциклобутан', 'Кольцо из 4 C и метил. Изомер циклопентана (учебник, с. 53).', 'Метилциклобутан собран.'],
    en: ['Methylcyclobutane', 'A 4-carbon ring plus a methyl. An isomer of cyclopentane (textbook p. 53).', 'Methylcyclobutane built.'],
    uz: ['Metiltsiklobutan', '4 C li halqa va metil. Tsiklopentan izomeri (darslik, 53-bet).', 'Metiltsiklobutan yigʻildi.'],
    skeleton: carbSkel(4, [[1, 1]], { ring: true }),
    equationRu: 'C₅H₁₀ — метилциклобутан',
  }),
  tb({
    id: '1-1-dimethylcyclopropane',
    isomerCandidateId: '1-1-dimethylcyclopropane',
    classId: 'cycloalkane',
    formula: 'C₅H₁₀',
    kit: { C: 5, H: 10 },
    ru: ['1,1-Диметилциклопропан', 'Кольцо из 3 C, два метила у одного атома. Изомер циклопентана (учебник, с. 53).', '1,1-Диметилциклопропан собран.'],
    en: ['1,1-Dimethylcyclopropane', 'A 3-carbon ring, two methyls on one atom. An isomer of cyclopentane (textbook p. 53).', '1,1-Dimethylcyclopropane built.'],
    uz: ['1,1-Dimetiltsiklopropan', '3 C li halqa, bitta atomda ikki metil. Tsiklopentan izomeri (darslik, 53-bet).', '1,1-Dimetiltsiklopropan yigʻildi.'],
    skeleton: carbSkel(3, [[1, 1], [1, 1]], { ring: true }),
    equationRu: 'C₅H₁₀ — 1,1-диметилциклопропан',
  }),
  tb({
    id: '1-2-dimethylcyclopropane',
    isomerCandidateId: '1-2-dimethylcyclopropane',
    classId: 'cycloalkane',
    formula: 'C₅H₁₀',
    kit: { C: 5, H: 10 },
    ru: ['1,2-Диметилциклопропан', 'Кольцо из 3 C, метилы у соседних атомов. Изомер циклопентана (учебник, с. 53).', '1,2-Диметилциклопропан собран.'],
    en: ['1,2-Dimethylcyclopropane', 'A 3-carbon ring, methyls on neighbouring atoms. An isomer of cyclopentane (textbook p. 53).', '1,2-Dimethylcyclopropane built.'],
    uz: ['1,2-Dimetiltsiklopropan', '3 C li halqa, qoʻshni atomlarda metil. Tsiklopentan izomeri (darslik, 53-bet).', '1,2-Dimetiltsiklopropan yigʻildi.'],
    skeleton: carbSkel(3, [[1, 1], [2, 1]], { ring: true }),
    equationRu: 'C₅H₁₀ — 1,2-диметилциклопропан',
  }),
  tb({
    id: 'ethylcyclopropane',
    isomerCandidateId: 'ethylcyclopropane',
    classId: 'cycloalkane',
    formula: 'C₅H₁₀',
    kit: { C: 5, H: 10 },
    ru: ['Этилциклопропан', 'Кольцо из 3 C и этил. Изомер циклопентана (учебник, с. 53).', 'Этилциклопропан собран.'],
    en: ['Ethylcyclopropane', 'A 3-carbon ring plus an ethyl. An isomer of cyclopentane (textbook p. 53).', 'Ethylcyclopropane built.'],
    uz: ['Etiltsiklopropan', '3 C li halqa va etil. Tsiklopentan izomeri (darslik, 53-bet).', 'Etiltsiklopropan yigʻildi.'],
    skeleton: carbSkel(3, [[1, 2]], { ring: true }),
    equationRu: 'C₅H₁₀ — этилциклопропан',
  }),
  tb({
    id: '1-5-dibromopentane',
    classId: 'halo',
    formula: 'C₅H₁₀Br₂',
    kit: { C: 5, H: 10, Br: 2 },
    ru: ['1,5-Дибромпентан', 'BrCH₂–CH₂–CH₂–CH₂–CH₂Br: Br на обоих концах цепи из 5 C. Учебник, с. 54: цинк отнимает оба Br — концы цепи смыкаются в циклопентан.', '1,5-Дибромпентан собран — сырьё для циклопентана.'],
    en: ['1,5-Dibromopentane', 'BrCH₂–CH₂–CH₂–CH₂–CH₂Br: Br at both ends of a 5-carbon chain. Textbook p. 54: zinc removes both Br and the chain ends close into cyclopentane.', '1,5-Dibromopentane built — the starting material for cyclopentane.'],
    uz: ['1,5-Dibrompentan', 'BrCH₂–CH₂–CH₂–CH₂–CH₂Br: 5 C zanjirning ikki uchida Br. Darslik, 54-bet: rux ikkala Br ni tortib oladi va zanjir uchlari tsiklopentanga tutashadi.', '1,5-Dibrompentan yigʻildi — tsiklopentan uchun xomashyo.'],
    skeleton: carbSkel(5, [], { hetero: [[0, 'Br'], [4, 'Br']] }),
    equationRu: 'BrCH₂–(CH₂)₃–CH₂Br + Zn → C₅H₁₀ + ZnBr₂',
  }),
  tb({
    id: 'chlorocyclohexane',
    classId: 'halo',
    formula: 'C₆H₁₁Cl',
    kit: { C: 6, H: 11, Cl: 1 },
    ru: ['Хлорциклогексан', 'Кольцо из 6 C, один H заменён на Cl. Учебник, с. 55: продукт хлорирования циклогексана на свету.', 'Хлорциклогексан собран.'],
    en: ['Chlorocyclohexane', 'A 6-carbon ring with one H replaced by Cl. Textbook p. 55: product of cyclohexane chlorination in light.', 'Chlorocyclohexane built.'],
    uz: ['Xlortsiklogeksan', '6 C li halqa, bitta H oʻrnida Cl. Darslik, 55-bet: yorugʻlikda tsiklogeksan xlorlanishi mahsuloti.', 'Xlortsiklogeksan yigʻildi.'],
    skeleton: carbSkel(6, [], { ring: true, hetero: [[0, 'Cl']] }),
    equationRu: 'C₆H₁₂ + Cl₂ → C₆H₁₁Cl + HCl',
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

export function challengeBuildStage(c: OrganicBuildChallenge): OrganicBuildStage {
  return c.buildStage ?? 'chain'
}
