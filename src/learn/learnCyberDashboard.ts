import type { MessageKey } from '../i18n/messagesRu'

export type CyberGridArea = 'task5' | 'task1' | 'task2' | 'task3' | 'task4' | 'task6'

export type CyberTaskDef = {
  id: string
  order: number
  gridArea: CyberGridArea
  titleKey: MessageKey
  bodyKey: MessageKey
  accent: string
}

export type CyberReferenceDef = {
  src: string
  src2x: string
  aspect: number
  /** Отступы сетки кликов (%), под макет референса */
  gridInset: { top: number; right: number; bottom: number; left: number }
}

export type CyberDashboardDef = {
  sceneId: string
  tasks: CyberTaskDef[]
  /** composite = референс 1:1 + прозрачные кнопки; native = CSS-мини-сцены */
  visualMode: 'composite' | 'native'
  reference?: CyberReferenceDef
}

const PILOT_SCENES = new Set(['topic_g7_c1_s01'])

const G7_C1_S01_TASKS: CyberTaskDef[] = [
  {
    id: 'task5',
    order: 5,
    gridArea: 'task5',
    titleKey: 'learn.g7.c1.s01.cyber.task5.title',
    bodyKey: 'learn.g7.c1.s01.cyber.task5.body',
    accent: '#c77dff',
  },
  {
    id: 'task1',
    order: 1,
    gridArea: 'task1',
    titleKey: 'learn.g7.c1.s01.cyber.task1.title',
    bodyKey: 'learn.g7.c1.s01.cyber.task1.body',
    accent: '#3dffec',
  },
  {
    id: 'task2',
    order: 2,
    gridArea: 'task2',
    titleKey: 'learn.g7.c1.s01.cyber.task2.title',
    bodyKey: 'learn.g7.c1.s01.cyber.task2.body',
    accent: '#ffb347',
  },
  {
    id: 'task3',
    order: 3,
    gridArea: 'task3',
    titleKey: 'learn.g7.c1.s01.cyber.task3.title',
    bodyKey: 'learn.g7.c1.s01.cyber.task3.body',
    accent: '#7eb6ff',
  },
  {
    id: 'task4',
    order: 4,
    gridArea: 'task4',
    titleKey: 'learn.g7.c1.s01.cyber.task4.title',
    bodyKey: 'learn.g7.c1.s01.cyber.task4.body',
    accent: '#5cff8a',
  },
  {
    id: 'task6',
    order: 6,
    gridArea: 'task6',
    titleKey: 'learn.g7.c1.s01.cyber.task6.title',
    bodyKey: 'learn.g7.c1.s01.cyber.task6.body',
    accent: '#ffe566',
  },
]

const G7_C1_S01_REFERENCE: CyberReferenceDef = {
  src: '/learn/dashboard/topic_g7_c1_s01.webp',
  src2x: '/learn/dashboard/topic_g7_c1_s01@2x.webp',
  aspect: 1024 / 584,
  gridInset: { top: 12.5, right: 2.35, bottom: 3.5, left: 2.35 },
}

const REGISTRY = new Map<string, CyberDashboardDef>([
  [
    'topic_g7_c1_s01',
    {
      sceneId: 'topic_g7_c1_s01',
      tasks: G7_C1_S01_TASKS,
      visualMode: 'native',
      reference: G7_C1_S01_REFERENCE,
    },
  ],
])

export function hasCyberDashboard(sceneId: string): boolean {
  return PILOT_SCENES.has(sceneId) && REGISTRY.has(sceneId)
}

export function getCyberDashboard(sceneId: string): CyberDashboardDef | null {
  return REGISTRY.get(sceneId) ?? null
}
