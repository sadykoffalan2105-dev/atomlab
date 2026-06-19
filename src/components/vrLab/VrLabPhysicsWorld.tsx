import { Suspense, lazy, type ReactNode } from 'react'
import { useVrLabPerf } from './vrLabPerformance'

const RapierShell = lazy(() =>
  import('./VrLabPhysicsRapier').then((m) => ({ default: m.VrLabPhysicsRapierShell })),
)

/** Rapier-физика стола (high tier, lazy chunk). */
export function VrLabPhysicsWorld({ children }: { children: ReactNode }) {
  const { physics } = useVrLabPerf()

  if (!physics) return <>{children}</>

  return (
    <Suspense fallback={<>{children}</>}>
      <RapierShell>{children}</RapierShell>
    </Suspense>
  )
}

/** Предзагрузка Rapier на high tier до монтирования Canvas. */
export function prefetchVrLabPhysics(): void {
  void import('./VrLabPhysicsRapier')
}
