import { Suspense, useMemo, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { MoleculeMesh } from '../../lab/MoleculeMesh'
import { CatalogCanvasResizeSync } from '../../lab/CatalogCanvasResizeSync'
import { CanvasErrorBoundary } from '../../common/CanvasErrorBoundary'
import { CanvasSceneErrorFallback } from '../../common/CanvasSceneErrorFallback'
import { organicGraphToCompoundDef } from '../../../chemistry/organic/organicToCompound'
import { freeValence, type OrganicGraph } from '../../../chemistry/organic/organicGraph'
import { isWebGLAvailable } from '../../../utils/webgl'
import { useT } from '../../../i18n/useT'
import styles from './OrganicBuilderCanvas.module.css'

type Props = {
  graph: OrganicGraph
  selectedId: string | null
  bondFromId: string | null
  onSelectAtom: (id: string | null) => void
  children?: ReactNode
}

const EL_COLOR: Record<string, string> = {
  C: '#94a3b8',
  H: '#f1f5f9',
  O: '#f87171',
  N: '#60a5fa',
}

function ValenceHalo({
  graph,
  scale,
  selectedId,
  bondFromId,
}: {
  graph: OrganicGraph
  scale: number
  selectedId: string | null
  bondFromId: string | null
}) {
  return (
    <group>
      {graph.atoms.map((a) => {
        const free = freeValence(graph, a.id)
        const selected = selectedId === a.id
        const from = bondFromId === a.id
        if (!selected && !from && free <= 0) return null
        const color = from ? '#fbbf24' : selected ? '#34d399' : (EL_COLOR[a.element] ?? '#7dd3fc')
        return (
          <mesh
            key={`halo-${a.id}`}
            position={[a.pos[0] * scale, a.pos[1] * scale, a.pos[2] * scale]}
          >
            <sphereGeometry args={[(a.element === 'H' ? 0.28 : 0.4) * scale, 16, 16]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={from || selected ? 0.32 : 0.12}
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function PickSpheres({
  graph,
  scale,
  selectedId,
  onSelectAtom,
}: {
  graph: OrganicGraph
  scale: number
  selectedId: string | null
  onSelectAtom: (id: string | null) => void
}) {
  return (
    <group>
      {graph.atoms.map((a) => (
        <mesh
          key={`pick-${a.id}`}
          position={[a.pos[0] * scale, a.pos[1] * scale, a.pos[2] * scale]}
          onClick={(e) => {
            e.stopPropagation()
            onSelectAtom(a.id === selectedId ? null : a.id)
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'default'
          }}
        >
          <sphereGeometry args={[(a.element === 'H' ? 0.38 : 0.48) * scale, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

function GridFloor() {
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(20, 20, '#1e3a5f', '#122033')
    g.position.y = -2.35
    const mats = Array.isArray(g.material) ? g.material : [g.material]
    for (const m of mats) {
      m.transparent = true
      m.opacity = 0.55
    }
    return g
  }, [])

  const axes = useMemo(() => {
    const g = new THREE.AxesHelper(3.2)
    g.position.set(0, -2.3, 0)
    return g
  }, [])

  return (
    <>
      <primitive object={grid} />
      <primitive object={axes} />
    </>
  )
}

function BuilderScene({
  graph,
  selectedId,
  bondFromId,
  onSelectAtom,
}: {
  graph: OrganicGraph
  selectedId: string | null
  bondFromId: string | null
  onSelectAtom: (id: string | null) => void
}) {
  const compound = useMemo(() => organicGraphToCompoundDef(graph), [graph])
  const n = graph.atoms.length
  const scale = n <= 5 ? 1.2 : n <= 10 ? 0.95 : n <= 15 ? 0.78 : 0.65

  return (
    <>
      <CatalogCanvasResizeSync touchDpr={false} />
      <color attach="background" args={['#070b14']} />
      <fog attach="fog" args={['#070b14', 10, 22]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 3]} intensity={1} color="#e8eeff" />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} color="#34d399" />
      <pointLight position={[0, 2, 4]} intensity={0.35} color="#67e8f9" distance={14} />
      <GridFloor />
      <group>
        <MoleculeMesh
          compound={compound}
          scale={scale}
          renderQuality="high"
          visualPreset="default"
          showLabels
        />
        <ValenceHalo graph={graph} scale={scale} selectedId={selectedId} bondFromId={bondFromId} />
        <PickSpheres
          graph={graph}
          scale={scale}
          selectedId={selectedId}
          onSelectAtom={onSelectAtom}
        />
      </group>
      <OrbitControls
        makeDefault
        enablePan
        enableDamping
        dampingFactor={0.07}
        minDistance={2.5}
        maxDistance={16}
        target={[0, 0, 0]}
      />
    </>
  )
}

export function OrganicBuilderCanvas({
  graph,
  selectedId,
  bondFromId,
  onSelectAtom,
  children,
}: Props) {
  const { t } = useT()
  const webglOk = isWebGLAvailable()

  if (!webglOk) {
    return (
      <div className={styles.stage}>
        <div className={styles.fallback}>{t('catalog.webglUnavailable')}</div>
      </div>
    )
  }

  return (
    <div className={styles.stage}>
      <div className={styles.canvasHost}>
        <CanvasErrorBoundary resetKey="organic-builder-scene" fallback={<CanvasSceneErrorFallback />}>
          <Canvas
            className={styles.canvas}
            camera={{ position: [0, 2.2, 8.5], fov: 40 }}
            gl={{
              antialias: true,
              alpha: false,
              powerPreference: 'high-performance',
              stencil: false,
            }}
            dpr={[1, 1.6]}
            frameloop="always"
            onPointerMissed={() => onSelectAtom(null)}
          >
            <Suspense fallback={null}>
              {graph.atoms.length > 0 ? (
                <BuilderScene
                  graph={graph}
                  selectedId={selectedId}
                  bondFromId={bondFromId}
                  onSelectAtom={onSelectAtom}
                />
              ) : (
                <>
                  <color attach="background" args={['#070b14']} />
                  <ambientLight intensity={0.4} />
                </>
              )}
            </Suspense>
          </Canvas>
        </CanvasErrorBoundary>
      </div>
      {children}
    </div>
  )
}
