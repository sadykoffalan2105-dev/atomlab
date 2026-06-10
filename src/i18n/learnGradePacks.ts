import { learnAssistantEn, learnAssistantRu, learnAssistantUz } from './learn/assistantI18n'
import { learnGradesOutlineEn } from './learn/gradesOutlineEn'
import { learnGradesOutlineRu } from './learn/gradesOutlineRu'
import { learnGradesOutlineUz } from './learn/gradesOutlineUz'
import { learnG7PilotEn } from './learn/g7PilotEn'
import { learnG7PilotRu } from './learn/g7PilotRu'
import { learnG7PilotUz } from './learn/g7PilotUz'
import { learnOutlineContentEn } from './learn/learnOutlineContentEn'
import { learnOutlineContentRu } from './learn/learnOutlineContentRu'
import { learnVisualI18nEn } from './learn/learnVisualI18nEn'
import { learnVisualI18nRu } from './learn/learnVisualI18nRu'
import { learnTeacherI18nEn, learnTeacherI18nRu } from './learn/learnTeacherI18n'
import { learnCyberG7C1S01Ru } from './learn/learnCyberG7C1S01Ru'
import { learnCyberG7C1S01En } from './learn/learnCyberG7C1S01En'
import { learnElementLifeRu } from './learn/learnElementLifeRu'
import { learnElementLifeEn } from './learn/learnElementLifeEn'
import { learnMoleculeStructureRu } from './learn/learnMoleculeStructureRu'
import { learnMoleculeStructureEn } from './learn/learnMoleculeStructureEn'
import { learnTeacherExamRu } from './learn/learnTeacherExamRu'
import { learnTeacherExamEn } from './learn/learnTeacherExamEn'

export const learnGradePackRu = {
  ...learnGradesOutlineRu,
  ...learnAssistantRu,
  ...learnG7PilotRu,
  ...learnOutlineContentRu,
  ...learnVisualI18nRu,
  ...learnTeacherI18nRu,
  ...learnCyberG7C1S01Ru,
  ...learnElementLifeRu,
  ...learnMoleculeStructureRu,
  ...learnTeacherExamRu,
} as const

export const learnGradePackEn = {
  ...learnGradesOutlineEn,
  ...learnAssistantEn,
  ...learnG7PilotEn,
  ...learnOutlineContentEn,
  ...learnVisualI18nEn,
  ...learnTeacherI18nEn,
  ...learnCyberG7C1S01En,
  ...learnElementLifeEn,
  ...learnMoleculeStructureEn,
  ...learnTeacherExamEn,
} as const

export const learnGradePackUz = {
  ...learnGradesOutlineUz,
  ...learnAssistantUz,
  ...learnG7PilotUz,
  ...learnOutlineContentRu,
  ...learnVisualI18nRu,
} as const
