import type { MessageKey } from '../i18n/messagesRu'

export type CyberGameId =
  | 'structure-quiz'
  | 'cosmic-synthesis'
  | 'tech-match'
  | 'eco-pipeline'
  | 'pure-mix-sort'
  | 'formula-build'

export type CyberGameDef = {
  id: CyberGameId
  taskId: string
  titleKey: MessageKey
  introKey: MessageKey
  winKey: MessageKey
}

export const CYBER_GAMES: CyberGameDef[] = [
  {
    id: 'structure-quiz',
    taskId: 'task1',
    titleKey: 'learn.g7.c1.s01.game.task1.title',
    introKey: 'learn.g7.c1.s01.game.task1.intro',
    winKey: 'learn.g7.c1.s01.game.task1.win',
  },
  {
    id: 'cosmic-synthesis',
    taskId: 'task2',
    titleKey: 'learn.g7.c1.s01.game.task2.title',
    introKey: 'learn.g7.c1.s01.game.task2.intro',
    winKey: 'learn.g7.c1.s01.game.task2.win',
  },
  {
    id: 'tech-match',
    taskId: 'task3',
    titleKey: 'learn.g7.c1.s01.game.task3.title',
    introKey: 'learn.g7.c1.s01.game.task3.intro',
    winKey: 'learn.g7.c1.s01.game.task3.win',
  },
  {
    id: 'eco-pipeline',
    taskId: 'task4',
    titleKey: 'learn.g7.c1.s01.game.task4.title',
    introKey: 'learn.g7.c1.s01.game.task4.intro',
    winKey: 'learn.g7.c1.s01.game.task4.win',
  },
  {
    id: 'pure-mix-sort',
    taskId: 'task5',
    titleKey: 'learn.g7.c1.s01.game.task5.title',
    introKey: 'learn.g7.c1.s01.game.task5.intro',
    winKey: 'learn.g7.c1.s01.game.task5.win',
  },
  {
    id: 'formula-build',
    taskId: 'task6',
    titleKey: 'learn.g7.c1.s01.game.task6.title',
    introKey: 'learn.g7.c1.s01.game.task6.intro',
    winKey: 'learn.g7.c1.s01.game.task6.win',
  },
]

export function getCyberGameForTask(taskId: string): CyberGameDef | null {
  return CYBER_GAMES.find((g) => g.taskId === taskId) ?? null
}
