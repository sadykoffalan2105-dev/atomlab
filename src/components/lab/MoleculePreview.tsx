import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { MoleculeMesh } from './MoleculeMesh'
import { compoundById } from '../../data/compounds'
import { useEffect, useRef } from 'react'
import { CATALOG_HERO_VIEW } from './labOrbitConstants'

export function MoleculePreview({ compoundId }: { compoundId: string }) {
  const c = compoundById[compoundId]
  // #region agent log
  const loggedRef = useRef<string | null>(null)
  useEffect(() => {
    if (loggedRef.current === compoundId) return
    loggedRef.current = compoundId
    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c09a52' },
      body: JSON.stringify({
        sessionId: 'c09a52',
        runId: 'pre-fix',
        hypothesisId: 'H_preview',
        location: 'MoleculePreview.tsx:MoleculePreview',
        message: 'render MoleculePreview',
        data: { compoundId, found: !!c, atomsLen: c?.atoms.length ?? null, bondsLen: c?.bonds.length ?? null },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
  }, [compoundId, c])
  // #endregion
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
