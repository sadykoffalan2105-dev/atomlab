/**
 * Шаг «Наденьте средства защиты» (цель 'ppe'): опыт публикует labEvents 'needGear' (сцена подсвечивает очки,
 * перчатки, халат) и ждёт 'safety' по каждому; если всё уже надето — шаг засчитывается сразу. Нажатие на поднос
 * в установке — тоже «надеть»: на середине анимации опыт сам публикует 'safety' (сцена узнаёт, что надето).
 */
import { useEffect } from 'react'
import type { LabExperimentId } from '../../labContract'
import { labEvents } from '../../labEvents'
import { getLabExperiment } from '../../../../data/labWorks/labExperiments'
import { useCrossing, useRig } from '../rigCore'

export function useGearStep(id: LabExperimentId, gearStep: number) {
  const { act, activeTarget } = useRig()
  const gear = getLabExperiment(id).gear ?? []
  const waiting = activeTarget === 'ppe'
  useEffect(() => {
    if (!waiting) return
    labEvents.emit({ type: 'needGear', gear })
    const check = () => {
      const worn = labEvents.wornGear()
      if (gear.every((g) => worn.includes(g))) act('ppe')
    }
    // уже надето (сцена смонтирована раньше) — засчитать с небольшой паузой, чтобы ученик увидел шаг
    const timer = window.setTimeout(check, 700)
    const off = labEvents.on('safety', check)
    return () => {
      window.clearTimeout(timer)
      off()
      labEvents.emit({ type: 'needGear', gear: [] })
    }
  }, [waiting, act, gear])
  useCrossing(gearStep + 0.5, () => {
    const worn = labEvents.wornGear()
    for (const g of gear) if (!worn.includes(g)) labEvents.emit({ type: 'safety', gear: g, on: true })
  })
}
