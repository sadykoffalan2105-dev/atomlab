/** Подключение панели показа в лаборатории: грузится, только когда показ идёт. */
import { lazy, Suspense } from 'react'
import { useRouteLab } from './routeLabStore'

const RouteLabPanel = lazy(() => import('./RouteLabPanel'))

export function RouteLabHost() {
  const s = useRouteLab()
  if (!s.id) return null
  return (
    <Suspense fallback={null}>
      <RouteLabPanel />
    </Suspense>
  )
}
