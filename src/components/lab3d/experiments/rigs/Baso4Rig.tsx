/**
 * § 2.12, образование осадка: BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl.
 * Две пробирки в штативе; кислоту приливают к раствору хлорида бария — белая муть, затем осадок на дне.
 * Шаги: 0 рассмотреть BaCl₂ · 1 взять H₂SO₄ · 2 прилить · 3 поставить пробирку и наблюдать оседание.
 */
import { Pose, Target, ease, hill, mix, type PFn } from '../rigCore'
import { Precipitate, PourStream } from '../parts/effects'
import { TUBE_H, TUBE_R, TestTube, TubeRack, TubeTag } from '../parts/glassware'
import { GripHand } from '../parts/practicalware'

const XA = -0.03
const XB = 0.03
const BOTTOM = 0.012
const LEVEL_A = 0.05
const LEVEL_B = 0.04
/** Над пробиркой A: горлышко B в 3,5 см над её горлышком. */
const POUR_LIP_Y = BOTTOM + TUBE_H + 0.035
const TILT = 1.95

const levelA: PFn = (p) => mix(LEVEL_A, LEVEL_A + LEVEL_B - 0.004, ease(p, 2.28, 2.85))
const levelB: PFn = (p) => mix(LEVEL_B, 0, ease(p, 2.14, 2.7))
const cloudA: PFn = (p) => ease(p, 2.3, 2.9) * (1 - 0.86 * ease(p, 3.15, 3.95))

export function Baso4Rig() {
  return (
    <group>
      <TubeRack xs={[-0.09, XA, XB, 0.09]} />

      {/* Пробирка A — раствор BaCl₂ */}
      <Pose
        pose={(p) => {
          const k = hill(p, 0, 1, 0.3)
          return { pos: [XA, BOTTOM + 0.075 * k, 0], rot: [0, Math.sin(ease(p, 0.1, 0.9) * Math.PI * 2) * 0.5, 0.12 * k] }
        }}
      >
        <TestTube level={levelA} cloud={cloudA} liquidColor="#e8f4ff" />
        <Precipitate level={levelA} appear={(p) => ease(p, 2.3, 2.8)} settle={(p) => ease(p, 3.05, 3.98)} layer={0.015} />
        <group position={[0, 0.118, 0]}>
          <TubeTag text="BaCl₂" />
        </group>
        <Target name="tube-bacl2" size={[0.045, 0.17, 0.045]} center={[0, 0.085, 0]} ring={false} hintY={0.2} />
      </Pose>

      {/* Пробирка B — H₂SO₄; начало группы — горлышко (вокруг него наклоняют пробирку) */}
      <Pose
        pose={(p) => {
          const up = ease(p, 1, 1.4) * (1 - ease(p, 3.55, 3.9))
          const over = ease(p, 1.35, 1.95) * (1 - ease(p, 3.2, 3.6))
          const tilt = ease(p, 2, 2.3) * (1 - ease(p, 2.95, 3.25))
          const restLip = BOTTOM + TUBE_H
          const y = mix(restLip, restLip + 0.12, up) * (1 - over) + POUR_LIP_Y * over
          return { pos: [mix(XB, XA + 0.002, over), y, 0], rot: [0, 0, TILT * tilt] }
        }}
      >
        <group position={[0, -TUBE_H, 0]}>
          <TestTube level={levelB} liquidColor="#f1f7ff" />
          <group position={[0, 0.118, 0]}>
            <TubeTag text="H₂SO₄" />
          </group>
          <Target name="tube-h2so4" size={[0.045, 0.17, 0.045]} center={[0, 0.085, 0]} ring={false} hintY={0.2} />
          {/* пока пробирка не в штативе — она в руке ученика, а не висит в воздухе */}
          <group position={[0, 0.082, 0]}>
            <GripHand r={TUBE_R} hold={(p) => ease(p, 1, 1.4) * (1 - ease(p, 3.55, 3.9))} />
          </group>
        </group>
      </Pose>

      <PourStream
        x={XA + 0.002}
        z={0}
        top={() => POUR_LIP_Y - 0.002}
        bottom={(p) => BOTTOM + levelA(p)}
        show={(p) => hill(p, 2.18, 2.82, 0.12)}
        color="#eef6ff"
      />
    </group>
  )
}
