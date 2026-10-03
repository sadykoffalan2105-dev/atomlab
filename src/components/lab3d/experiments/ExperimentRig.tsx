/**
 * Установка опыта на рабочем месте стола (локальные координаты: начало — WORK_AREA_CENTER, верх столешницы — y = 0;
 * ничего не выходит за WORK_AREA_SIZE). Цель текущего шага подсвечена; нажатие мышью или пальцем
 * проигрывает действие шага и вызывает onAdvance().
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ExperimentRigProps, LabExperimentId } from '../labContract'
import { getLabExperiment } from '../../../data/labWorks/labExperiments'
import { RigContext, type RigContextValue } from './rigCore'
import { RIG_STEP_SECONDS } from './rigTargets'
import { Baso4Rig } from './rigs/Baso4Rig'
import { Ch4BurnRig } from './rigs/Ch4BurnRig'
import { H2PracticalRig } from './rigs/H2PracticalRig'
import { ZnHclRig } from './rigs/ZnHclRig'

const RIGS: Record<LabExperimentId, ComponentType> = {
  baso4: Baso4Rig,
  'ch4-burn': Ch4BurnRig,
  'zn-hcl': ZnHclRig,
  'h2-practical': H2PracticalRig,
}

export function ExperimentRig(props: ExperimentRigProps) {
  // новый опыт — новая установка (прогресс и анимации с нуля)
  return <RigRunner key={props.experimentId} {...props} />
}

function RigRunner({ experimentId, step, onAdvance, quality, lang }: ExperimentRigProps) {
  const def = getLabExperiment(experimentId)
  const total = def.steps.length
  const p = useRef(Math.min(step, total))
  const time = useRef(0)
  const anim = useRef<{ from: number; dur: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const stepRef = useRef(step)
  const advanceRef = useRef(onAdvance)
  useLayoutEffect(() => {
    stepRef.current = step
    advanceRef.current = onAdvance
  })

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    time.current += dt
    const a = anim.current
    if (a) {
      if (stepRef.current !== a.from) {
        // шаг сменили на доске во время действия — действие отменяется, прогресс плавно догоняет шаг
        anim.current = null
        setBusy(false)
      } else {
        p.current = Math.min(a.from + 1, p.current + dt / a.dur)
        if (p.current >= a.from + 1 - 1e-6) {
          anim.current = null
          setBusy(false)
          advanceRef.current()
        }
        return
      }
    }
    const target = Math.min(stepRef.current, total)
    const d = target - p.current
    if (Math.abs(d) < 1e-4) p.current = target
    else p.current += d * (1 - Math.exp(-dt * (Math.abs(d) > 1.5 ? 4 : 2.2)))
  })

  const act = useCallback(
    (name: string) => {
      const s = stepRef.current
      if (anim.current || s >= total) return
      if (def.steps[s]?.target !== name) return
      p.current = s
      anim.current = { from: s, dur: RIG_STEP_SECONDS[experimentId][s] ?? 2 }
      setBusy(true)
    },
    [def, experimentId, total],
  )

  const activeTarget = !busy && step < total ? (def.steps[step]?.target ?? null) : null
  const ctx = useMemo<RigContextValue>(() => ({ p, time, quality, lang, activeTarget, act }), [quality, lang, activeTarget, act])
  const Rig = RIGS[experimentId]
  return (
    <RigContext.Provider value={ctx}>
      <group name={`lab3d-rig:${experimentId}`}>
        <Rig />
      </group>
    </RigContext.Provider>
  )
}
