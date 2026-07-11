import { learnAssistantEn, learnAssistantRu, learnAssistantUz } from './learn/assistantI18n'
import { learnGradesOutlineEn } from './learn/gradesOutlineEn'
import { learnGradesOutlineRu } from './learn/gradesOutlineRu'
import { learnGradesOutlineUz } from './learn/gradesOutlineUz'
import { learnG7PilotEn } from './learn/g7PilotEn'
import { learnG7PilotRu } from './learn/g7PilotRu'
import { learnG7PilotUz } from './learn/g7PilotUz'
import { learnOutlineContentEn } from './learn/learnOutlineContentEn'
import { learnOutlineContentRu } from './learn/learnOutlineContentRu'
import { learnOutlineContentUz } from './learn/learnOutlineContentUz'
import { learnVisualI18nEn } from './learn/learnVisualI18nEn'
import { learnVisualI18nRu } from './learn/learnVisualI18nRu'
import { learnVisualI18nUz } from './learn/learnVisualI18nUz'
import { learnTeacherI18nEn, learnTeacherI18nRu, learnTeacherI18nUz } from './learn/learnTeacherI18n'
import { learnCyberG7C1S01Ru } from './learn/learnCyberG7C1S01Ru'
import { learnCyberG7C1S01En } from './learn/learnCyberG7C1S01En'
import { learnCyberG7C1S01Uz } from './learn/learnCyberG7C1S01Uz'
import { learnElementLifeRu } from './learn/learnElementLifeRu'
import { learnElementLifeEn } from './learn/learnElementLifeEn'
import { learnElementLifeUz } from './learn/learnElementLifeUz'
import { learnMoleculeStructureRu } from './learn/learnMoleculeStructureRu'
import { learnMoleculeStructureEn } from './learn/learnMoleculeStructureEn'
import { learnMoleculeStructureUz } from './learn/learnMoleculeStructureUz'
import { learnTeacherExamRu } from './learn/learnTeacherExamRu'
import { learnTeacherExamEn } from './learn/learnTeacherExamEn'
import { learnSkillsRu } from './learn/learnSkillsRu'
import { learnSkillsEn } from './learn/learnSkillsEn'
import { learnProblemsRu } from './learn/learnProblemsRu'
import { learnProblemsEn } from './learn/learnProblemsEn'
import { learnSkillsUz } from './learn/learnSkillsUz'
import { learnProblemsUz } from './learn/learnProblemsUz'
import { learnTeacherExamUz } from './learn/learnTeacherExamUz'
import {
  learnResearchI18nEn,
  learnResearchI18nRu,
  learnResearchI18nUz,
} from './learn/learnResearchI18n'

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
  ...learnSkillsRu,
  ...learnProblemsRu,
  ...learnResearchI18nRu,
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
  ...learnSkillsEn,
  ...learnProblemsEn,
  ...learnResearchI18nEn,
} as const

export const learnGradePackUz = {
  ...learnGradesOutlineUz,
  ...learnAssistantUz,
  ...learnG7PilotUz,
  ...learnOutlineContentUz,
  ...learnVisualI18nUz,
  ...learnTeacherI18nUz,
  ...learnCyberG7C1S01Uz,
  ...learnElementLifeUz,
  ...learnMoleculeStructureUz,
  ...learnTeacherExamUz,
  ...learnSkillsUz,
  ...learnProblemsUz,
  ...learnResearchI18nUz,
} as const
