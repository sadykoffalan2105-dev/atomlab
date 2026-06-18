import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { ContactShadows, Html, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import {
  Component,
  Suspense,
  memo,
  useEffect,
  useMemo,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { compoundById } from '../../data/compounds'
import type { VrLabBenchState } from '../../vrLab/types'
import { VrLabEnvironment, VrLabLighting } from './VrLabEnvironment'
import { VrLabEquipmentScene } from './VrLabEquipment'
import { VrLabBeaker, VrLabTestTube, VrLabTubeRack, useMixTilt } from './VrLabGlassware'
import { VrLabReactionParticles } from './VrLabReactionParticles'
import { useVrLabPerf, VrLabPerfProvider } from './vrLabPerformance'
import { VR_THEME } from './vrLabTheme'

type Props = {
  bench: VrLabBenchState
  onSelectTube: (id: string) => void
  onReady?: () => void
  onFail?: () => void
}

const TUBE_POSITIONS: [number, number, number][] = [
  [-1.42, 0.02, 0.1],
  [-1.2, 0.02, 0.1],
  [-0.98, 0.02, 0.1],
  [-0.76, 0.02, 0.1],
]

const MIX_VESSEL_POS: [number, number, number] = [0.82, 0.02, 0.1]

function FloorLabel({ position, text }: { position: [number, number, number]; text: string }) {
  return (
    <Html
      position={position}
      center
      distanceFactor={10}
      style={{
        pointerEvents: 'none',
        fontSize: '11px',
        fontWeight: 700,
        color: VR_THEME.textMuted,
        opacity: 0.85,
        userSelect: 'none',
      }}
    >
      {text}
    </Html>
  )
}

function VrLabPostFx() {
  const perf = useVrLabPerf()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 400)
    return () => window.clearTimeout(t)
  }, [])

  if (!perf.postProcessing || !ready) return null

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        luminanceThreshold={0.2}
        mipmapBlur
        intensity={perf.bloomIntensity}
        radius={0.45}
        levels={perf.bloomLevels}
      />
      <Vignette eskil={false} offset={0.1} darkness={0.45} />
    </EffectComposer>
  )
}

function BenchScene({ bench, onSelectTube, onReady }: Props) {
  const perf = useVrLabPerf()
  const combineTilt = useMixTilt(bench.animPhase === 'combining' ? bench.animProgress : 0)
  const isPouring = bench.animPhase === 'pouring'

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

  return (
    <>
      <VrLabEnvironment />
      <VrLabLighting />
      <VrLabEquipmentScene />
      <VrLabTubeRack tubeCount={4} />

      {bench.tubes.map((tube, i) => {
        const pos = TUBE_POSITIONS[i] ?? [0, 0.02, 0.1]
        const isPourTube = bench.pourTubeId === tube.id && isPouring
        const tilt =
          combineTilt > 0 && (tube.id === 'tube-1' || tube.id === 'tube-2') ? combineTilt : 0

        return (
          <group key={tube.id}>
            <VrLabTestTube
              position={pos}
              content={tube.content}
              selected={bench.selectedTubeId === tube.id}
              onClick={() => onSelectTube(tube.id)}
              pourActive={isPourTube}
              pourProgress={isPourTube ? bench.animProgress : 0}
              tiltMix={tilt}
            />
            <FloorLabel position={[pos[0], 0.04, pos[2] + 0.1]} text={tube.label} />
            {tube.content ? (
              <Html position={[pos[0], 0.62, pos[2]]} center distanceFactor={8} style={labelStyle}>
                {compoundById[tube.content.compoundId]?.formulaUnicode ?? tube.content.compoundId}
              </Html>
            ) : null}
          </group>
        )
      })}

      <VrLabBeaker
        position={MIX_VESSEL_POS}
        content={bench.beaker}
        mixing={bench.mixing || bench.animPhase === 'reacting'}
        mixColor={bench.mixColor ?? undefined}
        mixProgress={bench.animPhase === 'reacting' ? bench.animProgress : 0}
      />

      <FloorLabel position={[MIX_VESSEL_POS[0], 0.04, MIX_VESSEL_POS[2] + 0.18]} text="Смесь" />

      <VrLabReactionParticles
        active={bench.mixing || bench.animPhase === 'reacting'}
        result={bench.lastMix}
        position={[MIX_VESSEL_POS[0], 0.3, MIX_VESSEL_POS[2]]}
        progress={bench.animPhase === 'reacting' ? bench.animProgress : 1}
      />

      {perf.shadows ? (
        <ContactShadows
          position={[0, 0.001, 0]}
          opacity={0.45}
          scale={5}
          blur={2}
          far={3}
          color="#1a0a30"
          frames={1}
        />
      ) : null}

      <OrbitControls
        makeDefault
        minPolarAngle={0.52}
        maxPolarAngle={Math.PI / 2.12}
        minDistance={2.6}
        maxDistance={5.5}
        target={[0.05, 0.28, -0.02]}
        enableDamping
        dampingFactor={0.07}
      />

      <VrLabPostFx />
    </>
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

function VrLabCanvasInner({ bench, onSelectTube, onReady, onFail }: Props) {
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
      frameloop="always"
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
        <MemoBenchScene bench={bench} onSelectTube={onSelectTube} onReady={onReady} onFail={onFail} />
      </Suspense>
    </Canvas>
  )
}

export function VrLabCanvas({ bench, onSelectTube }: Omit<Props, 'onReady' | 'onFail'>) {
  return (
    <VrLabPerfProvider>
      <VrLabErrorBoundary>
        <VrLabCanvasInner bench={bench} onSelectTube={onSelectTube} />
      </VrLabErrorBoundary>
    </VrLabPerfProvider>
  )
}

export type VrLabCanvasShellProps = Props & {
  mount: boolean
}

/** Оболочка: отложенный mount + колбэки загрузки/ошибки для UI. */
export function VrLabCanvasShell({ mount, bench, onSelectTube, onReady, onFail }: VrLabCanvasShellProps) {
  if (!mount) return null
  return (
    <VrLabPerfProvider>
      <VrLabErrorBoundary onFail={onFail}>
        <VrLabCanvasInner bench={bench} onSelectTube={onSelectTube} onReady={onReady} onFail={onFail} />
      </VrLabErrorBoundary>
    </VrLabPerfProvider>
  )
}
