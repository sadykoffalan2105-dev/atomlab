/**
 * Установка задачи-опыта: компонент из карт TASK_RIGS_G7/G8/G9 + общий «журнал»: когда шаг с измерением выполнен,
 * публикуется labEvents 'measure' (журнал сцены, учитель, доска узнают показание прибора).
 */
import { useRef, type ComponentType } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { LabTaskId } from '../../../labContract'
import { labEvents } from '../../../labEvents'
import { getLabTask } from '../../../../../data/labTasks/labTasks'
import { fmtReading } from '../../../measure/instruments'
import { labTaskSession } from '../../../measure/labTaskSession'
import { useRig } from '../../rigCore'
import { TASK_RIGS_G7 } from './tasksG7'
import { TASK_RIGS_G8 } from './tasksG8'
import { TASK_RIGS_G9 } from './tasksG9'
import { RigScope } from './rigSweep'

export const TASK_RIGS: Partial<Record<LabTaskId, ComponentType>> = { ...TASK_RIGS_G7, ...TASK_RIGS_G8, ...TASK_RIGS_G9 }

/** Публикует показания приборов, когда прогресс проходит конец шага с измерением (только вперёд). */
function useMeasureEvents(id: LabTaskId) {
  const { p, lang } = useRig()
  const prev = useRef<number | null>(null)
  useFrame(() => {
    const v = p.current ?? 0
    const pv = prev.current
    prev.current = v
    if (pv == null || v <= pv || v - pv > 0.3) return
    const task = getLabTask(id)
    for (const m of task.measurements) {
      const at = m.afterStep + 0.98
      if (pv < at && v >= at) {
        const value = labTaskSession.get(id).values[m.key]
        if (value == null) continue
        labEvents.emit({ type: 'measure', taskId: id, key: m.key, label: m.label, value, text: `${m.label} = ${fmtReading(m.instrument, value, lang)}` })
      }
    }
  })
}

function Missing() {
  return (
    <Html center position={[0, 0.2, 0]}>
      <div style={{ padding: '8px 14px', borderRadius: 10, background: '#fff', font: '600 14px system-ui', color: '#36506e' }}>…</div>
    </Html>
  )
}

const cache = new Map<LabTaskId, ComponentType>()
/** Компонент установки для таблицы RIGS (стабильный для каждого id). */
export function taskRigFor(id: LabTaskId): ComponentType {
  let c = cache.get(id)
  if (!c) {
    const Shell = () => {
      useMeasureEvents(id)
      const Rig = TASK_RIGS[id]
      // RigScope: после ухода из задачи освобождает материалы установки (иначе их программы шейдеров копятся)
      return Rig ? (
        <RigScope>
          <Rig />
        </RigScope>
      ) : (
        <Missing />
      )
    }
    Shell.displayName = `TaskRig(${id})`
    c = Shell
    cache.set(id, c)
  }
  return c
}
