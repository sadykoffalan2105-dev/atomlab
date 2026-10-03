/**
 * § 2.12, выделение газа: Zn + 2HCl → ZnCl₂ + H₂↑.
 * Шаги: 0 рассмотреть гранулу цинка · 1 налить соляную кислоту · 2 опустить цинк · 3 наблюдать (цинк растворяется).
 */
import * as THREE from 'three'
import { Pose, Target, ease, hill, mix, mixV, useCrossing, type PFn, type V3 } from '../rigCore'
import { Bubbles, PourStream, playFizz } from '../parts/effects'
import { BOTTLE_H, ReagentBottle, TUBE_H, TestTube, TubeRack, TubeTag, WatchGlass, ZnGranule } from '../parts/glassware'

const TUBE_X = 0
const BOTTOM = 0.012
const BOTTLE: V3 = [-0.26, 0, -0.02]
const DISH: V3 = [0.22, 0, 0.08]
const LEVEL = 0.036
const POUR_LIP_Y = BOTTOM + TUBE_H + 0.03

const level: PFn = (p) => LEVEL * ease(p, 1.42, 1.72)
const bubbles: PFn = (p) => ease(p, 2.72, 2.95) * (1 - 0.35 * ease(p, 3.6, 4))

export function ZnHclRig() {
  useCrossing(2.72, () => playFizz(4.5))
  return (
    <group>
      <TubeRack xs={[-0.04, TUBE_X, 0.04]} />
      <group position={[TUBE_X, BOTTOM, 0]}>
        <TestTube level={level} liquidColor="#eef7ff" />
        <Bubbles level={level} rate={bubbles} fromY={0.008} />
        <group position={[0, 0.118, 0]}>
          <TubeTag text="HCl" />
        </group>
      </group>
      <Target name="tube-acid" size={[0.06, 0.17, 0.06]} center={[TUBE_X, 0.085, 0]} hintY={0.21} />

      {/* Склянка с соляной кислотой: начало группы — горлышко */}
      <Pose
        pose={(p) => {
          const rest: V3 = [BOTTLE[0], BOTTLE_H, BOTTLE[2]]
          const up = ease(p, 1, 1.22) * (1 - ease(p, 1.88, 2))
          const over = ease(p, 1.18, 1.4) * (1 - ease(p, 1.76, 1.92))
          const tilt = ease(p, 1.36, 1.5) * (1 - ease(p, 1.7, 1.8))
          const lifted: V3 = [BOTTLE[0], 0.27, BOTTLE[2]]
          const lip: V3 = [TUBE_X - 0.003, POUR_LIP_Y, 0]
          const pos = mixV(mixV(rest, lifted, up), lip, over)
          return { pos, rot: [0, 0, -1.85 * tilt] }
        }}
      >
        <ReagentBottle formula="HCl" name="соляная кислота" level={(p) => mix(1, 0.82, ease(p, 1.42, 1.72))} />
        <group position={[0, -BOTTLE_H, 0]}>
          <Target name="bottle-hcl" size={[0.07, 0.13, 0.07]} center={[0, 0.06, 0]} hintY={0.16} />
        </group>
      </Pose>
      <PourStream
        x={TUBE_X - 0.003}
        z={0}
        top={() => POUR_LIP_Y - 0.004}
        bottom={(p) => BOTTOM + Math.max(0.006, level(p))}
        show={(p) => hill(p, 1.44, 1.72, 0.15)}
      />

      <group position={DISH as unknown as THREE.Vector3Tuple}>
        <WatchGlass />
      </group>
      {/* Гранула цинка: рассмотреть → в пробирку → растворяется */}
      <Pose
        pose={(p) => {
          const rest: V3 = [DISH[0], 0.006, DISH[2]]
          const look = hill(p, 0, 1, 0.3)
          const lookPos: V3 = [DISH[0] - 0.02, 0.12, DISH[2] + 0.02]
          let pos = mixV(rest, lookPos, look)
          const lifted: V3 = [DISH[0], 0.24, DISH[2]]
          const above: V3 = [TUBE_X, POUR_LIP_Y + 0.03, 0]
          pos = mixV(pos, lifted, ease(p, 2, 2.2))
          pos = mixV(pos, above, ease(p, 2.18, 2.5))
          const fall = Math.min(1, Math.max(0, (p - 2.52) / 0.2))
          const bottomY = BOTTOM + 0.0045
          pos = [pos[0], mix(pos[1], bottomY, fall * fall), pos[2]]
          const shrink = mix(1, 0.42, ease(p, 2.9, 4))
          return { pos, rot: [0.3 * look, p * 0.8 * look + 0.4, 0], scale: shrink }
        }}
      >
        <ZnGranule size={0.0055} seed={1.3} />
        <Target name="zn-granule" size={[0.05, 0.04, 0.05]} center={[0, 0.006, 0]} hintY={0.06} />
      </Pose>
    </group>
  )
}
