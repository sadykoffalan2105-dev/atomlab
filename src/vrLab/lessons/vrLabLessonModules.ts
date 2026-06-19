import type { VrLabLessonModule } from './types'

export const VR_LAB_LESSONS: VrLabLessonModule[] = [
  {
    id: 'vr-lesson-neutralization',
    titleKey: 'vrLab.lesson.neutralization.title',
    grade: 8,
    reactionIds: ['neutralization_hcl_naoh', 'neutralization_h2so4_naoh', 'neutralization_hcl_koh'],
    theoryKeys: [
      'vrLab.lesson.neutralization.theory1',
      'vrLab.lesson.neutralization.theory2',
      'vrLab.lesson.neutralization.theory3',
    ],
    safetyKeys: ['vrLab.lesson.safety.goggles', 'vrLab.lesson.safety.noSkinContact'],
    quiz: [
      {
        id: 'q1',
        promptKey: 'vrLab.lesson.neutralization.q1',
        options: [
          { id: 'a', labelKey: 'vrLab.lesson.neutralization.q1a', correct: true },
          { id: 'b', labelKey: 'vrLab.lesson.neutralization.q1b' },
          { id: 'c', labelKey: 'vrLab.lesson.neutralization.q1c' },
        ],
        explanationKey: 'vrLab.lesson.neutralization.q1exp',
      },
      {
        id: 'q2',
        promptKey: 'vrLab.lesson.neutralization.q2',
        options: [
          { id: 'a', labelKey: 'vrLab.lesson.neutralization.q2a' },
          { id: 'b', labelKey: 'vrLab.lesson.neutralization.q2b', correct: true },
          { id: 'c', labelKey: 'vrLab.lesson.neutralization.q2c' },
        ],
        explanationKey: 'vrLab.lesson.neutralization.q2exp',
      },
    ],
    practiceMissionKey: 'vrLab.lesson.neutralization.mission',
    compounds: ['hcl', 'naoh'],
  },
  {
    id: 'vr-lesson-gas-evolution',
    titleKey: 'vrLab.lesson.gas.title',
    grade: 8,
    reactionIds: ['gas_co2_carbonate', 'gas_nh3_hcl', 'gas_h2o2_catalysis', 'gas_co2_water'],
    theoryKeys: [
      'vrLab.lesson.gas.theory1',
      'vrLab.lesson.gas.theory2',
    ],
    safetyKeys: ['vrLab.lesson.safety.goggles', 'vrLab.lesson.safety.ventilation'],
    quiz: [
      {
        id: 'q1',
        promptKey: 'vrLab.lesson.gas.q1',
        options: [
          { id: 'a', labelKey: 'vrLab.lesson.gas.q1a', correct: true },
          { id: 'b', labelKey: 'vrLab.lesson.gas.q1b' },
          { id: 'c', labelKey: 'vrLab.lesson.gas.q1c' },
        ],
        explanationKey: 'vrLab.lesson.gas.q1exp',
      },
    ],
    practiceMissionKey: 'vrLab.lesson.gas.mission',
    compounds: ['hcl', 'salt_na_co3'],
  },
  {
    id: 'vr-lesson-hydration',
    titleKey: 'vrLab.lesson.hydration.title',
    grade: 8,
    reactionIds: ['hydration_cao'],
    theoryKeys: ['vrLab.lesson.hydration.theory1', 'vrLab.lesson.hydration.theory2'],
    safetyKeys: ['vrLab.lesson.safety.goggles', 'vrLab.lesson.safety.heat'],
    quiz: [
      {
        id: 'q1',
        promptKey: 'vrLab.lesson.hydration.q1',
        options: [
          { id: 'a', labelKey: 'vrLab.lesson.hydration.q1a' },
          { id: 'b', labelKey: 'vrLab.lesson.hydration.q1b', correct: true },
          { id: 'c', labelKey: 'vrLab.lesson.hydration.q1c' },
        ],
        explanationKey: 'vrLab.lesson.hydration.q1exp',
      },
    ],
    practiceMissionKey: 'vrLab.lesson.hydration.mission',
    compounds: ['cao', 'h2o'],
  },
  {
    id: 'vr-lesson-color-shift',
    titleKey: 'vrLab.lesson.color.title',
    grade: 9,
    reactionIds: ['color_cuo_h2so4', 'color_fe2o3_hcl'],
    theoryKeys: ['vrLab.lesson.color.theory1'],
    safetyKeys: ['vrLab.lesson.safety.goggles', 'vrLab.lesson.safety.acid'],
    quiz: [
      {
        id: 'q1',
        promptKey: 'vrLab.lesson.color.q1',
        options: [
          { id: 'a', labelKey: 'vrLab.lesson.color.q1a', correct: true },
          { id: 'b', labelKey: 'vrLab.lesson.color.q1b' },
          { id: 'c', labelKey: 'vrLab.lesson.color.q1c' },
        ],
        explanationKey: 'vrLab.lesson.color.q1exp',
      },
    ],
    practiceMissionKey: 'vrLab.lesson.color.mission',
    compounds: ['cuo', 'h2so4'],
  },
]

export function vrLabLessonById(id: string): VrLabLessonModule | undefined {
  return VR_LAB_LESSONS.find((l) => l.id === id)
}
