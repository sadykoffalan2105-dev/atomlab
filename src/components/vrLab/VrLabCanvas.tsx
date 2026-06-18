import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { ContactShadows, Html, OrbitControls, Text } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { memo, useMemo } from 'react'
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
}

const TUBE_POSITIONS: [number, number, number][] = [
  [-1.42, 0.02, 0.1],
  [-1.2, 0.02, 0.1],
  [-0.98, 0.02, 0.1],
  [-0.76, 0.02, 0.1],
]

const MIX_VESSEL_POS: [number, number, number] = [0.82, 0.02, 0.1]

function BenchScene({ bench, onSelectTube }: Props) {
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
      boxShadow: '0 0 12px rgba(168,85,247,0.35)',
      whiteSpace: 'nowrap' as const,
    }),
    [],
  )

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
            <Text
              position={[pos[0], 0.005, pos[2] + 0.12]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.065}
              color={VR_THEME.textMuted}
              anchorX="center"
            >
              {tube.label}
            </Text>
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

      <Text
        position={[MIX_VESSEL_POS[0], 0.005, MIX_VESSEL_POS[2] + 0.22]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.055}
        color={VR_THEME.textMuted}
        anchorX="center"
      >
        Смесь
      </Text>

      <VrLabReactionParticles
        active={bench.mixing || bench.animPhase === 'reacting'}
        result={bench.lastMix}
        position={[MIX_VESSEL_POS[0], 0.3, MIX_VESSEL_POS[2]]}
        progress={bench.animPhase === 'reacting' ? bench.animProgress : 1}
      />

      {perf.shadows ? (
        <ContactShadows
          position={[0, 0.001, 0]}
          opacity={0.55}
          scale={6}
          blur={2.5}
          far={3.5}
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

      {perf.postProcessing ? (
        <EffectComposer multisampling={0}>
          <Bloom
            luminanceThreshold={0.15}
            mipmapBlur
            intensity={perf.bloomIntensity}
            radius={0.5}
            levels={perf.bloomLevels}
          />
          <Vignette eskil={false} offset={0.1} darkness={0.5} />
        </EffectComposer>
      ) : null}
    </>
  )
}

const MemoBenchScene = memo(BenchScene)

function VrLabCanvasInner({ bench, onSelectTube }: Props) {
  const perf = useVrLabPerf()
  return (
    <Canvas
      shadows={perf.shadows}
      camera={{ position: [0.05, 0.82, 3.05], fov: 46 }}
      gl={{ antialias: perf.tier !== 'low', alpha: false, powerPreference: 'high-performance' }}
      dpr={perf.dpr}
      frameloop="always"
    >
      <MemoBenchScene bench={bench} onSelectTube={onSelectTube} />
    </Canvas>
  )
}

export function VrLabCanvas({ bench, onSelectTube }: Props) {
  return (
    <VrLabPerfProvider>
      <VrLabCanvasInner bench={bench} onSelectTube={onSelectTube} />
    </VrLabPerfProvider>
  )
}
