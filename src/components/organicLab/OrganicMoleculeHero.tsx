import { Suspense, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, OrbitControls, Sparkles } from '@react-three/drei'
import { useRef } from 'react'
import * as THREE from 'three'
import {
  CatalogStyleBloom,
  CosmicStarfield,
  SubstanceAuraBubble,
} from '../lab/CatalogMoleculeHero'
import { CanvasErrorBoundary } from '../common/CanvasErrorBoundary'
import { CanvasSceneErrorFallback } from '../common/CanvasSceneErrorFallback'
import { CATALOG_HERO_VIEW } from '../lab/labOrbitConstants'
import { organicGraphToCompoundDef } from '../../chemistry/organic/organicToCompound'
import type { OrganicMoleculeDef } from '../../data/organicLab/organicMoleculeTypes'
import { useT } from '../../i18n/useT'
import { isWebGLAvailable } from '../../utils/webgl'
import { MoleculeMesh } from '../lab/MoleculeMesh'
import {
  catalogMoleculeFitScale,
  moleculeCenterOffset,
  CATALOG_HERO_DEFAULT_LAB_SCALE,
} from '../lab/catalogMoleculeHeroShared'
import type { CompoundDef } from '../../types/chemistry'

function OrganicHeroRig({ compound }: { compound: CompoundDef }) {
  const ref = useRef<THREE.Group>(null)
  const fit = useMemo(() => catalogMoleculeFitScale(compound.atoms), [compound.atoms])
  const center = useMemo(() => moleculeCenterOffset(compound.atoms), [compound.atoms])
  const baseScale = 0.78 * CATALOG_HERO_DEFAULT_LAB_SCALE

  useFrame((s) => {
    const g = ref.current
    if (!g) return
    const t = s.clock.elapsedTime
    g.rotation.y = t * 0.014
    g.rotation.x = Math.sin(t * 0.28) * 0.036
    g.position.y = Math.sin(t * 0.45) * 0.04
  })

  return (
    <group ref={ref}>
      <group position={center}>
        <MoleculeMesh
          compound={compound}
          scale={baseScale * fit}
          accentBoost={1.35}
          visualPreset="organicHero"
          renderQuality="high"
          showLabels
        />
      </group>
    </group>
  )
}

function OrganicHeroScene({ mol, compound }: { mol: OrganicMoleculeDef; compound: CompoundDef }) {
  return (
    <>
      <Suspense fallback={null}>
        <Environment preset="city" environmentIntensity={0.38} />
      </Suspense>
      <ambientLight intensity={0.48} />
      <directionalLight position={[3.2, 5.5, 3.5]} intensity={0.9} color="#e8eeff" />
      <directionalLight position={[-3.5, 1.5, -2]} intensity={0.4} color={mol.accentColor} />
      <pointLight position={[0.2, 0.9, 2.2]} intensity={0.7} color="#67e8f9" distance={8} />
      <CosmicStarfield compoundId={mol.id} accentColor={mol.accentColor} category="other" />
      <SubstanceAuraBubble accentColor={mol.accentColor} compoundId={mol.id} />
      <Sparkles count={72} scale={5.2} size={1.7} speed={0.34} opacity={0.5} color={mol.accentColor} />
      <OrganicHeroRig compound={compound} />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI * 0.38}
        maxPolarAngle={Math.PI * 0.62}
      />
      <CatalogStyleBloom />
    </>
  )
}

/** Красивый 3D-герой органической молекулы (CPK по атомам). */
export function OrganicMoleculeHero({ mol }: { mol: OrganicMoleculeDef }) {
  const { t } = useT()
  const compound = useMemo(
    () => organicGraphToCompoundDef(mol.graph, mol.id, mol.accentColor),
    [mol],
  )
  const webglOk = isWebGLAvailable()

  if (!webglOk) {
    return (
      <div
        role="status"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: 12,
          borderRadius: 12,
          color: 'rgba(220,228,255,0.92)',
          background: 'rgba(8,10,26,0.92)',
          border: '1px solid rgba(52,211,153,0.25)',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        {t('catalog.webglUnavailable')}
      </div>
    )
  }

  return (
    <CanvasErrorBoundary fallback={<CanvasSceneErrorFallback />} resetKey={mol.id}>
      <Canvas
        camera={{ position: CATALOG_HERO_VIEW.cameraPosition, fov: CATALOG_HERO_VIEW.fov }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 1.65]}
        frameloop="always"
      >
        <color attach="background" args={['#070b14']} />
        <fog attach="fog" args={['#070b14', 6.5, 16]} />
        <Suspense fallback={null}>
          <OrganicHeroScene mol={mol} compound={compound} />
        </Suspense>
      </Canvas>
    </CanvasErrorBoundary>
  )
}
