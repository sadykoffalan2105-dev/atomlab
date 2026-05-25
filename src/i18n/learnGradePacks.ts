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

export const learnGradePackRu = {
  ...learnGradesOutlineRu,
  ...learnAssistantRu,
  ...learnG7PilotRu,
  ...learnOutlineContentRu,
  ...learnVisualI18nRu,
} as const

export const learnGradePackEn = {
  ...learnGradesOutlineEn,
  ...learnAssistantEn,
  ...learnG7PilotEn,
  ...learnOutlineContentEn,
  ...learnVisualI18nEn,
} as const

export const learnGradePackUz = {
  ...learnGradesOutlineUz,
  ...learnAssistantUz,
  ...learnG7PilotUz,
  ...learnOutlineContentRu,
  ...learnVisualI18nRu,
} as const
