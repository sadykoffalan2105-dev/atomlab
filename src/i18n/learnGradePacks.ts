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

export const learnGradePackRu = {
  ...learnGradesOutlineRu,
  ...learnAssistantRu,
  ...learnG7PilotRu,
  ...learnOutlineContentRu,
  ...learnVisualI18nRu,
  ...learnTeacherI18nRu,
  ...learnCyberG7C1S01Ru,
} as const

export const learnGradePackEn = {
  ...learnGradesOutlineEn,
  ...learnAssistantEn,
  ...learnG7PilotEn,
  ...learnOutlineContentEn,
  ...learnVisualI18nEn,
  ...learnTeacherI18nEn,
  ...learnCyberG7C1S01En,
} as const

export const learnGradePackUz = {
  ...learnGradesOutlineUz,
  ...learnAssistantUz,
  ...learnG7PilotUz,
  ...learnOutlineContentRu,
  ...learnVisualI18nRu,
} as const
