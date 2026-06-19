import { ContactShadows, Html, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import {
  Component,
  Suspense,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { compoundById } from '../../data/compounds'
import type { VrLabBenchState } from '../../vrLab/types'
import { VAT_POSITION } from '../../vrLab/vrLabShelfLayout'
import { VrLabAmbientDust } from './VrLabAmbientLife'
import { VrLabBenchZones } from './VrLabBenchZones'
import { CinematicPipeline } from './CinematicPipeline'
import { VrLabGrabProvider } from './VrLabGrabContext'
import { LabLightingRig } from './LabLightingRig'
import { VrLabEnvironment } from './VrLabEnvironment'
import { VrLabEquipmentScene } from './VrLabEquipment'
import { VrLabBeaker } from './VrLabGlassware'
import { VrLabPhysicsWorld } from './VrLabPhysicsWorld'
import { VrLabPourBridge } from './VrLabPourBridge'
import { VrLabReactionVfx } from './VrLabReactionVfx'
import { VrLabPracticeMissionRing } from './education/VrLabPracticeMissionRing'
import { VrLabSceneDriver } from './VrLabSceneDriver'
import { VrLabShelfFlasksScene } from './VrLabShelfFlasks'
import { useVrLabPerf, VrLabPerfProvider } from './vrLabPerformance'
import { VR_THEME } from './vrLabTheme'

type Props = {
  bench: VrLabBenchState
  practiceTarget?: { a: string; b: string } | null
  onSelectShelfFlask: (id: string) => void
  onSelectVat: () => void
  onMoveShelfFlask: (id: string, position: [number, number, number]) => void
  onPourFlaskToVat: (id: string) => void
  onReady?: () => void
  onFail?: () => void
}

const REACTOR_SCALE = 0.72

function resolvePreviewCompound(bench: VrLabBenchState): string | null {
  if (bench.beaker?.compoundId) return bench.beaker.compoundId
  const target = bench.selectedTarget
  if (target?.kind === 'shelf') {
    const flask = bench.shelfFlasks.find((f) => f.id === target.id)
    if (flask?.content?.compoundId) return flask.content.compoundId
  }
  if (bench.vatReagentA?.compoundId) return bench.vatReagentA.compoundId
  return bench.shelfFlasks.find((f) => f.content)?.content?.compoundId ?? null
}

function BenchScene({
  bench,
  practiceTarget = null,
  onSelectShelfFlask,
  onSelectVat,
  onMoveShelfFlask,
  onPourFlaskToVat,
  onReady,
}: Props) {
  const perf = useVrLabPerf()
  const controlsRef = useRef<{ enabled: boolean } | null>(null)
  const [dragging, setDragging] = useState(false)
  const previewCompoundId = useMemo(() => resolvePreviewCompound(bench), [bench])
  const selectedShelfId =
    bench.selectedTarget?.kind === 'shelf' ? bench.selectedTarget.id : null
  const vatSelected = bench.selectedTarget?.kind === 'vat'
  const vfxActive =
    bench.mixing || bench.animPhase === 'reacting' || bench.animPhase === 'combining'
  const vfxProgress =
    bench.animPhase === 'reacting' || bench.animPhase === 'combining'
      ? bench.animProgress
      : bench.mixing
        ? 0.72
        : 0
  const busy = bench.animPhase !== 'idle'

  const labelStyle = useMemo(
    () => ({
      pointerEvents: 'none' as const,
      fontSize: '10px',
      fontWeight: 700,
      color: VR_THEME.purpleBright,
      background: 'rgba(10,6,24,0.88)',
      padding: '3px 10px',
      borderRadius: '8px',
      border: '1px solid rgba(168,85,247,0.45)',
      whiteSpace: 'nowrap' as const,
    }),
    [],
  )

  useEffect(() => {
    onReady?.()
  }, [onReady])

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.enabled = !dragging
  }, [dragging])

  return (
    <VrLabGrabProvider selectedId={selectedShelfId} busy={busy}>
      <VrLabSceneDriver
        animPhase={bench.animPhase}
        dragging={dragging}
        mixing={bench.mixing}
        autoMixActive={bench.autoMixFlaskId != null}
      />
      <VrLabPhysicsWorld>
        <VrLabEnvironment />
        <LabLightingRig />
        <VrLabAmbientDust />
        <VrLabEquipmentScene previewCompoundId={previewCompoundId} />
        <VrLabBenchZones highlight={dragging} />
        <VrLabShelfFlasksScene
          flasks={bench.shelfFlasks}
          selectedId={selectedShelfId}
          pourFlaskId={bench.pourShelfFlaskId}
          pourProgress={bench.animProgress}
          busy={busy}
          autoMixFlaskId={bench.autoMixFlaskId}
          autoMixOverridePos={bench.autoMixOverridePos}
          autoMixTilt={bench.autoMixTilt}
          practiceTarget={practiceTarget}
          onSelect={onSelectShelfFlask}
          onDragStart={() => setDragging(true)}
          onDragEnd={(id, pos) => {
            setDragging(false)
            onMoveShelfFlask(id, pos)
          }}
          onPourFlaskToVat={onPourFlaskToVat}
        />

      <VrLabBeaker
        position={VAT_POSITION}
        scale={REACTOR_SCALE}
        content={bench.beaker}
        mixing={bench.mixing || bench.animPhase === 'reacting'}
        mixColor={bench.mixColor ?? undefined}
        mixProgress={bench.animPhase === 'reacting' ? bench.animProgress : 0}
        reactionHeat={bench.lastMix?.heat ?? 0}
        vfxPhase={bench.animPhase}
        vfxProgress={vfxProgress}
        vfxMixing={bench.mixing}
        lastMix={bench.lastMix}
        lastReactionPair={bench.lastReactionPair}
        selected={vatSelected}
        glassHighlight={vatSelected || bench.mixing || bench.animPhase !== 'idle'}
        onClick={() => onSelectVat()}
      />

      {bench.pourShelfFlaskId && bench.animPhase === 'pouring' ? (
        <VrLabPourBridge
          flask={bench.shelfFlasks.find((f) => f.id === bench.pourShelfFlaskId)}
          target={VAT_POSITION}
          progress={bench.animProgress}
          compoundId={
            bench.pourCompoundId ??
            bench.shelfFlasks.find((f) => f.id === bench.pourShelfFlaskId)?.content?.compoundId ??
            null
          }
        />
      ) : null}

      {bench.beaker ? (
        <Html position={[VAT_POSITION[0], 0.32, VAT_POSITION[2]]} center distanceFactor={8} style={labelStyle}>
          {compoundById[bench.beaker.compoundId]?.formulaUnicode ?? bench.beaker.compoundId}
          {bench.vatReagentA ? ' + ?' : ''}
        </Html>
      ) : null}

      <VrLabPracticeMissionRing
        active={!!practiceTarget && !bench.beaker}
        position={VAT_POSITION}
      />

      <VrLabReactionVfx
        active={vfxActive}
        result={bench.lastMix}
        phase={bench.animPhase}
        mixing={bench.mixing}
        progress={vfxProgress}
        position={[VAT_POSITION[0], 0.12, VAT_POSITION[2]]}
        reactionPair={bench.lastReactionPair}
      />

      {perf.shadows ? (
        <ContactShadows
          position={[0, 0.001, 0.06]}
          opacity={0.38}
          scale={3.5}
          blur={2.2}
          far={2.5}
          color="#1a0a30"
          frames={1}
        />
      ) : null}

      <OrbitControls
        ref={controlsRef as never}
        makeDefault
        minPolarAngle={0.52}
        maxPolarAngle={Math.PI / 2.12}
        minDistance={2.4}
        maxDistance={5.5}
        target={[0.05, 0.32, -0.04]}
        enableDamping
        dampingFactor={0.07}
        enabled={!dragging}
      />

      <CinematicPipeline />
      </VrLabPhysicsWorld>
    </VrLabGrabProvider>
  )
}

const MemoBenchScene = memo(BenchScene)

class VrLabErrorBoundary extends Component<
  { children: ReactNode; onFail?: () => void },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[VrLab] render error', error, info.componentStack)
    this.props.onFail?.()
  }

  render() {
    if (this.state.failed) return null
    return this.props.children
  }
}

function VrLabCanvasInner({
  bench,
  practiceTarget = null,
  onSelectShelfFlask,
  onSelectVat,
  onMoveShelfFlask,
  onPourFlaskToVat,
  onReady,
  onFail,
}: Props) {
  const perf = useVrLabPerf()

  return (
    <Canvas
      shadows={perf.shadows}
      camera={{ position: [0.05, 0.82, 3.05], fov: 46 }}
      gl={{
        antialias: perf.tier !== 'low',
        alpha: false,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      }}
      dpr={perf.dpr}
      frameloop="demand"
      onCreated={({ gl }) => {
        gl.setClearColor(VR_THEME.bg)
        const canvas = gl.domElement
        const onLost = (e: Event) => {
          e.preventDefault()
          console.warn('[VrLab] WebGL context lost')
          onFail?.()
        }
        canvas.addEventListener('webglcontextlost', onLost, { once: true })
      }}
    >
      <Suspense fallback={null}>
        <MemoBenchScene
          bench={bench}
          practiceTarget={practiceTarget}
          onSelectShelfFlask={onSelectShelfFlask}
          onSelectVat={onSelectVat}
          onMoveShelfFlask={onMoveShelfFlask}
          onPourFlaskToVat={onPourFlaskToVat}
          onReady={onReady}
          onFail={onFail}
        />
      </Suspense>
    </Canvas>
  )
}

export function VrLabCanvas(props: Omit<Props, 'onReady' | 'onFail'>) {
  return (
    <VrLabPerfProvider>
      <VrLabErrorBoundary>
        <VrLabCanvasInner {...props} />
      </VrLabErrorBoundary>
    </VrLabPerfProvider>
  )
}

export type VrLabCanvasShellProps = Props & { mount: boolean }

export function VrLabCanvasShell({
  mount,
  bench,
  practiceTarget = null,
  onSelectShelfFlask,
  onSelectVat,
  onMoveShelfFlask,
  onPourFlaskToVat,
  onReady,
  onFail,
}: VrLabCanvasShellProps) {
  if (!mount) return null
  return (
    <VrLabPerfProvider>
      <VrLabErrorBoundary onFail={onFail}>
        <VrLabCanvasInner
          bench={bench}
          practiceTarget={practiceTarget}
          onSelectShelfFlask={onSelectShelfFlask}
          onSelectVat={onSelectVat}
          onMoveShelfFlask={onMoveShelfFlask}
          onPourFlaskToVat={onPourFlaskToVat}
          onReady={onReady}
          onFail={onFail}
        />
      </VrLabErrorBoundary>
    </VrLabPerfProvider>
  )
}
