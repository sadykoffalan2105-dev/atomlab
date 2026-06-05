import type { MessageKey } from '../i18n/messagesRu'

export type CyberHotspotDef = {
  id: string
  labelKey: MessageKey
  detailKey: MessageKey
}

const TASK1: CyberHotspotDef[] = [
  {
    id: 'molecule',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task1.molecule.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task1.molecule.detail',
  },
  {
    id: 'lattice',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task1.lattice.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task1.lattice.detail',
  },
  {
    id: 'graph',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task1.graph.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task1.graph.detail',
  },
]

const TASK2: CyberHotspotDef[] = [
  {
    id: 'chamber',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task2.chamber.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task2.chamber.detail',
  },
  {
    id: 'robot',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task2.robot.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task2.robot.detail',
  },
  {
    id: 'flasks',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task2.flasks.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task2.flasks.detail',
  },
]

const TASK3: CyberHotspotDef[] = [
  {
    id: 'energy',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task3.energy.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task3.energy.detail',
  },
  {
    id: 'nano',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task3.nano.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task3.nano.detail',
  },
  {
    id: 'factory',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task3.factory.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task3.factory.detail',
  },
  {
    id: 'recycle',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task3.recycle.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task3.recycle.detail',
  },
]

const TASK4: CyberHotspotDef[] = [
  {
    id: 'filter',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task4.filter.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task4.filter.detail',
  },
  {
    id: 'pipes',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task4.pipes.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task4.pipes.detail',
  },
]

const TASK5: CyberHotspotDef[] = [
  {
    id: 'pure',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task5.pure.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task5.pure.detail',
  },
  {
    id: 'mixtures',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task5.mixtures.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task5.mixtures.detail',
  },
  {
    id: 'separation',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task5.separation.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task5.separation.detail',
  },
]

const TASK6: CyberHotspotDef[] = [
  {
    id: 'periodic',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task6.periodic.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task6.periodic.detail',
  },
  {
    id: 'formulas',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task6.formulas.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task6.formulas.detail',
  },
  {
    id: 'ch4',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task6.ch4.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task6.ch4.detail',
  },
  {
    id: 'scale',
    labelKey: 'learn.g7.c1.s01.cyber.hs.task6.scale.label',
    detailKey: 'learn.g7.c1.s01.cyber.hs.task6.scale.detail',
  },
]

export const CYBER_HOTSPOTS_BY_TASK: Record<string, CyberHotspotDef[]> = {
  task1: TASK1,
  task2: TASK2,
  task3: TASK3,
  task4: TASK4,
  task5: TASK5,
  task6: TASK6,
}

export function getCyberHotspot(taskId: string, hotspotId: string): CyberHotspotDef | null {
  return CYBER_HOTSPOTS_BY_TASK[taskId]?.find((h) => h.id === hotspotId) ?? null
}

export function getCyberHotspots(taskId: string): CyberHotspotDef[] {
  return CYBER_HOTSPOTS_BY_TASK[taskId] ?? []
}
