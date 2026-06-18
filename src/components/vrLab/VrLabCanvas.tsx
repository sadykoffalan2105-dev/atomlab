import { OrbitControls, ContactShadows, Html } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { compoundById } from '../../data/compounds'
import type { VrLabBenchState } from '../../vrLab/types'
import { VrLabAmbientLab, VrLabReactionParticles } from './VrLabReactionParticles'
import { VrLabBeaker, VrLabBenchTable, VrLabTestTube, VrLabTubeRack } from './VrLabGlassware'

type Props = {
  bench: VrLabBenchState
  onSelectTube: (id: string) => void
}

function BenchScene({ bench, onSelectTube }: Props) {
  const tubePositions: [number, number, number][] = [
    [-1.35, 0.04, 0],
    [-1.11, 0.04, 0],
    [-0.87, 0.04, 0],
    [-0.63, 0.04, 0],
  ]

  return (
    <>
      <VrLabAmbientLab />
      <VrLabBenchTable />
      <VrLabTubeRack tubeCount={4} />

      {bench.tubes.map((tube, i) => (
        <group key={tube.id}>
          <VrLabTestTube
            position={tubePositions[i] ?? [0, 0.04, 0]}
            label={tube.label}
            content={tube.content}
            selected={bench.selectedTubeId === tube.id}
            onClick={() => onSelectTube(tube.id)}
          />
          <Html
            position={[(tubePositions[i]?.[0] ?? 0), -0.22, 0.16]}
            center
            distanceFactor={6}
            style={{
              pointerEvents: 'none',
              fontSize: '11px',
              fontWeight: 800,
              color: '#9eb8ff',
              textShadow: '0 1px 4px #000',
            }}
          >
            {tube.label}
          </Html>
          {tube.content ? (
            <Html
              position={[(tubePositions[i]?.[0] ?? 0), 0.62, 0]}
              center
              distanceFactor={7}
              style={{
                pointerEvents: 'none',
                fontSize: '9px',
                fontWeight: 700,
                color: '#e8eef8',
                background: 'rgba(8,12,28,0.75)',
                padding: '2px 6px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              {compoundById[tube.content.compoundId]?.formulaUnicode ?? tube.content.compoundId}
            </Html>
          ) : null}
        </group>
      ))}

      <VrLabBeaker position={[0.95, 0.04, 0]} content={bench.beaker} mixing={bench.mixing} />
      <Html
        position={[0.95, -0.22, 0.16]}
        center
        distanceFactor={6}
        style={{
          pointerEvents: 'none',
          fontSize: '10px',
          fontWeight: 800,
          color: '#5cffd4',
        }}
      >
        Смесь
      </Html>

      <VrLabReactionParticles
        active={bench.mixing}
        result={bench.lastMix}
        position={[0.95, 0.35, 0]}
      />

      <ContactShadows position={[0, -0.06, 0]} opacity={0.45} scale={8} blur={2.5} far={4} />
      <OrbitControls
        makeDefault
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={2.2}
        maxDistance={6.5}
        target={[0, 0.2, 0]}
      />
    </>
  )
}

export function VrLabCanvas({ bench, onSelectTube }: Props) {
  return (
    <Canvas
      shadows
      camera={{ position: [0.5, 1.35, 3.2], fov: 42 }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 1.75]}
    >
      <BenchScene bench={bench} onSelectTube={onSelectTube} />
    </Canvas>
  )
}
