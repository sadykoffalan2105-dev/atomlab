import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, DragControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { DecorativeAtom } from './DecorativeAtom'
import { AtomStructureModel } from './AtomStructureModel'
import { MoleculeMesh } from './MoleculeMesh'
import { SynthesisOnLabScene } from './SynthesisOnLabScene'
import { SynthesisSettledProductHero } from './SynthesisSettledProductHero'
import { CatalogSubstanceDisplay } from './CatalogSubstanceDisplay'
import { CatalogCanvasResizeSync } from './CatalogCanvasResizeSync'
import { ReactorTermsPreview } from './ReactorTermsPreview'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import type { CompoundDef } from '../../types/chemistry'
import type { LabParticle, Vec3 } from '../../types/chemistry'
import { compoundById } from '../../data/compounds'
import { CATALOG_HERO_VIEW, LAB_ORBIT } from './labOrbitConstants'
import { CanvasErrorBoundary } from '../common/CanvasErrorBoundary'
import { CanvasSceneErrorFallback } from '../common/CanvasSceneErrorFallback'
import { useT } from '../../i18n/useT'
import { isWebGLAvailable } from '../../utils/webgl'

/** Совпадает с `<color attach="background" args={['#03040a']} />` в обычной ветке сцены */
const LAB_SCENE_CLEAR_HEX = '#03040a'

type PerfLevel = 'high' | 'low'

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

  const atomCpkHex = p.type === 'atom' ? p.color : undefined
  const atomColor = useMemo(
    () => (atomCpkHex ? hexToColor(atomCpkHex) : null),
    [atomCpkHex],
  )

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
            <sphereGeometry args={[0.24, 20, 20]} />
            <meshStandardMaterial
              color={atomColor!}
              emissive={atomColor!}
              emissiveIntensity={0.35}
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

const TRANSFORM_PREVIEW_BG = {
  c: '#0a0c18' as const,
  f: ['#0a0c18', 6.5, 16] as [string, number, number],
}

function TransformPreviewHero({ compound }: { compound: CompoundDef }) {
  return (
    <>
      <color attach="background" args={[TRANSFORM_PREVIEW_BG.c]} />
      <fog attach="fog" args={TRANSFORM_PREVIEW_BG.f} />
      <CatalogSubstanceDisplay
        compound={compound}
        reducedEffects
        labSynthesisScene
        renderQuality="synthesis"
        fxLevel="low"
      />
    </>
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
  onPerfLevelChange,
  reactorPreviewTerms = null,
  reactorViewOpen,
  transformPreviewCompound = null,
  synthesisSettledProduct,
  laboratorySynthesisView,
}: {
  particles: readonly LabParticle[]
  onParticleMove: (id: string, pos: Vec3) => void
  structureZ: number | null
  onInspectAtom?: (z: number) => void
  synthesisRunActive?: boolean
  onPerfLevelChange?: (level: PerfLevel) => void
  /** Слагаемые левой части для превью атомных структур */
  reactorPreviewTerms?: readonly ReactorEquationTerm[] | null
  /** Выбранное вещество до запуска — каталожная 3D-модель в центре */
  transformPreviewCompound?: CompoundDef | null
  /** Реактор открыт: без пары в центре не показывать декоративный атом */
  reactorViewOpen: boolean
  synthesisSettledProduct: CompoundDef | null
  /** «Реактор» vs кадр с молекулой как в каталоге. */
  laboratorySynthesisView: 'reactor' | 'substance'
  synthesis: {
    runId: number
    zSlots: readonly number[]
    flyTerms: readonly ReactorEquationTerm[]
    product: CompoundDef | null
    onDone: (kind: 'success' | 'fail') => void
    onSynthesisStageChange?: (stage: 'reactor' | 'substance') => void
  } | null
}) {
  const { camera } = useThree()
  const orbRef = useRef<OrbitControlsImpl | null>(null)
  const perfLevelRef = useRef<PerfLevel>('high')
  const perfAcc = useRef({ t: 0, lowT: 0, highT: 0, fps: 60 })
  const synthActive = synthesis != null
  const termsPreviewVisible =
    reactorPreviewTerms != null &&
    reactorPreviewTerms.length >= 1 &&
    !synthesisRunActive &&
    !synthActive
  const previewActive =
    transformPreviewCompound != null &&
    reactorViewOpen &&
    !synthActive &&
    !synthesisRunActive &&
    !termsPreviewVisible
  const showSettledHero =
    !synthActive &&
    !synthesisRunActive &&
    !previewActive &&
    !termsPreviewVisible &&
    synthesisSettledProduct != null
  /** Каталожный кадр: превью продукта, settled или активный успешный ран в режиме substance */
  const catalogViewMode =
    previewActive ||
    showSettledHero ||
    (!!synthActive && !!synthesis?.product && laboratorySynthesisView === 'substance')


  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => {
    if (catalogViewMode) return
    const p = camera as THREE.PerspectiveCamera
    // eslint-disable-next-line react-hooks/immutability
    p.fov = 58
    p.updateProjectionMatrix()
    camera.position.set(0, 1.25, 6.2)
    camera.lookAt(0, 0.18, 0)
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
  }, [camera, catalogViewMode, showSettledHero, previewActive, synthesis?.runId, synthesisSettledProduct?.id])

  // Лёгкий авто-тюнинг: если FPS проседает — переключаемся на low и обратно с гистерезисом.
  // Делается здесь (внутри Canvas), чтобы измерять delta из render-loop без внешних зависимостей.
  useEffect(() => {
    perfLevelRef.current = 'high'
    perfAcc.current = { t: 0, lowT: 0, highT: 0, fps: 60 }
    onPerfLevelChange?.('high')
  }, [onPerfLevelChange])

  useFrame((_, delta) => {
    // delta может быть очень большим при сворачивании окна; ограничим.
    const d = Math.min(0.25, Math.max(0.0005, delta))
    const fps = 1 / d
    const a = perfAcc.current
    // EMA сглаживание
    a.fps = a.fps * 0.9 + fps * 0.1
    a.t += d
    if (a.t < 0.25) return
    a.t = 0

    const cur = perfLevelRef.current
    const LOW_ENTER_FPS = 50
    const HIGH_EXIT_FPS = 58
    const ENTER_SEC = 0.8
    const EXIT_SEC = 1.5

    if (cur === 'high') {
      if (a.fps < LOW_ENTER_FPS) a.lowT += 0.25
      else a.lowT = Math.max(0, a.lowT - 0.25)
      if (a.lowT >= ENTER_SEC) {
        perfLevelRef.current = 'low'
        a.highT = 0
        onPerfLevelChange?.('low')
      }
    } else {
      if (a.fps > HIGH_EXIT_FPS) a.highT += 0.25
      else a.highT = Math.max(0, a.highT - 0.25)
      if (a.highT >= EXIT_SEC) {
        perfLevelRef.current = 'high'
        a.lowT = 0
        onPerfLevelChange?.('high')
      }
    }
  })

  return (
    <>
      {synthActive && synthesis ? (
        <SynthesisOnLabScene
          key={synthesis.runId}
          zSlots={synthesis.zSlots}
          flyTerms={synthesis.flyTerms}
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
      ) : termsPreviewVisible && reactorPreviewTerms ? (
        <>
          <color attach="background" args={[LAB_SCENE_CLEAR_HEX]} />
          <fog attach="fog" args={[LAB_SCENE_CLEAR_HEX, 6, 28]} />
          <ambientLight intensity={0.22} />
          <directionalLight position={[4, 6, 2]} intensity={0.55} color="#b8c8ff" />
          <ReactorTermsPreview terms={reactorPreviewTerms} />
        </>
      ) : previewActive && transformPreviewCompound ? (
        <TransformPreviewHero compound={transformPreviewCompound} />
      ) : (
        <>
          <color attach="background" args={[LAB_SCENE_CLEAR_HEX]} />
          <fog attach="fog" args={[LAB_SCENE_CLEAR_HEX, 6, 28]} />
          {!reactorViewOpen && !synthActive ? (
            <Stars radius={100} depth={50} count={1600} factor={3} saturation={0} fade speed={0.35} />
          ) : null}
          <ambientLight intensity={0.22} />
          <directionalLight position={[4, 6, 2]} intensity={0.55} color="#b8c8ff" />
          <group position={[0, 0, 0]}>
            {structureZ != null ? (
              <AtomStructureModel z={structureZ} />
            ) : reactorViewOpen ? null : (
              <DecorativeAtom />
            )}
          </group>
          {!reactorViewOpen
            ? particles.map((p) => (
                <DraggableParticle
                  key={p.id}
                  particle={p}
                  onParticleMove={onParticleMove}
                  onInspectAtom={onInspectAtom}
                />
              ))
            : null}
        </>
      )}
      {catalogViewMode ? <CatalogCanvasResizeSync /> : null}
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
  reactorPreviewTerms = null,
  transformPreviewCompound = null,
  reactorViewOpen = false,
  synthesisSettledProduct = null,
  laboratorySynthesisView = 'reactor',
}: {
  particles: readonly LabParticle[]
  onParticleMove: (id: string, pos: Vec3) => void
  structureZ: number | null
  onInspectAtom?: (z: number) => void
  synthesisRunActive?: boolean
  reactorPreviewTerms?: readonly ReactorEquationTerm[] | null
  transformPreviewCompound?: CompoundDef | null
  reactorViewOpen?: boolean
  synthesisSettledProduct?: CompoundDef | null
  laboratorySynthesisView?: 'reactor' | 'substance'
  synthesis: {
    runId: number
    zSlots: readonly number[]
    flyTerms: readonly ReactorEquationTerm[]
    product: CompoundDef | null
    onDone: (kind: 'success' | 'fail') => void
    onSynthesisStageChange?: (stage: 'reactor' | 'substance') => void
  } | null
}) {
  const { t } = useT()
  const [perfLevel, setPerfLevel] = useState<PerfLevel>('high')
  const lowPower3d =
    synthesisRunActive || reactorViewOpen || laboratorySynthesisView === 'substance'
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
        {t('lab.webglUnavailable')}
      </div>
    )
  }
  return (
    <CanvasErrorBoundary fallback={<CanvasSceneErrorFallback />}>
      <Canvas
        gl={{
          antialias: !lowPower3d,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        dpr={lowPower3d ? 1 : perfLevel === 'low' ? 1 : [1, 1.5]}
        onCreated={(state) => {
          const bg = hexToColor(LAB_SCENE_CLEAR_HEX)
          state.gl.setClearColor(bg, 1)
          state.scene.background = bg
          const canvas = state.gl.domElement
          const onLost = (e: Event) => {
            e.preventDefault()
          }
          const onRestored = () => {
            state.gl.setClearColor(bg, 1)
            state.scene.background = bg
            state.gl.setSize(state.size.width, state.size.height)
            state.invalidate()
          }
          canvas.addEventListener('webglcontextlost', onLost)
          canvas.addEventListener('webglcontextrestored', onRestored)
        }}
      >
        <SceneContent
          particles={particles}
          onParticleMove={onParticleMove}
          structureZ={structureZ}
          onInspectAtom={onInspectAtom}
          synthesis={synthesis}
          synthesisRunActive={synthesisRunActive}
          onPerfLevelChange={setPerfLevel}
          reactorPreviewTerms={reactorPreviewTerms}
          transformPreviewCompound={transformPreviewCompound}
          reactorViewOpen={reactorViewOpen}
          synthesisSettledProduct={synthesisSettledProduct}
          laboratorySynthesisView={laboratorySynthesisView}
        />
      </Canvas>
    </CanvasErrorBoundary>
  )
}
