/**
 * § 2.12, выделение тепла: CH₄ + 2O₂ → CO₂ + 2H₂O + Q. Газовая горелка (природный газ — метан).
 * Шаги: 0 зажечь спичку · 1 открыть кран и поджечь газ сбоку · 2 холодный сухой стакан — капли воды ·
 * 3 стакан с известковой водой — помутнение (CO₂) · 4 закрыть кран.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { Pose, Target, ease, mix, mixV, useRig, type PFn, type V3 } from '../rigCore'
import { Droplets, beakerDropPoints } from '../parts/effects'
import { BEAKER_H, BEAKER_R, Beaker } from '../parts/glassware'
import { BURNER_TOP, GasBurner, GasTap, Hose, Match, Matchbox } from '../parts/fire'
import { useAnimatedMaterial } from '../rigCore'

const BURNER: V3 = [0, 0, 0.02]
const TAP: V3 = [0.3, 0, -0.2]
const MATCHBOX: V3 = [-0.24, 0, 0.17]
const DRY: V3 = [-0.2, 0, -0.1]
const LIME: V3 = [0.2, 0, -0.1]
/** Перевёрнутый стакан над пламенем: дно (начало группы) на этой высоте. */
const HOLD_Y = BURNER_TOP + 0.07 + BEAKER_H

const flame: PFn = (p) => ease(p, 1.5, 1.75) * (1 - ease(p, 4.3, 4.6))
const valve: PFn = (p) => ease(p, 1.0, 1.3) * (1 - ease(p, 4.0, 4.35))

/** Поза стакана: поднять → перевернуть над пламенем → подержать → вернуть на место. */
function beakerPose(home: V3, a: number, b: number, back0: number, back1: number) {
  return (p: number) => {
    const up = ease(p, a, a + 0.25) * (1 - ease(p, back1 - 0.12, back1))
    const go = ease(p, a + 0.2, b) * (1 - ease(p, back0, back1 - 0.08))
    const lifted: V3 = [home[0], 0.3, home[2]]
    const hold: V3 = [BURNER[0], HOLD_Y, BURNER[2]]
    const base = mixV(home, lifted, up)
    const pos = mixV(base, hold, go)
    return { pos, rot: [Math.PI * go, 0, 0] as V3 }
  }
}

function LimeFilm() {
  const mat = useAnimatedMaterial(
    () => new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.1, roughness: 0.9, depthWrite: false, side: THREE.DoubleSide }),
    (m, p) => {
      m.opacity = 0.1 + 0.72 * ease(p, 3.5, 3.95)
    },
  )
  return (
    <mesh position={[0, 0.034, 0]} material={mat} renderOrder={2}>
      <cylinderGeometry args={[BEAKER_R - 0.0009, BEAKER_R - 0.0009, 0.06, 32, 1, true]} />
    </mesh>
  )
}

export function Ch4BurnRig() {
  const { quality } = useRig()
  const drops = useMemo(() => beakerDropPoints(BEAKER_R - 0.0012, 0.008, 0.066, quality === 'high' ? 90 : 36), [quality])
  const hose = useMemo(
    () =>
      [
        [BURNER[0], 0.022, BURNER[2] - 0.04],
        [BURNER[0] + 0.02, 0.008, BURNER[2] - 0.1],
        [0.15, 0.006, -0.17],
        [0.27, 0.02, -0.19],
        [TAP[0], 0.06, TAP[2] + 0.026],
      ] as const,
    [],
  )
  return (
    <group>
      <group position={BURNER as unknown as THREE.Vector3Tuple}>
        <GasBurner flame={flame} />
      </group>
      <Hose points={hose} />
      <group position={TAP as unknown as THREE.Vector3Tuple}>
        <GasTap open={valve} />
        <Target name="gas-valve" size={[0.08, 0.1, 0.07]} center={[0.01, 0.05, 0]} hintY={0.14} />
      </group>

      <group position={MATCHBOX as unknown as THREE.Vector3Tuple}>
        <Matchbox />
        <Target name="match" size={[0.1, 0.06, 0.07]} center={[0, 0.03, 0]} hintY={0.1} />
      </group>
      <Pose
        pose={(p) => {
          const rest: V3 = [MATCHBOX[0] - 0.025, 0.018, MATCHBOX[2]]
          const raised: V3 = [-0.18, 0.09, 0.15]
          const atBurner: V3 = [BURNER[0] - 0.062, BURNER_TOP + 0.004, BURNER[2]]
          const dropped: V3 = [-0.15, 0.002, 0.22]
          let pos = mixV(rest, raised, ease(p, 0, 0.45))
          pos = mixV(pos, atBurner, ease(p, 1.2, 1.5))
          pos = mixV(pos, dropped, ease(p, 1.78, 2))
          return { pos, rot: [0, mix(0, 0.5, ease(p, 1.78, 2)), mix(0, 0.35, ease(p, 0, 0.45)) * (1 - ease(p, 1.2, 1.5))] }
        }}
      >
        <Match lit={(p) => ease(p, 0.5, 0.75) * (1 - ease(p, 1.8, 1.95))} />
      </Pose>

      {/* Холодный сухой стакан */}
      <Pose pose={beakerPose(DRY, 2, 2.55, 3, 3.3)}>
        <Beaker>
          <Droplets points={drops} show={(p) => ease(p, 2.6, 2.95)} />
        </Beaker>
        <Target name="beaker-dry" size={[0.06, 0.08, 0.06]} center={[0, 0.04, 0]} hintY={0.11} />
      </Pose>

      {/* Стакан, смоченный известковой водой */}
      <Pose pose={beakerPose(LIME, 3.2, 3.6, 4.0, 4.3)}>
        <Beaker>
          <LimeFilm />
        </Beaker>
        <Target name="beaker-lime" size={[0.06, 0.08, 0.06]} center={[0, 0.04, 0]} hintY={0.11} />
      </Pose>
    </group>
  )
}
