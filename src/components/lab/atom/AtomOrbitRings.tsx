import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { buildVisualOrbitLayout } from './atomOrbitLayout'
import {
  ATOM_ORBIT_COLOR,
  ATOM_ORBIT_GLOW,
  buildOrbitCurve,
  orbitColorsFromAccent,
} from './atomCosmicShared'

function ThinOrbitEllipse({
  radius,
  aspect,
  euler,
  segments,
  opacity,
  orbitColor,
  orbitGlow,
  orbitSolid,
  decorative = false,
}: {
  radius: number
  aspect: number
  euler: [number, number, number]
  segments: number
  opacity: number
  orbitColor: THREE.Color
  orbitGlow: THREE.Color
  orbitSolid: THREE.Color
  decorative?: boolean
}) {
  const [eRx, eRy, eRz] = euler

  const linePts = useMemo(() => {
    const curve = buildOrbitCurve(radius, segments, aspect)
    return curve.getPoints(segments)
  }, [radius, segments, aspect])

  const glowPts = useMemo(() => {
    const curve = buildOrbitCurve(radius, Math.max(32, Math.floor(segments * 0.6)), aspect)
    return curve.getPoints(Math.max(32, Math.floor(segments * 0.6)))
  }, [radius, segments, aspect])

  const lineOpacity = decorative ? opacity * 0.55 : opacity
  const glowOpacity = decorative ? opacity * 0.22 : opacity * 0.36
  const solidOpacity = decorative ? opacity * 0.82 : Math.min(1, opacity * 1.08)

  return (
    <group rotation={[eRx, eRy, eRz]}>
      <Line
        points={linePts}
        color={orbitSolid}
        transparent
        opacity={solidOpacity}
        depthWrite={false}
        blending={THREE.NormalBlending}
        lineWidth={decorative ? 1.3 : 1.9}
        renderOrder={2}
      />
      <Line
        points={linePts}
        color={orbitColor}
        transparent
        opacity={lineOpacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        lineWidth={decorative ? 1.1 : 1.55}
        renderOrder={1}
      />
      <Line
        points={glowPts}
        color={orbitGlow}
        transparent
        opacity={glowOpacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        lineWidth={decorative ? 2.0 : 2.9}
        renderOrder={0}
      />
    </group>
  )
}

/** Светящиеся эллиптические орбиты — цвет CPK, геометрия совпадает с электронами. */
export function AtomOrbitRings({
  shells,
  shellMul = 1,
  lite = false,
  synthesisDetail = false,
  accentHex,
}: {
  shells: readonly number[]
  shellMul?: number
  lite?: boolean
  synthesisDetail?: boolean
  electronTotal?: number
  accentHex?: string
}) {
  const segments = lite ? 56 : synthesisDetail ? 72 : 68
  const opacity = synthesisDetail ? 0.84 : lite ? 0.66 : 0.78

  const { core: orbitColor, glow: orbitGlow, solid: orbitSolid } = useMemo(() => {
    if (accentHex) return orbitColorsFromAccent(accentHex)
    return {
      core: ATOM_ORBIT_COLOR.clone(),
      glow: ATOM_ORBIT_GLOW.clone(),
      solid: ATOM_ORBIT_COLOR.clone(),
    }
  }, [accentHex])

  const orbitSpecs = useMemo(
    () => buildVisualOrbitLayout(shells, shellMul).rings,
    [shells, shellMul],
  )

  return (
    <group>
      {orbitSpecs.map((spec) => (
        <ThinOrbitEllipse
          key={spec.id}
          radius={spec.radius}
          aspect={spec.aspect}
          euler={spec.euler}
          segments={segments}
          opacity={opacity}
          orbitColor={orbitColor}
          orbitGlow={orbitGlow}
          orbitSolid={orbitSolid}
          decorative={spec.decorative}
        />
      ))}
    </group>
  )
}
