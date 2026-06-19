import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier'

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

/** Rapier-оболочка — загружается только на high tier (dynamic import). */
export function VrLabPhysicsRapierShell({ children }: { children: React.ReactNode }) {
  return (
    <Physics gravity={[0, -9.81, 0]} timeStep="vary" paused={false}>
      <BenchColliders />
      {children}
    </Physics>
  )
}
