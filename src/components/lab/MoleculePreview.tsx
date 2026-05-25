import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { MoleculeMesh } from './MoleculeMesh'
import { compoundById } from '../../data/compounds'
import { CATALOG_HERO_VIEW } from './labOrbitConstants'

export function MoleculePreview({ compoundId }: { compoundId: string }) {
  const c = compoundById[compoundId]
  if (!c) return null
  return (
    <Canvas
      camera={{ position: [0, 0.4, CATALOG_HERO_VIEW.cameraPosition[2]], fov: CATALOG_HERO_VIEW.fov }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#0a0c18']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 2]} intensity={0.7} />
      <group position={[0, -0.15, 0]}>
        <MoleculeMesh compound={c} scale={0.85} accentBoost={1.2} />
      </group>
      <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={1.2} />
    </Canvas>
  )
}
