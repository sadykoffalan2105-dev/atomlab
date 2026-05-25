import { compoundById } from './compounds'
import { buildHubSlides } from './learnTopicHubSlides'
import type { MessageKey } from '../i18n/messagesRu'
import type { LearnLesson, LearnTopic, LearnVisualThemeId, LearnTopicCoreId } from '../types/learn'

function assertCompound(id: string) {
  if (!compoundById[id]) {
    throw new Error(`learnCurriculum: unknown compoundId "${id}"`)
  }
}

const rawLessons: LearnLesson[] = [
  {
    id: 'l_periodicity',
    topicId: 'periodicity',
    titleKey: 'learn.L.l_periodicity.title',
    estimatedMin: 8,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_periodicity.s0' },
      { type: 'read', bodyKey: 'learn.L.l_periodicity.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_periodicity.h_b', compoundId: 'h2o' },
      { type: 'read', bodyKey: 'learn.L.l_periodicity.s3' },
    ],
  },
  {
    id: 'l_bond_types',
    topicId: 'bond_types',
    titleKey: 'learn.L.l_bond_types.title',
    estimatedMin: 8,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_bond_types.s0' },
      { type: 'read', bodyKey: 'learn.L.l_bond_types.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_bond_types.h_b', compoundId: 'h2o' },
      { type: 'read', bodyKey: 'learn.L.l_bond_types.s3' },
    ],
  },
  {
    id: 'l_oxides_acidic',
    topicId: 'oxides_acidic',
    titleKey: 'learn.L.l_oxides_acidic.title',
    estimatedMin: 9,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_oxides_acidic.s0' },
      { type: 'read', bodyKey: 'learn.L.l_oxides_acidic.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_oxides_acidic.h_b', compoundId: 'co2' },
      { type: 'read', bodyKey: 'learn.L.l_oxides_acidic.s3' },
    ],
  },
  {
    id: 'l_oxides_basic',
    topicId: 'oxides_basic',
    titleKey: 'learn.L.l_oxides_basic.title',
    estimatedMin: 8,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_oxides_basic.s0' },
      { type: 'read', bodyKey: 'learn.L.l_oxides_basic.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_oxides_basic.h_b', compoundId: 'cao' },
      { type: 'read', bodyKey: 'learn.L.l_oxides_basic.s3' },
    ],
  },
  {
    id: 'l_oxides_amphoteric',
    topicId: 'oxides_amphoteric',
    titleKey: 'learn.L.l_oxides_amphoteric.title',
    estimatedMin: 9,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_oxides_amphoteric.s0' },
      { type: 'read', bodyKey: 'learn.L.l_oxides_amphoteric.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_oxides_amphoteric.h_b', compoundId: 'al2o3' },
      { type: 'read', bodyKey: 'learn.L.l_oxides_amphoteric.s3' },
    ],
  },
  {
    id: 'l_acids_strong',
    topicId: 'acids_strong',
    titleKey: 'learn.L.l_acids_strong.title',
    estimatedMin: 9,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_acids_strong.s0' },
      { type: 'read', bodyKey: 'learn.L.l_acids_strong.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_acids_strong.h_b', compoundId: 'h2so4' },
      { type: 'read', bodyKey: 'learn.L.l_acids_strong.s3' },
    ],
  },
  {
    id: 'l_acids_weak',
    topicId: 'acids_weak',
    titleKey: 'learn.L.l_acids_weak.title',
    estimatedMin: 8,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_acids_weak.s0' },
      { type: 'read', bodyKey: 'learn.L.l_acids_weak.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_acids_weak.h_b', compoundId: 'h2co3' },
      { type: 'read', bodyKey: 'learn.L.l_acids_weak.s3' },
    ],
  },
  {
    id: 'l_bases_alkali',
    topicId: 'bases_alkali',
    titleKey: 'learn.L.l_bases_alkali.title',
    estimatedMin: 8,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_bases_alkali.s0' },
      { type: 'read', bodyKey: 'learn.L.l_bases_alkali.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_bases_alkali.h_b', compoundId: 'naoh' },
      { type: 'read', bodyKey: 'learn.L.l_bases_alkali.s3' },
    ],
  },
  {
    id: 'l_salts_ionic',
    topicId: 'salts_ionic',
    titleKey: 'learn.L.l_salts_ionic.title',
    estimatedMin: 8,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_salts_ionic.s0' },
      { type: 'read', bodyKey: 'learn.L.l_salts_ionic.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_salts_ionic.h_b', compoundId: 'nacl' },
      { type: 'read', bodyKey: 'learn.L.l_salts_ionic.s3' },
    ],
  },
  {
    id: 'l_salts_solubility',
    topicId: 'salts_solubility',
    titleKey: 'learn.L.l_salts_solubility.title',
    estimatedMin: 8,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_salts_solubility.s0' },
      { type: 'read', bodyKey: 'learn.L.l_salts_solubility.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_salts_solubility.h_b', compoundId: 'salt_nahco3' },
      { type: 'read', bodyKey: 'learn.L.l_salts_solubility.s3' },
    ],
  },
  {
    id: 'l_gases_nitrogen',
    topicId: 'gases_nitrogen',
    titleKey: 'learn.L.l_gases_nitrogen.title',
    estimatedMin: 8,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_gases_nitrogen.s0' },
      { type: 'read', bodyKey: 'learn.L.l_gases_nitrogen.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_gases_nitrogen.h_b', compoundId: 'no2' },
      { type: 'read', bodyKey: 'learn.L.l_gases_nitrogen.s3' },
    ],
  },
  {
    id: 'l_gases_sulfur',
    topicId: 'gases_sulfur',
    titleKey: 'learn.L.l_gases_sulfur.title',
    estimatedMin: 8,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_gases_sulfur.s0' },
      { type: 'read', bodyKey: 'learn.L.l_gases_sulfur.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_gases_sulfur.h_b', compoundId: 'so2' },
      { type: 'read', bodyKey: 'learn.L.l_gases_sulfur.s3' },
    ],
  },
  {
    id: 'l_halogens_intro',
    topicId: 'halogens_intro',
    titleKey: 'learn.L.l_halogens_intro.title',
    estimatedMin: 8,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_halogens_intro.s0' },
      { type: 'read', bodyKey: 'learn.L.l_halogens_intro.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_halogens_intro.h_b', compoundId: 'hcl' },
      { type: 'read', bodyKey: 'learn.L.l_halogens_intro.s3' },
    ],
  },
  {
    id: 'l_metals_activity',
    topicId: 'metals_activity',
    titleKey: 'learn.L.l_metals_activity.title',
    estimatedMin: 8,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_metals_activity.s0' },
      { type: 'read', bodyKey: 'learn.L.l_metals_activity.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_metals_activity.h_b', compoundId: 'cuo' },
      { type: 'read', bodyKey: 'learn.L.l_metals_activity.s3' },
    ],
  },
  {
    id: 'l_redox_intro',
    topicId: 'redox_intro',
    titleKey: 'learn.L.l_redox_intro.title',
    estimatedMin: 9,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_redox_intro.s0' },
      { type: 'read', bodyKey: 'learn.L.l_redox_intro.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_redox_intro.h_b', compoundId: 'mno2' },
      { type: 'tryLaboratory', bodyKey: 'learn.tryLabLessonBody' },
    ],
  },
  {
    id: 'l_electrolysis_intro',
    topicId: 'electrolysis_intro',
    titleKey: 'learn.L.l_electrolysis_intro.title',
    estimatedMin: 8,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_electrolysis_intro.s0' },
      { type: 'read', bodyKey: 'learn.L.l_electrolysis_intro.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_electrolysis_intro.h_b', compoundId: 'nacl' },
      { type: 'read', bodyKey: 'learn.L.l_electrolysis_intro.s3' },
    ],
  },
  {
    id: 'l_water_chemistry',
    topicId: 'water_chemistry',
    titleKey: 'learn.L.l_water_chemistry.title',
    estimatedMin: 8,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_water_chemistry.s0' },
      { type: 'read', bodyKey: 'learn.L.l_water_chemistry.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_water_chemistry.h_b', compoundId: 'h2o' },
      { type: 'read', bodyKey: 'learn.L.l_water_chemistry.s3' },
    ],
  },
  {
    id: 'l_qual_analysis',
    topicId: 'qual_analysis',
    titleKey: 'learn.L.l_qual_analysis.title',
    estimatedMin: 8,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_qual_analysis.s0' },
      { type: 'read', bodyKey: 'learn.L.l_qual_analysis.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_qual_analysis.h_b', compoundId: 'salt_k2cr2o7' },
      { type: 'read', bodyKey: 'learn.L.l_qual_analysis.s3' },
    ],
  },
  {
    id: 'l_industrial_touch',
    topicId: 'industrial_touch',
    titleKey: 'learn.L.l_industrial_touch.title',
    estimatedMin: 8,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_industrial_touch.s0' },
      { type: 'read', bodyKey: 'learn.L.l_industrial_touch.s1' },
      { type: 'highlightCompound', bodyKey: 'learn.L.l_industrial_touch.h_b', compoundId: 'so3' },
      { type: 'read', bodyKey: 'learn.L.l_industrial_touch.s3' },
    ],
  },
  {
    id: 'l_safety_lab',
    topicId: 'safety_lab',
    titleKey: 'learn.L.l_safety_lab.title',
    estimatedMin: 6,
    steps: [
      { type: 'read', bodyKey: 'learn.L.l_safety_lab.s0' },
      { type: 'read', bodyKey: 'learn.L.l_safety_lab.s1' },
      { type: 'read', bodyKey: 'learn.L.l_safety_lab.s2' },
      { type: 'tryLaboratory', bodyKey: 'learn.tryLabLessonBody' },
    ],
  },
]

function augmentLessonSteps(lesson: LearnLesson): LearnLesson {
  const extra = 3
  if (lesson.id === 'l_safety_lab') {
    const [s0, s1, s2, tl] = lesson.steps
    return {
      ...lesson,
      estimatedMin: lesson.estimatedMin + extra,
      steps: [
        s0,
        s1,
        s2,
        { type: 'read', bodyKey: 'learn.L.l_safety_lab.s4' as MessageKey },
        { type: 'read', bodyKey: 'learn.L.l_safety_lab.s5' as MessageKey },
        tl,
      ],
    }
  }
  const [s0, s1, ...tail] = lesson.steps
  return {
    ...lesson,
    estimatedMin: lesson.estimatedMin + extra,
    steps: [
      s0,
      s1,
      { type: 'read', bodyKey: `learn.L.${lesson.id}.s4` as MessageKey },
      { type: 'read', bodyKey: `learn.L.${lesson.id}.s5` as MessageKey },
      ...tail,
    ],
  }
}

const lessons: LearnLesson[] = rawLessons.map(augmentLessonSteps)

for (const lesson of lessons) {
  for (const step of lesson.steps) {
    if (step.type === 'highlightCompound') assertCompound(step.compoundId)
  }
}

const VISUAL_THEMES: LearnVisualThemeId[] = [
  'vt0',
  'vt1',
  'vt2',
  'vt3',
  'vt4',
  'vt5',
  'vt6',
  'vt7',
  'vt8',
  'vt9',
  'vt10',
  'vt11',
]

type TopicSeed = Pick<
  LearnTopic,
  'id' | 'order' | 'titleKey' | 'summaryKey' | 'totemCompoundId' | 'experimentKey'
> & { lessonId: string }

const topicSeeds: TopicSeed[] = [
  {
    id: 'periodicity',
    order: 0,
    titleKey: 'learn.T.periodicity.title',
    summaryKey: 'learn.T.periodicity.summary',
    experimentKey: 'learn.T.periodicity.experiment',
    totemCompoundId: 'h2o',
    lessonId: 'l_periodicity',
  },
  {
    id: 'bond_types',
    order: 1,
    titleKey: 'learn.T.bond_types.title',
    summaryKey: 'learn.T.bond_types.summary',
    experimentKey: 'learn.T.bond_types.experiment',
    totemCompoundId: 'h2o',
    lessonId: 'l_bond_types',
  },
  {
    id: 'oxides_acidic',
    order: 2,
    titleKey: 'learn.T.oxides_acidic.title',
    summaryKey: 'learn.T.oxides_acidic.summary',
    experimentKey: 'learn.T.oxides_acidic.experiment',
    totemCompoundId: 'co2',
    lessonId: 'l_oxides_acidic',
  },
  {
    id: 'oxides_basic',
    order: 3,
    titleKey: 'learn.T.oxides_basic.title',
    summaryKey: 'learn.T.oxides_basic.summary',
    experimentKey: 'learn.T.oxides_basic.experiment',
    totemCompoundId: 'cao',
    lessonId: 'l_oxides_basic',
  },
  {
    id: 'oxides_amphoteric',
    order: 4,
    titleKey: 'learn.T.oxides_amphoteric.title',
    summaryKey: 'learn.T.oxides_amphoteric.summary',
    experimentKey: 'learn.T.oxides_amphoteric.experiment',
    totemCompoundId: 'al2o3',
    lessonId: 'l_oxides_amphoteric',
  },
  {
    id: 'acids_strong',
    order: 5,
    titleKey: 'learn.T.acids_strong.title',
    summaryKey: 'learn.T.acids_strong.summary',
    experimentKey: 'learn.T.acids_strong.experiment',
    totemCompoundId: 'h2so4',
    lessonId: 'l_acids_strong',
  },
  {
    id: 'acids_weak',
    order: 6,
    titleKey: 'learn.T.acids_weak.title',
    summaryKey: 'learn.T.acids_weak.summary',
    experimentKey: 'learn.T.acids_weak.experiment',
    totemCompoundId: 'h2co3',
    lessonId: 'l_acids_weak',
  },
  {
    id: 'bases_alkali',
    order: 7,
    titleKey: 'learn.T.bases_alkali.title',
    summaryKey: 'learn.T.bases_alkali.summary',
    experimentKey: 'learn.T.bases_alkali.experiment',
    totemCompoundId: 'naoh',
    lessonId: 'l_bases_alkali',
  },
  {
    id: 'salts_ionic',
    order: 8,
    titleKey: 'learn.T.salts_ionic.title',
    summaryKey: 'learn.T.salts_ionic.summary',
    experimentKey: 'learn.T.salts_ionic.experiment',
    totemCompoundId: 'nacl',
    lessonId: 'l_salts_ionic',
  },
  {
    id: 'salts_solubility',
    order: 9,
    titleKey: 'learn.T.salts_solubility.title',
    summaryKey: 'learn.T.salts_solubility.summary',
    experimentKey: 'learn.T.salts_solubility.experiment',
    totemCompoundId: 'salt_nahco3',
    lessonId: 'l_salts_solubility',
  },
  {
    id: 'gases_nitrogen',
    order: 10,
    titleKey: 'learn.T.gases_nitrogen.title',
    summaryKey: 'learn.T.gases_nitrogen.summary',
    experimentKey: 'learn.T.gases_nitrogen.experiment',
    totemCompoundId: 'no2',
    lessonId: 'l_gases_nitrogen',
  },
  {
    id: 'gases_sulfur',
    order: 11,
    titleKey: 'learn.T.gases_sulfur.title',
    summaryKey: 'learn.T.gases_sulfur.summary',
    experimentKey: 'learn.T.gases_sulfur.experiment',
    totemCompoundId: 'so2',
    lessonId: 'l_gases_sulfur',
  },
  {
    id: 'halogens_intro',
    order: 12,
    titleKey: 'learn.T.halogens_intro.title',
    summaryKey: 'learn.T.halogens_intro.summary',
    experimentKey: 'learn.T.halogens_intro.experiment',
    totemCompoundId: 'hcl',
    lessonId: 'l_halogens_intro',
  },
  {
    id: 'metals_activity',
    order: 13,
    titleKey: 'learn.T.metals_activity.title',
    summaryKey: 'learn.T.metals_activity.summary',
    experimentKey: 'learn.T.metals_activity.experiment',
    totemCompoundId: 'cuo',
    lessonId: 'l_metals_activity',
  },
  {
    id: 'redox_intro',
    order: 14,
    titleKey: 'learn.T.redox_intro.title',
    summaryKey: 'learn.T.redox_intro.summary',
    experimentKey: 'learn.T.redox_intro.experiment',
    totemCompoundId: 'mno2',
    lessonId: 'l_redox_intro',
  },
  {
    id: 'electrolysis_intro',
    order: 15,
    titleKey: 'learn.T.electrolysis_intro.title',
    summaryKey: 'learn.T.electrolysis_intro.summary',
    experimentKey: 'learn.T.electrolysis_intro.experiment',
    totemCompoundId: 'nacl',
    lessonId: 'l_electrolysis_intro',
  },
  {
    id: 'water_chemistry',
    order: 16,
    titleKey: 'learn.T.water_chemistry.title',
    summaryKey: 'learn.T.water_chemistry.summary',
    experimentKey: 'learn.T.water_chemistry.experiment',
    totemCompoundId: 'h2o',
    lessonId: 'l_water_chemistry',
  },
  {
    id: 'qual_analysis',
    order: 17,
    titleKey: 'learn.T.qual_analysis.title',
    summaryKey: 'learn.T.qual_analysis.summary',
    experimentKey: 'learn.T.qual_analysis.experiment',
    totemCompoundId: 'salt_k2cr2o7',
    lessonId: 'l_qual_analysis',
  },
  {
    id: 'industrial_touch',
    order: 18,
    titleKey: 'learn.T.industrial_touch.title',
    summaryKey: 'learn.T.industrial_touch.summary',
    experimentKey: 'learn.T.industrial_touch.experiment',
    totemCompoundId: 'so3',
    lessonId: 'l_industrial_touch',
  },
  {
    id: 'safety_lab',
    order: 19,
    titleKey: 'learn.T.safety_lab.title',
    summaryKey: 'learn.T.safety_lab.summary',
    experimentKey: 'learn.T.safety_lab.experiment',
    totemCompoundId: 'h2o',
    lessonId: 'l_safety_lab',
  },
]

const lessonByIdMap = new Map(lessons.map((l) => [l.id, l]))

export const LEARN_TOPICS = (
  topicSeeds.map((seed, i) => {
    const L = lessonByIdMap.get(seed.lessonId)
    if (!L || L.topicId !== seed.id) {
      throw new Error(`learnCurriculum: missing or mismatched lesson "${seed.lessonId}" for topic "${seed.id}"`)
    }
    const topic: LearnTopic = {
      id: seed.id,
      order: seed.order,
      titleKey: seed.titleKey,
      summaryKey: seed.summaryKey,
      totemCompoundId: seed.totemCompoundId,
      experimentKey: seed.experimentKey,
      visualThemeId: VISUAL_THEMES[i % VISUAL_THEMES.length]!,
      hubSlides: buildHubSlides(seed.id as LearnTopicCoreId),
      lessons: [L],
    }
    return topic
  })
).sort((a, b) => a.order - b.order)

for (const t of LEARN_TOPICS) {
  assertCompound(t.totemCompoundId)
}

const lessonById = new Map<string, LearnLesson>()
for (const t of LEARN_TOPICS) {
  for (const l of t.lessons) lessonById.set(l.id, l)
}

export function learnTopicById(id: string): LearnTopic | undefined {
  return LEARN_TOPICS.find((t) => t.id === id)
}

export function learnLessonById(id: string): LearnLesson | undefined {
  return lessonById.get(id)
}

export function learnTotalLessonCount(): number {
  return lessons.length
}
