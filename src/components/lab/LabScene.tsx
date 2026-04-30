import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, DragControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { DecorativeAtom } from './DecorativeAtom'
import { AtomStructureModel } from './AtomStructureModel'
import { MoleculeMesh } from './MoleculeMesh'
import { SynthesisOnLabScene } from './SynthesisOnLabScene'
import { SynthesisSettledProductHero } from './SynthesisSettledProductHero'
import { ReactorReagentRowPreview } from './ReactorReagentRowPreview'
import type { CompoundDef } from '../../types/chemistry'
import type { LabParticle, Vec3 } from '../../types/chemistry'
import { compoundById } from '../../data/compounds'
import { CATALOG_HERO_VIEW, LAB_ORBIT } from './labOrbitConstants'
import { CanvasErrorBoundary } from '../common/CanvasErrorBoundary'
import { isWebGLAvailable } from '../../utils/webgl'

function hexToColor(hex: string): THREE.Color {
  const h = hex.startsWith('#') ? hex : '#' + hex.replace('#', '')
  return new THREE.Color(h)
}

function DraggableParticle({
  particle: p,
  onParticleMove,
  onInspectAtom,
}: {
  particle: LabParticle
  onParticleMove: (id: string, pos: Vec3) => void
  onInspectAtom?: (z: number) => void
}) {
  const [px, py, pz] = p.position
  const mat = useMemo(() => {
    const m = new THREE.Matrix4()
    m.makeTranslation(px, py, pz)
    return m
  }, [px, py, pz])
  const lastMatrix = useRef(mat.clone())
  useEffect(() => {
    lastMatrix.current.copy(mat)
  }, [mat])

  const onDrag = useCallback((m: THREE.Matrix4) => {
    lastMatrix.current.copy(m)
  }, [])

  const onDragEnd = useCallback(() => {
    const v = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    lastMatrix.current.decompose(v, q, s)
    onParticleMove(p.id, [v.x, v.y, v.z])
  }, [onParticleMove, p.id])

  const emissiveIntensity = 0.35

  return (
    <DragControls
      dragLimits={[
        [0.6, 3.8],
        [-0.4, 1.6],
        [-1.4, 1.4],
      ]}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
    >
      <group matrix={mat} matrixAutoUpdate={false}>
        {p.type === 'atom' ? (
          <mesh
            onDoubleClick={(e) => {
              e.stopPropagation()
              onInspectAtom?.(p.z)
            }}
          >
            <sphereGeometry args={[0.24, 28, 28]} />
            <meshStandardMaterial
              color={hexToColor(p.color)}
              emissive={hexToColor(p.color)}
              emissiveIntensity={emissiveIntensity}
              metalness={0.25}
              roughness={0.35}
            />
          </mesh>
        ) : (
          <group scale={0.42}>
            {compoundById[p.compoundId] ? (
              <MoleculeMesh compound={compoundById[p.compoundId]!} scale={1} accentBoost={1.1} />
            ) : null}
          </group>
        )}
      </group>
    </DragControls>
  )
}

function SceneContent({
  particles,
  onParticleMove,
  structureZ,
  onInspectAtom,
  synthesis,
  /** true, пока runId>0 на странице лаборатории: не показывать settled-герой поверх «пустой» ветки synth */
  synthesisRunActive = false,
  reactorReagentZs,
  reactorViewOpen,
  /** После успешного синтеза — герой каталога, пока не сброшено */
  synthesisSettledProduct,
  laboratorySynthesisView,
}: {
  particles: readonly LabParticle[]
  onParticleMove: (id: string, pos: Vec3) => void
  structureZ: number | null
  onInspectAtom?: (z: number) => void
  synthesisRunActive?: boolean
  /** Ряд выбранных Z (2–4) до «Запустить синтез» */
  reactorReagentZs: number[] | null
  /** Реактор открыт: без пары в центре не показывать декоративный атом */
  reactorViewOpen: boolean
  synthesisSettledProduct: CompoundDef | null
  /** «Реактор» vs кадр с молекулой как в каталоге. */
  laboratorySynthesisView: 'reactor' | 'substance'
  synthesis: {
    runId: number
    zSlots: readonly number[]
    product: CompoundDef | null
    onDone: (kind: 'success' | 'fail') => void
    onSynthesisStageChange?: (stage: 'reactor' | 'substance') => void
  } | null
}) {
  const { camera } = useThree()
  const orbRef = useRef<OrbitControlsImpl | null>(null)
  const synthActive = synthesis != null
  const reagentRowVisible = reactorReagentZs != null && reactorReagentZs.length >= 2
  const showSettledHero =
    !synthActive &&
    !synthesisRunActive &&
    !reagentRowVisible &&
    synthesisSettledProduct != null
  /** Каталожный кадр: settled или активный успешный ран, уже с `mergeFlash` (см. SynthesisOnLabScene) */
  const catalogViewMode =
    showSettledHero || (!!synthActive && !!synthesis?.product && laboratorySynthesisView === 'substance')

  useEffect(() => {
    const branch =
      synthActive && synthesis
        ? 'synth'
        : showSettledHero && synthesisSettledProduct
          ? 'settled'
          : 'default'
    // #region agent log
    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        sessionId: 'dbdb64',
        location: 'LabScene.tsx:SceneContent',
        message: 'scene branch',
        data: {
          branch,
          synthActive,
          synthesisRunActive,
          reagentRowVisible,
          showSettledHero,
          hasSettled: synthesisSettledProduct != null,
          zSlotsLen: synthesis?.zSlots?.length,
        },
        runId: 'post-fix',
        hypothesisId: 'H_scene',
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
  }, [
    synthesis,
    synthActive,
    showSettledHero,
    synthesisSettledProduct,
    synthesisRunActive,
    reagentRowVisible,
  ])

  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => {
    if (catalogViewMode) return
    const p = camera as THREE.PerspectiveCamera
    // eslint-disable-next-line react-hooks/immutability
    p.fov = 50
    p.updateProjectionMatrix()
    camera.position.set(0, 1.1, 4.2)
    camera.lookAt(0, 0.2, 0)
    const t = orbRef.current?.target
    if (t) t.set(0, 0.15, 0)
    orbRef.current?.update?.()
  }, [camera, catalogViewMode])

  // eslint-disable-next-line react-hooks/immutability
  useLayoutEffect(() => {
    if (!catalogViewMode) return
    const p = camera as THREE.PerspectiveCamera
    // eslint-disable-next-line react-hooks/immutability
    p.fov = CATALOG_HERO_VIEW.fov
    p.updateProjectionMatrix()
    const [x, y, z] = CATALOG_HERO_VIEW.cameraPosition
    camera.position.set(x, y, z)
    const [tx, ty, tz] = CATALOG_HERO_VIEW.target
    camera.lookAt(tx, ty, tz)
    if (orbRef.current?.target) {
      orbRef.current.target.set(tx, ty, tz)
      orbRef.current.update?.()
    }
  }, [camera, catalogViewMode, showSettledHero, synthesis?.runId, synthesisSettledProduct?.id])

  return (
    <>
      {synthActive && synthesis ? (
        <SynthesisOnLabScene
          key={synthesis.runId}
          zSlots={synthesis.zSlots}
          product={synthesis.product}
          runId={synthesis.runId}
          onDone={synthesis.onDone}
          onSynthesisStageChange={synthesis.onSynthesisStageChange}
        />
      ) : showSettledHero && synthesisSettledProduct ? (
        <>
          <SynthesisSettledProductHero
            key={synthesisSettledProduct.id}
            compound={synthesisSettledProduct}
          />
          {particles
            .filter(
              (p) =>
                !(
                  p.type === 'molecule' &&
                  p.compoundId === synthesisSettledProduct.id
                ),
            )
            .map((p) => (
              <DraggableParticle
                key={p.id}
                particle={p}
                onParticleMove={onParticleMove}
                onInspectAtom={onInspectAtom}
              />
            ))}
        </>
      ) : (
        <>
          <color attach="background" args={['#03040a']} />
          <fog attach="fog" args={['#03040a', 6, 28]} />
          <Stars radius={120} depth={60} count={7000} factor={3.5} saturation={0} fade speed={0.6} />
          <ambientLight intensity={0.22} />
          <directionalLight position={[4, 6, 2]} intensity={0.55} color="#b8c8ff" />
          <group position={[0, 0, 0]}>
            {reactorReagentZs && reactorReagentZs.length >= 2 ? (
              <ReactorReagentRowPreview zs={reactorReagentZs} />
            ) : structureZ != null ? (
              <AtomStructureModel z={structureZ} />
            ) : reactorViewOpen ? null : (
              <DecorativeAtom />
            )}
          </group>
          {particles.map((p) => (
            <DraggableParticle
              key={p.id}
              particle={p}
              onParticleMove={onParticleMove}
              onInspectAtom={onInspectAtom}
            />
          ))}
        </>
      )}
      <OrbitControls
        ref={orbRef}
        makeDefault
        enablePan={false}
        enableZoom={!catalogViewMode && !synthActive && !synthesisRunActive}
        minDistance={catalogViewMode ? CATALOG_HERO_VIEW.minDistance : LAB_ORBIT.minDistance}
        maxDistance={catalogViewMode ? CATALOG_HERO_VIEW.maxDistance : LAB_ORBIT.maxDistance}
        minPolarAngle={catalogViewMode ? CATALOG_HERO_VIEW.minPolarAngle : LAB_ORBIT.minPolarAngle}
        maxPolarAngle={catalogViewMode ? CATALOG_HERO_VIEW.maxPolarAngle : LAB_ORBIT.maxPolarAngle}
        target={catalogViewMode ? CATALOG_HERO_VIEW.target : LAB_ORBIT.target}
        enableDamping={LAB_ORBIT.enableDamping}
        dampingFactor={LAB_ORBIT.dampingFactor}
      />
    </>
  )
}

export function LabCanvas({
  particles,
  onParticleMove,
  structureZ,
  onInspectAtom,
  synthesis,
  synthesisRunActive = false,
  reactorReagentZs = null,
  reactorViewOpen = false,
  synthesisSettledProduct = null,
  laboratorySynthesisView = 'reactor',
}: {
  particles: readonly LabParticle[]
  onParticleMove: (id: string, pos: Vec3) => void
  structureZ: number | null
  onInspectAtom?: (z: number) => void
  synthesisRunActive?: boolean
  reactorReagentZs?: number[] | null
  reactorViewOpen?: boolean
  synthesisSettledProduct?: CompoundDef | null
  laboratorySynthesisView?: 'reactor' | 'substance'
  synthesis: {
    runId: number
    zSlots: readonly number[]
    product: CompoundDef | null
    onDone: (kind: 'success' | 'fail') => void
    onSynthesisStageChange?: (stage: 'reactor' | 'substance') => void
  } | null
}) {
  if (!isWebGLAvailable()) {
    return (
      <div
        role="status"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          minHeight: 240,
          padding: 12,
          borderRadius: 12,
          color: 'rgba(220,228,255,0.92)',
          background: 'rgba(8,10,26,0.92)',
          border: '1px solid rgba(61,255,236,0.22)',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        WebGL недоступен — лабораторная 3D‑сцена не может быть показана. Проверьте аппаратное ускорение в
        браузере.
      </div>
    )
  }
  return (
    <CanvasErrorBoundary>
      <Canvas
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
        onCreated={(state) => {
          // #region agent log
          fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a62735' },
            body: JSON.stringify({
              sessionId: 'a62735',
              runId: 'pre-fix',
              hypothesisId: 'H_lab_canvas',
              location: 'LabScene.tsx:LabCanvas.Canvas.onCreated',
              message: 'LabCanvas created',
              data: { size: state.size, dpr: state.viewport?.dpr ?? null, isWebGL2: state.gl.capabilities.isWebGL2 },
              timestamp: Date.now(),
            }),
          }).catch(() => {})
          // #endregion
        }}
      >
        <SceneContent
          particles={particles}
          onParticleMove={onParticleMove}
          structureZ={structureZ}
          onInspectAtom={onInspectAtom}
          synthesis={synthesis}
          synthesisRunActive={synthesisRunActive}
          reactorReagentZs={reactorReagentZs}
          reactorViewOpen={reactorViewOpen}
          synthesisSettledProduct={synthesisSettledProduct}
          laboratorySynthesisView={laboratorySynthesisView}
        />
      </Canvas>
    </CanvasErrorBoundary>
  )
}
