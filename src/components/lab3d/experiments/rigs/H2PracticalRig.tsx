/**
 * Практическое занятие § 5.2 (с. 115): получение водорода и изучение его свойств.
 * Пробирка с газоотводной трубкой в лапке штатива (вместо аппарата Кирюшкина), Zn + HCl.
 * Шаги: 0 налить кислоту · 1 гранулы цинка · 2 пробка с трубкой · 3 собрать H₂ в перевёрнутую пробирку ·
 * 4 зажечь спиртовку · 5 проверка на чистоту (глухой хлопок) · 6 поджечь у трубки, холодное стекло — капли воды.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { Pose, Target, ease, hill, mix, mixV, useCrossing, useRig, type PFn, type V3 } from '../rigCore'
import { Bubbles, Droplets, OUTLET, PopFlash, PourStream, StopperWithTube, playPop, plateDropPoints } from '../parts/effects'
import { BOTTLE_H, GlassPlate, LabStand, ReagentBottle, TUBE_H, TestTube, TubeRack, TubeTag, WatchGlass, ZnGranule } from '../parts/glassware'
import { Flame, FlameLight, Match, Matchbox, SpiritLamp } from '../parts/fire'

const Z0 = -0.05
const TUBE_X = -0.3
const TUBE_BOTTOM = 0.05
const MOUTH_Y = TUBE_BOTTOM + TUBE_H
const STOPPER_IN_Y = MOUTH_Y - 0.012
const OUT_X = TUBE_X + OUTLET.outX
const OUT_TOP = STOPPER_IN_Y + OUTLET.up + OUTLET.upEnd
const DISH: V3 = [-0.17, 0, 0.17]
const BOTTLE: V3 = [0, 0, 0.17]
const STOPPER_REST: V3 = [-0.12, 0, -0.2]
const RACK_Z = -0.2
const C_X = 0.1
const LAMP: V3 = [0.3, 0, 0.06]
const LAMP_FLAME_Y = 0.081
const MATCHBOX: V3 = [0.46, 0, 0.18]
const PLATE: V3 = [0.18, 0.0015, 0.2]
const LEVEL = 0.03
const POUR_LIP_Y = MOUTH_Y + 0.028

const level: PFn = (p) => LEVEL * ease(p, 0.42, 0.75)
const bubbles: PFn = (p) => ease(p, 1.62, 1.85)
const lampFlame: PFn = (p) => ease(p, 4.6, 4.8)
const outletFlame: PFn = (p) => ease(p, 6.05, 6.25)
const popFlash: PFn = (p) => hill(p, 5.5, 5.66, 0.3)

/** Пробирка-приёмник C (начало — горлышко): в штативе → перевёрнута над трубкой → к пламени → обратно в штатив. */
function collectPose(p: number) {
  const rest: V3 = [C_X, 0.012 + TUBE_H, RACK_Z]
  const lifted: V3 = [C_X, 0.32, RACK_Z]
  const aboveOut: V3 = [OUT_X, 0.34, Z0]
  const atOut: V3 = [OUT_X, OUT_TOP - 0.022, Z0]
  const aboveLamp: V3 = [LAMP[0], 0.3, LAMP[2]]
  const atLamp: V3 = [LAMP[0] - 0.006, LAMP_FLAME_Y + 0.062, LAMP[2]]
  let pos = mixV(rest, lifted, ease(p, 3, 3.25))
  pos = mixV(pos, aboveOut, ease(p, 3.2, 3.45))
  pos = mixV(pos, atOut, ease(p, 3.45, 3.62))
  // проверка на чистоту: вверх с трубки → к спиртовке
  pos = mixV(pos, aboveOut, ease(p, 5, 5.12))
  pos = mixV(pos, aboveLamp, ease(p, 5.1, 5.34))
  pos = mixV(pos, atLamp, ease(p, 5.32, 5.48))
  // обратно в штатив (уже снова горлышком вверх)
  pos = mixV(pos, lifted, ease(p, 5.66, 5.86))
  pos = mixV(pos, rest, ease(p, 5.86, 6))
  const flip = ease(p, 3.22, 3.45) * (1 - ease(p, 5.68, 5.88))
  const tiltToFlame = ease(p, 5.32, 5.48) * (1 - ease(p, 5.66, 5.75))
  return { pos, rot: [0, 0, Math.PI * flip - 0.3 * tiltToFlame] as V3 }
}

export function H2PracticalRig() {
  const { quality } = useRig()
  const drops = useMemo(() => plateDropPoints(0.09, 0.06, -0.0022, quality === 'high' ? 70 : 30), [quality])
  useCrossing(5.52, () => playPop('dull'))
  useCrossing(6.03, () => playPop('dull'))
  return (
    <group>
      {/* Штатив с лапкой и пробирка-реактор */}
      <group position={[0, 0, Z0]}>
        <LabStand rodX={-0.4} clampX={TUBE_X} clampY={TUBE_BOTTOM + 0.11} />
        <group position={[TUBE_X, TUBE_BOTTOM, 0]}>
          <TestTube level={level} liquidColor="#eef7ff" />
          <Bubbles level={level} rate={bubbles} fromY={0.008} />
          <group position={[0, 0.07, 0]}>
            <TubeTag text="HCl" />
          </group>
        </group>
      </group>

      {/* Склянка с соляной кислотой (начало — горлышко) */}
      <Pose
        pose={(p) => {
          const rest: V3 = [BOTTLE[0], BOTTLE_H, BOTTLE[2]]
          const lifted: V3 = [BOTTLE[0], 0.33, BOTTLE[2]]
          const lip: V3 = [TUBE_X + 0.003, POUR_LIP_Y, Z0]
          const up = ease(p, 0, 0.2) * (1 - ease(p, 0.86, 1))
          const over = ease(p, 0.15, 0.38) * (1 - ease(p, 0.74, 0.9))
          const tilt = ease(p, 0.34, 0.46) * (1 - ease(p, 0.7, 0.8))
          return { pos: mixV(mixV(rest, lifted, up), lip, over), rot: [0, 0, 1.85 * tilt] }
        }}
      >
        <ReagentBottle formula="HCl" name="соляная кислота" level={(p) => mix(1, 0.84, ease(p, 0.42, 0.75))} />
        <group position={[0, -BOTTLE_H, 0]}>
          <Target name="bottle-hcl" size={[0.07, 0.13, 0.07]} center={[0, 0.06, 0]} hintY={0.16} />
        </group>
      </Pose>
      <PourStream
        x={TUBE_X + 0.003}
        z={Z0}
        top={() => POUR_LIP_Y - 0.004}
        bottom={(p) => TUBE_BOTTOM + Math.max(0.006, level(p))}
        show={(p) => hill(p, 0.44, 0.74, 0.15)}
      />

      {/* Гранулы цинка на часовом стекле → в пробирку */}
      <group position={DISH as unknown as THREE.Vector3Tuple}>
        <WatchGlass />
        <Target name="zn-granule" size={[0.08, 0.04, 0.08]} center={[0, 0.01, 0]} hintY={0.07} />
      </group>
      {[0, 1, 2].map((i) => (
        <Pose
          key={i}
          pose={(p) => {
            const dx = (i - 1) * 0.011
            const rest: V3 = [DISH[0] + dx, 0.0055, DISH[2] + (i === 1 ? 0.008 : -0.004)]
            const lifted: V3 = [DISH[0] + dx * 0.3, 0.29, DISH[2]]
            const above: V3 = [TUBE_X + dx * 0.2, MOUTH_Y + 0.03, Z0]
            let pos = mixV(rest, lifted, ease(p, 1, 1.22))
            pos = mixV(pos, above, ease(p, 1.2, 1.48))
            const d = i * 0.04
            const fall = Math.min(1, Math.max(0, (p - 1.5 - d) / 0.18))
            pos = [pos[0] + fall * dx * 0.3, mix(pos[1], TUBE_BOTTOM + 0.0045 + i * 0.002, fall * fall), pos[2]]
            return { pos, rot: [i, i * 2, 0], scale: mix(1, 0.75, ease(p, 2, 7)) }
          }}
        >
          <ZnGranule size={0.0048} seed={1 + i} />
        </Pose>
      ))}

      {/* Пробка с газоотводной трубкой */}
      <Pose
        pose={(p) => {
          const rest: V3 = STOPPER_REST
          const lifted: V3 = [STOPPER_REST[0], 0.27, STOPPER_REST[2]]
          const above: V3 = [TUBE_X, 0.27, Z0]
          const inPlace: V3 = [TUBE_X, STOPPER_IN_Y, Z0]
          let pos = mixV(rest, lifted, ease(p, 2, 2.3))
          pos = mixV(pos, above, ease(p, 2.25, 2.7))
          pos = mixV(pos, inPlace, ease(p, 2.7, 2.95))
          return { pos }
        }}
      >
        <StopperWithTube />
        <Target name="stopper" size={[0.16, 0.1, 0.05]} center={[0.06, 0.045, 0]} hintY={0.13} />
      </Pose>

      {/* Пробирка-приёмник в штативе для пробирок */}
      <group position={[0, 0, RACK_Z]}>
        <TubeRack xs={[C_X, C_X + 0.04]} />
      </group>
      <Pose pose={collectPose}>
        <group position={[0, -TUBE_H, 0]}>
          <TestTube />
          <Target name="collect-tube" size={[0.045, 0.17, 0.045]} center={[0, 0.085, 0]} ring={false} hintY={0.2} />
        </group>
        <PopFlash flash={popFlash} size={0.026} />
      </Pose>

      {/* Спиртовка и спички */}
      <group position={LAMP as unknown as THREE.Vector3Tuple}>
        <SpiritLamp flame={lampFlame} capOff={(p) => ease(p, 4.05, 4.4)} />
        <Target name="spirit-lamp" size={[0.08, 0.1, 0.08]} center={[0, 0.045, 0]} hintY={0.14} />
      </group>
      <group position={MATCHBOX as unknown as THREE.Vector3Tuple}>
        <Matchbox />
      </group>
      <Pose
        pose={(p) => {
          const rest: V3 = [MATCHBOX[0] - 0.025, 0.018, MATCHBOX[2]]
          const raised: V3 = [MATCHBOX[0] - 0.03, 0.09, MATCHBOX[2] - 0.02]
          const atWick: V3 = [LAMP[0] - 0.048, LAMP_FLAME_Y + 0.004, LAMP[2]]
          const dropped: V3 = [MATCHBOX[0] - 0.02, 0.002, MATCHBOX[2] + 0.035]
          let pos = mixV(rest, raised, ease(p, 4.3, 4.45))
          pos = mixV(pos, atWick, ease(p, 4.45, 4.62))
          pos = mixV(pos, dropped, ease(p, 4.8, 5))
          return { pos, rot: [0, mix(Math.PI, Math.PI + 0.4, ease(p, 4.8, 5)), 0] }
        }}
      >
        <Match lit={(p) => ease(p, 4.4, 4.48) * (1 - ease(p, 4.82, 4.95))} />
      </Pose>

      {/* Пламя водорода у конца газоотводной трубки */}
      <group position={[OUT_X, OUT_TOP, Z0]}>
        <Flame height={0.04} width={0.011} core="#e6f2ff" edge="#7fb0ff" intensity={outletFlame} alpha={0.6} seed={6.2} />
        <PopFlash flash={(p) => hill(p, 6.0, 6.14, 0.3)} color="#cfe3ff" size={0.018} />
        <group position={[0, 0.02, 0]}>
          <FlameLight intensity={outletFlame} color="#a9c8ff" power={0.3} />
        </group>
      </group>

      {/* Холодная стеклянная пластинка над пламенем водорода */}
      <Pose
        pose={(p) => {
          const lifted: V3 = [PLATE[0], 0.36, PLATE[2]]
          const hold: V3 = [OUT_X, OUT_TOP + 0.048, Z0]
          let pos = mixV(PLATE, lifted, ease(p, 6.2, 6.45))
          pos = mixV(pos, hold, ease(p, 6.42, 6.8))
          return { pos, rot: [0.18 * ease(p, 6.42, 6.8), 0, 0] }
        }}
      >
        <GlassPlate />
        <Droplets points={drops} show={(p) => ease(p, 6.8, 7)} />
        <Target name="glass-plate" size={[0.1, 0.04, 0.07]} center={[0, 0.01, 0]} hintY={0.07} />
      </Pose>
    </group>
  )
}
