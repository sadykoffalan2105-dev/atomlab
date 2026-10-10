/** Подключение панели этапов и HUD-карточек показа «Как образуется» v2 в лаборатории: грузится, только когда показ идёт. */
import { lazy, Suspense } from 'react'
import { useFormationLab } from './formationLabStore'

const FormationLabPanel = lazy(() => import('./FormationLabPanel'))

export function FormationLabHost() {
  const s = useFormationLab()
  if (!s.id) return null
  return (
    <Suspense fallback={null}>
      <FormationLabPanel />
    </Suspense>
  )
}
