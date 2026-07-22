import {
  ORGANIC_BUILD_CHALLENGES,
  ORGANIC_CLASS_LABELS,
  type OrganicClassId,
  type OrganicBuildChallenge,
} from '../researchLab/organicBuildCatalog'
import { organicGradeForMolecule } from '../curriculum/compoundGradeIndex'
import { hybridizationOf } from '../../chemistry/organic/organicLayout'
import { buildShowcaseGraph } from './buildShowcaseGraph'
import { accentForClass, inferFunctionalGroups } from './inferFunctionalGroups'
import {
  fructoseOpenGraph,
  glucosePyranoseGraph,
  sucroseSimplifiedGraph,
} from './geometries/carbGeometries'
import { triacetinGraph } from './geometries/fatGeometries'
import type { OrganicMoleculeDef } from './organicMoleculeTypes'

function fromChallenge(c: OrganicBuildChallenge): OrganicMoleculeDef {
  const grade = organicGradeForMolecule(c.id, c.classId)
  const graph = buildShowcaseGraph(c)
  const heavy = graph.atoms.find((a) => a.element === 'C')
  const hyb = heavy ? hybridizationOf(graph, heavy.id) : undefined
  return {
    id: c.id,
    classId: c.classId,
    formula: c.formula,
    nameRu: c.titleRu,
    nameEn: c.titleEn,
    nameUz: c.titleUz,
    descriptionRu: c.hintRu,
    descriptionEn: c.hintEn,
    descriptionUz: c.hintUz,
    grade,
    graph,
    functionalGroups: inferFunctionalGroups(graph, c.classId),
    equationRu: c.equationRu,
    equationEn: c.equationEn,
    equationUz: c.equationUz,
    challengeId: c.id,
    viewHints: heavy
      ? { hybridFocusId: heavy.id, hybridFocus: hyb === 'terminal' ? 'sp3' : hyb }
      : undefined,
    accentColor: accentForClass(c.classId),
  }
}

function extraCarb(
  id: string,
  graph: OrganicMoleculeDef['graph'],
  names: { ru: string; en: string; uz: string },
  desc: { ru: string; en: string; uz: string },
  formula: string,
  equationRu: string,
): OrganicMoleculeDef {
  return {
    id,
    classId: 'carb',
    formula,
    nameRu: names.ru,
    nameEn: names.en,
    nameUz: names.uz,
    descriptionRu: desc.ru,
    descriptionEn: desc.en,
    descriptionUz: desc.uz,
    grade: 'g10',
    graph,
    functionalGroups: inferFunctionalGroups(graph, 'carb'),
    equationRu,
    equationEn: equationRu,
    equationUz: equationRu,
    accentColor: accentForClass('carb'),
  }
}

const fromCatalog = ORGANIC_BUILD_CHALLENGES.map((c) => fromChallenge(c))

const extras: OrganicMoleculeDef[] = [
  extraCarb(
    'glucose-pyranose',
    glucosePyranoseGraph(),
    {
      ru: 'β-D-Глюкопираноза',
      en: 'β-D-Glucopyranose',
      uz: 'β-D-Glyukopiranoza',
    },
    {
      ru: 'Циклическая форма глюкозы (пираноза). Ключевой моносахарид, источник энергии.',
      en: 'Cyclic glucose (pyranose). Key monosaccharide, energy source.',
      uz: 'Siklik glyukoza (piranoza). Asosiy monosaxarid.',
    },
    'C₆H₁₂O₆',
    'C₆H₁₂O₆ → 2C₂H₅OH + 2CO₂',
  ),
  extraCarb(
    'fructose',
    fructoseOpenGraph(),
    { ru: 'Фруктоза', en: 'Fructose', uz: 'Fruktoza' },
    {
      ru: 'Кетоза C₆H₁₂O₆ — изомер глюкозы (учебная открытая форма).',
      en: 'Ketose C₆H₁₂O₆ — glucose isomer (open-chain teaching model).',
      uz: 'Ketoz C₆H₁₂O₆ — glyukoza izomeri.',
    },
    'C₆H₁₂O₆',
    'C₆H₁₂O₆ (фруктоза) — изомер глюкозы',
  ),
  extraCarb(
    'sucrose',
    sucroseSimplifiedGraph(),
    { ru: 'Сахароза', en: 'Sucrose', uz: 'Saxaroza' },
    {
      ru: 'Дисахарид: глюкоза + фруктоза (упрощённая 3D-схема для 10 класса).',
      en: 'Disaccharide: glucose + fructose (simplified 3D for grade 10).',
      uz: 'Disaxarid: glyukoza + fruktoza (soddalashtirilgan 3D).',
    },
    'C₁₂H₂₂O₁₁',
    'C₁₂H₂₂O₁₁ + H₂O → C₆H₁₂O₆ + C₆H₁₂O₆',
  ),
  {
    id: 'triacetin',
    classId: 'ester',
    formula: 'C₉H₁₄O₆',
    nameRu: 'Триацетин (модель жира)',
    nameEn: 'Triacetin (fat model)',
    nameUz: 'Triasetin (yogʻ modeli)',
    descriptionRu:
      'Учебная модель триглицерида: глицерин + три ацетата. В природе R — длинные жирные кислоты.',
    descriptionEn:
      'Teaching triglyceride model: glycerol + three acetates. In nature R are long fatty acids.',
    descriptionUz:
      'Triglisarid oʻquv modeli: glitserin + uch atsetat. Tabiatda R — uzun yogʻ kislotalari.',
    grade: 'g10',
    graph: triacetinGraph(),
    functionalGroups: inferFunctionalGroups(triacetinGraph(), 'ester'),
    equationRu: 'жир + 3NaOH → глицерин + 3RCOONa',
    equationEn: 'fat + 3NaOH → glycerol + 3RCOONa',
    equationUz: 'yogʻ + 3NaOH → glitserin + 3RCOONa',
    accentColor: accentForClass('ester'),
  },
]

export const ORGANIC_MOLECULES: readonly OrganicMoleculeDef[] = [...fromCatalog, ...extras]

export const organicMoleculeById: Record<string, OrganicMoleculeDef> = Object.fromEntries(
  ORGANIC_MOLECULES.map((m) => [m.id, m]),
)

export const ORGANIC_LAB_CLASS_ORDER: OrganicClassId[] = [
  'alkane',
  'cycloalkane',
  'alkene',
  'alkadiene',
  'alkyne',
  'arene',
  'alcohol',
  'polyol',
  'phenol',
  'ether',
  'aldehyde',
  'ketone',
  'acid',
  'ester',
  'carb',
  'halo',
  'nitrogen',
]

export function organicMoleculesByClass(classId: OrganicClassId | 'all'): OrganicMoleculeDef[] {
  if (classId === 'all') return [...ORGANIC_MOLECULES]
  return ORGANIC_MOLECULES.filter((m) => m.classId === classId)
}

export function pickOrganicClassLabel(classId: OrganicClassId, locale: string): string {
  const L = ORGANIC_CLASS_LABELS[classId]
  if (locale === 'en') return L.en
  if (locale === 'uz') return L.uz
  return L.ru
}

/** Приоритетный порядок для стартового выбора (порция 1). */
export const ORGANIC_TIER1_IDS = [
  'methane',
  'ethane',
  'propane',
  'n-butane',
  'ethylene',
  'acetylene',
  'benzene',
  'methanol',
  'ethanol',
  'formaldehyde',
  'acetaldehyde',
  'acetone',
  'acetic-acid',
  'cyclohexane',
  'glucose-pyranose',
] as const
