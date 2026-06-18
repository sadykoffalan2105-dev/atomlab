import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { ContactShadows, Html, OrbitControls, Text } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { compoundById } from '../../data/compounds'
import type { VrLabBenchState } from '../../vrLab/types'
import { VrLabEnvironment, VrLabLighting } from './VrLabEnvironment'
import { VrLabBeaker, VrLabTestTube, VrLabTubeRack, useMixTilt } from './VrLabGlassware'
import { VrLabReactionParticles } from './VrLabReactionParticles'

type Props = {
  bench: VrLabBenchState
  onSelectTube: (id: string) => void
}

function BenchScene({ bench, onSelectTube }: Props) {
  const tubePositions: [number, number, number][] = [
    [-1.35, 0.02, 0.02],
    [-1.11, 0.02, 0.02],
    [-0.87, 0.02, 0.02],
    [-0.63, 0.02, 0.02],
  ]

  const combineTilt = useMixTilt(bench.animPhase === 'combining' ? bench.animProgress : 0)
  const isPouring = bench.animPhase === 'pouring'

  return (
    <>
      <VrLabEnvironment />
      <VrLabLighting />
      <VrLabTubeRack tubeCount={4} />

      {bench.tubes.map((tube, i) => {
        const pos = tubePositions[i] ?? [0, 0.02, 0]
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
              position={[pos[0], 0.005, pos[2] + 0.14]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.07}
              color="#6a7585"
              anchorX="center"
              anchorY="middle"
              font={undefined}
            >
              {tube.label}
            </Text>
            {tube.content ? (
              <Html
                position={[pos[0], 0.58, pos[2]]}
                center
                distanceFactor={8}
                style={{
                  pointerEvents: 'none',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#1a2030',
                  background: 'rgba(255,255,255,0.88)',
                  padding: '3px 8px',
                  borderRadius: '8px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  whiteSpace: 'nowrap',
                }}
              >
                {compoundById[tube.content.compoundId]?.formulaUnicode ?? tube.content.compoundId}
              </Html>
            ) : null}
          </group>
        )
      })}

      <VrLabBeaker
        position={[0.95, 0.02, 0.02]}
        content={bench.beaker}
        mixing={bench.mixing || bench.animPhase === 'reacting'}
        mixColor={bench.mixColor ?? undefined}
        mixProgress={bench.animPhase === 'reacting' ? bench.animProgress : 0}
      />

      <Text
        position={[0.95, 0.005, 0.16]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.055}
        color="#5a6570"
        anchorX="center"
      >
        Смесь
      </Text>

      <VrLabReactionParticles
        active={bench.mixing || bench.animPhase === 'reacting'}
        result={bench.lastMix}
        position={[0.95, 0.28, 0.02]}
        progress={bench.animPhase === 'reacting' ? bench.animProgress : 1}
      />

      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={0.55}
        scale={6}
        blur={2.2}
        far={3.5}
        color="#000000"
      />

      <OrbitControls
        makeDefault
        minPolarAngle={0.55}
        maxPolarAngle={Math.PI / 2.15}
        minDistance={2.4}
        maxDistance={5.5}
        target={[0, 0.25, 0]}
        enableDamping
        dampingFactor={0.06}
      />

      <EffectComposer multisampling={0}>
        <Bloom
          luminanceThreshold={0.35}
          mipmapBlur
          intensity={0.45}
          radius={0.42}
          levels={6}
        />
      </EffectComposer>
    </>
  )
}

export function VrLabCanvas({ bench, onSelectTube }: Props) {
  return (
    <Canvas
      shadows
      camera={{ position: [0.2, 1.05, 2.85], fov: 38 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
    >
      <BenchScene bench={bench} onSelectTube={onSelectTube} />
    </Canvas>
  )
}
