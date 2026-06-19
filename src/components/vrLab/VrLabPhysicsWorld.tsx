import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier'
import { useVrLabPerf } from './vrLabPerformance'

function BenchColliders() {
  return (
    <>
      <RigidBody type="fixed" colliders={false} position={[0, -0.01, 0.06]}>
        <CuboidCollider args={[1.68, 0.01, 0.56]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[0.38, 0.03, 0.06]}>
        <CuboidCollider args={[0.08, 0.03, 0.08]} />
      </RigidBody>
    </>
  )
}

/** Rapier-физика стола (high tier). */
export function VrLabPhysicsWorld({ children }: { children: React.ReactNode }) {
  const { physics } = useVrLabPerf()

  if (!physics) return <>{children}</>

  return (
    <Physics gravity={[0, -9.81, 0]} timeStep="vary" paused={false}>
      <BenchColliders />
      {children}
    </Physics>
  )
}
